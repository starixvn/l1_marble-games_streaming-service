import { OddFeedStore } from "../../../../src/features/odd-feed-data/odd-feed-store";
import { Event } from "../../../../src/types";

// Test constants
const TEST_GAME_ID_1 = "game-123";
const TEST_GAME_ID_2 = "game-456";
const TEST_EVENT_ID_1 = 1001;
const TEST_EVENT_ID_2 = 1002;
const TEST_MARKETS: any[] = [];

// Simple test data
const mockEvent1: Event = {
  eventID: TEST_EVENT_ID_1,
  eventNameAKey: "Team A",
  eventNameBKey: "Team B",
  scheduleStartTs: "2024-01-01T10:00:00Z",
  productCode: "SPORT",
  productTypeKey: "FOOTBALL",
  eventDetails: [
    {
      eventID: TEST_EVENT_ID_1,
      oddsAvailableTs: "2024-01-01T10:00:00Z",
      scheduleStartTs: "2024-01-01T10:00:30Z",
      resultsAvailableTs: "2024-01-01T10:01:00Z",
      hasResults: true,
      goalInfo: "goal-info-1",
      playlist: "playlist1",
      result: "1-0",
      markets: TEST_MARKETS,
      inGameEventInfo: "info-1",
    },
  ],
};

const mockEvent2: Event = {
  eventID: TEST_EVENT_ID_2,
  eventNameAKey: "Team C",
  eventNameBKey: "Team D",
  scheduleStartTs: "2024-01-01T11:00:00Z",
  productCode: "SPORT",
  productTypeKey: "FOOTBALL",
  eventDetails: [
    {
      eventID: TEST_EVENT_ID_2,
      oddsAvailableTs: "2024-01-01T11:00:00Z",
      scheduleStartTs: "2024-01-01T11:00:30Z",
      resultsAvailableTs: "2024-01-01T11:01:00Z",
      hasResults: true,
      goalInfo: "goal-info-2",
      playlist: "playlist2",
      result: "2-0",
      markets: TEST_MARKETS,
      inGameEventInfo: "info-2",
    },
  ],
};

