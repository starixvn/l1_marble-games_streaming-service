import { EventNotification, OddFeedEventName, OddFeedEventSource, SystemNotification } from "../odd-feed-data";
import { Scheduler } from "../scheduler/scheduler";
import { DelayHandlingService } from "../delay/delay-handling-service";
import { GameBroadcastService } from "../../services/game-broadcast.service";
import { FeatureDebugService } from "../feature-debug/feature-debug-service";
import { idHelper } from "../../helpers";
import { Event } from "../../types";

interface IntroServiceContainer {
    oddFeedEventSource: OddFeedEventSource;
    scheduler: Scheduler;
    delayHandlingService: DelayHandlingService;
    gameBoardcastService: GameBroadcastService;
    featureDebugService: FeatureDebugService;
}

interface IntroState {
    resourceServer: string;
    introTime: number;
    timeToPlay: number;
    isPlaying: boolean;
    duration: number;
}

interface IntroConfig {
    resourceServer: string;
    duration: number;
}

export class IntroService {
    private readonly oddFeedEventSource: OddFeedEventSource;
    private readonly scheduler: Scheduler;
    private readonly delayHandlingService: DelayHandlingService;
    private readonly gameBoardcastService: GameBroadcastService;
    private readonly featureDebugService: FeatureDebugService;

    private readonly _introByGameId: Record<string, IntroState> = {};
    private readonly _introConfigByEventId: Record<number, IntroConfig> = {};

    private readonly boundHandleEventUpcoming: (notification: EventNotification) => void;
    private readonly boundHandleEventStart: (notification: EventNotification) => void;
    private readonly boundHandleEventCleanup: (notification: SystemNotification) => void;

    constructor(container: IntroServiceContainer) {
        this.oddFeedEventSource = container.oddFeedEventSource;
        this.scheduler = container.scheduler;
        this.delayHandlingService = container.delayHandlingService;
        this.gameBoardcastService = container.gameBoardcastService;
        this.featureDebugService = container.featureDebugService;

        this.boundHandleEventUpcoming = this.handleEventUpcoming.bind(this);
        this.boundHandleEventStart = this.handleEventStart.bind(this);
        this.boundHandleEventCleanup = this.handleEventCleanup.bind(this);
    }

    public eventName = "intro";

    initEvent() {

        this.oddFeedEventSource.registerEventListener(
            OddFeedEventName.EventUpcoming,
            this.boundHandleEventUpcoming
        );
        this.oddFeedEventSource.registerEventListener(
            OddFeedEventName.EventStart,
            this.boundHandleEventStart
        );
        this.oddFeedEventSource.registerSystemDataCleanupEventListener(this.boundHandleEventCleanup);
    }

    dispose() {
        this.oddFeedEventSource.unregisterEventListener(
            OddFeedEventName.EventUpcoming,
            this.boundHandleEventUpcoming
        );
        this.oddFeedEventSource.unregisterEventListener(
            OddFeedEventName.EventStart,
            this.boundHandleEventStart
        );
        this.oddFeedEventSource.unregisterSystemDataCleanupEventListener(this.boundHandleEventCleanup);
    }

    handleEventUpcoming({ event }: EventNotification) {
        const config = (event as any).config?.intro as IntroConfig;
        if (config) {
            this._introConfigByEventId[event.eventID] = config;
        }
    }

    handleEventStart({ event }: EventNotification) {
        const duration = this._introConfigByEventId[event.eventID]?.duration;
        
        if (!duration) {
            return;
        }

        const secondHalfIndex = this.getFirst2ndHalfEventDetailIndex(event);

        const durationInMillis = duration * 1000;
        const timeToPlayPrebetIntro = this.delayHandlingService.getDelayedTime({ eventId: event.eventID, time: new Date(event.scheduleStartTs) });
        const timeToStopPrebetIntro = new Date(timeToPlayPrebetIntro.getTime() + durationInMillis + 1);
        
        const timeToPlayHalfTimeIntro = this.delayHandlingService.getDelayedTime({ eventId: event.eventID, time: new Date(new Date(event.eventDetails[secondHalfIndex].scheduleStartTs).getTime() - durationInMillis) });
        const timeToStopHalfTimeIntro = new Date(timeToPlayHalfTimeIntro.getTime() + durationInMillis + 1);
        
        this.scheduler.schedule(timeToPlayPrebetIntro, this.updateIntroStatus.bind(this, { eventID: event.eventID, timeToPlay: timeToPlayPrebetIntro.getTime() }));
        this.scheduler.schedule(timeToPlayHalfTimeIntro, this.updateIntroStatus.bind(this, { eventID: event.eventID, timeToPlay: timeToPlayHalfTimeIntro.getTime() }));
        
        this.scheduler.schedule(timeToStopPrebetIntro, this.updateIntroStatus.bind(this, { eventID: event.eventID, timeToPlay: timeToPlayPrebetIntro.getTime() }));
        this.scheduler.schedule(timeToStopHalfTimeIntro, this.updateIntroStatus.bind(this, { eventID: event.eventID, timeToPlay: timeToPlayHalfTimeIntro.getTime() }));
    }

    updateIntroStatus({ eventID, timeToPlay }: { eventID: number, timeToPlay: number }) {
        const introTime = (Date.now() - timeToPlay) / 1000;
        const duration = this._introConfigByEventId[eventID].duration;

        const updateIntroState = {
            resourceServer: this._introConfigByEventId[eventID].resourceServer,
            introTime,
            timeToPlay,
            isPlaying: introTime >= 0 && introTime <= duration,
            duration,
        }

        const gameId = idHelper.extractGameId(eventID);
        this._introByGameId[gameId] = updateIntroState;

        this.broadcastIntro({ gameId });
    }

    handleEventCleanup({ eventID }: SystemNotification) {
        delete this._introConfigByEventId[eventID];
    }

    getCurrentByGameId(gameId: string) {
        const introState = this._introByGameId[gameId];
        if (!introState) {
            return undefined;
        }
        const introTime = (Date.now() - introState.timeToPlay) / 1000;
        return  { 
            ...introState,
            isPlaying: this.isPlaying(introState, introTime),
            introTime,
        };
    }

    private broadcastIntro({ gameId }: { gameId: string }) {
        
        this.gameBoardcastService.broadcastToAllClientByGameId(
            gameId,
            this.getCurrentByGameId(gameId) ?? {},
            this.eventName
        );
        this.log(`broadcast intro ${JSON.stringify(this.getCurrentByGameId(gameId), null, 2)}`, gameId);
    }

    private getFirst2ndHalfEventDetailIndex(event: Event) {
        return event.eventDetails.findIndex((detail) => detail.phase === 1);
    }

    private log(message: string, gameId: string) {
        this.featureDebugService.log(this, message, gameId);
    }

    private isPlaying(introState: IntroState, introTime: number) {
        return introTime >= 0 && introTime <= introState.duration;
    }
}