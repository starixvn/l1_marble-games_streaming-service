import { logger } from "sc-common";
import cron from "cron";
import { AppContainer } from "../../types";
import { OddFeedPullService } from "./odd-feed-pull-service";
import { OddFeedScheduler } from "./odd-feed-scheduler";

interface OddFeedCronContainer extends AppContainer {
    logService: typeof logger;
    oddFeedPullService: OddFeedPullService;
    oddFeedScheduler: OddFeedScheduler;
}

export class OddFeedCron {

    constructor(container: OddFeedCronContainer) {
        this.logService = container.logService;
        this.oddFeedPullService = container.oddFeedPullService;
        this.oddFeedScheduler = container.oddFeedScheduler;
    }

    private readonly logService: typeof logger;
    private readonly oddFeedPullService: OddFeedPullService;
    private readonly oddFeedScheduler: OddFeedScheduler;
    
    public async start() {
        this.schedule();
        this.scheduleNextEventsCron();
      }
    
    public scheduleNextEventsCron() {
        const cronExpression = "*/30 * * * * *";

        const job = new cron.CronJob(
            cronExpression,
            () => this.schedule().catch(this.logService.logError),
            () => {
            this.logService.logError("Cron job unexpectedly stopped because some other tasks halt it.");
            job.start();
            }
        );

        job.start();
    }
    
      public async schedule() {
        const upcomingEvents = await this.oddFeedPullService.pullUpcoming();
        upcomingEvents.forEach( async (event) => {
            const eventWithDetails = await this.oddFeedPullService.pullEventWithEventDetails(event.eventID);
            if (!eventWithDetails) {
                return;
            }
            this.oddFeedScheduler.scheduleEvent(eventWithDetails);
        });
    }
}