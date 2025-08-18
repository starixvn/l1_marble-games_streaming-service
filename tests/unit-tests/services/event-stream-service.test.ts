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
    mockResponse = {
      write: jest.fn(),
      end: jest.fn(),
    };

    // Replace the auto-stubbed methods with Jest mocks
    mockContainer.eventStore = mockEventStore;
    mockContainer.clientManager = mockClientManager;
    mockContainer.logService = mockLogService;

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

    eventStreamService = new EventStreamService(mockContainer);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  describe("buildCurrentEventDetailsPayload", () => {
    it("should build payload successfully with valid event", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(1, gameId);
      mockEventStore.getCurrentEventForGame.mockReturnValue(mockEvent);

      // Act
      const result = eventStreamService.buildCurrentEventDetailsPayload(gameId);

      // Assert
      expect(result).toBeDefined();
      expect(result?.gameId).toBe(gameId);
      expect(result?.eventId).toBe(1);
      expect(result?.homeTeam).toBe("Test Event Home");
      expect(result?.awayTeam).toBe("Test Event Away");
      expect(result?.currentIndex).toBe(0);
      expect(result?.updatedIndex).toBe(0);
      expect(result?.eventDetails).toHaveLength(2);
      expect(result?.liveScores).toEqual(["1-0", "2-0"]);
      expect(result?.goalInfos).toEqual([]);
      expect(result?.currentPhase).toBe(JobName.ScheduleEvent);
      expect(result?.message).toBe("");

      // Verify event details payload structure
      expect(result?.eventDetails[0]).toEqual({
        playlist: "playlist1",
        videoLiveTimeMs: -2000, // Since scheduleStartTs is the same as mockNow
        videoLength: 30,
        result: "1-0",
      });

      expect(mockEventStore.getCurrentEventForGame).toHaveBeenCalledWith(gameId);
    });

    it("should build payload with custom updatedIndex", () => {
      // Arrange
      const gameId = "2001";
      const updatedIndex = 2;
      const mockEvent = createMockEventStreamState(1, gameId);
      mockEventStore.getCurrentEventForGame.mockReturnValue(mockEvent);

      // Act
      const result = eventStreamService.buildCurrentEventDetailsPayload(gameId, updatedIndex);

      // Assert
      expect(result?.updatedIndex).toBe(updatedIndex);
      expect(result?.currentIndex).toBe(0); // Should remain unchanged
    });

    it("should return null when no current event exists", () => {
      // Arrange
      const gameId = "2001";
      mockEventStore.getCurrentEventForGame.mockReturnValue(null);

      // Act
      const result = eventStreamService.buildCurrentEventDetailsPayload(gameId);

      // Assert
      expect(result).toBeNull();
      expect(mockLogService.logError).toHaveBeenCalledWith(`No current event for game ${gameId}`);
    });

    it("should calculate videoLiveTimeMs correctly", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(1, gameId);
      mockEventStore.getCurrentEventForGame.mockReturnValue(mockEvent);

      // Mock Date.now() to return 5 minutes later
      dateNowSpy.mockReturnValue(new Date("2024-01-01T10:00:00Z").getTime() + 10000); // 2024-01-01T10:05:01Z

      // Act
      const result = eventStreamService.buildCurrentEventDetailsPayload(gameId);

      // Assert
      expect(result?.eventDetails[0].videoLiveTimeMs).toBe(7000); // delay 3000ms
    });

    it("should calculate matchLiveTimeMs correctly", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(1, gameId);
      mockEventStore.getCurrentEventForGame.mockReturnValue(mockEvent);

      dateNowSpy.mockReturnValue(new Date("2024-01-01T10:00:00Z").getTime() + 50000);

      // Act
      const result = eventStreamService.buildCurrentEventDetailsPayload(gameId);

      // Assert
      const expectedMatchLiveTime = 47000; // delay 3000ms
      expect(result?.matchLiveTimeMs).toBe(expectedMatchLiveTime);
    });

    it("should handle negative videoLiveTimeMs by setting to 0", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(1, gameId);
      mockEventStore.getCurrentEventForGame.mockReturnValue(mockEvent);

      dateNowSpy.mockReturnValue(new Date("2024-01-01T10:00:00Z").getTime() - 5000);

      // Act
      const result = eventStreamService.buildCurrentEventDetailsPayload(gameId);

      // Assert
      expect(result?.eventDetails[0].videoLiveTimeMs).toBe(-8000); // delay 3000ms
      expect(result?.matchLiveTimeMs).toBe(0);
    });

    it("should handle empty eventDetails array", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = {
        ...createMockEventStreamState(1, gameId),
        eventDetails: [],
      };
      mockEventStore.getCurrentEventForGame.mockReturnValue(mockEvent);

      // Act
      const result = eventStreamService.buildCurrentEventDetailsPayload(gameId);

      // Assert
      expect(result?.eventDetails).toEqual([]);
      expect(result?.matchLiveTimeMs).toBe(0);
    });
  });

  describe("broadcastUpdateEventDataToClients", () => {
    it("should broadcast payload to all clients for a game", () => {
      // Arrange
      const gameId = "2001";
      const eventJobName = JobName.UpdateOdds;
      const updatedIndex = 2;
      const mockEvent = createMockEventStreamState(1, gameId);
      const mockClients = [createMockClient(gameId), createMockClient(gameId)];

      mockEventStore.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockClientManager.getClientSetForGame.mockReturnValue(mockClients);

      // Act
      eventStreamService.broadcastUpdateEventDataToClients(gameId, eventJobName, updatedIndex);

      // Assert
      expect(mockClientManager.getClientSetForGame).toHaveBeenCalledWith(gameId);
      expect(mockClients[0].write).toHaveBeenCalledWith(
        expect.stringContaining(`"message":"Broadcasted ${eventJobName} on index: ${updatedIndex}"`)
      );
      expect(mockClients[1].write).toHaveBeenCalledWith(
        expect.stringContaining(`"message":"Broadcasted ${eventJobName} on index: ${updatedIndex}"`)
      );
    });

    it("should handle case when no payload is built", () => {
      // Arrange
      const gameId = "2001";
      const eventJobName = JobName.UpdateOdds;
      const updatedIndex = 2;

      mockEventStore.getCurrentEventForGame.mockReturnValue(null);

      // Act
      eventStreamService.broadcastUpdateEventDataToClients(gameId, eventJobName, updatedIndex);

      // Assert
      expect(mockLogService.logError).toHaveBeenCalledWith(
        `No payload for game ${gameId} updatedIndex: ${updatedIndex}`
      );
    });

    it("should include correct message in broadcast payload", () => {
      // Arrange
      const gameId = "2001";
      const eventJobName = JobName.UpdateVideoInfo;
      const updatedIndex = 5;
      const mockEvent = createMockEventStreamState(1, gameId);
      const mockClient = createMockClient(gameId);

      mockEventStore.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockClientManager.getClientSetForGame.mockReturnValue([mockClient]);

      // Act
      eventStreamService.broadcastUpdateEventDataToClients(gameId, eventJobName, updatedIndex);

      // Assert
      const expectedMessage = `Broadcasted ${eventJobName} on index: ${updatedIndex}`;
      expect(mockClient.write).toHaveBeenCalledWith(expect.stringContaining(`"message":"${expectedMessage}"`));
    });
  });

  describe("addClient", () => {
    it("should add client and send initial payload for supported game", async () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(1, gameId);

      mockEventStore.getCurrentEventForGame.mockReturnValue(mockEvent);

      // Act
      await eventStreamService.addClient(mockResponse, gameId);

      // Assert
      expect(mockClientManager.addClient).toHaveBeenCalledWith(mockResponse, gameId);
      expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining(`"message":"First connection"`));
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

    it("should handle case when no payload is built", async () => {
      // Arrange
      const gameId = "2001";
      mockEventStore.getCurrentEventForGame.mockReturnValue(null);

      // Act
      await eventStreamService.addClient(mockResponse, gameId);

      // Assert
      expect(mockLogService.logError).toHaveBeenCalledWith(`No payload for game ${gameId}`);
      expect(mockClientManager.addClient).toHaveBeenCalledWith(mockResponse, gameId);
      expect(mockResponse.write).not.toHaveBeenCalled();
    });

    it("should handle all supported gameIds", async () => {
      // Arrange
      const supportedGameIds = ["2001", "2002", "2003"];
      const mockEvent = createMockEventStreamState(1);

      mockEventStore.getCurrentEventForGame.mockReturnValue(mockEvent);

      // Act & Assert
      for (const gameId of supportedGameIds) {
        await eventStreamService.addClient(mockResponse, gameId);
        expect(mockClientManager.addClient).toHaveBeenCalledWith(mockResponse, gameId);
      }
    });
  });
});
