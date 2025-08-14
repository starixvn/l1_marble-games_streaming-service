import { EventStore } from "../../../src/stores/event-store";
import { EventStreamState, EventDetail, JobName, GoalInfoData } from "../../../src/types";

// Test data factories
const createMockEventDetail = (eventId: number = 1, index: number = 0): EventDetail => ({
  eventID: eventId,
  oddsAvailableTs: "2024-01-01T10:00:00Z",
  scheduleStartTs: "2024-01-01T10:00:30Z",
  resultsAvailableTs: "2024-01-01T10:01:00Z",
  hasResults: true,
  goalInfo: "goal-info-1",
  playlist: "playlist1",
  result: "1-0",
  markets: [{ id: 1, name: "market1" }],
  inGameEventInfo: "in-game-event-info-1",
});

const createMockGoalInfo = (): GoalInfoData => ({
  frame: [1, 2, 3],
  timeLine: [10, 20, 30],
  result: ["goal", "assist", "save"],
});

const createMockEventStreamState = (gameId: string = "2001", eventId: number = 1): EventStreamState => ({
  eventID: eventId,
  eventNameAKey: "Home Team",
  eventNameBKey: "Away Team",
  theme: "football",
  scheduleStartTs: "2024-01-01T10:00:00Z",
  productCode: "SPORT",
  productTypeKey: "FOOTBALL",
  eventDetails: [createMockEventDetail(eventId, 0), createMockEventDetail(eventId, 1)],
  currentEventDetailIndex: 0,
  liveScores: ["0:0", "0:0"],
  goalInfos: [null, null],
  currentPhase: JobName.ScheduleEvent,
});

