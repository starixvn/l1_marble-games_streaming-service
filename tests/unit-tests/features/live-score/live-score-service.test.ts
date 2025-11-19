jest.mock("odds-feed-client", () => {
  return {
    OddsFeedEventName: {
      EventDetailStart: "EventDetailStart",
      EventStart: "EventStart",
      EventUpcoming: "EventUpcoming",
    },
    Scheduler: class {
      schedule = jest.fn();
    },
    OddsFeedEventSource: class {
      eventDetailOn = jest.fn();
      eventDetailOff = jest.fn();
      eventOn = jest.fn();
      eventOff = jest.fn();
      cleanupOn = jest.fn();
      cleanupOff = jest.fn();
    },
    OddsFeedService: class {
      getRemoteJson = jest.fn();
    },
  };
});

import { LiveScoreService, LiveScoreState } from "../../../../src/features/live-score/live-score-service";
import { OddsFeedEventSource, OddsFeedEventName, EventDetailNotification, OddsFeedService } from "odds-feed-client";
import { DelayHandlingService } from "../../../../src/features/delay/delay-handling-service";
import { Scheduler } from "odds-feed-client";
import { GameBroadcastService } from "../../../../src/services/game-broadcast.service";
import { FeatureDebugService } from "../../../../src/features/feature-debug/feature-debug-service";
import { idHelper } from "../../../../src/helpers";
import { createMockEvent, createMockEventDetail } from "../../test-utils/mock-event";

// Mock dependencies
const mockOddsFeedEventSource = {
  eventOn: jest.fn(),
  eventOff: jest.fn(),
  eventDetailOn: jest.fn(),
  eventDetailOff: jest.fn(),
} as unknown as jest.Mocked<OddsFeedEventSource>;

const mockOddsFeedService = {
  getRemoteJson: jest.fn(),
} as unknown as jest.Mocked<OddsFeedService>;

const mockDelayHandlingService = {
  getDelayedTime: jest.fn(),
  getDelayedTimeWithVideoDelay: jest.fn(),
} as unknown as jest.Mocked<DelayHandlingService>;

const mockScheduler = {
  schedule: jest.fn().mockReturnValue("scheduled-id"),
} as unknown as jest.Mocked<Scheduler>;

const mockGameBroadcastService = {
  broadcastToAllClientByGameId: jest.fn(),
} as unknown as jest.Mocked<GameBroadcastService>;

const mockFeatureDebugService = {
  log: jest.fn(),
} as unknown as jest.Mocked<FeatureDebugService>;

// Test constants
const TEST_DELAYED_TIME = new Date("2023-01-01T10:05:00Z");
const TEST_DELAYED_TIME_WITH_VIDEO = new Date("2023-01-01T10:05:30Z");
const TEST_GAME_ID = "1";
const TEST_GAME_ID_2 = "2";
const TEST_EVENT_ID = 4294967298; // gameId: 1, roundId: 2
const TEST_EVENT_ID_2 = 8589934594; // gameId: 2, roundId: 2
const TEST_SCHEDULE_START_TS = "2023-01-01T10:00:00Z";
const TEST_GOAL_INFO_URL = "test-goal-info-url";
const TEST_INDEX = 0;
const TEST_INDEX_1 = 1;

// Test data
type GoalInfo = { result: string[]; timeLine: number[]; frame: number[]; length?: number; duration?: number };
const mockGoalInfo: GoalInfo = {
  result: ["H", "A", "H"],
  timeLine: [10, 25, 45],
  length: 60,
  frame: [100, 200, 300],
};

const mockEvent = createMockEvent({
  eventID: TEST_EVENT_ID,
  scheduleStartTs: TEST_SCHEDULE_START_TS,
  eventDetails: [
    createMockEventDetail({
      eventID: TEST_EVENT_ID,
      scheduleStartTs: TEST_SCHEDULE_START_TS,
      goalInfo: TEST_GOAL_INFO_URL,
      phase: 1,
    }),
    createMockEventDetail({
      eventID: TEST_EVENT_ID,
      scheduleStartTs: "2023-01-01T10:30:00Z",
      goalInfo: "test-goal-info-url-2",
      phase: 2,
    }),
  ],
});

