import { EventDetailNotification, OddsFeedEventName, OddsFeedEventSource, OddsFeedService, Scheduler } from "odds-feed-client";
import { DelayHandlingService } from "../delay/delay-handling-service";
import { idHelper } from "../../helpers";
import { Event, GoalInfoData } from "../../types";
import { GameBroadcastService } from "../../services/game-broadcast.service";
import { FeatureDebugService } from "../feature-debug/feature-debug-service";

export interface LiveScoreState {
    homeScore: number;
    awayScore: number;
}

export interface LiveScoreStateByPhase {
    liveScoreByPhase: Record<number, LiveScoreState>;
}

interface LiveScoreServiceContainer {
    oddsFeedEventSource: OddsFeedEventSource;
    oddsFeedService: OddsFeedService;
    delayHandlingService: DelayHandlingService;
    scheduler: Scheduler;
    gameBroadcastService: GameBroadcastService;
    featureDebugService: FeatureDebugService;
}

export class LiveScoreService {

    private readonly oddsFeedEventSource: OddsFeedEventSource;
    private readonly oddsFeedService: OddsFeedService;
    private readonly delayHandlingService: DelayHandlingService;
    private readonly scheduler: Scheduler;
    private readonly gameBroadcastService: GameBroadcastService;
    private readonly featureDebugService: FeatureDebugService;
    private readonly _liveScoreByGameId: Record<string, LiveScoreState> = {};
    
    private readonly boundHandleEventDetailStart: (notification: EventDetailNotification) => void;

    constructor(container: LiveScoreServiceContainer) {
        this.oddsFeedEventSource = container.oddsFeedEventSource;
        this.oddsFeedService = container.oddsFeedService;
        this.delayHandlingService = container.delayHandlingService;
        this.scheduler = container.scheduler;
        this.gameBroadcastService = container.gameBroadcastService;
        this.featureDebugService = container.featureDebugService;

        this.boundHandleEventDetailStart = this.handleEventDetailStart.bind(this);
    }

    public readonly eventName = "liveScore";
    
    public getCurrentByGameId(gameId: string) {
        return this._liveScoreByGameId[gameId];
    }

    public initEvent() {
        this.oddsFeedEventSource.eventDetailOn(
            OddsFeedEventName.EventDetailStart,
            this.boundHandleEventDetailStart
        );
    }

    public dispose() {
        this.oddsFeedEventSource.eventDetailOff(
            OddsFeedEventName.EventDetailStart,
            this.boundHandleEventDetailStart
        );
    }

    public async handleEventDetailStart({ event, index }: EventDetailNotification) {
        const goalInfoUrl = event.eventDetails[index].goalInfo;
        const goalInfo = await this.oddsFeedService.getRemoteJson<GoalInfoData>(goalInfoUrl, {
            eventId: event.eventID,
        });

        if (!goalInfo) {
            return;
        }

        if (index === 0) {
            const timeToReset = this.delayHandlingService.getDelayedTime({ eventId: event.eventID, time: new Date(event.eventDetails[index].scheduleStartTs) }, {
                oddsFeedEventType: OddsFeedEventName.EventDetailStart,
            });
            this.scheduler.schedule(timeToReset, this.resetLiveScore.bind(this, { gameId: idHelper.extractGameId(event.eventID) }));
        }

        goalInfo?.timeLine.forEach((time, goalIndex) => {
            const goalTime = new Date(event.eventDetails[index].scheduleStartTs).getTime() + time * 1000;
            const timeToUpdate = this.delayHandlingService.getDelayedTimeWithVideoDelay({ eventId: event.eventID, time: new Date(goalTime) }, {
                oddsFeedEventType: OddsFeedEventName.EventDetailStart,
            });
            this.scheduler.schedule(timeToUpdate, this.handleLiveScoreUpdate.bind(this, { event, result: goalInfo.result[goalIndex] }));
        });
    }

    public handleLiveScoreUpdate({ event, result }: { event: Event, result: string }) {
        const gameId = idHelper.extractGameId(event.eventID);
        if (!this._liveScoreByGameId[gameId]) {
            this._liveScoreByGameId[gameId] = { homeScore: 0, awayScore: 0 };
        }

        const currentHomeScore = this._liveScoreByGameId[gameId].homeScore;
        const currentAwayScore = this._liveScoreByGameId[gameId].awayScore;

        const plusHomeScore = result === "H" ? 1 : 0;
        const plusAwayScore = result === "A" ? 1 : 0;

        const homeScore = currentHomeScore + plusHomeScore;
        const awayScore = currentAwayScore + plusAwayScore;

        this._liveScoreByGameId[gameId] = { homeScore, awayScore };
        this.broadcastLiveScore({ gameId });
    }

    private resetLiveScore({ gameId }: { gameId: string }) {
        this._liveScoreByGameId[gameId] = { homeScore: 0, awayScore: 0 };
        this.broadcastLiveScore({ gameId });
    }

    private broadcastLiveScore({ gameId }: { gameId: string }) {
        const currentLiveScore = this.getCurrentByGameId(gameId);
        this.log(`broadcast live score ${JSON.stringify(currentLiveScore)}`, gameId);

        this.gameBroadcastService.broadcastToAllClientByGameId(
            gameId, 
            this.getCurrentByGameId(gameId),
            this.eventName);
    }

    private log(message: string, gameId: string) {
        this.featureDebugService.log(this, message, gameId);
    }
}