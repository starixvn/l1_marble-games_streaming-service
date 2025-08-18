import { ClientManager } from "./../../src/managers/client-manager";
import { ContainerRegistry } from "../../src/container-registry";
import { AppContainer } from "../../src/types";
import { AwilixContainer } from "awilix";
import { EventStore } from "../../src/stores/event-store";
import { EventManager } from "../../src/stores/event-manager";
import { EventStreamService } from "../../src/services/event-stream-service";
import { AuthenticateService } from "../../src/services/authenticate-service";
import { OddsFeedService } from "../../src/services/odds-feed-service";
import { EventManagementService } from "../../src/services/event-management-service";
import { JobScheduler } from "../../src/services/job-scheduler";
import { EventSchedulerService } from "../../src/services/event-scheduler-service";
import { AuthController } from "../../src/controllers/auth-controller";
import { EventStreamController } from "../../src/controllers/event-stream-controller";
import { HealthController } from "../../src/controllers/health-controller";
import { logger } from "sc-common";

// Mock all services that might have async operations
jest.mock("sc-common", () => ({
  logger: {
    log: jest.fn(),
    logError: jest.fn(),
    logInfo: jest.fn(),
    logWarning: jest.fn(),
  },
}));

// Mock setTimeout to prevent hanging tests
jest.mock("timers", () => ({
  setTimeout: jest.fn((callback, delay) => {
    // Return a mock timeout ID
    return 12345 as any;
  }),
  clearTimeout: jest.fn(),
}));

