import { 
    OddFeedEventSource, 
    OddFeedEventName, 
    SystemEventName,
    EventNotification,
    EventDetailNotification,
    SystemNotification,
    CatchAllEventListener,
    EventListener,
    EventDetailListener,
    SystemEventListener
} from "../../../../src/features/odd-feed-data/odd-feed-event-source";
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

// Test constants
const TEST_EVENT_ID_1 = 4294967298; // gameId: 1, roundId: 2
const TEST_EVENT_ID_2 = 8589934594; // gameId: 2, roundId: 2
const TEST_INDEX = 1;
const TEST_INDEX_2 = 2;

// Test data
const createMockEvent = (eventID: number, teamA = "Team A", teamB = "Team B"): Event => ({
    eventID,
    eventNameAKey: teamA,
    eventNameBKey: teamB,
    scheduleStartTs: "2024-01-01T10:00:00Z",
    productCode: "TEST",
    productTypeKey: "MARBLE",
    eventDetails: [
        {
            eventID,
            oddsAvailableTs: "2024-01-01T10:00:00Z",
            scheduleStartTs: "2024-01-01T10:00:30Z",
            resultsAvailableTs: "2024-01-01T10:01:00Z",
            hasResults: false,
            goalInfo: "{}",
            playlist: "playlist.m3u8",
            result: "",
            markets: {},
            inGameEventInfo: "{}"
        }
    ]
});

const mockEvent1 = createMockEvent(TEST_EVENT_ID_1, "Team A", "Team B");
const mockEvent2 = createMockEvent(TEST_EVENT_ID_2, "Team C", "Team D");

// Helper functions for test setup
const setupMocks = () => {
    jest.clearAllMocks();
};

