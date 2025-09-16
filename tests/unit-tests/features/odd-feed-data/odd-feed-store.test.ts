import { OddFeedStore } from "../../../../src/features/odd-feed-data/odd-feed-store";
import { OddFeedEventSource, SystemNotification } from "../../../../src/features/odd-feed-data/odd-feed-event-source";
import { Event } from "../../../../src/types";
import { idHelper } from "../../../../src/helpers";

// Mock dependencies
const mockOddFeedEventSource = {
    registerSystemDataCleanupEventListener: jest.fn(),
    unregisterSystemDataCleanupEventListener: jest.fn(),
} as unknown as jest.Mocked<OddFeedEventSource>;

// Test constants
const TEST_GAME_ID_1 = "1";
const TEST_GAME_ID_2 = "2";
const TEST_EVENT_ID_1 = 4294967298; // gameId: 1, roundId: 2
const TEST_EVENT_ID_2 = 8589934594; // gameId: 2, roundId: 2
const TEST_EVENT_ID_3 = 4294967299; // gameId: 1, roundId: 3

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
const mockEvent3 = createMockEvent(TEST_EVENT_ID_3, "Team E", "Team F");

const mockSystemNotification1: SystemNotification = {
    eventID: TEST_EVENT_ID_1
};

const mockSystemNotification2: SystemNotification = {
    eventID: TEST_EVENT_ID_2
};

// Helper functions for test setup
const createContainer = () => ({
    oddFeedEventSource: mockOddFeedEventSource,
});

const setupMocks = () => {
    jest.clearAllMocks();
};

