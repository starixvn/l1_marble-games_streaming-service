import { IntroService } from "../../../../src/features/intro/intro-service";
import { OddFeedEventSource, OddFeedEventName, EventNotification, SystemNotification } from "../../../../src/features/odd-feed-data";
import { DelayHandlingService } from "../../../../src/features/delay/delay-handling-service";
import { Scheduler } from "../../../../src/features/scheduler/scheduler";
import { GameBroadcastService } from "../../../../src/services/game-broadcast.service";
import { FeatureDebugService } from "../../../../src/features/feature-debug/feature-debug-service";
import { idHelper } from "../../../../src/helpers";
import { createMockEvent, createMockEventDetail } from "../../test-utils/mock-event";

// Mock dependencies
const mockOddFeedEventSource = {
    registerEventListener: jest.fn(),
    unregisterEventListener: jest.fn(),
    registerSystemDataCleanupEventListener: jest.fn(),
    unregisterSystemDataCleanupEventListener: jest.fn(),
} as unknown as jest.Mocked<OddFeedEventSource>;

const mockDelayHandlingService = {
    getDelayedTime: jest.fn(),
} as unknown as jest.Mocked<DelayHandlingService>;

const mockScheduler = {
    schedule: jest.fn().mockReturnValue('scheduled-id'),
} as unknown as jest.Mocked<Scheduler>;

const mockGameBoardcastService = {
    broadcastToAllClientByGameId: jest.fn(),
} as unknown as jest.Mocked<GameBroadcastService>;

const mockFeatureDebugService = {
    log: jest.fn(),
} as unknown as jest.Mocked<FeatureDebugService>;

// Test constants
const TEST_DELAYED_TIME = new Date('2023-01-01T10:05:00Z');
const TEST_DELAYED_TIME_HALFTIME = new Date('2023-01-01T10:15:00Z');
const TEST_GAME_ID = '1';
const TEST_EVENT_ID = 4294967298; // gameId: 1, roundId: 2
const TEST_SCHEDULE_START_TS = "2023-01-01T10:00:00Z";
const TEST_DURATION = 30; // 30 seconds
const TEST_RESOURCE_SERVER = "https://example.com/intro";
const TEST_TIME_TO_PLAY = 1640995200000;

// Test data using shared mock utils
const mockEventWithIntroConfig = {
    ...createMockEvent({
        eventID: TEST_EVENT_ID,
        scheduleStartTs: TEST_SCHEDULE_START_TS,
        eventDetails: [
            createMockEventDetail({ 
                phase: 0,
                scheduleStartTs: TEST_SCHEDULE_START_TS
            }),
            createMockEventDetail({ 
                phase: 1,
                scheduleStartTs: "2023-01-01T10:20:00Z"
            }),
        ]
    }),
    config: {
        intro: {
            resourceServer: TEST_RESOURCE_SERVER,
            duration: TEST_DURATION
        }
    }
};

const mockEventWithoutIntroConfig = createMockEvent({
    eventID: TEST_EVENT_ID,
    scheduleStartTs: TEST_SCHEDULE_START_TS,
});

const mockEventNotificationWithConfig: EventNotification = {
    event: mockEventWithIntroConfig as any
};

const mockEventNotificationWithoutConfig: EventNotification = {
    event: mockEventWithoutIntroConfig
};

const mockSystemNotification: SystemNotification = {
    eventID: TEST_EVENT_ID
};

// Helper functions for test setup
const createContainer = () => ({
    oddFeedEventSource: mockOddFeedEventSource,
    scheduler: mockScheduler,
    delayHandlingService: mockDelayHandlingService,
    gameBoardcastService: mockGameBoardcastService,
    featureDebugService: mockFeatureDebugService,
});

const setupMocks = () => {
    jest.clearAllMocks();
    mockDelayHandlingService.getDelayedTime.mockReturnValue(TEST_DELAYED_TIME);
    
    // Mock Date.now for consistent testing
    jest.spyOn(Date, 'now').mockReturnValue(TEST_TIME_TO_PLAY + 15000); // 15 seconds after start
};

