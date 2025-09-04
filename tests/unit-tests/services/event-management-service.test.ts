import { EventManagementService } from "../../../src/services/event-management-service";
import { mockContainer } from "../global-stubs";
import { idHelper } from "../../../src/helpers";
import { Event, EventStreamState, JobName } from "../../../src/types";

// Mock dependencies
jest.mock("../../../src/helpers");
jest.mock("cron", () => ({
  CronJob: jest.fn().mockImplementation((expression, callback, onComplete) => ({
    start: jest.fn(),
  })),
}));
jest.mock("sc-common", () => ({
  logger: {
    logError: jest.fn(),
  },
}));

// Test data factories
const createMockEvent = (eventId: number = 1001, name: string = "Test Event"): Event => ({
  eventID: eventId,
  eventNameAKey: `${name} Home`,
  eventNameBKey: `${name} Away`,
  theme: "football",
  scheduleStartTs: "2024-01-01T10:00:00Z",
  productCode: "SPORT",
  productTypeKey: "FOOTBALL",
  voiceConfig: "voice-config-1",
  eventDetails: [
    {
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
    },
    {
      eventID: eventId,
      oddsAvailableTs: "2024-01-01T10:00:30Z",
      scheduleStartTs: "2024-01-01T10:01:00Z",
      resultsAvailableTs: "2024-01-01T10:01:30Z",
      hasResults: true,
      goalInfo: "goal-info-2",
      playlist: "playlist2",
      result: "2-0",
      markets: [{ id: 2, name: "market2" }],
      inGameEventInfo: "in-game-event-info-2",
    },
  ],
});

const createMockEventStreamState = (eventId: number = 1001, gameId: string = "2001"): EventStreamState => ({
  ...createMockEvent(eventId),
  currentEventDetailIndex: 0,
  liveScores: ["1-0", "2-0"],
  goalInfos: [null, null],
  inGameEvents: [null, null],
  currentPhase: JobName.ScheduleEvent,
  liveVoices: ["", ""],
});

const createMockGoalInfo = () => ({
  frame: [1, 2, 3],
  timeLine: [10, 20, 30],
  result: ["goal", "assist", "save"],
});

const createMockInGameEvent = () => ({
  timeLine: [5, 15, 25],
  frame: [100, 200, 300],
  eventName: ["kick-off", "corner", "free-kick"],
});

const createMockVoiceConfig = () => ({
  voiceConfigId: "voice-config-1",
  language: "en",
  voice: "male",
  speed: 1.0,
  volume: 0.8,
});

