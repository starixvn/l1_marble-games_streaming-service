import { IntroService } from "../../../../src/features/intro/intro-service";
import { OddFeedEventSource, OddFeedEventName, EventNotification, SystemNotification, Scheduler } from "odd-feed-client";
import { DelayHandlingService } from "../../../../src/features/delay/delay-handling-service";
import { GameBroadcastService } from "../../../../src/services/game-broadcast.service";
import { FeatureDebugService } from "../../../../src/features/feature-debug/feature-debug-service";
import { idHelper } from "../../../../src/helpers";
import { createMockEvent, createMockEventDetail } from "../../test-utils/mock-event";

jest.mock("odd-feed-client", () => {
    return {
        OddFeedEventName: {
            EventDetailStart: "EventDetailStart",
            EventStart: "EventStart",
            EventUpcoming: "EventUpcoming",
        },
        Scheduler: class {
            schedule = jest.fn();
        },
        OddFeedEventSource: class {
            registerEventDetailEventListener = jest.fn();
            unregisterEventDetailEventListener = jest.fn();
            registerEventListener = jest.fn();
            unregisterEventListener = jest.fn();
            registerSystemDataCleanupEventListener = jest.fn();
            unregisterSystemDataCleanupEventListener = jest.fn();
        },
        OddFeedService: class {
            getRemoteJson = jest.fn();
        },
    };
});

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
        it('should return recalculated intro state for existing game', () => {
            // Arrange
            const storedState = {
                resourceServer: TEST_RESOURCE_SERVER,
                introTime: 10, // This should be recalculated
                timeToPlay: TEST_TIME_TO_PLAY,
                isPlaying: false, // This should be recalculated
                duration: TEST_DURATION
            };
            introService['_introByGameId'][TEST_GAME_ID] = storedState;

            // Act
            const result = introService.getCurrentByGameId(TEST_GAME_ID);

            // Assert - should recalculate introTime and isPlaying based on current time
            expect(result).toEqual({
                resourceServer: TEST_RESOURCE_SERVER,
                introTime: 15, // (TEST_TIME_TO_PLAY + 15000) - TEST_TIME_TO_PLAY = 15000ms / 1000 = 15s
                timeToPlay: TEST_TIME_TO_PLAY,
                isPlaying: true, // 15000ms is within 0-30000ms (duration * 1000)
                duration: TEST_DURATION
            });
        });

        it('should return intro state with isPlaying false when intro time exceeds duration', () => {
            // Arrange
            const storedState = {
                resourceServer: TEST_RESOURCE_SERVER,
                introTime: 10,
                timeToPlay: TEST_TIME_TO_PLAY,
                isPlaying: true,
                duration: TEST_DURATION
            };
            introService['_introByGameId'][TEST_GAME_ID] = storedState;
            jest.spyOn(Date, 'now').mockReturnValue(TEST_TIME_TO_PLAY + 35000); // 35 seconds after start

            // Act
            const result = introService.getCurrentByGameId(TEST_GAME_ID);

            // Assert
            expect(result).toBeDefined();
            expect(result!.isPlaying).toBe(false);
            expect(result!.introTime).toBe(35); // 35000ms / 1000 = 35s
        });

        it('should return intro state with isPlaying false when intro time is before start', () => {
            // Arrange
            const storedState = {
                resourceServer: TEST_RESOURCE_SERVER,
                introTime: 10,
                timeToPlay: TEST_TIME_TO_PLAY,
                isPlaying: true,
                duration: TEST_DURATION
            };
            introService['_introByGameId'][TEST_GAME_ID] = storedState;
            jest.spyOn(Date, 'now').mockReturnValue(TEST_TIME_TO_PLAY - 5000); // 5 seconds before start

            // Act
            const result = introService.getCurrentByGameId(TEST_GAME_ID);

            // Assert
            expect(result).toBeDefined();
            expect(result!.isPlaying).toBe(false);
            expect(result!.introTime).toBe(-5); // -5000ms / 1000 = -5s
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

        it('should schedule prebet and halftime intro start and stop times when duration is available', () => {
            // Arrange
            mockDelayHandlingService.getDelayedTime
                .mockReturnValueOnce(TEST_DELAYED_TIME) // prebet intro start
                .mockReturnValueOnce(TEST_DELAYED_TIME_HALFTIME); // halftime intro start

            // Act
            introService.handleEventStart(mockEventNotificationWithConfig);

            // Assert
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledTimes(2);
            expect(mockScheduler.schedule).toHaveBeenCalledTimes(4); // 2 start times + 2 stop times
            
            // Verify prebet intro start
            expect(mockScheduler.schedule).toHaveBeenNthCalledWith(1, TEST_DELAYED_TIME, expect.any(Function));
            // Verify halftime intro start
            expect(mockScheduler.schedule).toHaveBeenNthCalledWith(2, TEST_DELAYED_TIME_HALFTIME, expect.any(Function));
            
            // Verify prebet intro stop (start time + duration + 1ms to avoid race condition)
            const expectedPrebetStopTime = new Date(TEST_DELAYED_TIME.getTime() + (TEST_DURATION * 1000) + 1);
            expect(mockScheduler.schedule).toHaveBeenNthCalledWith(3, expectedPrebetStopTime, expect.any(Function));
            
            // Verify halftime intro stop (start time + duration + 1ms to avoid race condition)
            const expectedHalftimeStopTime = new Date(TEST_DELAYED_TIME_HALFTIME.getTime() + (TEST_DURATION * 1000) + 1);
            expect(mockScheduler.schedule).toHaveBeenNthCalledWith(4, expectedHalftimeStopTime, expect.any(Function));
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
            }, {
                oddFeedEventType: OddFeedEventName.EventStart,
            });
            
            // Second call should be for halftime intro (phase 1 start time - duration)
            const expectedHalfTimeStart = new Date(mockEventWithIntroConfig.eventDetails[1].scheduleStartTs);
            const expectedHalfTimeIntroStart = new Date(expectedHalfTimeStart.getTime() - (TEST_DURATION * 1000));
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenNthCalledWith(2, {
                eventId: TEST_EVENT_ID,
                time: expectedHalfTimeIntroStart
            }, {
                oddFeedEventType: OddFeedEventName.EventDetailStart,
            });
        });

        it('should execute scheduled intro status update correctly', () => {
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

    describe('updateIntroStatus', () => {
        beforeEach(() => {
            // Set up intro config
            introService['_introConfigByEventId'][TEST_EVENT_ID] = {
                resourceServer: TEST_RESOURCE_SERVER,
                duration: TEST_DURATION
            };
        });

        it('should create intro state and broadcast when updating intro status', () => {
            // Act
            introService.updateIntroStatus({ eventID: TEST_EVENT_ID, timeToPlay: TEST_TIME_TO_PLAY });

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
            introService.updateIntroStatus({ eventID: TEST_EVENT_ID, timeToPlay: TEST_TIME_TO_PLAY });

            // Assert
            expect(introService['_introByGameId'][TEST_GAME_ID].isPlaying).toBe(false);
            expect(introService['_introByGameId'][TEST_GAME_ID].introTime).toBe(-5); // negative time
        });

        it('should set isPlaying to false when intro time is after duration', () => {
            // Arrange
            jest.spyOn(Date, 'now').mockReturnValue(TEST_TIME_TO_PLAY + 35000); // 35 seconds after start (beyond 30s duration)

            // Act
            introService.updateIntroStatus({ eventID: TEST_EVENT_ID, timeToPlay: TEST_TIME_TO_PLAY });

            // Assert
            expect(introService['_introByGameId'][TEST_GAME_ID].isPlaying).toBe(false);
            expect(introService['_introByGameId'][TEST_GAME_ID].introTime).toBe(35); // beyond duration
        });

        it('should set isPlaying to true when intro time is exactly at start', () => {
            // Arrange
            jest.spyOn(Date, 'now').mockReturnValue(TEST_TIME_TO_PLAY); // exactly at start time

            // Act
            introService.updateIntroStatus({ eventID: TEST_EVENT_ID, timeToPlay: TEST_TIME_TO_PLAY });

            // Assert
            expect(introService['_introByGameId'][TEST_GAME_ID].isPlaying).toBe(true);
            expect(introService['_introByGameId'][TEST_GAME_ID].introTime).toBe(0);
        });

        it('should set isPlaying to true when intro time is exactly at duration end', () => {
            // Arrange
            jest.spyOn(Date, 'now').mockReturnValue(TEST_TIME_TO_PLAY + (TEST_DURATION * 1000)); // exactly at duration end

            // Act
            introService.updateIntroStatus({ eventID: TEST_EVENT_ID, timeToPlay: TEST_TIME_TO_PLAY });

            // Assert
            expect(introService['_introByGameId'][TEST_GAME_ID].isPlaying).toBe(true);
            expect(introService['_introByGameId'][TEST_GAME_ID].introTime).toBe(TEST_DURATION);
        });

        it('should extract correct game ID using idHelper', () => {
            // Arrange
            const extractGameIdSpy = jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID);

            // Act
            introService.updateIntroStatus({ eventID: TEST_EVENT_ID, timeToPlay: TEST_TIME_TO_PLAY });

            // Assert
            expect(extractGameIdSpy).toHaveBeenCalledWith(TEST_EVENT_ID);
            
            extractGameIdSpy.mockRestore();
        });

        it('should handle stop intro timing correctly - race condition fixed', () => {
            // Arrange - The stop event is scheduled 1ms after the exact duration end
            const stopTime = TEST_TIME_TO_PLAY + (TEST_DURATION * 1000) + 1; // stop time + 1ms
            jest.spyOn(Date, 'now').mockReturnValue(stopTime); // exactly at stop time

            // Act - This simulates what happens when the stop event fires
            // The timeToPlay parameter is now the START time (race condition fixed!)
            introService.updateIntroStatus({ eventID: TEST_EVENT_ID, timeToPlay: TEST_TIME_TO_PLAY });

            // Assert - When timeToPlay is the start time and Date.now() is the stop time,
            // introTime = (stopTime - startTime) / 1000 = 30.001, so isPlaying should be false
            expect(introService['_introByGameId'][TEST_GAME_ID]).toEqual({
                resourceServer: TEST_RESOURCE_SERVER,
                introTime: 30.001, // (stopTime - startTime) / 1000 = (TEST_TIME_TO_PLAY + 30001 - TEST_TIME_TO_PLAY) / 1000
                timeToPlay: TEST_TIME_TO_PLAY,
                isPlaying: false, // 30.001 > 30 (duration), so correctly stopped!
                duration: TEST_DURATION
            });
            expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                TEST_GAME_ID,
                introService.getCurrentByGameId(TEST_GAME_ID),
                introService.eventName
            );
        });

        it('should handle delayed stop event firing correctly', () => {
            // Arrange - Stop event fires 100ms after the scheduled stop time
            const stopTime = TEST_TIME_TO_PLAY + (TEST_DURATION * 1000);
            jest.spyOn(Date, 'now').mockReturnValue(stopTime + 100); // 100ms after stop time

            // Act - Stop event with timeToPlay as START time (fixed!)
            introService.updateIntroStatus({ eventID: TEST_EVENT_ID, timeToPlay: TEST_TIME_TO_PLAY });

            // Assert - Now introTime = 30.1 seconds, which is > 30, so correctly stopped!
            expect(introService['_introByGameId'][TEST_GAME_ID]).toEqual({
                resourceServer: TEST_RESOURCE_SERVER,
                introTime: 30.1, // (stopTime + 100 - startTime) / 1000 = 30.1
                timeToPlay: TEST_TIME_TO_PLAY,
                isPlaying: false, // Correctly false because 30.1 > 30
                duration: TEST_DURATION
            });
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

        it('should handle broadcasting when getCurrentByGameId returns undefined', () => {
            // Arrange - No intro state set for the game

            // Act
            introService['broadcastIntro']({ gameId: 'nonexistent-game' });

            // Assert
            expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                'nonexistent-game',
                {}, // Should be empty object due to nullish coalescing
                introService.eventName
            );
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                introService,
                `broadcast intro ${JSON.stringify(undefined, null, 2)}`,
                'nonexistent-game'
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

    describe('isPlaying (private method)', () => {
        it('should return true when intro time is within duration range', () => {
            // Arrange
            const introState = {
                resourceServer: TEST_RESOURCE_SERVER,
                introTime: 15,
                timeToPlay: TEST_TIME_TO_PLAY,
                isPlaying: false, // This will be overridden by isPlaying method
                duration: TEST_DURATION
            };
            const introTime = 15; // 15 seconds

            // Act
            const result = introService['isPlaying'](introState, introTime);

            // Assert
            expect(result).toBe(true);
        });

        it('should return true when intro time is exactly at start (0)', () => {
            // Arrange
            const introState = {
                resourceServer: TEST_RESOURCE_SERVER,
                introTime: 0,
                timeToPlay: TEST_TIME_TO_PLAY,
                isPlaying: false,
                duration: TEST_DURATION
            };
            const introTime = 0;

            // Act
            const result = introService['isPlaying'](introState, introTime);

            // Assert
            expect(result).toBe(true);
        });

        it('should return true when intro time is exactly at duration end', () => {
            // Arrange
            const introState = {
                resourceServer: TEST_RESOURCE_SERVER,
                introTime: 30,
                timeToPlay: TEST_TIME_TO_PLAY,
                isPlaying: false,
                duration: TEST_DURATION
            };
            const introTime = TEST_DURATION; // 30 seconds

            // Act
            const result = introService['isPlaying'](introState, introTime);

            // Assert
            expect(result).toBe(true);
        });

        it('should return false when intro time is negative (before start)', () => {
            // Arrange
            const introState = {
                resourceServer: TEST_RESOURCE_SERVER,
                introTime: -5,
                timeToPlay: TEST_TIME_TO_PLAY,
                isPlaying: true,
                duration: TEST_DURATION
            };
            const introTime = -5; // -5 seconds

            // Act
            const result = introService['isPlaying'](introState, introTime);

            // Assert
            expect(result).toBe(false);
        });

        it('should return false when intro time exceeds duration', () => {
            // Arrange
            const introState = {
                resourceServer: TEST_RESOURCE_SERVER,
                introTime: 35,
                timeToPlay: TEST_TIME_TO_PLAY,
                isPlaying: true,
                duration: TEST_DURATION
            };
            const introTime = 35; // 35 seconds

            // Act
            const result = introService['isPlaying'](introState, introTime);

            // Assert
            expect(result).toBe(false);
        });

        it('should return false when duration is zero', () => {
            // Arrange
            const introState = {
                resourceServer: TEST_RESOURCE_SERVER,
                introTime: 0,
                timeToPlay: TEST_TIME_TO_PLAY,
                isPlaying: true,
                duration: 0
            };
            const introTime = 1; // Any positive time should be false with 0 duration

            // Act
            const result = introService['isPlaying'](introState, introTime);

            // Assert
            expect(result).toBe(false);
        });
    });
});
