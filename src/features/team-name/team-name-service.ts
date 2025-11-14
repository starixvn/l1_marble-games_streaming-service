import { idHelper } from "../../helpers";
import { GameBroadcastService } from "../../services/game-broadcast.service";
import { DelayHandlingService } from "../delay/delay-handling-service";
import { FeatureDebugService } from "../feature-debug/feature-debug-service";
import { EventNotification, OddsFeedEventName, OddsFeedEventSource, Scheduler, Event } from "odds-feed-client";
import { Replay, ReplayService } from "../event-replay/event-replay-service";

export interface TeamNameState {
  homeTeamName: string;
  awayTeamName: string;
}

export type TeamNameServiceContainer = {
  oddsFeedEventSource: OddsFeedEventSource;
  scheduler: Scheduler;
  gameBroadcastService: GameBroadcastService;
  delayHandlingService: DelayHandlingService;
  featureDebugService: FeatureDebugService;
};

export class TeamNameService implements ReplayService<TeamNameState> {
  private readonly oddsFeedEventSource: OddsFeedEventSource;
  private readonly scheduler: Scheduler;
  private readonly gameBroadcastService: GameBroadcastService;
  private readonly delayHandlingService: DelayHandlingService;
  private readonly featureDebugService: FeatureDebugService;

  private readonly teamNameByGameId: Record<string, TeamNameState> = {};

  private readonly boundHandleEventStart: (notification: EventNotification) => void;

  constructor(container: TeamNameServiceContainer) {
    this.oddsFeedEventSource = container.oddsFeedEventSource;
    this.scheduler = container.scheduler;
    this.gameBroadcastService = container.gameBroadcastService;
    this.delayHandlingService = container.delayHandlingService;
    this.featureDebugService = container.featureDebugService;

    this.boundHandleEventStart = this.handleEventStart.bind(this);
  }

  public readonly eventName = "teamName";

  public getCurrentByGameId(gameId: string): TeamNameState {
    return this.teamNameByGameId[gameId];
  }

  public initEvent() {
    this.oddsFeedEventSource.eventOn(OddsFeedEventName.EventStart, this.boundHandleEventStart);
  }

  public dispose() {
    this.oddsFeedEventSource.eventOff(OddsFeedEventName.EventStart, this.boundHandleEventStart);
  }

  getReplayByEvent(event: Event): Replay<TeamNameState>[] {
    const timeToUpdate = this.delayHandlingService.getDelayedTime(
      { event, time: new Date(event.scheduleStartTs) },
      {
        oddsFeedEventType: OddsFeedEventName.EventStart,
      }
    );
    return [
      {
        time: timeToUpdate,
        payload: {
          homeTeamName: event.eventNameAKey,
          awayTeamName: event.eventNameBKey,
        },
        eventName: this.eventName,
      },
    ];
  }

  public handleEventStart({ event }: EventNotification) {
    const timeToUpdate = this.delayHandlingService.getDelayedTime(
      { event, time: new Date(event.scheduleStartTs) },
      {
        oddsFeedEventType: OddsFeedEventName.EventStart,
      }
    );
    this.scheduler.schedule(timeToUpdate, this.handleTeamNameUpdate.bind(this, { event }), {
      overrideNow: event.now,
      keyOverride: `updateTeamName-${event.eventID}`,
    });
  }

  public handleTeamNameUpdate({ event }: EventNotification) {
    const gameId = idHelper.extractGameId(event.eventID);
    this.teamNameByGameId[gameId] = {
      homeTeamName: event.eventNameAKey,
      awayTeamName: event.eventNameBKey,
    };
    this.broadcastTeamName({ gameId });
  }

  private broadcastTeamName({ gameId }: { gameId: string }) {
    this.log(`broadcast team name ${JSON.stringify(this.getCurrentByGameId(gameId))}`, gameId);

    this.gameBroadcastService.broadcastToAllClientByGameId(gameId, this.getCurrentByGameId(gameId), this.eventName);
  }

  private log(message: string, gameId: string) {
    this.featureDebugService.log(this, message, gameId);
  }
}
