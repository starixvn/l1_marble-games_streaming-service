import { EventManager } from "../../../src/stores/event-manager";
import { mockContainer } from "../global-stubs";
import { Event, EventDetail, JobName, GoalInfoData, EventStreamState, InGameEvent, VoiceConfig } from "../../../src/types";
import { EventStore } from "../../../src/stores/event-store";
import { idHelper } from "../../../src/helpers";
import { appSettings } from "../../../src/app-settings";

// Mock dependencies
jest.mock("../../../src/helpers");

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
  phase: index,
});

const createMockEvent = (eventId: number = 1, name: string = "Test Event"): Event => ({
  eventID: eventId,
  eventNameAKey: `${name} Home`,
  eventNameBKey: `${name} Away`,
  theme: "football",
  scheduleStartTs: "2024-01-01T10:00:00Z",
  productCode: "SPORT",
  productTypeKey: "FOOTBALL",
  voiceConfig: "voice-config-1",
  eventDetails: [createMockEventDetail(eventId, 0), createMockEventDetail(eventId, 1)],
});

const createMockGoalInfo = (): GoalInfoData => ({
  frame: [1, 2, 3],
  timeLine: [10, 20, 30],
  result: ["H", "A", "H"], // Home, Away, Home goals
});

const createMockInGameEvent = (): InGameEvent => ({
  timeLine: [5, 15, 25],
  frame: [100, 200, 300],
  eventName: ["kick-off", "corner", "free-kick"],
});

