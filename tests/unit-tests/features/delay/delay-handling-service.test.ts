import { DelayHandlingService } from "../../../../src/features/delay/delay-handling-service";
import { Event, OddsFeedEventName } from "odds-feed-client";

const TEST_GLOBAL_DELAY = 5000;
const TEST_PRELOAD_DURATION_MS = 2000;
const TEST_BASE_TIME = "2023-01-01T10:00:00Z";
const TEST_EVENT_DETAIL_TIME = "2023-01-01T10:10:00Z";

const mockDelayConfig = {
  globalDelayInMillisecond: TEST_GLOBAL_DELAY,
  videoDelayInMillisecond: TEST_PRELOAD_DURATION_MS, // Kept for backward compatibility in tests
};

const mockEventWithDelay: Event & {
  config: { delay: typeof mockDelayConfig };
  eventConfig?: { preloadDurationMs?: number };
} = {
  eventID: 4294967298,
  eventNameAKey: "Team A",
  eventNameBKey: "Team B",
  scheduleStartTs: TEST_BASE_TIME,
  productCode: "TEST",
  productTypeKey: "MARBLE",
  eventDetails: [
    {
      phase: 1,
      scheduleStartTs: TEST_EVENT_DETAIL_TIME,
      resultsAvailableTs: TEST_EVENT_DETAIL_TIME,
    } as any,
    {
      phase: 2,
      scheduleStartTs: TEST_EVENT_DETAIL_TIME,
      resultsAvailableTs: TEST_EVENT_DETAIL_TIME,
    } as any,
  ],
  config: {
    delay: mockDelayConfig,
  },
  eventConfig: {
    preloadDurationMs: TEST_PRELOAD_DURATION_MS,
  },
} as any;

const mockEventWithoutDelay: Event = {
  eventID: 999,
  eventNameAKey: "Team C",
  eventNameBKey: "Team D",
  scheduleStartTs: TEST_BASE_TIME,
  productCode: "TEST",
  productTypeKey: "MARBLE",
  eventDetails: [],
} as any;

