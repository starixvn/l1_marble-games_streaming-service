import { logger } from "sc-common";
import { AppContainer, EventDetail, EventValidator, JobName, Event, GoalInfoData, InGameEvent } from "../types";
import { JobScheduler } from "./job-scheduler";
import { OddsFeedService } from "./odds-feed-service";
import { appSettings } from "../app-settings";
import { EventStreamService } from "./event-stream-service";
import { idHelper } from "../helpers";
import { EventManager } from "../stores/event-manager";
import { generateVoiceWithEventTimeline } from "../helpers/voices";

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
      this.logService.logError(`Schedule event ${eventID} failed, event not found`);
      return;
    }

    const gameId = idHelper.extractGameId(eventID);
    const scheduledTime = new Date(
      new Date(updateEvent.scheduleStartTs).getTime() + (appSettings.scheduleDelay[gameId] || 0)
    );
    const jobId = this.generateJobId(gameId, eventID, 0, JobName.ScheduleEvent);

    this.jobScheduler.scheduleJob(jobId, scheduledTime, async () => {
      await this.eventManager.initializeCurrentEvent(updateEvent);
      this.eventManager.updateIntroTimeForCurrentEvent(gameId, scheduledTime);
      this.scheduleEventDetails(updateEvent);
      this.eventStreamService.broadcastUpdateEventDataToClients(gameId, JobName.ScheduleEvent, 0);
    });
  }

  scheduleEventDetails(event: Event) {
    const gameId = idHelper.extractGameId(event.eventID);
    const phaseChangeIndex = event.eventDetails.length > 0 && event.eventDetails[0].phase !== undefined
      ? undefined 
      : this.getPhaseChangeIndex(event.eventDetails);

    event.eventDetails.forEach((eventDetail, index) => {
      this.schedulePlayIntroBetweenPhases(eventDetail, gameId, index, phaseChangeIndex);
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

      this.eventStreamService.broadcastUpdateEventDataToClients(gameId, JobName.UpdateOdds, index);
    });
  }

  async scheduleUpdateVideoInfo(eventDetail: EventDetail, index: number, gameId: string) {
    const scheduledTime = new Date(eventDetail.scheduleStartTs);

    const jobId = this.generateJobId(gameId, eventDetail.eventID, index, JobName.UpdatePreloadVideoInfo);

    this.jobScheduler.scheduleJob(jobId, scheduledTime, async () => {
      await this.updateCurrentEventDetail(eventDetail.eventID, JobName.UpdatePreloadVideoInfo, index);

      this.eventStreamService.broadcastUpdateEventDataToClients(gameId, JobName.UpdatePreloadVideoInfo, index);
      await this.scheduleBroadcastVideoInfo(eventDetail, index, gameId);
      await this.scheduleUpdateGoalInfo(gameId, index);
      await this.scheduleUpdateVoice(gameId, index);
    });
  }

  async scheduleBroadcastVideoInfo(eventDetail: EventDetail, index: number, gameId: string) {
    const scheduledTime = new Date(eventDetail.scheduleStartTs);
    const scheduledDelay = new Date(scheduledTime.getTime() + (appSettings.videoDelay[gameId] || 0));
    const jobId = this.generateJobId(gameId, eventDetail.eventID, index, JobName.UpdateVideoInfo);

    this.jobScheduler.scheduleJob(
      jobId,
      scheduledDelay,
      async () => {
        const currentEvent = this.eventManager.getCurrentEventForGame(gameId);
        this.eventManager.updateCurrentEventDetail(currentEvent, JobName.UpdateVideoInfo, index);
        this.eventStreamService.broadcastUpdateEventDataToClients(gameId, JobName.UpdateVideoInfo, index);
      },
      true
    );
  }

  async scheduleUpdateGoalInfo(gameId: string, index: number, givenGoalInfo: GoalInfoData | null = null) {
    const currentEvent = this.eventManager.getCurrentEventForGame(gameId);
    const eventDetail = currentEvent.eventDetails[index];
    const goalInfo = givenGoalInfo ?? (await this.oddsFeedService.getGoalInfo(eventDetail.goalInfo));

    if (!goalInfo) {
      this.logService.logError(`Failed to get goal info for event ${eventDetail.eventID} index: ${index}`);
      return;
    }

    this.eventManager.updateGoalInfo(gameId, goalInfo, index);
    
    this.eventManager.initializeGamePhaseWithGoalInfo(gameId, goalInfo, eventDetail.phase ?? index);
    console.log("update goal info and result", goalInfo.result, " phase index ", eventDetail.phase ?? index);

    goalInfo.timeLine.forEach((time, goalIndex) => {
      const goalTime = time * 1000 + (appSettings.videoDelay[gameId] || 0);
      const scheduledTime = new Date(new Date(eventDetail.scheduleStartTs).getTime() + goalTime);
      const jobId = this.generateJobId(gameId, eventDetail.eventID, index, `${JobName.UpdateGoalInfo}_${goalIndex}`);

      this.jobScheduler.scheduleJob(
        jobId,
        scheduledTime,
        async () => {
          this.eventManager.updateLiveScore(gameId, goalInfo.result, goalIndex, index);
          this.eventStreamService.broadcastUpdateEventDataToClients(gameId, JobName.UpdateGoalInfo, index);
        },
        true
      );
    });
   
  }

  async scheduleUpdateVoice(
    gameId: string,
    index: number,
    givenInGameEvent: InGameEvent | null = null
  ) {
    const currentEvent = this.eventManager.getCurrentEventForGame(gameId);
    const eventDetail = currentEvent.eventDetails[index];
    const inGameEvent = givenInGameEvent ?? (await this.oddsFeedService.getInGameEvent(eventDetail.inGameEventInfo));
    
    if (!inGameEvent) {
      this.logService.logError(`Failed to get in-game event for event ${eventDetail.eventID} index: ${index}`);
      return;
    }

    this.eventManager.updateInGameEventInfo(gameId, inGameEvent, index);

    const previousVoice = this.eventManager.getVoiceForGame(gameId);
    const previousInGameEvent = this.eventManager.getInGameEventForGame(gameId);
    const firstHalfResult = this.eventManager.getPreviousResultForGame(gameId).join("");
    const timeline = inGameEvent?.timeLine ?? [];
    const eventName = inGameEvent?.eventName ?? [];

    const voices = generateVoiceWithEventTimeline({
      timeline,
      eventName,
      previousVoices: previousVoice.voice,
      previousTimelines: previousVoice.timeline,
      previousEvents: previousInGameEvent.eventName,
      previousVoiceTimelines: previousInGameEvent.timeline,
      firstHalfScore: firstHalfResult,
    });

    this.eventManager.appendInGameEventForGame(gameId, inGameEvent, eventDetail.phase ?? index);
    this.eventManager.appendVoiceForGame(gameId, voices.voice, voices.timeline, eventDetail.phase ?? index);

    voices.timeline.forEach((time, voiceIndex) => {
      const voiceTime = time * 1000 + (appSettings.videoDelay[gameId] || 0);
      const scheduledTime = new Date(new Date(eventDetail.scheduleStartTs).getTime() + voiceTime);
      const jobId = this.generateJobId(gameId, eventDetail.eventID, index, `${JobName.UpdateVoice}_${voiceIndex}`);
      this.jobScheduler.scheduleJob(
        jobId,
        scheduledTime,
        async () => {
          this.eventStreamService.broadcastUpdateEventDataToClients(gameId, JobName.UpdateVoice, index, { voice: voices.voice[voiceIndex] });
        },
        true
      )
    })
  }

  async scheduleUpdateResult(eventDetail: EventDetail, index: number, gameId: string) {
    const scheduledTime = new Date(eventDetail.resultsAvailableTs);
    const jobId = this.generateJobId(gameId, eventDetail.eventID, index, JobName.UpdateResult);

    this.jobScheduler.scheduleJob(jobId, scheduledTime, async () => {
      await this.updateCurrentEventDetail(eventDetail.eventID, JobName.UpdateResult, index);

      this.eventManager.incrementCurrentEventDetailIndex(gameId);

      this.eventStreamService.broadcastUpdateEventDataToClients(gameId, JobName.UpdateResult, index);
    });
  }

  async schedulePlayIntroBetweenPhases(eventDetail: EventDetail, gameId: string, index: number, phaseChangeIndex: Record<number, number> = {
    0: 0,
    1: 1
  }) {
    const introDuration = appSettings?.introDuration?.[gameId] ?? 0;
    if (!introDuration || introDuration <= 0 || index === 0) {
      return;
    }

    const phase = eventDetail.phase ?? index;
    const phaseIndex = phaseChangeIndex[phase] ?? index;
    if (index !== phaseIndex) {
      return;
    }

    const jobId = this.generateJobId(gameId, eventDetail.eventID, index, JobName.PlayIntro);

    // intro play before live streaming
    const scheduledTime = new Date(new Date(eventDetail.scheduleStartTs).getTime() - introDuration);

    this.jobScheduler.scheduleJob(jobId, scheduledTime, async () => {
      this.eventManager.updateIntroTimeForCurrentEvent(gameId, scheduledTime);
      console.log("play intro between phases", scheduledTime);
      await this.updateCurrentEventDetail(eventDetail.eventID, JobName.PlayIntro, index);
      this.eventStreamService.broadcastUpdateEventDataToClients(gameId, JobName.PlayIntro, index);
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

  generateJobId(gameId: string, eventId: number, index: number, jobName: string) {
    return `${gameId}_${eventId}_${index}_${jobName}`;
  }

  getValidatorForPhase(phase: JobName, eventDetailIndex: number): EventValidator {
    switch (phase) {
      case JobName.UpdateVideoInfo:
        return (data) => data?.eventDetails?.[eventDetailIndex]?.playlist !== "";
      case JobName.UpdateResult:
        return (data) => data?.eventDetails?.[eventDetailIndex]?.hasResults;
      default:
        return () => true;
    }
  }


  private getPhaseChangeIndex(eventDetails: EventDetail[]) {
    return eventDetails.reduce((acc, eventDetail, index) => {
      if (index === 0) {
        return acc;
      }
      if (eventDetail.phase !== eventDetails[index - 1].phase) {
        return {
          ...acc,
          [eventDetail.phase ?? index]: index
        };
      }
      return acc;
    }, {
      0:0
    });
  }
}
