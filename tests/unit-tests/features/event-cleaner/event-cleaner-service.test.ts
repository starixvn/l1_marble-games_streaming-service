import { EventCleanerService } from "../../../../src/features/event-cleaner/event-cleaner-service";
import { OddFeedEventSource, OddFeedEventName, EventNotification } from "../../../../src/features/odd-feed-data";
import { Event } from "../../../../src/types";
import { idHelper } from "../../../../src/helpers";

// Mock dependencies
const mockOddFeedEventSource = {
    registerEventListener: jest.fn(),
    unregisterEventListener: jest.fn(),
    onDataCleanup: jest.fn(),
} as unknown as jest.Mocked<OddFeedEventSource>;

// Test constants
const TEST_GAME_ID_1 = '1';
const TEST_GAME_ID_2 = '2';
const TEST_EVENT_ID_1 = 4294967298; // gameId: 1, roundId: 2
const TEST_EVENT_ID_2 = 4294967299; // gameId: 1, roundId: 3
const TEST_EVENT_ID_3 = 4294967300; // gameId: 1, roundId: 4
const TEST_EVENT_ID_4 = 4294967301; // gameId: 1, roundId: 5
const TEST_EVENT_ID_GAME_2 = 8589934594; // gameId: 2, roundId: 2

// Test constant - change this value to match the service's maxLength if it changes
const MAX_QUEUE_LENGTH = 50;

// Test data
const createMockEvent = (eventID: number): Event => ({
    eventID,
    eventNameAKey: "Team A",
    eventNameBKey: "Team B",
    scheduleStartTs: "2023-01-01T10:00:00Z",
    productCode: "TEST",
    productTypeKey: "MARBLE",
    eventDetails: [],
});

const mockEvent1 = createMockEvent(TEST_EVENT_ID_1);
const mockEvent2 = createMockEvent(TEST_EVENT_ID_2);
const mockEvent3 = createMockEvent(TEST_EVENT_ID_3);
const mockEvent4 = createMockEvent(TEST_EVENT_ID_4);
const mockEventGame2 = createMockEvent(TEST_EVENT_ID_GAME_2);

const mockEventNotification1: EventNotification = { event: mockEvent1 };
const mockEventNotification2: EventNotification = { event: mockEvent2 };
const mockEventNotification3: EventNotification = { event: mockEvent3 };
const mockEventNotification4: EventNotification = { event: mockEvent4 };
const mockEventNotificationGame2: EventNotification = { event: mockEventGame2 };

// Helper functions for test setup
const createContainer = () => ({
    oddFeedEventSource: mockOddFeedEventSource,
});

const setupMocks = () => {
    jest.clearAllMocks();
};

// Helper function to create multiple mock events
const createMockEvents = (startId: number, count: number): EventNotification[] => {
    return Array.from({ length: count }, (_, i) => ({
        event: createMockEvent(startId + i)
    }));
};

// Helper function to fill queue to capacity
const fillQueueToCapacity = (service: EventCleanerService, gameStartId: number = TEST_EVENT_ID_1): EventNotification[] => {
    const events = createMockEvents(gameStartId, MAX_QUEUE_LENGTH);
    events.forEach(notification => service.handleEventStart(notification));
    return events;
};

// Helper function to fill a specific game's queue to capacity
const fillGameQueueToCapacity = (service: EventCleanerService, gameId: string, startEventId: number): void => {
    // Mock idHelper.extractGameId to return the specific gameId for our test events
    const extractGameIdSpy = jest.spyOn(idHelper, 'extractGameId').mockReturnValue(gameId);
    
    const events = createMockEvents(startEventId, MAX_QUEUE_LENGTH);
    events.forEach(notification => service.handleEventStart(notification));
    
    extractGameIdSpy.mockRestore();
};

