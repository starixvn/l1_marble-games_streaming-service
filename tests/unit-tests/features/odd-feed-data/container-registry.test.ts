import { createContainer, AwilixContainer, asValue } from "awilix";
import { registerOddFeedData, OddFeedDataContainer } from "../../../../src/features/odd-feed-data/container-registry";
import { OddFeedEventSource } from "../../../../src/features/odd-feed-data/odd-feed-event-source";
import { OddFeedPullService } from "../../../../src/features/odd-feed-data/odd-feed-pull-service";
import { OddFeedScheduler } from "../../../../src/features/odd-feed-data/odd-feed-scheduler";
import { OddFeedStore } from "../../../../src/features/odd-feed-data/odd-feed-store";
import { OddFeedCron } from "../../../../src/features/odd-feed-data/odd-feed-cron";
import { SchedulerConsumer } from "../../../../src/features/scheduler/scheduler";

// Mock external dependencies to prevent side effects
jest.mock("sc-common", () => ({
  logger: {
    log: jest.fn(),
    logError: jest.fn(),
    logInfo: jest.fn(),
    logWarning: jest.fn(),
    start: jest.fn(),
    setTag: jest.fn(),
  },
}));

jest.mock("../../../../src/services/odds-feed-service", () => ({
  OddsFeedService: jest.fn().mockImplementation(() => ({
    logService: jest.fn(),
    token: "mock-token",
    getAndUpdateOddsFeedToken: jest.fn(),
    getSchedule: jest.fn(),
  })),
}));

jest.mock("../../../../src/helpers", () => ({
  idHelper: {
    generateId: jest.fn(() => "test-id"),
  },
}));

// Mock cron to prevent actual cron jobs
jest.mock("cron", () => ({
  CronJob: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
  })),
}));

describe("OddFeedData Container Registry", () => {
  let container: AwilixContainer<OddFeedDataContainer>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Arrange - Create a fresh container for each test
    const baseContainer = createContainer({
      injectionMode: "PROXY",
    });

    // Register required dependencies
    baseContainer.register({
      logService: asValue(require("sc-common").logger),
      oddsFeedService: asValue({
        getSchedule: jest.fn(),
        getEventDetails: jest.fn(),
        getGoalInfo: jest.fn(),
        getInGameEvent: jest.fn(),
      }),
    });

    // Register the odd feed data services
    registerOddFeedData(baseContainer);
    
    container = baseContainer as AwilixContainer<OddFeedDataContainer>;
  });

  afterEach(() => {
    if (container) {
      container.dispose();
    }
  });

  describe("registerOddFeedData", () => {
    it("should register all services as singletons with correct types", () => {
      // Assert - All services should be registered and resolvable
      expect(container.hasRegistration("oddFeedEventSource")).toBe(true);
      expect(container.hasRegistration("oddFeedScheduler")).toBe(true);
      expect(container.hasRegistration("oddFeedStore")).toBe(true);
      expect(container.hasRegistration("oddFeedPullService")).toBe(true);
      expect(container.hasRegistration("oddFeedCron")).toBe(true);
      expect(container.hasRegistration("scheduler")).toBe(true);

      // Act - Resolve services
      const oddFeedEventSource = container.resolve("oddFeedEventSource");
      const oddFeedScheduler = container.resolve("oddFeedScheduler");
      const oddFeedStore = container.resolve("oddFeedStore");
      const oddFeedPullService = container.resolve("oddFeedPullService");
      const oddFeedCron = container.resolve("oddFeedCron");
      const scheduler = container.resolve("scheduler");

      // Assert - Correct types
      expect(oddFeedEventSource).toBeInstanceOf(OddFeedEventSource);
      expect(oddFeedScheduler).toBeInstanceOf(OddFeedScheduler);
      expect(oddFeedStore).toBeInstanceOf(OddFeedStore);
      expect(oddFeedPullService).toBeInstanceOf(OddFeedPullService);
      expect(oddFeedCron).toBeInstanceOf(OddFeedCron);
      expect(scheduler).toBeInstanceOf(SchedulerConsumer);

      // Assert - Singleton behavior
      expect(container.resolve("oddFeedStore")).toBe(oddFeedStore);
    });
  });
});