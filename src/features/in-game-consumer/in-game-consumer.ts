import { CurrentEventService } from "../current-event/current-event-service";
import { GameFlowService } from "../game-flow/game-flow-service";
import { VideoStreamingService } from "../video-streaming/video-streaming-service";


interface InGameConsumerContainer {
    gameFlowService: GameFlowService;
    currentEventService: CurrentEventService;
    videoStreamingService: VideoStreamingService;
}

export class InGameConsumer {

    private readonly gameFlowService: GameFlowService;
    private readonly currentEventService: CurrentEventService;
    private readonly videoStreamingService: VideoStreamingService;

    constructor(container: InGameConsumerContainer) {
        this.gameFlowService = container.gameFlowService;
        this.currentEventService = container.currentEventService;
        this.videoStreamingService = container.videoStreamingService;
    }
    
    public getCurrentByGameId(gameId: string) {
        return {
            [this.gameFlowService.eventName]: this.gameFlowService.getCurrentByGameId(gameId),
            [this.currentEventService.eventName]: this.currentEventService.getCurrentByGameId(gameId),
            [this.videoStreamingService.streamingEventName]: this.videoStreamingService.getCurrentVideoStateByGameId(gameId),
            [this.videoStreamingService.preloadEventName]: this.videoStreamingService.getCurrentPreloadVideoStateByGameId(gameId),
        }
    }
}