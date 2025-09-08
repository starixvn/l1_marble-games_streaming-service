import { EventDetail, EventStreamState, GoalInfoData, InGameEvent, JobName, VoiceConfig, VoiceEvent } from "../types";

type GamePhaseTracks = {
  allPhases: GamePhase[]
  currentPhaseIndex: number;
}

type GamePhase = {
  index: number;
  events: string[];
  timelines: number[];
  voices: string[];
  voiceTimelines: number[];
  result: string[];
  previousVideoLength?: number;
  currentVideoLength?: number;
}

type VoiceUpdateArgs = {
  timeline: number[];
  voice: string[];
}

type InGameEventUpdateArgs = {
  timeline: number[];
  eventName: string[];
}

export class  EventStore {
  private _currentEvents: Record<string, EventStreamState> = {};
  private readonly _currentGamePhaseByGameId: Record<string, GamePhaseTracks> = {};
 

  /**
   * Gets the current event for a specific game
   *
   * @param gameId - The game identifier
   * @returns The current event state (reference, not copy)
   * @warning Do not modify the returned object directly. Use setter methods instead.
   */
  getCurrentEventForGame(gameId: string): EventStreamState {
    return this._currentEvents[gameId];
  }

  updateResultForGame(gameId: string, result: string[], phaseIndex?: number): void {
    console.log(`update result game id ${gameId} result ${result} phase index ${phaseIndex}`);
    const currentPhaseIndex = this.updatePhaseIndexIfNeededAndGetCurrentPhaseIndex(gameId, phaseIndex);
    this._currentGamePhaseByGameId[gameId].allPhases[currentPhaseIndex].result = result;
  }

  updateVideoLengthForGame(gameId: string, videoLength: number, phaseIndex?: number): void {
    const currentPhaseIndex = this.updatePhaseIndexIfNeededAndGetCurrentPhaseIndex(gameId, phaseIndex);
    const currentVideoLength = this._currentGamePhaseByGameId[gameId].allPhases[currentPhaseIndex]?.currentVideoLength ?? 0;
    this._currentGamePhaseByGameId[gameId].allPhases[currentPhaseIndex].previousVideoLength = currentVideoLength;
    this._currentGamePhaseByGameId[gameId].allPhases[currentPhaseIndex].currentVideoLength = videoLength;
  }

  appendVoiceForGame(gameId: string, voiceUpdateArgs: VoiceUpdateArgs, phaseIndex?: number): void {
    const currentPhaseIndex = this.updatePhaseIndexIfNeededAndGetCurrentPhaseIndex(gameId, phaseIndex);
    this._currentGamePhaseByGameId[gameId].allPhases[currentPhaseIndex].voices.push(...voiceUpdateArgs.voice);
    this._currentGamePhaseByGameId[gameId].allPhases[currentPhaseIndex].voiceTimelines.push(...voiceUpdateArgs.timeline);
  }

  appendInGameEventForGame(gameId: string, inGameEventUpdateArgs: InGameEventUpdateArgs, phaseIndex?: number): void {
    const currentPhaseIndex = this.updatePhaseIndexIfNeededAndGetCurrentPhaseIndex(gameId, phaseIndex);
    this._currentGamePhaseByGameId[gameId].allPhases[currentPhaseIndex].timelines.push(...inGameEventUpdateArgs.timeline);
    this._currentGamePhaseByGameId[gameId].allPhases[currentPhaseIndex].events.push(...inGameEventUpdateArgs.eventName);
  }

  getPreviousVideoLengthForGame(gameId: string): number {
    const currentPhaseIndex = this.getCurrentPhaseIndexForGame(gameId);
    return this._currentGamePhaseByGameId[gameId].allPhases[currentPhaseIndex]?.previousVideoLength ?? 0;
  }

  getCurrentPhaseIndexForGame(gameId: string): number {
    return this._currentGamePhaseByGameId[gameId]?.currentPhaseIndex ?? 0;
  }

  getPreviousHalfResultForGame(gameId: string): string[] {
    const currentPhaseIndex = this.getCurrentPhaseIndexForGame(gameId);
    if (currentPhaseIndex === 0) {
      return []; 
    }
    const result = this._currentGamePhaseByGameId[gameId].allPhases[currentPhaseIndex - 1]?.result ?? [];
    console.log(`get previous half result game id ${gameId} result ${result} phase index ${currentPhaseIndex - 1}`);
    return result;
  }

  getVoiceAndTimelineForGame(gameId: string) {
    const currentPhaseIndex = this.getCurrentPhaseIndexForGame(gameId);
    
    return {
      voice: this._currentGamePhaseByGameId[gameId].allPhases[currentPhaseIndex].voices ?? [],
      timeline: this._currentGamePhaseByGameId[gameId].allPhases[currentPhaseIndex].voiceTimelines ?? []
    };
  }

