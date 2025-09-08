import { AppContainer, Event, JobName, EventStreamState, GoalInfoData, InGameEvent, VoiceConfig } from "../types";
import { EventStore } from "./event-store";
import { idHelper } from "../helpers";
import { OddsFeedService } from "../services/odds-feed-service";
import { appSettings } from "../app-settings";

const DEFAULT_VIDEO_LENGTH = 30;

export class EventManager {
  private readonly eventStore: EventStore;
  private readonly oddsFeedService: OddsFeedService;

  constructor(container: AppContainer) {
    this.eventStore = container.eventStore;
    this.oddsFeedService = container.oddsFeedService;
  }

  async initializeCurrentEvent(event: Event): Promise<void> {
    const gameId = idHelper.extractGameId(event.eventID);
    const liveScores = event.eventDetails.map(() => "0:0");
    const goalInfos = event.eventDetails.map(() => null);
    const voiceConfig = event.voiceConfig;
    const voiceConfigDetail = voiceConfig 
      ? await this.oddsFeedService.getVoiceConfig(voiceConfig) ?? undefined 
      : undefined;
    
    this.eventStore.setCurrentEventForGame(gameId, {
      ...event,
      currentEventDetailIndex: 0,
      liveScores: liveScores,
      goalInfos: goalInfos,
      currentPhase: JobName.ScheduleEvent,
      liveVoices: [],
      voiceConfig,
      voiceConfigDetail
    });
  }

  async initializePhaseForCurrentEvent(eventID: number) {
    const gameId = idHelper.extractGameId(eventID);
    const currentEvent = this.eventStore.getCurrentEventForGame(gameId);
    const now = Date.now();

    currentEvent.eventDetails.forEach((eventDetail, index) => {
      if (now > new Date(eventDetail.oddsAvailableTs).getTime() && index > 0) {
        this.eventStore.setCurrentEventPhaseForGame(gameId, JobName.UpdateOdds);
      }

      if (now > new Date(eventDetail.scheduleStartTs).getTime()) {
        this.eventStore.setCurrentEventPhaseForGame(gameId, JobName.UpdateVideoInfo);
      }

      if (now > new Date(eventDetail.resultsAvailableTs).getTime()) {
        this.eventStore.setCurrentEventPhaseForGame(gameId, JobName.UpdateResult);
        this.incrementCurrentEventDetailIndex(gameId);
      }
    });
  }

  initializeGoalInfoForCurrentEvent(gameId: string, goalInfos: (GoalInfoData | null)[]) {
    this.eventStore.setCurrentEventGoalInfosForGame(gameId, goalInfos);
  }

  initializeGamePhaseWithResult(gameId: string, result: string[], phaseIndex?: number) {
    this.eventStore.updateResultForGame(gameId, result, phaseIndex);
  }

  initializeGamePhaseWithGoalInfo(gameId: string, goalInfo: GoalInfoData | null, phaseIndex?: number) {
    const videoLength = goalInfo?.length ?? appSettings.videoLength[gameId] ?? DEFAULT_VIDEO_LENGTH;
    this.eventStore.updateVideoLengthForGame(gameId, videoLength, phaseIndex);
    this.eventStore.updateResultForGame(gameId, goalInfo?.result ?? [], phaseIndex);
  }

  appendInGameEventForGame(gameId: string, inGameEvent: InGameEvent, phaseIndex?: number) {
      const previousVideoLength = this.eventStore.getPreviousVideoLengthForGame(gameId);
      const timelines = inGameEvent.timeLine.map((time) => time + previousVideoLength);
      const eventNames = inGameEvent.eventName;
      this.eventStore.appendInGameEventForGame(gameId, { timeline: timelines, eventName: eventNames }, phaseIndex);
  }

  appendVoiceForGame(gameId: string, voice: string[], timeline: number[], phaseIndex?: number) {
    const previousVideoLength = this.eventStore.getPreviousVideoLengthForGame(gameId);
    const timelines = timeline.map((time) => time + previousVideoLength);
    this.eventStore.appendVoiceForGame(gameId, { voice, timeline: timelines }, phaseIndex);
  }
  
  initializeInGameEventForCurrentEvent(gameId: string, inGameEvents: (InGameEvent | null)[]) {
    this.eventStore.setCurrentInGameEventsForGame(gameId, inGameEvents);
  }

  initializeVoiceConfigForCurrentEvent(gameId: string, voiceConfig?: string) {
    this.eventStore.setCurrentVoiceConfigForGame(gameId, voiceConfig);
  }

  initializeVoiceConfigDetailForCurrentEvent(gameId: string, voiceConfigDetail?: VoiceConfig) {
    this.eventStore.setCurrentVoiceConfigDetailForGame(gameId, voiceConfigDetail);
  }

  initializeLiveScoresForCurrentEvent(gameId: string) {
    const currentEvent = this.eventStore.getCurrentEventForGame(gameId);
    const now = Date.now();
    const liveScores = currentEvent.eventDetails.map((eventDetail) => {
      if (now > new Date(eventDetail.resultsAvailableTs).getTime()) {
        return eventDetail.result;
      }

      return "0:0";
    });

    this.eventStore.setCurrentEventLiveScoresForGame(gameId, liveScores);
  }

  async updateCurrentEventDetail(updateEvent: Event, phase: JobName, eventDetailIndex: number): Promise<void> {
    const gameId = idHelper.extractGameId(updateEvent.eventID);
    const updatedEventDetail = updateEvent.eventDetails[eventDetailIndex];

    this.eventStore.setCurrentEventDetailForGame(gameId, updatedEventDetail, eventDetailIndex);

    this.eventStore.setCurrentEventPhaseForGame(gameId, phase);
  }

  incrementCurrentEventDetailIndex(gameId: string): void {
    const currentEvent = this.eventStore.getCurrentEventForGame(gameId);

    currentEvent.currentEventDetailIndex = Math.min(
      currentEvent.currentEventDetailIndex + 1,
      currentEvent.eventDetails.length - 1
    );
  }

  updateLiveScore(gameId: string, goalResults: string[], goalIndex: number, eventDetailIndex: number) {
    const { homeScore, awayScore } = goalResults.slice(0, goalIndex + 1).reduce(
      (acc, result) => {
        if (result === "H") {
          acc.homeScore++;
        } else if (result === "A") {
          acc.awayScore++;
        }

        return acc;
      },
      { homeScore: 0, awayScore: 0 }
    );

    const liveScore = `${homeScore}:${awayScore}`;

    this.eventStore.setCurrentEventLiveScoreForGame(gameId, liveScore, eventDetailIndex);
  }

  updateGoalInfo(gameId: string, goalInfo: GoalInfoData | null, eventDetailIndex: number) {
    this.eventStore.setCurrentEventGoalInfoForGame(gameId, goalInfo, eventDetailIndex);
  }

  updateInGameEventInfo(gameId: string, inGameEvent: InGameEvent | null, eventDetailIndex: number) {
    this.eventStore.setCurrentInGameEventForGame(gameId, inGameEvent, eventDetailIndex);
  }

  getVoiceForGame(gameId: string) {
    return this.eventStore.getVoiceAndTimelineForGame(gameId);
  }

  getInGameEventForGame(gameId: string) {
    return this.eventStore.getInGameEventAndTimelineForGame(gameId);
  }

  getPreviousResultForGame(gameId: string): string[] {
    return this.eventStore.getPreviousHalfResultForGame(gameId);
  }

  getCurrentEventForGame(gameId: string): EventStreamState {
    return this.eventStore.getCurrentEventForGame(gameId);
  }
}
