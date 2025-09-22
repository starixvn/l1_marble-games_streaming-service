import { EventStreamService } from "../../../src/services/event-stream-service";
import { mockContainer } from "../global-stubs";
import { appSettings } from "../../../src/app-settings";
import { Event, EventStreamState, JobName } from "../../../src/types";

// Mock dependencies
jest.mock("../../../src/app-settings");
jest.mock("sc-common", () => ({
  logger: {
    logError: jest.fn(),
  },
}));

// Test data factories
const createMockEventDetails = (eventId: number = 1): any => [
  {
    eventID: eventId,
    oddsAvailableTs: "2024-01-01T10:00:00Z",
    scheduleStartTs: "2024-01-01T10:00:00Z",
    resultsAvailableTs: "2024-01-01T10:00:30Z",
    hasResults: true,
    goalInfo: "goal-info-1",
    playlist: "playlist1",
    result: "1-0",
    markets: {},
  },
  {
    eventID: eventId,
    oddsAvailableTs: "2024-01-01T10:00:30Z",
    scheduleStartTs: "2024-01-01T10:00:30Z",
    resultsAvailableTs: "2024-01-01T10:01:00Z",
    hasResults: true,
    goalInfo: "goal-info-1",
    playlist: "playlist2",
    result: "1-0",
    markets: {},
  },
];

const createMockEvent = (eventId: number = 1, name: string = "Test Event"): Event => ({
  eventID: eventId,
  eventNameAKey: `${name} Home`,
  eventNameBKey: `${name} Away`,
  theme: "football",
  scheduleStartTs: "2024-01-01T10:00:00Z",
  productCode: "SPORT",
  productTypeKey: "FOOTBALL",
  eventDetails: createMockEventDetails(eventId),
});

const createMockEventStreamState = (eventId: number = 1, gameId: string = "2001"): EventStreamState => ({
  ...createMockEvent(eventId),
  currentEventDetailIndex: 0,
  liveScores: ["1-0", "2-0"],
  goalInfos: [null, null],
  currentPhase: JobName.ScheduleEvent,
  liveVoices: ["", ""],
});

const createMockClient = (gameId: string = "2001") => ({
  write: jest.fn(),
  gameId,
});

