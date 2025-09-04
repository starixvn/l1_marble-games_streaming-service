import { OddsFeedService } from "../../../src/services/odds-feed-service";
import { mockContainer } from "../global-stubs";
import { appConfigs } from "../../../src/app-configs";
import { retry } from "../../../src/helpers/retry-helper";
import { Event, EventValidator, GoalInfoData, InGameEvent, VoiceConfig } from "../../../src/types";

// Mock dependencies
jest.mock("../../../src/app-configs");
jest.mock("../../../src/helpers/retry-helper");
jest.mock("sc-common", () => ({
  logger: {
    logError: jest.fn(),
  },
}));

const mockRetry = retry as jest.MockedFunction<typeof retry>;
const mockFetch = jest.fn();

// Mock global fetch
global.fetch = mockFetch;

// Test data factories
const createMockEvent = (eventId: number, name: string = "Test Event"): Event => ({
  eventID: eventId,
  eventNameAKey: name,
  eventNameBKey: `${name} B`,
  scheduleStartTs: "2024-01-01T10:00:00Z",
  productCode: "SPORT",
  productTypeKey: "FOOTBALL",
  eventDetails: [],
});

const createMockGoalInfo = (): GoalInfoData => ({
  frame: [1, 2, 3],
  timeLine: [10, 20, 30],
  result: ["goal", "assist", "save"],
});

const createMockInGameEvent = (): InGameEvent => ({
  timeLine: [5, 15, 25],
  frame: [100, 200, 300],
  eventName: ["kick-off", "corner", "free-kick"],
});

const createMockVoiceConfig = (): VoiceConfig => ({
  "goal": {
    1000: {
      timeline: [0, 500, 1000],
      voice: ["Goal scored!", "What a shot!", "Amazing!"],
    },
    2000: {
      timeline: [0, 1000, 2000],
      voice: ["Two goals!", "Incredible!", "Fantastic!"],
    },
  },
  "assist": {
    500: {
      timeline: [0, 250, 500],
      voice: ["Great assist!", "Perfect pass!", "Teamwork!"],
    },
  },
});

const createMockEventValidator =
  (shouldValidate: boolean = true): EventValidator =>
  () =>
    shouldValidate;

