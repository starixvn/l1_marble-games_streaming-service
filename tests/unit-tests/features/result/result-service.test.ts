import { ResultService, ResultState, ResultServiceContainer } from "../../../../src/features/result/result-service";
import { OddFeedEventSource, OddFeedEventName, EventNotification, EventDetailNotification } from "../../../../src/features/odd-feed-data";
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
    registerEventDetailEventListener: jest.fn(),
    unregisterEventDetailEventListener: jest.fn(),
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
const TEST_GAME_ID = '1';
const TEST_GAME_ID_2 = '2';
const TEST_EVENT_ID = 4294967298; // gameId: 1, roundId: 2
const TEST_EVENT_ID_2 = 8589934594; // gameId: 2, roundId: 2
const TEST_SCHEDULE_START_TS = "2023-01-01T10:00:00Z";
const TEST_RESULTS_AVAILABLE_TS = "2023-01-01T10:02:00Z";
const TEST_PHASE_1 = 1;
const TEST_PHASE_2 = 2;

// Test data using shared mock utils
const mockEvent = createMockEvent({
    eventID: TEST_EVENT_ID,
    scheduleStartTs: TEST_SCHEDULE_START_TS,
    eventDetails: [
        createMockEventDetail({
            eventID: TEST_EVENT_ID,
            resultsAvailableTs: TEST_RESULTS_AVAILABLE_TS,
            result: "1:0",
            phase: TEST_PHASE_1
        }),
        createMockEventDetail({
            eventID: TEST_EVENT_ID,
            resultsAvailableTs: TEST_RESULTS_AVAILABLE_TS,
            result: "0:1",
            phase: TEST_PHASE_2
        }),
    ]
});

const mockEventNotification: EventNotification = {
    event: mockEvent
};

const mockEventDetailNotification: EventDetailNotification = {
    event: mockEvent,
    index: 0
};

const mockEventDetailNotification2: EventDetailNotification = {
    event: mockEvent,
    index: 1
};

// Helper functions for test setup
const createContainer = (): ResultServiceContainer => ({
    oddFeedEventSource: mockOddFeedEventSource,
    scheduler: mockScheduler,
    delayHandlingService: mockDelayHandlingService,
    gameBoardcastService: mockGameBoardcastService,
    featureDebugService: mockFeatureDebugService,
});

const setupMocks = () => {
    jest.clearAllMocks();
    mockDelayHandlingService.getDelayedTime.mockReturnValue(TEST_DELAYED_TIME);
};