describe("DelayHandlingService", () => {
  let delayHandlingService: DelayHandlingService;

  beforeEach(() => {
    delayHandlingService = new DelayHandlingService();
  });

  describe("getDelayedTime", () => {
    it("should return time with global delay when config exists", () => {
      // Arrange
      const baseTime = new Date(TEST_BASE_TIME);
      const expectedTime = new Date(baseTime.getTime() + TEST_GLOBAL_DELAY);

      // Act
      const result = delayHandlingService.getDelayedTime({
        event: mockEventWithDelay,
        time: baseTime,
      });

      // Assert
      expect(result).toEqual(expectedTime);
    });

    it("should return same time object when no config exists", () => {
      // Arrange
      const baseTime = new Date(TEST_BASE_TIME);
      const eventWithoutConfig: Event = mockEventWithoutDelay;

      // Act
      const result = delayHandlingService.getDelayedTime({
        event: eventWithoutConfig,
        time: baseTime,
      });

      // Assert
      expect(result).toEqual(baseTime);
      expect(result).toBe(baseTime);
    });

    it("should not mutate the original time object", () => {
      // Arrange
      const baseTime = new Date(TEST_BASE_TIME);
      const originalTime = baseTime.getTime();

      // Act
      delayHandlingService.getDelayedTime({
        event: mockEventWithDelay,
        time: baseTime,
      });

      // Assert
      expect(baseTime.getTime()).toBe(originalTime);
    });

    it("should handle zero global delay correctly", () => {
      // Arrange
      const zeroGlobalDelayConfig = {
        globalDelayInMillisecond: 0,
        videoDelayInMillisecond: TEST_PRELOAD_DURATION_MS,
      };
      const baseTime = new Date(TEST_BASE_TIME);
      const eventWithConfig: any = {
        ...mockEventWithDelay,
        config: { delay: zeroGlobalDelayConfig },
      };

      // Act
      const result = delayHandlingService.getDelayedTime({
        event: eventWithConfig,
        time: baseTime,
      });

      // Assert
      expect(result).toEqual(baseTime);
    });

    it("should handle negative delays correctly", () => {
      // Arrange
      const negativeDelayConfig = {
        globalDelayInMillisecond: -1000,
        videoDelayInMillisecond: -500,
      };
      const baseTime = new Date(TEST_BASE_TIME);
      const eventWithConfig: any = {
        ...mockEventWithDelay,
        config: { delay: negativeDelayConfig },
      };

      // Act
      const result = delayHandlingService.getDelayedTime({
        event: eventWithConfig,
        time: baseTime,
      });

      // Assert
      expect(result).toEqual(new Date(baseTime.getTime() - 1000));
    });
  });

  describe("getDelayedTimeWithVideoDelay", () => {
    it("should return time with both global delay and preload duration when config exists", () => {
      // Arrange
      const baseTime = new Date(TEST_BASE_TIME);
      const expectedTime = new Date(baseTime.getTime() + TEST_GLOBAL_DELAY + TEST_PRELOAD_DURATION_MS);

      // Act
      const result = delayHandlingService.getDelayedTimeWithVideoDelay({
        event: mockEventWithDelay,
        time: baseTime,
      });

      // Assert
      expect(result).toEqual(expectedTime);
    });

    it("should return same time object when no config exists", () => {
      // Arrange
      const baseTime = new Date(TEST_BASE_TIME);
      const eventWithoutConfig: Event = mockEventWithoutDelay;

      // Act
      const result = delayHandlingService.getDelayedTimeWithVideoDelay({
        event: eventWithoutConfig,
        time: baseTime,
      });

      // Assert
      expect(result).toEqual(baseTime);
      expect(result).toBe(baseTime);
    });

    it("should not mutate the original time object", () => {
      // Arrange
      const baseTime = new Date(TEST_BASE_TIME);
      const originalTime = baseTime.getTime();

      // Act
      delayHandlingService.getDelayedTimeWithVideoDelay({
        event: mockEventWithDelay,
        time: baseTime,
      });

      // Assert
      expect(baseTime.getTime()).toBe(originalTime);
    });

    it("should apply delays in correct order (global first, then preload duration)", () => {
      // Arrange
      const baseTime = new Date(TEST_BASE_TIME);

      // Act
      const globalDelayedTime = delayHandlingService.getDelayedTime({
        event: mockEventWithDelay,
        time: baseTime,
      });
      const fullDelayedTime = delayHandlingService.getDelayedTimeWithVideoDelay({
        event: mockEventWithDelay,
        time: baseTime,
      });

      // Assert
      const expectedIntermediateTime = new Date(baseTime.getTime() + TEST_GLOBAL_DELAY);
      const expectedFinalTime = new Date(expectedIntermediateTime.getTime() + TEST_PRELOAD_DURATION_MS);

      expect(globalDelayedTime).toEqual(expectedIntermediateTime);
      expect(fullDelayedTime).toEqual(expectedFinalTime);
    });

    it("should handle zero preload duration correctly", () => {
      // Arrange
      const baseTime = new Date(TEST_BASE_TIME);
      const eventWithConfig: any = {
        ...mockEventWithDelay,
        eventConfig: { preloadDurationMs: 0 },
      };

      // Act
      const result = delayHandlingService.getDelayedTimeWithVideoDelay({
        event: eventWithConfig,
        time: baseTime,
      });

      // Assert
      expect(result).toEqual(new Date(baseTime.getTime() + TEST_GLOBAL_DELAY));
    });

    it("should handle missing eventConfig correctly", () => {
      // Arrange
      const baseTime = new Date(TEST_BASE_TIME);
      const eventWithConfig: any = {
        ...mockEventWithDelay,
        eventConfig: undefined,
      };

      // Act
      const result = delayHandlingService.getDelayedTimeWithVideoDelay({
        event: eventWithConfig,
        time: baseTime,
      });

      // Assert
      expect(result).toEqual(new Date(baseTime.getTime() + TEST_GLOBAL_DELAY));
    });

    it("should handle negative delays correctly", () => {
      // Arrange
      const negativeDelayConfig = {
        globalDelayInMillisecond: -1000,
        videoDelayInMillisecond: -500,
      };
      const baseTime = new Date(TEST_BASE_TIME);
      const eventWithConfig: any = {
        ...mockEventWithDelay,
        config: { delay: negativeDelayConfig },
        eventConfig: { preloadDurationMs: -500 },
      };

      // Act
      const result = delayHandlingService.getDelayedTimeWithVideoDelay({
        event: eventWithConfig,
        time: baseTime,
      });

      // Assert
      expect(result).toEqual(new Date(baseTime.getTime() - 1500));
    });
  });

  describe("Pure function behavior", () => {
    it("should be a pure function - same inputs produce same output", () => {
      // Arrange
      const baseTime = new Date(TEST_BASE_TIME);

      // Act
      const result1 = delayHandlingService.getDelayedTime({
        event: mockEventWithDelay,
        time: baseTime,
      });
      const result2 = delayHandlingService.getDelayedTime({
        event: mockEventWithDelay,
        time: baseTime,
      });

      // Assert
      expect(result1).toEqual(result2);
    });

    it("should handle multiple events with different delay configurations independently", () => {
      // Arrange
      const config1 = { globalDelayInMillisecond: 1000, videoDelayInMillisecond: 500 };
      const config2 = { globalDelayInMillisecond: 2000, videoDelayInMillisecond: 1000 };

      const baseTime = new Date(TEST_BASE_TIME);
      const event1: any = { ...mockEventWithDelay, config: { delay: config1 } };
      const event2: any = { ...mockEventWithDelay, eventID: 8589934594, config: { delay: config2 } };

      // Act
      const result1 = delayHandlingService.getDelayedTime({ event: event1, time: baseTime });
      const result2 = delayHandlingService.getDelayedTime({ event: event2, time: baseTime });

      // Assert
      expect(result1).toEqual(new Date(baseTime.getTime() + 1000));
      expect(result2).toEqual(new Date(baseTime.getTime() + 2000));
    });

    it("should apply event-type-specific delay when oddsFeedEventType is provided", () => {
      // Arrange
      const eventStartDelay = 3000;
      const config = {
        globalDelayInMillisecond: TEST_GLOBAL_DELAY,
        eventScheduleStartDelayInMillisecond: eventStartDelay,
      };
      const baseTime = new Date(TEST_BASE_TIME);
      const eventWithConfig: any = {
        ...mockEventWithDelay,
        config: { delay: config },
      };

      // Act
      const result = delayHandlingService.getDelayedTime(
        { event: eventWithConfig, time: baseTime },
        { oddsFeedEventType: OddsFeedEventName.EventStart }
      );

      // Assert
      expect(result).toEqual(new Date(baseTime.getTime() + TEST_GLOBAL_DELAY + eventStartDelay));
    });

    it("should not apply event-type-specific delay when oddsFeedEventType is not provided", () => {
      // Arrange
      const eventStartDelay = 3000;
      const config = {
        globalDelayInMillisecond: TEST_GLOBAL_DELAY,
        eventScheduleStartDelayInMillisecond: eventStartDelay,
      };
      const baseTime = new Date(TEST_BASE_TIME);
      const eventWithConfig: any = {
        ...mockEventWithDelay,
        config: { delay: config },
      };

      // Act
      const result = delayHandlingService.getDelayedTime({ event: eventWithConfig, time: baseTime });

      // Assert
      expect(result).toEqual(new Date(baseTime.getTime() + TEST_GLOBAL_DELAY));
    });
  });

  describe("getTimeToStartEvent", () => {
    it("should return delayed time for event start", () => {
      // Arrange
      const eventStartTime = new Date(TEST_BASE_TIME);
      const expectedTime = new Date(eventStartTime.getTime() + TEST_GLOBAL_DELAY);

      // Act
      const result = delayHandlingService.getTimeToStartEvent(mockEventWithDelay);

      // Assert
      expect(result).toEqual(expectedTime);
    });

    it("should use event scheduleStartTs as base time", () => {
      // Arrange
      const customTime = "2024-01-15T12:30:00Z";
      const customEvent: any = {
        ...mockEventWithDelay,
        scheduleStartTs: customTime,
      };
      const expectedTime = new Date(new Date(customTime).getTime() + TEST_GLOBAL_DELAY);

      // Act
      const result = delayHandlingService.getTimeToStartEvent(customEvent);

      // Assert
      expect(result).toEqual(expectedTime);
    });

    it("should return same time when no config exists", () => {
      // Arrange
      const eventStartTime = new Date(TEST_BASE_TIME);

      // Act
      const result = delayHandlingService.getTimeToStartEvent(mockEventWithoutDelay);

      // Assert
      expect(result).toEqual(eventStartTime);
    });

    it("should apply EventStart-specific delay when configured", () => {
      // Arrange
      const eventStartSpecificDelay = 3000;
      const customConfig = {
        globalDelayInMillisecond: TEST_GLOBAL_DELAY,
        videoDelayInMillisecond: TEST_PRELOAD_DURATION_MS,
        eventScheduleStartDelayInMillisecond: eventStartSpecificDelay,
      };
      const customEvent: any = {
        ...mockEventWithDelay,
        config: { delay: customConfig },
      };
      const expectedTime = new Date(new Date(TEST_BASE_TIME).getTime() + TEST_GLOBAL_DELAY + eventStartSpecificDelay);

      // Act
      const result = delayHandlingService.getTimeToStartEvent(customEvent);

      // Assert
      expect(result).toEqual(expectedTime);
    });
  });

  describe("getTimeToStream", () => {
    it("should return delayed time with preload duration for event detail start", () => {
      // Arrange
      const index = 0;
      const eventDetailTime = new Date(TEST_EVENT_DETAIL_TIME);
      const expectedTime = new Date(eventDetailTime.getTime() + TEST_GLOBAL_DELAY + TEST_PRELOAD_DURATION_MS);

      // Act
      const result = delayHandlingService.getTimeToStream(mockEventWithDelay, index);

      // Assert
      expect(result).toEqual(expectedTime);
    });

    it("should use event detail scheduleStartTs at specified index", () => {
      // Arrange
      const index = 1;
      const eventDetailTime = new Date(TEST_EVENT_DETAIL_TIME);
      const expectedTime = new Date(eventDetailTime.getTime() + TEST_GLOBAL_DELAY + TEST_PRELOAD_DURATION_MS);

      // Act
      const result = delayHandlingService.getTimeToStream(mockEventWithDelay, index);

      // Assert
      expect(result).toEqual(expectedTime);
    });

    it("should return same time when no config exists", () => {
      // Arrange
      const index = 0;
      const eventWithDetails: any = {
        ...mockEventWithoutDelay,
        eventDetails: [
          {
            phase: 1,
            scheduleStartTs: TEST_EVENT_DETAIL_TIME,
            resultsAvailableTs: TEST_EVENT_DETAIL_TIME,
          },
        ],
      };
      const eventDetailTime = new Date(TEST_EVENT_DETAIL_TIME);

      // Act
      const result = delayHandlingService.getTimeToStream(eventWithDetails, index);

      // Assert
      expect(result).toEqual(eventDetailTime);
    });

    it("should apply both global delay and preload duration", () => {
      // Arrange
      const index = 0;
      const eventDetailTime = new Date(TEST_EVENT_DETAIL_TIME);

      // Act
      const result = delayHandlingService.getTimeToStream(mockEventWithDelay, index);

      // Assert - should include both delays
      const expectedTime = new Date(eventDetailTime.getTime() + TEST_GLOBAL_DELAY + TEST_PRELOAD_DURATION_MS);
      expect(result).toEqual(expectedTime);
    });

    it("should apply EventDetailStart-specific delay when configured", () => {
      // Arrange
      const index = 0;
      const eventDetailStartSpecificDelay = 1500;
      const customConfig = {
        globalDelayInMillisecond: TEST_GLOBAL_DELAY,
        videoDelayInMillisecond: TEST_PRELOAD_DURATION_MS,
        eventDetailScheduleStartDelayInMillisecond: eventDetailStartSpecificDelay,
      };
      const customEvent: any = {
        ...mockEventWithDelay,
        config: { delay: customConfig },
        eventConfig: { preloadDurationMs: TEST_PRELOAD_DURATION_MS },
      };
      const expectedTime = new Date(
        new Date(TEST_EVENT_DETAIL_TIME).getTime() +
          TEST_GLOBAL_DELAY +
          TEST_PRELOAD_DURATION_MS +
          eventDetailStartSpecificDelay
      );

      // Act
      const result = delayHandlingService.getTimeToStream(customEvent, index);

      // Assert
      expect(result).toEqual(expectedTime);
    });

    it("should handle different event detail indices", () => {
      // Arrange
      const customEventDetailTime1 = "2023-01-01T11:00:00Z";
      const customEventDetailTime2 = "2023-01-01T11:30:00Z";
      const customEvent: any = {
        ...mockEventWithDelay,
        eventDetails: [
          {
            phase: 1,
            scheduleStartTs: customEventDetailTime1,
            resultsAvailableTs: customEventDetailTime1,
          },
          {
            phase: 2,
            scheduleStartTs: customEventDetailTime2,
            resultsAvailableTs: customEventDetailTime2,
          },
        ],
      };

      // Act
      const result1 = delayHandlingService.getTimeToStream(customEvent, 0);
      const result2 = delayHandlingService.getTimeToStream(customEvent, 1);

      // Assert
      const expectedTime1 = new Date(
        new Date(customEventDetailTime1).getTime() + TEST_GLOBAL_DELAY + TEST_PRELOAD_DURATION_MS
      );
      const expectedTime2 = new Date(
        new Date(customEventDetailTime2).getTime() + TEST_GLOBAL_DELAY + TEST_PRELOAD_DURATION_MS
      );
      expect(result1).toEqual(expectedTime1);
      expect(result2).toEqual(expectedTime2);
    });

    it("should apply EventDetailResultsAvailable delay when oddsFeedEventType is EventDetailResultsAvailable", () => {
      // Arrange
      const eventDetailResultAvailableDelay = 2500;
      const config = {
        globalDelayInMillisecond: TEST_GLOBAL_DELAY,
        eventDetailResultAvailableDelayInMillisecond: eventDetailResultAvailableDelay,
      };
      const baseTime = new Date(TEST_BASE_TIME);
      const eventWithConfig: any = {
        ...mockEventWithDelay,
        config: { delay: config },
      };

      // Act
      const result = delayHandlingService.getDelayedTime(
        { event: eventWithConfig, time: baseTime },
        { oddsFeedEventType: OddsFeedEventName.EventDetailResultsAvailable }
      );

      // Assert
      expect(result).toEqual(new Date(baseTime.getTime() + TEST_GLOBAL_DELAY + eventDetailResultAvailableDelay));
    });

    it("should apply EventDetailStart delay with preload duration when using getDelayedTimeWithVideoDelay", () => {
      // Arrange
      const eventDetailStartDelay = 1500;
      const config = {
        globalDelayInMillisecond: TEST_GLOBAL_DELAY,
        eventDetailScheduleStartDelayInMillisecond: eventDetailStartDelay,
      };
      const baseTime = new Date(TEST_BASE_TIME);
      const eventWithConfig: any = {
        ...mockEventWithDelay,
        config: { delay: config },
        eventConfig: { preloadDurationMs: TEST_PRELOAD_DURATION_MS },
      };

      // Act
      const result = delayHandlingService.getDelayedTimeWithVideoDelay(
        { event: eventWithConfig, time: baseTime },
        { oddsFeedEventType: OddsFeedEventName.EventDetailStart }
      );

      // Assert
      expect(result).toEqual(
        new Date(baseTime.getTime() + TEST_GLOBAL_DELAY + eventDetailStartDelay + TEST_PRELOAD_DURATION_MS)
      );
    });
  });
});
