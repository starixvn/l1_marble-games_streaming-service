import { idHelper } from "../../helpers";
import { DelayHandlingService } from "../delay/delay-handling-service";
import { OddFeedEventName, OddFeedEventSource, EventNotification, EventDetailNotification } from "../odd-feed-data";
import { Scheduler } from "../scheduler/scheduler";
import { CurrentEventService } from "../current-event/current-event-service";
import { isLastEventDetail, isPhaseSwitching } from "../../helpers/phase-helper";
import { GameBroadcastService } from "../../services/game-broadcast.service";

export enum GameFlow {
    Prebet = "Prebet",
    Streaming = "Streaming",
    HalfTime = "HalfTime",
    Result = "Result",
}

interface GameFlowServiceContainer {
    oddFeedEventSource: OddFeedEventSource;
    scheduler: Scheduler;
    delayHandlingService: DelayHandlingService;
    gameBoardcastService: GameBroadcastService;
}

export class GameFlowService {
    private readonly oddFeedEventSource: OddFeedEventSource;
    private readonly scheduler: Scheduler;
    private readonly delayHandlingService: DelayHandlingService;
    private readonly gameBoardcastService: GameBroadcastService;

    private _gameFlowByGameId: Record<string, GameFlow> = {};
    private _trackPointByGameId: Record<string, number> = {};

    private readonly boundHandleEventStart: (notification: EventNotification) => void;
    private readonly boundHandleResultAvailable: (notification: EventDetailNotification) => void;
    private readonly boundHandleEventDetailScheduleStart: (notification: EventDetailNotification) => void;
    
    constructor(container: GameFlowServiceContainer) {
        this.oddFeedEventSource = container.oddFeedEventSource;
        this.scheduler = container.scheduler;
        this.delayHandlingService = container.delayHandlingService;
        this.gameBoardcastService = container.gameBoardcastService;

        this.boundHandleEventStart = this.handleEventStart.bind(this);
        this.boundHandleResultAvailable = this.handleResultAvailable.bind(this);
        this.boundHandleEventDetailScheduleStart = this.handleEventDetailScheduleStart.bind(this);
    }

    public initEvent() {
        this.oddFeedEventSource.registerEventListener(
            OddFeedEventName.EventStart,
            this.boundHandleEventStart
        );
        this.oddFeedEventSource.registerEventDetailEventListener(
            OddFeedEventName.EventDetailResultsAvailable,
            this.boundHandleResultAvailable
        );
        this.oddFeedEventSource.registerEventDetailEventListener(
            OddFeedEventName.EventDetailStart,
            this.boundHandleEventDetailScheduleStart
        );
    }   

    public getCurrentGameFlow(gameId: string) {
        return this._gameFlowByGameId[gameId];
    }

    public dispose() {
        this.oddFeedEventSource.unregisterEventListener(
            OddFeedEventName.EventStart,
            this.boundHandleEventStart
        );
        this.oddFeedEventSource.unregisterEventDetailEventListener(
            OddFeedEventName.EventDetailResultsAvailable,
            this.boundHandleResultAvailable
        );
        this.oddFeedEventSource.unregisterEventDetailEventListener(
            OddFeedEventName.EventDetailStart,
            this.boundHandleEventDetailScheduleStart
        );
    }

    public handleEventStart({ event }: EventNotification) {
        const whenToSwitchToPrebet = this.delayedEventScheduleStart({ event });
        this.scheduler.schedule(whenToSwitchToPrebet, this.switchToPrebet.bind(this, { eventId: event.eventID }));
    }

    public handleResultAvailable({ event, index }: EventDetailNotification) {
        if (isLastEventDetail({ event, index })) {
            const whenToSwitch = this.delayedEventDetailResultAvailable({ event, index });
            this.scheduler.schedule(whenToSwitch, this.switchToResult.bind(this, { eventId: event.eventID }));
        }
        if (isPhaseSwitching({ event, index })) {
            const whenToSwitch = this.delayedEventDetailResultAvailable({ event, index });
            this.scheduler.schedule(whenToSwitch, this.switchToHalfTime.bind(this, { eventId: event.eventID }));
        }
    }

    public handleEventDetailScheduleStart({ event, index }: EventDetailNotification) {
        const whenToSwitchToStreaming = this.delayedEventDetailtScheduleStartWithVideoDelay({ event, index });
        this.scheduler.schedule(whenToSwitchToStreaming, this.switchToStreaming.bind(this, { eventId: event.eventID }));
    }

    public getCurrentByGameId(gameId: string) {
        return {
            gameFlow: this.getCurrentGameFlow(gameId),
        }
    }

    public getTrackPointByGameId(gameId: string) {
        return this._trackPointByGameId[gameId];
    }

    private switchToPrebet({ eventId }: { eventId: number }) {
        this._trackPointByGameId[idHelper.extractGameId(eventId)] = Date.now();
        this.switchGameFlow({ eventId, gameFlow: GameFlow.Prebet });
    }

    private switchToStreaming({ eventId }: { eventId: number }) {
        this.switchGameFlow({ eventId, gameFlow: GameFlow.Streaming });
    }

    private switchToHalfTime({ eventId }: { eventId: number }) {
        this.switchGameFlow({ eventId, gameFlow: GameFlow.HalfTime });
    }

    private switchToResult({ eventId }: { eventId: number }) {
        this.switchGameFlow({ eventId, gameFlow: GameFlow.Result });
    }

    private switchGameFlow({ eventId, gameFlow }: { eventId: number, gameFlow: GameFlow }) {
        const gameId = idHelper.extractGameId(eventId);
        const diffInSecond = (Date.now() - this._trackPointByGameId[gameId]) / 1000;
        
        this.log(`switch to \x1b[32m${gameFlow}\x1b[37m for game ${gameId} track time: ${diffInSecond}`);
        this._gameFlowByGameId[gameId] = gameFlow;
        this.gameBoardcastService.broadcastToAllClientByGameId(gameId, { 
            gameFlow: {
                gameFlow,
            }
         });
    }

    private delayedEventDetailResultAvailable({ event, index }: EventDetailNotification) {
        return this.delayHandlingService.getDelayedTime({ eventId: event.eventID, time: new Date(event.eventDetails[index].resultsAvailableTs) });
    }

    private delayedEventDetailtScheduleStartWithVideoDelay({ event, index }: EventDetailNotification) {
        return this.delayHandlingService.getDelayedTimeWithVideoDelay({ eventId: event.eventID, time: new Date(event.eventDetails[index].scheduleStartTs) });
    }

    private delayedEventScheduleStart({ event }: EventNotification | EventDetailNotification) {
        return this.delayHandlingService.getDelayedTime({ eventId: event.eventID, time: new Date(event.scheduleStartTs) });
    }

    private log(message: string) {
        console.log(`\x1b[33m[GameFlowService] \x1b[37m: ${message}`);
    }
}