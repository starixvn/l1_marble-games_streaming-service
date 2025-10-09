import { asClass, asFunction, AwilixContainer } from "awilix";
import { logger } from "sc-common";
import { DelayHandlingServiceContainer, DelayHandlingService } from "./delay/delay-handling-service";
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


export interface OddsFeedDataContainer extends DelayHandlingServiceContainer {
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
}

function lazy<T extends object>(resolver: () => T): T {
    return new Proxy({}, {
      get: (_, prop) => Reflect.get(resolver(), prop),
      apply: (_, __, args) => Reflect.apply(resolver() as any, null, args),
    }) as T;
  }

export function registerContainer(container: AwilixContainer<OddsFeedDataContainer>) {
    container.register({
        delayHandlingService: asClass(DelayHandlingService).singleton().disposer((service) => service.dispose()),
    });

    container.register({
        gameFlowService: asFunction(
            (cradle) => new GameFlowService({
                featureDebugService: lazy(() => cradle.featureDebugService),
                oddsFeedEventSource: cradle.oddsFeedEventSource,
                scheduler: cradle.scheduler,
                delayHandlingService: cradle.delayHandlingService,
                gameBroadcastService: cradle.gameBroadcastService,
            }),
        ).singleton().proxy().disposer((service) => service.dispose()),
        featureDebugService: asFunction(
            (cradle) => new FeatureDebugService({
                gameFlowService: lazy(() => cradle.gameFlowService),
            }),
        ).singleton().proxy().disposer((service) => service.dispose()),
    });
    
    container.register({
        currentEventService: asClass(CurrentEventService).singleton().disposer((service) => service.dispose()),
        videoStreamingService: asClass(VideoStreamingService).singleton().disposer((service) => service.dispose()),
        inGameConsumer: asClass(InGameConsumer).singleton(),
        gameBroadcastService: asClass(GameBroadcastService).singleton(),
        liveScoreService: asClass(LiveScoreService).singleton().proxy().disposer((service) => service.dispose()),
        resultService: asClass(ResultService).singleton().disposer((service) => service.dispose()),
        commentatorVoiceService: asClass(CommentatorVoiceService).singleton().disposer((service) => service.dispose()),
        introService: asClass(IntroService).singleton().disposer((service) => service.dispose()),
        teamNameService: asClass(TeamNameService).singleton().disposer((service) => service.dispose()),
    });

    return container;
}

export function initContainer(container: AwilixContainer<OddsFeedDataContainer>) {
    container.resolve("delayHandlingService").initEvent();
    container.resolve("currentEventService").initEvent();
    container.resolve("gameFlowService").initEvent();
    container.resolve("videoStreamingService").initEvent();
    container.resolve("liveScoreService").initEvent();
    container.resolve("resultService").initEvent();
    container.resolve("commentatorVoiceService").initEvent();
    container.resolve("introService").initEvent();
    container.resolve("teamNameService").initEvent();
}