describe("OddFeedEventSource", () => {
    let oddFeedEventSource: OddFeedEventSource;

    beforeEach(() => {
        setupMocks();
        oddFeedEventSource = new OddFeedEventSource();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("Constructor", () => {
        it("should initialize EventEmitter instance", () => {
            // Arrange & Act
            const instance = new OddFeedEventSource();

            // Assert
            expect(instance.OddFeedEventSource).toBeDefined();
            expect(instance.OddFeedEventSource).toBe(mockEventEmitter);
        });

        it("should create a new instance each time", () => {
            // Arrange & Act
            const instance1 = new OddFeedEventSource();
            const instance2 = new OddFeedEventSource();

            // Assert
            expect(instance1).not.toBe(instance2);
            expect(instance1.OddFeedEventSource).toBe(mockEventEmitter);
            expect(instance2.OddFeedEventSource).toBe(mockEventEmitter);
        });
    });

    describe("Listener Registration and Management", () => {
        describe("Wildcard Event Listeners", () => {
            it("should register wildcard listener", () => {
                // Arrange
                const listener: CatchAllEventListener = jest.fn();

                // Act
                oddFeedEventSource.registerWildcardEventListener(listener);

                // Assert
                expect(mockEventEmitter.on).toHaveBeenCalledWith(OddFeedEventName.Wildcard, listener);
            });

            it("should unregister wildcard listener", () => {
                // Arrange
                const listener: CatchAllEventListener = jest.fn();

                // Act
                oddFeedEventSource.unregisterWildcardEventListener(listener);

                // Assert
                expect(mockEventEmitter.off).toHaveBeenCalledWith(OddFeedEventName.Wildcard, listener);
            });

            it("should handle multiple wildcard listeners", () => {
                // Arrange
                const listener1: CatchAllEventListener = jest.fn();
                const listener2: CatchAllEventListener = jest.fn();

                // Act
                oddFeedEventSource.registerWildcardEventListener(listener1);
                oddFeedEventSource.registerWildcardEventListener(listener2);

                // Assert
                expect(mockEventEmitter.on).toHaveBeenCalledTimes(2);
                expect(mockEventEmitter.on).toHaveBeenNthCalledWith(1, OddFeedEventName.Wildcard, listener1);
                expect(mockEventEmitter.on).toHaveBeenNthCalledWith(2, OddFeedEventName.Wildcard, listener2);
            });
        });

        describe("Event Listeners", () => {
            it("should register event listener for specific event", () => {
                // Arrange
                const eventName = OddFeedEventName.EventStart;
                const listener: EventListener = jest.fn();

                // Act
                oddFeedEventSource.registerEventListener(eventName, listener);

                // Assert
                expect(mockEventEmitter.on).toHaveBeenCalledWith(eventName, listener);
            });

            it("should unregister event listener for specific event", () => {
                // Arrange
                const eventName = OddFeedEventName.EventStart;
                const listener: EventListener = jest.fn();

                // Act
                oddFeedEventSource.unregisterEventListener(eventName, listener);

                // Assert
                expect(mockEventEmitter.off).toHaveBeenCalledWith(eventName, listener);
            });

            it("should register listeners for different event types", () => {
                // Arrange
                const eventStartListener: EventListener = jest.fn();
                const eventUpcomingListener: EventListener = jest.fn();

                // Act
                oddFeedEventSource.registerEventListener(OddFeedEventName.EventStart, eventStartListener);
                oddFeedEventSource.registerEventListener(OddFeedEventName.EventUpcoming, eventUpcomingListener);

                // Assert
                expect(mockEventEmitter.on).toHaveBeenCalledTimes(2);
                expect(mockEventEmitter.on).toHaveBeenNthCalledWith(1, OddFeedEventName.EventStart, eventStartListener);
                expect(mockEventEmitter.on).toHaveBeenNthCalledWith(2, OddFeedEventName.EventUpcoming, eventUpcomingListener);
            });
        });

        describe("Event Detail Listeners", () => {
            it("should register event detail listener", () => {
                // Arrange
                const eventName = OddFeedEventName.EventDetailStart;
                const listener: EventDetailListener = jest.fn();

                // Act
                oddFeedEventSource.registerEventDetailEventListener(eventName, listener);

                // Assert
                expect(mockEventEmitter.on).toHaveBeenCalledWith(eventName, listener);
            });

            it("should unregister event detail listener", () => {
                // Arrange
                const eventName = OddFeedEventName.EventDetailStart;
                const listener: EventDetailListener = jest.fn();

                // Act
                oddFeedEventSource.unregisterEventDetailEventListener(eventName, listener);

                // Assert
                expect(mockEventEmitter.off).toHaveBeenCalledWith(eventName, listener);
            });

            it("should register listeners for all event detail types", () => {
                // Arrange
                const startListener: EventDetailListener = jest.fn();
                const oddsListener: EventDetailListener = jest.fn();
                const resultsListener: EventDetailListener = jest.fn();

                // Act
                oddFeedEventSource.registerEventDetailEventListener(OddFeedEventName.EventDetailStart, startListener);
                oddFeedEventSource.registerEventDetailEventListener(OddFeedEventName.EventDetailOddsAvailable, oddsListener);
                oddFeedEventSource.registerEventDetailEventListener(OddFeedEventName.EventDetailResultsAvailable, resultsListener);

                // Assert
                expect(mockEventEmitter.on).toHaveBeenCalledTimes(3);
                expect(mockEventEmitter.on).toHaveBeenNthCalledWith(1, OddFeedEventName.EventDetailStart, startListener);
                expect(mockEventEmitter.on).toHaveBeenNthCalledWith(2, OddFeedEventName.EventDetailOddsAvailable, oddsListener);
                expect(mockEventEmitter.on).toHaveBeenNthCalledWith(3, OddFeedEventName.EventDetailResultsAvailable, resultsListener);
            });
        });

        describe("System Event Listeners", () => {
            it("should register system data cleanup event listener", () => {
                // Arrange
                const listener: SystemEventListener = jest.fn();

                // Act
                oddFeedEventSource.registerSystemDataCleanupEventListener(listener);

                // Assert
                expect(mockEventEmitter.on).toHaveBeenCalledWith(SystemEventName.DataCleanup, listener);
            });

            it("should unregister system data cleanup event listener", () => {
                // Arrange
                const listener: SystemEventListener = jest.fn();

                // Act
                oddFeedEventSource.unregisterSystemDataCleanupEventListener(listener);

                // Assert
                expect(mockEventEmitter.off).toHaveBeenCalledWith(SystemEventName.DataCleanup, listener);
            });

            it("should handle multiple system listeners", () => {
                // Arrange
                const listener1: SystemEventListener = jest.fn();
                const listener2: SystemEventListener = jest.fn();

                // Act
                oddFeedEventSource.registerSystemDataCleanupEventListener(listener1);
                oddFeedEventSource.registerSystemDataCleanupEventListener(listener2);

                // Assert
                expect(mockEventEmitter.on).toHaveBeenCalledTimes(2);
                expect(mockEventEmitter.on).toHaveBeenNthCalledWith(1, SystemEventName.DataCleanup, listener1);
                expect(mockEventEmitter.on).toHaveBeenNthCalledWith(2, SystemEventName.DataCleanup, listener2);
            });
        });
    });

    describe("Event Emission", () => {
        describe("onEventStart", () => {
            it("should emit EventStart event with correct notification", () => {
                // Arrange
                const expectedNotification: EventNotification = { event: mockEvent1 };

                // Act
                oddFeedEventSource.onEventStart(mockEvent1);

                // Assert
                expect(mockEventEmitter.emit).toHaveBeenCalledTimes(2);
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(1, OddFeedEventName.Wildcard, OddFeedEventName.EventStart, expectedNotification);
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(2, OddFeedEventName.EventStart, expectedNotification);
            });

            it("should emit with different events", () => {
                // Act
                oddFeedEventSource.onEventStart(mockEvent1);
                oddFeedEventSource.onEventStart(mockEvent2);

                // Assert
                expect(mockEventEmitter.emit).toHaveBeenCalledTimes(4);
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(1, OddFeedEventName.Wildcard, OddFeedEventName.EventStart, { event: mockEvent1 });
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(3, OddFeedEventName.Wildcard, OddFeedEventName.EventStart, { event: mockEvent2 });
            });
        });

        describe("onEventUpcoming", () => {
            it("should emit EventUpcoming event with correct notification", () => {
                // Arrange
                const expectedNotification: EventNotification = { event: mockEvent1 };

                // Act
                oddFeedEventSource.onEventUpcoming(mockEvent1);

                // Assert
                expect(mockEventEmitter.emit).toHaveBeenCalledTimes(2);
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(1, OddFeedEventName.Wildcard, OddFeedEventName.EventUpcoming, expectedNotification);
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(2, OddFeedEventName.EventUpcoming, expectedNotification);
            });

            it("should emit with different events", () => {
                // Act
                oddFeedEventSource.onEventUpcoming(mockEvent1);
                oddFeedEventSource.onEventUpcoming(mockEvent2);

                // Assert
                expect(mockEventEmitter.emit).toHaveBeenCalledTimes(4);
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(1, OddFeedEventName.Wildcard, OddFeedEventName.EventUpcoming, { event: mockEvent1 });
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(3, OddFeedEventName.Wildcard, OddFeedEventName.EventUpcoming, { event: mockEvent2 });
            });
        });

        describe("onEventDetailStart", () => {
            it("should emit EventDetailStart event with correct notification", () => {
                // Arrange
                const expectedNotification: EventDetailNotification = { event: mockEvent1, index: TEST_INDEX };

                // Act
                oddFeedEventSource.onEventDetailStart(mockEvent1, TEST_INDEX);

                // Assert
                expect(mockEventEmitter.emit).toHaveBeenCalledTimes(2);
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(1, OddFeedEventName.Wildcard, OddFeedEventName.EventDetailStart, expectedNotification);
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(2, OddFeedEventName.EventDetailStart, expectedNotification);
            });

            it("should emit with different indices", () => {
                // Act
                oddFeedEventSource.onEventDetailStart(mockEvent1, TEST_INDEX);
                oddFeedEventSource.onEventDetailStart(mockEvent1, TEST_INDEX_2);

                // Assert
                expect(mockEventEmitter.emit).toHaveBeenCalledTimes(4);
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(1, OddFeedEventName.Wildcard, OddFeedEventName.EventDetailStart, { event: mockEvent1, index: TEST_INDEX });
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(3, OddFeedEventName.Wildcard, OddFeedEventName.EventDetailStart, { event: mockEvent1, index: TEST_INDEX_2 });
            });
        });

        describe("onEventDetailOddsAvailable", () => {
            it("should emit EventDetailOddsAvailable event with correct notification", () => {
                // Arrange
                const expectedNotification: EventDetailNotification = { event: mockEvent1, index: TEST_INDEX };

                // Act
                oddFeedEventSource.onEventDetailOddsAvailable(mockEvent1, TEST_INDEX);

                // Assert
                expect(mockEventEmitter.emit).toHaveBeenCalledTimes(2);
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(1, OddFeedEventName.Wildcard, OddFeedEventName.EventDetailOddsAvailable, expectedNotification);
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(2, OddFeedEventName.EventDetailOddsAvailable, expectedNotification);
            });

            it("should emit with different events and indices", () => {
                // Act
                oddFeedEventSource.onEventDetailOddsAvailable(mockEvent1, TEST_INDEX);
                oddFeedEventSource.onEventDetailOddsAvailable(mockEvent2, TEST_INDEX_2);

                // Assert
                expect(mockEventEmitter.emit).toHaveBeenCalledTimes(4);
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(1, OddFeedEventName.Wildcard, OddFeedEventName.EventDetailOddsAvailable, { event: mockEvent1, index: TEST_INDEX });
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(3, OddFeedEventName.Wildcard, OddFeedEventName.EventDetailOddsAvailable, { event: mockEvent2, index: TEST_INDEX_2 });
            });
        });

        describe("onEventDetailResultsAvailable", () => {
            it("should emit EventDetailResultsAvailable event with correct notification", () => {
                // Arrange
                const expectedNotification: EventDetailNotification = { event: mockEvent1, index: TEST_INDEX };

                // Act
                oddFeedEventSource.onEventDetailResultsAvailable(mockEvent1, TEST_INDEX);

                // Assert
                expect(mockEventEmitter.emit).toHaveBeenCalledTimes(2);
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(1, OddFeedEventName.Wildcard, OddFeedEventName.EventDetailResultsAvailable, expectedNotification);
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(2, OddFeedEventName.EventDetailResultsAvailable, expectedNotification);
            });

            it("should emit with zero index", () => {
                // Act
                oddFeedEventSource.onEventDetailResultsAvailable(mockEvent1, 0);

                // Assert
                expect(mockEventEmitter.emit).toHaveBeenCalledTimes(2);
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(1, OddFeedEventName.Wildcard, OddFeedEventName.EventDetailResultsAvailable, { event: mockEvent1, index: 0 });
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(2, OddFeedEventName.EventDetailResultsAvailable, { event: mockEvent1, index: 0 });
            });
        });
    });

    describe("System Events", () => {
        describe("onDataCleanup", () => {
            it("should emit system data cleanup event with correct notification", () => {
                // Arrange
                const expectedNotification: SystemNotification = { eventID: TEST_EVENT_ID_1 };

                // Act
                oddFeedEventSource.onDataCleanup(TEST_EVENT_ID_1);

                // Assert
                expect(mockEventEmitter.emit).toHaveBeenCalledTimes(2);
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(1, OddFeedEventName.Wildcard, SystemEventName.DataCleanup, expectedNotification);
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(2, SystemEventName.DataCleanup, expectedNotification);
            });

            it("should emit with different event IDs", () => {
                // Act
                oddFeedEventSource.onDataCleanup(TEST_EVENT_ID_1);
                oddFeedEventSource.onDataCleanup(TEST_EVENT_ID_2);

                // Assert
                expect(mockEventEmitter.emit).toHaveBeenCalledTimes(4);
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(1, OddFeedEventName.Wildcard, SystemEventName.DataCleanup, { eventID: TEST_EVENT_ID_1 });
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(3, OddFeedEventName.Wildcard, SystemEventName.DataCleanup, { eventID: TEST_EVENT_ID_2 });
            });
        });
    });

    describe("Private emit method behavior", () => {
        it("should always emit both wildcard and specific events for event notifications", () => {
            // Act
            oddFeedEventSource.onEventStart(mockEvent1);

            // Assert - verify private emit method calls both wildcard and specific event
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                OddFeedEventName.Wildcard, 
                OddFeedEventName.EventStart, 
                { event: mockEvent1 }
            );
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                OddFeedEventName.EventStart, 
                { event: mockEvent1 }
            );
        });

        it("should always emit both wildcard and specific events for event detail notifications", () => {
            // Act
            oddFeedEventSource.onEventDetailStart(mockEvent1, TEST_INDEX);

            // Assert - verify private emit method calls both wildcard and specific event
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                OddFeedEventName.Wildcard, 
                OddFeedEventName.EventDetailStart, 
                { event: mockEvent1, index: TEST_INDEX }
            );
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                OddFeedEventName.EventDetailStart, 
                { event: mockEvent1, index: TEST_INDEX }
            );
        });

        it("should always emit both wildcard and specific events for system notifications", () => {
            // Act
            oddFeedEventSource.onDataCleanup(TEST_EVENT_ID_1);

            // Assert - verify private emit method calls both wildcard and specific event
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                OddFeedEventName.Wildcard, 
                SystemEventName.DataCleanup, 
                { eventID: TEST_EVENT_ID_1 }
            );
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                SystemEventName.DataCleanup, 
                { eventID: TEST_EVENT_ID_1 }
            );
        });
    });

    describe("Edge Cases and Integration", () => {
        describe("Multiple event emissions", () => {
            it("should handle rapid successive emissions", () => {
                // Act
                oddFeedEventSource.onEventStart(mockEvent1);
                oddFeedEventSource.onEventDetailStart(mockEvent1, 0);
                oddFeedEventSource.onEventDetailOddsAvailable(mockEvent1, 0);
                oddFeedEventSource.onEventDetailResultsAvailable(mockEvent1, 0);

                // Assert
                expect(mockEventEmitter.emit).toHaveBeenCalledTimes(8); // 4 events × 2 calls each
            });

            it("should maintain correct order of emissions", () => {
                // Act
                oddFeedEventSource.onEventStart(mockEvent1);
                oddFeedEventSource.onEventUpcoming(mockEvent2);

                // Assert - verify order
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(1, OddFeedEventName.Wildcard, OddFeedEventName.EventStart, { event: mockEvent1 });
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(2, OddFeedEventName.EventStart, { event: mockEvent1 });
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(3, OddFeedEventName.Wildcard, OddFeedEventName.EventUpcoming, { event: mockEvent2 });
                expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(4, OddFeedEventName.EventUpcoming, { event: mockEvent2 });
            });
        });

        describe("Event data integrity", () => {
            it("should preserve event object references in notifications", () => {
                // Act
                oddFeedEventSource.onEventStart(mockEvent1);

                // Assert
                const callArgs = mockEventEmitter.emit.mock.calls[1]; // Second call (specific event)
                const notification = callArgs[1] as EventNotification;
                expect(notification.event).toBe(mockEvent1); // Same reference
            });

            it("should preserve index values in event detail notifications", () => {
                // Arrange
                const testIndex = 42;

                // Act
                oddFeedEventSource.onEventDetailStart(mockEvent1, testIndex);

                // Assert
                const callArgs = mockEventEmitter.emit.mock.calls[1]; // Second call (specific event)
                const notification = callArgs[1] as EventDetailNotification;
                expect(notification.index).toBe(testIndex);
            });
        });

        describe("Listener management edge cases", () => {
            it("should handle same listener registered multiple times", () => {
                // Arrange
                const listener: EventListener = jest.fn();

                // Act
                oddFeedEventSource.registerEventListener(OddFeedEventName.EventStart, listener);
                oddFeedEventSource.registerEventListener(OddFeedEventName.EventStart, listener);

                // Assert
                expect(mockEventEmitter.on).toHaveBeenCalledTimes(2);
                expect(mockEventEmitter.on).toHaveBeenCalledWith(OddFeedEventName.EventStart, listener);
            });

            it("should handle unregistering non-existent listener gracefully", () => {
                // Arrange
                const listener: EventListener = jest.fn();

                // Act & Assert - should not throw
                expect(() => {
                    oddFeedEventSource.unregisterEventListener(OddFeedEventName.EventStart, listener);
                }).not.toThrow();

                expect(mockEventEmitter.off).toHaveBeenCalledWith(OddFeedEventName.EventStart, listener);
            });
        });

        describe("Type safety and interface compliance", () => {
            it("should work with all OddFeedEventName enum values", () => {
                // Arrange
                const listener: EventListener = jest.fn();
                const allEventNames = [
                    OddFeedEventName.EventStart,
                    OddFeedEventName.EventDetailStart,
                    OddFeedEventName.EventDetailOddsAvailable,
                    OddFeedEventName.EventDetailResultsAvailable,
                    OddFeedEventName.EventUpcoming,
                ];

                // Act
                allEventNames.forEach(eventName => {
                    oddFeedEventSource.registerEventListener(eventName, listener);
                });

                // Assert
                expect(mockEventEmitter.on).toHaveBeenCalledTimes(allEventNames.length);
                allEventNames.forEach((eventName, index) => {
                    expect(mockEventEmitter.on).toHaveBeenNthCalledWith(index + 1, eventName, listener);
                });
            });
        });
    });
});
