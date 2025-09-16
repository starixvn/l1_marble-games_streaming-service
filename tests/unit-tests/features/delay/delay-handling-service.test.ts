import { DelayHandlingService } from "../../../../src/features/delay/delay-handling-service";
import { OddFeedEventSource, OddFeedEventName, EventNotification } from "../../../../src/features/odd-feed-data";
import { Event } from "../../../../src/types";

// Mock dependencies
const mockOddFeedEventSource = {
    registerEventListener: jest.fn(),
    unregisterEventListener: jest.fn(),
} as unknown as jest.Mocked<OddFeedEventSource>;

// Test constants
const TEST_EVENT_ID = 4294967298; // gameId: 1, roundId: 2
const TEST_GLOBAL_DELAY = 5000; // 5 seconds
const TEST_VIDEO_DELAY = 2000; // 2 seconds
const TEST_BASE_TIME = '2023-01-01T10:00:00Z';

// Test data
const mockDelayConfig = {
    globalDelayInMillisecond: TEST_GLOBAL_DELAY,
    videoDelayInMillisecond: TEST_VIDEO_DELAY,
};

const mockEventWithDelay: Event & { config: { delay: typeof mockDelayConfig } } = {
    eventID: TEST_EVENT_ID,
    eventNameAKey: "Team A",
    eventNameBKey: "Team B",
    scheduleStartTs: TEST_BASE_TIME,
    productCode: "TEST",
    productTypeKey: "MARBLE",
    eventDetails: [],
    config: {
        delay: mockDelayConfig
    }
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

const mockEventNotificationWithDelay: EventNotification = {
    event: mockEventWithDelay
};

const mockEventNotificationWithoutDelay: EventNotification = {
    event: mockEventWithoutDelay
};

// Helper functions for test setup
const createContainer = () => ({
    oddFeedEventSource: mockOddFeedEventSource,
});

const setupMocks = () => {
    jest.clearAllMocks();
};

describe('DelayHandlingService', () => {
    let delayHandlingService: DelayHandlingService;
    let container: any;

    beforeEach(() => {
        setupMocks();
        container = createContainer();
        delayHandlingService = new DelayHandlingService(container);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Constructor', () => {
        it('should initialize with dependencies and bind event handlers', () => {
            // Arrange & Act
            const service = new DelayHandlingService(container);

            // Assert
            expect(service['oddsFeedEventSource']).toBe(mockOddFeedEventSource);
            expect(service['boundHandleEventUpcoming']).toBeInstanceOf(Function);
        });

        it('should initialize empty delay config tracking object', () => {
            // Arrange & Act
            const service = new DelayHandlingService(container);

            // Assert
            expect(service['_delayConfigByEventId']).toEqual({});
        });
    });

    describe('Event Listener Management', () => {
        describe('initEvent', () => {
            it('should register event listener for EventUpcoming', () => {
                // Arrange & Act
                delayHandlingService.initEvent();

                // Assert
                expect(mockOddFeedEventSource.registerEventListener).toHaveBeenCalledWith(
                    OddFeedEventName.EventUpcoming,
                    delayHandlingService['boundHandleEventUpcoming']
                );
            });
        });

        describe('dispose', () => {
            it('should unregister event listener for EventUpcoming', () => {
                // Arrange & Act
                const result = delayHandlingService.dispose();

                // Assert
                expect(mockOddFeedEventSource.unregisterEventListener).toHaveBeenCalledWith(
                    OddFeedEventName.EventUpcoming,
                    delayHandlingService['boundHandleEventUpcoming']
                );
                expect(result).toBe(delayHandlingService);
            });

            it('should return the service instance for method chaining', () => {
                // Arrange & Act
                const result = delayHandlingService.dispose();

                // Assert
                expect(result).toBe(delayHandlingService);
            });
        });
    });

    describe('Delay Configuration Management', () => {
        beforeEach(() => {
            // Set up some test delay configurations
            delayHandlingService['_delayConfigByEventId'][TEST_EVENT_ID] = mockDelayConfig;
        });

        describe('getDelayConfig', () => {
            it('should return delay config for existing event ID', () => {
                // Arrange
                const eventId = TEST_EVENT_ID;

                // Act
                const result = delayHandlingService.getDelayConfig(eventId);

                // Assert
                expect(result).toEqual(mockDelayConfig);
            });

            it('should return undefined for non-existing event ID', () => {
                // Arrange
                const eventId = 999999;

                // Act
                const result = delayHandlingService.getDelayConfig(eventId);

                // Assert
                expect(result).toBeUndefined();
            });
        });

        describe('handleEventUpcoming', () => {
            it('should store delay config when event has delay configuration', () => {
                // Arrange
                const eventId = mockEventWithDelay.eventID;

                // Act
                delayHandlingService.handleEventUpcoming(mockEventNotificationWithDelay);

                // Assert
                expect(delayHandlingService['_delayConfigByEventId'][eventId]).toEqual(mockDelayConfig);
            });

            it('should throw error when event has no config property', () => {
                // Arrange & Act & Assert
                expect(() => {
                    delayHandlingService.handleEventUpcoming(mockEventNotificationWithoutDelay);
                }).toThrow('Cannot read properties of undefined');
            });

            it('should overwrite existing delay config for the same event ID', () => {
                // Arrange
                const eventId = TEST_EVENT_ID;
                const newDelayConfig = {
                    globalDelayInMillisecond: 10000,
                    videoDelayInMillisecond: 3000,
                };
                const eventWithNewDelay = {
                    ...mockEventWithDelay,
                    config: { delay: newDelayConfig }
                };
                const notification: EventNotification = { event: eventWithNewDelay as any };

                // Act
                delayHandlingService.handleEventUpcoming(notification);

                // Assert
                expect(delayHandlingService['_delayConfigByEventId'][eventId]).toEqual(newDelayConfig);
            });
        });
    });

    describe('Time Delay Calculations', () => {
        beforeEach(() => {
            // Set up test delay configuration
            delayHandlingService['_delayConfigByEventId'][TEST_EVENT_ID] = mockDelayConfig;
        });

        describe('getDelayedTime', () => {
            it('should return time with global delay when config exists', () => {
                // Arrange
                const baseTime = new Date(TEST_BASE_TIME);
                const expectedTime = new Date(baseTime.getTime() + TEST_GLOBAL_DELAY);

                // Act
                const result = delayHandlingService.getDelayedTime({
                    eventId: TEST_EVENT_ID,
                    time: baseTime
                });

                // Assert
                expect(result).toEqual(expectedTime);
            });

            it('should return same time object when no config exists', () => {
                // Arrange
                const baseTime = new Date(TEST_BASE_TIME);
                const nonExistentEventId = 999999;

                // Act
                const result = delayHandlingService.getDelayedTime({
                    eventId: nonExistentEventId,
                    time: baseTime
                });

                // Assert
                expect(result).toEqual(baseTime);
                expect(result).toBe(baseTime); // Returns the same Date object
            });

            it('should not mutate the original time object', () => {
                // Arrange
                const baseTime = new Date(TEST_BASE_TIME);
                const originalTime = baseTime.getTime();

                // Act
                delayHandlingService.getDelayedTime({
                    eventId: TEST_EVENT_ID,
                    time: baseTime
                });

                // Assert
                expect(baseTime.getTime()).toBe(originalTime);
            });
        });

        describe('getDelayedTimeWithVideoDelay', () => {
            it('should return time with both global and video delay when config exists', () => {
                // Arrange
                const baseTime = new Date(TEST_BASE_TIME);
                const expectedTime = new Date(baseTime.getTime() + TEST_GLOBAL_DELAY + TEST_VIDEO_DELAY);

                // Act
                const result = delayHandlingService.getDelayedTimeWithVideoDelay({
                    eventId: TEST_EVENT_ID,
                    time: baseTime
                });

                // Assert
                expect(result).toEqual(expectedTime);
            });

            it('should return same time object when no config exists', () => {
                // Arrange
                const baseTime = new Date(TEST_BASE_TIME);
                const nonExistentEventId = 999999;

                // Act
                const result = delayHandlingService.getDelayedTimeWithVideoDelay({
                    eventId: nonExistentEventId,
                    time: baseTime
                });

                // Assert
                expect(result).toEqual(baseTime);
                expect(result).toBe(baseTime); // Returns the same Date object
            });

            it('should not mutate the original time object', () => {
                // Arrange
                const baseTime = new Date(TEST_BASE_TIME);
                const originalTime = baseTime.getTime();

                // Act
                delayHandlingService.getDelayedTimeWithVideoDelay({
                    eventId: TEST_EVENT_ID,
                    time: baseTime
                });

                // Assert
                expect(baseTime.getTime()).toBe(originalTime);
            });

            it('should apply delays in correct order (global first, then video)', () => {
                // Arrange
                const baseTime = new Date(TEST_BASE_TIME);
                
                // Act
                const globalDelayedTime = delayHandlingService.getDelayedTime({
                    eventId: TEST_EVENT_ID,
                    time: baseTime
                });
                const fullDelayedTime = delayHandlingService.getDelayedTimeWithVideoDelay({
                    eventId: TEST_EVENT_ID,
                    time: baseTime
                });

                // Assert
                const expectedIntermediateTime = new Date(baseTime.getTime() + TEST_GLOBAL_DELAY);
                const expectedFinalTime = new Date(expectedIntermediateTime.getTime() + TEST_VIDEO_DELAY);
                
                expect(globalDelayedTime).toEqual(expectedIntermediateTime);
                expect(fullDelayedTime).toEqual(expectedFinalTime);
            });
        });
    });

    describe('Edge Cases and Error Scenarios', () => {
        describe('Zero delay configurations', () => {
            it('should handle zero global delay correctly', () => {
                // Arrange
                const zeroGlobalDelayConfig = {
                    globalDelayInMillisecond: 0,
                    videoDelayInMillisecond: TEST_VIDEO_DELAY,
                };
                delayHandlingService['_delayConfigByEventId'][TEST_EVENT_ID] = zeroGlobalDelayConfig;
                const baseTime = new Date(TEST_BASE_TIME);

                // Act
                const globalDelayResult = delayHandlingService.getDelayedTime({
                    eventId: TEST_EVENT_ID,
                    time: baseTime
                });
                const videoDelayResult = delayHandlingService.getDelayedTimeWithVideoDelay({
                    eventId: TEST_EVENT_ID,
                    time: baseTime
                });

                // Assert
                expect(globalDelayResult).toEqual(baseTime);
                expect(videoDelayResult).toEqual(new Date(baseTime.getTime() + TEST_VIDEO_DELAY));
            });

            it('should handle zero video delay correctly', () => {
                // Arrange
                const zeroVideoDelayConfig = {
                    globalDelayInMillisecond: TEST_GLOBAL_DELAY,
                    videoDelayInMillisecond: 0,
                };
                delayHandlingService['_delayConfigByEventId'][TEST_EVENT_ID] = zeroVideoDelayConfig;
                const baseTime = new Date(TEST_BASE_TIME);

                // Act
                const globalDelayResult = delayHandlingService.getDelayedTime({
                    eventId: TEST_EVENT_ID,
                    time: baseTime
                });
                const videoDelayResult = delayHandlingService.getDelayedTimeWithVideoDelay({
                    eventId: TEST_EVENT_ID,
                    time: baseTime
                });

                // Assert
                expect(globalDelayResult).toEqual(new Date(baseTime.getTime() + TEST_GLOBAL_DELAY));
                expect(videoDelayResult).toEqual(new Date(baseTime.getTime() + TEST_GLOBAL_DELAY));
            });
        });

        describe('Negative delay configurations', () => {
            it('should handle negative delays correctly', () => {
                // Arrange
                const negativeDelayConfig = {
                    globalDelayInMillisecond: -1000,
                    videoDelayInMillisecond: -500,
                };
                delayHandlingService['_delayConfigByEventId'][TEST_EVENT_ID] = negativeDelayConfig;
                const baseTime = new Date(TEST_BASE_TIME);

                // Act
                const globalDelayResult = delayHandlingService.getDelayedTime({
                    eventId: TEST_EVENT_ID,
                    time: baseTime
                });
                const videoDelayResult = delayHandlingService.getDelayedTimeWithVideoDelay({
                    eventId: TEST_EVENT_ID,
                    time: baseTime
                });

                // Assert
                expect(globalDelayResult).toEqual(new Date(baseTime.getTime() - 1000));
                expect(videoDelayResult).toEqual(new Date(baseTime.getTime() - 1500));
            });
        });

        describe('Multiple events handling', () => {
            it('should handle multiple events with different delay configurations independently', () => {
                // Arrange
                const eventId1 = TEST_EVENT_ID;
                const eventId2 = 8589934594; // Different event ID
                const config1 = { globalDelayInMillisecond: 1000, videoDelayInMillisecond: 500 };
                const config2 = { globalDelayInMillisecond: 2000, videoDelayInMillisecond: 1000 };
                
                delayHandlingService['_delayConfigByEventId'][eventId1] = config1;
                delayHandlingService['_delayConfigByEventId'][eventId2] = config2;
                
                const baseTime = new Date(TEST_BASE_TIME);

                // Act
                const result1 = delayHandlingService.getDelayedTime({ eventId: eventId1, time: baseTime });
                const result2 = delayHandlingService.getDelayedTime({ eventId: eventId2, time: baseTime });

                // Assert
                expect(result1).toEqual(new Date(baseTime.getTime() + 1000));
                expect(result2).toEqual(new Date(baseTime.getTime() + 2000));
            });
        });

        describe('Bound methods preservation', () => {
            it('should maintain correct context when bound method is called directly', () => {
                // Arrange
                const boundHandler = delayHandlingService['boundHandleEventUpcoming'];
                const eventId = mockEventWithDelay.eventID;

                // Act - Call bound method directly (as it would be called by event emitter)
                boundHandler(mockEventNotificationWithDelay);

                // Assert
                expect(delayHandlingService['_delayConfigByEventId'][eventId]).toEqual(mockDelayConfig);
            });
        });

        describe('Event with malformed config', () => {
            it('should throw error when event has null config', () => {
                // Arrange
                const eventWithNullConfig = {
                    ...mockEventWithDelay,
                    config: null
                };
                const notification: EventNotification = { event: eventWithNullConfig as any };

                // Act & Assert
                expect(() => {
                    delayHandlingService.handleEventUpcoming(notification);
                }).toThrow('Cannot read properties of null');
            });

            it('should not store config when event has undefined config.delay', () => {
                // Arrange
                const eventWithUndefinedDelay = {
                    ...mockEventWithDelay,
                    config: { delay: undefined }
                };
                const notification: EventNotification = { event: eventWithUndefinedDelay as any };
                const initialConfigCount = Object.keys(delayHandlingService['_delayConfigByEventId']).length;

                // Act
                delayHandlingService.handleEventUpcoming(notification);

                // Assert - should not store anything since delay is undefined
                expect(Object.keys(delayHandlingService['_delayConfigByEventId']).length).toBe(initialConfigCount);
            });
        });
    });
});
