import { DelayHandlingService } from "../../../../src/features/delay/delay-handling-service";
import { Event } from "odds-feed-client";

const TEST_GLOBAL_DELAY = 5000;
const TEST_VIDEO_DELAY = 2000;
const TEST_BASE_TIME = '2023-01-01T10:00:00Z';

const mockDelayConfig = {
    globalDelayInMillisecond: TEST_GLOBAL_DELAY,
    videoDelayInMillisecond: TEST_VIDEO_DELAY,
};

const mockEventWithDelay: Event & { config: { delay: typeof mockDelayConfig } } = {
    eventID: 4294967298,
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

describe('DelayHandlingService', () => {
    let delayHandlingService: DelayHandlingService;

    beforeEach(() => {
        delayHandlingService = new DelayHandlingService();
    });

    describe('getDelayedTime', () => {
        it('should return time with global delay when config exists', () => {
            // Arrange
            const baseTime = new Date(TEST_BASE_TIME);
            const expectedTime = new Date(baseTime.getTime() + TEST_GLOBAL_DELAY);

            // Act
            const result = delayHandlingService.getDelayedTime({
                event: mockEventWithDelay,
                time: baseTime
            });

            // Assert
            expect(result).toEqual(expectedTime);
        });

        it('should return same time object when no config exists', () => {
            // Arrange
            const baseTime = new Date(TEST_BASE_TIME);
            const eventWithoutConfig: Event = mockEventWithoutDelay;

            // Act
            const result = delayHandlingService.getDelayedTime({
                event: eventWithoutConfig,
                time: baseTime
            });

            // Assert
            expect(result).toEqual(baseTime);
            expect(result).toBe(baseTime);
        });

        it('should not mutate the original time object', () => {
            // Arrange
            const baseTime = new Date(TEST_BASE_TIME);
            const originalTime = baseTime.getTime();

            // Act
            delayHandlingService.getDelayedTime({
                event: mockEventWithDelay,
                time: baseTime
            });

            // Assert
            expect(baseTime.getTime()).toBe(originalTime);
        });

        it('should handle zero global delay correctly', () => {
            // Arrange
            const zeroGlobalDelayConfig = {
                globalDelayInMillisecond: 0,
                videoDelayInMillisecond: TEST_VIDEO_DELAY,
            };
            const baseTime = new Date(TEST_BASE_TIME);
            const eventWithConfig: any = {
                ...mockEventWithDelay,
                config: { delay: zeroGlobalDelayConfig }
            };

            // Act
            const result = delayHandlingService.getDelayedTime({
                event: eventWithConfig,
                time: baseTime
            });

            // Assert
            expect(result).toEqual(baseTime);
        });

        it('should handle negative delays correctly', () => {
            // Arrange
            const negativeDelayConfig = {
                globalDelayInMillisecond: -1000,
                videoDelayInMillisecond: -500,
            };
            const baseTime = new Date(TEST_BASE_TIME);
            const eventWithConfig: any = {
                ...mockEventWithDelay,
                config: { delay: negativeDelayConfig }
            };

            // Act
            const result = delayHandlingService.getDelayedTime({
                event: eventWithConfig,
                time: baseTime
            });

            // Assert
            expect(result).toEqual(new Date(baseTime.getTime() - 1000));
        });
    });

    describe('getDelayedTimeWithVideoDelay', () => {
        it('should return time with both global and video delay when config exists', () => {
            // Arrange
            const baseTime = new Date(TEST_BASE_TIME);
            const expectedTime = new Date(baseTime.getTime() + TEST_GLOBAL_DELAY + TEST_VIDEO_DELAY);

            // Act
            const result = delayHandlingService.getDelayedTimeWithVideoDelay({
                event: mockEventWithDelay,
                time: baseTime
            });

            // Assert
            expect(result).toEqual(expectedTime);
        });

        it('should return same time object when no config exists', () => {
            // Arrange
            const baseTime = new Date(TEST_BASE_TIME);
            const eventWithoutConfig: Event = mockEventWithoutDelay;

            // Act
            const result = delayHandlingService.getDelayedTimeWithVideoDelay({
                event: eventWithoutConfig,
                time: baseTime
            });

            // Assert
            expect(result).toEqual(baseTime);
            expect(result).toBe(baseTime);
        });

        it('should not mutate the original time object', () => {
            // Arrange
            const baseTime = new Date(TEST_BASE_TIME);
            const originalTime = baseTime.getTime();

            // Act
            delayHandlingService.getDelayedTimeWithVideoDelay({
                event: mockEventWithDelay,
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
                event: mockEventWithDelay,
                time: baseTime
            });
            const fullDelayedTime = delayHandlingService.getDelayedTimeWithVideoDelay({
                event: mockEventWithDelay,
                time: baseTime
            });

            // Assert
            const expectedIntermediateTime = new Date(baseTime.getTime() + TEST_GLOBAL_DELAY);
            const expectedFinalTime = new Date(expectedIntermediateTime.getTime() + TEST_VIDEO_DELAY);
            
            expect(globalDelayedTime).toEqual(expectedIntermediateTime);
            expect(fullDelayedTime).toEqual(expectedFinalTime);
        });

        it('should handle zero video delay correctly', () => {
            // Arrange
            const zeroVideoDelayConfig = {
                globalDelayInMillisecond: TEST_GLOBAL_DELAY,
                videoDelayInMillisecond: 0,
            };
            const baseTime = new Date(TEST_BASE_TIME);
            const eventWithConfig: any = {
                ...mockEventWithDelay,
                config: { delay: zeroVideoDelayConfig }
            };

            // Act
            const result = delayHandlingService.getDelayedTimeWithVideoDelay({
                event: eventWithConfig,
                time: baseTime
            });

            // Assert
            expect(result).toEqual(new Date(baseTime.getTime() + TEST_GLOBAL_DELAY));
        });

        it('should handle negative delays correctly', () => {
            // Arrange
            const negativeDelayConfig = {
                globalDelayInMillisecond: -1000,
                videoDelayInMillisecond: -500,
            };
            const baseTime = new Date(TEST_BASE_TIME);
            const eventWithConfig: any = {
                ...mockEventWithDelay,
                config: { delay: negativeDelayConfig }
            };

            // Act
            const result = delayHandlingService.getDelayedTimeWithVideoDelay({
                event: eventWithConfig,
                time: baseTime
            });

            // Assert
            expect(result).toEqual(new Date(baseTime.getTime() - 1500));
        });
    });

    describe('Pure function behavior', () => {
        it('should be a pure function - same inputs produce same output', () => {
            // Arrange
            const baseTime = new Date(TEST_BASE_TIME);

            // Act
            const result1 = delayHandlingService.getDelayedTime({
                event: mockEventWithDelay,
                time: baseTime
            });
            const result2 = delayHandlingService.getDelayedTime({
                event: mockEventWithDelay,
                time: baseTime
            });

            // Assert
            expect(result1).toEqual(result2);
        });

        it('should handle multiple events with different delay configurations independently', () => {
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
    });
});