describe('IntroService', () => {
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

    describe('constructor', () => {
        it('should initialize with all dependencies and bind event handlers', () => {
            // Arrange & Act
            const service = new IntroService(container);

            // Assert
            expect(service['oddFeedEventSource']).toBe(mockOddFeedEventSource);
            expect(service['scheduler']).toBe(mockScheduler);
            expect(service['delayHandlingService']).toBe(mockDelayHandlingService);
            expect(service['gameBoardcastService']).toBe(mockGameBoardcastService);
            expect(service['featureDebugService']).toBe(mockFeatureDebugService);
            expect(service['boundHandleEventUpcoming']).toBeInstanceOf(Function);
            expect(service['boundHandleEventStart']).toBeInstanceOf(Function);
            expect(service['boundHandleEventCleanup']).toBeInstanceOf(Function);
        });

        it('should initialize empty intro tracking objects', () => {
            // Arrange & Act
            const service = new IntroService(container);

            // Assert
            expect(service['_introByGameId']).toEqual({});
            expect(service['_introConfigByEventId']).toEqual({});
        });
    });

    describe('eventName', () => {
        it('should return "intro"', () => {
            // Act
            const result = introService.eventName;

            // Assert
            expect(result).toBe('intro');
        });
    });

    describe('initEvent', () => {
        it('should register all required event listeners', () => {
            // Arrange & Act
            introService.initEvent();

            // Assert
            expect(mockOddFeedEventSource.registerEventListener).toHaveBeenCalledWith(
                OddFeedEventName.EventUpcoming,
                introService['boundHandleEventUpcoming']
            );
            expect(mockOddFeedEventSource.registerEventListener).toHaveBeenCalledWith(
                OddFeedEventName.EventStart,
                introService['boundHandleEventStart']
            );
            expect(mockOddFeedEventSource.registerSystemDataCleanupEventListener).toHaveBeenCalledWith(
                introService['boundHandleEventCleanup']
            );
        });
    });

    describe('dispose', () => {
        it('should unregister all event listeners', () => {
            // Arrange & Act
            introService.dispose();

            // Assert
            expect(mockOddFeedEventSource.unregisterEventListener).toHaveBeenCalledWith(
                OddFeedEventName.EventUpcoming,
                introService['boundHandleEventUpcoming']
            );
            expect(mockOddFeedEventSource.unregisterEventListener).toHaveBeenCalledWith(
                OddFeedEventName.EventStart,
                introService['boundHandleEventStart']
            );
            expect(mockOddFeedEventSource.unregisterSystemDataCleanupEventListener).toHaveBeenCalledWith(
                introService['boundHandleEventCleanup']
            );
        });
    });

    describe('getCurrentByGameId', () => {
        it('should return intro state for existing game', () => {
            // Arrange
            const expectedState = {
                resourceServer: TEST_RESOURCE_SERVER,
                introTime: 15,
                timeToPlay: TEST_TIME_TO_PLAY,
                isPlaying: true,
                duration: TEST_DURATION
            };
            introService['_introByGameId'][TEST_GAME_ID] = expectedState;

            // Act
            const result = introService.getCurrentByGameId(TEST_GAME_ID);

            // Assert
            expect(result).toBe(expectedState);
        });

        it('should return undefined for non-existing game', () => {
            // Act
            const result = introService.getCurrentByGameId('999');

            // Assert
            expect(result).toBeUndefined();
        });
    });

    describe('handleEventUpcoming', () => {
        it('should store intro config when config is present', () => {
            // Act
            introService.handleEventUpcoming(mockEventNotificationWithConfig);

            // Assert
            expect(introService['_introConfigByEventId'][TEST_EVENT_ID]).toEqual({
                resourceServer: TEST_RESOURCE_SERVER,
                duration: TEST_DURATION
            });
        });

        it('should not store config when intro config is missing', () => {
            // Arrange
            const eventWithoutIntroConfig = {
                event: {
                    ...mockEventWithoutIntroConfig,
                    config: {}
                }
            };

            // Act
            introService.handleEventUpcoming(eventWithoutIntroConfig as any);

            // Assert
            expect(introService['_introConfigByEventId'][TEST_EVENT_ID]).toBeUndefined();
        });

        it('should handle missing config gracefully', () => {
            // Arrange - Create event with config but no intro property
            const eventWithEmptyConfig = {
                event: {
                    ...mockEventWithoutIntroConfig,
                    config: { other: "value" } // config exists but no intro
                }
            };

            // Act & Assert - should not throw and should not store config
            expect(() => {
                introService.handleEventUpcoming(eventWithEmptyConfig as any);
            }).not.toThrow();
            
            expect(introService['_introConfigByEventId'][TEST_EVENT_ID]).toBeUndefined();
        });
    });

    describe('handleEventStart', () => {
        beforeEach(() => {
            // Set up intro config
            introService['_introConfigByEventId'][TEST_EVENT_ID] = {
                resourceServer: TEST_RESOURCE_SERVER,
                duration: TEST_DURATION
            };
        });

        it('should schedule prebet and halftime intros when duration is available', () => {
            // Arrange
            mockDelayHandlingService.getDelayedTime
                .mockReturnValueOnce(TEST_DELAYED_TIME) // prebet intro
                .mockReturnValueOnce(TEST_DELAYED_TIME_HALFTIME); // halftime intro

            // Act
            introService.handleEventStart(mockEventNotificationWithConfig);

            // Assert
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledTimes(2);
            expect(mockScheduler.schedule).toHaveBeenCalledTimes(2);
            expect(mockScheduler.schedule).toHaveBeenNthCalledWith(1, TEST_DELAYED_TIME, expect.any(Function));
            expect(mockScheduler.schedule).toHaveBeenNthCalledWith(2, TEST_DELAYED_TIME_HALFTIME, expect.any(Function));
        });

        it('should not schedule intros when duration is not available', () => {
            // Arrange
            delete introService['_introConfigByEventId'][TEST_EVENT_ID];

            // Act
            introService.handleEventStart(mockEventNotificationWithConfig);

            // Assert
            expect(mockScheduler.schedule).not.toHaveBeenCalled();
        });

        it('should calculate correct times for prebet and halftime intros', () => {
            // Act
            introService.handleEventStart(mockEventNotificationWithConfig);

            // Assert
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenNthCalledWith(1, {
                eventId: TEST_EVENT_ID,
                time: new Date(mockEventWithIntroConfig.scheduleStartTs)
            });
            
            // Second call should be for halftime intro (phase 1 start time - duration)
            const expectedHalfTimeStart = new Date(mockEventWithIntroConfig.eventDetails[1].scheduleStartTs);
            const expectedHalfTimeIntroStart = new Date(expectedHalfTimeStart.getTime() - (TEST_DURATION * 1000));
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenNthCalledWith(2, {
                eventId: TEST_EVENT_ID,
                time: expectedHalfTimeIntroStart
            });
        });

        it('should execute scheduled intro correctly', () => {
            // Act
            introService.handleEventStart(mockEventNotificationWithConfig);

            // Get the scheduled callback and execute it
            const scheduleCalls = mockScheduler.schedule.mock.calls;
            const scheduledFunction = scheduleCalls[0][1];
            scheduledFunction();

            // Assert
            expect(introService['_introByGameId'][TEST_GAME_ID]).toBeDefined();
        });
    });

    describe('playIntro', () => {
        beforeEach(() => {
            // Set up intro config
            introService['_introConfigByEventId'][TEST_EVENT_ID] = {
                resourceServer: TEST_RESOURCE_SERVER,
                duration: TEST_DURATION
            };
        });

        it('should create intro state and broadcast when playing intro', () => {
            // Act
            introService.playIntro({ eventID: TEST_EVENT_ID, timeToPlay: TEST_TIME_TO_PLAY });

            // Assert
            expect(introService['_introByGameId'][TEST_GAME_ID]).toEqual({
                resourceServer: TEST_RESOURCE_SERVER,
                introTime: 15, // (TEST_TIME_TO_PLAY + 15000 - TEST_TIME_TO_PLAY) / 1000
                timeToPlay: TEST_TIME_TO_PLAY,
                isPlaying: true, // 15 seconds is within 0-30 duration
                duration: TEST_DURATION
            });
            expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                TEST_GAME_ID,
                introService.getCurrentByGameId(TEST_GAME_ID),
                introService.eventName
            );
        });

        it('should set isPlaying to false when intro time is before start', () => {
            // Arrange
            jest.spyOn(Date, 'now').mockReturnValue(TEST_TIME_TO_PLAY - 5000); // 5 seconds before start

            // Act
            introService.playIntro({ eventID: TEST_EVENT_ID, timeToPlay: TEST_TIME_TO_PLAY });

            // Assert
            expect(introService['_introByGameId'][TEST_GAME_ID].isPlaying).toBe(false);
            expect(introService['_introByGameId'][TEST_GAME_ID].introTime).toBe(-5); // negative time
        });

        it('should set isPlaying to false when intro time is after duration', () => {
            // Arrange
            jest.spyOn(Date, 'now').mockReturnValue(TEST_TIME_TO_PLAY + 35000); // 35 seconds after start (beyond 30s duration)

            // Act
            introService.playIntro({ eventID: TEST_EVENT_ID, timeToPlay: TEST_TIME_TO_PLAY });

            // Assert
            expect(introService['_introByGameId'][TEST_GAME_ID].isPlaying).toBe(false);
            expect(introService['_introByGameId'][TEST_GAME_ID].introTime).toBe(35); // beyond duration
        });

        it('should set isPlaying to true when intro time is exactly at start', () => {
            // Arrange
            jest.spyOn(Date, 'now').mockReturnValue(TEST_TIME_TO_PLAY); // exactly at start time

            // Act
            introService.playIntro({ eventID: TEST_EVENT_ID, timeToPlay: TEST_TIME_TO_PLAY });

            // Assert
            expect(introService['_introByGameId'][TEST_GAME_ID].isPlaying).toBe(true);
            expect(introService['_introByGameId'][TEST_GAME_ID].introTime).toBe(0);
        });

        it('should set isPlaying to true when intro time is exactly at duration end', () => {
            // Arrange
            jest.spyOn(Date, 'now').mockReturnValue(TEST_TIME_TO_PLAY + (TEST_DURATION * 1000)); // exactly at duration end

            // Act
            introService.playIntro({ eventID: TEST_EVENT_ID, timeToPlay: TEST_TIME_TO_PLAY });

            // Assert
            expect(introService['_introByGameId'][TEST_GAME_ID].isPlaying).toBe(true);
            expect(introService['_introByGameId'][TEST_GAME_ID].introTime).toBe(TEST_DURATION);
        });

        it('should extract correct game ID using idHelper', () => {
            // Arrange
            const extractGameIdSpy = jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID);

            // Act
            introService.playIntro({ eventID: TEST_EVENT_ID, timeToPlay: TEST_TIME_TO_PLAY });

            // Assert
            expect(extractGameIdSpy).toHaveBeenCalledWith(TEST_EVENT_ID);
            
            extractGameIdSpy.mockRestore();
        });
    });

    describe('handleEventCleanup', () => {
        it('should remove intro config for the specified event', () => {
            // Arrange
            introService['_introConfigByEventId'][TEST_EVENT_ID] = {
                resourceServer: TEST_RESOURCE_SERVER,
                duration: TEST_DURATION
            };

            // Act
            introService.handleEventCleanup(mockSystemNotification);

            // Assert
            expect(introService['_introConfigByEventId'][TEST_EVENT_ID]).toBeUndefined();
        });

        it('should handle cleanup for non-existing event gracefully', () => {
            // Act & Assert - should not throw
            expect(() => {
                introService.handleEventCleanup(mockSystemNotification);
            }).not.toThrow();
        });
    });

    describe('broadcastIntro', () => {
        beforeEach(() => {
            // Set up intro state for testing
            introService['_introByGameId'][TEST_GAME_ID] = {
                resourceServer: TEST_RESOURCE_SERVER,
                introTime: 15,
                timeToPlay: TEST_TIME_TO_PLAY,
                isPlaying: true,
                duration: TEST_DURATION
            };
        });

        it('should broadcast current intro state to clients', () => {
            // Act
            introService['broadcastIntro']({ gameId: TEST_GAME_ID });

            // Assert
            expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                TEST_GAME_ID,
                introService.getCurrentByGameId(TEST_GAME_ID),
                introService.eventName
            );
        });

        it('should call debug log with JSON stringified intro state', () => {
            // Act
            introService['broadcastIntro']({ gameId: TEST_GAME_ID });

            // Assert
            const expectedState = introService.getCurrentByGameId(TEST_GAME_ID);
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                introService,
                `broadcast intro ${JSON.stringify(expectedState, null, 2)}`,
                TEST_GAME_ID
            );
        });
    });

    describe('getFirst2ndHalfEventDetailIndex', () => {
        it('should return index of first event detail with phase 1', () => {
            // Arrange
            const event = createMockEvent({
                eventDetails: [
                    createMockEventDetail({ phase: 0 }),
                    createMockEventDetail({ phase: 1 }),
                    createMockEventDetail({ phase: 1 }),
                ]
            });

            // Act
            const result = introService['getFirst2ndHalfEventDetailIndex'](event);

            // Assert
            expect(result).toBe(1);
        });

        it('should return -1 when no phase 1 event detail exists', () => {
            // Arrange
            const event = createMockEvent({
                eventDetails: [
                    createMockEventDetail({ phase: 0 }),
                    createMockEventDetail({ phase: 2 }),
                ]
            });

            // Act
            const result = introService['getFirst2ndHalfEventDetailIndex'](event);

            // Assert
            expect(result).toBe(-1);
        });

        it('should return 0 when first event detail has phase 1', () => {
            // Arrange
            const event = createMockEvent({
                eventDetails: [
                    createMockEventDetail({ phase: 1 }),
                    createMockEventDetail({ phase: 2 }),
                ]
            });

            // Act
            const result = introService['getFirst2ndHalfEventDetailIndex'](event);

            // Assert
            expect(result).toBe(0);
        });
    });

    describe('log', () => {
        it('should call featureDebugService.log with correct parameters', () => {
            // Arrange
            const message = 'test message';
            const gameId = TEST_GAME_ID;

            // Act
            introService['log'](message, gameId);

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                introService,
                message,
                gameId
            );
        });

        it('should handle empty message', () => {
            // Arrange
            const message = '';
            const gameId = TEST_GAME_ID;

            // Act
            introService['log'](message, gameId);

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                introService,
                message,
                gameId
            );
        });
    });

    describe('edge cases', () => {
        it('should maintain correct context when bound methods are called directly', () => {
            // Arrange
            const boundHandleEventUpcoming = introService['boundHandleEventUpcoming'];
            const boundHandleEventStart = introService['boundHandleEventStart'];
            const boundHandleEventCleanup = introService['boundHandleEventCleanup'];

            // Set up intro config first
            introService['_introConfigByEventId'][TEST_EVENT_ID] = {
                resourceServer: TEST_RESOURCE_SERVER,
                duration: TEST_DURATION
            };

            // Act - Call bound methods directly (as they would be called by event emitter)
            boundHandleEventUpcoming(mockEventNotificationWithConfig);
            boundHandleEventStart(mockEventNotificationWithConfig);
            boundHandleEventCleanup(mockSystemNotification);

            // Assert
            expect(mockScheduler.schedule).toHaveBeenCalledTimes(2); // prebet + halftime
        });

        it('should handle multiple events with different configs', () => {
            // Arrange
            const eventId2 = 8589934594;
            const config2 = { resourceServer: "https://example2.com", duration: 45 };
            const eventWithConfig2 = {
                ...createMockEvent({ eventID: eventId2 }),
                config: { intro: config2 }
            };

            // Act
            introService.handleEventUpcoming(mockEventNotificationWithConfig);
            introService.handleEventUpcoming({ event: eventWithConfig2 as any });

            // Assert
            expect(introService['_introConfigByEventId'][TEST_EVENT_ID]).toEqual({
                resourceServer: TEST_RESOURCE_SERVER,
                duration: TEST_DURATION
            });
            expect(introService['_introConfigByEventId'][eventId2]).toEqual(config2);
        });

        it('should handle playIntro with zero duration', () => {
            // Arrange
            introService['_introConfigByEventId'][TEST_EVENT_ID] = {
                resourceServer: TEST_RESOURCE_SERVER,
                duration: 0
            };

            // Act
            introService.playIntro({ eventID: TEST_EVENT_ID, timeToPlay: TEST_TIME_TO_PLAY });

            // Assert
            expect(introService['_introByGameId'][TEST_GAME_ID].isPlaying).toBe(false);
            expect(introService['_introByGameId'][TEST_GAME_ID].duration).toBe(0);
        });

        it('should handle events with no event details gracefully', () => {
            // Arrange
            const eventWithNoDetails = createMockEvent({
                eventID: TEST_EVENT_ID,
                eventDetails: []
            });
            introService['_introConfigByEventId'][TEST_EVENT_ID] = {
                resourceServer: TEST_RESOURCE_SERVER,
                duration: TEST_DURATION
            };

            // Act & Assert - should throw due to accessing undefined array element
            expect(() => {
                introService.handleEventStart({ event: eventWithNoDetails });
            }).toThrow();
        });
    });
});
