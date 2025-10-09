import { idHelper } from "../../helpers";
import { Event } from "../../types";
import { DelayHandlingService } from "../delay/delay-handling-service";
import { EventDetailNotification, OddsFeedEventName, OddsFeedEventSource, Scheduler } from "odds-feed-client";
import { GameBroadcastService } from "../../services/game-broadcast.service";
import { FeatureDebugService } from "../feature-debug/feature-debug-service";

interface VideoStreamingServiceContainer {
    oddsFeedEventSource: OddsFeedEventSource;
    delayHandlingService: DelayHandlingService;
    scheduler: Scheduler;
    gameBroadcastService: GameBroadcastService;
    featureDebugService: FeatureDebugService;
}


export interface VideoState {
    videoLink: string;
    timeToStream: number;
    currentTime: number;
    phaseIndex: number;
    timeFromPhaseStart: number;
    timeFromPhaseEnd: number;
}

export interface PreloadVideoState {
    videoLink: string;
}

export class VideoStreamingService {

    private readonly oddsFeedEventSource: OddsFeedEventSource;
    private readonly delayHandlingService: DelayHandlingService;
    private readonly scheduler: Scheduler;
    private readonly gameBroadcastService: GameBroadcastService;
    private readonly featureDebugService: FeatureDebugService;
    
    private readonly _currentVideoStateByGameId: Record<string, VideoState> = {};
    private readonly _preloadVideoStateByGameId: Record<string, PreloadVideoState> = {};

    private readonly boundHandleEventDetailScheduleStart: (notification: EventDetailNotification) => void;


    constructor(container: VideoStreamingServiceContainer) {
        this.oddsFeedEventSource = container.oddsFeedEventSource;
        this.delayHandlingService = container.delayHandlingService;
        this.scheduler = container.scheduler;
        this.gameBroadcastService = container.gameBroadcastService;
        this.featureDebugService = container.featureDebugService;

        this.boundHandleEventDetailScheduleStart = this.handleEventDetailScheduleStart.bind(this);
    }

    
    public readonly streamingEventName = "videoStreaming";
    public readonly preloadEventName = "preloadVideo"

    public initEvent() {
        this.oddsFeedEventSource.eventDetailOn(
            OddsFeedEventName.EventDetailStart,
            this.boundHandleEventDetailScheduleStart
        );
    }

    public dispose() {
        this.oddsFeedEventSource.eventDetailOff(
            OddsFeedEventName.EventDetailStart,
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
        const timeFromPhaseStart = this.getTimeFromPhaseStart(event, index);
        const timeFromPhaseEnd = this.getTimeFromPhaseEnd(event, index);
        this._currentVideoStateByGameId[gameId] = {
            videoLink: event.eventDetails[index].playlist,
            timeToStream: timeToStream.getTime(),
            currentTime: 0,
            phaseIndex: event.eventDetails[index].phase,
            timeFromPhaseStart: timeFromPhaseStart.getTime(),
            timeFromPhaseEnd: timeFromPhaseEnd.getTime(),
        };
        const currentVideoState = this.getCurrentVideoStateByGameId(gameId);
        this.log(`video streaming started with event ${event.eventID} and index ${index}
            ${JSON.stringify(currentVideoState, null, 2)}
            `, gameId);
        this.gameBroadcastService.broadcastToAllClientByGameId(
            gameId, 
            this.getCurrentVideoStateByGameId(gameId),
            this.streamingEventName);
    }

    onLiveStreamPreload({ event, index }: EventDetailNotification) {
        const gameId = idHelper.extractGameId(event.eventID);
        this._preloadVideoStateByGameId[gameId] = {
            videoLink: event.eventDetails[index].playlist,
        };

        this.gameBroadcastService.broadcastToAllClientByGameId(
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
            oddsFeedEventType: OddsFeedEventName.EventDetailStart,
        });
    }

    private getTimeToPreload(event: Event, index: number) {
        return this.delayHandlingService.getDelayedTime({ eventId: event.eventID, time: new Date(event.eventDetails[index].scheduleStartTs) }, {
            oddsFeedEventType: OddsFeedEventName.EventDetailStart,
        });
    }

    private getTimeFromPhaseStart(event: Event, index: number) {
        const currentPhase = event.eventDetails[index].phase;
        const firstEventDetailOfPhase = 
            event.eventDetails.find(detail => detail.phase === currentPhase) 
            ?? event.eventDetails[index];
        return this.delayHandlingService.getDelayedTimeWithVideoDelay({ eventId: event.eventID, time: new Date(firstEventDetailOfPhase.scheduleStartTs) }, {
            oddsFeedEventType: OddsFeedEventName.EventDetailStart,
        });
    }

    private getTimeFromPhaseEnd(event: Event, index: number) {
        const currentPhase = event.eventDetails[index].phase;
        const lastEventDetailOfPhase = 
            event.eventDetails.findLast(detail => detail.phase === currentPhase) 
            ?? event.eventDetails[index];
        return this.delayHandlingService.getDelayedTimeWithVideoDelay({ eventId: event.eventID, time: new Date(lastEventDetailOfPhase.resultsAvailableTs) }, {
            oddsFeedEventType: OddsFeedEventName.EventDetailStart,
        });
    }
}