import { AppContainer, Event, JobName, EventStreamState } from "../types";
import { EventState } from "../stores/event-state";
import { idHelper } from "../helpers";

export class EventStateManager {
  private readonly eventState: EventState;

  constructor(container: AppContainer) {
    this.eventState = container.eventState;
  }

  async initializeCurrentEvent(event: Event): Promise<void> {
    const gameId = idHelper.extractGameId(event.eventID);

    this.eventState.currentEvents[gameId] = {
      ...event,
      currentEventDetailIndex: 0,
      liveScore: "0:0",
      currentPhase: JobName.ScheduleEvent,
    };
  }

  async initializePhaseForCurrentEvent(eventID: number) {
    const gameId = idHelper.extractGameId(eventID);
    const currentEvent = this.eventState.currentEvents[gameId];
    const now = Date.now();

    currentEvent.eventDetails.forEach((eventDetail, index) => {
      if (now > new Date(eventDetail.oddsAvailableTs).getTime() && index > 0) {
        this.eventState.currentEvents[gameId].currentPhase = JobName.UpdateOdds;
      }

      if (now > new Date(eventDetail.scheduleStartTs).getTime()) {
        this.eventState.currentEvents[gameId].currentPhase = JobName.UpdateVideoInfo;
      }

      if (now > new Date(eventDetail.resultsAvailableTs).getTime()) {
        this.eventState.currentEvents[gameId].currentPhase = JobName.UpdateResult;
        this.incrementCurrentEventDetailIndex(gameId);
      }
    });
  }

  async updateCurrentEventDetail(updateEvent: Event, phase: JobName, eventDetailIndex: number): Promise<void> {
    const gameId = idHelper.extractGameId(updateEvent.eventID);

    const currentEvent = this.eventState.currentEvents[gameId];

    currentEvent.eventDetails[eventDetailIndex] = updateEvent.eventDetails[eventDetailIndex];

    currentEvent.currentPhase = phase;
  }

  incrementCurrentEventDetailIndex(gameId: string): void {
    const currentEvent = this.eventState.currentEvents[gameId];

    currentEvent.currentEventDetailIndex = Math.min(
      currentEvent.currentEventDetailIndex + 1,
      currentEvent.eventDetails.length - 1
    );
  }

  getCurrentEvent(gameId: string): EventStreamState {
    return this.eventState.currentEvents[gameId];
  }

  getAllCurrentEvents(): Record<string, Event> {
    return this.eventState.currentEvents;
  }
}
