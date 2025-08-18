import { AppContainer, Event, JobName, EventStreamState, GoalInfoData } from "../types";
import { EventStore } from "./event-store";
import { idHelper } from "../helpers";

export class EventManager {
  private readonly eventStore: EventStore;

  constructor(container: AppContainer) {
    this.eventStore = container.eventStore;
  }

  async initializeCurrentEvent(event: Event): Promise<void> {
    const gameId = idHelper.extractGameId(event.eventID);
    const liveScores = event.eventDetails.map(() => "0:0");
    const goalInfos = event.eventDetails.map(() => null);

    this.eventStore.setCurrentEventForGame(gameId, {
      ...event,
      currentEventDetailIndex: 0,
      liveScores: liveScores,
      goalInfos: goalInfos,
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

  initializeGoalInfoForCurrentEvent(gameId: string, goalInfos: (GoalInfoData | null)[]) {
    this.eventStore.setCurrentEventGoalInfosForGame(gameId, goalInfos);
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

  getCurrentEventForGame(gameId: string): EventStreamState {
    return this.eventStore.getCurrentEventForGame(gameId);
  }
}
