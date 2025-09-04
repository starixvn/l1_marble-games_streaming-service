import { logger } from "sc-common";
import { AppContainer } from "../types";
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
      return;
    }

    await this.eventManager.initializeCurrentEvent(updateEvent);
    await this.initializeGoalInfoForGame(gameId);
    await this.initializeInGameEventForGame(gameId);

    this.eventManager.initializePhaseForCurrentEvent(eventID);

    this.initializeLiveScoresForGame(gameId);

    this.eventSchedulerService.scheduleEventDetails(updateEvent);

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

  async initializeInGameEventForGame(gameId: string) {
    const currentEvent = this.eventManager.getCurrentEventForGame(gameId);
    const inGameEvents = [];
    for (const eventDetail of currentEvent.eventDetails) {
      if (eventDetail.inGameEventInfo) {
        const inGameEvent = await this.oddsFeedService.getInGameEvent(eventDetail.inGameEventInfo);
        inGameEvents.push(inGameEvent);
      } else {
        inGameEvents.push(null);
      }
    }

    this.eventManager.initializeInGameEventForCurrentEvent(gameId, inGameEvents);
  }

  async initializeLiveScoresForGame(gameId: string) {
    this.eventManager.initializeLiveScoresForCurrentEvent(gameId);

    const currentEvent = this.eventManager.getCurrentEventForGame(gameId);

    this.eventSchedulerService.scheduleUpdateGoalInfo(
      gameId,
      currentEvent.currentEventDetailIndex,
      currentEvent.goalInfos[currentEvent.currentEventDetailIndex],
    );
    this.eventSchedulerService.scheduleUpdateVoice(
      gameId,
      currentEvent.currentEventDetailIndex,
      currentEvent.inGameEvents?.[currentEvent.currentEventDetailIndex],
    );
  }

  async getUpcomingEventIDs() {
    const upcomingEvents = await this.oddsFeedService.getScheduleWithRetry();
    return upcomingEvents.map((event) => event.eventID);
  }

  async getNextEventIDsForEachGame() {
    const allUpComingEvents = await this.oddsFeedService.getScheduleWithRetry();

    return allUpComingEvents.reduce((events: Record<string, number>, event) => {
      const gameId = idHelper.extractGameId(event.eventID);
      if (!events[gameId] || event.eventID < events[gameId]) {
        events[gameId] = event.eventID;
      }
      return events;
    }, {});
  }

  async getCurrentEventIDsOfAllGames(): Promise<number[]> {
    const nextEventIDs = await this.getNextEventIDsForEachGame();

    return Object.values(nextEventIDs).map((eventID) => {
      const roundId = idHelper.extractRoundId(eventID);
      return roundId > 1 ? eventID - 1 : eventID;
    });
  }

  cleanup() {
    this.jobScheduler.stopAll();
  }

  getRemainingJobs(): string[] {
    return this.jobScheduler.getRemainingJobs();
  }

  getRemainingJobsForGame(gameId: string): string[] {
    return this.jobScheduler.getRemainingJobs().filter((job) => job.includes(`${gameId}_`));
  }
}