describe("OddsFeedService", () => {
  let oddsFeedService: OddsFeedService;

  beforeEach(() => {
    jest.clearAllMocks();
    oddsFeedService = new OddsFeedService(mockContainer);

    // Mock appConfigs
    (appConfigs as any) = {
      oddsFeedAPI: {
        url: "https://api.oddsfeed.com",
        operatorId: "test-operator",
        password: "test-password",
      },
    };
  });

  describe("getAndUpdateOddsFeedToken", () => {
    it("should successfully get and update token", async () => {
      // Arrange
      const mockResponse = {
        json: jest.fn().mockResolvedValue({ access_token: "mock-token-123" }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Act
      const result = await oddsFeedService.getAndUpdateOddsFeedToken();

      // Assert
      expect(result).toBe("mock-token-123");
      expect(mockFetch).toHaveBeenCalledWith("https://api.oddsfeed.com/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          operatorId: "test-operator",
          password: "test-password",
        }),
      });
    });

    it("should handle fetch errors", async () => {
      // Arrange
      const fetchError = new Error("Network error");
      mockFetch.mockRejectedValue(fetchError);

      // Act & Assert
      await expect(oddsFeedService.getAndUpdateOddsFeedToken()).rejects.toThrow("Network error");
    });

    it("should handle invalid response format", async () => {
      // Arrange
      const mockResponse = {
        json: jest.fn().mockResolvedValue({ error: "Invalid credentials" }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Act
      const result = await oddsFeedService.getAndUpdateOddsFeedToken();

      // Assert
      expect(result).toBeUndefined();
    });

    it("should handle JSON parsing errors", async () => {
      // Arrange
      const mockResponse = {
        json: jest.fn().mockRejectedValue(new Error("Invalid JSON")),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Act & Assert
      await expect(oddsFeedService.getAndUpdateOddsFeedToken()).rejects.toThrow("Invalid JSON");
    });
  });

  describe("getSchedule (public method)", () => {
    it("should successfully get schedule with existing token", async () => {
      // Arrange
      const mockEvents = [createMockEvent(1, "Event 1"), createMockEvent(2, "Event 2")];
      const mockResponse = {
        status: 200,
        json: jest.fn().mockResolvedValue(mockEvents),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Set existing token
      jest.spyOn(oddsFeedService, "getAndUpdateOddsFeedToken").mockResolvedValue("mock-token-123");

      // Act
      const result = await oddsFeedService.getSchedule();

      // Assert
      expect(result).toEqual(mockEvents);
      expect(mockFetch).toHaveBeenCalledWith("https://api.oddsfeed.com/api/schedule", {
        method: "GET",
        headers: {
          Authorization: "Bearer mock-token-123",
        },
      });
    });

    it("should get new token when no token exists", async () => {
      // Arrange
      const mockTokenResponse = {
        json: jest.fn().mockResolvedValue({ access_token: "new-token-456" }),
      };
      const mockScheduleResponse = {
        status: 200,
        json: jest.fn().mockResolvedValue([createMockEvent(1)]),
      };
      mockFetch.mockResolvedValueOnce(mockTokenResponse).mockResolvedValueOnce(mockScheduleResponse);

      // Act
      const result = await oddsFeedService.getSchedule();

      // Assert
      expect(result).toEqual([createMockEvent(1)]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should handle 401 unauthorized and refresh token", async () => {
      // Arrange
      oddsFeedService["token"] = "mock-token-123";

      const mockUnauthorizedResponse = {
        status: 401,
        json: jest.fn().mockResolvedValue({ error: "Unauthorized" }),
      };
      const mockTokenResponse = {
        json: jest.fn().mockResolvedValue({ access_token: "refreshed-token" }),
      };
      const mockSuccessResponse = {
        status: 200,
        json: jest.fn().mockResolvedValue([createMockEvent(1)]),
      };
      mockFetch
        .mockResolvedValueOnce(mockUnauthorizedResponse)
        .mockResolvedValueOnce(mockTokenResponse)
        .mockResolvedValueOnce(mockSuccessResponse);

      // Act & Assert
      await expect(oddsFeedService.getSchedule()).rejects.toThrow("Unauthorized! Invalid token, attempt retry...");
    });

    it("should handle non-200 response", async () => {
      // Arrange
      const mockResponse = {
        status: 500,
        json: jest.fn().mockResolvedValue({ error: "Internal server error" }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Act & Assert
      await expect(oddsFeedService.getSchedule()).rejects.toThrow("Failed to get schedule: 500");
    });

    it("should handle network errors", async () => {
      // Arrange
      const networkError = new Error("Network timeout");
      mockFetch.mockRejectedValue(networkError);

      // Act & Assert
      await expect(oddsFeedService.getSchedule()).rejects.toThrow("Network timeout");
    });

    it("should handle JSON parsing errors", async () => {
      // Arrange
      const mockResponse = {
        status: 200,
        json: jest.fn().mockRejectedValue(new Error("Invalid JSON")),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Act & Assert
      await expect(oddsFeedService.getSchedule()).rejects.toThrow("Invalid JSON");
    });
  });

  describe("getScheduleWithRetry (updated with retry/delay parameters)", () => {
    it("should successfully get schedule with default retry parameters", async () => {
      // Arrange
      const mockEvents = [createMockEvent(1), createMockEvent(2)];
      mockRetry.mockResolvedValue(mockEvents);

      // Act
      const result = await oddsFeedService.getScheduleWithRetry();

      // Assert
      expect(result).toEqual(mockEvents);
      expect(mockRetry).toHaveBeenCalledWith(expect.any(Function), 3, 1000);
    });

    it("should get schedule with custom retry parameters", async () => {
      // Arrange
      const mockEvents = [createMockEvent(1)];
      mockRetry.mockResolvedValue(mockEvents);

      // Act
      const result = await oddsFeedService.getScheduleWithRetry(5, 2000);

      // Assert
      expect(result).toEqual(mockEvents);
      expect(mockRetry).toHaveBeenCalledWith(expect.any(Function), 5, 2000);
    });

    it("should handle retry failure and return empty array", async () => {
      // Arrange
      const retryError = new Error("API unavailable");
      mockRetry.mockRejectedValue(retryError);

      // Act
      const result = await oddsFeedService.getScheduleWithRetry();

      // Assert
      expect(result).toEqual([]);
      expect(mockContainer.logService.logError).toHaveBeenCalledWith("Failed to get schedule: Error: API unavailable");
    });
  });

  describe("getEventDetails (public method)", () => {
    it("should successfully get event details with existing token", async () => {
      // Arrange
      const eventId = 123;
      const mockEvent = createMockEvent(eventId, "Test Event");
      const validator = createMockEventValidator(true);
      const mockResponse = {
        status: 200,
        json: jest.fn().mockResolvedValue(mockEvent),
      };
      mockFetch.mockResolvedValue(mockResponse);

      oddsFeedService["token"] = "mock-token-123";

      // Act
      const result = await oddsFeedService.getEventDetails(eventId, validator);

      // Assert
      expect(result).toEqual(mockEvent);
      expect(mockFetch).toHaveBeenCalledWith(`https://api.oddsfeed.com/api/events?eventID=${eventId}`, {
        method: "GET",
        headers: {
          Authorization: "Bearer mock-token-123",
        },
      });
    });

    it("should get new token when no token exists", async () => {
      // Arrange
      const eventId = 456;
      const mockEvent = createMockEvent(eventId);
      const validator = createMockEventValidator(true);
      const mockTokenResponse = {
        json: jest.fn().mockResolvedValue({ access_token: "new-token-789" }),
      };
      const mockEventResponse = {
        status: 200,
        json: jest.fn().mockResolvedValue(mockEvent),
      };
      mockFetch.mockResolvedValueOnce(mockTokenResponse).mockResolvedValueOnce(mockEventResponse);

      // Act
      const result = await oddsFeedService.getEventDetails(eventId, validator);

      // Assert
      expect(result).toEqual(mockEvent);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should handle 401 unauthorized and refresh token", async () => {
      // Arrange
      oddsFeedService["token"] = "invalid-token";
      const eventId = 789;
      const validator = createMockEventValidator(true);
      const mockUnauthorizedResponse = {
        status: 401,
        json: jest.fn().mockResolvedValue({ error: "Unauthorized" }),
      };
      const mockTokenResponse = {
        json: jest.fn().mockResolvedValue({ access_token: "refreshed-token" }),
      };
      mockFetch.mockResolvedValueOnce(mockUnauthorizedResponse).mockResolvedValueOnce(mockTokenResponse);

      // Act & Assert
      await expect(oddsFeedService.getEventDetails(eventId, validator)).rejects.toThrow(
        "Unauthorized! Invalid token, attempt retry..."
      );
    });

    it("should handle validator rejection", async () => {
      // Arrange
      const eventId = 999;
      const mockEvent = createMockEvent(eventId, "Invalid Event");
      const validator = createMockEventValidator(false);
      const mockResponse = {
        status: 200,
        json: jest.fn().mockResolvedValue(mockEvent),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Act & Assert
      await expect(oddsFeedService.getEventDetails(eventId, validator)).rejects.toThrow("Invalid event details: 999");
      expect(mockContainer.logService.logError).toHaveBeenCalledWith(
        "Error missing data for event 999, attempt retry..."
      );
    });

    it("should handle non-200 response", async () => {
      // Arrange
      const eventId = 111;
      const validator = createMockEventValidator(true);
      const mockResponse = {
        status: 404,
        json: jest.fn().mockResolvedValue({ error: "Event not found" }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Act & Assert
      await expect(oddsFeedService.getEventDetails(eventId, validator)).rejects.toThrow(
        "Failed to get event details: 404"
      );
    });

    it("should handle network errors", async () => {
      // Arrange
      const eventId = 222;
      const validator = createMockEventValidator(true);
      const networkError = new Error("Connection failed");
      mockFetch.mockRejectedValue(networkError);

      // Act & Assert
      await expect(oddsFeedService.getEventDetails(eventId, validator)).rejects.toThrow("Connection failed");
    });

    it("should handle JSON parsing errors", async () => {
      // Arrange
      const eventId = 333;
      const validator = createMockEventValidator(true);
      const mockResponse = {
        status: 200,
        json: jest.fn().mockRejectedValue(new Error("Invalid JSON")),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Act & Assert
      await expect(oddsFeedService.getEventDetails(eventId, validator)).rejects.toThrow("Invalid JSON");
    });
  });

  describe("getEventDetailsWithRetry (updated with retry/delay parameters)", () => {
    it("should successfully get event details with default retry parameters", async () => {
      // Arrange
      const eventId = 123;
      const mockEvent = createMockEvent(eventId);
      const validator = createMockEventValidator(true);
      mockRetry.mockResolvedValue(mockEvent);

      // Act
      const result = await oddsFeedService.getEventDetailsWithRetry(eventId, validator);

      // Assert
      expect(result).toEqual(mockEvent);
      expect(mockRetry).toHaveBeenCalledWith(expect.any(Function), 3, 1000);
    });

    it("should get event details with custom retry parameters", async () => {
      // Arrange
      const eventId = 456;
      const mockEvent = createMockEvent(eventId);
      const validator = createMockEventValidator(true);
      mockRetry.mockResolvedValue(mockEvent);

      // Act
      const result = await oddsFeedService.getEventDetailsWithRetry(eventId, validator, 5, 2000);

      // Assert
      expect(result).toEqual(mockEvent);
      expect(mockRetry).toHaveBeenCalledWith(expect.any(Function), 5, 2000);
    });

    it("should use default validator when none provided", async () => {
      // Arrange
      const eventId = 789;
      const mockEvent = createMockEvent(eventId);
      mockRetry.mockResolvedValue(mockEvent);

      // Act
      const result = await oddsFeedService.getEventDetailsWithRetry(eventId);

      // Assert
      expect(result).toEqual(mockEvent);
      expect(mockRetry).toHaveBeenCalledWith(expect.any(Function), 3, 1000);
    });

    it("should handle retry failure and return null", async () => {
      // Arrange
      const eventId = 999;
      const retryError = new Error("Event not found");
      mockRetry.mockRejectedValue(retryError);

      // Act
      const result = await oddsFeedService.getEventDetailsWithRetry(eventId);

      // Assert
      expect(result).toBeNull();
      expect(mockContainer.logService.logError).toHaveBeenCalledWith(
        "Failed to get event details of event 999 with error: Error: Event not found"
      );
    });
  });

  describe("getGoalInfo (updated with retry/delay parameters)", () => {
    it("should successfully get goal info with default retry parameters", async () => {
      // Arrange
      const url = "https://api.goals.com/info/123";
      const mockGoalInfo = createMockGoalInfo();
      const mockResponse = {
        json: jest.fn().mockResolvedValue(mockGoalInfo),
      };
      mockRetry.mockResolvedValue(mockResponse);

      // Act
      const result = await oddsFeedService.getGoalInfo(url);

      // Assert
      expect(result).toEqual(mockGoalInfo);
      expect(mockRetry).toHaveBeenCalledWith(expect.any(Function), 3, 1000);
    });

    it("should get goal info with custom retry parameters", async () => {
      // Arrange
      const url = "https://api.goals.com/info/456";
      const mockGoalInfo = createMockGoalInfo();
      const mockResponse = {
        json: jest.fn().mockResolvedValue(mockGoalInfo),
      };
      mockRetry.mockResolvedValue(mockResponse);

      // Act
      const result = await oddsFeedService.getGoalInfo(url, 5, 2000);

      // Assert
      expect(result).toEqual(mockGoalInfo);
      expect(mockRetry).toHaveBeenCalledWith(expect.any(Function), 5, 2000);
    });

    it("should handle fetch errors and return null", async () => {
      // Arrange
      const url = "https://api.goals.com/info/789";
      const fetchError = new Error("Goal info not available");
      mockRetry.mockRejectedValue(fetchError);

      // Act
      const result = await oddsFeedService.getGoalInfo(url);

      // Assert
      expect(result).toBeNull();
      expect(mockContainer.logService.logError).toHaveBeenCalledWith(
        "Failed to get json from https://api.goals.com/info/789! Error: Error: Goal info not available"
      );
    });

    it("should handle JSON parsing errors", async () => {
      // Arrange
      const url = "https://api.goals.com/info/999";
      const mockResponse = {
        json: jest.fn().mockRejectedValue(new Error("Invalid JSON format")),
      };
      mockRetry.mockResolvedValue(mockResponse);

      // Act
      const result = await oddsFeedService.getGoalInfo(url);

      // Assert
      expect(result).toBeNull();
      expect(mockContainer.logService.logError).toHaveBeenCalledWith(
        "Failed to get json from https://api.goals.com/info/999! Error: Error: Invalid JSON format"
      );
    });

    it("should handle empty response", async () => {
      // Arrange
      const url = "https://api.goals.com/info/empty";
      const mockResponse = {
        json: jest.fn().mockResolvedValue(null),
      };
      mockRetry.mockResolvedValue(mockResponse);

      // Act
      const result = await oddsFeedService.getGoalInfo(url);

      // Assert
      expect(result).toBeNull();
    });

    it("should handle retry exhaustion", async () => {
      // Arrange
      const url = "https://api.goals.com/info/timeout";
      const timeoutError = new Error("Request timeout");
      mockRetry.mockRejectedValue(timeoutError);

      // Act
      const result = await oddsFeedService.getGoalInfo(url, 1, 100);

      // Assert
      expect(result).toBeNull();
      expect(mockRetry).toHaveBeenCalledWith(expect.any(Function), 1, 100);
    });
  });

  describe("getInGameEvent", () => {
    it("should successfully get in-game event with default retry parameters", async () => {
      // Arrange
      const url = "https://api.ingame.com/event/123";
      const mockInGameEvent = createMockInGameEvent();
      const mockResponse = {
        json: jest.fn().mockResolvedValue(mockInGameEvent),
      };
      mockRetry.mockResolvedValue(mockResponse);

      // Act
      const result = await oddsFeedService.getInGameEvent(url);

      // Assert
      expect(result).toEqual(mockInGameEvent);
      expect(mockRetry).toHaveBeenCalledWith(expect.any(Function), 3, 1000);
    });

    it("should get in-game event with custom retry parameters", async () => {
      // Arrange
      const url = "https://api.ingame.com/event/456";
      const mockInGameEvent = createMockInGameEvent();
      const mockResponse = {
        json: jest.fn().mockResolvedValue(mockInGameEvent),
      };
      mockRetry.mockResolvedValue(mockResponse);

      // Act
      const result = await oddsFeedService.getInGameEvent(url, 5, 2000);

      // Assert
      expect(result).toEqual(mockInGameEvent);
      expect(mockRetry).toHaveBeenCalledWith(expect.any(Function), 5, 2000);
    });

    it("should handle fetch errors and return null", async () => {
      // Arrange
      const url = "https://api.ingame.com/event/789";
      const fetchError = new Error("In-game event not available");
      mockRetry.mockRejectedValue(fetchError);

      // Act
      const result = await oddsFeedService.getInGameEvent(url);

      // Assert
      expect(result).toBeNull();
      expect(mockContainer.logService.logError).toHaveBeenCalledWith(
        "Failed to get json from https://api.ingame.com/event/789! Error: Error: In-game event not available"
      );
    });

    it("should handle JSON parsing errors", async () => {
      // Arrange
      const url = "https://api.ingame.com/event/999";
      const mockResponse = {
        json: jest.fn().mockRejectedValue(new Error("Invalid JSON format")),
      };
      mockRetry.mockResolvedValue(mockResponse);

      // Act
      const result = await oddsFeedService.getInGameEvent(url);

      // Assert
      expect(result).toBeNull();
      expect(mockContainer.logService.logError).toHaveBeenCalledWith(
        "Failed to get json from https://api.ingame.com/event/999! Error: Error: Invalid JSON format"
      );
    });

    it("should handle empty response", async () => {
      // Arrange
      const url = "https://api.ingame.com/event/empty";
      const mockResponse = {
        json: jest.fn().mockResolvedValue(null),
      };
      mockRetry.mockResolvedValue(mockResponse);

      // Act
      const result = await oddsFeedService.getInGameEvent(url);

      // Assert
      expect(result).toBeNull();
    });

    it("should handle retry exhaustion", async () => {
      // Arrange
      const url = "https://api.ingame.com/event/timeout";
      const timeoutError = new Error("Request timeout");
      mockRetry.mockRejectedValue(timeoutError);

      // Act
      const result = await oddsFeedService.getInGameEvent(url, 1, 100);

      // Assert
      expect(result).toBeNull();
      expect(mockRetry).toHaveBeenCalledWith(expect.any(Function), 1, 100);
    });

    it("should handle network timeout", async () => {
      // Arrange
      const url = "https://api.ingame.com/event/slow";
      const timeoutError = new Error("Network timeout");
      mockRetry.mockRejectedValue(timeoutError);

      // Act
      const result = await oddsFeedService.getInGameEvent(url, 2, 500);

      // Assert
      expect(result).toBeNull();
      expect(mockContainer.logService.logError).toHaveBeenCalledWith(
        "Failed to get json from https://api.ingame.com/event/slow! Error: Error: Network timeout"
      );
    });

    it("should handle complex in-game event structure", async () => {
      // Arrange
      const url = "https://api.ingame.com/event/complex";
      const complexInGameEvent: InGameEvent = {
        timeLine: [0, 5, 10, 15, 20, 25, 30],
        frame: [0, 100, 200, 300, 400, 500, 600],
        eventName: ["kick-off", "pass", "dribble", "shot", "save", "corner", "throw-in"],
      };
      const mockResponse = {
        json: jest.fn().mockResolvedValue(complexInGameEvent),
      };
      mockRetry.mockResolvedValue(mockResponse);

      // Act
      const result = await oddsFeedService.getInGameEvent(url);

      // Assert
      expect(result).toEqual(complexInGameEvent);
    });
  });

  describe("getVoiceConfig", () => {
    it("should successfully get voice config with default retry parameters", async () => {
      // Arrange
      const url = "https://api.voice.com/config/123";
      const mockVoiceConfig = createMockVoiceConfig();
      const mockResponse = {
        json: jest.fn().mockResolvedValue(mockVoiceConfig),
      };
      mockRetry.mockResolvedValue(mockResponse);

      // Act
      const result = await oddsFeedService.getVoiceConfig(url);

      // Assert
      expect(result).toEqual(mockVoiceConfig);
      expect(mockRetry).toHaveBeenCalledWith(expect.any(Function), 3, 1000);
    });

    it("should get voice config with custom retry parameters", async () => {
      // Arrange
      const url = "https://api.voice.com/config/456";
      const mockVoiceConfig = createMockVoiceConfig();
      const mockResponse = {
        json: jest.fn().mockResolvedValue(mockVoiceConfig),
      };
      mockRetry.mockResolvedValue(mockResponse);

      // Act
      const result = await oddsFeedService.getVoiceConfig(url, 5, 2000);

      // Assert
      expect(result).toEqual(mockVoiceConfig);
      expect(mockRetry).toHaveBeenCalledWith(expect.any(Function), 5, 2000);
    });

    it("should handle fetch errors and return null", async () => {
      // Arrange
      const url = "https://api.voice.com/config/789";
      const fetchError = new Error("Voice config not available");
      mockRetry.mockRejectedValue(fetchError);

      // Act
      const result = await oddsFeedService.getVoiceConfig(url);

      // Assert
      expect(result).toBeNull();
      expect(mockContainer.logService.logError).toHaveBeenCalledWith(
        "Failed to get json from https://api.voice.com/config/789! Error: Error: Voice config not available"
      );
    });

    it("should handle JSON parsing errors", async () => {
      // Arrange
      const url = "https://api.voice.com/config/999";
      const mockResponse = {
        json: jest.fn().mockRejectedValue(new Error("Invalid JSON format")),
      };
      mockRetry.mockResolvedValue(mockResponse);

      // Act
      const result = await oddsFeedService.getVoiceConfig(url);

      // Assert
      expect(result).toBeNull();
      expect(mockContainer.logService.logError).toHaveBeenCalledWith(
        "Failed to get json from https://api.voice.com/config/999! Error: Error: Invalid JSON format"
      );
    });

    it("should handle empty response", async () => {
      // Arrange
      const url = "https://api.voice.com/config/empty";
      const mockResponse = {
        json: jest.fn().mockResolvedValue(null),
      };
      mockRetry.mockResolvedValue(mockResponse);

      // Act
      const result = await oddsFeedService.getVoiceConfig(url);

      // Assert
      expect(result).toBeNull();
    });

    it("should handle retry exhaustion", async () => {
      // Arrange
      const url = "https://api.voice.com/config/timeout";
      const timeoutError = new Error("Request timeout");
      mockRetry.mockRejectedValue(timeoutError);

      // Act
      const result = await oddsFeedService.getVoiceConfig(url, 1, 100);

      // Assert
      expect(result).toBeNull();
      expect(mockRetry).toHaveBeenCalledWith(expect.any(Function), 1, 100);
    });

    it("should handle network timeout", async () => {
      // Arrange
      const url = "https://api.voice.com/config/slow";
      const timeoutError = new Error("Network timeout");
      mockRetry.mockRejectedValue(timeoutError);

      // Act
      const result = await oddsFeedService.getVoiceConfig(url, 2, 500);

      // Assert
      expect(result).toBeNull();
      expect(mockContainer.logService.logError).toHaveBeenCalledWith(
        "Failed to get json from https://api.voice.com/config/slow! Error: Error: Network timeout"
      );
    });

    it("should handle complex voice config structure", async () => {
      // Arrange
      const url = "https://api.voice.com/config/complex";
      const complexVoiceConfig: VoiceConfig = {
        "goal": {
          500: { timeline: [0, 250, 500], voice: ["Quick goal!", "Fast!", "Speed!"] },
          1000: { timeline: [0, 500, 1000], voice: ["Goal!", "Score!", "Yes!"] },
          2000: { timeline: [0, 1000, 2000], voice: ["Long goal!", "Extended!", "Duration!"] },
        },
        "assist": {
          300: { timeline: [0, 150, 300], voice: ["Assist!", "Pass!", "Help!"] },
        },
        "save": {
          800: { timeline: [0, 400, 800], voice: ["Great save!", "Blocked!", "Stopped!"] },
        },
      };
      const mockResponse = {
        json: jest.fn().mockResolvedValue(complexVoiceConfig),
      };
      mockRetry.mockResolvedValue(mockResponse);

      // Act
      const result = await oddsFeedService.getVoiceConfig(url);

      // Assert
      expect(result).toEqual(complexVoiceConfig);
    });
  });
});