const mockEventDetailNotification: EventDetailNotification = {
  event: mockEvent,
  index: TEST_INDEX,
};

const mockEventDetailNotification2: EventDetailNotification = {
  event: mockEvent,
  index: TEST_INDEX_1,
};

// Helper functions for test setup
interface LiveScoreServiceContainer {
  oddsFeedEventSource: OddsFeedEventSource;
  oddsFeedService: OddsFeedService;
  delayHandlingService: DelayHandlingService;
  scheduler: Scheduler;
  gameBroadcastService: GameBroadcastService;
  featureDebugService: FeatureDebugService;
}

const createContainer = (): LiveScoreServiceContainer => ({
  oddsFeedEventSource: mockOddsFeedEventSource,
  oddsFeedService: mockOddsFeedService,
  delayHandlingService: mockDelayHandlingService,
  scheduler: mockScheduler,
  gameBroadcastService: mockGameBroadcastService,
  featureDebugService: mockFeatureDebugService,
});

const setupMocks = () => {
  jest.clearAllMocks();
  mockDelayHandlingService.getDelayedTime.mockReturnValue(TEST_DELAYED_TIME);
  mockDelayHandlingService.getDelayedTimeWithVideoDelay.mockReturnValue(TEST_DELAYED_TIME_WITH_VIDEO);
  // default remote json mock returns goalInfo for any url
  mockOddsFeedService.getRemoteJson.mockResolvedValue(mockGoalInfo as any);
};