describe('EventCleanerService', () => {
    let eventCleanerService: EventCleanerService;
    let container: any;

    beforeEach(() => {
        setupMocks();
        container = createContainer();
        eventCleanerService = new EventCleanerService(container);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Constructor', () => {
        it('should initialize with dependencies and bind event handlers', () => {
            // Arrange & Act
            const service = new EventCleanerService(container);

            // Assert
            expect(service['oddFeedEventSource']).toBe(mockOddFeedEventSource);
            expect(service['boundHandleEventStart']).toBeInstanceOf(Function);
        });

        it('should initialize empty event queue tracking object', () => {
            // Arrange & Act
            const service = new EventCleanerService(container);

            // Assert
            expect(service['_eventQueueByGameId']).toEqual({});
        });

        it('should set maxLength to configured value', () => {
            // Arrange & Act
            const service = new EventCleanerService(container);

            // Assert
            expect(service['maxLength']).toBe(MAX_QUEUE_LENGTH);
        });
    });

    describe('Event Listener Management', () => {
        describe('initEvent', () => {
            it('should register event listener for EventStart', () => {
                // Arrange & Act
                eventCleanerService.initEvent();

                // Assert
                expect(mockOddFeedEventSource.registerEventListener).toHaveBeenCalledWith(
                    OddFeedEventName.EventStart,
                    eventCleanerService['boundHandleEventStart']
                );
            });
        });

        describe('dispose', () => {
            it('should unregister event listener for EventStart', () => {
                // Arrange & Act
                eventCleanerService.dispose();

                // Assert
                expect(mockOddFeedEventSource.unregisterEventListener).toHaveBeenCalledWith(
                    OddFeedEventName.EventStart,
                    eventCleanerService['boundHandleEventStart']
                );
            });
        });
    });

    describe('Event Queue Management', () => {
        describe('handleEventStart', () => {
            it('should create new queue for first event of a game', () => {
                // Arrange & Act
                eventCleanerService.handleEventStart(mockEventNotification1);

                // Assert
                expect(eventCleanerService['_eventQueueByGameId'][TEST_GAME_ID_1]).toEqual([TEST_EVENT_ID_1]);
            });

            it('should add event to existing queue', () => {
                // Arrange
                eventCleanerService.handleEventStart(mockEventNotification1);

                // Act
                eventCleanerService.handleEventStart(mockEventNotification2);

                // Assert
                expect(eventCleanerService['_eventQueueByGameId'][TEST_GAME_ID_1]).toEqual([
                    TEST_EVENT_ID_1,
                    TEST_EVENT_ID_2
                ]);
            });

            it('should extract correct game ID using idHelper', () => {
                // Arrange
                const extractGameIdSpy = jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID_1);

                // Act
                eventCleanerService.handleEventStart(mockEventNotification1);

                // Assert
                expect(extractGameIdSpy).toHaveBeenCalledWith(TEST_EVENT_ID_1);
                expect(eventCleanerService['_eventQueueByGameId'][TEST_GAME_ID_1]).toEqual([TEST_EVENT_ID_1]);

                extractGameIdSpy.mockRestore();
            });

            it('should not trigger cleanup when queue is at maxLength', () => {
                // Arrange - Fill queue to exactly maxLength (MAX_QUEUE_LENGTH)
                fillQueueToCapacity(eventCleanerService);

                // Assert
                expect(eventCleanerService['_eventQueueByGameId'][TEST_GAME_ID_1]).toHaveLength(MAX_QUEUE_LENGTH);
                expect(mockOddFeedEventSource.onDataCleanup).not.toHaveBeenCalled();
            });

            it('should trigger cleanup when queue exceeds maxLength', () => {
                // Arrange - Fill queue to maxLength (MAX_QUEUE_LENGTH)
                fillQueueToCapacity(eventCleanerService);

                // Act - Add one more event to exceed maxLength
                const additionalEvent = { event: createMockEvent(TEST_EVENT_ID_1 + 50) };
                eventCleanerService.handleEventStart(additionalEvent);

                // Assert
                expect(eventCleanerService['_eventQueueByGameId'][TEST_GAME_ID_1]).toHaveLength(MAX_QUEUE_LENGTH);
                expect(mockOddFeedEventSource.onDataCleanup).toHaveBeenCalledWith(TEST_EVENT_ID_1);
            });

            it('should remove oldest event when cleaning up', () => {
                // Arrange - Fill queue to maxLength (MAX_QUEUE_LENGTH)
                fillQueueToCapacity(eventCleanerService);

                // Act - Add one more event to trigger cleanup
                const additionalEvent = { event: createMockEvent(TEST_EVENT_ID_1 + 50) };
                eventCleanerService.handleEventStart(additionalEvent);

                // Assert - Queue should still be at maxLength, oldest event removed
                const queue = eventCleanerService['_eventQueueByGameId'][TEST_GAME_ID_1];
                expect(queue).toHaveLength(MAX_QUEUE_LENGTH);
                expect(queue[0]).toBe(TEST_EVENT_ID_1 + 1); // Second event is now first
                expect(queue[queue.length - 1]).toBe(TEST_EVENT_ID_1 + 50); // New event is last
            });
        });

        describe('Multiple cleanup operations', () => {
            it('should handle multiple cleanup operations correctly', () => {
                // Arrange - Fill queue to maxLength (MAX_QUEUE_LENGTH)
                fillQueueToCapacity(eventCleanerService);

                // Act - Add 3 more events to trigger multiple cleanups
                const additionalEvent1 = { event: createMockEvent(TEST_EVENT_ID_1 + 50) };
                const additionalEvent2 = { event: createMockEvent(TEST_EVENT_ID_1 + 51) };
                const additionalEvent3 = { event: createMockEvent(TEST_EVENT_ID_1 + 52) };

                eventCleanerService.handleEventStart(additionalEvent1);
                eventCleanerService.handleEventStart(additionalEvent2);
                eventCleanerService.handleEventStart(additionalEvent3);

                // Assert
                expect(eventCleanerService['_eventQueueByGameId'][TEST_GAME_ID_1]).toHaveLength(MAX_QUEUE_LENGTH);
                expect(mockOddFeedEventSource.onDataCleanup).toHaveBeenCalledTimes(3);
                expect(mockOddFeedEventSource.onDataCleanup).toHaveBeenNthCalledWith(1, TEST_EVENT_ID_1);
                expect(mockOddFeedEventSource.onDataCleanup).toHaveBeenNthCalledWith(2, TEST_EVENT_ID_1 + 1);
                expect(mockOddFeedEventSource.onDataCleanup).toHaveBeenNthCalledWith(3, TEST_EVENT_ID_1 + 2);
            });
        });
    });

    describe('Multiple Games Handling', () => {
        it('should handle multiple games independently', () => {
            // Arrange & Act
            eventCleanerService.handleEventStart(mockEventNotification1); // Game 1
            eventCleanerService.handleEventStart(mockEventNotificationGame2); // Game 2
            eventCleanerService.handleEventStart(mockEventNotification2); // Game 1

            // Assert
            expect(eventCleanerService['_eventQueueByGameId'][TEST_GAME_ID_1]).toEqual([
                TEST_EVENT_ID_1,
                TEST_EVENT_ID_2
            ]);
            expect(eventCleanerService['_eventQueueByGameId'][TEST_GAME_ID_2]).toEqual([
                TEST_EVENT_ID_GAME_2
            ]);
        });

        it('should trigger cleanup independently for each game', () => {
            // Arrange - Fill Game 1 queue to maxLength (MAX_QUEUE_LENGTH)
            fillQueueToCapacity(eventCleanerService);

            // Add one event to Game 2
            eventCleanerService.handleEventStart(mockEventNotificationGame2);

            // Act - Trigger cleanup for Game 1 only by adding one more event
            const additionalEvent = { event: createMockEvent(TEST_EVENT_ID_1 + 50) };
            eventCleanerService.handleEventStart(additionalEvent);

            // Assert
            expect(eventCleanerService['_eventQueueByGameId'][TEST_GAME_ID_1]).toHaveLength(MAX_QUEUE_LENGTH);
            expect(eventCleanerService['_eventQueueByGameId'][TEST_GAME_ID_2]).toHaveLength(1);
            expect(mockOddFeedEventSource.onDataCleanup).toHaveBeenCalledTimes(1);
            expect(mockOddFeedEventSource.onDataCleanup).toHaveBeenCalledWith(TEST_EVENT_ID_1);
        });

        it('should maintain separate queue limits for each game', () => {
            // Arrange & Act - Fill Game 1 to capacity and trigger cleanup
            fillGameQueueToCapacity(eventCleanerService, TEST_GAME_ID_1, TEST_EVENT_ID_1);
            const extractGameIdSpy1 = jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID_1);
            const game1AdditionalEvent = { event: createMockEvent(TEST_EVENT_ID_1 + 50) };
            eventCleanerService.handleEventStart(game1AdditionalEvent);
            extractGameIdSpy1.mockRestore();

            // Fill Game 2 to capacity and trigger cleanup  
            fillGameQueueToCapacity(eventCleanerService, TEST_GAME_ID_2, TEST_EVENT_ID_GAME_2);
            const extractGameIdSpy2 = jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID_2);
            const game2AdditionalEvent = { event: createMockEvent(TEST_EVENT_ID_GAME_2 + 50) };
            eventCleanerService.handleEventStart(game2AdditionalEvent);
            extractGameIdSpy2.mockRestore();

            // Assert
            expect(eventCleanerService['_eventQueueByGameId'][TEST_GAME_ID_1]).toHaveLength(MAX_QUEUE_LENGTH);
            expect(eventCleanerService['_eventQueueByGameId'][TEST_GAME_ID_2]).toHaveLength(MAX_QUEUE_LENGTH);
            expect(mockOddFeedEventSource.onDataCleanup).toHaveBeenCalledTimes(2); // One cleanup per game
        });
    });

    describe('Edge Cases and Error Scenarios', () => {
        describe('Empty queue scenarios', () => {
            it('should handle shift on empty queue gracefully', () => {
                // Arrange - Create service with empty queue
                const emptyQueueService = new EventCleanerService(container);
                
                // Act & Assert - Should not throw when handling event on empty queue
                expect(() => {
                    emptyQueueService.handleEventStart(mockEventNotification1);
                }).not.toThrow();

                expect(emptyQueueService['_eventQueueByGameId'][TEST_GAME_ID_1]).toEqual([TEST_EVENT_ID_1]);
            });
        });

        describe('Queue boundary conditions', () => {
            it('should handle exactly maxLength events without cleanup', () => {
                // Arrange & Act - Add exactly maxLength events (MAX_QUEUE_LENGTH)
                fillQueueToCapacity(eventCleanerService);

                // Assert
                expect(eventCleanerService['_eventQueueByGameId'][TEST_GAME_ID_1]).toHaveLength(MAX_QUEUE_LENGTH);
                expect(mockOddFeedEventSource.onDataCleanup).not.toHaveBeenCalled();
            });

            it('should trigger cleanup only when exceeding maxLength', () => {
                // Arrange - Add maxLength events (MAX_QUEUE_LENGTH)
                fillQueueToCapacity(eventCleanerService);

                // Act - Add one more to exceed limit
                const additionalEvent = { event: createMockEvent(TEST_EVENT_ID_1 + 50) };
                eventCleanerService.handleEventStart(additionalEvent);

                // Assert
                expect(eventCleanerService['_eventQueueByGameId'][TEST_GAME_ID_1]).toHaveLength(MAX_QUEUE_LENGTH);
                expect(mockOddFeedEventSource.onDataCleanup).toHaveBeenCalledTimes(1);
            });
        });

        describe('Bound methods preservation', () => {
            it('should maintain correct context when bound method is called directly', () => {
                // Arrange
                const boundHandler = eventCleanerService['boundHandleEventStart'];

                // Act - Call bound method directly (as it would be called by event emitter)
                boundHandler(mockEventNotification1);

                // Assert
                expect(eventCleanerService['_eventQueueByGameId'][TEST_GAME_ID_1]).toEqual([TEST_EVENT_ID_1]);
            });
        });

        describe('Queue state consistency', () => {
            it('should maintain queue state consistency across multiple operations', () => {
                // Arrange - Fill queue to capacity
                fillQueueToCapacity(eventCleanerService);
                
                // Act - Add events to trigger cleanup
                const additionalEvent1 = { event: createMockEvent(TEST_EVENT_ID_1 + 50) };
                const additionalEvent2 = { event: createMockEvent(TEST_EVENT_ID_1 + 51) };
                eventCleanerService.handleEventStart(additionalEvent1);
                eventCleanerService.handleEventStart(additionalEvent2);

                // Assert queue state is consistent
                const queue = eventCleanerService['_eventQueueByGameId'][TEST_GAME_ID_1];
                expect(queue).toHaveLength(MAX_QUEUE_LENGTH);
                expect(queue[0]).toBe(TEST_EVENT_ID_1 + 2); // Third event is now first (first two removed)
                expect(queue[queue.length - 1]).toBe(TEST_EVENT_ID_1 + 51); // Newest event is last
            });
        });

        describe('Large number of events', () => {
            it('should handle continuous stream of events efficiently', () => {
                // Arrange - Create many events (more than maxLength to test cleanup)
                const totalEvents = 75; // More than maxLength (MAX_QUEUE_LENGTH)
                const manyEvents = Array.from({ length: totalEvents }, (_, i) => ({
                    event: createMockEvent(TEST_EVENT_ID_1 + i)
                }));

                // Act - Process all events
                manyEvents.forEach(notification => 
                    eventCleanerService.handleEventStart(notification)
                );

                // Assert
                const queue = eventCleanerService['_eventQueueByGameId'][TEST_GAME_ID_1];
                expect(queue).toHaveLength(MAX_QUEUE_LENGTH);
                expect(mockOddFeedEventSource.onDataCleanup).toHaveBeenCalledTimes(totalEvents - MAX_QUEUE_LENGTH); // 75 - MAX_QUEUE_LENGTH = 25 cleanups
                
                // Verify queue contains the last MAX_QUEUE_LENGTH events
                const expectedLastEvents = manyEvents.slice(-MAX_QUEUE_LENGTH).map(n => n.event.eventID);
                expect(queue).toEqual(expectedLastEvents);
            });
        });
    });
});