  getInGameEventAndTimelineForGame(gameId: string) {
    const currentPhaseIndex = this.getCurrentPhaseIndexForGame(gameId);
    return {
      eventName: this._currentGamePhaseByGameId[gameId].allPhases[currentPhaseIndex].events ?? [],
      timeline: this._currentGamePhaseByGameId[gameId].allPhases[currentPhaseIndex].timelines ?? []
    };
  }

  updateEventTimelineForGame(gameId: string, eventTimeline: number[]): void {
    this._currentGamePhaseByGameId[gameId].allPhases[this._currentGamePhaseByGameId[gameId].currentPhaseIndex].timelines = eventTimeline;
  }

  getCurrentGamePhaseForGame(gameId: string): GamePhase {
    this.initializeGamePhaseForGameIfNeeded(gameId);
    return this._currentGamePhaseByGameId[gameId].allPhases[this._currentGamePhaseByGameId[gameId].currentPhaseIndex];
  }

  setCurrentEventForGame(gameId: string, currentEvent: EventStreamState): void {
    this._currentEvents[gameId] = currentEvent;
  }

  setCurrentEventPhaseForGame(gameId: string, phase: JobName): void {
    this._currentEvents[gameId].currentPhase = phase;
  }

  setCurrentEventLiveScoreForGame(gameId: string, liveScore: string, index: number): void {
    this._currentEvents[gameId].liveScores[index] = liveScore;
  }

  setCurrentEventGoalInfoForGame(gameId: string, goalInfo: GoalInfoData | null, index: number): void {
    this._currentEvents[gameId].goalInfos[index] = goalInfo;
  }

  setCurrentEventGoalInfosForGame(gameId: string, goalInfos: (GoalInfoData | null)[]): void {
    this._currentEvents[gameId].goalInfos = goalInfos;
  }

  setCurrentEventLiveScoresForGame(gameId: string, liveScores: string[]): void {
    this._currentEvents[gameId].liveScores = liveScores;
  }

  setCurrentEventDetailForGame(gameId: string, eventDetail: EventDetail, index: number): void {
    this._currentEvents[gameId].eventDetails[index] = eventDetail;
  }

  setCurrentVoiceConfigForGame(gameId: string, voiceConfig?: string): void {
    this._currentEvents[gameId].voiceConfig = voiceConfig;
  }

  setCurrentVoiceConfigDetailForGame(gameId: string, voiceConfigDetail?: VoiceConfig): void {
    this._currentEvents[gameId].voiceConfigDetail = voiceConfigDetail;
  }

  setCurrentInGameEventsForGame(gameId: string, inGameEvents: (InGameEvent | null)[]): void {
    this._currentEvents[gameId].inGameEvents = inGameEvents;
  }

  setCurrentVoiceEventForGame(gameId: string, voiceEvent: VoiceEvent): void {
    this._currentEvents[gameId].voices = voiceEvent;
  }

  setCurrentLiveVoiceForGame(gameId: string, liveVoice: string, index: number): void {
    this._currentEvents[gameId].liveVoices[index] = liveVoice;
  }

  setCurrentInGameEventForGame(gameId: string, inGameEvent: InGameEvent | null, index: number): void {
    if (!this._currentEvents[gameId].inGameEvents) {
      this._currentEvents[gameId].inGameEvents = [];
    }

    this._currentEvents[gameId].inGameEvents[index] = inGameEvent;
  }

  private updatePhaseIndexIfNeededAndGetCurrentPhaseIndex(gameId: string, phaseIndex?: number) {
    this.initializeGamePhaseForGameIfNeeded(gameId);
    const currentPhaseIndex = phaseIndex ?? this._currentGamePhaseByGameId[gameId].currentPhaseIndex;
    if (phaseIndex !== this._currentGamePhaseByGameId[gameId].currentPhaseIndex) {
      this._currentGamePhaseByGameId[gameId].currentPhaseIndex = currentPhaseIndex;
      this.initializeEmptyGamePhaseForGame(gameId, currentPhaseIndex);
    }
    return currentPhaseIndex;
  }

  private initializeGamePhaseForGameIfNeeded(gameId: string) {
    if (!this._currentGamePhaseByGameId[gameId]) {
      this._currentGamePhaseByGameId[gameId] = {
          allPhases: [],
          currentPhaseIndex: 0
        };
      this.initializeEmptyGamePhaseForGame(gameId);
    }
  }
  private initializeEmptyGamePhaseForGame(gameId: string, phaseIndex = 0) {
    this._currentGamePhaseByGameId[gameId].allPhases[phaseIndex] = {
      index: phaseIndex,
      events: [],
      timelines: [],
      voices: [],
      voiceTimelines: [],
      result: [],
      previousVideoLength: 0
    };
  }
}
