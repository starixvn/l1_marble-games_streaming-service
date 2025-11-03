import { CurrentEventService } from "../current-event/current-event-service";
import { GameFlowService } from "../game-flow/game-flow-service";
import { IntroService } from "../intro/intro-service";
import { LiveScoreService } from "../live-score/live-score-service";
import { ResultService } from "../result/result-service";
import { TeamNameService } from "../team-name/team-name-service";
import { VideoStreamingService } from "../video-streaming/video-streaming-service";

interface InGameConsumerContainer {
  gameFlowService: GameFlowService;
  currentEventService: CurrentEventService;
  videoStreamingService: VideoStreamingService;
  resultService: ResultService;
  liveScoreService: LiveScoreService;
  teamNameService: TeamNameService;
  introService: IntroService;
}

export class InGameConsumer {
  private readonly gameFlowService: GameFlowService;
  private readonly currentEventService: CurrentEventService;
  private readonly videoStreamingService: VideoStreamingService;
  private readonly resultService: ResultService;
  private readonly liveScoreService: LiveScoreService;
  private readonly teamNameService: TeamNameService;
  private readonly introService: IntroService;

  constructor(container: InGameConsumerContainer) {
    this.gameFlowService = container.gameFlowService;
    this.currentEventService = container.currentEventService;
    this.videoStreamingService = container.videoStreamingService;
    this.resultService = container.resultService;
    this.liveScoreService = container.liveScoreService;
    this.teamNameService = container.teamNameService;
    this.introService = container.introService;
  }

  public getCurrentByGameId(gameId: string) {
    const currentEvent = this.currentEventService.getCurrentByGameId(gameId);
    if (!currentEvent) {
      return {};
    }

    return {
      [this.gameFlowService.eventName]: this.gameFlowService.getCurrentByGameId(gameId),
      [this.currentEventService.eventName]: currentEvent,
      [this.videoStreamingService.streamingEventName]: this.videoStreamingService.getCurrentVideoStateByGameId(
        gameId,
        currentEvent.eventDetailIndex
      ),
      [this.videoStreamingService.preloadEventName]:
        this.videoStreamingService.getCurrentPreloadVideoStateByGameId(gameId),
      [this.resultService.eventName]: this.resultService.getCurrentByGameId(gameId),
      [this.liveScoreService.eventName]: this.liveScoreService.getCurrentByGameId(gameId),
      [this.teamNameService.eventName]: this.teamNameService.getCurrentByGameId(gameId),
      [this.introService.eventName]: this.introService.getCurrentByGameId(gameId),
    };
  }
}
