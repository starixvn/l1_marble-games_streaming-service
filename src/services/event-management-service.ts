import { logger } from "sc-common";
import { AppContainer, EventDetail } from "../types";
import { OddsFeedService } from "./odds-feed-service";
import cron from "cron";
import { EventStreamService } from "./event-stream-service";
import { EventState } from "../stores/event-state";
import { JobScheduler } from "./job-scheduler";
import { extractRoundId } from "../helpers/id-helper";

const scheduleDelay = 10 * 1000;

export class EventManagementService {
  private readonly oddsFeedService: OddsFeedService;
  private readonly logService: typeof logger;
  private readonly eventStreamService: EventStreamService;
  private readonly eventState: EventState;
  private readonly jobScheduler: JobScheduler;

  constructor(container: AppContainer) {
    this.oddsFeedService = container.oddsFeedService;
    this.logService = container.logService;
    this.eventStreamService = container.eventStreamService;
    this.eventState = container.eventState;
    this.jobScheduler = container.jobScheduler;
  }

  async start() {
    const currentEventIDs = await this.getCurrentEventIDsOfAllProducts();

    currentEventIDs.forEach((eventID) => {
      this.firstUpdateCurrentEvent(eventID);
    });

    this.startCron();
  }

  startCron() {
    const job = new cron.CronJob(
      "*/10 * * * * *",
      () => this.schedule().catch(this.logService.logError),
      () => {
        this.logService.logError("Cron job unexpectedly stopped because some other tasks halt it.");
        job.start();
      }
    );

    job.start();
  }

  async schedule() {
    const nextEventIDs = await this.getNextEventIDsForEachProduct();

    this.handleScheduleEvents(Object.values(nextEventIDs));
  }

  handleScheduleEvents(eventIDs: number[]) {
    eventIDs.forEach((eventID) => {
      this.handleScheduleEvent(eventID);
    });
  }

  async firstUpdateCurrentEvent(eventID: number) {
    const updateEvent = await this.oddsFeedService.getEventDetailsWithRetry(eventID);

    if (!updateEvent) {
      this.logService.logError(`Event ${eventID} not found`);
      console.error(`Event ${eventID} not found`);
      return;
    }

    const productCode = updateEvent.productCode;
    let currentEventDetailIndex = 0;
    this.eventState.currentEvents[productCode] = updateEvent;

    updateEvent.eventDetails.forEach((eventDetail, index) => {
      this.handleOddsAvailableForEventDetail(eventDetail, index, productCode);
      this.handleVideoInfoAvailableForEventDetail(eventDetail, index, productCode);
      this.handleResultAvailableForEventDetail(eventDetail, index, productCode);

      if (Date.now() > new Date(eventDetail.resultsAvailableTs).getTime()) {
        currentEventDetailIndex++;
      }
    });

    this.eventState.currentEvents[productCode].currentEventDetailIndex = Math.min(
      currentEventDetailIndex,
      updateEvent.eventDetails.length - 1
    );
  }

  async handleScheduleEvent(eventID: number) {
    const updateEvent = await this.oddsFeedService.getEventDetailsWithRetry(eventID);

    if (!updateEvent) {
      this.logService.logError(`Event ${eventID} not found`);
      console.error(`Event ${eventID} not found`);
      return;
    }

    const scheduledTime = new Date(new Date(updateEvent.scheduleStartTs).getTime() + scheduleDelay);
    const productCode = updateEvent.productCode;
    const jobId = this.generateJobId(productCode, eventID, 0, "schedule");

    this.jobScheduler.scheduleJob(jobId, scheduledTime, async () => {
      this.eventState.currentEvents[productCode] = updateEvent;
      this.eventState.currentEvents[productCode].currentEventDetailIndex = 0;

      updateEvent.eventDetails.forEach((eventDetail, index) => {
        const event = { ...eventDetail };

        this.handleOddsAvailableForEventDetail(event, index, productCode);
        this.handleVideoInfoAvailableForEventDetail(event, index, productCode);
        this.handleResultAvailableForEventDetail(event, index, productCode);
      });

      this.eventStreamService.broadcastVideo(productCode, updateEvent, "schedule event");
    });
  }

  async handleOddsAvailableForEventDetail(eventDetail: EventDetail, index: number, productCode: string) {
    const scheduledTime = new Date(eventDetail.oddsAvailableTs);
    const jobId = this.generateJobId(productCode, eventDetail.eventID, index, "odds");

    this.jobScheduler.scheduleJob(jobId, scheduledTime, async () => {
      const updateEvent = await this.oddsFeedService.getEventDetailsWithRetry(eventDetail.eventID);

      if (!updateEvent) {
        return;
      }

      updateEvent.currentEventDetailIndex = index;
      this.eventState.currentEvents[productCode] = updateEvent;

      this.eventStreamService.broadcastVideo(productCode, updateEvent, "odds available");
    });
  }

  async handleVideoInfoAvailableForEventDetail(eventDetail: EventDetail, index: number, productCode: string) {
    const scheduledTime = new Date(eventDetail.scheduleStartTs);
    const jobId = this.generateJobId(productCode, eventDetail.eventID, index, "video");

    this.jobScheduler.scheduleJob(jobId, scheduledTime, async () => {
      const updateEvent = await this.oddsFeedService.getEventDetailsWithRetry(eventDetail.eventID);

      if (!updateEvent) {
        return;
      }

      updateEvent.currentEventDetailIndex = index;
      this.eventState.currentEvents[productCode] = updateEvent;

      this.eventStreamService.broadcastVideo(productCode, updateEvent, "video info available");
    });
  }

  async handleResultAvailableForEventDetail(eventDetail: EventDetail, index: number, productCode: string) {
    const scheduledTime = new Date(eventDetail.resultsAvailableTs);
    const jobId = this.generateJobId(productCode, eventDetail.eventID, index, "result");

    this.jobScheduler.scheduleJob(jobId, scheduledTime, async () => {
      const updateEvent = await this.oddsFeedService.getEventDetailsWithRetry(eventDetail.eventID);

      if (!updateEvent) {
        return;
      }

      this.eventState.currentEvents[productCode] = updateEvent;
      this.eventState.currentEvents[productCode].currentEventDetailIndex = Math.min(
        index + 1,
        updateEvent.eventDetails.length - 1
      );

      this.eventStreamService.broadcastVideo(
        productCode,
        { ...updateEvent, currentEventDetailIndex: index },
        "result available"
      );
    });
  }

  async getUpcomingEventIDs() {
    const upcomingEvents = await this.oddsFeedService.getScheduleWithRetry();
    return upcomingEvents.map((event) => event.eventID);
  }

  async getNextEventIDsForEachProduct() {
    const allUpComingEvents = await this.oddsFeedService.getScheduleWithRetry();

    const nextEvents = allUpComingEvents.reduce((events: Record<string, number>, event) => {
      const code = event.productCode;
      if (!events[code] || event.eventID < events[code]) {
        events[code] = event.eventID;
      }
      return events;
    }, {});

    return nextEvents;
  }

  async getCurrentEventIDsOfAllProducts(): Promise<number[]> {
    const nextEventIDs = await this.getNextEventIDsForEachProduct();

    const currentEventIDs = Object.values(nextEventIDs).map((eventID) => {
      const roundId = extractRoundId(eventID);
      return roundId > 1 ? eventID - 1 : eventID;
    });

    return currentEventIDs;
  }

  cleanup() {
    this.jobScheduler.stopAll();
  }

  private generateJobId(productCode: string, eventId: number, index: number, jobType: string) {
    return `${productCode}_${eventId}_${index}_${jobType}`;
  }
}
