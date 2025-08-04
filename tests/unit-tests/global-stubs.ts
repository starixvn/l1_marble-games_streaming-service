import { logger } from "sc-common";
import { AppContainer } from "../../src/types";
import { stub } from "jest-auto-stub";
import { EventStore } from "../../src/stores/event-store";
import { EventManager } from "../../src/stores/event-manager";
import { OddsFeedService } from "../../src/services/odds-feed-service";
import { EventStreamService } from "../../src/services/event-stream-service";
import { EventSchedulerService } from "../../src/services/event-scheduler-service";
import { EventManagementService } from "../../src/services/event-management-service";
import { ClientManager } from "../../src/managers/client-manager";
import { JobScheduler } from "../../src/services/job-scheduler";
import { AuthenticateService } from "../../src/services/authenticate-service";
import { AuthController } from "../../src/controllers/auth-controller";
import { EventStreamController } from "../../src/controllers/event-stream-controller";
import { HealthController } from "../../src/controllers/health-controller";

// Mock logger
const mockLogService: typeof logger = {
  log: jest.fn(),
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarning: jest.fn(),
} as unknown as typeof logger;

const mockEventStore = stub<EventStore>();
const mockEventManager = stub<EventManager>();
const mockOddsFeedService = stub<OddsFeedService>();
const mockEventStreamService = stub<EventStreamService>();
const mockEventSchedulerService = stub<EventSchedulerService>();
const mockEventManagementService = stub<EventManagementService>();
const mockClientManager = stub<ClientManager>();
const mockJobScheduler = stub<JobScheduler>();
const mockAuthenticateService = stub<AuthenticateService>();
const mockAuthController = stub<AuthController>();
const mockEventStreamController = stub<EventStreamController>();
const mockHealthController = stub<HealthController>();

const mockContainer: AppContainer = {
  logService: mockLogService,
  eventStore: mockEventStore,
  eventManager: mockEventManager,
  oddsFeedService: mockOddsFeedService,
  eventStreamService: mockEventStreamService,
  eventSchedulerService: mockEventSchedulerService,
  eventManagementService: mockEventManagementService,
  clientManager: mockClientManager,
  jobScheduler: mockJobScheduler,
  authenticateService: mockAuthenticateService,
  authController: mockAuthController,
  eventStreamController: mockEventStreamController,
  healthController: mockHealthController,
};

export { mockContainer };
