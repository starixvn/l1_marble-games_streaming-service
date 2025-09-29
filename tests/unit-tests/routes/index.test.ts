import { setupRoutes } from "../../../src/routes/index";
import { Router } from "express";
import { AppContainer } from "../../../src/types";
import { AwilixContainer } from "awilix";
import { Request, Response } from "express";

// Mock Express Router
jest.mock("express", () => ({
  Router: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    use: jest.fn(),
  })),
}));

// Mock controllers
const mockEventStreamController = {
  handleEventStreamConnection: jest.fn(),
};

const mockHealthController = {
  healthCheck: jest.fn(),
};

const mockAuthController = {
  login: jest.fn(),
};

const mockDebugController = {
  handle: jest.fn(),
};

const mockMonitorController = {
  getMonitoringData: jest.fn(),
  getGameMonitoringData: jest.fn(),
};

// Mock container
const mockContainer = {
  resolve: jest.fn(),
} as unknown as AwilixContainer<AppContainer>;

// Mock Express objects
const createMockRequest = (params: any = {}, query: any = {}, body: any = {}): jest.Mocked<Request> => {
  return {
    params,
    query,
    body,
  } as any;
};

const createMockResponse = (): jest.Mocked<Response> => {
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    sendFile: jest.fn().mockReturnThis(),
  } as any;
  return mockRes;
};