const createMockVoiceConfig = (): VoiceConfig => ({
  "goal": {
    1000: 5,
    2000: 3,
  },
  "assist": {
    500: 2,
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

describe("EventManager", () => {
  let eventManager: EventManager;
  let eventStore: EventStore;
  let mockIdHelper: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create proper Jest mocks
    eventStore = new EventStore();

    mockIdHelper = {
      extractGameId: jest.fn(),
    };

    // Mock helpers
    (idHelper as any) = mockIdHelper;

    mockContainer.eventStore = eventStore;

    eventManager = new EventManager(mockContainer);
  });

  describe("initializeCurrentEvent", () => {
    it("should initialize current event with default values", async () => {
      // Arrange
      const event = createMockEvent(1001);
      const gameId = "2001";

      mockIdHelper.extractGameId.mockReturnValue(gameId);
      jest.spyOn(eventStore, "setCurrentEventForGame");

      // Act
      await eventManager.initializeCurrentEvent(event);

      // Assert
      expect(mockIdHelper.extractGameId).toHaveBeenCalledWith(event.eventID);
      expect(eventStore.setCurrentEventForGame).toHaveBeenCalledWith(gameId, {
        ...event,
        currentEventDetailIndex: 0,
        liveScores: ["0:0", "0:0"],
        goalInfos: [null, null],
        currentPhase: JobName.ScheduleEvent,
        liveVoices: [],
        voiceConfig: "voice-config-1",
      });
    });

    it("should initialize current event without voiceConfig", async () => {
      // Arrange
      const event = createMockEvent(1001);
      delete event.voiceConfig; // Remove voiceConfig
      const gameId = "2001";

      mockIdHelper.extractGameId.mockReturnValue(gameId);
      jest.spyOn(eventStore, "setCurrentEventForGame");

      // Act
      await eventManager.initializeCurrentEvent(event);

      // Assert
      expect(mockIdHelper.extractGameId).toHaveBeenCalledWith(event.eventID);
      expect(eventStore.setCurrentEventForGame).toHaveBeenCalledWith(gameId, {
        ...event,
        currentEventDetailIndex: 0,
        liveScores: ["0:0", "0:0"],
        goalInfos: [null, null],
        currentPhase: JobName.ScheduleEvent,
        liveVoices: [],
        voiceConfig: undefined,
      });
    });

    it("should initialize current event with undefined voiceConfig", async () => {
      // Arrange
      const event = createMockEvent(1001);
      event.voiceConfig = undefined;
      const gameId = "2001";

      mockIdHelper.extractGameId.mockReturnValue(gameId);
      jest.spyOn(eventStore, "setCurrentEventForGame");

      // Act
      await eventManager.initializeCurrentEvent(event);

      // Assert
      expect(mockIdHelper.extractGameId).toHaveBeenCalledWith(event.eventID);
      expect(eventStore.setCurrentEventForGame).toHaveBeenCalledWith(gameId, {
        ...event,
        currentEventDetailIndex: 0,
        liveScores: ["0:0", "0:0"],
        goalInfos: [null, null],
        currentPhase: JobName.ScheduleEvent,
        liveVoices: [],
        voiceConfig: undefined,
      });
    });

    it("should initialize current event with empty voiceConfig", async () => {
      // Arrange
      const event = createMockEvent(1001);
      event.voiceConfig = "";
      const gameId = "2001";

      mockIdHelper.extractGameId.mockReturnValue(gameId);
      jest.spyOn(eventStore, "setCurrentEventForGame");

      // Act
      await eventManager.initializeCurrentEvent(event);

      // Assert
      expect(mockIdHelper.extractGameId).toHaveBeenCalledWith(event.eventID);
      expect(eventStore.setCurrentEventForGame).toHaveBeenCalledWith(gameId, {
        ...event,
        currentEventDetailIndex: 0,
        liveScores: ["0:0", "0:0"],
        goalInfos: [null, null],
        currentPhase: JobName.ScheduleEvent,
        liveVoices: [],
        voiceConfig: "",
      });
    });
  });

  describe("initializePhaseForCurrentEvent", () => {
    it("should update phase to UpdateOdds & event detail index to 1 based on current time", async () => {
      // Arrange
      const eventId = 1001;
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId, eventId);
      mockEvent.eventDetails[0].oddsAvailableTs = "2024-01-01T10:00:00Z";
      mockEvent.eventDetails[0].scheduleStartTs = "2024-01-01T10:00:15Z";
      mockEvent.eventDetails[0].resultsAvailableTs = "2024-01-01T10:00:30Z";

      mockEvent.eventDetails[1].oddsAvailableTs = "2024-01-01T10:00:30Z";
      mockEvent.eventDetails[1].scheduleStartTs = "2024-01-01T10:00:45Z";
      mockEvent.eventDetails[1].resultsAvailableTs = "2024-01-01T10:01:00Z";

      const now = new Date("2024-01-01T10:00:35Z").getTime();

      mockIdHelper.extractGameId.mockReturnValue(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      jest.spyOn(Date, "now").mockReturnValue(now);

      // Act
      await eventManager.initializePhaseForCurrentEvent(eventId);

      // Assert
      expect(eventStore.getCurrentEventForGame(gameId).currentPhase).toBe(JobName.UpdateOdds);
      expect(eventStore.getCurrentEventForGame(gameId).currentEventDetailIndex).toBe(1);
    });

    it("should update phase to UpdateResult & event detail index to 1 based on current time", async () => {
      // Arrange
      const eventId = 1001;
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId, eventId);
      mockEvent.eventDetails[0].oddsAvailableTs = "2024-01-01T10:00:00Z";
      mockEvent.eventDetails[0].scheduleStartTs = "2024-01-01T10:00:15Z";
      mockEvent.eventDetails[0].resultsAvailableTs = "2024-01-01T10:00:30Z";

      mockEvent.eventDetails[1].oddsAvailableTs = "2024-01-01T10:00:30Z";
      mockEvent.eventDetails[1].scheduleStartTs = "2024-01-01T10:00:45Z";
      mockEvent.eventDetails[1].resultsAvailableTs = "2024-01-01T10:01:00Z";

      const now = new Date("2024-01-01T10:01:15Z").getTime(); // After resultsAvailableTs

      mockIdHelper.extractGameId.mockReturnValue(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      jest.spyOn(Date, "now").mockReturnValue(now);

      // Act
      await eventManager.initializePhaseForCurrentEvent(eventId);

      // Assert
      expect(eventStore.getCurrentEventForGame(gameId).currentPhase).toBe(JobName.UpdateResult);
      expect(eventStore.getCurrentEventForGame(gameId).currentEventDetailIndex).toBe(1);
    });

    it("should update phase to UpdateVideoInfo & event detail index to 0 based on current time", async () => {
      // Arrange
      const eventId = 1001;
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId, eventId);
      mockEvent.eventDetails[0].oddsAvailableTs = "2024-01-01T10:00:00Z";
      mockEvent.eventDetails[0].scheduleStartTs = "2024-01-01T10:00:15Z";
      mockEvent.eventDetails[0].resultsAvailableTs = "2024-01-01T10:00:30Z";

      mockEvent.eventDetails[1].oddsAvailableTs = "2024-01-01T10:00:30Z";
      mockEvent.eventDetails[1].scheduleStartTs = "2024-01-01T10:00:45Z";
      mockEvent.eventDetails[1].resultsAvailableTs = "2024-01-01T10:01:00Z";
      const now = new Date("2024-01-01T10:00:20Z").getTime();

      mockIdHelper.extractGameId.mockReturnValue(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      jest.spyOn(Date, "now").mockReturnValue(now);

      // Act
      await eventManager.initializePhaseForCurrentEvent(eventId);

      // Assert
      expect(eventStore.getCurrentEventForGame(gameId).currentPhase).toBe(JobName.UpdateVideoInfo);
      expect(eventStore.getCurrentEventForGame(gameId).currentEventDetailIndex).toBe(0);
    });
  });

  describe("initializeGoalInfoForCurrentEvent", () => {
    it("should initialize goal infos for current event", () => {
      // Arrange
      const gameId = "2001";
      const goalInfos = [createMockGoalInfo(), null, createMockGoalInfo()];
      jest.spyOn(eventStore, "setCurrentEventGoalInfosForGame").mockImplementation();

      // Act
      eventManager.initializeGoalInfoForCurrentEvent(gameId, goalInfos);

      // Assert
      expect(eventStore.setCurrentEventGoalInfosForGame).toHaveBeenCalledWith(gameId, goalInfos);
    });
  });

  describe("initializeInGameEventForCurrentEvent", () => {
    it("should initialize in-game events for current event", () => {
      // Arrange
      const gameId = "2001";
      const inGameEvents = [createMockInGameEvent(), null, createMockInGameEvent()];
      jest.spyOn(eventStore, "setCurrentInGameEventsForGame").mockImplementation();

      // Act
      eventManager.initializeInGameEventForCurrentEvent(gameId, inGameEvents);

      // Assert
      expect(eventStore.setCurrentInGameEventsForGame).toHaveBeenCalledWith(gameId, inGameEvents);
    });

    it("should handle array of null in-game events", () => {
      // Arrange
      const gameId = "2001";
      const inGameEvents = [null, null, null];
      jest.spyOn(eventStore, "setCurrentInGameEventsForGame").mockImplementation();

      // Act
      eventManager.initializeInGameEventForCurrentEvent(gameId, inGameEvents);

      // Assert
      expect(eventStore.setCurrentInGameEventsForGame).toHaveBeenCalledWith(gameId, inGameEvents);
    });

    it("should handle empty in-game events array", () => {
      // Arrange
      const gameId = "2001";
      const inGameEvents: (InGameEvent | null)[] = [];
      jest.spyOn(eventStore, "setCurrentInGameEventsForGame").mockImplementation();

      // Act
      eventManager.initializeInGameEventForCurrentEvent(gameId, inGameEvents);

      // Assert
      expect(eventStore.setCurrentInGameEventsForGame).toHaveBeenCalledWith(gameId, inGameEvents);
    });

    it("should handle mixed in-game events array", () => {
      // Arrange
      const gameId = "2001";
      const mockInGameEvent1 = createMockInGameEvent();
      const mockInGameEvent2 = { ...createMockInGameEvent(), eventName: ["penalty", "yellow-card"] };
      const inGameEvents = [mockInGameEvent1, null, mockInGameEvent2];
      jest.spyOn(eventStore, "setCurrentInGameEventsForGame").mockImplementation();

      // Act
      eventManager.initializeInGameEventForCurrentEvent(gameId, inGameEvents);

      // Assert
      expect(eventStore.setCurrentInGameEventsForGame).toHaveBeenCalledWith(gameId, inGameEvents);
    });
  });

  describe("initializeVoiceConfigForCurrentEvent", () => {
    it("should initialize voice config for current event", () => {
      // Arrange
      const gameId = "2001";
      const voiceConfig = "voice-config-123";
      jest.spyOn(eventStore, "setCurrentVoiceConfigForGame").mockImplementation();

      // Act
      eventManager.initializeVoiceConfigForCurrentEvent(gameId, voiceConfig);

      // Assert
      expect(eventStore.setCurrentVoiceConfigForGame).toHaveBeenCalledWith(gameId, voiceConfig);
    });

    it("should handle undefined voice config", () => {
      // Arrange
      const gameId = "2001";
      const voiceConfig = undefined;
      jest.spyOn(eventStore, "setCurrentVoiceConfigForGame").mockImplementation();

      // Act
      eventManager.initializeVoiceConfigForCurrentEvent(gameId, voiceConfig);

      // Assert
      expect(eventStore.setCurrentVoiceConfigForGame).toHaveBeenCalledWith(gameId, undefined);
    });

    it("should handle empty string voice config", () => {
      // Arrange
      const gameId = "2001";
      const voiceConfig = "";
      jest.spyOn(eventStore, "setCurrentVoiceConfigForGame").mockImplementation();

      // Act
      eventManager.initializeVoiceConfigForCurrentEvent(gameId, voiceConfig);

      // Assert
      expect(eventStore.setCurrentVoiceConfigForGame).toHaveBeenCalledWith(gameId, "");
    });

    it("should handle undefined voice config parameter", () => {
      // Arrange
      const gameId = "2001";
      jest.spyOn(eventStore, "setCurrentVoiceConfigForGame").mockImplementation();

      // Act
      eventManager.initializeVoiceConfigForCurrentEvent(gameId);

      // Assert
      expect(eventStore.setCurrentVoiceConfigForGame).toHaveBeenCalledWith(gameId, undefined);
    });

    it("should handle different game IDs", () => {
      // Arrange
      const gameIds = ["2001", "2002", "2003"];
      const voiceConfig = "voice-config-456";
      jest.spyOn(eventStore, "setCurrentVoiceConfigForGame").mockImplementation();

      // Act & Assert
      gameIds.forEach(gameId => {
        eventManager.initializeVoiceConfigForCurrentEvent(gameId, voiceConfig);
        expect(eventStore.setCurrentVoiceConfigForGame).toHaveBeenCalledWith(gameId, voiceConfig);
      });
    });
  });

  describe("initializeVoiceConfigDetailForCurrentEvent", () => {
    it("should initialize voice config detail for current event", () => {
      // Arrange
      const gameId = "2001";
      const voiceConfigDetail = createMockVoiceConfig();
      jest.spyOn(eventStore, "setCurrentVoiceConfigDetailForGame").mockImplementation();

      // Act
      eventManager.initializeVoiceConfigDetailForCurrentEvent(gameId, voiceConfigDetail);

      // Assert
      expect(eventStore.setCurrentVoiceConfigDetailForGame).toHaveBeenCalledWith(gameId, voiceConfigDetail);
    });

    it("should handle undefined voice config detail", () => {
      // Arrange
      const gameId = "2001";
      const voiceConfigDetail = undefined;
      jest.spyOn(eventStore, "setCurrentVoiceConfigDetailForGame").mockImplementation();

      // Act
      eventManager.initializeVoiceConfigDetailForCurrentEvent(gameId, voiceConfigDetail);

      // Assert
      expect(eventStore.setCurrentVoiceConfigDetailForGame).toHaveBeenCalledWith(gameId, undefined);
    });

    it("should handle complex voice config detail structure", () => {
      // Arrange
      const gameId = "2001";
      const complexVoiceConfig: VoiceConfig = {
        "goal": {
          500: 1,
          1000: 2,
          2000: 3,
        },
        "assist": {
          300: 4,
        },
        "save": {
          800: 5,
        },
      };
      jest.spyOn(eventStore, "setCurrentVoiceConfigDetailForGame").mockImplementation();

      // Act
      eventManager.initializeVoiceConfigDetailForCurrentEvent(gameId, complexVoiceConfig);

      // Assert
      expect(eventStore.setCurrentVoiceConfigDetailForGame).toHaveBeenCalledWith(gameId, complexVoiceConfig);
    });

    it("should handle empty voice config detail", () => {
      // Arrange
      const gameId = "2001";
      const emptyVoiceConfig: VoiceConfig = {};
      jest.spyOn(eventStore, "setCurrentVoiceConfigDetailForGame").mockImplementation();

      // Act
      eventManager.initializeVoiceConfigDetailForCurrentEvent(gameId, emptyVoiceConfig);

      // Assert
      expect(eventStore.setCurrentVoiceConfigDetailForGame).toHaveBeenCalledWith(gameId, emptyVoiceConfig);
    });

    it("should handle different game IDs with same voice config detail", () => {
      // Arrange
      const gameIds = ["2001", "2002", "2003"];
      const voiceConfigDetail = createMockVoiceConfig();
      jest.spyOn(eventStore, "setCurrentVoiceConfigDetailForGame").mockImplementation();

      // Act & Assert
      gameIds.forEach(gameId => {
        eventManager.initializeVoiceConfigDetailForCurrentEvent(gameId, voiceConfigDetail);
        expect(eventStore.setCurrentVoiceConfigDetailForGame).toHaveBeenCalledWith(gameId, voiceConfigDetail);
      });
    });

    it("should handle voice config with single event type", () => {
      // Arrange
      const gameId = "2001";
      const singleEventVoiceConfig: VoiceConfig = {
        "penalty": {
          1500: 6,
        },
      };
      jest.spyOn(eventStore, "setCurrentVoiceConfigDetailForGame").mockImplementation();

      // Act
      eventManager.initializeVoiceConfigDetailForCurrentEvent(gameId, singleEventVoiceConfig);

      // Assert
      expect(eventStore.setCurrentVoiceConfigDetailForGame).toHaveBeenCalledWith(gameId, singleEventVoiceConfig);
    });

    it("should handle voice config with multiple durations for same event", () => {
      // Arrange
      const gameId = "2001";
      const multiDurationVoiceConfig: VoiceConfig = {
        "corner": {
          200: 7,
          500: 8,
          1000: 9,
        },
      };
      jest.spyOn(eventStore, "setCurrentVoiceConfigDetailForGame").mockImplementation();

      // Act
      eventManager.initializeVoiceConfigDetailForCurrentEvent(gameId, multiDurationVoiceConfig);

      // Assert
      expect(eventStore.setCurrentVoiceConfigDetailForGame).toHaveBeenCalledWith(gameId, multiDurationVoiceConfig);
    });
  });

  describe("initializeLiveScoresForCurrentEvent", () => {
    it("should initialize live scores based on current time", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      const now = new Date("2024-01-01T10:01:15Z").getTime(); // After resultsAvailableTs

      jest.spyOn(eventStore, "getCurrentEventForGame").mockReturnValue(mockEvent);
      jest.spyOn(eventStore, "setCurrentEventLiveScoresForGame").mockImplementation();
      jest.spyOn(Date, "now").mockReturnValue(now);

      // Act
      eventManager.initializeLiveScoresForCurrentEvent(gameId);

      // Assert
      expect(eventStore.setCurrentEventLiveScoresForGame).toHaveBeenCalledWith(gameId, ["1-0", "1-0"]);
    });

    it("should initialize live scores with 0:0 when results time hasn't passed", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      const now = new Date("2024-01-01T09:59:00Z").getTime(); // Before resultsAvailableTs

      jest.spyOn(eventStore, "getCurrentEventForGame").mockReturnValue(mockEvent);
      jest.spyOn(eventStore, "setCurrentEventLiveScoresForGame").mockImplementation();
      jest.spyOn(Date, "now").mockReturnValue(now);

      // Act
      eventManager.initializeLiveScoresForCurrentEvent(gameId);

      // Assert
      expect(eventStore.setCurrentEventLiveScoresForGame).toHaveBeenCalledWith(gameId, ["0:0", "0:0"]);
    });

    it("should handle mixed results availability", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      mockEvent.eventDetails[0].resultsAvailableTs = "2024-01-01T09:59:00Z"; // Before current time
      mockEvent.eventDetails[1].resultsAvailableTs = "2024-01-01T10:02:00Z"; // After current time
      const now = new Date("2024-01-01T10:00:30Z").getTime();

      jest.spyOn(eventStore, "getCurrentEventForGame").mockReturnValue(mockEvent);
      jest.spyOn(eventStore, "setCurrentEventLiveScoresForGame").mockImplementation();
      jest.spyOn(Date, "now").mockReturnValue(now);

      // Act
      eventManager.initializeLiveScoresForCurrentEvent(gameId);

      // Assert
      expect(eventStore.setCurrentEventLiveScoresForGame).toHaveBeenCalledWith(gameId, ["1-0", "0:0"]);
    });
  });

  describe("updateCurrentEventDetail", () => {
    beforeEach(() => {
      jest.spyOn(eventStore, "setCurrentEventDetailForGame").mockImplementation();
      jest.spyOn(eventStore, "setCurrentEventPhaseForGame").mockImplementation();
    });

    it("should update current event detail and phase", async () => {
      // Arrange
      const updateEvent = createMockEvent(1001);
      const phase = JobName.UpdateOdds;
      const eventDetailIndex = 0;
      const gameId = "2001";

      mockIdHelper.extractGameId.mockReturnValue(gameId);

      // Act
      await eventManager.updateCurrentEventDetail(updateEvent, phase, eventDetailIndex);

      // Assert
      expect(mockIdHelper.extractGameId).toHaveBeenCalledWith(updateEvent.eventID);
      expect(eventStore.setCurrentEventDetailForGame).toHaveBeenCalledWith(
        gameId,
        updateEvent.eventDetails[eventDetailIndex],
        eventDetailIndex
      );
      expect(eventStore.setCurrentEventPhaseForGame).toHaveBeenCalledWith(gameId, phase);
    });

    it("should handle different phases", async () => {
      // Arrange
      const updateEvent = createMockEvent(1001);
      const phases = [JobName.UpdateOdds, JobName.UpdateVideoInfo, JobName.UpdateResult];
      const gameId = "2001";

      mockIdHelper.extractGameId.mockReturnValue(gameId);

      // Act & Assert
      for (const phase of phases) {
        await eventManager.updateCurrentEventDetail(updateEvent, phase, 0);
        expect(eventStore.setCurrentEventPhaseForGame).toHaveBeenCalledWith(gameId, phase);
      }
    });

    it("should handle different event detail indices", async () => {
      // Arrange
      const updateEvent = createMockEvent(1001);
      const phase = JobName.UpdateOdds;
      const gameId = "2001";

      mockIdHelper.extractGameId.mockReturnValue(gameId);

      // Act
      await eventManager.updateCurrentEventDetail(updateEvent, phase, 1);

      // Assert
      expect(eventStore.setCurrentEventDetailForGame).toHaveBeenCalledWith(gameId, updateEvent.eventDetails[1], 1);
    });
  });

  describe("incrementCurrentEventDetailIndex", () => {
    beforeEach(() => {
      jest.spyOn(eventStore, "setCurrentEventForGame").mockImplementation();
    });

    it("should increment current event detail index", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      mockEvent.currentEventDetailIndex = 0;

      jest.spyOn(eventStore, "getCurrentEventForGame").mockReturnValue(mockEvent);

      // Act
      eventManager.incrementCurrentEventDetailIndex(gameId);

      // Assert
      expect(mockEvent.currentEventDetailIndex).toBe(1);
    });

    it("should not exceed maximum index", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      mockEvent.currentEventDetailIndex = 1; // Already at max

      jest.spyOn(eventStore, "getCurrentEventForGame").mockReturnValue(mockEvent);

      // Act
      eventManager.incrementCurrentEventDetailIndex(gameId);

      // Assert
      expect(mockEvent.currentEventDetailIndex).toBe(1); // Should not exceed
    });

    it("should handle event with single detail", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      mockEvent.eventDetails = [createMockEventDetail(1001, 0)];
      mockEvent.currentEventDetailIndex = 0;

      jest.spyOn(eventStore, "getCurrentEventForGame").mockReturnValue(mockEvent);

      // Act
      eventManager.incrementCurrentEventDetailIndex(gameId);

      // Assert
      expect(mockEvent.currentEventDetailIndex).toBe(0); // Should not exceed
    });
  });

  describe("updateLiveScore", () => {
    beforeEach(() => {
      jest.spyOn(eventStore, "setCurrentEventLiveScoreForGame").mockImplementation();
    });

    it("should update live score based on goal results", () => {
      // Arrange
      const gameId = "2001";
      const goalResults = ["H", "A", "H"]; // Home, Away, Home goals
      const goalIndex = 2; // Up to third goal
      const eventDetailIndex = 0;

      // Act
      eventManager.updateLiveScore(gameId, goalResults, goalIndex, eventDetailIndex);

      // Assert
      expect(eventStore.setCurrentEventLiveScoreForGame).toHaveBeenCalledWith(gameId, "2:1", eventDetailIndex);
    });

    it("should handle only home goals", () => {
      // Arrange
      const gameId = "2001";
      const goalResults = ["H", "H", "H"];
      const goalIndex = 2;
      const eventDetailIndex = 0;

      // Act
      eventManager.updateLiveScore(gameId, goalResults, goalIndex, eventDetailIndex);

      // Assert
      expect(eventStore.setCurrentEventLiveScoreForGame).toHaveBeenCalledWith(gameId, "3:0", eventDetailIndex);
    });

    it("should handle only away goals", () => {
      // Arrange
      const gameId = "2001";
      const goalResults = ["A", "A"];
      const goalIndex = 1;
      const eventDetailIndex = 0;

      // Act
      eventManager.updateLiveScore(gameId, goalResults, goalIndex, eventDetailIndex);

      // Assert
      expect(eventStore.setCurrentEventLiveScoreForGame).toHaveBeenCalledWith(gameId, "0:2", eventDetailIndex);
    });

    it("should handle no goals", () => {
      // Arrange
      const gameId = "2001";
      const goalResults: string[] = [];
      const goalIndex = -1;
      const eventDetailIndex = 0;

      // Act
      eventManager.updateLiveScore(gameId, goalResults, goalIndex, eventDetailIndex);

      // Assert
      expect(eventStore.setCurrentEventLiveScoreForGame).toHaveBeenCalledWith(gameId, "0:0", eventDetailIndex);
    });

    it("should handle single goal", () => {
      // Arrange
      const gameId = "2001";
      const goalResults = ["H"];
      const goalIndex = 0;
      const eventDetailIndex = 0;

      // Act
      eventManager.updateLiveScore(gameId, goalResults, goalIndex, eventDetailIndex);

      // Assert
      expect(eventStore.setCurrentEventLiveScoreForGame).toHaveBeenCalledWith(gameId, "1:0", eventDetailIndex);
    });

    it("should handle unknown goal type", () => {
      // Arrange
      const gameId = "2001";
      const goalResults = ["H", "X", "A"]; // Unknown goal type "X"
      const goalIndex = 2;
      const eventDetailIndex = 0;

      // Act
      eventManager.updateLiveScore(gameId, goalResults, goalIndex, eventDetailIndex);

      // Assert
      expect(eventStore.setCurrentEventLiveScoreForGame).toHaveBeenCalledWith(gameId, "1:1", eventDetailIndex);
    });
  });

  describe("updateGoalInfo", () => {
    beforeEach(() => {
      jest.spyOn(eventStore, "setCurrentEventGoalInfoForGame").mockImplementation();
    });

    it("should update goal info for specific event detail", () => {
      // Arrange
      const gameId = "2001";
      const goalInfo = createMockGoalInfo();
      const eventDetailIndex = 0;

      // Act
      eventManager.updateGoalInfo(gameId, goalInfo, eventDetailIndex);

      // Assert
      expect(eventStore.setCurrentEventGoalInfoForGame).toHaveBeenCalledWith(gameId, goalInfo, eventDetailIndex);
    });

    it("should handle null goal info", () => {
      // Arrange
      const gameId = "2001";
      const goalInfo = null;
      const eventDetailIndex = 0;

      // Act
      eventManager.updateGoalInfo(gameId, goalInfo, eventDetailIndex);

      // Assert
      expect(eventStore.setCurrentEventGoalInfoForGame).toHaveBeenCalledWith(gameId, null, eventDetailIndex);
    });

    it("should handle different event detail indices", () => {
      // Arrange
      const gameId = "2001";
      const goalInfo = createMockGoalInfo();
      const eventDetailIndex = 1;

      // Act
      eventManager.updateGoalInfo(gameId, goalInfo, eventDetailIndex);

      // Assert
      expect(eventStore.setCurrentEventGoalInfoForGame).toHaveBeenCalledWith(gameId, goalInfo, eventDetailIndex);
    });
  });

  describe("updateInGameEventInfo", () => {
    beforeEach(() => {
      jest.spyOn(eventStore, "setCurrentInGameEventForGame").mockImplementation();
    });

    it("should update in-game event info for specific event detail", () => {
      // Arrange
      const gameId = "2001";
      const inGameEvent = createMockInGameEvent();
      const eventDetailIndex = 0;

      // Act
      eventManager.updateInGameEventInfo(gameId, inGameEvent, eventDetailIndex);

      // Assert
      expect(eventStore.setCurrentInGameEventForGame).toHaveBeenCalledWith(gameId, inGameEvent, eventDetailIndex);
    });

    it("should handle null in-game event info", () => {
      // Arrange
      const gameId = "2001";
      const inGameEvent = null;
      const eventDetailIndex = 0;

      // Act
      eventManager.updateInGameEventInfo(gameId, inGameEvent, eventDetailIndex);

      // Assert
      expect(eventStore.setCurrentInGameEventForGame).toHaveBeenCalledWith(gameId, null, eventDetailIndex);
    });

    it("should handle different event detail indices", () => {
      // Arrange
      const gameId = "2001";
      const inGameEvent = createMockInGameEvent();
      const eventDetailIndex = 2;

      // Act
      eventManager.updateInGameEventInfo(gameId, inGameEvent, eventDetailIndex);

      // Assert
      expect(eventStore.setCurrentInGameEventForGame).toHaveBeenCalledWith(gameId, inGameEvent, eventDetailIndex);
    });

    it("should handle different types of in-game events", () => {
      // Arrange
      const gameId = "2001";
      const inGameEvent = {
        timeLine: [1, 30, 60],
        frame: [50, 500, 1000],
        eventName: ["start", "halftime", "end"],
      };
      const eventDetailIndex = 0;

      // Act
      eventManager.updateInGameEventInfo(gameId, inGameEvent, eventDetailIndex);

      // Assert
      expect(eventStore.setCurrentInGameEventForGame).toHaveBeenCalledWith(gameId, inGameEvent, eventDetailIndex);
    });
  });

  describe("getCurrentEventForGame", () => {
    beforeEach(() => {
      jest.spyOn(eventStore, "getCurrentEventForGame").mockImplementation();
    });

    it("should return current event for game", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);

      jest.spyOn(eventStore, "getCurrentEventForGame").mockReturnValue(mockEvent);

      // Act
      const result = eventManager.getCurrentEventForGame(gameId);

      // Assert
      expect(result).toBe(mockEvent);
      expect(eventStore.getCurrentEventForGame).toHaveBeenCalledWith(gameId);
    });
  });

  describe("integration and edge case scenarios", () => {
    it("should handle complete event lifecycle initialization", async () => {
      // Arrange
      const event = createMockEvent(1001);
      const gameId = "2001";
      const goalInfos = [createMockGoalInfo(), null];
      const inGameEvents = [createMockInGameEvent(), null];

      mockIdHelper.extractGameId.mockReturnValue(gameId);
      jest.spyOn(eventStore, "setCurrentEventForGame");
      jest.spyOn(eventStore, "setCurrentEventGoalInfosForGame");
      jest.spyOn(eventStore, "setCurrentInGameEventsForGame");

      // Act - Initialize event, goal infos, and in-game events
      await eventManager.initializeCurrentEvent(event);
      eventManager.initializeGoalInfoForCurrentEvent(gameId, goalInfos);
      eventManager.initializeInGameEventForCurrentEvent(gameId, inGameEvents);

      // Assert - Verify the methods were called correctly
      expect(eventStore.setCurrentEventForGame).toHaveBeenCalledTimes(1);
      expect(eventStore.setCurrentEventGoalInfosForGame).toHaveBeenCalledWith(gameId, goalInfos);
      expect(eventStore.setCurrentInGameEventsForGame).toHaveBeenCalledWith(gameId, inGameEvents);
      
      // Check the initial event was set with correct basic structure
      const firstCall = (eventStore.setCurrentEventForGame as jest.Mock).mock.calls[0];
      const [calledGameId, calledEvent] = firstCall;
      
      expect(calledGameId).toBe(gameId);
      expect(calledEvent.eventID).toBe(event.eventID);
      expect(calledEvent.currentEventDetailIndex).toBe(0);
      expect(calledEvent.liveScores).toEqual(["0:0", "0:0"]);
      expect(calledEvent.currentPhase).toBe(JobName.ScheduleEvent);
      expect(calledEvent.liveVoices).toEqual([]);
      // goalInfos array is initialized with nulls, but may have been updated by time we check
      expect(Array.isArray(calledEvent.goalInfos)).toBe(true);
      expect(calledEvent.goalInfos).toHaveLength(2);
    });

    it("should handle event with many event details", async () => {
      // Arrange
      const event = createMockEvent(1001);
      event.eventDetails = [
        createMockEventDetail(1001, 0),
        createMockEventDetail(1001, 1),
        createMockEventDetail(1001, 2),
        createMockEventDetail(1001, 3),
        createMockEventDetail(1001, 4),
      ];
      const gameId = "2001";

      mockIdHelper.extractGameId.mockReturnValue(gameId);
      jest.spyOn(eventStore, "setCurrentEventForGame");

      // Act
      await eventManager.initializeCurrentEvent(event);

      // Assert
      expect(eventStore.setCurrentEventForGame).toHaveBeenCalledWith(gameId, {
        ...event,
        currentEventDetailIndex: 0,
        liveScores: ["0:0", "0:0", "0:0", "0:0", "0:0"],
        goalInfos: [null, null, null, null, null],
        currentPhase: JobName.ScheduleEvent,
        liveVoices: [],
      });
    });

    it("should handle event with empty event details", async () => {
      // Arrange
      const event = createMockEvent(1001);
      event.eventDetails = [];
      const gameId = "2001";

      mockIdHelper.extractGameId.mockReturnValue(gameId);
      jest.spyOn(eventStore, "setCurrentEventForGame");

      // Act
      await eventManager.initializeCurrentEvent(event);

      // Assert
      expect(eventStore.setCurrentEventForGame).toHaveBeenCalledWith(gameId, {
        ...event,
        currentEventDetailIndex: 0,
        liveScores: [],
        goalInfos: [],
        currentPhase: JobName.ScheduleEvent,
        liveVoices: [],
      });
    });

    it("should handle complex live score calculation with multiple goal results", () => {
      // Arrange
      const gameId = "2001";
      const goalResults = ["H", "A", "H", "A", "H", "A", "H"]; // Alternating goals
      const goalIndex = 6; // All goals
      const eventDetailIndex = 0;

      jest.spyOn(eventStore, "setCurrentEventLiveScoreForGame").mockImplementation();

      // Act
      eventManager.updateLiveScore(gameId, goalResults, goalIndex, eventDetailIndex);

      // Assert
      expect(eventStore.setCurrentEventLiveScoreForGame).toHaveBeenCalledWith(gameId, "4:3", eventDetailIndex);
    });

    it("should handle live score with large goal counts", () => {
      // Arrange
      const gameId = "2001";
      const goalResults = Array(20).fill("H"); // 20 home goals
      const goalIndex = 19;
      const eventDetailIndex = 0;

      jest.spyOn(eventStore, "setCurrentEventLiveScoreForGame").mockImplementation();

      // Act
      eventManager.updateLiveScore(gameId, goalResults, goalIndex, eventDetailIndex);

      // Assert
      expect(eventStore.setCurrentEventLiveScoreForGame).toHaveBeenCalledWith(gameId, "20:0", eventDetailIndex);
    });

    it("should handle goal results with mixed case and special characters", () => {
      // Arrange
      const gameId = "2001";
      const goalResults = ["h", "H", "a", "A", "x", "Y", "H"]; // Mixed case and unknown types
      const goalIndex = 6;
      const eventDetailIndex = 0;

      jest.spyOn(eventStore, "setCurrentEventLiveScoreForGame").mockImplementation();

      // Act
      eventManager.updateLiveScore(gameId, goalResults, goalIndex, eventDetailIndex);

      // Assert
      expect(eventStore.setCurrentEventLiveScoreForGame).toHaveBeenCalledWith(gameId, "2:1", eventDetailIndex); // Only "H" and "A" count (2 H's, 1 A)
    });

    it("should handle multiple simultaneous updates correctly", async () => {
      // Arrange
      const gameId = "2001";
      const event = createMockEvent(1001);
      const goalInfo = createMockGoalInfo();
      const inGameEvent = createMockInGameEvent();

      mockIdHelper.extractGameId.mockReturnValue(gameId);
      jest.spyOn(eventStore, "setCurrentEventDetailForGame").mockImplementation();
      jest.spyOn(eventStore, "setCurrentEventPhaseForGame").mockImplementation();
      jest.spyOn(eventStore, "setCurrentEventGoalInfoForGame").mockImplementation();
      jest.spyOn(eventStore, "setCurrentInGameEventForGame").mockImplementation();

      // Act - Perform multiple updates
      await eventManager.updateCurrentEventDetail(event, JobName.UpdateOdds, 0);
      eventManager.updateGoalInfo(gameId, goalInfo, 0);
      eventManager.updateInGameEventInfo(gameId, inGameEvent, 0);

      // Assert
      expect(eventStore.setCurrentEventDetailForGame).toHaveBeenCalledWith(gameId, event.eventDetails[0], 0);
      expect(eventStore.setCurrentEventPhaseForGame).toHaveBeenCalledWith(gameId, JobName.UpdateOdds);
      expect(eventStore.setCurrentEventGoalInfoForGame).toHaveBeenCalledWith(gameId, goalInfo, 0);
      expect(eventStore.setCurrentInGameEventForGame).toHaveBeenCalledWith(gameId, inGameEvent, 0);
    });

    it("should handle phase transitions correctly during initialization", async () => {
      // Arrange
      const eventId = 1001;
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId, eventId);
      
      // Set up timestamps for different phases - need index > 0 for UpdateOdds to trigger
      const baseTime = new Date("2024-01-01T10:00:00Z").getTime();
      mockEvent.eventDetails[0].oddsAvailableTs = new Date(baseTime + 1000).toISOString();
      mockEvent.eventDetails[0].scheduleStartTs = new Date(baseTime + 2000).toISOString();
      mockEvent.eventDetails[0].resultsAvailableTs = new Date(baseTime + 3000).toISOString();
      
      mockEvent.eventDetails[1].oddsAvailableTs = new Date(baseTime + 500).toISOString(); // Earlier for index 1
      mockEvent.eventDetails[1].scheduleStartTs = new Date(baseTime + 3500).toISOString();
      mockEvent.eventDetails[1].resultsAvailableTs = new Date(baseTime + 4000).toISOString();

      const now = baseTime + 2500; // Between first scheduleStartTs and first resultsAvailableTs

      mockIdHelper.extractGameId.mockReturnValue(gameId);
      eventStore.setCurrentEventForGame(gameId, mockEvent);
      jest.spyOn(Date, "now").mockReturnValue(now);

      // Act
      await eventManager.initializePhaseForCurrentEvent(eventId);

      // Assert - Should be in UpdateOdds phase because index 1 oddsAvailableTs has passed and index > 0
      expect(eventStore.getCurrentEventForGame(gameId).currentPhase).toBe(JobName.UpdateOdds);
    });

    it("should handle live scores initialization with edge case timings", () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(gameId);
      
      // Set one result available in the past, one in the future
      const now = new Date("2024-01-01T10:00:30Z").getTime();
      mockEvent.eventDetails[0].resultsAvailableTs = "2024-01-01T09:59:00Z"; // Past
      mockEvent.eventDetails[1].resultsAvailableTs = "2024-01-01T10:02:00Z"; // Future
      mockEvent.eventDetails[0].result = "2-1";
      mockEvent.eventDetails[1].result = "3-2";

      jest.spyOn(eventStore, "getCurrentEventForGame").mockReturnValue(mockEvent);
      jest.spyOn(eventStore, "setCurrentEventLiveScoresForGame").mockImplementation();
      jest.spyOn(Date, "now").mockReturnValue(now);

      // Act
      eventManager.initializeLiveScoresForCurrentEvent(gameId);

      // Assert
      expect(eventStore.setCurrentEventLiveScoresForGame).toHaveBeenCalledWith(gameId, ["2-1", "0:0"]);
    });
  });

  describe("initializeGamePhaseWithResult", () => {
    it("should initialize game phase with result", () => {
      // Arrange
      const gameId = "2001";
      const result = ["goal", "assist", "save"];
      const phaseIndex = 0;

      jest.spyOn(eventStore, "updateResultForGame").mockImplementation();

      // Act
      eventManager.initializeGamePhaseWithResult(gameId, result, phaseIndex);

      // Assert
      expect(eventStore.updateResultForGame).toHaveBeenCalledWith(gameId, result, phaseIndex);
    });
  });

  describe("initializeGamePhaseWithGoalInfo", () => {
    it("should initialize game phase with goal info", () => {
      // Arrange
      const gameId = "2001";
      const goalInfo = { length: 45, result: ["goal", "assist"], timeLine: [10, 20], frame: [100, 200] };
      const phaseIndex = 1;

      jest.spyOn(eventStore, "updateVideoLengthForGame").mockImplementation();
      jest.spyOn(eventStore, "updateResultForGame").mockImplementation();

      // Act
      eventManager.initializeGamePhaseWithGoalInfo(gameId, goalInfo, phaseIndex);

      // Assert
      expect(eventStore.updateVideoLengthForGame).toHaveBeenCalledWith(gameId, 45, phaseIndex);
      expect(eventStore.updateResultForGame).toHaveBeenCalledWith(gameId, ["goal", "assist"], phaseIndex);
    });

    it("should use app settings video length when goalInfo is null and app settings exists", () => {
      // Arrange
      const gameId = "2001";
      const goalInfo = null;
      const phaseIndex = 0;
      
      // Mock appSettings to have videoLength for this gameId
      Object.assign(appSettings, { videoLength: { [gameId]: 60 } });

      jest.spyOn(eventStore, "updateVideoLengthForGame").mockImplementation();
      jest.spyOn(eventStore, "updateResultForGame").mockImplementation();

      // Act
      eventManager.initializeGamePhaseWithGoalInfo(gameId, goalInfo, phaseIndex);

      // Assert
      expect(eventStore.updateVideoLengthForGame).toHaveBeenCalledWith(gameId, 60, phaseIndex);
      expect(eventStore.updateResultForGame).toHaveBeenCalledWith(gameId, [], phaseIndex);
    });

    it("should use default video length when goalInfo is null and no app settings", () => {
      // Arrange
      const gameId = "2002";
      const goalInfo = null;
      const phaseIndex = 1;
      
      // Ensure no videoLength setting for this gameId
      Object.assign(appSettings, { videoLength: {} });

      jest.spyOn(eventStore, "updateVideoLengthForGame").mockImplementation();
      jest.spyOn(eventStore, "updateResultForGame").mockImplementation();

      // Act
      eventManager.initializeGamePhaseWithGoalInfo(gameId, goalInfo, phaseIndex);

      // Assert
      expect(eventStore.updateVideoLengthForGame).toHaveBeenCalledWith(gameId, 30, phaseIndex); // DEFAULT_VIDEO_LENGTH = 30
      expect(eventStore.updateResultForGame).toHaveBeenCalledWith(gameId, [], phaseIndex);
    });

    it("should handle goalInfo without length property", () => {
      // Arrange
      const gameId = "2001";
      const goalInfo = { result: ["save"], timeLine: [15], frame: [150] } as any; // Missing length
      const phaseIndex = 0;
      
      // Mock appSettings
      Object.assign(appSettings, { videoLength: { [gameId]: 50 } });

      jest.spyOn(eventStore, "updateVideoLengthForGame").mockImplementation();
      jest.spyOn(eventStore, "updateResultForGame").mockImplementation();

      // Act
      eventManager.initializeGamePhaseWithGoalInfo(gameId, goalInfo, phaseIndex);

      // Assert
      expect(eventStore.updateVideoLengthForGame).toHaveBeenCalledWith(gameId, 50, phaseIndex); // Falls back to appSettings
      expect(eventStore.updateResultForGame).toHaveBeenCalledWith(gameId, ["save"], phaseIndex);
    });

    it("should handle goalInfo without result property", () => {
      // Arrange
      const gameId = "2001";
      const goalInfo = { length: 40, timeLine: [12], frame: [120] } as any; // Missing result
      const phaseIndex = 1;

      jest.spyOn(eventStore, "updateVideoLengthForGame").mockImplementation();
      jest.spyOn(eventStore, "updateResultForGame").mockImplementation();

      // Act
      eventManager.initializeGamePhaseWithGoalInfo(gameId, goalInfo, phaseIndex);

      // Assert
      expect(eventStore.updateVideoLengthForGame).toHaveBeenCalledWith(gameId, 40, phaseIndex);
      expect(eventStore.updateResultForGame).toHaveBeenCalledWith(gameId, [], phaseIndex); // Falls back to empty array
    });
  });

  describe("appendInGameEventForGame", () => {
    it("should append in-game event for game", () => {
      // Arrange
      const gameId = "2001";
      const inGameEvent = { timeLine: [5, 15], eventName: ["kick", "goal"], frame: [50, 150] };
      const phaseIndex = 0;

      jest.spyOn(eventStore, "getPreviousVideoLengthForGame").mockReturnValue(10);
      jest.spyOn(eventStore, "appendInGameEventForGame").mockImplementation();

      // Act
      eventManager.appendInGameEventForGame(gameId, inGameEvent, phaseIndex);

      // Assert
      expect(eventStore.appendInGameEventForGame).toHaveBeenCalledWith(
        gameId, 
        { timeline: [15, 25], eventName: ["kick", "goal"] }, 
        phaseIndex
      );
    });
  });

  describe("appendVoiceForGame", () => {
    it("should append voice for game", () => {
      // Arrange
      const gameId = "2001";
      const voice = ["voice1", "voice2"];
      const timeline = [8, 18];
      const phaseIndex = 1;

      jest.spyOn(eventStore, "getPreviousVideoLengthForGame").mockReturnValue(5);
      jest.spyOn(eventStore, "appendVoiceForGame").mockImplementation();

      // Act
      eventManager.appendVoiceForGame(gameId, voice, timeline, phaseIndex);

      // Assert
      expect(eventStore.appendVoiceForGame).toHaveBeenCalledWith(
        gameId, 
        { voice: ["voice1", "voice2"], timeline: [13, 23] }, 
        phaseIndex
      );
    });
  });

  describe("getVoiceForGame", () => {
    it("should get voice for game", () => {
      // Arrange
      const gameId = "2001";
      const expectedVoice = { voice: ["test_voice"], timeline: [12] };

      jest.spyOn(eventStore, "getVoiceAndTimelineForGame").mockReturnValue(expectedVoice);

      // Act
      const result = eventManager.getVoiceForGame(gameId);

      // Assert
      expect(eventStore.getVoiceAndTimelineForGame).toHaveBeenCalledWith(gameId);
      expect(result).toEqual(expectedVoice);
    });
  });

  describe("getInGameEventForGame", () => {
    it("should get in-game event for game", () => {
      // Arrange
      const gameId = "2001";
      const expectedEvent = { eventName: ["test_event"], timeline: [25] };

      jest.spyOn(eventStore, "getInGameEventAndTimelineForGame").mockReturnValue(expectedEvent);

      // Act
      const result = eventManager.getInGameEventForGame(gameId);

      // Assert
      expect(eventStore.getInGameEventAndTimelineForGame).toHaveBeenCalledWith(gameId);
      expect(result).toEqual(expectedEvent);
    });
  });

  describe("getPreviousResultForGame", () => {
    it("should get previous result for game", () => {
      // Arrange
      const gameId = "2001";
      const expectedResult = ["1", "0"];

      jest.spyOn(eventStore, "getPreviousHalfResultForGame").mockReturnValue(expectedResult);

      // Act
      const result = eventManager.getPreviousResultForGame(gameId);

      // Assert
      expect(eventStore.getPreviousHalfResultForGame).toHaveBeenCalledWith(gameId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe("updateIntroTimeForCurrentEvent", () => {
    it("should update intro time for current event", () => {
      // Arrange
      const gameId = "2001";
      const introTime = new Date("2024-01-01T10:00:00Z");

      jest.spyOn(eventStore, "setCurrentEventIntroTimeForGame").mockImplementation();

      // Act
      eventManager.updateIntroTimeForCurrentEvent(gameId, introTime);

      // Assert
      expect(eventStore.setCurrentEventIntroTimeForGame).toHaveBeenCalledWith(gameId, introTime);
    });

    it("should handle different game IDs", () => {
      // Arrange
      const gameId1 = "2001";
      const gameId2 = "2002";
      const introTime1 = new Date("2024-01-01T10:00:00Z");
      const introTime2 = new Date("2024-01-01T10:05:00Z");

      jest.spyOn(eventStore, "setCurrentEventIntroTimeForGame").mockImplementation();

      // Act
      eventManager.updateIntroTimeForCurrentEvent(gameId1, introTime1);
      eventManager.updateIntroTimeForCurrentEvent(gameId2, introTime2);

      // Assert
      expect(eventStore.setCurrentEventIntroTimeForGame).toHaveBeenCalledTimes(2);
      expect(eventStore.setCurrentEventIntroTimeForGame).toHaveBeenCalledWith(gameId1, introTime1);
      expect(eventStore.setCurrentEventIntroTimeForGame).toHaveBeenCalledWith(gameId2, introTime2);
    });

    it("should handle future intro times", () => {
      // Arrange
      const gameId = "2001";
      const futureTime = new Date(Date.now() + 60000); // 1 minute in the future

      jest.spyOn(eventStore, "setCurrentEventIntroTimeForGame").mockImplementation();

      // Act
      eventManager.updateIntroTimeForCurrentEvent(gameId, futureTime);

      // Assert
      expect(eventStore.setCurrentEventIntroTimeForGame).toHaveBeenCalledWith(gameId, futureTime);
    });

    it("should handle past intro times", () => {
      // Arrange
      const gameId = "2001";
      const pastTime = new Date(Date.now() - 60000); // 1 minute in the past

      jest.spyOn(eventStore, "setCurrentEventIntroTimeForGame").mockImplementation();

      // Act
      eventManager.updateIntroTimeForCurrentEvent(gameId, pastTime);

      // Assert
      expect(eventStore.setCurrentEventIntroTimeForGame).toHaveBeenCalledWith(gameId, pastTime);
    });
  });
});
