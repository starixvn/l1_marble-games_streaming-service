import { IntroService } from "../../../../src/features/intro/intro-service";
import { OddsFeedEventSource, OddsFeedEventName, EventNotification } from "odds-feed-client";
import { createMockEvent } from "../../test-utils/mock-event";

jest.mock("odds-feed-client", () => {
  return {
    OddsFeedEventName: {
      EventStart: "EventStart",
    },
    OddsFeedEventSource: class {
      eventOn = jest.fn();
      eventOff = jest.fn();
    },
  };
});

// Mock dependencies
const mockOddsFeedEventSource = {
  eventOn: jest.fn(),
  eventOff: jest.fn(),
} as unknown as jest.Mocked<OddsFeedEventSource>;

// Test constants
const TEST_GAME_ID = "1";
const TEST_EVENT_ID = 4294967298; // gameId: 1, roundId: 2
const TEST_PREBET_VIDEO = "https://example.com/prebet.mp4";
const TEST_HALFTIME_VIDEO = "https://example.com/halftime.mp4";

// Test data
const mockEventWithIntroConfig = {
  ...createMockEvent({
    eventID: TEST_EVENT_ID,
  }),
  config: {
    intro: {
      prebet: TEST_PREBET_VIDEO,
      halftime: TEST_HALFTIME_VIDEO,
    },
  },
};

const mockEventWithoutIntroConfig = createMockEvent({
  eventID: TEST_EVENT_ID,
});

const mockEventNotificationWithConfig: EventNotification = {
  event: mockEventWithIntroConfig as any,
};

const mockEventNotificationWithoutConfig: EventNotification = {
  event: mockEventWithoutIntroConfig as any,
};

// Helper functions for test setup
const createContainer = () => ({
  oddsFeedEventSource: mockOddsFeedEventSource,
});

const setupMocks = () => {
  jest.clearAllMocks();
};

describe("IntroService", () => {
  let introService: IntroService;
  let container: any;

  beforeEach(() => {
    setupMocks();
    container = createContainer();
    introService = new IntroService(container);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with oddsFeedEventSource and bind event handlers", () => {
      // Arrange & Act
      const service = new IntroService(container);

      // Assert
      expect(service["oddsFeedEventSource"]).toBe(mockOddsFeedEventSource);
      expect(service["boundHandleEventStart"]).toBeInstanceOf(Function);
    });

    it("should initialize empty intro tracking object", () => {
      // Arrange & Act
      const service = new IntroService(container);

      // Assert
      expect(service["_introByGameId"]).toEqual({});
    });
  });

  describe("eventName", () => {
    it('should return "intro"', () => {
      // Act
      const result = introService.eventName;

      // Assert
      expect(result).toBe("intro");
    });
  });

  describe("initEvent", () => {
    it("should register EventStart event listener", () => {
      // Arrange & Act
      introService.initEvent();

      // Assert
      expect(mockOddsFeedEventSource.eventOn).toHaveBeenCalledWith(
        OddsFeedEventName.EventStart,
        introService["boundHandleEventStart"]
      );
    });
  });

  describe("dispose", () => {
    it("should unregister EventStart event listener", () => {
      // Arrange & Act
      introService.dispose();

      // Assert
      expect(mockOddsFeedEventSource.eventOff).toHaveBeenCalledWith(
        OddsFeedEventName.EventStart,
        introService["boundHandleEventStart"]
      );
    });
  });

  describe("handleEventStart", () => {
    it("should store prebet and halftime intro URLs when config is available", () => {
      // Act
      introService.handleEventStart(mockEventNotificationWithConfig);

      // Assert
      const result = introService.getCurrentByGameId(TEST_GAME_ID);
      expect(result).toBeDefined();
      expect(result?.prebet).toBe(TEST_PREBET_VIDEO);
      expect(result?.halftime).toBe(TEST_HALFTIME_VIDEO);
    });

    it("should not store intro state when config is not available", () => {
      // Act
      introService.handleEventStart(mockEventNotificationWithoutConfig);

      // Assert
      const result = introService.getCurrentByGameId(TEST_GAME_ID);
      expect(result).toBeUndefined();
    });

    it("should handle event with only prebet intro", () => {
      // Arrange
      const eventWithOnlyPrebet = {
        ...createMockEvent({ eventID: TEST_EVENT_ID }),
        config: {
          intro: {
            prebet: TEST_PREBET_VIDEO,
          },
        },
      };
      const notification: EventNotification = {
        event: eventWithOnlyPrebet as any,
      };

      // Act
      introService.handleEventStart(notification);

      // Assert
      const result = introService.getCurrentByGameId(TEST_GAME_ID);
      expect(result).toBeDefined();
      expect(result?.prebet).toBe(TEST_PREBET_VIDEO);
      expect(result?.halftime).toBeUndefined();
    });

    it("should handle event with only halftime intro", () => {
      // Arrange
      const eventWithOnlyHalftime = {
        ...createMockEvent({ eventID: TEST_EVENT_ID }),
        config: {
          intro: {
            halftime: TEST_HALFTIME_VIDEO,
          },
        },
      };
      const notification: EventNotification = {
        event: eventWithOnlyHalftime as any,
      };

      // Act
      introService.handleEventStart(notification);

      // Assert
      const result = introService.getCurrentByGameId(TEST_GAME_ID);
      expect(result).toBeDefined();
      expect(result?.prebet).toBeUndefined();
      expect(result?.halftime).toBe(TEST_HALFTIME_VIDEO);
    });
  });

  describe("getCurrentByGameId", () => {
    it("should return intro state for existing game", () => {
      // Arrange
      introService["_introByGameId"][TEST_GAME_ID] = {
        prebet: TEST_PREBET_VIDEO,
        halftime: TEST_HALFTIME_VIDEO,
      };

      // Act
      const result = introService.getCurrentByGameId(TEST_GAME_ID);

      // Assert
      expect(result).toBeDefined();
      expect(result?.prebet).toBe(TEST_PREBET_VIDEO);
      expect(result?.halftime).toBe(TEST_HALFTIME_VIDEO);
    });

    it("should return undefined for non-existing game", () => {
      // Act
      const result = introService.getCurrentByGameId("nonexistent");

      // Assert
      expect(result).toBeUndefined();
    });
  });
});
