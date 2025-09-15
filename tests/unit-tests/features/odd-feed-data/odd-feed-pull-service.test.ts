import { OddFeedPullService } from "../../../../src/features/odd-feed-data/odd-feed-pull-service";
import { Event } from "../../../../src/types";
import { idHelper } from "../../../../src/helpers";

// Mock dependencies
jest.mock("sc-common", () => ({
  logger: {
    logError: jest.fn(),
  },
}));

jest.mock("../../../../src/helpers", () => ({
  idHelper: {
    extractGameId: jest.fn(),
  },
}));

// Simple test data
const mockEvent: Event = {
  eventID: 1001,
  eventNameAKey: "Team A",
  eventNameBKey: "Team B",
  scheduleStartTs: "2024-01-01T10:00:00Z",
  productCode: "SPORT",
  productTypeKey: "FOOTBALL",
  eventDetails: [
    {
      eventID: 1001,
      oddsAvailableTs: "2024-01-01T10:00:00Z",
      scheduleStartTs: "2024-01-01T10:00:30Z",
      resultsAvailableTs: "2024-01-01T10:01:00Z",
      hasResults: true,
      goalInfo: "goal-info-1",
      playlist: "playlist1",
      result: "1-0",
      markets: [],
      inGameEventInfo: "info-1",
    },
  ],
};

