import { EventDetail, EventStreamState, GoalInfoData, InGameEvent, JobName, VoiceConfig, VoiceEvent } from "../types";

export class  EventStore {
  private _currentEvents: Record<string, EventStreamState> = {};

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
}
