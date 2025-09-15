import { asClass, AwilixContainer } from "awilix";
import { OddFeedEventSource } from "./odd-feed-event-source";
import { OddFeedPullService } from "./odd-feed-pull-service";
import { OddFeedScheduler } from "./odd-feed-scheduler";
import { OddFeedStore } from "./odd-feed-store";
import { OddFeedCron } from "./odd-feed-cron";
import { SchedulerConsumer } from "../scheduler/scheduler";
import { logger } from "sc-common";
import { OddsFeedService } from "../../services/odds-feed-service";

export interface OddFeedDataContainer {
    oddFeedEventSource: OddFeedEventSource;
    oddFeedScheduler: OddFeedScheduler;
    oddFeedStore: OddFeedStore;
    oddFeedPullService: OddFeedPullService;
    oddFeedCron: OddFeedCron;
    scheduler: SchedulerConsumer;
    logService: typeof logger;
    oddsFeedService: OddsFeedService;
}

export function registerOddFeedData(container: AwilixContainer<OddFeedDataContainer>) {
    container.register({
        oddFeedEventSource: asClass(OddFeedEventSource).singleton(),
        oddFeedScheduler: asClass(OddFeedScheduler).singleton(),
        oddFeedStore: asClass(OddFeedStore).singleton(),
        oddFeedPullService: asClass(OddFeedPullService).singleton(),
        oddFeedCron: asClass(OddFeedCron).singleton(),
        scheduler: asClass(SchedulerConsumer).singleton(),
    });
}