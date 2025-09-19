import { asClass, asFunction, AwilixContainer } from "awilix";
import { logger } from "sc-common";
import { OddsFeedService } from "../services/odds-feed-service";
import { DelayHandlingServiceContainer, DelayHandlingService } from "./delay/delay-handling-service";
import { OddFeedEventSource } from "./odd-feed-data";
import { OddFeedCron } from "./odd-feed-data/odd-feed-cron";
import { OddFeedPullService } from "./odd-feed-data/odd-feed-pull-service";
import { OddFeedScheduler } from "./odd-feed-data/odd-feed-scheduler";
import { OddFeedStore } from "./odd-feed-data/odd-feed-store";
import { Scheduler } from "./scheduler/scheduler";
import { CurrentEventService } from "./current-event/current-event-service";
import { EventCleanerService } from "./event-cleaner/event-cleaner-service";
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


export interface OddFeedDataContainer extends DelayHandlingServiceContainer {
    oddFeedEventSource: OddFeedEventSource;
    oddFeedScheduler: OddFeedScheduler;
    oddFeedStore: OddFeedStore;
    oddFeedPullService: OddFeedPullService;
    oddFeedCron: OddFeedCron;
    scheduler: Scheduler;
    logService: typeof logger;
    oddsFeedService: OddsFeedService;
    delayHandlingService: DelayHandlingService;
    currentEventService: CurrentEventService;
    eventCleanerService: EventCleanerService;
    gameFlowService: GameFlowService;
    videoStreamingService: VideoStreamingService;
    inGameConsumer: InGameConsumer;
    gameBoardcastService: GameBroadcastService;
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

export function registerContainer(container: AwilixContainer<OddFeedDataContainer>) {
    container.register({
        oddFeedEventSource: asClass(OddFeedEventSource).singleton(),
        oddFeedScheduler: asClass(OddFeedScheduler).singleton(),
        oddFeedStore: asClass(OddFeedStore).singleton().disposer((service) => service.dispose()),
        oddFeedPullService: asClass(OddFeedPullService).singleton(),
        scheduler: asClass(Scheduler).singleton().disposer((service) => service.dispose()),
        oddFeedCron: asClass(OddFeedCron).singleton(),
    });

    container.register({
        delayHandlingService: asClass(DelayHandlingService).singleton().disposer((service) => service.dispose()),
    });

    container.register({
        gameFlowService: asFunction(
            (cradle) => new GameFlowService({
                featureDebugService: lazy(() => cradle.featureDebugService),
                oddFeedEventSource: cradle.oddFeedEventSource,
                scheduler: cradle.scheduler,
                delayHandlingService: cradle.delayHandlingService,
                gameBoardcastService: cradle.gameBoardcastService,
            }),
        ).singleton().proxy().disposer((service) => service.dispose()),
        featureDebugService: asFunction(
            (cradle) => new FeatureDebugService({
                gameFlowService: lazy(() => cradle.gameFlowService),
            }),
        ).singleton().proxy(),
    });
    
    container.register({
        currentEventService: asClass(CurrentEventService).singleton().disposer((service) => service.dispose()),
        eventCleanerService: asClass(EventCleanerService).singleton().disposer((service) => service.dispose()),
        videoStreamingService: asClass(VideoStreamingService).singleton().disposer((service) => service.dispose()),
        inGameConsumer: asClass(InGameConsumer).singleton(),
        gameBoardcastService: asClass(GameBroadcastService).singleton(),
        liveScoreService: asClass(LiveScoreService).singleton().proxy().disposer((service) => service.dispose()),
        resultService: asClass(ResultService).singleton().disposer((service) => service.dispose()),
        commentatorVoiceService: asClass(CommentatorVoiceService).singleton().disposer((service) => service.dispose()),
        introService: asClass(IntroService).singleton().disposer((service) => service.dispose()),
        teamNameService: asClass(TeamNameService).singleton().disposer((service) => service.dispose()),
    });

    return container;
}

export function initContainer(container: AwilixContainer<OddFeedDataContainer>) {
    container.resolve("delayHandlingService").initEvent();
    container.resolve("currentEventService").initEvent();
    container.resolve("oddFeedStore").initEvent();
    container.resolve("eventCleanerService").initEvent();
    container.resolve("gameFlowService").initEvent();
    container.resolve("videoStreamingService").initEvent();
    container.resolve("liveScoreService").initEvent();
    container.resolve("resultService").initEvent();
    container.resolve("commentatorVoiceService").initEvent();
    container.resolve("introService").initEvent();
    container.resolve("teamNameService").initEvent();
    container.resolve("oddFeedCron").start();
}