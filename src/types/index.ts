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
  currentEventDetailIndex: number;
};

export type EventDetail = {
  eventID: number;
  oddsAvailableTs: string;
  scheduleStartTs: string;
  resultsAvailableTs: string;
  hasResults: boolean;
  goalInfo: string;
  playlist: string;
  result: any;
  selections: any;
};