describe("EventManagementService", () => {
  let eventManagementService: EventManagementService;
  let mockOddsFeedService: any;
  let mockJobScheduler: any;
  let mockEventSchedulerService: any;
  let mockEventManager: any;
  let mockLogService: any;
  let mockIdHelper: any;
  let mockCronJob: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create proper Jest mocks
    mockOddsFeedService = {
      getEventDetailsWithRetry: jest.fn(),
      getGoalInfo: jest.fn(),
      getScheduleWithRetry: jest.fn(),
      getInGameEvent: jest.fn(),
      getVoiceConfig: jest.fn(),
    };
    mockJobScheduler = {
      stopAll: jest.fn(),
      getRemainingJobs: jest.fn(),
    };
    mockEventSchedulerService = {
      scheduleEvents: jest.fn(),
      scheduleEventDetails: jest.fn(),
      scheduleUpdateGoalInfo: jest.fn(),
      scheduleUpdateVoice: jest.fn(),
    };
    mockEventManager = {
      initializeCurrentEvent: jest.fn(),
      getCurrentEventForGame: jest.fn(),
      initializeGoalInfoForCurrentEvent: jest.fn(),
      initializeInGameEventForCurrentEvent: jest.fn(),
      initializePhaseForCurrentEvent: jest.fn(),
      initializeLiveScoresForCurrentEvent: jest.fn(),
      initializeVoiceConfigDetailForCurrentEvent: jest.fn(),
    };
    mockLogService = {
      logError: jest.fn(),
    };
    mockIdHelper = {
      extractGameId: jest.fn(),
      extractRoundId: jest.fn(),
    };

    // Mock cron
    mockCronJob = {
      start: jest.fn(),
    };
    const cron = require("cron");
    cron.CronJob.mockImplementation((expression: any, callback: any, onComplete: any) => {
      return mockCronJob;
    });

    // Replace the auto-stubbed methods with Jest mocks
    mockContainer.oddsFeedService = mockOddsFeedService;
    mockContainer.jobScheduler = mockJobScheduler;
    mockContainer.eventSchedulerService = mockEventSchedulerService;
    mockContainer.eventManager = mockEventManager;
    mockContainer.logService = mockLogService;

    // Mock helpers
    (idHelper as any) = mockIdHelper;

    eventManagementService = new EventManagementService(mockContainer);
  });

  describe("start", () => {
    it("should initialize current events, schedule next events, and start cron job", async () => {
      // Arrange
      jest.spyOn(eventManagementService, "initializeCurrentEventsForAllGames").mockResolvedValue();
      jest.spyOn(eventManagementService, "schedule").mockResolvedValue();
      jest.spyOn(eventManagementService, "scheduleNextEventsCron").mockReturnValue();

      // Act
      await eventManagementService.start();

      // Assert
      expect(eventManagementService.initializeCurrentEventsForAllGames).toHaveBeenCalled();
      expect(eventManagementService.schedule).toHaveBeenCalled();
      expect(eventManagementService.scheduleNextEventsCron).toHaveBeenCalled();
    });
  });

  describe("scheduleNextEventsCron", () => {
    it("should create and start cron job with correct expression", () => {
      // Arrange
      const cron = require("cron");

      // Act
      eventManagementService.scheduleNextEventsCron();

      // Assert
      expect(cron.CronJob).toHaveBeenCalledWith("*/30 * * * * *", expect.any(Function), expect.any(Function));
      expect(mockCronJob.start).toHaveBeenCalled();
    });

    it("should handle cron job errors and restart", async () => {
      // Arrange
      const cron = require("cron");
      let onCompleteCallback: Function | undefined;
      cron.CronJob.mockImplementation((expression: string, callback: Function, onComplete: Function) => {
        onCompleteCallback = onComplete;
        return mockCronJob;
      });

      // Act
      eventManagementService.scheduleNextEventsCron();
      if (onCompleteCallback) {
        onCompleteCallback();
      }

      // Assert
      expect(mockLogService.logError).toHaveBeenCalledWith(
        "Cron job unexpectedly stopped because some other tasks halt it."
      );
      expect(mockCronJob.start).toHaveBeenCalledTimes(2); // Once initially, once in onComplete
    });
  });

  describe("schedule", () => {
    it("should get next event IDs and schedule them", async () => {
      // Arrange
      const mockNextEventIds = { "2001": 1001, "2002": 2001, "2003": 3001 };
      jest.spyOn(eventManagementService, "getNextEventIDsForEachGame").mockResolvedValue(mockNextEventIds);

      // Act
      await eventManagementService.schedule();

      // Assert
      expect(mockEventSchedulerService.scheduleEvents).toHaveBeenCalledWith([1001, 2001, 3001]);
    });
  });

  describe("initializeCurrentEventsForAllGames", () => {
    it("should initialize current events for all games", async () => {
      // Arrange
      const mockCurrentEventIds = [1001, 2001, 3001];
      jest.spyOn(eventManagementService, "getCurrentEventIDsOfAllGames").mockResolvedValue(mockCurrentEventIds);
      jest.spyOn(eventManagementService, "initializeCurrentEvent").mockResolvedValue();

      // Act
      await eventManagementService.initializeCurrentEventsForAllGames();

      // Assert
      expect(eventManagementService.initializeCurrentEvent).toHaveBeenCalledTimes(3);
      expect(eventManagementService.initializeCurrentEvent).toHaveBeenCalledWith(1001);
      expect(eventManagementService.initializeCurrentEvent).toHaveBeenCalledWith(2001);
      expect(eventManagementService.initializeCurrentEvent).toHaveBeenCalledWith(3001);
    });

    it("should handle empty current events", async () => {
      // Arrange
      mockOddsFeedService.getScheduleWithRetry.mockResolvedValue([]);

      // Act
      await eventManagementService.initializeCurrentEventsForAllGames();

      // Assert
      expect(mockOddsFeedService.getEventDetailsWithRetry).not.toHaveBeenCalled();
    });
  });

  describe("initializeCurrentEvent", () => {
    it("should successfully initialize a current event", async () => {
      // Arrange
      const eventId = 1001;
      const gameId = "2001";
      const mockEvent = createMockEvent(eventId);
      const mockGoalInfo = createMockGoalInfo();

      mockOddsFeedService.getEventDetailsWithRetry.mockResolvedValue(mockEvent);
      mockOddsFeedService.getGoalInfo.mockResolvedValue(mockGoalInfo);
      mockIdHelper.extractGameId.mockReturnValue(gameId);
      mockEventManager.getCurrentEventForGame.mockReturnValue(createMockEventStreamState(eventId, gameId));
      jest.spyOn(eventManagementService, "initializeVoiceConfigForGame").mockResolvedValue();
      jest.spyOn(eventManagementService, "initializeGoalInfoForGame").mockResolvedValue();
      jest.spyOn(eventManagementService, "initializeInGameEventForGame").mockResolvedValue();

      // Act
      await eventManagementService.initializeCurrentEvent(eventId);

      // Assert
      expect(mockOddsFeedService.getEventDetailsWithRetry).toHaveBeenCalledWith(eventId);
      expect(mockEventManager.initializeCurrentEvent).toHaveBeenCalledWith(mockEvent);
      expect(mockEventManager.initializePhaseForCurrentEvent).toHaveBeenCalledWith(eventId);
      expect(mockEventSchedulerService.scheduleEventDetails).toHaveBeenCalledWith(mockEvent);
      expect(eventManagementService.initializeVoiceConfigForGame).toHaveBeenCalledWith(gameId);
      expect(eventManagementService.initializeGoalInfoForGame).toHaveBeenCalledWith(gameId);
      expect(eventManagementService.initializeInGameEventForGame).toHaveBeenCalledWith(gameId);
    });

    it("should handle event not found", async () => {
      // Arrange
      const eventId = 9999;
      mockOddsFeedService.getEventDetailsWithRetry.mockResolvedValue(null);

      // Act
      await eventManagementService.initializeCurrentEvent(eventId);

      // Assert
      expect(mockLogService.logError).toHaveBeenCalledWith(`Event ${eventId} not found`);
      expect(mockEventManager.initializeCurrentEvent).not.toHaveBeenCalled();
    });
  });

  describe("initializeGoalInfoForGame", () => {
    it("should initialize goal info for all event details", async () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(1001, gameId);
      const mockGoalInfo = createMockGoalInfo();

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockOddsFeedService.getGoalInfo.mockResolvedValue(mockGoalInfo);

      // Act
      await eventManagementService.initializeGoalInfoForGame(gameId);

      // Assert
      expect(mockOddsFeedService.getGoalInfo).toHaveBeenCalledTimes(2);
      expect(mockOddsFeedService.getGoalInfo).toHaveBeenCalledWith("goal-info-1");
      expect(mockOddsFeedService.getGoalInfo).toHaveBeenCalledWith("goal-info-2");
      expect(mockEventManager.initializeGoalInfoForCurrentEvent).toHaveBeenCalledWith(gameId, [
        mockGoalInfo,
        mockGoalInfo,
      ]);
    });

    it("should handle event details without goal info", async () => {
      // Arrange
      const gameId = "2001";
      const baseEvent = createMockEventStreamState(1001, gameId);
      const mockEvent = {
        ...baseEvent,
        eventDetails: [
          { ...baseEvent.eventDetails[0], goalInfo: null },
          { ...baseEvent.eventDetails[1], goalInfo: "goal-info-2" },
        ],
      };
      const mockGoalInfo = createMockGoalInfo();

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockOddsFeedService.getGoalInfo.mockResolvedValue(mockGoalInfo);

      // Act
      await eventManagementService.initializeGoalInfoForGame(gameId);

      // Assert
      expect(mockOddsFeedService.getGoalInfo).toHaveBeenCalledTimes(1);
      expect(mockOddsFeedService.getGoalInfo).toHaveBeenCalledWith("goal-info-2");
      expect(mockEventManager.initializeGoalInfoForCurrentEvent).toHaveBeenCalledWith(gameId, [null, mockGoalInfo]);
    });

    it("should handle goal info fetch failures", async () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(1001, gameId);

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockOddsFeedService.getGoalInfo.mockResolvedValue(null);

      // Act
      await eventManagementService.initializeGoalInfoForGame(gameId);

      // Assert
      expect(mockEventManager.initializeGoalInfoForCurrentEvent).toHaveBeenCalledWith(gameId, [null, null]);
    });
  });

  describe("initializeInGameEventForGame", () => {
    it("should initialize in-game events for all event details", async () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(1001, gameId);
      const mockInGameEvent = createMockInGameEvent();

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockOddsFeedService.getInGameEvent.mockResolvedValue(mockInGameEvent);

      // Act
      await eventManagementService.initializeInGameEventForGame(gameId);

      // Assert
      expect(mockOddsFeedService.getInGameEvent).toHaveBeenCalledTimes(2);
      expect(mockOddsFeedService.getInGameEvent).toHaveBeenCalledWith("in-game-event-info-1");
      expect(mockOddsFeedService.getInGameEvent).toHaveBeenCalledWith("in-game-event-info-2");
      expect(mockEventManager.initializeInGameEventForCurrentEvent).toHaveBeenCalledWith(gameId, [
        mockInGameEvent,
        mockInGameEvent,
      ]);
    });

    it("should handle event details without in-game event info", async () => {
      // Arrange
      const gameId = "2001";
      const baseEvent = createMockEventStreamState(1001, gameId);
      const mockEvent = {
        ...baseEvent,
        eventDetails: [
          { ...baseEvent.eventDetails[0], inGameEventInfo: null },
          { ...baseEvent.eventDetails[1], inGameEventInfo: "in-game-event-info-2" },
        ],
      };
      const mockInGameEvent = createMockInGameEvent();

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockOddsFeedService.getInGameEvent.mockResolvedValue(mockInGameEvent);

      // Act
      await eventManagementService.initializeInGameEventForGame(gameId);

      // Assert
      expect(mockOddsFeedService.getInGameEvent).toHaveBeenCalledTimes(1);
      expect(mockOddsFeedService.getInGameEvent).toHaveBeenCalledWith("in-game-event-info-2");
      expect(mockEventManager.initializeInGameEventForCurrentEvent).toHaveBeenCalledWith(gameId, [null, mockInGameEvent]);
    });

    it("should handle in-game event fetch failures", async () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(1001, gameId);

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockOddsFeedService.getInGameEvent.mockResolvedValue(null);

      // Act
      await eventManagementService.initializeInGameEventForGame(gameId);

      // Assert
      expect(mockEventManager.initializeInGameEventForCurrentEvent).toHaveBeenCalledWith(gameId, [null, null]);
    });

    it("should handle empty event details", async () => {
      // Arrange
      const gameId = "2001";
      const baseEvent = createMockEventStreamState(1001, gameId);
      const mockEvent = {
        ...baseEvent,
        eventDetails: [],
      };

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);

      // Act
      await eventManagementService.initializeInGameEventForGame(gameId);

      // Assert
      expect(mockOddsFeedService.getInGameEvent).not.toHaveBeenCalled();
      expect(mockEventManager.initializeInGameEventForCurrentEvent).toHaveBeenCalledWith(gameId, []);
    });
  });

  describe("initializeVoiceConfigForGame", () => {
    it("should initialize voice config when event has voice config", async () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(1001, gameId);
      const mockVoiceConfig = createMockVoiceConfig();

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockOddsFeedService.getVoiceConfig.mockResolvedValue(mockVoiceConfig);

      // Act
      await eventManagementService.initializeVoiceConfigForGame(gameId);

      // Assert
      expect(mockOddsFeedService.getVoiceConfig).toHaveBeenCalledWith("voice-config-1");
      expect(mockEventManager.initializeVoiceConfigDetailForCurrentEvent).toHaveBeenCalledWith(gameId, mockVoiceConfig);
    });

    it("should handle event without voice config", async () => {
      // Arrange
      const gameId = "2001";
      const baseEvent = createMockEventStreamState(1001, gameId);
      const mockEvent = {
        ...baseEvent,
        voiceConfig: null,
      };

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);

      // Act
      await eventManagementService.initializeVoiceConfigForGame(gameId);

      // Assert
      expect(mockOddsFeedService.getVoiceConfig).not.toHaveBeenCalled();
      expect(mockEventManager.initializeVoiceConfigDetailForCurrentEvent).not.toHaveBeenCalled();
    });

    it("should handle event with undefined voice config", async () => {
      // Arrange
      const gameId = "2001";
      const baseEvent = createMockEventStreamState(1001, gameId);
      const mockEvent = {
        ...baseEvent,
        voiceConfig: undefined,
      };

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);

      // Act
      await eventManagementService.initializeVoiceConfigForGame(gameId);

      // Assert
      expect(mockOddsFeedService.getVoiceConfig).not.toHaveBeenCalled();
      expect(mockEventManager.initializeVoiceConfigDetailForCurrentEvent).not.toHaveBeenCalled();
    });

    it("should handle voice config fetch failure", async () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(1001, gameId);

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockOddsFeedService.getVoiceConfig.mockResolvedValue(null);

      // Act
      await eventManagementService.initializeVoiceConfigForGame(gameId);

      // Assert
      expect(mockOddsFeedService.getVoiceConfig).toHaveBeenCalledWith("voice-config-1");
      expect(mockEventManager.initializeVoiceConfigDetailForCurrentEvent).not.toHaveBeenCalled();
    });

    it("should handle voice config API errors", async () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(1001, gameId);

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockOddsFeedService.getVoiceConfig.mockRejectedValue(new Error("Voice Config API Error"));

      // Act & Assert
      await expect(eventManagementService.initializeVoiceConfigForGame(gameId)).rejects.toThrow("Voice Config API Error");
      expect(mockEventManager.initializeVoiceConfigDetailForCurrentEvent).not.toHaveBeenCalled();
    });

    it("should handle empty voice config string", async () => {
      // Arrange
      const gameId = "2001";
      const baseEvent = createMockEventStreamState(1001, gameId);
      const mockEvent = {
        ...baseEvent,
        voiceConfig: "",
      };

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);

      // Act
      await eventManagementService.initializeVoiceConfigForGame(gameId);

      // Assert
      expect(mockOddsFeedService.getVoiceConfig).not.toHaveBeenCalled();
      expect(mockEventManager.initializeVoiceConfigDetailForCurrentEvent).not.toHaveBeenCalled();
    });
  });

  describe("initializeLiveScoresForGame", () => {
    it("should initialize live scores and schedule goal info updates", async () => {
      // Arrange
      const gameId = "2001";
      const mockEvent = createMockEventStreamState(1001, gameId);

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);

      // Act
      await eventManagementService.initializeLiveScoresForGame(gameId);

      // Assert
      expect(mockEventManager.initializeLiveScoresForCurrentEvent).toHaveBeenCalledWith(gameId);
      expect(mockEventSchedulerService.scheduleUpdateGoalInfo).toHaveBeenCalledWith(gameId, 0, null);
      expect(mockEventSchedulerService.scheduleUpdateVoice).toHaveBeenCalledWith(gameId, 0, null);
    });

    it("should handle current event with goal info and in-game events", async () => {
      // Arrange
      const gameId = "2001";
      const mockGoalInfo = createMockGoalInfo();
      const mockInGameEvent = createMockInGameEvent();
      const mockEvent = {
        ...createMockEventStreamState(1001, gameId),
        goalInfos: [mockGoalInfo, null],
        inGameEvents: [mockInGameEvent, null],
      };

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);

      // Act
      await eventManagementService.initializeLiveScoresForGame(gameId);

      // Assert
      expect(mockEventSchedulerService.scheduleUpdateGoalInfo).toHaveBeenCalledWith(gameId, 0, mockGoalInfo);
      expect(mockEventSchedulerService.scheduleUpdateVoice).toHaveBeenCalledWith(gameId, 0, mockInGameEvent);
    });

    it("should handle current event with only in-game events", async () => {
      // Arrange
      const gameId = "2001";
      const mockInGameEvent = createMockInGameEvent();
      const mockEvent = {
        ...createMockEventStreamState(1001, gameId),
        goalInfos: [null, null],
        inGameEvents: [mockInGameEvent, null],
      };

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);

      // Act
      await eventManagementService.initializeLiveScoresForGame(gameId);

      // Assert
      expect(mockEventSchedulerService.scheduleUpdateGoalInfo).toHaveBeenCalledWith(gameId, 0, null);
      expect(mockEventSchedulerService.scheduleUpdateVoice).toHaveBeenCalledWith(gameId, 0, mockInGameEvent);
    });
  });

  describe("getUpcomingEventIDs", () => {
    it("should return array of upcoming event IDs", async () => {
      // Arrange
      const mockEvents = [createMockEvent(1001), createMockEvent(2001), createMockEvent(3001)];
      mockOddsFeedService.getScheduleWithRetry.mockResolvedValue(mockEvents);

      // Act
      const result = await eventManagementService.getUpcomingEventIDs();

      // Assert
      expect(result).toEqual([1001, 2001, 3001]);
      expect(mockOddsFeedService.getScheduleWithRetry).toHaveBeenCalled();
    });

    it("should handle empty schedule", async () => {
      // Arrange
      mockOddsFeedService.getScheduleWithRetry.mockResolvedValue([]);

      // Act
      const result = await eventManagementService.getUpcomingEventIDs();

      // Assert
      expect(result).toEqual([]);
    });

    it("should handle API errors", async () => {
      // Arrange
      mockOddsFeedService.getScheduleWithRetry.mockRejectedValue(new Error("Schedule API Error"));

      // Act & Assert
      await expect(eventManagementService.getUpcomingEventIDs()).rejects.toThrow("Schedule API Error");
    });
  });

  describe("getNextEventIDsForEachGame", () => {
    it("should return next event ID for each game", async () => {
      // Arrange
      const mockEvents = [
        createMockEvent(1001), // Game 2001
        createMockEvent(2001), // Game 2002
        createMockEvent(3001), // Game 2003
      ];
      mockOddsFeedService.getScheduleWithRetry.mockResolvedValue(mockEvents);
      mockIdHelper.extractGameId.mockReturnValueOnce("2001").mockReturnValueOnce("2002").mockReturnValueOnce("2003");

      // Act
      const result = await eventManagementService.getNextEventIDsForEachGame();

      // Assert
      expect(result).toEqual({
        "2001": 1001,
        "2002": 2001,
        "2003": 3001,
      });
    });

    it("should select lowest event ID when multiple events exist for same game", async () => {
      // Arrange
      const mockEvents = [
        createMockEvent(1002), // Game 2001, higher ID
        createMockEvent(1001), // Game 2001, lower ID (should be selected)
        createMockEvent(2001), // Game 2002
      ];
      mockOddsFeedService.getScheduleWithRetry.mockResolvedValue(mockEvents);
      mockIdHelper.extractGameId.mockReturnValueOnce("2001").mockReturnValueOnce("2001").mockReturnValueOnce("2002");

      // Act
      const result = await eventManagementService.getNextEventIDsForEachGame();

      // Assert
      expect(result).toEqual({
        "2001": 1001, // Lower ID selected
        "2002": 2001,
      });
    });

    it("should handle empty schedule", async () => {
      // Arrange
      mockOddsFeedService.getScheduleWithRetry.mockResolvedValue([]);

      // Act
      const result = await eventManagementService.getNextEventIDsForEachGame();

      // Assert
      expect(result).toEqual({});
    });
  });

  describe("getCurrentEventIDsOfAllGames", () => {
    it("should return current correct event IDs for all games", async () => {
      // Arrange
      const mockNextEventIds = { "2001": 1001, "2002": 2001, "2003": 3001 };
      jest.spyOn(eventManagementService, "getNextEventIDsForEachGame").mockResolvedValue(mockNextEventIds);
      jest.spyOn(idHelper, "extractRoundId").mockReturnValueOnce(1).mockReturnValueOnce(2).mockReturnValueOnce(3);

      // Act
      const result = await eventManagementService.getCurrentEventIDsOfAllGames();

      // Assert
      expect(result).toEqual([1001, 2000, 3000]);
    });

    it("should decrement event ID when round ID is greater than 1", async () => {
      // Arrange
      const mockNextEventIds = { "2001": 1001, "2002": 2001 };
      jest.spyOn(eventManagementService, "getNextEventIDsForEachGame").mockResolvedValue(mockNextEventIds);
      mockIdHelper.extractRoundId.mockReturnValueOnce(2).mockReturnValueOnce(1);

      // Act
      const result = await eventManagementService.getCurrentEventIDsOfAllGames();

      // Assert
      expect(result).toEqual([1000, 2001]); // 1001-1=1000 for round 2, 2001 unchanged for round 1
    });

    it("should handle empty next event IDs", async () => {
      // Arrange
      mockOddsFeedService.getScheduleWithRetry.mockResolvedValue([]);

      // Act
      const result = await eventManagementService.getCurrentEventIDsOfAllGames();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("cleanup", () => {
    it("should stop all scheduled jobs", () => {
      // Act
      eventManagementService.cleanup();

      // Assert
      expect(mockJobScheduler.stopAll).toHaveBeenCalled();
    });
  });

  describe("getRemainingJobs", () => {
    it("should return all remaining jobs", () => {
      // Arrange
      const mockJobs = ["job1", "job2", "job3"];
      mockJobScheduler.getRemainingJobs.mockReturnValue(mockJobs);

      // Act
      const result = eventManagementService.getRemainingJobs();

      // Assert
      expect(result).toEqual(mockJobs);
      expect(mockJobScheduler.getRemainingJobs).toHaveBeenCalled();
    });

    it("should return empty array when no jobs remain", () => {
      // Arrange
      mockJobScheduler.getRemainingJobs.mockReturnValue([]);

      // Act
      const result = eventManagementService.getRemainingJobs();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("getRemainingJobsForGame", () => {
    it("should return jobs filtered by game ID", () => {
      // Arrange
      const gameId = "2001";
      const mockJobs = ["2001_job1", "2002_job1", "2001_job2", "2003_job1"];
      mockJobScheduler.getRemainingJobs.mockReturnValue(mockJobs);

      // Act
      const result = eventManagementService.getRemainingJobsForGame(gameId);

      // Assert
      expect(result).toEqual(["2001_job1", "2001_job2"]);
    });

    it("should return empty array when no jobs exist for game", () => {
      // Arrange
      const gameId = "9999";
      const mockJobs = ["2001_job1", "2002_job1"];
      mockJobScheduler.getRemainingJobs.mockReturnValue(mockJobs);

      // Act
      const result = eventManagementService.getRemainingJobsForGame(gameId);

      // Assert
      expect(result).toEqual([]);
    });

    it("should return empty array when no jobs exist at all", () => {
      // Arrange
      const gameId = "2001";
      mockJobScheduler.getRemainingJobs.mockReturnValue([]);

      // Act
      const result = eventManagementService.getRemainingJobsForGame(gameId);

      // Assert
      expect(result).toEqual([]);
    });
  });
});
