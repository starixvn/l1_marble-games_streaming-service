import { OddFeedScheduler } from "../../../../src/features/odd-feed-data/odd-feed-scheduler";
import { OddFeedEventName } from "../../../../src/features/odd-feed-data/odd-feed-event-source";
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
    extractRoundId: jest.fn(),
  },
}));

// Test constants
const TEST_EVENT_ID = 1001;
const TEST_GAME_ID = "game-123";
const TEST_MARKETS: any[] = [];
const TEST_INFO = "info-1";
const TEST_UPDATED_NAME = "Updated Team A";

// Simple test data
const mockEvent: Event = {
  eventID: TEST_EVENT_ID,
  eventNameAKey: "Team A",
  eventNameBKey: "Team B",
  scheduleStartTs: "2024-01-01T10:00:00Z",
  productCode: "SPORT",
  productTypeKey: "FOOTBALL",
  eventDetails: [
    {
      eventID: TEST_EVENT_ID,
      oddsAvailableTs: "2024-01-01T10:00:00Z",
      scheduleStartTs: "2024-01-01T10:00:30Z",
      resultsAvailableTs: "2024-01-01T10:01:00Z",
      hasResults: true,
      goalInfo: "goal-info-1",
      playlist: "playlist1",
      result: "1-0",
      markets: TEST_MARKETS,
      inGameEventInfo: TEST_INFO,
    },
    {
      eventID: TEST_EVENT_ID,
      oddsAvailableTs: "2024-01-01T10:01:00Z",
      scheduleStartTs: "2024-01-01T10:01:30Z",
      resultsAvailableTs: "2024-01-01T10:02:00Z",
      hasResults: true,
      goalInfo: "goal-info-2",
      playlist: "playlist2",
      result: "2-0",
      markets: TEST_MARKETS,
      inGameEventInfo: "info-2",
    },
  ],
};

