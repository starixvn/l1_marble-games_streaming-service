import { AppContainer, Event, JobName, EventStreamState } from "../types";
import { EventStore } from "./event-store";
import { idHelper } from "../helpers";

export class EventManager {
  private readonly eventStore: EventStore;

  constructor(container: AppContainer) {
    this.eventStore = container.eventStore;
  }

  async initializeCurrentEvent(event: Event): Promise<void> {
    const gameId = idHelper.extractGameId(event.eventID);

    this.eventStore.setCurrentEventForGame(gameId, {
      ...event,
      currentEventDetailIndex: 0,
      liveScore: "0:0",
      currentPhase: JobName.ScheduleEvent,
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

  async updateCurrentEventDetail(updateEvent: Event, phase: JobName, eventDetailIndex: number): Promise<void> {
    const gameId = idHelper.extractGameId(updateEvent.eventID);

    const currentEvent = this.eventStore.getCurrentEventForGame(gameId);

    currentEvent.eventDetails[eventDetailIndex] = updateEvent.eventDetails[eventDetailIndex];

    currentEvent.currentPhase = phase;
  }

  incrementCurrentEventDetailIndex(gameId: string): void {
    const currentEvent = this.eventStore.getCurrentEventForGame(gameId);

    currentEvent.currentEventDetailIndex = Math.min(
      currentEvent.currentEventDetailIndex + 1,
      currentEvent.eventDetails.length - 1
    );
  }
}
