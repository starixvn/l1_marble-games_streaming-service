import { idHelper } from "../../helpers";
import { DelayHandlingService } from "../delay/delay-handling-service";
import {
  OddsFeedEventName,
  OddsFeedEventSource,
  EventNotification,
  EventDetailNotification,
  Scheduler,
  Event,
} from "odds-feed-client";
import { isLastEventDetail, isPhaseSwitching } from "../../helpers/phase-helper";
import { GameBroadcastService } from "../../services/game-broadcast.service";
import { FeatureDebugService } from "../feature-debug/feature-debug-service";
import { GameFlowTimeTrackingService } from "../game-flow-time-tracking-service/game-flow-time-tracking-service";
import { Replay, ReplayService } from "../event-replay/event-replay-service";

export enum GameFlow {
  Prebet = "Prebet",
  Streaming = "Streaming",
  EventDetailChange = "EventDetailChange",
  PhaseChange = "PhaseChange",
  Result = "Result",
}

interface GameFlowServiceContainer {
  oddsFeedEventSource: OddsFeedEventSource;
  scheduler: Scheduler;
  delayHandlingService: DelayHandlingService;
  gameBroadcastService: GameBroadcastService;
  featureDebugService: FeatureDebugService;
  gameFlowTimeTrackingService: GameFlowTimeTrackingService;
}

type GameFlowPayload = {
  state: GameFlow;
  durationMs?: number;
};

export class GameFlowService implements ReplayService<GameFlowPayload> {
  private readonly oddsFeedEventSource: OddsFeedEventSource;
  private readonly scheduler: Scheduler;
  private readonly delayHandlingService: DelayHandlingService;
  private readonly gameBroadcastService: GameBroadcastService;
  private readonly featureDebugService: FeatureDebugService;
  private readonly gameFlowTimeTrackingService: GameFlowTimeTrackingService;

  private _gameFlowByGameId: Record<string, GameFlow> = {};

  private readonly boundHandleEventStart: (notification: EventNotification) => void;
  private readonly boundHandleResultAvailable: (notification: EventDetailNotification) => void;
  private readonly boundHandleEventDetailScheduleStart: (notification: EventDetailNotification) => void;

  constructor(container: GameFlowServiceContainer) {
    this.oddsFeedEventSource = container.oddsFeedEventSource;
    this.scheduler = container.scheduler;
    this.delayHandlingService = container.delayHandlingService;
    this.gameBroadcastService = container.gameBroadcastService;
    this.featureDebugService = container.featureDebugService;
    this.gameFlowTimeTrackingService = container.gameFlowTimeTrackingService;

    this.boundHandleEventStart = this.handleEventStart.bind(this);
    this.boundHandleResultAvailable = this.handleResultAvailable.bind(this);
    this.boundHandleEventDetailScheduleStart = this.handleEventDetailScheduleStart.bind(this);
  }
  getReplayByEvent(event: Event): Replay<GameFlowPayload>[] {
    const eventStartReplay = {
      time: this.delayHandlingService.getTimeToStartEvent(event),
      payload: {
        state: GameFlow.Prebet,
      },
      eventName: this.eventName,
    };

    const eventDetailScheduleStartReplay = event.eventDetails.map((_, index) => {
      return {
        time: this.delayHandlingService.getTimeToStream(event, index),
        payload: {
          state: GameFlow.Streaming,
        },
        eventName: this.eventName,
      };
    });
    const eventDetailResultAvailableReplay = event.eventDetails.map((_, index) => {
      const whenToSwitch = this.delayedEventDetailResultAvailable({ event, index });
      if (isLastEventDetail({ event, index })) {
        const resultAvailableTs = event.eventDetails[index].resultsAvailableTs;
        const resultDurationMs =
          new Date((event as any)?.scheduleEndTs ?? resultAvailableTs).getTime() -
          new Date(resultAvailableTs).getTime();
        return {
          time: whenToSwitch,
          payload: {
            state: GameFlow.Result,
            durationMs: resultDurationMs,
          },
          eventName: this.eventName,
        };
      }
      if (isPhaseSwitching({ event, index })) {
        return {
          time: whenToSwitch,
          payload: {
            state: GameFlow.PhaseChange,
          },
          eventName: this.eventName,
        };
      }
      return null;
    });

    return [
      eventStartReplay,
      ...eventDetailScheduleStartReplay.filter((replay) => replay !== null),
      ...eventDetailResultAvailableReplay.filter((replay) => replay !== null),
    ];
  }

  public readonly eventName = "gameFlow";

  public initEvent() {
    this.oddsFeedEventSource.eventOn(OddsFeedEventName.EventStart, this.boundHandleEventStart);
    this.oddsFeedEventSource.eventDetailOn(
      OddsFeedEventName.EventDetailResultsAvailable,
      this.boundHandleResultAvailable
    );
    this.oddsFeedEventSource.eventDetailOn(
      OddsFeedEventName.EventDetailStart,
      this.boundHandleEventDetailScheduleStart
    );
  }