describe("OddFeedScheduler", () => {
  let oddFeedScheduler: OddFeedScheduler;
  let mockOddFeedEventSource: any;
  let mockScheduler: any;
  let mockOddFeedPullService: any;
  let mockLogService: any;
  let mockOddFeedStore: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOddFeedEventSource = {
      onEventUpcoming: jest.fn(),
      onEventStart: jest.fn(),
      onEventDetailStart: jest.fn(),
      onEventDetailOddsAvailable: jest.fn(),
      onEventDetailResultsAvailable: jest.fn(),
    };

    mockScheduler = {
      schedule: jest.fn(),
    };

    mockOddFeedPullService = {
      pullEventWithEventDetails: jest.fn(),
    };

    mockLogService = {
      logError: jest.fn(),
    };

    mockOddFeedStore = {
      setEventByGameId: jest.fn(),
    };

    (idHelper.extractGameId as jest.Mock).mockReturnValue(TEST_GAME_ID);
    (idHelper.extractRoundId as jest.Mock).mockReturnValue("round-456");

    oddFeedScheduler = new OddFeedScheduler({
      oddFeedEventSource: mockOddFeedEventSource,
      scheduler: mockScheduler,
      oddFeedPullService: mockOddFeedPullService,
      logService: mockLogService,
      oddFeedStore: mockOddFeedStore,
    } as any);
  });

  describe("constructor", () => {
    it("should initialize with provided dependencies", () => {
      // Arrange & Act
      const instance = new OddFeedScheduler({
        oddFeedEventSource: mockOddFeedEventSource,
        scheduler: mockScheduler,
        oddFeedPullService: mockOddFeedPullService,
        logService: mockLogService,
        oddFeedStore: mockOddFeedStore,
      } as any);

      // Assert
      expect(instance).toBeInstanceOf(OddFeedScheduler);
      expect(instance["oddFeedEventSource"]).toBe(mockOddFeedEventSource);
      expect(instance["scheduler"]).toBe(mockScheduler);
      expect(instance["oddFeedPullService"]).toBe(mockOddFeedPullService);
      expect(instance["logService"]).toBe(mockLogService);
      expect(instance["oddFeedStore"]).toBe(mockOddFeedStore);
    });
  });

  describe("scheduleEventUpcoming", () => {
    it("should call oddFeedEventSource.onEventUpcoming with the event", () => {
      // Act
      oddFeedScheduler.scheduleEventUpcoming(mockEvent);

      // Assert
      expect(mockOddFeedEventSource.onEventUpcoming).toHaveBeenCalledWith(mockEvent);
    });

    it("should correctly trigger the odd feed event source onEventUpcoming method", () => {
      // Arrange
      const testEvent = {
        ...mockEvent,
        eventNameAKey: "Test Team A",
        eventNameBKey: "Test Team B"
      };

      // Act
      oddFeedScheduler.scheduleEventUpcoming(testEvent);

      // Assert
      expect(mockOddFeedEventSource.onEventUpcoming).toHaveBeenCalledTimes(1);
      expect(mockOddFeedEventSource.onEventUpcoming).toHaveBeenCalledWith(testEvent);
    });
  });

  describe("scheduleEvent", () => {
    it("should schedule all event details including upcoming", () => {
      // Arrange
      const scheduleEventUpcomingSpy = jest.spyOn(oddFeedScheduler, "scheduleEventUpcoming");
      const scheduleEventStartSpy = jest.spyOn(oddFeedScheduler as any, "scheduleEventStart");
      const scheduleEventDetailStartSpy = jest.spyOn(oddFeedScheduler as any, "scheduleEventDetailStart");
      const scheduleEventDetailOddsAvailableSpy = jest.spyOn(oddFeedScheduler as any, "scheduleEventDetailOddsAvailable");
      const scheduleEventDetailResultsAvailableSpy = jest.spyOn(oddFeedScheduler as any, "scheduleEventDetailResultsAvailable");

      // Act
      oddFeedScheduler.scheduleEvent(mockEvent);

      // Assert
      expect(scheduleEventUpcomingSpy).toHaveBeenCalledWith(mockEvent);
      expect(scheduleEventStartSpy).toHaveBeenCalledWith(mockEvent);
      expect(scheduleEventDetailStartSpy).toHaveBeenCalledTimes(2);
      expect(scheduleEventDetailStartSpy).toHaveBeenCalledWith(mockEvent, 0);
      expect(scheduleEventDetailStartSpy).toHaveBeenCalledWith(mockEvent, 1);
      
      expect(scheduleEventDetailOddsAvailableSpy).toHaveBeenCalledTimes(2);
      expect(scheduleEventDetailOddsAvailableSpy).toHaveBeenCalledWith(mockEvent, 0);
      expect(scheduleEventDetailOddsAvailableSpy).toHaveBeenCalledWith(mockEvent, 1);
      
      expect(scheduleEventDetailResultsAvailableSpy).toHaveBeenCalledTimes(2);
      expect(scheduleEventDetailResultsAvailableSpy).toHaveBeenCalledWith(mockEvent, 0);
      expect(scheduleEventDetailResultsAvailableSpy).toHaveBeenCalledWith(mockEvent, 1);
    });

    it("should handle event with single event detail", () => {
      // Arrange
      const singleDetailEvent = { ...mockEvent, eventDetails: [mockEvent.eventDetails[0]] };
      const scheduleEventUpcomingSpy = jest.spyOn(oddFeedScheduler, "scheduleEventUpcoming");
      const scheduleEventStartSpy = jest.spyOn(oddFeedScheduler as any, "scheduleEventStart");
      const scheduleEventDetailStartSpy = jest.spyOn(oddFeedScheduler as any, "scheduleEventDetailStart");

      // Act
      oddFeedScheduler.scheduleEvent(singleDetailEvent);

      // Assert
      expect(scheduleEventUpcomingSpy).toHaveBeenCalledWith(singleDetailEvent);
      expect(scheduleEventStartSpy).toHaveBeenCalledWith(singleDetailEvent);
      expect(scheduleEventDetailStartSpy).toHaveBeenCalledTimes(1);
      expect(scheduleEventDetailStartSpy).toHaveBeenCalledWith(singleDetailEvent, 0);
    });
  });

  describe("scheduleEventStart", () => {
    it("should schedule event start with correct parameters and bound handler", () => {
      // Act
      (oddFeedScheduler as any).scheduleEventStart(mockEvent);

      // Assert
      expect(mockScheduler.schedule).toHaveBeenCalledWith(
        new Date("2024-01-01T10:00:00Z"),
        expect.any(Function),
        { keyOverride: "event.ScheduleStart-1001-0" }
      );
    });
  });

  describe("scheduleEventDetailStart", () => {
    it("should schedule event detail start with correct parameters and bound handler", () => {
      // Act
      (oddFeedScheduler as any).scheduleEventDetailStart(mockEvent, 0);

      // Assert
      expect(mockScheduler.schedule).toHaveBeenCalledWith(
        new Date("2024-01-01T10:00:30Z"),
        expect.any(Function),
        { keyOverride: "eventDetail.ScheduleStart-1001-0" }
      );
    });
  });

  describe("scheduleEventDetailOddsAvailable", () => {
    it("should schedule event detail odds available with correct parameters and bound handler", () => {
      // Act
      (oddFeedScheduler as any).scheduleEventDetailOddsAvailable(mockEvent, 1);

      // Assert
      expect(mockScheduler.schedule).toHaveBeenCalledWith(
        new Date("2024-01-01T10:01:00Z"),
        expect.any(Function),
        { keyOverride: "eventDetail.OddsAvailable-1001-1" }
      );
    });
  });

  describe("scheduleEventDetailResultsAvailable", () => {
    it("should schedule event detail results available with correct parameters and bound handler", () => {
      // Act
      (oddFeedScheduler as any).scheduleEventDetailResultsAvailable(mockEvent, 1);

      // Assert
      expect(mockScheduler.schedule).toHaveBeenCalledWith(
        new Date("2024-01-01T10:02:00Z"),
        expect.any(Function),
        { keyOverride: "eventDetail.ResultsAvailable-1001-1" }
      );
    });
  });

  describe("composeKey", () => {
    it("should compose key correctly", () => {
      // Act
      const result = (oddFeedScheduler as any).composeKey(OddFeedEventName.EventStart, TEST_EVENT_ID, 0);

      // Assert
      expect(result).toBe("event.ScheduleStart-1001-0");
    });

    it("should compose key with different parameters", () => {
      // Act
      const result = (oddFeedScheduler as any).composeKey(OddFeedEventName.EventDetailOddsAvailable, 2002, 5);

      // Assert
      expect(result).toBe("eventDetail.OddsAvailable-2002-5");
    });
  });

  describe("pullEventAndUpdateStore", () => {
    it("should pull event details and update store", async () => {
      // Arrange
      const updatedEvent = { ...mockEvent, eventNameAKey: TEST_UPDATED_NAME };
      mockOddFeedPullService.pullEventWithEventDetails.mockResolvedValue(updatedEvent);

      // Act
      const result = await (oddFeedScheduler as any).pullEventAndUpdateStore(mockEvent);

      // Assert
      expect(mockOddFeedPullService.pullEventWithEventDetails).toHaveBeenCalledWith(TEST_EVENT_ID);
      expect(idHelper.extractGameId).toHaveBeenCalledWith(TEST_EVENT_ID);
      expect(mockOddFeedStore.setEventByGameId).toHaveBeenCalledWith(TEST_GAME_ID, TEST_EVENT_ID, updatedEvent);
      expect(result).toBe(updatedEvent);
    });

    it("should return undefined and log error when pull fails", async () => {
      // Arrange
      mockOddFeedPullService.pullEventWithEventDetails.mockResolvedValue(null);

      // Act
      const result = await (oddFeedScheduler as any).pullEventAndUpdateStore(mockEvent);

      // Assert
      expect(mockOddFeedPullService.pullEventWithEventDetails).toHaveBeenCalledWith(TEST_EVENT_ID);
      expect(mockLogService.logError).toHaveBeenCalledWith(`Failed to get event details for event ${TEST_EVENT_ID}`);
      expect(idHelper.extractGameId).not.toHaveBeenCalled();
      expect(mockOddFeedStore.setEventByGameId).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe("handleEventStart", () => {
    it("should call pullEventAndUpdateStore and emit onEventStart when successful", async () => {
      // Arrange
      const updatedEvent = { ...mockEvent, eventNameAKey: TEST_UPDATED_NAME };
      const pullEventAndUpdateStoreSpy = jest.spyOn(oddFeedScheduler as any, "pullEventAndUpdateStore");
      pullEventAndUpdateStoreSpy.mockResolvedValue(updatedEvent);

      // Act
      await (oddFeedScheduler as any).handleEventStart(mockEvent);

      // Assert
      expect(pullEventAndUpdateStoreSpy).toHaveBeenCalledWith(mockEvent);
      expect(mockOddFeedEventSource.onEventStart).toHaveBeenCalledWith(updatedEvent);
    });

    it("should not emit onEventStart when pullEventAndUpdateStore returns undefined", async () => {
      // Arrange
      const pullEventAndUpdateStoreSpy = jest.spyOn(oddFeedScheduler as any, "pullEventAndUpdateStore");
      pullEventAndUpdateStoreSpy.mockResolvedValue(undefined);

      // Act
      await (oddFeedScheduler as any).handleEventStart(mockEvent);

      // Assert
      expect(pullEventAndUpdateStoreSpy).toHaveBeenCalledWith(mockEvent);
      expect(mockOddFeedEventSource.onEventStart).not.toHaveBeenCalled();
    });
  });

  describe("handleEventDetailStart", () => {
    it("should call pullEventAndUpdateStore and emit onEventDetailStart when successful", async () => {
      // Arrange
      const updatedEvent = { ...mockEvent, eventNameAKey: TEST_UPDATED_NAME };
      const pullEventAndUpdateStoreSpy = jest.spyOn(oddFeedScheduler as any, "pullEventAndUpdateStore");
      pullEventAndUpdateStoreSpy.mockResolvedValue(updatedEvent);
      const index = 1;

      // Act
      await (oddFeedScheduler as any).handleEventDetailStart(mockEvent, index);

      // Assert
      expect(pullEventAndUpdateStoreSpy).toHaveBeenCalledWith(mockEvent);
      expect(mockOddFeedEventSource.onEventDetailStart).toHaveBeenCalledWith(updatedEvent, index);
    });

    it("should not emit onEventDetailStart when pullEventAndUpdateStore returns undefined", async () => {
      // Arrange
      const pullEventAndUpdateStoreSpy = jest.spyOn(oddFeedScheduler as any, "pullEventAndUpdateStore");
      pullEventAndUpdateStoreSpy.mockResolvedValue(undefined);
      const index = 1;

      // Act
      await (oddFeedScheduler as any).handleEventDetailStart(mockEvent, index);

      // Assert
      expect(pullEventAndUpdateStoreSpy).toHaveBeenCalledWith(mockEvent);
      expect(mockOddFeedEventSource.onEventDetailStart).not.toHaveBeenCalled();
    });
  });

  describe("handleEventDetailOddsAvailable", () => {
    it("should call pullEventAndUpdateStore and emit onEventDetailOddsAvailable when successful", async () => {
      // Arrange
      const updatedEvent = { ...mockEvent, eventNameAKey: TEST_UPDATED_NAME };
      const pullEventAndUpdateStoreSpy = jest.spyOn(oddFeedScheduler as any, "pullEventAndUpdateStore");
      pullEventAndUpdateStoreSpy.mockResolvedValue(updatedEvent);
      const index = 2;

      // Act
      await (oddFeedScheduler as any).handleEventDetailOddsAvailable(mockEvent, index);

      // Assert
      expect(pullEventAndUpdateStoreSpy).toHaveBeenCalledWith(mockEvent);
      expect(mockOddFeedEventSource.onEventDetailOddsAvailable).toHaveBeenCalledWith(updatedEvent, index);
    });

    it("should not emit onEventDetailOddsAvailable when pullEventAndUpdateStore returns undefined", async () => {
      // Arrange
      const pullEventAndUpdateStoreSpy = jest.spyOn(oddFeedScheduler as any, "pullEventAndUpdateStore");
      pullEventAndUpdateStoreSpy.mockResolvedValue(undefined);
      const index = 2;

      // Act
      await (oddFeedScheduler as any).handleEventDetailOddsAvailable(mockEvent, index);

      // Assert
      expect(pullEventAndUpdateStoreSpy).toHaveBeenCalledWith(mockEvent);
      expect(mockOddFeedEventSource.onEventDetailOddsAvailable).not.toHaveBeenCalled();
    });
  });

  describe("handleEventDetailResultsAvailable", () => {
    it("should call pullEventAndUpdateStore and emit onEventDetailResultsAvailable when successful", async () => {
      // Arrange
      const updatedEvent = { ...mockEvent, eventNameAKey: TEST_UPDATED_NAME };
      const pullEventAndUpdateStoreSpy = jest.spyOn(oddFeedScheduler as any, "pullEventAndUpdateStore");
      pullEventAndUpdateStoreSpy.mockResolvedValue(updatedEvent);
      const index = 3;

      // Act
      await (oddFeedScheduler as any).handleEventDetailResultsAvailable(mockEvent, index);

      // Assert
      expect(pullEventAndUpdateStoreSpy).toHaveBeenCalledWith(mockEvent);
      expect(mockOddFeedEventSource.onEventDetailResultsAvailable).toHaveBeenCalledWith(updatedEvent, index);
    });

    it("should not emit onEventDetailResultsAvailable when pullEventAndUpdateStore returns undefined", async () => {
      // Arrange
      const pullEventAndUpdateStoreSpy = jest.spyOn(oddFeedScheduler as any, "pullEventAndUpdateStore");
      pullEventAndUpdateStoreSpy.mockResolvedValue(undefined);
      const index = 3;

      // Act
      await (oddFeedScheduler as any).handleEventDetailResultsAvailable(mockEvent, index);

      // Assert
      expect(pullEventAndUpdateStoreSpy).toHaveBeenCalledWith(mockEvent);
      expect(mockOddFeedEventSource.onEventDetailResultsAvailable).not.toHaveBeenCalled();
    });
  });
});