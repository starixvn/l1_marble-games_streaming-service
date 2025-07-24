import { logger } from "sc-common";
import { AppContainer, EventDetail, JobName } from "../types";
import { OddsFeedService } from "./odds-feed-service";
import cron from "cron";
import { EventStreamService } from "./event-stream-service";
import { EventState } from "../stores/event-state";
import { JobScheduler } from "./job-scheduler";
import { extractRoundId } from "../helpers/id-helper";
import { appSettings } from "../app-settings";
import { idHelper } from "../helpers";

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
    const currentEventIDs = await this.getCurrentEventIDsOfAllGames();

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
    const nextEventIDs = await this.getNextEventIDsForEachGame();

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

    const gameId = idHelper.extractGameId(eventID).toString();
    let currentEventDetailIndex = 0;
    this.eventState.currentEvents[gameId] = updateEvent;

    updateEvent.eventDetails.forEach((eventDetail, index) => {
      this.handleOddsAvailableForEventDetail(eventDetail, index, gameId);
      this.handleVideoInfoAvailableForEventDetail(eventDetail, index, gameId);
      this.handleResultAvailableForEventDetail(eventDetail, index, gameId);

      if (Date.now() > new Date(eventDetail.resultsAvailableTs).getTime()) {
        currentEventDetailIndex++;
      }
    });

    this.eventState.currentEvents[gameId].currentEventDetailIndex = Math.min(
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

    const gameId = idHelper.extractGameId(eventID).toString();
    const scheduledTime = new Date(
      new Date(updateEvent.scheduleStartTs).getTime() + appSettings.scheduleDelay[gameId] || 0
    );
    const jobId = this.generateJobId(gameId, eventID, 0, JobName.ScheduleEvent);

    this.jobScheduler.scheduleJob(jobId, scheduledTime, async () => {
      this.eventState.currentEvents[gameId] = updateEvent;
      this.eventState.currentEvents[gameId].currentEventDetailIndex = 0;

      updateEvent.eventDetails.forEach((eventDetail, index) => {
        const event = { ...eventDetail };

        this.handleOddsAvailableForEventDetail(event, index, gameId);
        this.handleVideoInfoAvailableForEventDetail(event, index, gameId);
        this.handleResultAvailableForEventDetail(event, index, gameId);
      });

      this.eventStreamService.broadcastEventDataToClients(gameId, updateEvent, JobName.ScheduleEvent);
    });
  }

  async handleOddsAvailableForEventDetail(eventDetail: EventDetail, index: number, gameId: string) {
    const scheduledTime = new Date(eventDetail.oddsAvailableTs);
    const jobId = this.generateJobId(gameId, eventDetail.eventID, index, JobName.UpdateOdds);

    this.jobScheduler.scheduleJob(jobId, scheduledTime, async () => {
      const updateEvent = await this.oddsFeedService.getEventDetailsWithRetry(eventDetail.eventID);

      if (!updateEvent) {
        return;
      }

      updateEvent.currentEventDetailIndex = index;
      this.eventState.currentEvents[gameId] = updateEvent;

      this.eventStreamService.broadcastEventDataToClients(gameId, updateEvent, JobName.UpdateOdds);
    });
  }

  async handleVideoInfoAvailableForEventDetail(eventDetail: EventDetail, index: number, gameId: string) {
    const scheduledTime = new Date(eventDetail.scheduleStartTs);
    const jobId = this.generateJobId(gameId, eventDetail.eventID, index, JobName.UpdateVideoInfo);

    this.jobScheduler.scheduleJob(jobId, scheduledTime, async () => {
      const updateEvent = await this.oddsFeedService.getEventDetailsWithRetry(eventDetail.eventID);

      if (!updateEvent) {
        return;
      }

      updateEvent.currentEventDetailIndex = index;
      this.eventState.currentEvents[gameId] = updateEvent;

      this.eventStreamService.broadcastEventDataToClients(gameId, updateEvent, JobName.UpdateVideoInfo);
    });
  }

  async handleResultAvailableForEventDetail(eventDetail: EventDetail, index: number, gameId: string) {
    const scheduledTime = new Date(eventDetail.resultsAvailableTs);
    const jobId = this.generateJobId(gameId, eventDetail.eventID, index, JobName.UpdateResult);

    this.jobScheduler.scheduleJob(jobId, scheduledTime, async () => {
      const updateEvent = await this.oddsFeedService.getEventDetailsWithRetry(eventDetail.eventID);

      if (!updateEvent) {
        return;
      }

      this.eventState.currentEvents[gameId] = updateEvent;
      this.eventState.currentEvents[gameId].currentEventDetailIndex = Math.min(
        index + 1,
        updateEvent.eventDetails.length - 1
      );

      this.eventStreamService.broadcastEventDataToClients(
        gameId,
        { ...updateEvent, currentEventDetailIndex: index },
        JobName.UpdateResult
      );
    });
  }

  async getUpcomingEventIDs() {
    const upcomingEvents = await this.oddsFeedService.getScheduleWithRetry();
    return upcomingEvents.map((event) => event.eventID);
  }

  async getNextEventIDsForEachGame() {
    const allUpComingEvents = await this.oddsFeedService.getScheduleWithRetry();

    const nextEvents = allUpComingEvents.reduce((events: Record<string, number>, event) => {
      const gameId = idHelper.extractGameId(event.eventID).toString();
      if (!events[gameId] || event.eventID < events[gameId]) {
        events[gameId] = event.eventID;
      }
      return events;
    }, {});

    return nextEvents;
  }

  async getCurrentEventIDsOfAllGames(): Promise<number[]> {
    const nextEventIDs = await this.getNextEventIDsForEachGame();

    const currentEventIDs = Object.values(nextEventIDs).map((eventID) => {
      const roundId = extractRoundId(eventID);
      return roundId > 1 ? eventID - 1 : eventID;
    });

    return currentEventIDs;
  }

  cleanup() {
    this.jobScheduler.stopAll();
  }

  private generateJobId(gameId: string, eventId: number, index: number, jobName: JobName) {
    return `${gameId}_${eventId}_${index}_${jobName}`;
  }
}