  public getCurrentGameFlow(gameId: string) {
    return this._gameFlowByGameId[gameId];
  }

  public dispose() {
    this.oddsFeedEventSource.eventOff(OddsFeedEventName.EventStart, this.boundHandleEventStart);
    this.oddsFeedEventSource.eventDetailOff(
      OddsFeedEventName.EventDetailResultsAvailable,
      this.boundHandleResultAvailable
    );
    this.oddsFeedEventSource.eventDetailOff(
      OddsFeedEventName.EventDetailStart,
      this.boundHandleEventDetailScheduleStart
    );
  }

  public handleEventStart({ event }: EventNotification) {
    const whenToSwitchToPrebet = this.delayHandlingService.getTimeToStartEvent(event);
    this.scheduler.schedule(whenToSwitchToPrebet, this.switchToPrebet.bind(this, { eventId: event.eventID }), {
      overrideNow: event.now,
      keyOverride: `switchToPrebet-${event.eventID}`,
    });
  }

  public handleResultAvailable({ event, index }: EventDetailNotification) {
    const whenToSwitch = this.delayedEventDetailResultAvailable({ event, index });

    if (isLastEventDetail({ event, index })) {
      const resultAvailableTs = event.eventDetails[index].resultsAvailableTs;
      const resultDurationMs =
        new Date((event as any)?.scheduleEndTs ?? resultAvailableTs).getTime() - new Date(resultAvailableTs).getTime();

      this.scheduler.schedule(
        whenToSwitch,
        this.switchToResult.bind(this, { eventId: event.eventID, durationMs: resultDurationMs }),
        {
          overrideNow: event.now,
          keyOverride: `switchToResult-${event.eventID}`,
        }
      );
      return;
    }
    if (isPhaseSwitching({ event, index })) {
      this.scheduler.schedule(whenToSwitch, this.switchToPhaseChange.bind(this, { eventId: event.eventID }), {
        overrideNow: event.now,
        keyOverride: `switchToPhaseChange-${event.eventID}-${event.eventDetails[index].phase}`,
      });
      return;
    }

    const eventDetailChangeDelay = (event as any).config?.delay?.eventDetailChangeMs ?? 0;

    this.scheduler.schedule(
      new Date(whenToSwitch.getTime() + eventDetailChangeDelay),
      this.switchToEventDetailChange.bind(this, { eventId: event.eventID }),
      {
        overrideNow: event.now,
        keyOverride: `switchToEventDetailChange-${event.eventID}-${index}`,
      }
    );
  }

  public handleEventDetailScheduleStart({ event, index }: EventDetailNotification) {
    const whenToSwitchToStreaming = this.delayHandlingService.getTimeToStream(event, index);
    this.scheduler.schedule(whenToSwitchToStreaming, this.switchToStreaming.bind(this, { eventId: event.eventID }), {
      overrideNow: event.now,
      keyOverride: `switchToStreaming-${event.eventID}-${index}`,
    });
  }

  public getCurrentByGameId(gameId: string) {
    return {
      state: this.getCurrentGameFlow(gameId),
    };
  }

  private switchToPrebet({ eventId }: { eventId: number }) {
    this.gameFlowTimeTrackingService.setTrackPoint(idHelper.extractGameId(eventId), Date.now());
    this.switchGameFlow({ eventId, gameFlow: GameFlow.Prebet });
  }

  private switchToStreaming({ eventId }: { eventId: number }) {
    this.switchGameFlow({ eventId, gameFlow: GameFlow.Streaming });
  }

  private switchToEventDetailChange({ eventId }: { eventId: number }) {
    this.switchGameFlow({ eventId, gameFlow: GameFlow.EventDetailChange });
  }

  private switchToPhaseChange({ eventId }: { eventId: number }) {
    this.switchGameFlow({ eventId, gameFlow: GameFlow.PhaseChange });
  }

  private switchToResult({ eventId, durationMs }: { eventId: number; durationMs?: number }) {
    this.switchGameFlow({ eventId, gameFlow: GameFlow.Result, durationMs });
  }

  private switchGameFlow({
    eventId,
    gameFlow,
    durationMs,
  }: {
    eventId: number;
    gameFlow: GameFlow;
    durationMs?: number;
  }) {
    const gameId = idHelper.extractGameId(eventId);

    this.log(`event id ${eventId} switch to \x1b[32m${gameFlow}\x1b[37m`, gameId);

    this._gameFlowByGameId[gameId] = gameFlow;
    this.gameBroadcastService.broadcastToAllClientByGameId(
      gameId,
      {
        state: gameFlow,
        durationMs,
      },
      this.eventName
    );
  }

  private delayedEventDetailResultAvailable({ event, index }: EventDetailNotification) {
    return this.delayHandlingService.getDelayedTime(
      { event, time: new Date(event.eventDetails[index].resultsAvailableTs) },
      {
        oddsFeedEventType: OddsFeedEventName.EventDetailResultsAvailable,
      }
    );
  }

  private log(message: string, gameId: string) {
    this.featureDebugService.log(this, message, gameId);
  }
}
