import { CurrentEventService } from "../../../../src/features/current-event/current-event-service";
import { OddFeedEventSource, OddFeedEventName, EventNotification, EventDetailNotification, SystemNotification } from "../../../../src/features/odd-feed-data";
import { DelayHandlingService } from "../../../../src/features/delay/delay-handling-service";
import { Scheduler } from "../../../../src/features/scheduler/scheduler";
import { GameBroadcastService } from "../../../../src/services/game-broadcast.service";
import { FeatureDebugService } from "../../../../src/features/feature-debug/feature-debug-service";
import { Event } from "../../../../src/types";
import { idHelper } from "../../../../src/helpers";
import { createMockEvent, createMockEventWithoutDetails } from "../../test-utils/mock-event";

// Mock dependencies
const mockOddFeedEventSource = {
    registerEventListener: jest.fn(),
    unregisterEventListener: jest.fn(),
    registerEventDetailEventListener: jest.fn(),
    unregisterEventDetailEventListener: jest.fn(),
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
const TEST_DELAYED_TIME = '2023-01-01T10:05:00Z';
const TEST_GAME_ID = '1';
const TEST_GAME_ID_2 = '2';
const TEST_INDEX = 3;

// Test data using shared mock utils
const mockEvent: Event = createMockEvent({
    eventID: 4294967298, // gameId: 1, roundId: 2
    eventNameAKey: "Team A",
    eventNameBKey: "Team B",
    scheduleStartTs: "2023-01-01T10:00:00Z",
    productCode: "TEST",
    productTypeKey: "MARBLE"
});

const mockEventNotification: EventNotification = {
    event: mockEvent
};

const mockEventDetailNotification: EventDetailNotification = {
    event: mockEvent,
    index: 0
};

const mockSystemNotification: SystemNotification = {
    eventID: 4294967298
};

// Helper functions for test setup
const createContainer = () => ({
    oddFeedEventSource: mockOddFeedEventSource,
    delayHandlingService: mockDelayHandlingService,
    scheduler: mockScheduler,
    gameBoardcastService: mockGameBoardcastService,
    featureDebugService: mockFeatureDebugService,
});

const setupMocks = () => {
    jest.clearAllMocks();
};

describe('CurrentEventService', () => {
    let currentEventService: CurrentEventService;
    let container: any;

    beforeEach(() => {
        setupMocks();
        container = createContainer();
        currentEventService = new CurrentEventService(container);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with all dependencies and bind event handlers', () => {
            // Arrange & Act
            const service = new CurrentEventService(container);

            // Assert
            expect(service['oddFeedEventSource']).toBe(mockOddFeedEventSource);
            expect(service['delayHandlingService']).toBe(mockDelayHandlingService);
            expect(service['scheduler']).toBe(mockScheduler);
            expect(service['gameBoardcastService']).toBe(mockGameBoardcastService);
            expect(service['featureDebugService']).toBe(mockFeatureDebugService);
            expect(service['boundHandleEventStart']).toBeInstanceOf(Function);
            expect(service['boundHandleEventDetailResultAvailable']).toBeInstanceOf(Function);
            expect(service['boundHandleEventCleanup']).toBeInstanceOf(Function);
        });

        it('should initialize empty current event tracking objects', () => {
            // Arrange & Act
            const service = new CurrentEventService(container);

            // Assert
            expect(service['_currentEventByGameId']).toEqual({});
            expect(service['_currentEventDetailIndexByGameId']).toEqual({});
        });
    });

    describe('eventName', () => {
        it('should return "currentEvent"', () => {
            // Act
            const result = currentEventService.eventName;

            // Assert
            expect(result).toBe('currentEvent');
        });
    });

    describe('getCurrentEventByGameId', () => {
        beforeEach(() => {
            // Set up some test data
            currentEventService['_currentEventByGameId']['1'] = 4294967298;
        });

        it('should return current event for existing game ID', () => {
            // Arrange
            const gameId = TEST_GAME_ID;

            // Act
            const result = currentEventService.getCurrentEventByGameId(gameId);

            // Assert
            expect(result).toBe(4294967298);
        });

        it('should return undefined for non-existing game ID', () => {
            // Arrange
            const gameId = '999';

            // Act
            const result = currentEventService.getCurrentEventByGameId(gameId);

            // Assert
            expect(result).toBeUndefined();
        });
    });

    describe('getCurrentEventDetailIndexByGameId', () => {
        beforeEach(() => {
            // Set up some test data
            currentEventService['_currentEventDetailIndexByGameId']['1'] = 2;
        });

        it('should return current event detail index for existing game ID', () => {
            // Arrange
            const gameId = TEST_GAME_ID;

            // Act
            const result = currentEventService.getCurrentEventDetailIndexByGameId(gameId);

            // Assert
            expect(result).toBe(2);
        });

        it('should return undefined for non-existing game ID', () => {
            // Arrange
            const gameId = '999';

            // Act
            const result = currentEventService.getCurrentEventDetailIndexByGameId(gameId);

            // Assert
            expect(result).toBeUndefined();
        });
    });

    describe('getCurrentPhaseByGameId', () => {
        beforeEach(() => {
            // Set up some test data
            currentEventService['_currentEventByGameId']['1'] = 4294967298;
            currentEventService['_currentEventDetailIndexByGameId']['1'] = 1;
            currentEventService['_eventByEventId'][4294967298] = mockEvent;
        });

        it('should return current phase for existing game ID with valid event and index', () => {
            // Arrange
            const gameId = TEST_GAME_ID;

            // Act
            const result = currentEventService.getCurrentPhaseByGameId(gameId);

            // Assert
            expect(result).toBe(mockEvent.eventDetails[1].phase);
        });

        it('should return undefined for non-existing game ID', () => {
            // Arrange
            const gameId = '999';

            // Act
            const result = currentEventService.getCurrentPhaseByGameId(gameId);

            // Assert
            expect(result).toBeUndefined();
        });

        it('should return undefined when current event is not found', () => {
            // Arrange
            const gameId = TEST_GAME_ID;
            currentEventService['_currentEventByGameId'][gameId] = 999999; // Non-existing event

            // Act
            const result = currentEventService.getCurrentPhaseByGameId(gameId);

            // Assert
            expect(result).toBeUndefined();
        });

        it('should return undefined when current event detail index is out of bounds', () => {
            // Arrange
            const gameId = TEST_GAME_ID;
            currentEventService['_currentEventDetailIndexByGameId'][gameId] = 999; // Out of bounds index

            // Act
            const result = currentEventService.getCurrentPhaseByGameId(gameId);

            // Assert
            expect(result).toBeUndefined();
        });

        it('should return undefined when current event detail index is undefined', () => {
            // Arrange
            const gameId = TEST_GAME_ID;
            delete currentEventService['_currentEventDetailIndexByGameId'][gameId];

            // Act
            const result = currentEventService.getCurrentPhaseByGameId(gameId);

            // Assert
            expect(result).toBeUndefined();
        });

        it('should return undefined when event details array is empty', () => {
            // Arrange
            const gameId = TEST_GAME_ID;
            const eventWithNoDetails: Event = createMockEventWithoutDetails(4294967298);
            currentEventService['_eventByEventId'][4294967298] = eventWithNoDetails;
            currentEventService['_currentEventDetailIndexByGameId'][gameId] = 0;

            // Act
            const result = currentEventService.getCurrentPhaseByGameId(gameId);

            // Assert
            expect(result).toBeUndefined();
        });

        it('should handle zero index correctly', () => {
            // Arrange
            const gameId = TEST_GAME_ID;
            currentEventService['_currentEventDetailIndexByGameId'][gameId] = 0;

            // Act
            const result = currentEventService.getCurrentPhaseByGameId(gameId);

            // Assert
            expect(result).toBe(mockEvent.eventDetails[0].phase);
        });
    });

    describe('getCurrentByGameId', () => {
        beforeEach(() => {
            // Set up some test data
            currentEventService['_currentEventByGameId']['1'] = 4294967298;
            currentEventService['_currentEventDetailIndexByGameId']['1'] = 2;
        });

        it('should return current event and event detail index for existing game ID', () => {
            // Arrange
            const gameId = TEST_GAME_ID;

            // Act
            const result = currentEventService.getCurrentByGameId(gameId);

            // Assert
            expect(result).toEqual({
                event: 4294967298,
                eventDetailIndex: 2,
                phase: undefined,
            });
        });

        it('should return undefined values for non-existing game ID', () => {
            // Arrange
            const gameId = '999';

            // Act
            const result = currentEventService.getCurrentByGameId(gameId);

            // Assert
            expect(result).toEqual({
                event: undefined,
                eventDetailIndex: undefined,
                phase: undefined,
            });
        });
    });

    describe('initEvent', () => {
        it('should register event listeners for EventStart, EventDetailResultsAvailable, and system cleanup', () => {
            // Arrange & Act
            currentEventService.initEvent();

            // Assert
            expect(mockOddFeedEventSource.registerEventListener).toHaveBeenCalledWith(
                OddFeedEventName.EventStart,
                currentEventService['boundHandleEventStart']
            );
            expect(mockOddFeedEventSource.registerEventDetailEventListener).toHaveBeenCalledWith(
                OddFeedEventName.EventDetailResultsAvailable,
                currentEventService['boundHandleEventDetailResultAvailable']
            );
            expect(mockOddFeedEventSource.registerSystemDataCleanupEventListener).toHaveBeenCalledWith(
                currentEventService['boundHandleEventCleanup']
            );
        });
    });

    describe('dispose', () => {
        it('should unregister event listeners for EventStart, EventDetailResultsAvailable, and system cleanup', () => {
            // Arrange & Act
            currentEventService.dispose();

            // Assert
            expect(mockOddFeedEventSource.unregisterEventListener).toHaveBeenCalledWith(
                OddFeedEventName.EventStart,
                currentEventService['boundHandleEventStart']
            );
            expect(mockOddFeedEventSource.unregisterEventDetailEventListener).toHaveBeenCalledWith(
                OddFeedEventName.EventDetailResultsAvailable,
                currentEventService['boundHandleEventDetailResultAvailable']
            );
            expect(mockOddFeedEventSource.unregisterSystemDataCleanupEventListener).toHaveBeenCalledWith(
                currentEventService['boundHandleEventCleanup']
            );
        });
    });

    describe('handleEventStart', () => {
        it('should calculate delayed time and schedule event index reset', () => {
            // Arrange
            const delayedTime = new Date(TEST_DELAYED_TIME);
            mockDelayHandlingService.getDelayedTime.mockReturnValue(delayedTime);

            // Act
            currentEventService.handleEventStart(mockEventNotification);

            // Assert
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledWith({
                eventId: mockEvent.eventID,
                time: new Date(mockEvent.scheduleStartTs)
            }, {
                oddFeedEventType: OddFeedEventName.EventStart,
            });
            expect(mockScheduler.schedule).toHaveBeenCalledWith(
                delayedTime,
                expect.any(Function)
            );
        });

        it('should schedule the correct bound method for event index reset', () => {
            // Arrange
            const delayedTime = new Date(TEST_DELAYED_TIME);
            mockDelayHandlingService.getDelayedTime.mockReturnValue(delayedTime);

            // Act
            currentEventService.handleEventStart(mockEventNotification);
            
            // Get the scheduled callback and execute it
            const scheduleCalls = mockScheduler.schedule.mock.calls;
            const scheduledFunction = scheduleCalls[0][1];
            scheduledFunction();

            // Assert
            expect(mockScheduler.schedule).toHaveBeenCalledTimes(1);
            // Verify the scheduled function is bound correctly by checking if it updates the internal state
            expect(currentEventService['_currentEventByGameId'][TEST_GAME_ID]).toBe(mockEvent.eventID);
        });
    });

    describe('handleEventDetailResultAvailable', () => {
        it('should calculate delayed time and schedule event detail index increment', () => {
            // Arrange
            const delayedTime = new Date('2023-01-01T10:06:00Z');
            mockDelayHandlingService.getDelayedTime.mockReturnValue(delayedTime);

            // Act
            currentEventService.handleEventDetailResultAvailable(mockEventDetailNotification);

            // Assert
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledWith({
                eventId: mockEvent.eventID,
                time: new Date(mockEvent.eventDetails[0].resultsAvailableTs)
            }, {
                oddFeedEventType: OddFeedEventName.EventDetailResultsAvailable,
            });
            expect(mockScheduler.schedule).toHaveBeenCalledWith(
                delayedTime,
                expect.any(Function)
            );
        });

        it('should schedule the correct bound method for event detail index increment', () => {
            // Arrange
            const delayedTime = new Date('2023-01-01T10:06:00Z');
            mockDelayHandlingService.getDelayedTime.mockReturnValue(delayedTime);

            // Act
            currentEventService.handleEventDetailResultAvailable(mockEventDetailNotification);
            
            // Get the scheduled callback and execute it
            const scheduleCalls = mockScheduler.schedule.mock.calls;
            const scheduledFunction = scheduleCalls[0][1];
            scheduledFunction();

            // Assert
            expect(mockScheduler.schedule).toHaveBeenCalledTimes(1);
            // Verify the scheduled function updates the event detail index
            expect(currentEventService['_currentEventDetailIndexByGameId']['1']).toBe(1);
        });
    });

    describe('handleEventDetailIndexIncrement', () => {
        it('should increment event detail index when not at last index', () => {
            // Arrange
            const gameId = TEST_GAME_ID;
            currentEventService['_currentEventDetailIndexByGameId'][gameId] = 0;

            // Act
            currentEventService.handleEventDetailIndexIncrement(mockEventDetailNotification);

            // Assert
            expect(currentEventService['_currentEventDetailIndexByGameId'][gameId]).toBe(1);
        });

        it('should broadcast updated event detail index when not at last index', () => {
            // Arrange
            const gameId = TEST_GAME_ID;
            currentEventService['_currentEventDetailIndexByGameId'][gameId] = 0;
            currentEventService['_currentEventByGameId'][gameId] = mockEvent.eventID;
            currentEventService['_eventByEventId'][mockEvent.eventID] = mockEvent;

            // Act
            currentEventService.handleEventDetailIndexIncrement(mockEventDetailNotification);

            // Assert
            expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                gameId,
                {
                    event: mockEvent.eventID,
                    eventDetailIndex: 1,
                    phase: mockEvent.eventDetails[1].phase,
                },
                currentEventService.eventName
            );
        });

        it('should call debug log when incrementing index', () => {
            // Arrange
            const gameId = TEST_GAME_ID;
            currentEventService['_currentEventDetailIndexByGameId'][gameId] = 0;

            // Act
            currentEventService.handleEventDetailIndexIncrement(mockEventDetailNotification);

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                currentEventService,
                `event index increment for event ${mockEvent.eventID} to 1`,
                gameId
            );
        });

        it('should not increment when at last index', () => {
            // Arrange
            const lastIndexNotification: EventDetailNotification = {
                event: mockEvent,
                index: 1 // Last index (eventDetails.length - 1)
            };
            const gameId = TEST_GAME_ID;
            currentEventService['_currentEventDetailIndexByGameId'][gameId] = 1;

            // Act
            currentEventService.handleEventDetailIndexIncrement(lastIndexNotification);

            // Assert
            expect(currentEventService['_currentEventDetailIndexByGameId'][gameId]).toBe(1);
        });

        it('should not broadcast when at last index', () => {
            // Arrange
            const lastIndexNotification: EventDetailNotification = {
                event: mockEvent,
                index: 1 // Last index (eventDetails.length - 1)
            };
            const gameId = TEST_GAME_ID;
            currentEventService['_currentEventDetailIndexByGameId'][gameId] = 1;

            // Act
            currentEventService.handleEventDetailIndexIncrement(lastIndexNotification);

            // Assert
            expect(mockGameBoardcastService.broadcastToAllClientByGameId).not.toHaveBeenCalled();
        });

        it('should not call debug log when at last index', () => {
            // Arrange
            const lastIndexNotification: EventDetailNotification = {
                event: mockEvent,
                index: 1 // Last index (eventDetails.length - 1)
            };

            // Act
            currentEventService.handleEventDetailIndexIncrement(lastIndexNotification);

            // Assert
            expect(mockFeatureDebugService.log).not.toHaveBeenCalled();
        });

        it('should extract correct game ID using idHelper', () => {
            // Arrange
            const gameId = TEST_GAME_ID;
            const extractGameIdSpy = jest.spyOn(idHelper, 'extractGameId').mockReturnValue(gameId);

            // Act
            currentEventService.handleEventDetailIndexIncrement(mockEventDetailNotification);

            // Assert
            expect(extractGameIdSpy).toHaveBeenCalledWith(mockEvent.eventID);
            expect(currentEventService['_currentEventDetailIndexByGameId'][gameId]).toBe(1);
            
            extractGameIdSpy.mockRestore();
        });

        it('should handle empty event details gracefully', () => {
            // Arrange
            const eventWithNoDetails: Event = createMockEventWithoutDetails(4294967298);
            const notification: EventDetailNotification = {
                event: eventWithNoDetails,
                index: 0
            };

            // Act & Assert - should not throw
            expect(() => {
                currentEventService.handleEventDetailIndexIncrement(notification);
            }).not.toThrow();
            
            // Should increment since index 0 is not the last index when length = 0 (last would be -1)
            expect(currentEventService['_currentEventDetailIndexByGameId'][TEST_GAME_ID]).toBe(1);
        });
    });

    describe('handleEventIndexReset', () => {
        it('should reset event detail index to 0 and set current event', () => {
            // Arrange
            const gameId = TEST_GAME_ID;
            currentEventService['_currentEventDetailIndexByGameId'][gameId] = 5;
            currentEventService['_currentEventByGameId'][gameId] = 999;

            // Act
            currentEventService.handleEventIndexReset(mockEventNotification);

            // Assert
            expect(currentEventService['_currentEventDetailIndexByGameId'][gameId]).toBe(0);
            expect(currentEventService['_currentEventByGameId'][gameId]).toBe(mockEvent.eventID);
        });

        it('should broadcast current event to all clients for the game', () => {
            // Arrange
            const gameId = TEST_GAME_ID;

            // Act
            currentEventService.handleEventIndexReset(mockEventNotification);

            // Assert
            expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                gameId,
                {
                    event: mockEvent.eventID,
                    eventDetailIndex: 0,
                    phase: mockEvent.eventDetails[0].phase,
                },
                currentEventService.eventName
            );
        });

        it('should call debug log when resetting event index', () => {
            // Arrange
            const gameId = TEST_GAME_ID;

            // Act
            currentEventService.handleEventIndexReset(mockEventNotification);

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                currentEventService,
                `event index reset for event ${mockEvent.eventID}`,
                gameId
            );
        });

        it('should extract correct game ID using idHelper', () => {
            // Arrange
            const gameId = TEST_GAME_ID;
            const extractGameIdSpy = jest.spyOn(idHelper, 'extractGameId').mockReturnValue(gameId);

            // Act
            currentEventService.handleEventIndexReset(mockEventNotification);

            // Assert
            expect(extractGameIdSpy).toHaveBeenCalledWith(mockEvent.eventID);
            expect(currentEventService['_currentEventByGameId'][gameId]).toBe(mockEvent.eventID);
            
            extractGameIdSpy.mockRestore();
        });
    });

    describe('handleEventDetailStart', () => {
        it('should set event detail index to the specified index', () => {
            // Arrange
            const gameId = TEST_GAME_ID;
            const testNotification: EventDetailNotification = {
                event: mockEvent,
                index: TEST_INDEX
            };

            // Act
            currentEventService.handleEventDetailStart(testNotification);

            // Assert
            expect(currentEventService['_currentEventDetailIndexByGameId'][gameId]).toBe(TEST_INDEX);
        });

        it('should extract correct game ID using idHelper', () => {
            // Arrange
            const gameId = TEST_GAME_ID;
            const extractGameIdSpy = jest.spyOn(idHelper, 'extractGameId').mockReturnValue(gameId);
            const testNotification: EventDetailNotification = {
                event: mockEvent,
                index: 2
            };

            // Act
            currentEventService.handleEventDetailStart(testNotification);

            // Assert
            expect(extractGameIdSpy).toHaveBeenCalledWith(mockEvent.eventID);
            expect(currentEventService['_currentEventDetailIndexByGameId'][gameId]).toBe(2);
            
            extractGameIdSpy.mockRestore();
        });

        it('should handle zero index', () => {
            // Arrange
            const gameId = TEST_GAME_ID;
            const testNotification: EventDetailNotification = {
                event: mockEvent,
                index: 0
            };

            // Act
            currentEventService.handleEventDetailStart(testNotification);

            // Assert
            expect(currentEventService['_currentEventDetailIndexByGameId'][gameId]).toBe(0);
        });

        it('should handle negative index', () => {
            // Arrange
            const gameId = TEST_GAME_ID;
            const testNotification: EventDetailNotification = {
                event: mockEvent,
                index: -1
            };

            // Act
            currentEventService.handleEventDetailStart(testNotification);

            // Assert
            expect(currentEventService['_currentEventDetailIndexByGameId'][gameId]).toBe(-1);
        });
    });

    describe('log', () => {
        it('should call featureDebugService.log with correct parameters', () => {
            // Arrange
            const message = 'test message';
            const gameId = TEST_GAME_ID;

            // Act
            currentEventService['log'](message, gameId);

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                currentEventService,
                message,
                gameId
            );
        });

        it('should handle empty message', () => {
            // Arrange
            const message = '';
            const gameId = TEST_GAME_ID;

            // Act
            currentEventService['log'](message, gameId);

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                currentEventService,
                message,
                gameId
            );
        });

        it('should handle different game IDs', () => {
            // Arrange
            const message = 'test message';
            const gameId1 = '1';
            const gameId2 = '2';

            // Act
            currentEventService['log'](message, gameId1);
            currentEventService['log'](message, gameId2);

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledTimes(2);
            expect(mockFeatureDebugService.log).toHaveBeenNthCalledWith(
                1,
                currentEventService,
                message,
                gameId1
            );
            expect(mockFeatureDebugService.log).toHaveBeenNthCalledWith(
                2,
                currentEventService,
                message,
                gameId2
            );
        });
    });

    describe('notifyClient', () => {
        it('should broadcast to all clients for the specified game', () => {
            // Arrange
            const gameId = TEST_GAME_ID;
            const eventID = mockEvent.eventID;
            const index = 1; // Use valid index within mockEvent.eventDetails bounds
            
            // Set up test data for getCurrentByGameId to work properly
            currentEventService['_currentEventByGameId'][gameId] = eventID;
            currentEventService['_currentEventDetailIndexByGameId'][gameId] = index;
            currentEventService['_eventByEventId'][eventID] = mockEvent;

            // Act
            currentEventService['notifyClient']({ gameId, eventID, index });

            // Assert
            expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                gameId,
                {
                    event: eventID,
                    eventDetailIndex: index,
                    phase: mockEvent.eventDetails[index].phase,
                },
                currentEventService.eventName
            );
        });

        it('should handle different game IDs correctly', () => {
            // Arrange
            const gameId1 = '1';
            const gameId2 = '2';
            const eventID1 = mockEvent.eventID; // Use mockEvent for game 1
            const eventGame2: Event = createMockEvent({
                eventID: 8589934594 // gameId: 2, roundId: 2
            });
            const eventID2 = eventGame2.eventID;
            const index1 = 0;
            const index2 = 1; // Use valid index within bounds

            // Set up test data for getCurrentByGameId to work properly
            currentEventService['_currentEventByGameId'][gameId1] = eventID1;
            currentEventService['_currentEventDetailIndexByGameId'][gameId1] = index1;
            currentEventService['_eventByEventId'][eventID1] = mockEvent;
            currentEventService['_currentEventByGameId'][gameId2] = eventID2;
            currentEventService['_currentEventDetailIndexByGameId'][gameId2] = index2;
            currentEventService['_eventByEventId'][eventID2] = eventGame2;

            // Act
            currentEventService['notifyClient']({ gameId: gameId1, eventID: eventID1, index: index1 });
            currentEventService['notifyClient']({ gameId: gameId2, eventID: eventID2, index: index2 });

            // Assert
            expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalledTimes(2);
            expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenNthCalledWith(
                1,
                gameId1,
                {
                    event: eventID1,
                    eventDetailIndex: index1,
                    phase: mockEvent.eventDetails[index1].phase,
                },
                currentEventService.eventName
            );
            expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenNthCalledWith(
                2,
                gameId2,
                {
                    event: eventID2,
                    eventDetailIndex: index2,
                    phase: eventGame2.eventDetails[index2].phase,
                },
                currentEventService.eventName
            );
        });

        it('should handle zero index correctly', () => {
            // Arrange
            const gameId = TEST_GAME_ID;
            const eventID = mockEvent.eventID;
            const index = 0;

            // Set up test data for getCurrentByGameId to work properly
            currentEventService['_currentEventByGameId'][gameId] = eventID;
            currentEventService['_currentEventDetailIndexByGameId'][gameId] = index;
            currentEventService['_eventByEventId'][eventID] = mockEvent;

            // Act
            currentEventService['notifyClient']({ gameId, eventID, index });

            // Assert
            expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                gameId,
                {
                    event: eventID,
                    eventDetailIndex: index,
                    phase: mockEvent.eventDetails[index].phase,
                },
                currentEventService.eventName
            );
        });

        it('should handle large event IDs and indices', () => {
            // Arrange
            const gameId = TEST_GAME_ID;
            const eventID = mockEvent.eventID; // Use mockEvent's ID
            const index = 1; // Use valid index within bounds

            // Set up test data for getCurrentByGameId to work properly
            currentEventService['_currentEventByGameId'][gameId] = eventID;
            currentEventService['_currentEventDetailIndexByGameId'][gameId] = index;
            currentEventService['_eventByEventId'][eventID] = mockEvent;

            // Act
            currentEventService['notifyClient']({ gameId, eventID, index });

            // Assert
            expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                gameId,
                {
                    event: eventID,
                    eventDetailIndex: index,
                    phase: mockEvent.eventDetails[index].phase,
                },
                currentEventService.eventName
            );
        });
    });

    describe('cleanup', () => {
        it('should remove event from _eventByEventId when cleanup is called', () => {
            // Arrange
            const eventID = mockEvent.eventID;
            currentEventService['_eventByEventId'][eventID] = mockEvent;
            expect(currentEventService['_eventByEventId'][eventID]).toBe(mockEvent);

            // Act
            currentEventService.cleanup(mockSystemNotification);

            // Assert
            expect(currentEventService['_eventByEventId'][eventID]).toBeUndefined();
        });

        it('should handle cleanup for non-existing event gracefully', () => {
            // Arrange
            const nonExistingEventID = 999999;
            const systemNotification: SystemNotification = { eventID: nonExistingEventID };
            expect(currentEventService['_eventByEventId'][nonExistingEventID]).toBeUndefined();

            // Act & Assert - should not throw
            expect(() => {
                currentEventService.cleanup(systemNotification);
            }).not.toThrow();
        });

        it('should only remove the specified event and leave others intact', () => {
            // Arrange
            const eventID1 = mockEvent.eventID;
            const eventID2 = 8589934594; // Different event ID
            const event2: Event = createMockEvent({ eventID: eventID2 });
            
            currentEventService['_eventByEventId'][eventID1] = mockEvent;
            currentEventService['_eventByEventId'][eventID2] = event2;
            
            expect(currentEventService['_eventByEventId'][eventID1]).toBe(mockEvent);
            expect(currentEventService['_eventByEventId'][eventID2]).toBe(event2);

            // Act
            currentEventService.cleanup(mockSystemNotification);

            // Assert
            expect(currentEventService['_eventByEventId'][eventID1]).toBeUndefined();
            expect(currentEventService['_eventByEventId'][eventID2]).toBe(event2); // Should remain
        });

        it('should handle multiple cleanup calls for the same event', () => {
            // Arrange
            const eventID = mockEvent.eventID;
            currentEventService['_eventByEventId'][eventID] = mockEvent;

            // Act - Call cleanup twice
            currentEventService.cleanup(mockSystemNotification);
            currentEventService.cleanup(mockSystemNotification);

            // Assert - Should not throw and event should remain undefined
            expect(currentEventService['_eventByEventId'][eventID]).toBeUndefined();
        });
    });

    describe('edge cases', () => {
        it('should handle multiple games independently', () => {
            // Arrange
            const gameId1 = TEST_GAME_ID;
            const gameId2 = TEST_GAME_ID_2;
            const eventGame2: Event = createMockEvent({
                eventID: 8589934594 // gameId: 2, roundId: 2
            });
            
            const notificationGame1: EventNotification = { event: mockEvent };
            const notificationGame2: EventNotification = { event: eventGame2 };

            // Act
            currentEventService.handleEventIndexReset(notificationGame1);
            currentEventService.handleEventIndexReset(notificationGame2);

            // Assert
            expect(currentEventService['_currentEventByGameId'][gameId1]).toBe(mockEvent.eventID);
            expect(currentEventService['_currentEventByGameId'][gameId2]).toBe(eventGame2.eventID);
            expect(currentEventService['_currentEventDetailIndexByGameId'][gameId1]).toBe(0);
            expect(currentEventService['_currentEventDetailIndexByGameId'][gameId2]).toBe(0);
        });

        it('should maintain correct context when bound methods are called directly', () => {
            // Arrange
            const boundHandleEventStart = currentEventService['boundHandleEventStart'];
            const boundHandleEventDetailResultAvailable = currentEventService['boundHandleEventDetailResultAvailable'];
            
            const delayedTime = new Date(TEST_DELAYED_TIME);
            mockDelayHandlingService.getDelayedTime.mockReturnValue(delayedTime);

            // Act - Call bound methods directly (as they would be called by event emitter)
            boundHandleEventStart(mockEventNotification);
            boundHandleEventDetailResultAvailable(mockEventDetailNotification);

            // Assert
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledTimes(2);
            expect(mockScheduler.schedule).toHaveBeenCalledTimes(2);
        });
    });
});