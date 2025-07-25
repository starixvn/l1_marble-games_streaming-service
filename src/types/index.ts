import { AuthController } from "../controllers/auth-controller";
import { HealthController } from "../controllers/health-controller";
import { EventStreamController } from "../controllers/event-stream-controller";
import { AuthenticateService } from "../services/authenticate-service";
import { OddsFeedService } from "../services/odds-feed-service";
import { EventStreamService } from "../services/event-stream-service";
import { logger } from "sc-common";
import { EventManagementService } from "../services/event-management-service";
import { EventState } from "../stores/event-state";
import { JobScheduler } from "../services/job-scheduler";
import { Response } from "express";
import { EventSchedulerService } from "../services/event-scheduler-service";
import { EventStateManager } from "../stores/event-state-manager";

export interface AppContainer {
  eventStreamService: EventStreamService;
  authenticateService: AuthenticateService;
  oddsFeedService: OddsFeedService;
  logService: typeof logger;
  authController: AuthController;
  eventStreamController: EventStreamController;
  healthController: HealthController;
  eventManagementService: EventManagementService;
  eventState: EventState;
  jobScheduler: JobScheduler;
  eventSchedulerService: EventSchedulerService;
  eventStateManager: EventStateManager;
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

export type EventStreamState = Event & {
  currentEventDetailIndex: number;
  liveScore: string;
  currentPhase: JobName;
};

export interface Video {
  url: string;
  length: number;
  startTime: Date;
  gameId: string;
}

export interface EventStreamPayload {
  gameId: string;
  eventId: number;
  eventDetailIndex: number;
  playlist: string;
  liveTimeMs: number;
  liveScore: string;
  videoLength: number;
  currentPhase: JobName;
  result: string;
  message: string;
}

export enum JobName {
  ScheduleEvent = "ScheduleEvent",
  UpdateOdds = "UpdateOdds",
  UpdateVideoInfo = "UpdateVideoInfo",
  UpdateResult = "UpdateResult",
}

export type StreamingClient = { res: Response; gameId: string };

export type EventValidator = (data: Event) => boolean;
