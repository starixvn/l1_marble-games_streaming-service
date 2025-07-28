import { AuthController } from "../controllers/auth-controller";
import { HealthController } from "../controllers/health-controller";
import { EventStreamController } from "../controllers/event-stream-controller";
import { AuthenticateService } from "../services/authenticate-service";
import { OddsFeedService } from "../services/odds-feed-service";
import { EventStreamService } from "../services/event-stream-service";
import { logger } from "sc-common";
import { EventManagementService } from "../services/event-management-service";
import { EventStore } from "../stores/event-store";
import { JobScheduler } from "../services/job-scheduler";
import { Response } from "express";
import { EventSchedulerService } from "../services/event-scheduler-service";
import { EventManager } from "../stores/event-manager";

export interface AppContainer {
  eventStreamService: EventStreamService;
  authenticateService: AuthenticateService;
  oddsFeedService: OddsFeedService;
  logService: typeof logger;
  authController: AuthController;
  eventStreamController: EventStreamController;
  healthController: HealthController;
  eventManagementService: EventManagementService;
  eventStore: EventStore;
  jobScheduler: JobScheduler;
  eventSchedulerService: EventSchedulerService;
  eventManager: EventManager;
}

export type Event = {
  eventID: number;
  eventNameAKey: string;
  eventNameBKey: string;
  theme?: string;
  scheduleStartTs: string;
  productCode: string;
  productTypeKey: string;
  eventDetails: EventDetail[];
};

export type EventDetail = {
  eventID: number;
  oddsAvailableTs: string;
  scheduleStartTs: string;
  resultsAvailableTs: string;
  hasResults: boolean;
  goalInfo: string;
  playlist: string;
  result: string;
  markets: any;
};

export type GoalInfoData = {
  frame: number[];
  timeLine: number[];
  result: string[];
};

export type EventStreamState = Event & {
  currentEventDetailIndex: number;
  liveScores: string[];
  goalInfos: (GoalInfoData | null)[];
  currentPhase: JobName;
};

export interface Video {
  url: string;
  length: number;
  startTime: Date;
  gameId: string;
}

export type EventDetailStreamPayload = {
  playlist: string;
  videoLiveTimeMs: number;
  videoLength: number;
  result: string;
};

export interface EventStreamPayload {
  gameId: string;
  eventId: number;
  currentIndex: number;
  updatedIndex: number;
  eventDetails: EventDetailStreamPayload[];
  liveScores: string[];
  goalInfos: (GoalInfoData | null)[];
  matchLiveTimeMs: number;
  currentPhase: JobName;
  message: string;
}

export enum JobName {
  ScheduleEvent = "ScheduleEvent",
  UpdateOdds = "UpdateOdds",
  UpdateVideoInfo = "UpdateVideoInfo",
  UpdateGoalInfo = "UpdateGoalInfo",
  UpdateResult = "UpdateResult",
}

export type StreamingClient = { res: Response; gameId: string };

export type EventValidator = (data: Event) => boolean;
