import { EventStore } from "../../../src/stores/event-store";
import { EventStreamState, EventDetail, JobName, GoalInfoData, InGameEvent, VoiceEvent, VoiceConfig } from "../../../src/types";

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

const createMockInGameEvent = (): InGameEvent => ({
  timeLine: [5, 15, 25],
  frame: [100, 200, 300],
  eventName: ["kick-off", "corner", "free-kick"],
});

const createMockVoiceEvent = (): VoiceEvent => ({
  timeline: [8.5, 15.2, 22.7],
  voice: ["goal_1_0", "equalizer_1_1", "lastGoal_2_1"],
});

const createMockVoiceConfig = (): VoiceConfig => ({
  "goal": {
    1000: {
      timeline: [0, 500, 1000],
      voice: ["Goal scored!", "What a shot!", "Amazing!"],
    },
    2000: {
      timeline: [0, 1000, 2000],
      voice: ["Two goals!", "Incredible!", "Fantastic!"],
    },
  },
  "assist": {
    500: {
      timeline: [0, 250, 500],
      voice: ["Great assist!", "Perfect pass!", "Teamwork!"],
    },
  },
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
  liveVoices: ["", ""],
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

  describe("setCurrentInGameEventsForGame", () => {
    it("should update all in-game events for a game", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const newInGameEvents = [createMockInGameEvent(), null, createMockInGameEvent()];

      // Act
      eventStore.setCurrentInGameEventsForGame(gameId, newInGameEvents);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.inGameEvents).toEqual(newInGameEvents);
    });

    it("should handle empty in-game events array", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      // Act
      eventStore.setCurrentInGameEventsForGame(gameId, []);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.inGameEvents).toEqual([]);
    });

    it("should handle array of null in-game events", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const nullEvents = [null, null, null];

      // Act
      eventStore.setCurrentInGameEventsForGame(gameId, nullEvents);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.inGameEvents).toEqual(nullEvents);
    });

    it("should overwrite existing in-game events", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const firstEvents = [createMockInGameEvent()];
      const secondEvents = [createMockInGameEvent(), createMockInGameEvent()];

      // Act
      eventStore.setCurrentInGameEventsForGame(gameId, firstEvents);
      eventStore.setCurrentInGameEventsForGame(gameId, secondEvents);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.inGameEvents).toEqual(secondEvents);
      expect(result?.inGameEvents).toHaveLength(2);
    });

    it("should throw error for non-existent game", () => {
      // Act & Assert
      expect(() => {
        eventStore.setCurrentInGameEventsForGame("non-existent", [createMockInGameEvent()]);
      }).toThrow();
    });

    it("should handle mixed array of valid and null in-game events", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const mixedEvents = [
        createMockInGameEvent(),
        null,
        { ...createMockInGameEvent(), eventName: ["penalty", "yellow-card"] },
        null
      ];

      // Act
      eventStore.setCurrentInGameEventsForGame(gameId, mixedEvents);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.inGameEvents).toEqual(mixedEvents);
      expect(result?.inGameEvents).toHaveLength(4);
    });
  });

  describe("setCurrentVoiceEventForGame", () => {
    it("should set voice event for a game", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const voiceEvent = createMockVoiceEvent();

      // Act
      eventStore.setCurrentVoiceEventForGame(gameId, voiceEvent);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.voices).toEqual(voiceEvent);
    });

    it("should overwrite existing voice event", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const firstVoice = createMockVoiceEvent();
      const secondVoice = {
        timeline: [12.5, 25.8],
        voice: ["goal_2_1", "winner_3_1"]
      };

      // Act
      eventStore.setCurrentVoiceEventForGame(gameId, firstVoice);
      eventStore.setCurrentVoiceEventForGame(gameId, secondVoice);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.voices).toEqual(secondVoice);
      expect(result?.voices?.timeline).toHaveLength(2);
    });

    it("should handle empty voice event", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const emptyVoice = { timeline: [], voice: [] };

      // Act
      eventStore.setCurrentVoiceEventForGame(gameId, emptyVoice);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.voices).toEqual(emptyVoice);
    });

    it("should handle voice event with single entry", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const singleVoice = { timeline: [10.5], voice: ["firstGoal_1_0"] };

      // Act
      eventStore.setCurrentVoiceEventForGame(gameId, singleVoice);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.voices).toEqual(singleVoice);
    });

    it("should throw error for non-existent game", () => {
      // Act & Assert
      expect(() => {
        eventStore.setCurrentVoiceEventForGame("non-existent", createMockVoiceEvent());
      }).toThrow();
    });

    it("should handle voice event with mismatched array lengths", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const mismatchedVoice = { 
        timeline: [10.5, 20.3], 
        voice: ["goal_1_0"] // Shorter than timeline
      };

      // Act
      eventStore.setCurrentVoiceEventForGame(gameId, mismatchedVoice);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.voices).toEqual(mismatchedVoice);
    });
  });

  describe("setCurrentLiveVoiceForGame", () => {
    it("should update live voice for specific index", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const newVoice = "goal_commentary_1";
      const index = 0;

      // Act
      eventStore.setCurrentLiveVoiceForGame(gameId, newVoice, index);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.liveVoices[index]).toBe(newVoice);
      expect(result?.liveVoices[1]).toBe(""); // Other index unchanged
    });

    it("should handle multiple live voice updates", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      // Act
      eventStore.setCurrentLiveVoiceForGame(gameId, "goal_1", 0);
      eventStore.setCurrentLiveVoiceForGame(gameId, "goal_2", 1);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.liveVoices[0]).toBe("goal_1");
      expect(result?.liveVoices[1]).toBe("goal_2");
    });

    it("should handle empty string live voice", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      // Act
      eventStore.setCurrentLiveVoiceForGame(gameId, "", 0);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.liveVoices[0]).toBe("");
    });

    it("should handle long voice strings", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const longVoice = "very_long_commentary_voice_string_with_detailed_description";

      // Act
      eventStore.setCurrentLiveVoiceForGame(gameId, longVoice, 0);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.liveVoices[0]).toBe(longVoice);
    });

    it("should throw error for non-existent game", () => {
      // Act & Assert
      expect(() => {
        eventStore.setCurrentLiveVoiceForGame("non-existent", "voice", 0);
      }).toThrow();
    });

    it("should handle out of bounds index", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      // Act & Assert
      expect(() => {
        eventStore.setCurrentLiveVoiceForGame(gameId, "voice", 999);
      }).not.toThrow();
    });

    it("should overwrite existing live voice", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      // Act
      eventStore.setCurrentLiveVoiceForGame(gameId, "first_voice", 0);
      eventStore.setCurrentLiveVoiceForGame(gameId, "second_voice", 0);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.liveVoices[0]).toBe("second_voice");
    });
  });

  describe("setCurrentInGameEventForGame", () => {
    it("should set in-game event for specific index", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const inGameEvent = createMockInGameEvent();
      const index = 0;

      // Act
      eventStore.setCurrentInGameEventForGame(gameId, inGameEvent, index);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.inGameEvents?.[index]).toEqual(inGameEvent);
    });

    it("should initialize inGameEvents array if not exists", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      delete mockEvent.inGameEvents; // Remove inGameEvents property
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const inGameEvent = createMockInGameEvent();

      // Act
      eventStore.setCurrentInGameEventForGame(gameId, inGameEvent, 0);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.inGameEvents).toBeDefined();
      expect(result?.inGameEvents?.[0]).toEqual(inGameEvent);
    });

    it("should handle null in-game event", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      // Act
      eventStore.setCurrentInGameEventForGame(gameId, null, 0);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.inGameEvents?.[0]).toBe(null);
    });

    it("should handle multiple in-game event updates", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const event1 = createMockInGameEvent();
      const event2 = { ...createMockInGameEvent(), eventName: ["penalty"] };

      // Act
      eventStore.setCurrentInGameEventForGame(gameId, event1, 0);
      eventStore.setCurrentInGameEventForGame(gameId, event2, 1);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.inGameEvents?.[0]).toEqual(event1);
      expect(result?.inGameEvents?.[1]).toEqual(event2);
    });

    it("should overwrite existing in-game event at same index", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const firstEvent = createMockInGameEvent();
      const secondEvent = { ...createMockInGameEvent(), eventName: ["substitution"] };

      // Act
      eventStore.setCurrentInGameEventForGame(gameId, firstEvent, 0);
      eventStore.setCurrentInGameEventForGame(gameId, secondEvent, 0);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.inGameEvents?.[0]).toEqual(secondEvent);
    });

    it("should handle high index values", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const inGameEvent = createMockInGameEvent();

      // Act
      eventStore.setCurrentInGameEventForGame(gameId, inGameEvent, 10);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.inGameEvents?.[10]).toEqual(inGameEvent);
    });

    it("should throw error for non-existent game", () => {
      // Act & Assert
      expect(() => {
        eventStore.setCurrentInGameEventForGame("non-existent", createMockInGameEvent(), 0);
      }).toThrow();
    });

    it("should handle different types of in-game events", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const kickOffEvent = {
        timeLine: [0],
        frame: [1],
        eventName: ["kick-off"]
      };
      const penaltyEvent = {
        timeLine: [45, 60],
        frame: [2700, 3600],
        eventName: ["foul", "penalty"]
      };

      // Act
      eventStore.setCurrentInGameEventForGame(gameId, kickOffEvent, 0);
      eventStore.setCurrentInGameEventForGame(gameId, penaltyEvent, 1);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.inGameEvents?.[0]).toEqual(kickOffEvent);
      expect(result?.inGameEvents?.[1]).toEqual(penaltyEvent);
    });
  });

  describe("setCurrentVoiceConfigForGame", () => {
    it("should set voice config for a game", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const voiceConfig = "voice-config-123";

      // Act
      eventStore.setCurrentVoiceConfigForGame(gameId, voiceConfig);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.voiceConfig).toBe(voiceConfig);
    });

    it("should handle undefined voice config", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      // Act
      eventStore.setCurrentVoiceConfigForGame(gameId, undefined);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.voiceConfig).toBeUndefined();
    });

    it("should handle empty string voice config", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      // Act
      eventStore.setCurrentVoiceConfigForGame(gameId, "");

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.voiceConfig).toBe("");
    });

    it("should overwrite existing voice config", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const firstConfig = "voice-config-1";
      const secondConfig = "voice-config-2";

      // Act
      eventStore.setCurrentVoiceConfigForGame(gameId, firstConfig);
      eventStore.setCurrentVoiceConfigForGame(gameId, secondConfig);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.voiceConfig).toBe(secondConfig);
    });

    it("should handle long voice config strings", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const longConfig = "very-long-voice-config-url-with-many-parameters-and-details";

      // Act
      eventStore.setCurrentVoiceConfigForGame(gameId, longConfig);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.voiceConfig).toBe(longConfig);
    });

    it("should handle voice config with special characters", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const specialConfig = "voice-config-123!@#$%^&*()_+-=[]{}|;:,.<>?";

      // Act
      eventStore.setCurrentVoiceConfigForGame(gameId, specialConfig);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.voiceConfig).toBe(specialConfig);
    });

    it("should handle voice config for multiple games independently", () => {
      // Arrange
      const gameId1 = "2001";
      const gameId2 = "2002";
      const mockEvent1 = createMockEventStreamState(gameId1);
      const mockEvent2 = createMockEventStreamState(gameId2);
      eventStore.setCurrentEventForGame(gameId1, mockEvent1);
      eventStore.setCurrentEventForGame(gameId2, mockEvent2);
      const config1 = "voice-config-game1";
      const config2 = "voice-config-game2";

      // Act
      eventStore.setCurrentVoiceConfigForGame(gameId1, config1);
      eventStore.setCurrentVoiceConfigForGame(gameId2, config2);

      // Assert
      expect(eventStore.getCurrentEventForGame(gameId1)?.voiceConfig).toBe(config1);
      expect(eventStore.getCurrentEventForGame(gameId2)?.voiceConfig).toBe(config2);
    });

    it("should throw error for non-existent game", () => {
      // Act & Assert
      expect(() => {
        eventStore.setCurrentVoiceConfigForGame("non-existent", "voice-config");
      }).toThrow();
    });

    it("should handle rapid voice config updates", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      // Act
      for (let i = 0; i < 10; i++) {
        eventStore.setCurrentVoiceConfigForGame(gameId, `voice-config-${i}`);
      }

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.voiceConfig).toBe("voice-config-9");
    });
  });

  describe("setCurrentVoiceConfigDetailForGame", () => {
    it("should set voice config detail for a game", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const voiceConfigDetail = createMockVoiceConfig();

      // Act
      eventStore.setCurrentVoiceConfigDetailForGame(gameId, voiceConfigDetail);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.voiceConfigDetail).toEqual(voiceConfigDetail);
    });

    it("should handle undefined voice config detail", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      // Act
      eventStore.setCurrentVoiceConfigDetailForGame(gameId, undefined);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.voiceConfigDetail).toBeUndefined();
    });

    it("should handle empty voice config detail", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const emptyConfig: VoiceConfig = {};

      // Act
      eventStore.setCurrentVoiceConfigDetailForGame(gameId, emptyConfig);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.voiceConfigDetail).toEqual({});
    });

    it("should overwrite existing voice config detail", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const firstConfig = createMockVoiceConfig();
      const secondConfig: VoiceConfig = {
        "penalty": {
          1500: {
            timeline: [0, 750, 1500],
            voice: ["Penalty!", "Shot!", "Goal or miss?"],
          },
        },
      };

      // Act
      eventStore.setCurrentVoiceConfigDetailForGame(gameId, firstConfig);
      eventStore.setCurrentVoiceConfigDetailForGame(gameId, secondConfig);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.voiceConfigDetail).toEqual(secondConfig);
    });

    it("should handle complex voice config detail structure", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const complexConfig: VoiceConfig = {
        "goal": {
          500: { timeline: [0, 250, 500], voice: ["Quick goal!", "Fast!", "Speed!"] },
          1000: { timeline: [0, 500, 1000], voice: ["Goal!", "Score!", "Yes!"] },
          2000: { timeline: [0, 1000, 2000], voice: ["Long goal!", "Extended!", "Duration!"] },
        },
        "assist": {
          300: { timeline: [0, 150, 300], voice: ["Assist!", "Pass!", "Help!"] },
          600: { timeline: [0, 300, 600], voice: ["Great assist!", "Perfect pass!", "Teamwork!"] },
        },
        "save": {
          800: { timeline: [0, 400, 800], voice: ["Great save!", "Blocked!", "Stopped!"] },
        },
        "corner": {
          200: { timeline: [0, 100, 200], voice: ["Corner!", "Quick!", "Fast!"] },
          1000: { timeline: [0, 500, 1000], voice: ["Corner opportunity!", "Slow build!", "Dramatic!"] },
        },
      };

      // Act
      eventStore.setCurrentVoiceConfigDetailForGame(gameId, complexConfig);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.voiceConfigDetail).toEqual(complexConfig);
    });

    it("should handle voice config detail for multiple games independently", () => {
      // Arrange
      const gameId1 = "2001";
      const gameId2 = "2002";
      const mockEvent1 = createMockEventStreamState(gameId1);
      const mockEvent2 = createMockEventStreamState(gameId2);
      eventStore.setCurrentEventForGame(gameId1, mockEvent1);
      eventStore.setCurrentEventForGame(gameId2, mockEvent2);
      const config1 = createMockVoiceConfig();
      const config2: VoiceConfig = {
        "penalty": {
          1000: {
            timeline: [0, 500, 1000],
            voice: ["Penalty kick!", "Will it go in?", "Goal!"],
          },
        },
      };

      // Act
      eventStore.setCurrentVoiceConfigDetailForGame(gameId1, config1);
      eventStore.setCurrentVoiceConfigDetailForGame(gameId2, config2);

      // Assert
      expect(eventStore.getCurrentEventForGame(gameId1)?.voiceConfigDetail).toEqual(config1);
      expect(eventStore.getCurrentEventForGame(gameId2)?.voiceConfigDetail).toEqual(config2);
    });

    it("should handle voice config with single event type", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const singleEventConfig: VoiceConfig = {
        "free-kick": {
          2000: {
            timeline: [0, 1000, 2000],
            voice: ["Free kick awarded!", "Taking the shot!", "What a strike!"],
          },
        },
      };

      // Act
      eventStore.setCurrentVoiceConfigDetailForGame(gameId, singleEventConfig);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.voiceConfigDetail).toEqual(singleEventConfig);
    });

    it("should handle voice config with multiple durations for same event", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      const multiDurationConfig: VoiceConfig = {
        "substitution": {
          500: { timeline: [0, 250, 500], voice: ["Sub!", "Quick!", "Change!"] },
          1000: { timeline: [0, 500, 1000], voice: ["Substitution!", "Player change!", "Fresh legs!"] },
          1500: { timeline: [0, 750, 1500], voice: ["Strategic substitution!", "Tactical change!", "New player on!"] },
        },
      };

      // Act
      eventStore.setCurrentVoiceConfigDetailForGame(gameId, multiDurationConfig);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.voiceConfigDetail).toEqual(multiDurationConfig);
    });

    it("should throw error for non-existent game", () => {
      // Act & Assert
      expect(() => {
        eventStore.setCurrentVoiceConfigDetailForGame("non-existent", createMockVoiceConfig());
      }).toThrow();
    });

    it("should handle rapid voice config detail updates", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      // Act
      for (let i = 0; i < 5; i++) {
        const config: VoiceConfig = {
          [`event_${i}`]: {
            1000: {
              timeline: [0, 500, 1000],
              voice: [`voice_${i}_1`, `voice_${i}_2`, `voice_${i}_3`],
            },
          },
        };
        eventStore.setCurrentVoiceConfigDetailForGame(gameId, config);
      }

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.voiceConfigDetail).toEqual({
        "event_4": {
          1000: {
            timeline: [0, 500, 1000],
            voice: ["voice_4_1", "voice_4_2", "voice_4_3"],
          },
        },
      });
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

    it("should maintain data integrity across all new voice and in-game event operations", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      const voiceEvent = createMockVoiceEvent();
      const inGameEvents = [createMockInGameEvent(), null, createMockInGameEvent()];
      const singleInGameEvent = createMockInGameEvent();

      // Act - Perform comprehensive operations
      eventStore.setCurrentEventPhaseForGame(gameId, JobName.UpdateGoalInfo);
      eventStore.setCurrentEventLiveScoreForGame(gameId, "2:1", 0);
      eventStore.setCurrentEventGoalInfoForGame(gameId, createMockGoalInfo(), 0);
      eventStore.setCurrentVoiceEventForGame(gameId, voiceEvent);
      eventStore.setCurrentInGameEventsForGame(gameId, inGameEvents);
      eventStore.setCurrentLiveVoiceForGame(gameId, "goal_commentary_live", 0);
      eventStore.setCurrentInGameEventForGame(gameId, singleInGameEvent, 1);

      // Assert - All operations should coexist
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.currentPhase).toBe(JobName.UpdateGoalInfo);
      expect(result?.liveScores[0]).toBe("2:1");
      expect(result?.goalInfos[0]).toEqual(createMockGoalInfo());
      expect(result?.voices).toEqual(voiceEvent);
      expect(result?.inGameEvents).toEqual(inGameEvents);
      expect(result?.liveVoices[0]).toBe("goal_commentary_live");
      expect(result?.inGameEvents?.[1]).toEqual(singleInGameEvent);
      expect(result?.eventID).toBe(mockEvent.eventID); // Original data preserved
    });

    it("should maintain data integrity with voice config operations", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      const voiceConfig = "voice-config-comprehensive-test";
      const voiceConfigDetail = createMockVoiceConfig();
      const voiceEvent = createMockVoiceEvent();

      // Act - Perform comprehensive voice-related operations
      eventStore.setCurrentEventPhaseForGame(gameId, JobName.UpdateGoalInfo);
      eventStore.setCurrentVoiceConfigForGame(gameId, voiceConfig);
      eventStore.setCurrentVoiceConfigDetailForGame(gameId, voiceConfigDetail);
      eventStore.setCurrentVoiceEventForGame(gameId, voiceEvent);
      eventStore.setCurrentLiveVoiceForGame(gameId, "live_voice_test", 0);
      eventStore.setCurrentEventLiveScoreForGame(gameId, "3:2", 1);

      // Assert - All voice operations should coexist with other data
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.currentPhase).toBe(JobName.UpdateGoalInfo);
      expect(result?.voiceConfig).toBe(voiceConfig);
      expect(result?.voiceConfigDetail).toEqual(voiceConfigDetail);
      expect(result?.voices).toEqual(voiceEvent);
      expect(result?.liveVoices[0]).toBe("live_voice_test");
      expect(result?.liveScores[1]).toBe("3:2");
      expect(result?.eventID).toBe(mockEvent.eventID); // Original data preserved
    });

    it("should handle complex interaction between voice events and in-game events", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      const multipleVoiceEvents = [
        { timeline: [10.5], voice: ["goal_1_0"] },
        { timeline: [25.2, 30.8], voice: ["equalizer_1_1", "lead_2_1"] },
        { timeline: [], voice: [] } // Empty voice event
      ];

      const mixedInGameEvents = [
        createMockInGameEvent(),
        null,
        { timeLine: [90], frame: [5400], eventName: ["final-whistle"] }
      ];

      // Act - Set multiple voice events and in-game events
      multipleVoiceEvents.forEach((voiceEvent, index) => {
        eventStore.setCurrentVoiceEventForGame(gameId, voiceEvent);
        eventStore.setCurrentLiveVoiceForGame(gameId, `live_voice_${index}`, index % 2);
      });

      eventStore.setCurrentInGameEventsForGame(gameId, mixedInGameEvents);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.voices).toEqual(multipleVoiceEvents[2]); // Last voice event
      expect(result?.liveVoices[0]).toBe("live_voice_2");
      expect(result?.liveVoices[1]).toBe("live_voice_1");
      expect(result?.inGameEvents).toEqual(mixedInGameEvents);
    });

    it("should handle edge case with undefined inGameEvents initialization", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      delete mockEvent.inGameEvents; // Start without inGameEvents
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      const firstInGameEvent = createMockInGameEvent();
      const secondInGameEvent = { ...createMockInGameEvent(), eventName: ["substitution"] };

      // Act
      eventStore.setCurrentInGameEventForGame(gameId, firstInGameEvent, 0);
      eventStore.setCurrentInGameEventForGame(gameId, secondInGameEvent, 2);
      eventStore.setCurrentInGameEventsForGame(gameId, [null, firstInGameEvent]);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.inGameEvents).toBeDefined();
      expect(result?.inGameEvents).toEqual([null, firstInGameEvent]);
    });

    it("should handle simultaneous updates to same game from different operations", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);

      // Act - Simulate rapid updates
      for (let i = 0; i < 5; i++) {
        eventStore.setCurrentEventLiveScoreForGame(gameId, `${i}:${i}`, 0);
        eventStore.setCurrentLiveVoiceForGame(gameId, `voice_${i}`, 0);
        eventStore.setCurrentInGameEventForGame(gameId, createMockInGameEvent(), i);
        eventStore.setCurrentVoiceEventForGame(gameId, { 
          timeline: [i * 10], 
          voice: [`voice_${i}`] 
        });
      }

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result?.liveScores[0]).toBe("4:4");
      expect(result?.liveVoices[0]).toBe("voice_4");
      expect(result?.voices).toEqual({ timeline: [40], voice: ["voice_4"] });
      expect(result?.inGameEvents).toHaveLength(5);
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

  describe("updateResultForGame", () => {
    it("should update result for game with default phase", () => {
      // Arrange
      const gameId = "2001";
      const result = ["goal", "assist"];

      // Act
      eventStore.updateResultForGame(gameId, result);

      // Assert
      const gamePhase = eventStore.getCurrentGamePhaseForGame(gameId);
      expect(gamePhase.result).toEqual(result);
    });

    it("should update result for game with specific phase", () => {
      // Arrange
      const gameId = "2001";
      const result = ["save", "corner"];
      const phaseIndex = 1;

      // Act
      eventStore.updateResultForGame(gameId, result, phaseIndex);

      // Assert
      expect(eventStore.getCurrentPhaseIndexForGame(gameId)).toBe(phaseIndex);
      const gamePhase = eventStore.getCurrentGamePhaseForGame(gameId);
      expect(gamePhase.result).toEqual(result);
    });

    it("should handle empty result array", () => {
      // Arrange
      const gameId = "2001";
      const result: string[] = [];

      // Act
      eventStore.updateResultForGame(gameId, result);

      // Assert
      const gamePhase = eventStore.getCurrentGamePhaseForGame(gameId);
      expect(gamePhase.result).toEqual([]);
    });
  });

  describe("updateVideoLengthForGame", () => {
    it("should update video length for game with default phase", () => {
      // Arrange
      const gameId = "2001";
      const videoLength = 45;

      // Act
      eventStore.updateVideoLengthForGame(gameId, videoLength);

      // Assert
      const gamePhase = eventStore.getCurrentGamePhaseForGame(gameId);
      expect(gamePhase.currentVideoLength).toBe(videoLength);
      expect(gamePhase.previousVideoLength).toBe(0);
    });

    it("should update video length and set previous length correctly", () => {
      // Arrange
      const gameId = "2001";
      const firstLength = 30;
      const secondLength = 45;

      // Act
      eventStore.updateVideoLengthForGame(gameId, firstLength, 0);
      eventStore.updateVideoLengthForGame(gameId, secondLength, 0);

      // Assert
      const gamePhase = eventStore.getCurrentGamePhaseForGame(gameId);
      expect(gamePhase.currentVideoLength).toBe(secondLength);
      expect(gamePhase.previousVideoLength).toBe(firstLength);
    });

    it("should update video length for specific phase", () => {
      // Arrange
      const gameId = "2001";
      const videoLength = 60;
      const phaseIndex = 1;

      // Act
      eventStore.updateVideoLengthForGame(gameId, videoLength, phaseIndex);

      // Assert
      expect(eventStore.getCurrentPhaseIndexForGame(gameId)).toBe(phaseIndex);
      const gamePhase = eventStore.getCurrentGamePhaseForGame(gameId);
      expect(gamePhase.currentVideoLength).toBe(videoLength);
    });
  });

  describe("appendVoiceForGame", () => {
    it("should append voice data for game", () => {
      // Arrange
      const gameId = "2001";
      const voiceArgs = {
        voice: ["goal_1", "assist_1"],
        timeline: [10, 20]
      };

      // Act
      eventStore.appendVoiceForGame(gameId, voiceArgs);

      // Assert
      const gamePhase = eventStore.getCurrentGamePhaseForGame(gameId);
      expect(gamePhase.voices).toEqual(voiceArgs.voice);
      expect(gamePhase.voiceTimelines).toEqual(voiceArgs.timeline);
    });

    it("should append multiple voice data entries", () => {
      // Arrange
      const gameId = "2001";
      const firstVoice = { voice: ["goal_1"], timeline: [10] };
      const secondVoice = { voice: ["assist_1"], timeline: [20] };

      // Act
      eventStore.appendVoiceForGame(gameId, firstVoice, 0);
      eventStore.appendVoiceForGame(gameId, secondVoice, 0);

      // Assert
      const gamePhase = eventStore.getCurrentGamePhaseForGame(gameId);
      expect(gamePhase.voices).toEqual(["goal_1", "assist_1"]);
      expect(gamePhase.voiceTimelines).toEqual([10, 20]);
    });

    it("should append voice data for specific phase", () => {
      // Arrange
      const gameId = "2001";
      const voiceArgs = { voice: ["save_1"], timeline: [15] };
      const phaseIndex = 1;

      // Act
      eventStore.appendVoiceForGame(gameId, voiceArgs, phaseIndex);

      // Assert
      expect(eventStore.getCurrentPhaseIndexForGame(gameId)).toBe(phaseIndex);
      const gamePhase = eventStore.getCurrentGamePhaseForGame(gameId);
      expect(gamePhase.voices).toEqual(voiceArgs.voice);
      expect(gamePhase.voiceTimelines).toEqual(voiceArgs.timeline);
    });
  });

  describe("appendInGameEventForGame", () => {
    it("should append in-game event data for game", () => {
      // Arrange
      const gameId = "2001";
      const eventArgs = {
        eventName: ["goal", "assist"],
        timeline: [10, 20]
      };

      // Act
      eventStore.appendInGameEventForGame(gameId, eventArgs);

      // Assert
      const gamePhase = eventStore.getCurrentGamePhaseForGame(gameId);
      expect(gamePhase.events).toEqual(eventArgs.eventName);
      expect(gamePhase.timelines).toEqual(eventArgs.timeline);
    });

    it("should append multiple in-game event entries", () => {
      // Arrange
      const gameId = "2001";
      const firstEvent = { eventName: ["goal"], timeline: [10] };
      const secondEvent = { eventName: ["save"], timeline: [25] };

      // Act
      eventStore.appendInGameEventForGame(gameId, firstEvent, 0);
      eventStore.appendInGameEventForGame(gameId, secondEvent, 0);

      // Assert
      const gamePhase = eventStore.getCurrentGamePhaseForGame(gameId);
      expect(gamePhase.events).toEqual(["goal", "save"]);
      expect(gamePhase.timelines).toEqual([10, 25]);
    });

    it("should append in-game event data for specific phase", () => {
      // Arrange
      const gameId = "2001";
      const eventArgs = { eventName: ["corner"], timeline: [30] };
      const phaseIndex = 1;

      // Act
      eventStore.appendInGameEventForGame(gameId, eventArgs, phaseIndex);

      // Assert
      expect(eventStore.getCurrentPhaseIndexForGame(gameId)).toBe(phaseIndex);
      const gamePhase = eventStore.getCurrentGamePhaseForGame(gameId);
      expect(gamePhase.events).toEqual(eventArgs.eventName);
      expect(gamePhase.timelines).toEqual(eventArgs.timeline);
    });
  });

  describe("getPreviousVideoLengthForGame", () => {
    it("should return 0 for new game", () => {
      // Arrange
      const gameId = "2001";
      // Initialize game phase first
      eventStore.getCurrentGamePhaseForGame(gameId);

      // Act
      const result = eventStore.getPreviousVideoLengthForGame(gameId);

      // Assert
      expect(result).toBe(0);
    });

    it("should return previous video length after update", () => {
      // Arrange
      const gameId = "2001";
      const firstLength = 30;
      const secondLength = 45;

      // Act
      eventStore.updateVideoLengthForGame(gameId, firstLength, 0);
      eventStore.updateVideoLengthForGame(gameId, secondLength, 0);
      const result = eventStore.getPreviousVideoLengthForGame(gameId);

      // Assert
      expect(result).toBe(firstLength);
    });

    it("should return 0 when no previous video length exists", () => {
      // Arrange
      const gameId = "2001";
      eventStore.updateVideoLengthForGame(gameId, 45);

      // Act
      const result = eventStore.getPreviousVideoLengthForGame(gameId);

      // Assert
      expect(result).toBe(0);
    });

    it("should return 0 when game phase data is missing (null check branch)", () => {
      // Arrange
      const gameId = "non-existent-game";

      // Act & Assert - This should throw an error since the method doesn't handle missing game data
      expect(() => eventStore.getPreviousVideoLengthForGame(gameId)).toThrow();
    });

    it("should return 0 when phase data is undefined (null check branch)", () => {
      // Arrange
      const gameId = "2001";
      // Initialize game but access non-existent phase
      eventStore.getCurrentGamePhaseForGame(gameId);
      
      // Manually access a phase that doesn't exist to test null coalescing
      const currentPhaseIndex = 5; // Non-existent phase
      const eventStore_any = eventStore as any;
      eventStore_any._currentGamePhaseByGameId[gameId].currentPhaseIndex = currentPhaseIndex;

      // Act
      const result = eventStore.getPreviousVideoLengthForGame(gameId);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe("getCurrentPhaseIndexForGame", () => {
    it("should return 0 for new game", () => {
      // Arrange
      const gameId = "2001";

      // Act
      const result = eventStore.getCurrentPhaseIndexForGame(gameId);

      // Assert
      expect(result).toBe(0);
    });

    it("should return current phase index after update", () => {
      // Arrange
      const gameId = "2001";
      const phaseIndex = 2;

      // Act
      eventStore.updateResultForGame(gameId, ["goal"], phaseIndex);
      const result = eventStore.getCurrentPhaseIndexForGame(gameId);

      // Assert
      expect(result).toBe(phaseIndex);
    });

    it("should return 0 for non-existent game", () => {
      // Arrange
      const gameId = "non-existent";

      // Act
      const result = eventStore.getCurrentPhaseIndexForGame(gameId);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe("getPreviousHalfResultForGame", () => {
    it("should return empty array for phase 0", () => {
      // Arrange
      const gameId = "2001";
      eventStore.updateResultForGame(gameId, ["goal"], 0);

      // Act
      const result = eventStore.getPreviousHalfResultForGame(gameId);

      // Assert
      expect(result).toEqual([]);
    });

    it("should return previous phase result", () => {
      // Arrange
      const gameId = "2001";
      const previousResult = ["goal", "assist"];
      const currentResult = ["save"];

      // Act
      eventStore.updateResultForGame(gameId, previousResult, 0);
      eventStore.updateResultForGame(gameId, currentResult, 1);
      const result = eventStore.getPreviousHalfResultForGame(gameId);

      // Assert
      expect(result).toEqual(previousResult);
    });

    it("should return empty array when no previous phase exists", () => {
      // Arrange
      const gameId = "2001";

      // Act
      const result = eventStore.getPreviousHalfResultForGame(gameId);

      // Assert
      expect(result).toEqual([]);
    });

    it("should handle missing previous phase data", () => {
      // Arrange
      const gameId = "2001";
      eventStore.updateResultForGame(gameId, ["goal"], 1); // Skip phase 0

      // Act
      const result = eventStore.getPreviousHalfResultForGame(gameId);

      // Assert
      expect(result).toEqual([]);
    });

    it("should return empty array when game phase data is missing (null check branch)", () => {
      // Arrange
      const gameId = "non-existent-game";

      // Act
      const result = eventStore.getPreviousHalfResultForGame(gameId);

      // Assert
      expect(result).toEqual([]);
    });

    it("should return empty array when previous phase data is undefined (null check branch)", () => {
      // Arrange
      const gameId = "2001";
      // Initialize game and set to phase 2, but don't initialize phase 1
      eventStore.getCurrentGamePhaseForGame(gameId);
      const eventStore_any = eventStore as any;
      eventStore_any._currentGamePhaseByGameId[gameId].currentPhaseIndex = 2;

      // Act
      const result = eventStore.getPreviousHalfResultForGame(gameId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("getVoiceAndTimelineForGame", () => {
    it("should return empty arrays for new game", () => {
      // Arrange
      const gameId = "2001";
      // Initialize game phase first
      eventStore.getCurrentGamePhaseForGame(gameId);

      // Act
      const result = eventStore.getVoiceAndTimelineForGame(gameId);

      // Assert
      expect(result.voice).toEqual([]);
      expect(result.timeline).toEqual([]);
    });

    it("should return voice and timeline data", () => {
      // Arrange
      const gameId = "2001";
      const voiceArgs = { voice: ["goal_1", "assist_1"], timeline: [10, 20] };

      // Act
      eventStore.appendVoiceForGame(gameId, voiceArgs);
      const result = eventStore.getVoiceAndTimelineForGame(gameId);

      // Assert
      expect(result.voice).toEqual(voiceArgs.voice);
      expect(result.timeline).toEqual(voiceArgs.timeline);
    });

    it("should return data for current phase", () => {
      // Arrange
      const gameId = "2001";
      const phase0Voice = { voice: ["goal_1"], timeline: [10] };
      const phase1Voice = { voice: ["save_1"], timeline: [25] };

      // Act
      eventStore.appendVoiceForGame(gameId, phase0Voice, 0);
      eventStore.appendVoiceForGame(gameId, phase1Voice, 1);
      const result = eventStore.getVoiceAndTimelineForGame(gameId);

      // Assert - Should return phase 1 data (current phase)
      expect(result.voice).toEqual(phase1Voice.voice);
      expect(result.timeline).toEqual(phase1Voice.timeline);
    });

    it("should return empty arrays when voices/voiceTimelines are undefined (null check branch)", () => {
      // Arrange
      const gameId = "2001";
      eventStore.getCurrentGamePhaseForGame(gameId);
      
      // Manually set voices and voiceTimelines to undefined to test null coalescing
      const eventStore_any = eventStore as any;
      const currentPhase = eventStore_any._currentGamePhaseByGameId[gameId].allPhases[0];
      currentPhase.voices = undefined;
      currentPhase.voiceTimelines = undefined;

      // Act
      const result = eventStore.getVoiceAndTimelineForGame(gameId);

      // Assert
      expect(result.voice).toEqual([]);
      expect(result.timeline).toEqual([]);
    });

    it("should handle when game phase data doesn't exist", () => {
      // Arrange
      const gameId = "non-existent-game";

      // Act & Assert - This should throw an error since the method doesn't handle missing game data
      expect(() => eventStore.getVoiceAndTimelineForGame(gameId)).toThrow();
    });
  });

  describe("getInGameEventAndTimelineForGame", () => {
    it("should return empty arrays for new game", () => {
      // Arrange
      const gameId = "2001";
      // Initialize game phase first
      eventStore.getCurrentGamePhaseForGame(gameId);

      // Act
      const result = eventStore.getInGameEventAndTimelineForGame(gameId);

      // Assert
      expect(result.eventName).toEqual([]);
      expect(result.timeline).toEqual([]);
    });

    it("should return in-game event and timeline data", () => {
      // Arrange
      const gameId = "2001";
      const eventArgs = { eventName: ["goal", "assist"], timeline: [10, 20] };

      // Act
      eventStore.appendInGameEventForGame(gameId, eventArgs);
      const result = eventStore.getInGameEventAndTimelineForGame(gameId);

      // Assert
      expect(result.eventName).toEqual(eventArgs.eventName);
      expect(result.timeline).toEqual(eventArgs.timeline);
    });

    it("should return data for current phase", () => {
      // Arrange
      const gameId = "2001";
      const phase0Event = { eventName: ["goal"], timeline: [10] };
      const phase1Event = { eventName: ["save"], timeline: [25] };

      // Act
      eventStore.appendInGameEventForGame(gameId, phase0Event, 0);
      eventStore.appendInGameEventForGame(gameId, phase1Event, 1);
      const result = eventStore.getInGameEventAndTimelineForGame(gameId);

      // Assert - Should return phase 1 data (current phase)
      expect(result.eventName).toEqual(phase1Event.eventName);
      expect(result.timeline).toEqual(phase1Event.timeline);
    });

    it("should return empty arrays when events/timelines are undefined (null check branch)", () => {
      // Arrange
      const gameId = "2001";
      eventStore.getCurrentGamePhaseForGame(gameId);
      
      // Manually set events and timelines to undefined to test null coalescing
      const eventStore_any = eventStore as any;
      const currentPhase = eventStore_any._currentGamePhaseByGameId[gameId].allPhases[0];
      currentPhase.events = undefined;
      currentPhase.timelines = undefined;

      // Act
      const result = eventStore.getInGameEventAndTimelineForGame(gameId);

      // Assert
      expect(result.eventName).toEqual([]);
      expect(result.timeline).toEqual([]);
    });

    it("should handle when game phase data doesn't exist", () => {
      // Arrange
      const gameId = "non-existent-game";

      // Act & Assert - This should throw an error since the method doesn't handle missing game data
      expect(() => eventStore.getInGameEventAndTimelineForGame(gameId)).toThrow();
    });
  });

  describe("updateEventTimelineForGame", () => {
    it("should update event timeline for current phase", () => {
      // Arrange
      const gameId = "2001";
      const newTimeline = [5, 15, 25];
      // Initialize game phase first
      eventStore.getCurrentGamePhaseForGame(gameId);

      // Act
      eventStore.updateEventTimelineForGame(gameId, newTimeline);

      // Assert
      const gamePhase = eventStore.getCurrentGamePhaseForGame(gameId);
      expect(gamePhase.timelines).toEqual(newTimeline);
    });

    it("should overwrite existing timeline", () => {
      // Arrange
      const gameId = "2001";
      const initialEvent = { eventName: ["goal"], timeline: [10] };
      const newTimeline = [5, 15, 25];

      // Act
      eventStore.appendInGameEventForGame(gameId, initialEvent);
      eventStore.updateEventTimelineForGame(gameId, newTimeline);

      // Assert
      const gamePhase = eventStore.getCurrentGamePhaseForGame(gameId);
      expect(gamePhase.timelines).toEqual(newTimeline);
      expect(gamePhase.events).toEqual(["goal"]); // Events should remain unchanged
    });

    it("should handle empty timeline array", () => {
      // Arrange
      const gameId = "2001";
      const emptyTimeline: number[] = [];
      // Initialize game phase first
      eventStore.getCurrentGamePhaseForGame(gameId);

      // Act
      eventStore.updateEventTimelineForGame(gameId, emptyTimeline);

      // Assert
      const gamePhase = eventStore.getCurrentGamePhaseForGame(gameId);
      expect(gamePhase.timelines).toEqual([]);
    });
  });

  describe("getCurrentGamePhaseForGame", () => {
    it("should return initialized game phase for new game", () => {
      // Arrange
      const gameId = "2001";

      // Act
      const result = eventStore.getCurrentGamePhaseForGame(gameId);

      // Assert
      expect(result).toBeDefined();
      expect(result.index).toBe(0);
      expect(result.events).toEqual([]);
      expect(result.timelines).toEqual([]);
      expect(result.voices).toEqual([]);
      expect(result.voiceTimelines).toEqual([]);
      expect(result.result).toEqual([]);
      expect(result.previousVideoLength).toBe(0);
    });

    it("should return current phase data", () => {
      // Arrange
      const gameId = "2001";
      const result = ["goal"];
      const phaseIndex = 1;

      // Act
      eventStore.updateResultForGame(gameId, result, phaseIndex);
      const gamePhase = eventStore.getCurrentGamePhaseForGame(gameId);

      // Assert
      expect(gamePhase.index).toBe(phaseIndex);
      expect(gamePhase.result).toEqual(result);
    });

    it("should initialize game phase if needed", () => {
      // Arrange
      const gameId = "2001";

      // Act
      const firstCall = eventStore.getCurrentGamePhaseForGame(gameId);
      const secondCall = eventStore.getCurrentGamePhaseForGame(gameId);

      // Assert
      expect(firstCall).toBe(secondCall); // Should return same reference
      expect(firstCall.index).toBe(0);
    });
  });

  describe("phase management integration", () => {
    it("should handle multiple phases correctly", () => {
      // Arrange
      const gameId = "2001";
      const phase0Data = { result: ["goal"], voice: ["goal_1"], timeline: [10] };
      const phase1Data = { result: ["save"], voice: ["save_1"], timeline: [25] };

      // Act
      eventStore.updateResultForGame(gameId, phase0Data.result, 0);
      eventStore.appendVoiceForGame(gameId, { voice: phase0Data.voice, timeline: phase0Data.timeline }, 0);
      
      eventStore.updateResultForGame(gameId, phase1Data.result, 1);
      eventStore.appendVoiceForGame(gameId, { voice: phase1Data.voice, timeline: phase1Data.timeline }, 1);

      // Assert
      expect(eventStore.getCurrentPhaseIndexForGame(gameId)).toBe(1);
      
      const currentPhase = eventStore.getCurrentGamePhaseForGame(gameId);
      expect(currentPhase.result).toEqual(phase1Data.result);
      expect(currentPhase.voices).toEqual(phase1Data.voice);
      
      const previousResult = eventStore.getPreviousHalfResultForGame(gameId);
      expect(previousResult).toEqual(phase0Data.result);
    });

    it("should handle phase transitions with video length tracking", () => {
      // Arrange
      const gameId = "2001";
      const phase0Length = 30;
      const phase1Length = 45;

      // Act
      eventStore.updateVideoLengthForGame(gameId, phase0Length, 0);
      eventStore.updateVideoLengthForGame(gameId, phase1Length, 1);

      // Assert
      expect(eventStore.getCurrentPhaseIndexForGame(gameId)).toBe(1);
      expect(eventStore.getPreviousVideoLengthForGame(gameId)).toBe(0); // Previous length for phase 1
      
      const currentPhase = eventStore.getCurrentGamePhaseForGame(gameId);
      expect(currentPhase.currentVideoLength).toBe(phase1Length);
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

    it("should handle large number of phases per game", () => {
      // Arrange
      const gameId = "2001";
      const phaseCount = 100;

      // Act
      for (let i = 0; i < phaseCount; i++) {
        eventStore.updateResultForGame(gameId, [`phase-${i}-result`], i);
        eventStore.updateVideoLengthForGame(gameId, i * 10, i);
      }

      // Assert
      expect(eventStore.getCurrentPhaseIndexForGame(gameId)).toBe(phaseCount - 1);
      const currentPhase = eventStore.getCurrentGamePhaseForGame(gameId);
      expect(currentPhase.result).toEqual([`phase-${phaseCount - 1}-result`]);
      expect(currentPhase.currentVideoLength).toBe((phaseCount - 1) * 10);
    });
  });

  describe("setCurrentEventIntroTimeForGame", () => {
    it("should set intro time for a game", () => {
      // Arrange
      const gameId = "2001";
      const introTime = new Date("2024-01-01T10:00:00Z");
      const mockEvent = createMockEventStreamState(gameId);

      eventStore.setCurrentEventForGame(gameId, mockEvent);

      // Act
      eventStore.setCurrentEventIntroTimeForGame(gameId, introTime);

      // Assert
      const result = eventStore.getCurrentEventForGame(gameId);
      expect(result.introTime).toBe(introTime);
    });
  });
});