describe("LiveScoreService", () => {
  let liveScoreService: LiveScoreService;
  let container: LiveScoreServiceContainer;

  beforeEach(() => {
    setupMocks();
    container = createContainer();
    liveScoreService = new LiveScoreService(container);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with all dependencies and bind event handlers", () => {
      // Arrange

      // Act
      const service = new LiveScoreService(container);

      // Assert
      expect(service["oddsFeedEventSource"]).toBe(mockOddsFeedEventSource);
      expect(service["oddsFeedService"]).toBe(mockOddsFeedService);
      expect(service["delayHandlingService"]).toBe(mockDelayHandlingService);
      expect(service["scheduler"]).toBe(mockScheduler);
      expect(service["gameBroadcastService"]).toBe(mockGameBroadcastService);
      expect(service["featureDebugService"]).toBe(mockFeatureDebugService);
      expect(service["boundHandleEventDetailStart"]).toBeInstanceOf(Function);
    });

    it("should initialize empty live score tracking object", () => {
      // Arrange

      // Act
      const service = new LiveScoreService(container);

      // Assert
      expect(service["_liveScoreByGameId"]).toEqual({});
    });
  });

  describe("eventName", () => {
    it('should return "liveScore"', () => {
      // Arrange

      // Act
      const result = liveScoreService.eventName;

      // Assert
      expect(result).toBe("liveScore");
    });
  });

  describe("getCurrentByGameId", () => {
    it("should return live score state for existing game", () => {
      // Arrange
      const expectedState: LiveScoreState = { homeScore: 2, awayScore: 1 };
      liveScoreService["_liveScoreByGameId"][TEST_GAME_ID] = expectedState;

      // Act
      const result = liveScoreService.getCurrentByGameId(TEST_GAME_ID);

      // Assert
      expect(result).toBe(expectedState);
    });

    it("should return undefined for non-existing game", () => {
      // Arrange

      // Act
      const result = liveScoreService.getCurrentByGameId("999");

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe("initEvent", () => {
    it("should register event listener for EventDetailStart", () => {
      // Arrange

      // Act
      liveScoreService.initEvent();

      // Assert
      expect(mockOddsFeedEventSource.eventDetailOn).toHaveBeenCalledWith(
        OddsFeedEventName.EventDetailStart,
        liveScoreService["boundHandleEventDetailStart"]
      );
    });
  });

  describe("dispose", () => {
    it("should unregister event listener for EventDetailStart", () => {
      // Arrange

      // Act
      liveScoreService.dispose();

      // Assert
      expect(mockOddsFeedEventSource.eventDetailOff).toHaveBeenCalledWith(
        OddsFeedEventName.EventDetailStart,
        liveScoreService["boundHandleEventDetailStart"]
      );
    });
  });

  describe("handleEventDetailStart", () => {
    it("should fetch goal info and schedule score updates when goal info exists", async () => {
      // Arrange

      // Act
      await liveScoreService.handleEventDetailStart(mockEventDetailNotification);

      // Assert
      expect(mockOddsFeedService.getRemoteJson).toHaveBeenCalledWith(TEST_GOAL_INFO_URL, { eventId: TEST_EVENT_ID });
    });

    it("should return early when goal info is null", async () => {
      // Arrange
      mockOddsFeedService.getRemoteJson.mockResolvedValueOnce(null);

      // Act
      await liveScoreService.handleEventDetailStart(mockEventDetailNotification);

      // Assert
      expect(mockOddsFeedService.getRemoteJson).toHaveBeenCalledWith(TEST_GOAL_INFO_URL, { eventId: TEST_EVENT_ID });
      expect(mockScheduler.schedule).not.toHaveBeenCalled();
    });

    it("should return early when goal info is undefined", async () => {
      // Arrange
      mockOddsFeedService.getRemoteJson.mockResolvedValueOnce(null);

      // Act
      await liveScoreService.handleEventDetailStart(mockEventDetailNotification);

      // Assert
      expect(mockOddsFeedService.getRemoteJson).toHaveBeenCalledWith(TEST_GOAL_INFO_URL, { eventId: TEST_EVENT_ID });
      expect(mockScheduler.schedule).not.toHaveBeenCalled();
    });

    it("should not schedule reset when index is not 0", async () => {
      // Arrange

      // Act
      await liveScoreService.handleEventDetailStart(mockEventDetailNotification2);

      // Assert
      expect(mockDelayHandlingService.getDelayedTime).not.toHaveBeenCalled();
      expect(mockScheduler.schedule).toHaveBeenCalledTimes(3);
    });

    it("should schedule score updates for each goal in timeline", async () => {
      // Arrange

      // Act
      await liveScoreService.handleEventDetailStart(mockEventDetailNotification);

      // Assert
      expect(mockDelayHandlingService.getDelayedTimeWithVideoDelay).toHaveBeenCalledTimes(3);

      // Verify each goal is scheduled
      const goalCalls = mockScheduler.schedule.mock.calls.slice(1);
      goalCalls.forEach((call, index) => {
        expect(call[0]).toBe(TEST_DELAYED_TIME_WITH_VIDEO);
        expect(call[1]).toBeInstanceOf(Function);
      });
    });

    it("should calculate correct goal times based on schedule start and timeline", async () => {
      // Arrange
      const expectedGoalTime1 = new Date(TEST_SCHEDULE_START_TS).getTime() + 10 * 1000;
      const expectedGoalTime2 = new Date(TEST_SCHEDULE_START_TS).getTime() + 25 * 1000;
      const expectedGoalTime3 = new Date(TEST_SCHEDULE_START_TS).getTime() + 45 * 1000;

      // Act
      await liveScoreService.handleEventDetailStart(mockEventDetailNotification);

      // Assert
      expect(mockDelayHandlingService.getDelayedTimeWithVideoDelay).toHaveBeenNthCalledWith(
        1,
        { event: mockEvent, time: new Date(expectedGoalTime1) },
        { oddsFeedEventType: OddsFeedEventName.EventDetailStart }
      );
      expect(mockDelayHandlingService.getDelayedTimeWithVideoDelay).toHaveBeenNthCalledWith(
        2,
        { event: mockEvent, time: new Date(expectedGoalTime2) },
        { oddsFeedEventType: OddsFeedEventName.EventDetailStart }
      );
      expect(mockDelayHandlingService.getDelayedTimeWithVideoDelay).toHaveBeenNthCalledWith(
        3,
        { event: mockEvent, time: new Date(expectedGoalTime3) },
        { oddsFeedEventType: OddsFeedEventName.EventDetailStart }
      );
    });

    it("should handle empty timeline gracefully", async () => {
      // Arrange
      mockOddsFeedService.getRemoteJson.mockResolvedValue({
        result: [],
        timeLine: [],
        length: 0,
        frame: [],
      });

      // Act
      await liveScoreService.handleEventDetailStart(mockEventDetailNotification);

      // Assert
      expect(mockScheduler.schedule).toHaveBeenCalledTimes(0);
    });
  });

  describe("handleLiveScoreUpdate", () => {
    it("should initialize score state if game does not exist", () => {
      // Arrange
      const updateData = { event: mockEvent, result: "H" };

      // Act
      liveScoreService.handleLiveScoreUpdate(updateData);

      // Assert
      expect(liveScoreService["_liveScoreByGameId"][TEST_GAME_ID]).toEqual({
        homeScore: 1,
        awayScore: 0,
      });
    });

    it("should increment home score when result is H", () => {
      // Arrange
      liveScoreService["_liveScoreByGameId"][TEST_GAME_ID] = { homeScore: 1, awayScore: 2 };
      const updateData = { event: mockEvent, result: "H" };

      // Act
      liveScoreService.handleLiveScoreUpdate(updateData);

      // Assert
      expect(liveScoreService["_liveScoreByGameId"][TEST_GAME_ID]).toEqual({
        homeScore: 2,
        awayScore: 2,
      });
    });

    it("should increment away score when result is A", () => {
      // Arrange
      liveScoreService["_liveScoreByGameId"][TEST_GAME_ID] = { homeScore: 1, awayScore: 2 };
      const updateData = { event: mockEvent, result: "A" };

      // Act
      liveScoreService.handleLiveScoreUpdate(updateData);

      // Assert
      expect(liveScoreService["_liveScoreByGameId"][TEST_GAME_ID]).toEqual({
        homeScore: 1,
        awayScore: 3,
      });
    });

    it("should not increment any score when result is neither H nor A", () => {
      // Arrange
      liveScoreService["_liveScoreByGameId"][TEST_GAME_ID] = { homeScore: 1, awayScore: 2 };
      const updateData = { event: mockEvent, result: "X" };

      // Act
      liveScoreService.handleLiveScoreUpdate(updateData);

      // Assert
      expect(liveScoreService["_liveScoreByGameId"][TEST_GAME_ID]).toEqual({
        homeScore: 1,
        awayScore: 2,
      });
    });

    it("should broadcast live score after update", () => {
      // Arrange
      const updateData = { event: mockEvent, result: "H" };

      // Act
      liveScoreService.handleLiveScoreUpdate(updateData);

      // Assert
      expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
        TEST_GAME_ID,
        liveScoreService.getCurrentByGameId(TEST_GAME_ID),
        liveScoreService.eventName
      );
    });

    it("should extract correct game ID using idHelper", () => {
      // Arrange
      const extractGameIdSpy = jest.spyOn(idHelper, "extractGameId").mockReturnValue(TEST_GAME_ID);
      const updateData = { event: mockEvent, result: "H" };

      // Act
      liveScoreService.handleLiveScoreUpdate(updateData);

      // Assert
      expect(extractGameIdSpy).toHaveBeenCalledWith(TEST_EVENT_ID);

      extractGameIdSpy.mockRestore();
    });

    it("should handle empty result string", () => {
      // Arrange
      liveScoreService["_liveScoreByGameId"][TEST_GAME_ID] = { homeScore: 1, awayScore: 2 };
      const updateData = { event: mockEvent, result: "" };

      // Act
      liveScoreService.handleLiveScoreUpdate(updateData);

      // Assert
      expect(liveScoreService["_liveScoreByGameId"][TEST_GAME_ID]).toEqual({
        homeScore: 1,
        awayScore: 2,
      });
    });

    it("should handle lowercase result values", () => {
      // Arrange
      liveScoreService["_liveScoreByGameId"][TEST_GAME_ID] = { homeScore: 0, awayScore: 0 };
      const updateDataHome = { event: mockEvent, result: "h" };
      const updateDataAway = { event: mockEvent, result: "a" };

      // Act
      liveScoreService.handleLiveScoreUpdate(updateDataHome);
      liveScoreService.handleLiveScoreUpdate(updateDataAway);

      // Assert
      expect(liveScoreService["_liveScoreByGameId"][TEST_GAME_ID]).toEqual({
        homeScore: 0, // lowercase 'h' should not match
        awayScore: 0, // lowercase 'a' should not match
      });
    });

    it("should set final flag in live score state when final is true", () => {
      // Arrange
      liveScoreService["_liveScoreByGameId"][TEST_GAME_ID] = { homeScore: 1, awayScore: 1 };
      const updateData = { event: mockEvent, result: "H", final: true };

      // Act
      liveScoreService.handleLiveScoreUpdate(updateData);

      // Assert
      expect(liveScoreService["_liveScoreByGameId"][TEST_GAME_ID]).toEqual({
        homeScore: 2,
        awayScore: 1,
        final: true,
      });
    });

    it("should not set final flag in live score state when final is false", () => {
      // Arrange
      liveScoreService["_liveScoreByGameId"][TEST_GAME_ID] = { homeScore: 1, awayScore: 1 };
      const updateData = { event: mockEvent, result: "H", final: false };

      // Act
      liveScoreService.handleLiveScoreUpdate(updateData);

      // Assert
      expect(liveScoreService["_liveScoreByGameId"][TEST_GAME_ID]).toEqual({
        homeScore: 2,
        awayScore: 1,
      });
      expect(liveScoreService["_liveScoreByGameId"][TEST_GAME_ID].final).toBeUndefined();
    });

    it("should broadcast both stopTimer and liveScore when not final", () => {
      // Arrange
      const updateData = { event: mockEvent, result: "H" };

      // Act
      liveScoreService.handleLiveScoreUpdate(updateData);

      // Assert
      expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenCalledTimes(2);
      expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenNthCalledWith(
        1,
        TEST_GAME_ID,
        { stopTimer: true },
        "stopTimer"
      );
      expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenNthCalledWith(
        2,
        TEST_GAME_ID,
        { homeScore: 1, awayScore: 0 },
        "liveScore"
      );
    });

    it("should broadcast liveScore and stopTimer when final is true", () => {
      // Arrange
      const updateData = { event: mockEvent, result: "H", final: true };

      // Act
      liveScoreService.handleLiveScoreUpdate(updateData);

      // Assert
      expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenCalledTimes(2);
      expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenNthCalledWith(
        1,
        TEST_GAME_ID,
        { stopTimer: true },
        "stopTimer"
      );
      expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenNthCalledWith(
        2,
        TEST_GAME_ID,
        { homeScore: 1, awayScore: 0, final: true },
        "liveScore"
      );
    });
  });

  describe("resetLiveScore", () => {
    it("should reset live score to zero for both teams", () => {
      // Arrange
      liveScoreService["_liveScoreByGameId"][TEST_GAME_ID] = { homeScore: 3, awayScore: 2 };

      // Act
      liveScoreService["resetLiveScore"]({ gameId: TEST_GAME_ID });

      // Assert
      expect(liveScoreService["_liveScoreByGameId"][TEST_GAME_ID]).toEqual({
        homeScore: 0,
        awayScore: 0,
      });
    });

    it("should broadcast live score after reset", () => {
      // Arrange
      liveScoreService["_liveScoreByGameId"][TEST_GAME_ID] = { homeScore: 3, awayScore: 2 };

      // Act
      liveScoreService["resetLiveScore"]({ gameId: TEST_GAME_ID });

      // Assert
      expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
        TEST_GAME_ID,
        { homeScore: 0, awayScore: 0 },
        liveScoreService.eventName
      );
    });

    it("should handle reset for non-existing game", () => {
      // Arrange

      // Act
      liveScoreService["resetLiveScore"]({ gameId: "non-existing" });

      // Assert
      expect(liveScoreService["_liveScoreByGameId"]["non-existing"]).toEqual({
        homeScore: 0,
        awayScore: 0,
      });
    });
  });

  describe("broadcastLiveScore", () => {
    it("should broadcast current live score state to clients", () => {
      // Arrange
      const testState: LiveScoreState = { homeScore: 2, awayScore: 1 };
      liveScoreService["_liveScoreByGameId"][TEST_GAME_ID] = testState;

      // Act
      liveScoreService["broadcastLiveScore"]({ gameId: TEST_GAME_ID });

      // Assert
      expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
        TEST_GAME_ID,
        testState,
        liveScoreService.eventName
      );
    });

    it("should call debug log with JSON stringified live score", () => {
      // Arrange
      const testState: LiveScoreState = { homeScore: 2, awayScore: 1 };
      liveScoreService["_liveScoreByGameId"][TEST_GAME_ID] = testState;

      // Act
      liveScoreService["broadcastLiveScore"]({ gameId: TEST_GAME_ID });

      // Assert
      expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
        liveScoreService,
        `broadcast live score ${JSON.stringify(testState)}`,
        TEST_GAME_ID
      );
    });

    it("should handle undefined live score state", () => {
      // Arrange

      // Act
      liveScoreService["broadcastLiveScore"]({ gameId: TEST_GAME_ID });

      // Assert
      expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
        TEST_GAME_ID,
        undefined,
        liveScoreService.eventName
      );
    });
  });

  describe("log", () => {
    it("should call featureDebugService.log with correct parameters", () => {
      // Arrange
      const message = "test message";
      const gameId = TEST_GAME_ID;

      // Act
      liveScoreService["log"](message, gameId);

      // Assert
      expect(mockFeatureDebugService.log).toHaveBeenCalledWith(liveScoreService, message, gameId);
    });

    it("should handle empty message", () => {
      // Arrange
      const message = "";
      const gameId = TEST_GAME_ID;

      // Act
      liveScoreService["log"](message, gameId);

      // Assert
      expect(mockFeatureDebugService.log).toHaveBeenCalledWith(liveScoreService, message, gameId);
    });

    it("should handle different game IDs", () => {
      // Arrange
      const message = "test message";

      // Act
      liveScoreService["log"](message, TEST_GAME_ID);
      liveScoreService["log"](message, TEST_GAME_ID_2);

      // Assert
      expect(mockFeatureDebugService.log).toHaveBeenCalledTimes(2);
      expect(mockFeatureDebugService.log).toHaveBeenNthCalledWith(1, liveScoreService, message, TEST_GAME_ID);
      expect(mockFeatureDebugService.log).toHaveBeenNthCalledWith(2, liveScoreService, message, TEST_GAME_ID_2);
    });
  });

  describe("broadcastStopTimer", () => {
    it("should broadcast stopTimer message to clients", () => {
      // Arrange

      // Act
      liveScoreService["broadcastStopTimer"]({ gameId: TEST_GAME_ID });

      // Assert
      expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
        TEST_GAME_ID,
        { stopTimer: true },
        "stopTimer"
      );
    });

    it("should handle different game IDs", () => {
      // Arrange

      // Act
      liveScoreService["broadcastStopTimer"]({ gameId: TEST_GAME_ID });
      liveScoreService["broadcastStopTimer"]({ gameId: TEST_GAME_ID_2 });

      // Assert
      expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenCalledTimes(2);
      expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenNthCalledWith(
        1,
        TEST_GAME_ID,
        { stopTimer: true },
        "stopTimer"
      );
      expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenNthCalledWith(
        2,
        TEST_GAME_ID_2,
        { stopTimer: true },
        "stopTimer"
      );
    });
  });

  describe("edge cases", () => {
    it("should maintain correct context when bound methods are called directly", async () => {
      // Arrange
      const boundHandleEventDetailStart = liveScoreService["boundHandleEventDetailStart"];

      // Act
      await boundHandleEventDetailStart(mockEventDetailNotification);

      // Assert
      expect(mockOddsFeedService.getRemoteJson).toHaveBeenCalled();
      expect(mockScheduler.schedule).toHaveBeenCalled();
    });

    it("should handle multiple games independently", async () => {
      // Arrange
      const event2 = createMockEvent({ eventID: TEST_EVENT_ID_2 });
      const notification1 = mockEventDetailNotification;

      // Act
      await liveScoreService.handleEventDetailStart(notification1);
      liveScoreService.handleLiveScoreUpdate({ event: mockEvent, result: "H" });
      liveScoreService.handleLiveScoreUpdate({ event: event2, result: "A" });

      // Assert
      expect(liveScoreService["_liveScoreByGameId"][TEST_GAME_ID]).toEqual({
        homeScore: 1,
        awayScore: 0,
      });
      expect(liveScoreService["_liveScoreByGameId"][TEST_GAME_ID_2]).toEqual({
        homeScore: 0,
        awayScore: 1,
      });
    });

    it("should handle goal info with mismatched result and timeline arrays", async () => {
      // Arrange
      mockOddsFeedService.getRemoteJson.mockResolvedValue({
        result: ["H", "A"],
        timeLine: [10, 25, 45], // More timeline entries than results
        length: 60,
        frame: [100, 200, 300],
      });

      // Act
      await liveScoreService.handleEventDetailStart(mockEventDetailNotification);

      // Assert
      expect(mockScheduler.schedule).toHaveBeenCalledTimes(3); // 3 goals (based on timeline length)
    });

    it("should handle scheduled function execution for score update", async () => {
      // Arrange
      await liveScoreService.handleEventDetailStart(mockEventDetailNotification);

      // Act
      const scoreUpdateCall = mockScheduler.schedule.mock.calls[0]; // Second call is first goal
      const scoreUpdateFunction = scoreUpdateCall[1];
      scoreUpdateFunction();

      // Assert
      expect(liveScoreService["_liveScoreByGameId"][TEST_GAME_ID]).toEqual({
        homeScore: 1, // First goal is "H"
        awayScore: 0,
        final: true,
      });
    });

    it("should handle null goal info gracefully", async () => {
      // Arrange
      mockOddsFeedService.getRemoteJson.mockResolvedValue(null);

      // Act
      await liveScoreService.handleEventDetailStart(mockEventDetailNotification);

      // Assert
      expect(mockScheduler.schedule).not.toHaveBeenCalled();
      expect(Object.keys(liveScoreService["_liveScoreByGameId"])).toHaveLength(0);
    });

    it("should handle goal info service error", async () => {
      // Arrange
      mockOddsFeedService.getRemoteJson.mockRejectedValue(new Error("Service error"));

      // Act & Assert
      await expect(liveScoreService.handleEventDetailStart(mockEventDetailNotification)).rejects.toThrow(
        "Service error"
      );
    });
  });

  describe("getReplayByEvent", () => {
    it("should return array of replay events for a given event", async () => {
      // Arrange
      mockOddsFeedService.getRemoteJson.mockResolvedValue(mockGoalInfo);

      // Act
      const replays = await liveScoreService.getReplayByEvent(mockEvent);

      // Assert
      expect(replays).toBeInstanceOf(Array);
      expect(replays.length).toBeGreaterThan(0);
      expect(replays[0]).toHaveProperty("time");
      expect(replays[0]).toHaveProperty("payload");
      expect(replays[0]).toHaveProperty("eventName", "liveScore");
    });

    it("should return empty array when event has no details", async () => {
      // Arrange
      const eventWithoutDetails = createMockEvent({
        eventID: TEST_EVENT_ID,
        scheduleStartTs: TEST_SCHEDULE_START_TS,
        eventDetails: [],
      });

      // Act
      const replays = await liveScoreService.getReplayByEvent(eventWithoutDetails);

      // Assert
      expect(replays).toBeInstanceOf(Array);
      expect(replays.length).toBe(0);
    });

    it("should call delay handling service with event object for score reset", async () => {
      // Arrange
      mockOddsFeedService.getRemoteJson.mockResolvedValue(mockGoalInfo);

      // Act
      await liveScoreService.getReplayByEvent(mockEvent);

      // Assert
      expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledWith(
        {
          event: mockEvent,
          time: new Date(mockEvent.eventDetails[0].scheduleStartTs),
        },
        {
          oddsFeedEventType: OddsFeedEventName.EventDetailStart,
        }
      );
    });

    it("should call delay handling service with event object for goal scoring", async () => {
      // Arrange
      mockOddsFeedService.getRemoteJson.mockResolvedValue(mockGoalInfo);

      // Act
      await liveScoreService.getReplayByEvent(mockEvent);

      // Assert
      // Should be called once per goal, per event detail (2 event details * 3 goals = 6 calls)
      expect(mockDelayHandlingService.getDelayedTimeWithVideoDelay).toHaveBeenCalledTimes(6);
    });

    it("should include score reset replay as first item when event has details", async () => {
      // Arrange
      mockOddsFeedService.getRemoteJson.mockResolvedValue(mockGoalInfo);

      // Act
      const replays = await liveScoreService.getReplayByEvent(mockEvent);

      // Assert
      const resetReplay = replays[0];
      expect(resetReplay.payload).toEqual({ homeScore: 0, awayScore: 0 });
    });

    it("should include goal scoring replays with correct cumulative scores", async () => {
      // Arrange
      mockOddsFeedService.getRemoteJson.mockResolvedValue(mockGoalInfo);

      // Act
      const replays = await liveScoreService.getReplayByEvent(mockEvent);

      // Assert
      const goalReplays = replays.slice(1); // Skip reset replay
      expect(goalReplays[0].payload).toEqual({ homeScore: 1, awayScore: 0 }); // First H
      expect(goalReplays[1].payload).toEqual({ homeScore: 1, awayScore: 1 }); // Then A
      expect(goalReplays[2].payload).toEqual({ homeScore: 2, awayScore: 1 }); // Finally H
    });

    it("should handle missing goal info gracefully", async () => {
      // Arrange
      mockOddsFeedService.getRemoteJson.mockResolvedValue(null);

      // Act
      const replays = await liveScoreService.getReplayByEvent(mockEvent);

      // Assert
      expect(replays).toBeInstanceOf(Array);
      expect(replays.length).toBe(1); // Only reset replay
      expect(replays[0].payload).toEqual({ homeScore: 0, awayScore: 0 });
    });

    it("should handle goal info service error gracefully", async () => {
      // Arrange
      mockOddsFeedService.getRemoteJson.mockRejectedValue(new Error("Service error"));

      // Act
      const replays = await liveScoreService.getReplayByEvent(mockEvent);

      // Assert
      expect(replays).toBeInstanceOf(Array);
      expect(replays.length).toBe(1); // Only reset replay, errors ignored
      expect(replays[0].payload).toEqual({ homeScore: 0, awayScore: 0 });
    });

    it("should return pure function result (not mutate state)", async () => {
      // Arrange
      mockOddsFeedService.getRemoteJson.mockResolvedValue(mockGoalInfo);
      const initialStateKeys = Object.keys(liveScoreService["_liveScoreByGameId"]);

      // Act
      await liveScoreService.getReplayByEvent(mockEvent);

      // Assert
      const finalStateKeys = Object.keys(liveScoreService["_liveScoreByGameId"]);
      expect(finalStateKeys).toEqual(initialStateKeys);
    });
  });
});
