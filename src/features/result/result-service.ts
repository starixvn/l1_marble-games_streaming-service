import { GameBroadcastService } from "../../services/game-broadcast.service";
import { EventDetailNotification, EventNotification, OddFeedEventName, OddFeedEventSource } from "../odd-feed-data";
import { idHelper } from "../../helpers";
import { Scheduler } from "../scheduler/scheduler";
import { DelayHandlingService } from "../delay/delay-handling-service";
import { FeatureDebugService } from "../feature-debug/feature-debug-service";

export type ResultServiceContainer = {
    oddFeedEventSource: OddFeedEventSource;
    scheduler: Scheduler;
    delayHandlingService: DelayHandlingService;
    gameBoardcastService: GameBroadcastService;
    featureDebugService: FeatureDebugService;
};

interface Result {
    homeScore: number;
    awayScore: number;
}

export interface ResultState {
    result: Record<number, Result>;
}

export class ResultService {

    private readonly oddFeedEventSource: OddFeedEventSource;
    private readonly scheduler: Scheduler;
    private readonly delayHandlingService: DelayHandlingService;
    private readonly gameBoardcastService: GameBroadcastService;
    private readonly featureDebugService: FeatureDebugService;
    private readonly _resultByGameId: Record<string, ResultState> = {};

    private readonly boundHandleEventDetailResultAvailable: (notification: EventDetailNotification) => void;
    private readonly boundHandleEventStart: (notification: EventNotification) => void;

    constructor(container: ResultServiceContainer) {
        this.oddFeedEventSource = container.oddFeedEventSource;
        this.scheduler = container.scheduler;
        this.delayHandlingService = container.delayHandlingService;
        this.gameBoardcastService = container.gameBoardcastService;
        this.featureDebugService = container.featureDebugService;
        
        this.boundHandleEventDetailResultAvailable = this.handleEventDetailResultAvailable.bind(this);
        this.boundHandleEventStart = this.handleEventStart.bind(this);
    }

    public readonly eventName = "result";

    public initEvent() {
        this.oddFeedEventSource.registerEventDetailEventListener(
            OddFeedEventName.EventDetailResultsAvailable,
            this.boundHandleEventDetailResultAvailable
        );
        this.oddFeedEventSource.registerEventListener(
            OddFeedEventName.EventStart,
            this.boundHandleEventStart
        );
    }

    public dispose() {
        this.oddFeedEventSource.unregisterEventDetailEventListener(
            OddFeedEventName.EventDetailResultsAvailable,
            this.boundHandleEventDetailResultAvailable
        );
        this.oddFeedEventSource.unregisterEventListener(
            OddFeedEventName.EventStart,
            this.boundHandleEventStart
        );
    }

    public getCurrentByGameId(gameId: string): ResultState {
        return this._resultByGameId[gameId];
    }

    public handleEventDetailResultAvailable({ event, index }: EventDetailNotification) {
        const timeToUpdate = this.delayHandlingService.getDelayedTime({ eventId: event.eventID, time: new Date(event.eventDetails[index].resultsAvailableTs) });
        this.scheduler.schedule(timeToUpdate, this.handleResultUpdate.bind(this, { event, index }));
    }

    public handleEventStart({ event }: EventNotification) {
        const timeToReset = this.delayHandlingService.getDelayedTime({ eventId: event.eventID, time: new Date(event.scheduleStartTs) });
        this.scheduler.schedule(timeToReset, this.handleResetEvent.bind(this, { event }));
    }

    public handleResultUpdate({ event, index }: EventDetailNotification) {
        const gameId = idHelper.extractGameId(event.eventID);
        if (!this._resultByGameId[gameId]) {
            this._resultByGameId[gameId] = {
                result: {
                    0: { homeScore: 0, awayScore: 0 },
                },
            };
        }
        const phase = event.eventDetails[index].phase;

        const resultFromEvent = event.eventDetails[index].result;
        const resultArr = resultFromEvent.split(":");
        const homeScoreFromEvent = parseInt(resultArr[0]);
        const awayScoreFromEvent = parseInt(resultArr[1]);

        const currentHomeScore = this._resultByGameId[gameId].result[phase]?.homeScore ?? 0;
        const currentAwayScore = this._resultByGameId[gameId].result[phase]?.awayScore ?? 0;

        const homeScore = currentHomeScore + homeScoreFromEvent;
        const awayScore = currentAwayScore + awayScoreFromEvent;

        this._resultByGameId[gameId].result[phase] = { homeScore, awayScore };
        this.broadcastResult({ gameId });
    }

    public handleResetEvent({ event }: EventNotification) {
        const gameId = idHelper.extractGameId(event.eventID);
        this._resultByGameId[gameId] = {
            result: {
                0: { homeScore: 0, awayScore: 0 },
            },
        };

        this.broadcastResult({ gameId });
    }

    private broadcastResult({ gameId }: { gameId: string }) {
        const currentResult = this.getCurrentByGameId(gameId);

        this.log(`${JSON.stringify(currentResult)}`, gameId);

        this.gameBoardcastService.broadcastToAllClientByGameId(
            gameId,
            this.getCurrentByGameId(gameId),
            this.eventName
        );
    }

    private log(message: string, gameId: string) {
        this.featureDebugService.log(this, message, gameId);
    }
}