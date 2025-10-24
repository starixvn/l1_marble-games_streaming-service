import { asClass, AwilixContainer } from "awilix";
import { logger } from "sc-common";
import { DelayHandlingService } from "./delay/delay-handling-service";
import { CurrentEventService } from "./current-event/current-event-service";
import { GameFlowService } from "./game-flow/game-flow-service";
import { VideoStreamingService } from "./video-streaming/video-streaming-service";
import { InGameConsumer } from "./in-game-consumer/in-game-consumer";
import { GameBroadcastService } from "../services/game-broadcast.service";
import { LiveScoreService } from "./live-score/live-score-service";
import { ResultService } from "./result/result-service";
import { FeatureDebugService } from "./feature-debug/feature-debug-service";
import { CommentatorVoiceService } from "./commentator-voice/commentator-voice-service";
import { IntroService } from "./intro/intro-service";
import { TeamNameService } from "./team-name/team-name-service";
import { GameFlowTimeTrackingService } from "./game-flow-time-tracking-service/game-flow-time-tracking-service";
import { EventReplayService } from "./event-replay/event-replay-service";


export interface OddsFeedDataContainer {
    logService: typeof logger;
    delayHandlingService: DelayHandlingService;
    currentEventService: CurrentEventService;
    gameFlowService: GameFlowService;
    videoStreamingService: VideoStreamingService;
    inGameConsumer: InGameConsumer;
    gameBroadcastService: GameBroadcastService;
    liveScoreService: LiveScoreService;
    resultService: ResultService;
    featureDebugService: FeatureDebugService;
    commentatorVoiceService: CommentatorVoiceService;
    introService: IntroService;
    teamNameService: TeamNameService;
    gameFlowTimeTrackingService: GameFlowTimeTrackingService;
    eventReplayService: EventReplayService;
}


export function registerContainer(container: AwilixContainer<OddsFeedDataContainer>) {
    container.register({
        gameFlowService: asClass(GameFlowService).singleton().disposer((service) => service.dispose()),
        featureDebugService: asClass(FeatureDebugService).singleton(),
        delayHandlingService: asClass(DelayHandlingService).singleton(),
        gameFlowTimeTrackingService: asClass(GameFlowTimeTrackingService).singleton(),
        currentEventService: asClass(CurrentEventService).singleton().disposer((service) => service.dispose()),
        videoStreamingService: asClass(VideoStreamingService).singleton().disposer((service) => service.dispose()),
        inGameConsumer: asClass(InGameConsumer).singleton(),
        gameBroadcastService: asClass(GameBroadcastService).singleton(),
        liveScoreService: asClass(LiveScoreService).singleton().proxy().disposer((service) => service.dispose()),
        resultService: asClass(ResultService).singleton().disposer((service) => service.dispose()),
        commentatorVoiceService: asClass(CommentatorVoiceService).singleton().disposer((service) => service.dispose()),
        introService: asClass(IntroService).singleton().disposer((service) => service.dispose()),
        teamNameService: asClass(TeamNameService).singleton().disposer((service) => service.dispose()),
        eventReplayService: asClass(EventReplayService).singleton(),
    });

    return container;
}

export function initContainer(container: AwilixContainer<OddsFeedDataContainer>) {
    container.resolve("gameFlowService").initEvent();
    container.resolve("currentEventService").initEvent();
    container.resolve("videoStreamingService").initEvent();
    container.resolve("liveScoreService").initEvent();
    container.resolve("resultService").initEvent();
    container.resolve("commentatorVoiceService").initEvent();
    container.resolve("introService").initEvent();
    container.resolve("teamNameService").initEvent();
}