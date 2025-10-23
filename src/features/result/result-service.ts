import { GameBroadcastService } from "../../services/game-broadcast.service";
import { EventDetailNotification, EventNotification, OddsFeedEventName, OddsFeedEventSource, Scheduler, Event as OddsEvent } from "odds-feed-client";
import { idHelper } from "../../helpers";
import { DelayHandlingService } from "../delay/delay-handling-service";
import { FeatureDebugService } from "../feature-debug/feature-debug-service";
import { Replay, ReplayService } from "../event-replay/event-replay-service";

export type ResultServiceContainer = {
    oddsFeedEventSource: OddsFeedEventSource;
    scheduler: Scheduler;
    delayHandlingService: DelayHandlingService;
    gameBroadcastService: GameBroadcastService;
    featureDebugService: FeatureDebugService;
};

interface Result {
    homeScore: number;
    awayScore: number;
}

export interface ResultState {
    result: Record<number, Result>;
}

export class ResultService implements ReplayService<ResultState> {

    private readonly oddsFeedEventSource: OddsFeedEventSource;
    private readonly scheduler: Scheduler;
    private readonly delayHandlingService: DelayHandlingService;
    private readonly gameBroadcastService: GameBroadcastService;
    private readonly featureDebugService: FeatureDebugService;
    private readonly _resultByGameId: Record<string, ResultState> = {};

    private readonly boundHandleEventDetailResultAvailable: (notification: EventDetailNotification) => void;
    private readonly boundHandleEventStart: (notification: EventNotification) => void;

    constructor(container: ResultServiceContainer) {
        this.oddsFeedEventSource = container.oddsFeedEventSource;
        this.scheduler = container.scheduler;
        this.delayHandlingService = container.delayHandlingService;
        this.gameBroadcastService = container.gameBroadcastService;
        this.featureDebugService = container.featureDebugService;
        
        this.boundHandleEventDetailResultAvailable = this.handleEventDetailResultAvailable.bind(this);
        this.boundHandleEventStart = this.handleEventStart.bind(this);
    }

    public readonly eventName = "result";

    public initEvent() {
        this.oddsFeedEventSource.eventDetailOn(
            OddsFeedEventName.EventDetailResultsAvailable,
            this.boundHandleEventDetailResultAvailable
        );
        this.oddsFeedEventSource.eventOn(
            OddsFeedEventName.EventStart,
            this.boundHandleEventStart
        );
    }

    public dispose() {
        this.oddsFeedEventSource.eventDetailOff(
            OddsFeedEventName.EventDetailResultsAvailable,
            this.boundHandleEventDetailResultAvailable
        );
        this.oddsFeedEventSource.eventOff(
            OddsFeedEventName.EventStart,
            this.boundHandleEventStart
        );
    }

    public getCurrentByGameId(gameId: string): ResultState {
        return this._resultByGameId[gameId];
    }

    public handleEventDetailResultAvailable({ event, index }: EventDetailNotification) {
        const timeToUpdate = this.delayHandlingService.getDelayedTime({ event, time: new Date(event.eventDetails[index].resultsAvailableTs) }, {
            oddsFeedEventType: OddsFeedEventName.EventDetailResultsAvailable,
        });
        this.scheduler.schedule(timeToUpdate, this.handleResultUpdate.bind(this, { event, index }));
    }

    public handleEventStart({ event }: EventNotification) {
        const timeToReset = this.delayHandlingService.getDelayedTime({ event, time: new Date(event.scheduleStartTs) }, {
            oddsFeedEventType: OddsFeedEventName.EventStart,
        });
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

	getReplayByEvent(event: OddsEvent): Replay<ResultState>[] {
		const replays: Replay<ResultState>[] = [];
		// Reset at event start
		const resetTime = this.delayHandlingService.getDelayedTime({ event, time: new Date(event.scheduleStartTs) }, {
			oddsFeedEventType: OddsFeedEventName.EventStart,
		});
		replays.push({
			time: resetTime,
			payload: { result: { 0: { homeScore: 0, awayScore: 0 } } },
			eventName: this.eventName,
		});

		// Build cumulative result per phase at each resultsAvailable
		const phaseTotals: Record<number, { homeScore: number; awayScore: number }> = {};
		event.eventDetails.forEach((detail) => {
			const phase = detail.phase;
			const [homeStr, awayStr] = (detail.result ?? "0:0").split(":");
			const home = parseInt(homeStr ?? "0");
			const away = parseInt(awayStr ?? "0");
			const current = phaseTotals[phase] ?? { homeScore: 0, awayScore: 0 };
			const updated = {
				homeScore: current.homeScore + (isNaN(home) ? 0 : home),
				awayScore: current.awayScore + (isNaN(away) ? 0 : away),
			};
			phaseTotals[phase] = updated;

			const when = this.delayHandlingService.getDelayedTime({ event, time: new Date(detail.resultsAvailableTs) }, {
				oddsFeedEventType: OddsFeedEventName.EventDetailResultsAvailable,
			});
			replays.push({
				time: when,
				payload: { result: { ...phaseTotals } },
				eventName: this.eventName,
			});
		});

		return replays;
	}

    private broadcastResult({ gameId }: { gameId: string }) {
        const currentResult = this.getCurrentByGameId(gameId);

        this.log(`${JSON.stringify(currentResult)}`, gameId);

        this.gameBroadcastService.broadcastToAllClientByGameId(
            gameId,
            this.getCurrentByGameId(gameId),
            this.eventName
        );
    }

    private log(message: string, gameId: string) {
        this.featureDebugService.log(this, message, gameId);
    }
}