describe("OddFeedStore", () => {
  let oddFeedStore: OddFeedStore;

  beforeEach(() => {
    oddFeedStore = new OddFeedStore();
  });

  describe("constructor", () => {
    it("should initialize with empty eventByGameId storage", () => {
      // Arrange & Act
      const instance = new OddFeedStore();

      // Assert
      expect(instance).toBeInstanceOf(OddFeedStore);
      expect(instance["eventByGameId"]).toEqual({});
    });
  });

  describe("setEventByGameId", () => {
    it("should store event for new gameId and eventId", () => {
      // Act
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, mockEvent1);

      // Assert
      expect(oddFeedStore["eventByGameId"][TEST_GAME_ID_1]).toBeDefined();
      expect(oddFeedStore["eventByGameId"][TEST_GAME_ID_1][TEST_EVENT_ID_1]).toBe(mockEvent1);
    });

    it("should store multiple events for same gameId", () => {
      // Act
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, mockEvent1);
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_2, mockEvent2);

      // Assert
      expect(oddFeedStore["eventByGameId"][TEST_GAME_ID_1][TEST_EVENT_ID_1]).toBe(mockEvent1);
      expect(oddFeedStore["eventByGameId"][TEST_GAME_ID_1][TEST_EVENT_ID_2]).toBe(mockEvent2);
    });

    it("should store events for different gameIds", () => {
      // Act
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, mockEvent1);
      oddFeedStore.setEventByGameId(TEST_GAME_ID_2, TEST_EVENT_ID_2, mockEvent2);

      // Assert
      expect(oddFeedStore["eventByGameId"][TEST_GAME_ID_1][TEST_EVENT_ID_1]).toBe(mockEvent1);
      expect(oddFeedStore["eventByGameId"][TEST_GAME_ID_2][TEST_EVENT_ID_2]).toBe(mockEvent2);
    });

    it("should overwrite existing event with same gameId and eventId", () => {
      // Arrange
      const updatedEvent = { ...mockEvent1, eventNameAKey: "Updated Team A" };

      // Act
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, mockEvent1);
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, updatedEvent);

      // Assert
      expect(oddFeedStore["eventByGameId"][TEST_GAME_ID_1][TEST_EVENT_ID_1]).toBe(updatedEvent);
      expect(oddFeedStore["eventByGameId"][TEST_GAME_ID_1][TEST_EVENT_ID_1]).not.toBe(mockEvent1);
    });

    it("should create gameId entry if it does not exist", () => {
      // Arrange
      expect(oddFeedStore["eventByGameId"][TEST_GAME_ID_1]).toBeUndefined();

      // Act
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, mockEvent1);

      // Assert
      expect(oddFeedStore["eventByGameId"][TEST_GAME_ID_1]).toBeDefined();
      expect(oddFeedStore["eventByGameId"][TEST_GAME_ID_1]).toEqual({
        [TEST_EVENT_ID_1]: mockEvent1
      });
    });

    it("should not affect existing gameId entry when adding new eventId", () => {
      // Arrange
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, mockEvent1);

      // Act
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_2, mockEvent2);

      // Assert
      expect(oddFeedStore["eventByGameId"][TEST_GAME_ID_1][TEST_EVENT_ID_1]).toBe(mockEvent1);
      expect(oddFeedStore["eventByGameId"][TEST_GAME_ID_1][TEST_EVENT_ID_2]).toBe(mockEvent2);
    });
  });

  describe("getEventByGameId", () => {
    it("should return event when gameId and eventId exist", () => {
      // Arrange
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, mockEvent1);

      // Act
      const result = oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1);

      // Assert
      expect(result).toBe(mockEvent1);
    });

    it("should return undefined when gameId does not exist", () => {
      // Act
      const result = oddFeedStore.getEventByGameId("non-existent-game", TEST_EVENT_ID_1);

      // Assert
      expect(result).toBeUndefined();
    });

    it("should return undefined when gameId exists but eventId does not", () => {
      // Arrange
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, mockEvent1);

      // Act
      const result = oddFeedStore.getEventByGameId(TEST_GAME_ID_1, 9999);

      // Assert
      expect(result).toBeUndefined();
    });

    it("should return correct event when multiple events exist for same gameId", () => {
      // Arrange
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, mockEvent1);
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_2, mockEvent2);

      // Act
      const result1 = oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1);
      const result2 = oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_2);

      // Assert
      expect(result1).toBe(mockEvent1);
      expect(result2).toBe(mockEvent2);
    });

    it("should return correct event when multiple gameIds exist", () => {
      // Arrange
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, mockEvent1);
      oddFeedStore.setEventByGameId(TEST_GAME_ID_2, TEST_EVENT_ID_2, mockEvent2);

      // Act
      const result1 = oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1);
      const result2 = oddFeedStore.getEventByGameId(TEST_GAME_ID_2, TEST_EVENT_ID_2);

      // Assert
      expect(result1).toBe(mockEvent1);
      expect(result2).toBe(mockEvent2);
    });

    it("should return undefined for empty store", () => {
      // Act
      const result = oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete set and get workflow", () => {
      // Arrange
      const events = [mockEvent1, mockEvent2];
      const gameIds = [TEST_GAME_ID_1, TEST_GAME_ID_2];
      const eventIds = [TEST_EVENT_ID_1, TEST_EVENT_ID_2];

      // Act - Store events
      oddFeedStore.setEventByGameId(gameIds[0], eventIds[0], events[0]);
      oddFeedStore.setEventByGameId(gameIds[1], eventIds[1], events[1]);

      // Act - Retrieve events
      const retrieved1 = oddFeedStore.getEventByGameId(gameIds[0], eventIds[0]);
      const retrieved2 = oddFeedStore.getEventByGameId(gameIds[1], eventIds[1]);

      // Assert
      expect(retrieved1).toBe(events[0]);
      expect(retrieved2).toBe(events[1]);
    });

    it("should handle event updates correctly", () => {
      // Arrange
      const originalEvent = mockEvent1;
      const updatedEvent = { ...mockEvent1, eventNameAKey: "Updated Team" };

      // Act
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, originalEvent);
      const beforeUpdate = oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1);
      
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, updatedEvent);
      const afterUpdate = oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1);

      // Assert
      expect(beforeUpdate).toBe(originalEvent);
      expect(afterUpdate).toBe(updatedEvent);
      expect(afterUpdate).not.toBe(originalEvent);
    });
  });
});
