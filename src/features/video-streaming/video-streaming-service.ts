import { idHelper } from "../../helpers";
import { Event } from "../../types";
import { DelayHandlingService } from "../delay/delay-handling-service";
import { EventDetailNotification, OddFeedEventName, OddFeedEventSource } from "../odd-feed-data";
import { Scheduler } from "../scheduler/scheduler";
import { GameBroadcastService } from "../../services/game-broadcast.service";
import { FeatureDebugService } from "../feature-debug/feature-debug-service";

interface VideoStreamingServiceContainer {
    oddFeedEventSource: OddFeedEventSource;
    delayHandlingService: DelayHandlingService;
    scheduler: Scheduler;
    gameBoardcastService: GameBroadcastService;
    featureDebugService: FeatureDebugService;
}


export interface VideoState {
    videoLink: string;
    timeToStream: number;
    currentTime: number;
    phaseIndex: number;
}

export interface PreloadVideoState {
    videoLink: string;
}

export class VideoStreamingService {

    private readonly oddFeedEventSource: OddFeedEventSource;
    private readonly delayHandlingService: DelayHandlingService;
    private readonly scheduler: Scheduler;
    private readonly gameBoardcastService: GameBroadcastService;
    private readonly featureDebugService: FeatureDebugService;
    
    private readonly _currentVideoStateByGameId: Record<string, VideoState> = {};
    private readonly _preloadVideoStateByGameId: Record<string, PreloadVideoState> = {};

    private readonly boundHandleEventDetailScheduleStart: (notification: EventDetailNotification) => void;


    constructor(container: VideoStreamingServiceContainer) {
        this.oddFeedEventSource = container.oddFeedEventSource;
        this.delayHandlingService = container.delayHandlingService;
        this.scheduler = container.scheduler;
        this.gameBoardcastService = container.gameBoardcastService;
        this.featureDebugService = container.featureDebugService;

        this.boundHandleEventDetailScheduleStart = this.handleEventDetailScheduleStart.bind(this);
    }

    
    public readonly streamingEventName = "videoStreaming";
    public readonly preloadEventName = "preloadVideo"

    public initEvent() {
        this.oddFeedEventSource.registerEventDetailEventListener(
            OddFeedEventName.EventDetailStart,
            this.boundHandleEventDetailScheduleStart
        );
    }

    public dispose() {
        this.oddFeedEventSource.unregisterEventDetailEventListener(
            OddFeedEventName.EventDetailStart,
            this.boundHandleEventDetailScheduleStart
        );
    }

    public handleEventDetailScheduleStart({ event, index }: EventDetailNotification) {
        const timeToStream = this.getTimeToStream(event, index);
        const timeToPreload = this.getTimeToPreload(event, index);
        this.scheduler.schedule(timeToStream, this.onLiveStreamStart.bind(this, { event, index }));
        this.scheduler.schedule(timeToPreload, this.onLiveStreamPreload.bind(this, { event, index }));
    }

    onLiveStreamStart({ event, index }: EventDetailNotification) {
        const gameId = idHelper.extractGameId(event.eventID);
        const timeToStream = this.getTimeToStream(event, index);
        this._currentVideoStateByGameId[gameId] = {
            videoLink: event.eventDetails[index].playlist,
            timeToStream: timeToStream.getTime(),
            currentTime: 0,
            phaseIndex: index,
        };
        this.log(`video streaming started with event ${event.eventID} and index ${index}`, gameId);
        this.gameBoardcastService.broadcastToAllClientByGameId(
            gameId, 
            this.getCurrentVideoStateByGameId(gameId),
            this.streamingEventName);
    }

    onLiveStreamPreload({ event, index }: EventDetailNotification) {
        const gameId = idHelper.extractGameId(event.eventID);
        this._preloadVideoStateByGameId[gameId] = {
            videoLink: event.eventDetails[index].playlist,
        };

        this.gameBoardcastService.broadcastToAllClientByGameId(
            gameId, 
            this.getCurrentPreloadVideoStateByGameId(gameId),
            this.preloadEventName);
    }

    getCurrentVideoStateByGameId(gameId: string) {
        return {
            ...this._currentVideoStateByGameId[gameId],
            currentTime: Date.now() - this._currentVideoStateByGameId[gameId].timeToStream,
        };
    }

    getCurrentPreloadVideoStateByGameId(gameId: string) {
        return this._preloadVideoStateByGameId[gameId];
    }

    private log(message: string, gameId: string) {
        this.featureDebugService.log(this, message, gameId);
    }

    private getTimeToStream(event: Event, index: number) {
        return this.delayHandlingService.getDelayedTimeWithVideoDelay({ eventId: event.eventID, time: new Date(event.eventDetails[index].scheduleStartTs) }, {
            oddFeedEventType: OddFeedEventName.EventDetailStart,
        });
    }

    private getTimeToPreload(event: Event, index: number) {
        return this.delayHandlingService.getDelayedTime({ eventId: event.eventID, time: new Date(event.eventDetails[index].scheduleStartTs) }, {
            oddFeedEventType: OddFeedEventName.EventDetailStart,
        });
    }
}