describe("ContainerRegistry", () => {
  let containerRegistry: ContainerRegistry;
  let container: AwilixContainer<AppContainer>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    containerRegistry = new ContainerRegistry();
  });

  afterEach(() => {
    if (container) {
      // Stop all jobs before disposing to prevent hanging
      try {
        const clientManager = container.resolve("clientManager");
        if (clientManager && typeof clientManager.destroy === "function") {
          clientManager.destroy();
        }
      } catch (error) {
        // Ignore errors during cleanup
      }
      container.dispose();
    }
    jest.clearAllTimers();
  });

  describe("constructor", () => {
    it("should create a container with PROXY injection mode", () => {
      // Act
      const registry = new ContainerRegistry();

      // Assert
      expect(registry.container).toBeDefined();
      expect(registry.container.options.injectionMode).toBe("PROXY");
    });
  });

  describe("register", () => {
    beforeEach(() => {
      container = containerRegistry.register();
    });

    it("should register all stores as singletons", () => {
      // Assert
      expect(container.hasRegistration("eventStore")).toBe(true);
      expect(container.hasRegistration("eventManager")).toBe(true);
      expect(container.hasRegistration("clientManager")).toBe(true);

      // Verify they are singletons
      const eventStore1 = container.resolve("eventStore");
      const eventStore2 = container.resolve("eventStore");
      expect(eventStore1).toBe(eventStore2);

      const eventManager1 = container.resolve("eventManager");
      const eventManager2 = container.resolve("eventManager");
      expect(eventManager1).toBe(eventManager2);

      const clientManager1 = container.resolve("clientManager");
      const clientManager2 = container.resolve("clientManager");
      expect(clientManager1).toBe(clientManager2);
    });

    it("should register all services as singletons", () => {
      // Assert
      expect(container.hasRegistration("eventStreamService")).toBe(true);
      expect(container.hasRegistration("authenticateService")).toBe(true);
      expect(container.hasRegistration("oddsFeedService")).toBe(true);
      expect(container.hasRegistration("logService")).toBe(true);
      expect(container.hasRegistration("eventManagementService")).toBe(true);
      expect(container.hasRegistration("jobScheduler")).toBe(true);
      expect(container.hasRegistration("eventSchedulerService")).toBe(true);

      // Verify they are singletons
      const eventStreamService1 = container.resolve("eventStreamService");
      const eventStreamService2 = container.resolve("eventStreamService");
      expect(eventStreamService1).toBe(eventStreamService2);

      const authenticateService1 = container.resolve("authenticateService");
      const authenticateService2 = container.resolve("authenticateService");
      expect(authenticateService1).toBe(authenticateService2);
    });

    it("should register all controllers as singletons", () => {
      // Assert
      expect(container.hasRegistration("authController")).toBe(true);
      expect(container.hasRegistration("eventStreamController")).toBe(true);
      expect(container.hasRegistration("healthController")).toBe(true);

      // Verify they are singletons
      const authController1 = container.resolve("authController");
      const authController2 = container.resolve("authController");
      expect(authController1).toBe(authController2);

      const eventStreamController1 = container.resolve("eventStreamController");
      const eventStreamController2 = container.resolve("eventStreamController");
      expect(eventStreamController1).toBe(eventStreamController2);

      const healthController1 = container.resolve("healthController");
      const healthController2 = container.resolve("healthController");
      expect(healthController1).toBe(healthController2);
    });

    it("should register logService as a value", () => {
      // Act
      const logService = container.resolve("logService");

      // Assert
      expect(logService).toBe(logger);
    });

    it("should resolve all dependencies correctly", () => {
      // Act & Assert - This should not throw any errors
      expect(() => {
        container.resolve("eventStore");
        container.resolve("eventManager");
        container.resolve("clientManager");
        container.resolve("eventStreamService");
        container.resolve("authenticateService");
        container.resolve("oddsFeedService");
        container.resolve("logService");
        container.resolve("eventManagementService");
        container.resolve("jobScheduler");
        container.resolve("eventSchedulerService");
        container.resolve("authController");
        container.resolve("eventStreamController");
        container.resolve("healthController");
      }).not.toThrow();
    });

    it("should return the container instance", () => {
      // Assert
      expect(container).toBe(containerRegistry.container);
    });

    it("should create instances of correct types", () => {
      // Act
      const eventStore = container.resolve("eventStore");
      const eventManager = container.resolve("eventManager");
      const clientManager = container.resolve("clientManager");
      const eventStreamService = container.resolve("eventStreamService");
      const authenticateService = container.resolve("authenticateService");
      const oddsFeedService = container.resolve("oddsFeedService");
      const eventManagementService = container.resolve("eventManagementService");
      const jobScheduler = container.resolve("jobScheduler");
      const eventSchedulerService = container.resolve("eventSchedulerService");
      const authController = container.resolve("authController");
      const eventStreamController = container.resolve("eventStreamController");
      const healthController = container.resolve("healthController");

      // Assert
      expect(eventStore).toBeInstanceOf(EventStore);
      expect(eventManager).toBeInstanceOf(EventManager);
      expect(clientManager).toBeInstanceOf(ClientManager);
      expect(eventStreamService).toBeInstanceOf(EventStreamService);
      expect(authenticateService).toBeInstanceOf(AuthenticateService);
      expect(oddsFeedService).toBeInstanceOf(OddsFeedService);
      expect(eventManagementService).toBeInstanceOf(EventManagementService);
      expect(jobScheduler).toBeInstanceOf(JobScheduler);
      expect(eventSchedulerService).toBeInstanceOf(EventSchedulerService);
      expect(authController).toBeInstanceOf(AuthController);
      expect(eventStreamController).toBeInstanceOf(EventStreamController);
      expect(healthController).toBeInstanceOf(HealthController);
    });
  });

  describe("dependency injection", () => {
    beforeEach(() => {
      container = containerRegistry.register();
    });

    it("should inject dependencies into services correctly", () => {
      // Act
      const eventStreamService = container.resolve("eventStreamService");
      const eventManagementService = container.resolve("eventManagementService");
      const jobScheduler = container.resolve("jobScheduler");
      const eventSchedulerService = container.resolve("eventSchedulerService");

      // Assert - These services should have their dependencies injected
      expect(eventStreamService).toBeDefined();
      expect(eventManagementService).toBeDefined();
      expect(jobScheduler).toBeDefined();
      expect(eventSchedulerService).toBeDefined();
    });

    it("should inject dependencies into controllers correctly", () => {
      // Act
      const authController = container.resolve("authController");
      const eventStreamController = container.resolve("eventStreamController");
      const healthController = container.resolve("healthController");

      // Assert - These controllers should have their dependencies injected
      expect(authController).toBeDefined();
      expect(eventStreamController).toBeDefined();
      expect(healthController).toBeDefined();
    });
  });
});
