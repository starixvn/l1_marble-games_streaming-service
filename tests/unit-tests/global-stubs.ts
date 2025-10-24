import { logger } from "sc-common";
import { AppContainer } from "../../src/types";
import { stub } from "jest-mock-extended";
import { OddsFeedService } from "odds-feed-client";
import { EventStreamService } from "../../src/services/event-stream-service";
import { ClientManager } from "../../src/managers/client-manager";
import { AuthenticateService } from "../../src/services/authenticate-service";
import { AuthController } from "../../src/controllers/auth-controller";
import { EventStreamController } from "../../src/controllers/event-stream-controller";
import { HealthController } from "../../src/controllers/health-controller";
import { DebugController } from "../../src/controllers/debug-controller";
import { ReplayController } from "../../src/controllers/replay-controller";

// Mock logger
const mockLogService: typeof logger = {
  log: jest.fn(),
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarning: jest.fn(),
} as unknown as typeof logger;

const mockOddsFeedService = stub<OddsFeedService>();
const mockEventStreamService = stub<EventStreamService>();
const mockClientManager = stub<ClientManager>();
const mockAuthenticateService = stub<AuthenticateService>();
const mockAuthController = stub<AuthController>();
const mockEventStreamController = stub<EventStreamController>();
const mockHealthController = stub<HealthController>();
const mockDebugController = stub<DebugController>();
const mockReplayController = stub<ReplayController>();

const mockContainer: AppContainer = {
  logService: mockLogService,
  oddsFeedService: mockOddsFeedService,
  eventStreamService: mockEventStreamService,
  clientManager: mockClientManager,
  authenticateService: mockAuthenticateService,
  authController: mockAuthController,
  eventStreamController: mockEventStreamController,
  healthController: mockHealthController,
  debugController: mockDebugController,
  replayController: mockReplayController,
};

export { mockContainer };
