import { EventStreamState, JobName } from "../types";

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
}