describe('ResultService', () => {
    let resultService: ResultService;
    let container: ResultServiceContainer;

    beforeEach(() => {
        setupMocks();
        container = createContainer();
        resultService = new ResultService(container);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with all dependencies and bind event handlers', () => {
            // Arrange
            
            // Act
            const service = new ResultService(container);

            // Assert
            expect(service['oddFeedEventSource']).toBe(mockOddFeedEventSource);
            expect(service['scheduler']).toBe(mockScheduler);
            expect(service['delayHandlingService']).toBe(mockDelayHandlingService);
            expect(service['gameBoardcastService']).toBe(mockGameBoardcastService);
            expect(service['featureDebugService']).toBe(mockFeatureDebugService);
            expect(service['boundHandleEventDetailResultAvailable']).toBeInstanceOf(Function);
            expect(service['boundHandleEventStart']).toBeInstanceOf(Function);
        });

        it('should initialize empty result tracking object', () => {
            // Arrange
            
            // Act
            const service = new ResultService(container);

            // Assert
            expect(service['_resultByGameId']).toEqual({});
        });
    });

    describe('eventName', () => {
        it('should return "result"', () => {
            // Arrange
            
            // Act
            const result = resultService.eventName;

            // Assert
            expect(result).toBe('result');
        });
    });

    describe('initEvent', () => {
        it('should register event listeners for EventDetailResultsAvailable and EventStart', () => {
            // Arrange
            
            // Act
            resultService.initEvent();

            // Assert
            expect(mockOddFeedEventSource.registerEventDetailEventListener).toHaveBeenCalledWith(
                OddFeedEventName.EventDetailResultsAvailable,
                resultService['boundHandleEventDetailResultAvailable']
            );
            expect(mockOddFeedEventSource.registerEventListener).toHaveBeenCalledWith(
                OddFeedEventName.EventStart,
                resultService['boundHandleEventStart']
            );
        });
    });

    describe('dispose', () => {
        it('should unregister event listeners for EventDetailResultsAvailable and EventStart', () => {
            // Arrange
            
            // Act
            resultService.dispose();

            // Assert
            expect(mockOddFeedEventSource.unregisterEventDetailEventListener).toHaveBeenCalledWith(
                OddFeedEventName.EventDetailResultsAvailable,
                resultService['boundHandleEventDetailResultAvailable']
            );
            expect(mockOddFeedEventSource.unregisterEventListener).toHaveBeenCalledWith(
                OddFeedEventName.EventStart,
                resultService['boundHandleEventStart']
            );
        });
    });

    describe('getCurrentByGameId', () => {
        it('should return result state for existing game', () => {
            // Arrange
            const expectedState: ResultState = {
                result: {
                    1: { homeScore: 2, awayScore: 1 }
                }
            };
            resultService['_resultByGameId'][TEST_GAME_ID] = expectedState;

            // Act
            const result = resultService.getCurrentByGameId(TEST_GAME_ID);

            // Assert
            expect(result).toBe(expectedState);
        });

        it('should return undefined for non-existing game', () => {
            // Arrange
            
            // Act
            const result = resultService.getCurrentByGameId('999');

            // Assert
            expect(result).toBeUndefined();
        });
    });

    describe('handleEventDetailResultAvailable', () => {
        it('should calculate delayed time and schedule result update', () => {
            // Arrange
            
            // Act
            resultService.handleEventDetailResultAvailable(mockEventDetailNotification);

            // Assert
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledWith({
                eventId: TEST_EVENT_ID,
                time: new Date(mockEvent.eventDetails[0].resultsAvailableTs)
            });
            expect(mockScheduler.schedule).toHaveBeenCalledWith(
                TEST_DELAYED_TIME,
                expect.any(Function)
            );
        });

        it('should schedule the correct bound method for result update', () => {
            // Arrange
            
            // Act
            resultService.handleEventDetailResultAvailable(mockEventDetailNotification);

            // Assert
            const scheduleCalls = mockScheduler.schedule.mock.calls;
            const scheduledFunction = scheduleCalls[0][1];
            scheduledFunction();
            expect(mockScheduler.schedule).toHaveBeenCalledTimes(1);
            expect(resultService['_resultByGameId'][TEST_GAME_ID]).toBeDefined();
        });
    });

    describe('handleEventStart', () => {
        it('should initialize result state and schedule reset event', () => {
            // Arrange
            
            // Act
            resultService.handleEventStart(mockEventNotification);

            // Assert
            expect(resultService['_resultByGameId'][TEST_GAME_ID]).toEqual({
                result: {}
            });
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledWith({
                eventId: TEST_EVENT_ID,
                time: new Date(mockEvent.scheduleStartTs)
            });
            expect(mockScheduler.schedule).toHaveBeenCalledWith(
                TEST_DELAYED_TIME,
                expect.any(Function)
            );
        });

        it('should extract correct game ID using idHelper', () => {
            // Arrange
            const extractGameIdSpy = jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID);

            // Act
            resultService.handleEventStart(mockEventNotification);

            // Assert
            expect(extractGameIdSpy).toHaveBeenCalledWith(TEST_EVENT_ID);
            expect(resultService['_resultByGameId'][TEST_GAME_ID]).toBeDefined();
            
            extractGameIdSpy.mockRestore();
        });

        it('should schedule the correct bound method for reset event', () => {
            // Arrange
            
            // Act
            resultService.handleEventStart(mockEventNotification);

            // Assert
            const scheduleCalls = mockScheduler.schedule.mock.calls;
            const scheduledFunction = scheduleCalls[0][1];
            scheduledFunction();
            expect(mockScheduler.schedule).toHaveBeenCalledTimes(1);
            expect(resultService['_resultByGameId'][TEST_GAME_ID]).toEqual({
                result: {}
            });
        });
    });

    describe('handleResultUpdate', () => {
        it('should update result state for existing game', () => {
            // Arrange
            resultService['_resultByGameId'][TEST_GAME_ID] = {
                result: {
                    1: { homeScore: 1, awayScore: 0 }
                }
            };

            // Act
            resultService.handleResultUpdate(mockEventDetailNotification);

            // Assert
            expect(resultService['_resultByGameId'][TEST_GAME_ID].result[TEST_PHASE_1]).toEqual({
                homeScore: 2, // 1 + 1 from event
                awayScore: 0  // 0 + 0 from event
            });
        });

        it('should initialize result state if game does not exist', () => {
            // Arrange
            
            // Act
            resultService.handleResultUpdate(mockEventDetailNotification);

            // Assert
            expect(resultService['_resultByGameId'][TEST_GAME_ID]).toEqual({
                result: {
                    1: { homeScore: 1, awayScore: 0 }
                }
            });
        });

        it('should handle new phase correctly', () => {
            // Arrange
            resultService['_resultByGameId'][TEST_GAME_ID] = {
                result: {
                    1: { homeScore: 1, awayScore: 0 }
                }
            };

            // Act
            resultService.handleResultUpdate(mockEventDetailNotification2);

            // Assert
            expect(resultService['_resultByGameId'][TEST_GAME_ID].result[2]).toEqual({
                homeScore: 0, // 0 + 0 from event
                awayScore: 1  // 0 + 1 from event
            });
            expect(resultService['_resultByGameId'][TEST_GAME_ID].result[1]).toEqual({
                homeScore: 1, awayScore: 0
            });
        });

        it('should parse result string correctly', () => {
            // Arrange
            const eventWithCustomResult = createMockEvent({
                eventID: TEST_EVENT_ID,
                eventDetails: [
                    createMockEventDetail({
                        eventID: TEST_EVENT_ID,
                        result: "3:2",
                        phase: 1
                    })
                ]
            });
            const notification: EventDetailNotification = {
                event: eventWithCustomResult,
                index: 0
            };

            // Act
            resultService.handleResultUpdate(notification);

            // Assert
            expect(resultService['_resultByGameId'][TEST_GAME_ID].result[1]).toEqual({
                homeScore: 3,
                awayScore: 2
            });
        });

        it('should handle zero scores correctly', () => {
            // Arrange
            const eventWithZeroResult = createMockEvent({
                eventID: TEST_EVENT_ID,
                eventDetails: [
                    createMockEventDetail({
                        eventID: TEST_EVENT_ID,
                        result: "0:0",
                        phase: 1
                    })
                ]
            });
            const notification: EventDetailNotification = {
                event: eventWithZeroResult,
                index: 0
            };

            // Act
            resultService.handleResultUpdate(notification);

            // Assert
            expect(resultService['_resultByGameId'][TEST_GAME_ID].result[1]).toEqual({
                homeScore: 0,
                awayScore: 0
            });
        });

        it('should accumulate scores for same phase', () => {
            // Arrange
            resultService['_resultByGameId'][TEST_GAME_ID] = {
                result: {
                    1: { homeScore: 2, awayScore: 1 }
                }
            };

            // Act
            resultService.handleResultUpdate(mockEventDetailNotification);

            // Assert
            expect(resultService['_resultByGameId'][TEST_GAME_ID].result[1]).toEqual({
                homeScore: 3, // 2 + 1 from event
                awayScore: 1  // 1 + 0 from event
            });
        });

        it('should broadcast result after update', () => {
            // Arrange
            
            // Act
            resultService.handleResultUpdate(mockEventDetailNotification);

            // Assert
            expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                TEST_GAME_ID,
                resultService.getCurrentByGameId(TEST_GAME_ID),
                resultService.eventName
            );
        });

        it('should extract correct game ID using idHelper', () => {
            // Arrange
            const extractGameIdSpy = jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID);

            // Act
            resultService.handleResultUpdate(mockEventDetailNotification);

            // Assert
            expect(extractGameIdSpy).toHaveBeenCalledWith(TEST_EVENT_ID);
            
            extractGameIdSpy.mockRestore();
        });

        it('should handle missing phase score correctly', () => {
            // Arrange
            
            // Act
            resultService.handleResultUpdate(mockEventDetailNotification);

            // Assert
            expect(resultService['_resultByGameId'][TEST_GAME_ID].result[TEST_PHASE_1]).toEqual({
                homeScore: 1, // 0 (default) + 1 from event
                awayScore: 0  // 0 (default) + 0 from event
            });
        });

        it('should handle invalid result format gracefully', () => {
            // Arrange
            const eventWithInvalidResult = createMockEvent({
                eventID: TEST_EVENT_ID,
                eventDetails: [
                    createMockEventDetail({
                        eventID: TEST_EVENT_ID,
                        result: "invalid:format:extra",
                        phase: 1
                    })
                ]
            });
            const notification: EventDetailNotification = {
                event: eventWithInvalidResult,
                index: 0
            };

            // Act
            resultService.handleResultUpdate(notification);

            // Assert
            expect(resultService['_resultByGameId'][TEST_GAME_ID].result[1]).toBeDefined();
        });

        it('should handle non-numeric result strings', () => {
            // Arrange
            const eventWithNonNumericResult = createMockEvent({
                eventID: TEST_EVENT_ID,
                eventDetails: [
                    createMockEventDetail({
                        eventID: TEST_EVENT_ID,
                        result: "abc:def",
                        phase: TEST_PHASE_1
                    })
                ]
            });
            const notification: EventDetailNotification = {
                event: eventWithNonNumericResult,
                index: 0
            };

            // Act
            resultService.handleResultUpdate(notification);

            // Assert
            expect(resultService['_resultByGameId'][TEST_GAME_ID].result[TEST_PHASE_1]).toEqual({
                homeScore: NaN, // parseInt("abc") = NaN
                awayScore: NaN  // parseInt("def") = NaN
            });
        });

        it('should handle missing colon in result string', () => {
            // Arrange
            const eventWithMissingColon = createMockEvent({
                eventID: TEST_EVENT_ID,
                eventDetails: [
                    createMockEventDetail({
                        eventID: TEST_EVENT_ID,
                        result: "123",
                        phase: TEST_PHASE_1
                    })
                ]
            });
            const notification: EventDetailNotification = {
                event: eventWithMissingColon,
                index: 0
            };

            // Act
            resultService.handleResultUpdate(notification);

            // Assert
            expect(resultService['_resultByGameId'][TEST_GAME_ID].result[TEST_PHASE_1]).toEqual({
                homeScore: 123, // parseInt("123")
                awayScore: NaN  // parseInt(undefined) = NaN
            });
        });
    });

    describe('handleResetEvent', () => {
        it('should reset result state to empty', () => {
            // Arrange
            resultService['_resultByGameId'][TEST_GAME_ID] = {
                result: {
                    1: { homeScore: 2, awayScore: 1 },
                    2: { homeScore: 1, awayScore: 0 }
                }
            };

            // Act
            resultService.handleResetEvent(mockEventNotification);

            // Assert
            expect(resultService['_resultByGameId'][TEST_GAME_ID]).toEqual({
                result: {}
            });
        });

        it('should broadcast result after reset', () => {
            // Arrange
            
            // Act
            resultService.handleResetEvent(mockEventNotification);

            // Assert
            expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                TEST_GAME_ID,
                resultService.getCurrentByGameId(TEST_GAME_ID),
                resultService.eventName
            );
        });

        it('should extract correct game ID using idHelper', () => {
            // Arrange
            const extractGameIdSpy = jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID);

            // Act
            resultService.handleResetEvent(mockEventNotification);

            // Assert
            expect(extractGameIdSpy).toHaveBeenCalledWith(TEST_EVENT_ID);
            
            extractGameIdSpy.mockRestore();
        });
    });

    describe('broadcastResult', () => {
        it('should broadcast current result state to clients', () => {
            // Arrange
            const testState: ResultState = {
                result: {
                    1: { homeScore: 2, awayScore: 1 }
                }
            };
            resultService['_resultByGameId'][TEST_GAME_ID] = testState;

            // Act
            resultService['broadcastResult']({ gameId: TEST_GAME_ID });

            // Assert
            expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                TEST_GAME_ID,
                testState,
                resultService.eventName
            );
        });

        it('should call debug log with JSON stringified result', () => {
            // Arrange
            const testState: ResultState = {
                result: {
                    1: { homeScore: 2, awayScore: 1 }
                }
            };
            resultService['_resultByGameId'][TEST_GAME_ID] = testState;

            // Act
            resultService['broadcastResult']({ gameId: TEST_GAME_ID });

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                resultService,
                JSON.stringify(testState),
                TEST_GAME_ID
            );
        });

        it('should handle empty result state', () => {
            // Arrange
            const testState: ResultState = {
                result: {}
            };
            resultService['_resultByGameId'][TEST_GAME_ID] = testState;

            // Act
            resultService['broadcastResult']({ gameId: TEST_GAME_ID });

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                resultService,
                JSON.stringify(testState),
                TEST_GAME_ID
            );
            expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                TEST_GAME_ID,
                testState,
                resultService.eventName
            );
        });
    });

    describe('log', () => {
        it('should call featureDebugService.log with correct parameters', () => {
            // Arrange
            const message = 'test message';
            const gameId = TEST_GAME_ID;

            // Act
            resultService['log'](message, gameId);

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                resultService,
                message,
                gameId
            );
        });

        it('should handle empty message', () => {
            // Arrange
            const message = '';
            const gameId = TEST_GAME_ID;

            // Act
            resultService['log'](message, gameId);

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                resultService,
                message,
                gameId
            );
        });

        it('should handle different game IDs', () => {
            // Arrange
            const message = 'test message';

            // Act
            resultService['log'](message, TEST_GAME_ID);
            resultService['log'](message, TEST_GAME_ID_2);

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledTimes(2);
            expect(mockFeatureDebugService.log).toHaveBeenNthCalledWith(
                1,
                resultService,
                message,
                TEST_GAME_ID
            );
            expect(mockFeatureDebugService.log).toHaveBeenNthCalledWith(
                2,
                resultService,
                message,
                TEST_GAME_ID_2
            );
        });
    });

    describe('edge cases', () => {
        it('should maintain correct context when bound methods are called directly', () => {
            // Arrange
            const boundHandleEventDetailResultAvailable = resultService['boundHandleEventDetailResultAvailable'];
            const boundHandleEventStart = resultService['boundHandleEventStart'];

            // Act
            boundHandleEventStart(mockEventNotification);
            boundHandleEventDetailResultAvailable(mockEventDetailNotification);

            // Assert
            expect(mockScheduler.schedule).toHaveBeenCalledTimes(2);
            expect(resultService['_resultByGameId'][TEST_GAME_ID]).toBeDefined();
        });

        it('should handle multiple games independently', () => {
            // Arrange
            const event2 = createMockEvent({ eventID: TEST_EVENT_ID_2 });
            const notification1: EventNotification = { event: mockEvent };
            const notification2: EventNotification = { event: event2 };

            // Act
            resultService.handleEventStart(notification1);
            resultService.handleEventStart(notification2);

            // Assert
            expect(resultService['_resultByGameId'][TEST_GAME_ID]).toBeDefined();
            expect(resultService['_resultByGameId'][TEST_GAME_ID_2]).toBeDefined();
            expect(Object.keys(resultService['_resultByGameId'])).toHaveLength(2);
        });

        it('should handle phase without existing result correctly', () => {
            // Arrange
            const eventDetailNotificationPhase3: EventDetailNotification = {
                event: {
                    ...mockEvent,
                    eventDetails: [
                        ...mockEvent.eventDetails,
                        createMockEventDetail({
                            eventID: TEST_EVENT_ID,
                            result: "2:1",
                            phase: 3
                        })
                    ]
                },
                index: 2
            };

            // Act
            resultService.handleResultUpdate(eventDetailNotificationPhase3);

            // Assert
            expect(resultService['_resultByGameId'][TEST_GAME_ID].result[3]).toEqual({
                homeScore: 2,
                awayScore: 1
            });
        });
    });
});