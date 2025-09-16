import { asClass, AwilixContainer } from "awilix";
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

}

export function registerContainer(container: AwilixContainer<OddFeedDataContainer>) {
    container.register({
        oddFeedEventSource: asClass(OddFeedEventSource).singleton(),
        oddFeedScheduler: asClass(OddFeedScheduler).singleton(),
        oddFeedStore: asClass(OddFeedStore).singleton().disposer((service) => service.dispose()),
        oddFeedPullService: asClass(OddFeedPullService).singleton(),
        scheduler: asClass(Scheduler).singleton().disposer((service) => service.dispose()),
        oddFeedCron: asClass(OddFeedCron).singleton(),
        delayHandlingService: asClass(DelayHandlingService).singleton().disposer((service) => service.dispose()),
        currentEventService: asClass(CurrentEventService).singleton().disposer((service) => service.dispose()),
        eventCleanerService: asClass(EventCleanerService).singleton().disposer((service) => service.dispose()),
        gameFlowService: asClass(GameFlowService).singleton().disposer((service) => service.dispose()),
        videoStreamingService: asClass(VideoStreamingService).singleton().disposer((service) => service.dispose()),
        inGameConsumer: asClass(InGameConsumer).singleton(),
        gameBoardcastService: asClass(GameBroadcastService).singleton(),
    });
}

export function initContainer(container: AwilixContainer<OddFeedDataContainer>) {
    container.resolve("delayHandlingService").initEvent();
    container.resolve("currentEventService").initEvent();
    container.resolve("oddFeedStore").initEvent();
    container.resolve("eventCleanerService").initEvent();
    container.resolve("gameFlowService").initEvent();
    container.resolve("videoStreamingService").initEvent();
    container.resolve("oddFeedCron").start();
}