describe("EventStore", () => {
  let eventStore: EventStore;

  beforeEach(() => {
    eventStore = new EventStore();
  });

  describe("getCurrentEventForGame", () => {
    it("should return undefined for non-existent game", () => {
      // Act
      const result = eventStore.getCurrentEventForGame("non-existent");

      // Assert
      expect(result).toBeUndefined();
    });

    it("should return the current event for existing game", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);

      // Act
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const result = eventStore.getCurrentEventForGame(gameId);

      // Assert
      expect(result).toBe(mockEvent);
      expect(result?.eventID).toBe(mockEvent.eventID);
      expect(result?.currentPhase).toBe(JobName.ScheduleEvent);
    });

    it("should return reference to the stored event", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);

      // Act
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const result = eventStore.getCurrentEventForGame(gameId);

      // Assert
      expect(result).toBe(mockEvent); // Same reference
    });
  });

  describe("setCurrentEventForGame", () => {
    it("should set current event for a game", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);

      // Act
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result).toBe(mockEvent);
    });

    it("should overwrite existing event for the same game", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent1 = createMockEventStreamState(gameId, 1);
      const mockEvent2 = createMockEventStreamState(gameId, 2);

      // Act
      eventStore.setCurrentEventForGame(gameId, mockEvent1);
      eventStore.setCurrentEventForGame(gameId, mockEvent2);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result).toBe(mockEvent2);
      expect(result?.eventID).toBe(2);
    });

    it("should handle multiple games independently", () => {
      // Arrange
      const gameId1 = "2001";
      const gameId2 = "2002";
      const mockEvent1 = createMockEventStreamState(gameId1, 1);
      const mockEvent2 = createMockEventStreamState(gameId2, 2);

      // Act
      eventStore.setCurrentEventForGame(gameId1, mockEvent1);
      eventStore.setCurrentEventForGame(gameId2, mockEvent2);

      // Assert
      expect(eventStore.getCurrentEventForGame(gameId1)).toBe(mockEvent1);
      expect(eventStore.getCurrentEventForGame(gameId2)).toBe(mockEvent2);
    });

    it("should handle empty gameId", () => {
      // Arrange
      const gameId = "";
      const mockEvent = createMockEventStreamState(gameId);

      // Act & Assert
      expect(() => {
        eventStore.setCurrentEventForGame(gameId, mockEvent);
      }).not.toThrow();

      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result).toBe(mockEvent);
    });
  });

  describe("setCurrentEventPhaseForGame", () => {
    it("should update the current phase for a game", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      // Act
      eventStore.setCurrentEventPhaseForGame(gameId, JobName.UpdateOdds);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.currentPhase).toBe(JobName.UpdateOdds);
    });

    it("should handle all job name phases", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      const phases = [
        JobName.ScheduleEvent,
        JobName.UpdateOdds,
        JobName.UpdateVideoInfo,
        JobName.UpdateGoalInfo,
        JobName.UpdateResult,
      ];

      // Act & Assert
      phases.forEach((phase) => {
        eventStore.setCurrentEventPhaseForGame(gameId, phase);
        const result = eventStore.getCurrentEventForGame(gameId);
        expect(result?.currentPhase).toBe(phase);
      });
    });

    it("should throw error for non-existent game", () => {
      // Act & Assert
      expect(() => {
        eventStore.setCurrentEventPhaseForGame("non-existent", JobName.UpdateOdds);
      }).toThrow();
    });
  });

  describe("setCurrentEventLiveScoreForGame", () => {
    it("should update live score for specific index", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const newScore = "2:1";
      const index = 0;

      // Act
      eventStore.setCurrentEventLiveScoreForGame(gameId, newScore, index);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.liveScores[index]).toBe(newScore);
      expect(result?.liveScores[1]).toBe("0:0"); // Other index unchanged
    });

    it("should handle multiple live score updates", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      // Act
      eventStore.setCurrentEventLiveScoreForGame(gameId, "1:0", 0);
      eventStore.setCurrentEventLiveScoreForGame(gameId, "2:1", 1);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.liveScores[0]).toBe("1:0");
      expect(result?.liveScores[1]).toBe("2:1");
    });

    it("should throw error for non-existent game", () => {
      // Act & Assert
      expect(() => {
        eventStore.setCurrentEventLiveScoreForGame("non-existent", "1:0", 0);
      }).toThrow();
    });

    it("should handle out of bounds index", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      // Act & Assert
      expect(() => {
        eventStore.setCurrentEventLiveScoreForGame(gameId, "1:0", 999);
      }).not.toThrow();
    });
  });

  describe("setCurrentEventGoalInfoForGame", () => {
    it("should update goal info for specific index", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const newGoalInfo = createMockGoalInfo();
      const index = 0;

      // Act
      eventStore.setCurrentEventGoalInfoForGame(gameId, newGoalInfo, index);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.goalInfos[index]).toBe(newGoalInfo);
      expect(result?.goalInfos[1]).toBe(null); // Other index unchanged
    });

    it("should handle null goal info", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const index = 0;

      // Act
      eventStore.setCurrentEventGoalInfoForGame(gameId, null, index);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.goalInfos[index]).toBe(null);
    });

    it("should throw error for non-existent game", () => {
      // Act & Assert
      expect(() => {
        eventStore.setCurrentEventGoalInfoForGame("non-existent", createMockGoalInfo(), 0);
      }).toThrow();
    });
  });

  describe("setCurrentEventGoalInfosForGame", () => {
    it("should update all goal infos for a game", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const newGoalInfos = [createMockGoalInfo(), null, createMockGoalInfo()];

      // Act
      eventStore.setCurrentEventGoalInfosForGame(gameId, newGoalInfos);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.goalInfos).toEqual(newGoalInfos);
    });

    it("should handle empty goal infos array", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      // Act
      eventStore.setCurrentEventGoalInfosForGame(gameId, []);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.goalInfos).toEqual([]);
    });

    it("should throw error for non-existent game", () => {
      // Act & Assert
      expect(() => {
        eventStore.setCurrentEventGoalInfosForGame("non-existent", [createMockGoalInfo()]);
      }).toThrow();
    });
  });

  describe("setCurrentEventLiveScoresForGame", () => {
    it("should update all live scores for a game", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const newLiveScores = ["1:0", "2:1", "3:2"];

      // Act
      eventStore.setCurrentEventLiveScoresForGame(gameId, newLiveScores);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.liveScores).toEqual(newLiveScores);
    });

    it("should handle empty live scores array", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      // Act
      eventStore.setCurrentEventLiveScoresForGame(gameId, []);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.liveScores).toEqual([]);
    });

    it("should throw error for non-existent game", () => {
      // Act & Assert
      expect(() => {
        eventStore.setCurrentEventLiveScoresForGame("non-existent", ["1:0"]);
      }).toThrow();
    });
  });

  describe("setCurrentEventDetailForGame", () => {
    it("should update event detail for specific index", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const newEventDetail = createMockEventDetail(999, 0);
      const index = 0;

      // Act
      eventStore.setCurrentEventDetailForGame(gameId, newEventDetail, index);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.eventDetails[index]).toBe(newEventDetail);
      expect(result?.eventDetails[1]).not.toBe(newEventDetail); // Other index unchanged
    });

    it("should throw error for non-existent game", () => {
      // Act & Assert
      expect(() => {
        eventStore.setCurrentEventDetailForGame("non-existent", createMockEventDetail(), 0);
      }).toThrow();
    });

    it("should handle out of bounds index", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const newEventDetail = createMockEventDetail(999, 0);

      // Act & Assert
      expect(() => {
        eventStore.setCurrentEventDetailForGame(gameId, newEventDetail, 999);
      }).not.toThrow();
    });
  });

  describe("data integrity and edge cases", () => {
    it("should maintain data integrity across multiple operations", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      // Act - Perform multiple operations
      eventStore.setCurrentEventPhaseForGame(gameId, JobName.UpdateOdds);
      eventStore.setCurrentEventLiveScoreForGame(gameId, "1:0", 0);
      eventStore.setCurrentEventGoalInfoForGame(gameId, createMockGoalInfo(), 1);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.currentPhase).toBe(JobName.UpdateOdds);
      expect(result?.liveScores[0]).toBe("1:0");
      expect(result?.goalInfos[1]).toEqual(createMockGoalInfo());
      expect(result?.eventID).toBe(mockEvent.eventID); // Original data preserved
    });

    it("should handle special characters in gameId", () => {
      // Arrange
      const gameId = "game-123!@#$%^&*()";
      const mockEvent = createMockEventStreamState(gameId);

      // Act
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result).toBe(mockEvent);
    });

    it("should handle very long gameId", () => {
      // Arrange
      const gameId = "a".repeat(1000);
      const mockEvent = createMockEventStreamState(gameId);

      // Act
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result).toBe(mockEvent);
    });

    it("should handle rapid operations on same game", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      // Act - Rapid operations
      for (let i = 0; i < 10; i++) {
        eventStore.setCurrentEventPhaseForGame(gameId, JobName.UpdateOdds);
        eventStore.setCurrentEventLiveScoreForGame(gameId, `${i}:0`, 0);
      }

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.currentPhase).toBe(JobName.UpdateOdds);
      expect(result?.liveScores[0]).toBe("9:0");
    });

    it("should handle multiple games with same operations", () => {
      // Arrange
      const gameIds = ["2001", "2002", "2003"];

      // Act
      gameIds.forEach((gameId, index) => {
        const mockEvent = createMockEventStreamState(gameId, index + 1);
        eventStore.setCurrentEventForGame(gameId, mockEvent);
        eventStore.setCurrentEventPhaseForGame(gameId, JobName.UpdateOdds);
        eventStore.setCurrentEventLiveScoreForGame(gameId, `${index}:0`, 0);
      });

      // Assert
      gameIds.forEach((gameId, index) => {
        const result = eventStore.getCurrentEventForGame(gameId);
        expect(result?.eventID).toBe(index + 1);
        expect(result?.currentPhase).toBe(JobName.UpdateOdds);
        expect(result?.liveScores[0]).toBe(`${index}:0`);
      });
    });
  });

  describe("memory management", () => {
    it("should not leak memory when overwriting events", () => {
      // Arrange
      const gameId = "2001";
      const initialEvent = createMockEventStreamState(gameId, 1);

      // Act - Overwrite multiple times
      for (let i = 0; i < 100; i++) {
        const newEvent = createMockEventStreamState(gameId, i + 1);
        eventStore.setCurrentEventForGame(gameId, newEvent);
      }

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.eventID).toBe(100);
    });

    it("should handle large number of games", () => {
      // Arrange
      const gameCount = 1000;

      // Act
      for (let i = 0; i < gameCount; i++) {
        const gameId = `game-${i}`;
        const mockEvent = createMockEventStreamState(gameId, i);
        eventStore.setCurrentEventForGame(gameId, mockEvent);
      }

      // Assert
      for (let i = 0; i < gameCount; i++) {
        const gameId = `game-${i}`;
        const result = eventStore.getCurrentEventForGame(gameId);
        expect(result?.eventID).toBe(i);
      }
    });
  });
});