describe("OddFeedStore", () => {
  let oddFeedStore: OddFeedStore;
    let container: any;

  beforeEach(() => {
        setupMocks();
        container = createContainer();
        oddFeedStore = new OddFeedStore(container);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("Constructor", () => {
        it("should initialize with dependencies and bind event handlers", () => {
            // Arrange & Act
            const service = new OddFeedStore(container);

            // Assert
            expect(service['oddFeedEventSource']).toBe(mockOddFeedEventSource);
            expect(service['boundHandleSystemDataCleanup']).toBeInstanceOf(Function);
        });

        it("should initialize empty eventByGameId storage", () => {
            // Arrange & Act
            const service = new OddFeedStore(container);

            // Assert
            expect(service).toBeInstanceOf(OddFeedStore);
            expect(service['eventByGameId']).toEqual({});
        });

        it("should register system data cleanup event listener on construction", () => {
            // Arrange - Clear previous calls from beforeEach
            setupMocks();

            // Act
            new OddFeedStore(container);

            // Assert
            expect(mockOddFeedEventSource.registerSystemDataCleanupEventListener).toHaveBeenCalledTimes(1);
            expect(mockOddFeedEventSource.registerSystemDataCleanupEventListener).toHaveBeenCalledWith(
                expect.any(Function)
            );
        });
    });

    describe("Event Listener Management", () => {
        describe("initEvent", () => {
            it("should register system data cleanup event listener", () => {
                // Arrange & Act
                oddFeedStore.initEvent();

                // Assert
                expect(mockOddFeedEventSource.registerSystemDataCleanupEventListener).toHaveBeenCalledWith(
                    oddFeedStore['boundHandleSystemDataCleanup']
                );
            });
        });

        describe("dispose", () => {
            it("should unregister system data cleanup event listener", () => {
                // Arrange & Act
                oddFeedStore.dispose();

                // Assert
                expect(mockOddFeedEventSource.unregisterSystemDataCleanupEventListener).toHaveBeenCalledWith(
                    oddFeedStore['boundHandleSystemDataCleanup']
                );
            });
    });
  });

    describe("Event Storage Operations", () => {
  describe("setEventByGameId", () => {
    it("should store event for new gameId and eventId", () => {
      // Act
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, mockEvent1);

      // Assert
                expect(oddFeedStore['eventByGameId'][TEST_GAME_ID_1]).toBeDefined();
                expect(oddFeedStore['eventByGameId'][TEST_GAME_ID_1][TEST_EVENT_ID_1]).toBe(mockEvent1);
    });

    it("should store multiple events for same gameId", () => {
      // Act
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, mockEvent1);
                oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_3, mockEvent3);

      // Assert
                expect(oddFeedStore['eventByGameId'][TEST_GAME_ID_1][TEST_EVENT_ID_1]).toBe(mockEvent1);
                expect(oddFeedStore['eventByGameId'][TEST_GAME_ID_1][TEST_EVENT_ID_3]).toBe(mockEvent3);
    });

    it("should store events for different gameIds", () => {
      // Act
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, mockEvent1);
      oddFeedStore.setEventByGameId(TEST_GAME_ID_2, TEST_EVENT_ID_2, mockEvent2);

      // Assert
                expect(oddFeedStore['eventByGameId'][TEST_GAME_ID_1][TEST_EVENT_ID_1]).toBe(mockEvent1);
                expect(oddFeedStore['eventByGameId'][TEST_GAME_ID_2][TEST_EVENT_ID_2]).toBe(mockEvent2);
    });

    it("should overwrite existing event with same gameId and eventId", () => {
      // Arrange
      const updatedEvent = { ...mockEvent1, eventNameAKey: "Updated Team A" };

      // Act
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, mockEvent1);
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, updatedEvent);

      // Assert
                expect(oddFeedStore['eventByGameId'][TEST_GAME_ID_1][TEST_EVENT_ID_1]).toBe(updatedEvent);
                expect(oddFeedStore['eventByGameId'][TEST_GAME_ID_1][TEST_EVENT_ID_1]).not.toBe(mockEvent1);
    });

    it("should create gameId entry if it does not exist", () => {
      // Arrange
                expect(oddFeedStore['eventByGameId'][TEST_GAME_ID_1]).toBeUndefined();

      // Act
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, mockEvent1);

      // Assert
                expect(oddFeedStore['eventByGameId'][TEST_GAME_ID_1]).toBeDefined();
                expect(oddFeedStore['eventByGameId'][TEST_GAME_ID_1]).toEqual({
        [TEST_EVENT_ID_1]: mockEvent1
      });
    });

    it("should not affect existing gameId entry when adding new eventId", () => {
      // Arrange
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, mockEvent1);

      // Act
                oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_3, mockEvent3);

      // Assert
                expect(oddFeedStore['eventByGameId'][TEST_GAME_ID_1][TEST_EVENT_ID_1]).toBe(mockEvent1);
                expect(oddFeedStore['eventByGameId'][TEST_GAME_ID_1][TEST_EVENT_ID_3]).toBe(mockEvent3);
    });
  });

  describe("getEventByGameId", () => {
    it("should return event when gameId and eventId exist", () => {
      // Arrange
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, mockEvent1);

      // Act
      const result = oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1);

      // Assert
      expect(result).toBe(mockEvent1);
    });

    it("should return undefined when gameId does not exist", () => {
      // Act
      const result = oddFeedStore.getEventByGameId("non-existent-game", TEST_EVENT_ID_1);

      // Assert
      expect(result).toBeUndefined();
    });

    it("should return undefined when gameId exists but eventId does not", () => {
      // Arrange
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, mockEvent1);

      // Act
      const result = oddFeedStore.getEventByGameId(TEST_GAME_ID_1, 9999);

      // Assert
      expect(result).toBeUndefined();
    });

    it("should return correct event when multiple events exist for same gameId", () => {
      // Arrange
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, mockEvent1);
                oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_3, mockEvent3);

      // Act
      const result1 = oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1);
                const result2 = oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_3);

      // Assert
      expect(result1).toBe(mockEvent1);
                expect(result2).toBe(mockEvent3);
    });

    it("should return correct event when multiple gameIds exist", () => {
      // Arrange
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, mockEvent1);
      oddFeedStore.setEventByGameId(TEST_GAME_ID_2, TEST_EVENT_ID_2, mockEvent2);

      // Act
      const result1 = oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1);
      const result2 = oddFeedStore.getEventByGameId(TEST_GAME_ID_2, TEST_EVENT_ID_2);

      // Assert
      expect(result1).toBe(mockEvent1);
      expect(result2).toBe(mockEvent2);
    });

    it("should return undefined for empty store", () => {
      // Act
      const result = oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1);

      // Assert
      expect(result).toBeUndefined();
    });
  });
    });

    describe("Cleanup Operations", () => {
        beforeEach(() => {
            // Set up some events for cleanup tests
            oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, mockEvent1);
            oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_3, mockEvent3);
            oddFeedStore.setEventByGameId(TEST_GAME_ID_2, TEST_EVENT_ID_2, mockEvent2);
        });

        describe("cleanup", () => {
            it("should remove event from correct gameId", () => {
                // Arrange
                expect(oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1)).toBe(mockEvent1);

                // Act
                oddFeedStore.cleanup(TEST_EVENT_ID_1);

                // Assert
                expect(oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1)).toBeUndefined();
                expect(oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_3)).toBe(mockEvent3); // Should not be affected
                expect(oddFeedStore.getEventByGameId(TEST_GAME_ID_2, TEST_EVENT_ID_2)).toBe(mockEvent2); // Should not be affected
            });

            it("should extract correct game ID using idHelper", () => {
                // Arrange
                const extractGameIdSpy = jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID_1);

                // Act
                oddFeedStore.cleanup(TEST_EVENT_ID_1);

                // Assert
                expect(extractGameIdSpy).toHaveBeenCalledWith(TEST_EVENT_ID_1);
                expect(oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1)).toBeUndefined();

                extractGameIdSpy.mockRestore();
            });

            it("should handle cleanup for non-existent gameId gracefully", () => {
                // Arrange
                const nonExistentEventId = 999999;
                const nonExistentGameId = "999";
                jest.spyOn(idHelper, 'extractGameId').mockReturnValue(nonExistentGameId);

                // Act & Assert - should not throw
                expect(() => {
                    oddFeedStore.cleanup(nonExistentEventId);
                }).not.toThrow();

                // Original data should remain unchanged
                expect(oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1)).toBe(mockEvent1);
            });

            it("should handle cleanup for non-existent eventId in existing gameId gracefully", () => {
                // Arrange
                const nonExistentEventId = 999999;
                jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID_1);

                // Act & Assert - should not throw
                expect(() => {
                    oddFeedStore.cleanup(nonExistentEventId);
                }).not.toThrow();

                // Original data should remain unchanged
                expect(oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1)).toBe(mockEvent1);
            });

            it("should log cleanup message", () => {
                // Arrange
                const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

                // Act
                oddFeedStore.cleanup(TEST_EVENT_ID_1);

                // Assert
                expect(consoleSpy).toHaveBeenCalledWith(`Cleaning up event ${TEST_EVENT_ID_1} for game ${TEST_GAME_ID_1}`);

                consoleSpy.mockRestore();
            });
        });

        describe("handleSystemDataCleanup", () => {
            it("should call cleanup with correct eventID", () => {
      // Arrange
                const cleanupSpy = jest.spyOn(oddFeedStore, 'cleanup');

                // Act
                oddFeedStore.handleSystemDataCleanup(mockSystemNotification1);

                // Assert
                expect(cleanupSpy).toHaveBeenCalledWith(TEST_EVENT_ID_1);

                cleanupSpy.mockRestore();
            });

            it("should remove the correct event through system notification", () => {
                // Arrange
                expect(oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1)).toBe(mockEvent1);

                // Act
                oddFeedStore.handleSystemDataCleanup(mockSystemNotification1);

      // Assert
                expect(oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1)).toBeUndefined();
                expect(oddFeedStore.getEventByGameId(TEST_GAME_ID_2, TEST_EVENT_ID_2)).toBe(mockEvent2); // Should not be affected
            });
        });
    });

    describe("Edge Cases and Error Scenarios", () => {
        describe("Bound methods preservation", () => {
            it("should maintain correct context when bound method is called directly", () => {
                // Arrange
                oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, mockEvent1);
                const boundHandler = oddFeedStore['boundHandleSystemDataCleanup'];

                // Act - Call bound method directly (as it would be called by event emitter)
                boundHandler(mockSystemNotification1);

                // Assert
                expect(oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1)).toBeUndefined();
            });
        });

        describe("Data consistency", () => {
            it("should maintain data structure integrity after multiple operations", () => {
                // Arrange & Act
                oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, mockEvent1);
                oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_3, mockEvent3);
                oddFeedStore.setEventByGameId(TEST_GAME_ID_2, TEST_EVENT_ID_2, mockEvent2);
                
                // Clean up one event
                oddFeedStore.cleanup(TEST_EVENT_ID_1);
                
                // Add another event
                const newEvent = createMockEvent(4294967300, "New Team A", "New Team B");
                oddFeedStore.setEventByGameId(TEST_GAME_ID_1, 4294967300, newEvent);

                // Assert
                expect(oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1)).toBeUndefined();
                expect(oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_3)).toBe(mockEvent3);
                expect(oddFeedStore.getEventByGameId(TEST_GAME_ID_1, 4294967300)).toBe(newEvent);
                expect(oddFeedStore.getEventByGameId(TEST_GAME_ID_2, TEST_EVENT_ID_2)).toBe(mockEvent2);
            });
        });

        describe("Large scale operations", () => {
            it("should handle many events efficiently", () => {
                // Arrange
                const numberOfEvents = 100;
                const events: Event[] = [];
                
                for (let i = 0; i < numberOfEvents; i++) {
                    const eventId = TEST_EVENT_ID_1 + i;
                    const event = createMockEvent(eventId, `Team A${i}`, `Team B${i}`);
                    events.push(event);
                }

                // Act - Store many events
                events.forEach((event, i) => {
                    oddFeedStore.setEventByGameId(TEST_GAME_ID_1, event.eventID, event);
                });

                // Assert - All events should be retrievable
                events.forEach(event => {
                    expect(oddFeedStore.getEventByGameId(TEST_GAME_ID_1, event.eventID)).toBe(event);
                });

                // Act - Clean up half of them
                const eventsToCleanup = events.slice(0, numberOfEvents / 2);
                eventsToCleanup.forEach(event => {
                    oddFeedStore.cleanup(event.eventID);
                });

                // Assert - Cleaned events should be gone, others should remain
                eventsToCleanup.forEach(event => {
                    expect(oddFeedStore.getEventByGameId(TEST_GAME_ID_1, event.eventID)).toBeUndefined();
                });
                
                const remainingEvents = events.slice(numberOfEvents / 2);
                remainingEvents.forEach(event => {
                    expect(oddFeedStore.getEventByGameId(TEST_GAME_ID_1, event.eventID)).toBe(event);
                });
            });
        });

        describe("Integration scenarios", () => {
            it("should handle complete set, get, and cleanup workflow", () => {
                // Arrange
                const events = [mockEvent1, mockEvent2, mockEvent3];
                const gameIds = [TEST_GAME_ID_1, TEST_GAME_ID_2, TEST_GAME_ID_1];
                const eventIds = [TEST_EVENT_ID_1, TEST_EVENT_ID_2, TEST_EVENT_ID_3];

                // Act - Store events
                events.forEach((event, i) => {
                    oddFeedStore.setEventByGameId(gameIds[i], eventIds[i], event);
                });

                // Act - Retrieve events
                const retrieved = events.map((event, i) => 
                    oddFeedStore.getEventByGameId(gameIds[i], eventIds[i])
                );

                // Assert - All events should be retrievable
                retrieved.forEach((event, i) => {
                    expect(event).toBe(events[i]);
                });

                // Act - Cleanup one event
                oddFeedStore.handleSystemDataCleanup(mockSystemNotification1);

                // Assert - Cleaned event should be gone, others remain
                expect(oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1)).toBeUndefined();
                expect(oddFeedStore.getEventByGameId(TEST_GAME_ID_2, TEST_EVENT_ID_2)).toBe(mockEvent2);
                expect(oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_3)).toBe(mockEvent3);
            });

            it("should handle event updates and cleanup correctly", () => {
      // Arrange
      const originalEvent = mockEvent1;
      const updatedEvent = { ...mockEvent1, eventNameAKey: "Updated Team" };

                // Act - Store, update, then cleanup
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, originalEvent);
      const beforeUpdate = oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1);
      
      oddFeedStore.setEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1, updatedEvent);
      const afterUpdate = oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1);
                
                oddFeedStore.cleanup(TEST_EVENT_ID_1);
                const afterCleanup = oddFeedStore.getEventByGameId(TEST_GAME_ID_1, TEST_EVENT_ID_1);

      // Assert
      expect(beforeUpdate).toBe(originalEvent);
      expect(afterUpdate).toBe(updatedEvent);
      expect(afterUpdate).not.toBe(originalEvent);
                expect(afterCleanup).toBeUndefined();
            });
    });
  });
});
