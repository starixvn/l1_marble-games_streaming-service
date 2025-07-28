import { logger } from "sc-common";
import { AppContainer, Event, GoalInfoData } from "../types";
import { OddsFeedService } from "./odds-feed-service";
import cron from "cron";
import { JobScheduler } from "./job-scheduler";
import { idHelper } from "../helpers";
import { EventSchedulerService } from "./event-scheduler-service";
import { EventManager } from "../stores/event-manager";

export class EventManagementService {
  private readonly oddsFeedService: OddsFeedService;
  private readonly logService: typeof logger;
  private readonly jobScheduler: JobScheduler;
  private readonly eventSchedulerService: EventSchedulerService;
  private readonly eventManager: EventManager;

  constructor(container: AppContainer) {
    this.oddsFeedService = container.oddsFeedService;
    this.logService = container.logService;
    this.jobScheduler = container.jobScheduler;
    this.eventSchedulerService = container.eventSchedulerService;
    this.eventManager = container.eventManager;
  }

  async start() {
    await this.initializeCurrentEventsForAllGames();

    // immediately schedule next events
    this.schedule();

    // schedule cron job to schedule next events every 30 seconds
    this.scheduleNextEventsCron();
  }

  scheduleNextEventsCron() {
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

  async schedule() {
    const nextEventIDs = await this.getNextEventIDsForEachGame();

    this.eventSchedulerService.scheduleEvents(Object.values(nextEventIDs));
  }

  async initializeCurrentEventsForAllGames() {
    const currentEventIDs = await this.getCurrentEventIDsOfAllGames();

    currentEventIDs.forEach((eventID) => {
      this.initializeCurrentEvent(eventID);
    });
  }

  async initializeCurrentEvent(eventID: number) {
    const updateEvent = await this.oddsFeedService.getEventDetailsWithRetry(eventID);
    const gameId = idHelper.extractGameId(eventID);

    if (!updateEvent) {
      this.logService.logError(`Event ${eventID} not found`);
      console.error(`Event ${eventID} not found`);
      return;
    }

    this.eventManager.initializeCurrentEvent(updateEvent);

    await this.initializeGoalInfoForGame(gameId);

    this.eventManager.initializePhaseForCurrentEvent(eventID);

    this.eventSchedulerService.scheduleEventDetails(updateEvent);

    this.eventManager.initializeLiveScoresForCurrentEvent(gameId);
  }

  async initializeGoalInfoForGame(gameId: string) {
    const currentEvent = this.eventManager.getCurrentEventForGame(gameId);
    const goalInfos = [];
    for (const eventDetail of currentEvent.eventDetails) {
      if (eventDetail.goalInfo) {
        const goalInfo = await this.oddsFeedService.getGoalInfo(eventDetail.goalInfo);
        goalInfos.push(goalInfo);
      } else {
        goalInfos.push(null);
      }
    }

    this.eventManager.initializeGoalInfoForCurrentEvent(gameId, goalInfos);
  }

  async getUpcomingEventIDs() {
    const upcomingEvents = await this.oddsFeedService.getScheduleWithRetry();
    return upcomingEvents.map((event) => event.eventID);
  }

  async getNextEventIDsForEachGame() {
    const allUpComingEvents = await this.oddsFeedService.getScheduleWithRetry();

    const nextEvents = allUpComingEvents.reduce((events: Record<string, number>, event) => {
      const gameId = idHelper.extractGameId(event.eventID);
      if (!events[gameId] || event.eventID < events[gameId]) {
        events[gameId] = event.eventID;
      }
      return events;
    }, {});

    return nextEvents;
  }

  async getCurrentEventIDsOfAllGames(): Promise<number[]> {
    const nextEventIDs = await this.getNextEventIDsForEachGame();

    const currentEventIDs = Object.values(nextEventIDs).map((eventID) => {
      const roundId = idHelper.extractRoundId(eventID);
      return roundId > 1 ? eventID - 1 : eventID;
    });

    return currentEventIDs;
  }

  cleanup() {
    this.jobScheduler.stopAll();
  }
}
