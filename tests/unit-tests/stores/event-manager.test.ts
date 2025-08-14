import { EventManager } from "../../../src/stores/event-manager";
import { mockContainer } from "../global-stubs";
import { Event, EventDetail, JobName, GoalInfoData, EventStreamState } from "../../../src/types";
import { EventStore } from "../../../src/stores/event-store";
import { idHelper } from "../../../src/helpers";

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
});

const createMockEvent = (eventId: number = 1, name: string = "Test Event"): Event => ({
  eventID: eventId,
  eventNameAKey: `${name} Home`,
  eventNameBKey: `${name} Away`,
  theme: "football",
  scheduleStartTs: "2024-01-01T10:00:00Z",
  productCode: "SPORT",
  productTypeKey: "FOOTBALL",
  eventDetails: [createMockEventDetail(eventId, 0), createMockEventDetail(eventId, 1)],
});

const createMockGoalInfo = (): GoalInfoData => ({
  frame: [1, 2, 3],
  timeLine: [10, 20, 30],
  result: ["H", "A", "H"], // Home, Away, Home goals
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
});
