import { logger } from "sc-common";
import { AppContainer, EventDetail, EventValidator, JobName, Event } from "../types";
import { JobScheduler } from "./job-scheduler";
import { OddsFeedService } from "./odds-feed-service";
import { appSettings } from "../app-settings";
import { EventStreamService } from "./event-stream-service";
import { idHelper } from "../helpers";
import { EventManager } from "../stores/event-manager";

export class EventSchedulerService {
  private readonly jobScheduler: JobScheduler;
  private readonly oddsFeedService: OddsFeedService;
  private readonly eventStreamService: EventStreamService;
  private readonly eventManager: EventManager;
  private readonly logService: typeof logger;

  constructor(container: AppContainer) {
    this.jobScheduler = container.jobScheduler;
    this.oddsFeedService = container.oddsFeedService;
    this.eventStreamService = container.eventStreamService;
    this.eventManager = container.eventManager;
    this.logService = container.logService;
  }

  scheduleEvents(eventIDs: number[]) {
    eventIDs.forEach((eventID) => {
      this.scheduleEvent(eventID);
    });
  }

  async scheduleEvent(eventID: number) {
    const updateEvent = await this.oddsFeedService.getEventDetailsWithRetry(eventID);

    if (!updateEvent) {
      this.logService.logError(`Event ${eventID} not found`);
      console.error(`Event ${eventID} not found`);
      return;
    }

    const gameId = idHelper.extractGameId(eventID);
    const scheduledTime = new Date(
      new Date(updateEvent.scheduleStartTs).getTime() + appSettings.scheduleDelay[gameId] || 0
    );
    const jobId = this.generateJobId(gameId, eventID, 0, JobName.ScheduleEvent);

    this.jobScheduler.scheduleJob(jobId, scheduledTime, async () => {
      this.eventManager.initializeCurrentEvent(updateEvent);

      this.scheduleEventDetails(updateEvent);

      this.eventStreamService.broadcastEventDataToClients(gameId, JobName.ScheduleEvent, 0);
    });
  }

  scheduleEventDetails(event: Event) {
    const gameId = idHelper.extractGameId(event.eventID);

    event.eventDetails.forEach((eventDetail, index) => {
      this.scheduleUpdateOdds(eventDetail, index, gameId);
      this.scheduleUpdateVideoInfo(eventDetail, index, gameId);
      this.scheduleUpdateResult(eventDetail, index, gameId);
    });
  }

  async scheduleUpdateOdds(eventDetail: EventDetail, index: number, gameId: string) {
    const scheduledTime = new Date(eventDetail.oddsAvailableTs);
    const jobId = this.generateJobId(gameId, eventDetail.eventID, index, JobName.UpdateOdds);

    this.jobScheduler.scheduleJob(jobId, scheduledTime, async () => {
      await this.updateCurrentEventDetail(eventDetail.eventID, JobName.UpdateOdds, index);

      this.eventStreamService.broadcastEventDataToClients(gameId, JobName.UpdateOdds, index);
    });
  }

  async scheduleUpdateVideoInfo(eventDetail: EventDetail, index: number, gameId: string) {
    const scheduledTime = new Date(eventDetail.scheduleStartTs);
    const jobId = this.generateJobId(gameId, eventDetail.eventID, index, JobName.UpdateVideoInfo);

    this.jobScheduler.scheduleJob(jobId, scheduledTime, async () => {
      await this.updateCurrentEventDetail(eventDetail.eventID, JobName.UpdateVideoInfo, index);

      this.eventStreamService.broadcastEventDataToClients(gameId, JobName.UpdateVideoInfo, index);
    });
  }

  async scheduleUpdateResult(eventDetail: EventDetail, index: number, gameId: string) {
    const scheduledTime = new Date(eventDetail.resultsAvailableTs);
    const jobId = this.generateJobId(gameId, eventDetail.eventID, index, JobName.UpdateResult);

    this.jobScheduler.scheduleJob(jobId, scheduledTime, async () => {
      await this.updateCurrentEventDetail(eventDetail.eventID, JobName.UpdateResult, index);

      this.eventStreamService.broadcastEventDataToClients(gameId, JobName.UpdateResult, index);

      this.eventManager.incrementCurrentEventDetailIndex(gameId);
    });
  }

  async updateCurrentEventDetail(eventID: number, phase: JobName, eventDetailIndex: number) {
    const validator = this.getValidatorForPhase(phase, eventDetailIndex);
    const updateEvent = await this.oddsFeedService.getEventDetailsWithRetry(eventID, validator);

    if (!updateEvent) {
      this.logService.logError(`Failed to update event ${eventID} for phase ${phase}`);
      return;
    }

    this.eventManager.updateCurrentEventDetail(updateEvent, phase, eventDetailIndex);
  }

  generateJobId(gameId: string, eventId: number, index: number, jobName: JobName) {
    return `${gameId}_${eventId}_${index}_${jobName}`;
  }

  getValidatorForPhase(phase: JobName, eventDetailIndex: number): EventValidator {
    switch (phase) {
      case JobName.UpdateOdds:
        return (data) => data?.eventDetails?.[eventDetailIndex]?.markets?.length > 0;
      case JobName.UpdateVideoInfo:
        return (data) => data?.eventDetails?.[eventDetailIndex]?.playlist !== "";
      case JobName.UpdateResult:
        return (data) => data?.eventDetails?.[eventDetailIndex]?.hasResults;
      default:
        return () => true;
    }
  }
}