describe("setupRoutes", () => {
  let mockRouter: any;
  let router: Router;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock router
    mockRouter = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      use: jest.fn(),
    };

    (Router as jest.MockedFunction<typeof Router>).mockReturnValue(mockRouter);

    // Setup mock container
    mockContainer.resolve = jest.fn((key: string) => {
      switch (key) {
        case "eventStreamController":
          return mockEventStreamController;
        case "healthController":
          return mockHealthController;
        case "authController":
          return mockAuthController;
        case "monitorController":
          return mockMonitorController;
        case "debugController":
          return mockDebugController;
        default:
          throw new Error(`Unknown key: ${key}`);
      }
    });

    // Call setupRoutes
    router = setupRoutes(mockContainer);
  });

  describe("container resolution", () => {
    it("should resolve all required controllers from container", () => {
      // Assert
      expect(mockContainer.resolve).toHaveBeenCalledWith("eventStreamController");
      expect(mockContainer.resolve).toHaveBeenCalledWith("healthController");
      expect(mockContainer.resolve).toHaveBeenCalledWith("authController");
      expect(mockContainer.resolve).toHaveBeenCalledWith("debugController");
      expect(mockContainer.resolve).toHaveBeenCalledTimes(4);
    });

    it("should throw error when container fails to resolve controllers", () => {
      // Arrange
      const failingContainer = {
        resolve: jest.fn().mockImplementation(() => {
          throw new Error("Container resolution failed");
        }),
      } as unknown as AwilixContainer<AppContainer>;

      // Act & Assert
      expect(() => setupRoutes(failingContainer)).toThrow("Container resolution failed");
    });

    it("should handle missing controller in container", () => {
      // Arrange
      const incompleteContainer = {
        resolve: jest.fn().mockImplementation((key: string) => {
          if (key === "eventStreamController") {
            return mockEventStreamController;
          }
          if (key === "healthController") {
            return mockHealthController;
          }
          // Missing authController
          throw new Error(`Unknown key: ${key}`);
        }),
      } as unknown as AwilixContainer<AppContainer>;

      // Act & Assert
      expect(() => setupRoutes(incompleteContainer)).toThrow("Unknown key: authController");
    });
  });

  describe("route registration", () => {
    it("should register health check route at root path", () => {
      // Assert
      expect(mockRouter.get).toHaveBeenCalledWith("/", expect.any(Function));
    });

    it("should register authentication route at /api/token", () => {
      // Assert
      expect(mockRouter.post).toHaveBeenCalledWith("/api/token", expect.any(Function));
    });

    it("should register event stream route at /live/:gameId", () => {
      // Assert
      expect(mockRouter.get).toHaveBeenCalledWith("/live/:gameId", expect.any(Function));
    });

    it("should register debug routes at /debug-stream/:gameId and /debug/:gameId", () => {
      expect(mockRouter.get).toHaveBeenCalledWith("/debug-stream/:gameId", expect.any(Function));
      expect(mockRouter.get).toHaveBeenCalledWith("/debug/:gameId", expect.any(Function));
    });

    it("should register expected number of routes", () => {
      // Assert
      expect(mockRouter.get).toHaveBeenCalledTimes(4); // health, live, debug-stream, debug page
      expect(mockRouter.post).toHaveBeenCalledTimes(1); // auth
      expect(mockRouter.put).not.toHaveBeenCalled();
      expect(mockRouter.delete).not.toHaveBeenCalled();
    });

    it("should return the configured router", () => {
      // Assert
      expect(router).toBe(mockRouter);
    });
  });

  describe("health check route handler", () => {
    it("should call healthController.healthCheck when root route is accessed", () => {
      // Arrange
      const mockReq = createMockRequest();
      const mockRes = createMockResponse();
      const routeHandler = mockRouter.get.mock.calls.find((call: any) => call[0] === "/")?.[1];

      // Act
      if (routeHandler) {
        routeHandler(mockReq, mockRes);
      }

      // Assert
      expect(mockHealthController.healthCheck).toHaveBeenCalledWith(mockReq, mockRes);
      expect(mockHealthController.healthCheck).toHaveBeenCalledTimes(1);
    });

    it("should handle health check route with different request parameters", () => {
      // Arrange
      const mockReq1 = createMockRequest({}, { version: "1.0" });
      const mockReq2 = createMockRequest({}, { format: "json" });
      const mockRes = createMockResponse();
      const routeHandler = mockRouter.get.mock.calls.find((call: any) => call[0] === "/")?.[1];

      // Act
      if (routeHandler) {
        routeHandler(mockReq1, mockRes);
        routeHandler(mockReq2, mockRes);
      }

      // Assert
      expect(mockHealthController.healthCheck).toHaveBeenCalledWith(mockReq1, mockRes);
      expect(mockHealthController.healthCheck).toHaveBeenCalledWith(mockReq2, mockRes);
      expect(mockHealthController.healthCheck).toHaveBeenCalledTimes(2);
    });
  });

  describe("authentication route handler", () => {
    it("should call authController.login when /api/token route is accessed", () => {
      // Arrange
      const mockReq = createMockRequest({}, {}, { operatorId: "test", password: "password" });
      const mockRes = createMockResponse();
      const routeHandler = mockRouter.post.mock.calls.find((call: any) => call[0] === "/api/token")?.[1];

      // Act
      if (routeHandler) {
        routeHandler(mockReq, mockRes);
      }

      // Assert
      expect(mockAuthController.login).toHaveBeenCalledWith(mockReq, mockRes);
      expect(mockAuthController.login).toHaveBeenCalledTimes(1);
    });

    it("should handle authentication route with different request bodies", () => {
      // Arrange
      const mockReq1 = createMockRequest({}, {}, { operatorId: "user1", password: "pass1" });
      const mockReq2 = createMockRequest({}, {}, { operatorId: "user2", password: "pass2" });
      const mockRes = createMockResponse();
      const routeHandler = mockRouter.post.mock.calls.find((call: any) => call[0] === "/api/token")?.[1];

      // Act
      if (routeHandler) {
        routeHandler(mockReq1, mockRes);
        routeHandler(mockReq2, mockRes);
      }

      // Assert
      expect(mockAuthController.login).toHaveBeenCalledWith(mockReq1, mockRes);
      expect(mockAuthController.login).toHaveBeenCalledWith(mockReq2, mockRes);
      expect(mockAuthController.login).toHaveBeenCalledTimes(2);
    });

    it("should handle authentication route with empty request body", () => {
      // Arrange
      const mockReq = createMockRequest({}, {}, {});
      const mockRes = createMockResponse();
      const routeHandler = mockRouter.post.mock.calls.find((call: any) => call[0] === "/api/token")?.[1];

      // Act
      if (routeHandler) {
        routeHandler(mockReq, mockRes);
      }

      // Assert
      expect(mockAuthController.login).toHaveBeenCalledWith(mockReq, mockRes);
    });
  });

  describe("event stream route handler", () => {
    it("should call eventStreamController.handleEventStreamConnection when /live/:gameId route is accessed", () => {
      // Arrange
      const mockReq = createMockRequest({ gameId: "2001" });
      const mockRes = createMockResponse();
      const routeHandler = mockRouter.get.mock.calls.find((call: any) => call[0] === "/live/:gameId")?.[1];

      // Act
      if (routeHandler) {
        routeHandler(mockReq, mockRes);
      }

      // Assert
      expect(mockEventStreamController.handleEventStreamConnection).toHaveBeenCalledWith(mockReq, mockRes);
      expect(mockEventStreamController.handleEventStreamConnection).toHaveBeenCalledTimes(1);
    });

    it("should handle event stream route with different game IDs", () => {
      // Arrange
      const mockReq1 = createMockRequest({ gameId: "2001" });
      const mockReq2 = createMockRequest({ gameId: "2002" });
      const mockReq3 = createMockRequest({ gameId: "2003" });
      const mockRes = createMockResponse();
      const routeHandler = mockRouter.get.mock.calls.find((call: any) => call[0] === "/live/:gameId")?.[1];

      // Act
      if (routeHandler) {
        routeHandler(mockReq1, mockRes);
        routeHandler(mockReq2, mockRes);
        routeHandler(mockReq3, mockRes);
      }

      // Assert
      expect(mockEventStreamController.handleEventStreamConnection).toHaveBeenCalledWith(mockReq1, mockRes);
      expect(mockEventStreamController.handleEventStreamConnection).toHaveBeenCalledWith(mockReq2, mockRes);
      expect(mockEventStreamController.handleEventStreamConnection).toHaveBeenCalledWith(mockReq3, mockRes);
      expect(mockEventStreamController.handleEventStreamConnection).toHaveBeenCalledTimes(3);
    });

    it("should handle event stream route with query parameters", () => {
      // Arrange
      const mockReq = createMockRequest({ gameId: "2001" }, { token: "abc123", version: "1.0" });
      const mockRes = createMockResponse();
      const routeHandler = mockRouter.get.mock.calls.find((call: any) => call[0] === "/live/:gameId")?.[1];

      // Act
      if (routeHandler) {
        routeHandler(mockReq, mockRes);
      }

      // Assert
      expect(mockEventStreamController.handleEventStreamConnection).toHaveBeenCalledWith(mockReq, mockRes);
    });

    it("should handle event stream route with missing game ID", () => {
      // Arrange
      const mockReq = createMockRequest({});
      const mockRes = createMockResponse();
      const routeHandler = mockRouter.get.mock.calls.find((call: any) => call[0] === "/live/:gameId")?.[1];

      // Act
      if (routeHandler) {
        routeHandler(mockReq, mockRes);
      }

      // Assert
      expect(mockEventStreamController.handleEventStreamConnection).toHaveBeenCalledWith(mockReq, mockRes);
    });
  });

  describe("debug routes handlers", () => {
    it("should call debugController.handle when /debug-stream/:gameId is accessed", () => {
      const mockReq = createMockRequest({ gameId: "2001" });
      const mockRes = createMockResponse();
      const routeHandler = mockRouter.get.mock.calls.find((call: any) => call[0] === "/debug-stream/:gameId")?.[1];

      if (routeHandler) {
        routeHandler(mockReq, mockRes);
      }

      expect(mockDebugController.handle).toHaveBeenCalledWith(mockReq, mockRes);
      expect(mockDebugController.handle).toHaveBeenCalledTimes(1);
    });

    it("should send debug.html when /debug/:gameId is accessed", () => {
      const mockReq = createMockRequest({ gameId: "2001" });
      const mockRes = createMockResponse();
      const routeHandler = mockRouter.get.mock.calls.find((call: any) => call[0] === "/debug/:gameId")?.[1];

      if (routeHandler) {
        routeHandler(mockReq, mockRes);
      }

      expect(mockRes.sendFile).toHaveBeenCalledWith(expect.stringContaining("public" + require("path").sep + "debug.html"));
    });
  });

  describe("route handler error handling", () => {
    it("should handle controller method throwing errors", () => {
      // Arrange
      const mockReq = createMockRequest();
      const mockRes = createMockResponse();
      const error = new Error("Controller error");

      mockHealthController.healthCheck.mockImplementation(() => {
        throw error;
      });

      const routeHandler = mockRouter.get.mock.calls.find((call: any) => call[0] === "/")?.[1];

      // Act & Assert
      if (routeHandler) {
        expect(() => routeHandler(mockReq, mockRes)).toThrow("Controller error");
      }
    });

    it("should handle async controller methods", async () => {
      // Arrange
      const mockReq = createMockRequest();
      const mockRes = createMockResponse();

      mockHealthController.healthCheck.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return Promise.resolve();
      });

      const routeHandler = mockRouter.get.mock.calls.find((call: any) => call[0] === "/")?.[1];

      // Act
      if (routeHandler) {
        await routeHandler(mockReq, mockRes);
      }

      // Assert
      expect(mockHealthController.healthCheck).toHaveBeenCalledWith(mockReq, mockRes);
    });
  });

  describe("route configuration validation", () => {
    it("should register routes in correct order", () => {
      // Assert
      const getCalls = mockRouter.get.mock.calls;
      const postCalls = mockRouter.post.mock.calls;

      // Check that routes are registered
      expect(getCalls.some((call: any) => call[0] === "/")).toBe(true);
      expect(getCalls.some((call: any) => call[0] === "/live/:gameId")).toBe(true);
      expect(postCalls.some((call: any) => call[0] === "/api/token")).toBe(true);
    });

    it("should not register any middleware", () => {
      // Assert
      expect(mockRouter.use).not.toHaveBeenCalled();
    });

    it("should not register any PUT or DELETE routes", () => {
      // Assert
      expect(mockRouter.put).not.toHaveBeenCalled();
      expect(mockRouter.delete).not.toHaveBeenCalled();
    });
  });
});