describe("EventStreamService", () => {
  let eventStreamService: EventStreamService;
  let mockEventStore: any;
  let mockClientManager: any;
  let mockLogService: any;
  let mockInGameConsumer: any;
  let mockResponse: any;
  let dateNowSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create proper Jest mocks
    mockEventStore = {
      getCurrentEventForGame: jest.fn(),
    };
    mockClientManager = {
      getClientSetForGame: jest.fn(),
      addClient: jest.fn(),
    };
    mockLogService = {
      logError: jest.fn(),
    };
    mockInGameConsumer = {
      getCurrentByGameId: jest.fn(),
    };
    mockResponse = {
      write: jest.fn(),
      end: jest.fn(),
    };

    // Replace the auto-stubbed methods with Jest mocks
    mockContainer.clientManager = mockClientManager;
    mockContainer.logService = mockLogService;

    // Create extended container with inGameConsumer
    const extendedContainer = {
      ...mockContainer,
      inGameConsumer: mockInGameConsumer,
    };

    // Mock appSettings
    (appSettings as any) = {
      gameIds: ["2001", "2002", "2003"],
      videoLength: {
        "2001": 30,
        "2002": 30,
        "2003": 30,
      },
      videoDelay: {
        "2001": 3 * 1000,
        "2002": 3 * 1000,
        "2003": 3 * 1000,
      },
    };

    // Mock Date.now() to return a fixed timestamp
    dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(new Date("2024-01-01T10:00:00Z").getTime() + 1000); // 2024-01-01T10:00:01Z

    eventStreamService = new EventStreamService(extendedContainer);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  describe("addClient", () => {
    it("should add client and send initial payload for supported game", async () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(1, gameId);
      const mockFeaturePayload = { gameFlow: "Streaming", currentEvent: null };

      mockEventStore.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockInGameConsumer.getCurrentByGameId.mockReturnValue(mockFeaturePayload);

      // Act
      await eventStreamService.addClient(mockResponse, gameId);

      // Assert
      expect(mockClientManager.addClient).toHaveBeenCalledWith(mockResponse, gameId);
      expect(mockInGameConsumer.getCurrentByGameId).toHaveBeenCalledWith(gameId);
      expect(mockResponse.end).not.toHaveBeenCalled();
    });

    it("should reject unsupported game and end response", async () => {
      // Arrange
      const unsupportedGameId = "9999";

      // Act
      await eventStreamService.addClient(mockResponse, unsupportedGameId);

      // Assert
      expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining(`"message":"Game not supported"`));
      expect(mockResponse.end).toHaveBeenCalled();
      expect(mockClientManager.addClient).not.toHaveBeenCalled();
    });

    it("should handle all supported gameIds", async () => {
      // Arrange
      const supportedGameIds = ["2001", "2002", "2003"];
      const mockEvent = createMockEventStreamState(1);
      const mockFeaturePayload = { gameFlow: "Streaming", currentEvent: { eventId: 1 } };

      mockEventStore.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockInGameConsumer.getCurrentByGameId.mockReturnValue(mockFeaturePayload);

      // Act & Assert
      for (const gameId of supportedGameIds) {
        await eventStreamService.addClient(mockResponse, gameId);
        expect(mockClientManager.addClient).toHaveBeenCalledWith(mockResponse, gameId);
        expect(mockInGameConsumer.getCurrentByGameId).toHaveBeenCalledWith(gameId);
      }
    });

    it("should include feature payload with video streaming data", async () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(1, gameId);
      const mockFeaturePayload = {
        gameFlow: "Streaming",
        currentEvent: { eventId: 1, index: 2 },
        preloadVideo: { videoLink: "preload.m3u8" },
        videoStreaming: { videoLink: "live.m3u8", currentTime: 15000, phaseIndex: 1 }
      };

      mockEventStore.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockInGameConsumer.getCurrentByGameId.mockReturnValue(mockFeaturePayload);

      // Act
      await eventStreamService.addClient(mockResponse, gameId);

      // Assert
      expect(mockInGameConsumer.getCurrentByGameId).toHaveBeenCalledWith(gameId);
      expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining(`"gameFlow":"Streaming"`));
      expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining(`"preloadVideo":{"videoLink":"preload.m3u8"}`));
      expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining(`"videoStreaming":{"videoLink":"live.m3u8","currentTime":15000,"phaseIndex":1}`));
      expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining(`"currentEvent":{"eventId":1,"index":2}`));
    });

    it("should handle null feature payload from InGameConsumer", async () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(1, gameId);

      mockEventStore.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockInGameConsumer.getCurrentByGameId.mockReturnValue(null);

      // Act
      await eventStreamService.addClient(mockResponse, gameId);

      // Assert
      expect(mockInGameConsumer.getCurrentByGameId).toHaveBeenCalledWith(gameId);
      expect(mockResponse.end).not.toHaveBeenCalled();
    });

    it("should handle feature payload with complex game flow data", async () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(1, gameId);
      const mockFeaturePayload = {
        gameFlow: "HalfTime",
        currentEvent: { 
          eventId: 123, 
          index: 5, 
          eventDetailIndex: 3,
          gameId: "2001"
        },
        preloadVideo: { 
          videoLink: "https://example.com/preload.m3u8" 
        },
        videoStreaming: { 
          videoLink: "https://example.com/live.m3u8", 
          currentTime: 45000, 
          phaseIndex: 2,
          timeToStream: 1640995200000
        }
      };

      mockEventStore.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockInGameConsumer.getCurrentByGameId.mockReturnValue(mockFeaturePayload);

      // Act
      await eventStreamService.addClient(mockResponse, gameId);

      // Assert
      expect(mockInGameConsumer.getCurrentByGameId).toHaveBeenCalledWith(gameId);
      
      // Verify all feature payload data is included
      expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining(`"gameFlow":"HalfTime"`));
      expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining(`"eventId":123`));
      expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining(`"index":5`));
      expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining(`"eventDetailIndex":3`));
      expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining(`"currentTime":45000`));
      expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining(`"phaseIndex":2`));
      expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining(`"timeToStream":1640995200000`));
    });

    it("should handle InGameConsumer throwing an error", async () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(1, gameId);

      mockEventStore.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockInGameConsumer.getCurrentByGameId.mockImplementation(() => {
        throw new Error("InGameConsumer error");
      });

      // Act & Assert
      await expect(eventStreamService.addClient(mockResponse, gameId)).rejects.toThrow("InGameConsumer error");
      expect(mockInGameConsumer.getCurrentByGameId).toHaveBeenCalledWith(gameId);
    });
  });
});
