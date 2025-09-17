import { idHelper } from "../../helpers";
import { DelayHandlingService } from "../delay/delay-handling-service";
import { EventDetailNotification, OddFeedEventName, OddFeedEventSource } from "../odd-feed-data";
import { Scheduler } from "../scheduler/scheduler";
import { GameFlowService } from "../game-flow/game-flow-service";
import { GameBroadcastService } from "../../services/game-broadcast.service";

interface VideoStreamingServiceContainer {
    oddFeedEventSource: OddFeedEventSource;
    delayHandlingService: DelayHandlingService;
    scheduler: Scheduler;
    gameFlowService: GameFlowService;
    gameBoardcastService: GameBroadcastService;
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
    private readonly gameFlowService: GameFlowService;
    private readonly gameBoardcastService: GameBroadcastService;
    
    private readonly _currentVideoStateByGameId: Record<string, VideoState> = {};
    private readonly _preloadVideoStateByGameId: Record<string, PreloadVideoState> = {};

    private readonly boundHandleEventDetailScheduleStart: (notification: EventDetailNotification) => void;


    constructor(container: VideoStreamingServiceContainer) {
        this.oddFeedEventSource = container.oddFeedEventSource;
        this.delayHandlingService = container.delayHandlingService;
        this.scheduler = container.scheduler;
        this.gameFlowService = container.gameFlowService;
        this.gameBoardcastService = container.gameBoardcastService;

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
        const timeToStream = this.delayHandlingService.getDelayedTimeWithVideoDelay({ eventId: event.eventID, time: new Date(event.eventDetails[index].scheduleStartTs) });
        const timeToPreload = this.delayHandlingService.getDelayedTime({ eventId: event.eventID, time: new Date(event.eventDetails[index].scheduleStartTs) });
        this.scheduler.schedule(timeToStream, this.onLiveStreamStart.bind(this, { event, index }));
        this.scheduler.schedule(timeToPreload, this.onLiveStreamPreload.bind(this, { event, index }));
    }

    onLiveStreamStart({ event, index }: EventDetailNotification) {
        const gameId = idHelper.extractGameId(event.eventID);
        const timeToStream = this.delayHandlingService.getDelayedTimeWithVideoDelay({ eventId: event.eventID, time: new Date(event.scheduleStartTs) });
        this._currentVideoStateByGameId[gameId] = {
            videoLink: event.eventDetails[index].playlist,
            timeToStream: timeToStream.getTime(),
            currentTime: 0,
            phaseIndex: index,
        };
        const diffInSecond = (Date.now() - this.gameFlowService.getTrackPointByGameId(gameId)) / 1000;
        this.log(`video streaming started for game ${gameId} with event ${event.eventID} and index ${index} track time: ${diffInSecond} `);
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

    private log(message: string) {
        console.log(`\x1b[35m[VideoStreamingService] \x1b[37m: ${message}`);
    }
}