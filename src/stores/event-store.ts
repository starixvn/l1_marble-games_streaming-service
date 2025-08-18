import { EventDetail, EventStreamState, GoalInfoData, JobName } from "../types";

export class EventStore {
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
}
