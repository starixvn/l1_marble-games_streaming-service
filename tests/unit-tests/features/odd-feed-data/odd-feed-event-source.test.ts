import { OddFeedEventSource, OddFeedEventName } from "../../../../src/features/odd-feed-data/odd-feed-event-source";
import { Event } from "../../../../src/types";

// Mock EventEmitter
const mockEventEmitter = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
};

jest.mock("node:events", () => {
  return jest.fn().mockImplementation(() => mockEventEmitter);
});

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

describe("OddFeedEventSource", () => {
  let oddFeedEventSource: OddFeedEventSource;

  beforeEach(() => {
    jest.clearAllMocks();
    oddFeedEventSource = new OddFeedEventSource();
  });

  describe("constructor", () => {
    it("should initialize EventEmitter", () => {
      // Arrange & Act
      const instance = new OddFeedEventSource();

      // Assert
      expect(instance.OddFeedEventSource).toBeDefined();
      expect(instance.OddFeedEventSource).toBe(mockEventEmitter);
    });
  });

  describe("registerWildcardEventListener", () => {
    it("should register wildcard listener", () => {
      // Arrange
      const listener = jest.fn();

      // Act
      oddFeedEventSource.registerWildcardEventListener(listener);

      // Assert
      expect(mockEventEmitter.on).toHaveBeenCalledWith(OddFeedEventName.Wildcard, listener);
    });
  });

  describe("unregisterWildcardEventListener", () => {
    it("should unregister wildcard listener", () => {
      // Arrange
      const listener = jest.fn();

      // Act
      oddFeedEventSource.unregisterWildcardEventListener(listener);

      // Assert
      expect(mockEventEmitter.off).toHaveBeenCalledWith(OddFeedEventName.Wildcard, listener);
    });
  });

  describe("registerEventListener", () => {
    it("should register event listener for specific event", () => {
      // Arrange
      const eventName = OddFeedEventName.EventStart;
      const listener = jest.fn();

      // Act
      oddFeedEventSource.registerEventListener(eventName, listener);

      // Assert
      expect(mockEventEmitter.on).toHaveBeenCalledWith(eventName, listener);
    });
  });

  describe("unregisterEventListener", () => {
    it("should unregister event listener for specific event", () => {
      // Arrange
      const eventName = OddFeedEventName.EventStart;
      const listener = jest.fn();

      // Act
      oddFeedEventSource.unregisterEventListener(eventName, listener);

      // Assert
      expect(mockEventEmitter.off).toHaveBeenCalledWith(eventName, listener);
    });
  });

  describe("registerEventDetailEventListener", () => {
    it("should register event detail listener", () => {
      // Arrange
      const eventName = OddFeedEventName.EventDetailStart;
      const listener = jest.fn();

      // Act
      oddFeedEventSource.registerEventDetailEventListener(eventName, listener);

      // Assert
      expect(mockEventEmitter.on).toHaveBeenCalledWith(eventName, listener);
    });
  });

  describe("unregisterEventDetailEventListener", () => {
    it("should unregister event detail listener", () => {
      // Arrange
      const eventName = OddFeedEventName.EventDetailStart;
      const listener = jest.fn();

      // Act
      oddFeedEventSource.unregisterEventDetailEventListener(eventName, listener);

      // Assert
      expect(mockEventEmitter.off).toHaveBeenCalledWith(eventName, listener);
    });
  });

  describe("onEventStart", () => {
    it("should emit EventStart event with event notification", () => {
      // Arrange
      const expectedNotification = { event: mockEvent };

      // Act
      oddFeedEventSource.onEventStart(mockEvent);

      // Assert
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(OddFeedEventName.Wildcard, OddFeedEventName.EventStart, expectedNotification);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(OddFeedEventName.EventStart, expectedNotification);
      expect(mockEventEmitter.emit).toHaveBeenCalledTimes(2);
    });
  });

  describe("onEventDetailStart", () => {
    it("should emit EventDetailStart event with event detail notification", () => {
      // Arrange
      const index = 0;
      const expectedNotification = { event: mockEvent, index };

      // Act
      oddFeedEventSource.onEventDetailStart(mockEvent, index);

      // Assert
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(OddFeedEventName.Wildcard, OddFeedEventName.EventDetailStart, expectedNotification);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(OddFeedEventName.EventDetailStart, expectedNotification);
      expect(mockEventEmitter.emit).toHaveBeenCalledTimes(2);
    });
  });

  describe("onEventDetailOddsAvailable", () => {
    it("should emit EventDetailOddsAvailable event with event detail notification", () => {
      // Arrange
      const index = 1;
      const expectedNotification = { event: mockEvent, index };

      // Act
      oddFeedEventSource.onEventDetailOddsAvailable(mockEvent, index);

      // Assert
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(OddFeedEventName.Wildcard, OddFeedEventName.EventDetailOddsAvailable, expectedNotification);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(OddFeedEventName.EventDetailOddsAvailable, expectedNotification);
      expect(mockEventEmitter.emit).toHaveBeenCalledTimes(2);
    });
  });

  describe("onEventDetailResultsAvailable", () => {
    it("should emit EventDetailResultsAvailable event with event detail notification", () => {
      // Arrange
      const index = 2;
      const expectedNotification = { event: mockEvent, index };

      // Act
      oddFeedEventSource.onEventDetailResultsAvailable(mockEvent, index);

      // Assert
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(OddFeedEventName.Wildcard, OddFeedEventName.EventDetailResultsAvailable, expectedNotification);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(OddFeedEventName.EventDetailResultsAvailable, expectedNotification);
      expect(mockEventEmitter.emit).toHaveBeenCalledTimes(2);
    });
  });

  describe("emit (private method behavior)", () => {
    it("should emit both wildcard and specific event through onEventStart", () => {
      // Act
      oddFeedEventSource.onEventStart(mockEvent);

      // Assert - verify private emit method calls both wildcard and specific event
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        OddFeedEventName.Wildcard, 
        OddFeedEventName.EventStart, 
        { event: mockEvent }
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        OddFeedEventName.EventStart, 
        { event: mockEvent }
      );
    });

    it("should emit both wildcard and specific event through onEventDetailStart", () => {
      // Arrange
      const index = 0;

      // Act
      oddFeedEventSource.onEventDetailStart(mockEvent, index);

      // Assert - verify private emit method calls both wildcard and specific event
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        OddFeedEventName.Wildcard, 
        OddFeedEventName.EventDetailStart, 
        { event: mockEvent, index }
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        OddFeedEventName.EventDetailStart, 
        { event: mockEvent, index }
      );
    });
  });
});