describe("OddFeedPullService", () => {
  let oddFeedPullService: OddFeedPullService;
  let mockOddsFeedService: any;
  let mockOddFeedStore: any;
  let mockLogService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOddsFeedService = {
      getScheduleWithRetry: jest.fn(),
      getEventDetailsWithRetry: jest.fn(),
    };

    mockOddFeedStore = {
      setEventByGameId: jest.fn(),
    };

    mockLogService = {
      logError: jest.fn(),
    };

    (idHelper.extractGameId as jest.Mock).mockReturnValue("game-123");

    oddFeedPullService = new OddFeedPullService({
      oddsFeedService: mockOddsFeedService,
      oddFeedStore: mockOddFeedStore,
      logService: mockLogService,
    } as any);
  });

  describe("constructor", () => {
    it("should initialize with provided dependencies", () => {
      // Arrange & Act
      const instance = new OddFeedPullService({
        oddsFeedService: mockOddsFeedService,
        oddFeedStore: mockOddFeedStore,
        logService: mockLogService,
      } as any);

      // Assert
      expect(instance).toBeInstanceOf(OddFeedPullService);
      expect(instance["oddsFeedService"]).toBe(mockOddsFeedService);
      expect(instance["oddFeedStore"]).toBe(mockOddFeedStore);
      expect(instance["logService"]).toBe(mockLogService);
    });
  });

  describe("pullUpcoming", () => {
    it("should get upcoming events and store each event", async () => {
      // Arrange
      const upcomingEvents = [
        mockEvent,
        { ...mockEvent, eventID: 1002 },
        { ...mockEvent, eventID: 1003 },
      ];
      mockOddsFeedService.getScheduleWithRetry.mockResolvedValue(upcomingEvents);

      // Act
      const result = await oddFeedPullService.pullUpcoming();

      // Assert
      expect(mockOddsFeedService.getScheduleWithRetry).toHaveBeenCalledTimes(1);
      expect(idHelper.extractGameId).toHaveBeenCalledTimes(3);
      expect(idHelper.extractGameId).toHaveBeenCalledWith(1001);
      expect(idHelper.extractGameId).toHaveBeenCalledWith(1002);
      expect(idHelper.extractGameId).toHaveBeenCalledWith(1003);
      expect(mockOddFeedStore.setEventByGameId).toHaveBeenCalledTimes(3);
      expect(mockOddFeedStore.setEventByGameId).toHaveBeenCalledWith("game-123", 1001, upcomingEvents[0]);
      expect(mockOddFeedStore.setEventByGameId).toHaveBeenCalledWith("game-123", 1002, upcomingEvents[1]);
      expect(mockOddFeedStore.setEventByGameId).toHaveBeenCalledWith("game-123", 1003, upcomingEvents[2]);
      expect(result).toBe(upcomingEvents);
    });

    it("should handle empty upcoming events list", async () => {
      // Arrange
      mockOddsFeedService.getScheduleWithRetry.mockResolvedValue([]);

      // Act
      const result = await oddFeedPullService.pullUpcoming();

      // Assert
      expect(mockOddsFeedService.getScheduleWithRetry).toHaveBeenCalledTimes(1);
      expect(idHelper.extractGameId).not.toHaveBeenCalled();
      expect(mockOddFeedStore.setEventByGameId).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it("should handle single event", async () => {
      // Arrange
      const singleEvent = [mockEvent];
      mockOddsFeedService.getScheduleWithRetry.mockResolvedValue(singleEvent);

      // Act
      const result = await oddFeedPullService.pullUpcoming();

      // Assert
      expect(mockOddsFeedService.getScheduleWithRetry).toHaveBeenCalledTimes(1);
      expect(idHelper.extractGameId).toHaveBeenCalledTimes(1);
      expect(idHelper.extractGameId).toHaveBeenCalledWith(1001);
      expect(mockOddFeedStore.setEventByGameId).toHaveBeenCalledTimes(1);
      expect(mockOddFeedStore.setEventByGameId).toHaveBeenCalledWith("game-123", 1001, mockEvent);
      expect(result).toBe(singleEvent);
    });
  });

  describe("pullEventWithEventDetails", () => {
    it("should get event details and store the event", async () => {
      // Arrange
      const eventId = 1001;
      const eventWithDetails = { ...mockEvent, eventDetails: mockEvent.eventDetails };
      mockOddsFeedService.getEventDetailsWithRetry.mockResolvedValue(eventWithDetails);

      // Act
      const result = await oddFeedPullService.pullEventWithEventDetails(eventId);

      // Assert
      expect(mockOddsFeedService.getEventDetailsWithRetry).toHaveBeenCalledWith(eventId);
      expect(idHelper.extractGameId).toHaveBeenCalledWith(1001);
      expect(mockOddFeedStore.setEventByGameId).toHaveBeenCalledWith("game-123", 1001, eventWithDetails);
      expect(result).toBe(eventWithDetails);
      expect(mockLogService.logError).not.toHaveBeenCalled();
    });

    it("should return undefined and log error when event details not found", async () => {
      // Arrange
      const eventId = 1001;
      mockOddsFeedService.getEventDetailsWithRetry.mockResolvedValue(null);

      // Act
      const result = await oddFeedPullService.pullEventWithEventDetails(eventId);

      // Assert
      expect(mockOddsFeedService.getEventDetailsWithRetry).toHaveBeenCalledWith(eventId);
      expect(mockLogService.logError).toHaveBeenCalledWith(`Failed to get event details for event ${eventId}`);
      expect(idHelper.extractGameId).not.toHaveBeenCalled();
      expect(mockOddFeedStore.setEventByGameId).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("should return undefined and log error when event details is undefined", async () => {
      // Arrange
      const eventId = 2001;
      mockOddsFeedService.getEventDetailsWithRetry.mockResolvedValue(undefined);

      // Act
      const result = await oddFeedPullService.pullEventWithEventDetails(eventId);

      // Assert
      expect(mockOddsFeedService.getEventDetailsWithRetry).toHaveBeenCalledWith(eventId);
      expect(mockLogService.logError).toHaveBeenCalledWith(`Failed to get event details for event ${eventId}`);
      expect(idHelper.extractGameId).not.toHaveBeenCalled();
      expect(mockOddFeedStore.setEventByGameId).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("should handle different event IDs correctly", async () => {
      // Arrange
      const eventId = 5555;
      const eventWithDetails = { ...mockEvent, eventID: eventId };
      mockOddsFeedService.getEventDetailsWithRetry.mockResolvedValue(eventWithDetails);
      (idHelper.extractGameId as jest.Mock).mockReturnValue("game-5555");

      // Act
      const result = await oddFeedPullService.pullEventWithEventDetails(eventId);

      // Assert
      expect(mockOddsFeedService.getEventDetailsWithRetry).toHaveBeenCalledWith(eventId);
      expect(idHelper.extractGameId).toHaveBeenCalledWith(eventId);
      expect(mockOddFeedStore.setEventByGameId).toHaveBeenCalledWith("game-5555", eventId, eventWithDetails);
      expect(result).toBe(eventWithDetails);
    });
  });
});
