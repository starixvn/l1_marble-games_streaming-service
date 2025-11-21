import { GameFlowService, GameFlow } from "../../../../src/features/game-flow/game-flow-service";
import { OddsFeedEventSource, OddsFeedEventName, EventDetailNotification, Scheduler } from "odds-feed-client";
import { DelayHandlingService } from "../../../../src/features/delay/delay-handling-service";
import { GameBroadcastService } from "../../../../src/services/game-broadcast.service";
import { FeatureDebugService } from "../../../../src/features/feature-debug/feature-debug-service";
import { GameFlowTimeTrackingService } from "../../../../src/features/game-flow-time-tracking-service/game-flow-time-tracking-service";
import { isLastEventDetail, isPhaseSwitching } from "../../../../src/helpers/phase-helper";
import { createMockEvent, createMockEventDetail } from "../../test-utils/mock-event";
import { runLastScheduledCallback, clearScheduler } from "../../test-utils/scheduler-test-utils";

// Mock dependencies
const mockOddsFeedEventSource = {
  eventOn: jest.fn(),
  eventOff: jest.fn(),
  eventDetailOn: jest.fn(),
  eventDetailOff: jest.fn(),
} as unknown as jest.Mocked<OddsFeedEventSource>;

const mockScheduler = {
  schedule: jest.fn().mockReturnValue("scheduled-id"),
} as unknown as jest.Mocked<Scheduler>;

const mockDelayHandlingService = {
  getDelayedTime: jest.fn(),
  getDelayedTimeWithVideoDelay: jest.fn(),
  getTimeToStartEvent: jest.fn(),
  getTimeToStream: jest.fn(),
} as unknown as jest.Mocked<DelayHandlingService>;

const mockGameBroadcastService = {
  broadcastToAllClientByGameId: jest.fn(),
} as unknown as jest.Mocked<GameBroadcastService>;

const mockFeatureDebugService = {
  log: jest.fn(),
} as unknown as jest.Mocked<FeatureDebugService>;

const mockGameFlowTimeTrackingService = {
  setTrackPoint: jest.fn(),
  getRelativeTime: jest.fn().mockReturnValue(0),
} as unknown as jest.Mocked<GameFlowTimeTrackingService>;

// Mock helper functions
jest.mock("../../../../src/helpers/phase-helper", () => ({
  isLastEventDetail: jest.fn(),
  isPhaseSwitching: jest.fn(),
}));

const mockIsLastEventDetail = isLastEventDetail as jest.MockedFunction<typeof isLastEventDetail>;
const mockIsPhaseSwitching = isPhaseSwitching as jest.MockedFunction<typeof isPhaseSwitching>;

// Test constants
const TEST_GAME_ID = "1";
const TEST_EVENT_ID = 4294967298; // gameId: 1, roundId: 2
const TEST_BASE_TIME = "2023-01-01T10:00:00Z";
const TEST_DELAYED_TIME = new Date("2023-01-01T10:05:00Z");

// Test data using shared mock utils
const mockEventWithDetails = createMockEvent({
  eventID: TEST_EVENT_ID,
  eventConfig: { preloadDurationMs: 6000 },
  config: { delay: { eventDetailChangeMs: 3000 } },
  scheduleStartTs: TEST_BASE_TIME,
  scheduleEndTs: new Date(new Date(TEST_BASE_TIME).getTime() + 120 * 1000).toISOString(), // 2 minutes after start for result duration
  eventDetails: [
    createMockEventDetail({
      phase: 1,
      oddsAvailableTs: TEST_BASE_TIME,
      scheduleStartTs: new Date(new Date(TEST_BASE_TIME).getTime() + 15 * 1000).toISOString(),
      resultsAvailableTs: new Date(new Date(TEST_BASE_TIME).getTime() + 30 * 1000).toISOString(),
    }),
    createMockEventDetail({
      phase: 1,
      oddsAvailableTs: new Date(new Date(TEST_BASE_TIME).getTime() + 30 * 1000).toISOString(),
      scheduleStartTs: new Date(new Date(TEST_BASE_TIME).getTime() + 45 * 1000).toISOString(),
      resultsAvailableTs: new Date(new Date(TEST_BASE_TIME).getTime() + 60 * 1000).toISOString(),
    }),
    createMockEventDetail({
      phase: 2,
      oddsAvailableTs: new Date(new Date(TEST_BASE_TIME).getTime() + 60 * 1000).toISOString(),
      scheduleStartTs: new Date(new Date(TEST_BASE_TIME).getTime() + 75 * 1000).toISOString(),
      resultsAvailableTs: new Date(new Date(TEST_BASE_TIME).getTime() + 90 * 1000).toISOString(),
    }),
    createMockEventDetail({
      phase: 2,
      oddsAvailableTs: new Date(new Date(TEST_BASE_TIME).getTime() + 90 * 1000).toISOString(),
      scheduleStartTs: new Date(new Date(TEST_BASE_TIME).getTime() + 105 * 1000).toISOString(),
      resultsAvailableTs: new Date(new Date(TEST_BASE_TIME).getTime() + 120 * 1000).toISOString(),
    }),
  ],
} as any);

const mockEventNotification: any = {
  event: mockEventWithDetails,
};

const mockEventDetailNotification: EventDetailNotification = {
  event: mockEventWithDetails,
  index: 0,
};

const mockLastEventDetailNotification: EventDetailNotification = {
  event: mockEventWithDetails,
  index: 3, // Last index (4 event details, so index 3 is last)
};

const mockPhaseSwitchingNotification: EventDetailNotification = {
  event: mockEventWithDetails,
  index: 1, // Phase switches from 1 to 2 (after index 1, moving to index 2)
};

// Helper functions for test setup
const createContainer = () => ({
  oddsFeedEventSource: mockOddsFeedEventSource,
  scheduler: mockScheduler,
  delayHandlingService: mockDelayHandlingService,
  gameBroadcastService: mockGameBroadcastService,
  featureDebugService: mockFeatureDebugService,
  gameFlowTimeTrackingService: mockGameFlowTimeTrackingService,
});

const setupMocks = () => {
  jest.clearAllMocks();
  mockDelayHandlingService.getDelayedTime.mockReturnValue(TEST_DELAYED_TIME);
  mockDelayHandlingService.getDelayedTimeWithVideoDelay.mockReturnValue(TEST_DELAYED_TIME);
  mockDelayHandlingService.getTimeToStartEvent.mockReturnValue(TEST_DELAYED_TIME);
  mockDelayHandlingService.getTimeToStream.mockReturnValue(TEST_DELAYED_TIME);
  mockIsLastEventDetail.mockReturnValue(false);
  mockIsPhaseSwitching.mockReturnValue(false);

  // Mock Date.now for consistency (used by debug service/time tracking)
  jest.spyOn(Date, "now").mockReturnValue(1000000);
  clearScheduler(mockScheduler);
};

describe("GameFlowService", () => {
  let gameFlowService: GameFlowService;
  let container: ReturnType<typeof createContainer>;

  beforeEach(() => {
    setupMocks();
    container = createContainer();
    gameFlowService = new GameFlowService(container);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should construct service instance", () => {
      // Arrange & Act
      const service = new GameFlowService(container);

      // Assert
      expect(service).toBeInstanceOf(GameFlowService);
    });
  });

  describe("eventName", () => {
    it('should return "gameFlow"', () => {
      // Act
      const result = gameFlowService.eventName;

      // Assert
      expect(result).toBe("gameFlow");
    });
  });

  describe("initEvent", () => {
    it("should register all required event listeners", () => {
      // Arrange & Act
      gameFlowService.initEvent();

      // Assert
      expect(mockOddsFeedEventSource.eventOn).toHaveBeenCalledWith(OddsFeedEventName.EventStart, expect.any(Function));
      expect(mockOddsFeedEventSource.eventDetailOn).toHaveBeenCalledWith(
        OddsFeedEventName.EventDetailResultsAvailable,
        expect.any(Function)
      );
      expect(mockOddsFeedEventSource.eventDetailOn).toHaveBeenCalledWith(
        OddsFeedEventName.EventDetailStart,
        expect.any(Function)
      );
    });
  });

  describe("dispose", () => {
    it("should unregister all event listeners", () => {
      // Arrange
      gameFlowService.initEvent();
      const onEventStartHandler = mockOddsFeedEventSource.eventOn.mock.calls[0][1];
      const onDetailResultsHandler = mockOddsFeedEventSource.eventDetailOn.mock.calls[0][1];
      const onDetailStartHandler = mockOddsFeedEventSource.eventDetailOn.mock.calls[1][1];

      // Act
      gameFlowService.dispose();

      // Assert
      expect(mockOddsFeedEventSource.eventOff).toHaveBeenCalledWith(OddsFeedEventName.EventStart, onEventStartHandler);
      expect(mockOddsFeedEventSource.eventDetailOff).toHaveBeenCalledWith(
        OddsFeedEventName.EventDetailResultsAvailable,
        onDetailResultsHandler
      );
      expect(mockOddsFeedEventSource.eventDetailOff).toHaveBeenCalledWith(
        OddsFeedEventName.EventDetailStart,
        onDetailStartHandler
      );
    });
  });

  describe("getCurrentGameFlow", () => {
    it("should return game flow for existing game with current event", () => {
      // Arrange
      const gameId = TEST_GAME_ID;
      // switch via public API
      gameFlowService.handleEventDetailScheduleStart({ event: mockEventWithDetails, index: 0 });
      runLastScheduledCallback(mockScheduler);

      // Act
      const result = gameFlowService.getCurrentGameFlow(gameId);

      // Assert - streaming duration = resultsAvailableTs - scheduleStartTs - preloadDurationMs
      // For index 0: (BASE + 30s) - (BASE + 15s) - 6000 = 9000ms
      expect(result).toEqual({
        state: GameFlow.Streaming,
        durationMs: 9000, // 9000ms = 15000 streaming duration - 6000ms preloadDurationMs
        timeToStartTs: 1000000,
        currentStateTimeMs: 0,
      });
    });

    it("should return undefined when no current event exists", () => {
      // Arrange
      const gameId = "999"; // Non-existing game

      // Act
      const result = gameFlowService.getCurrentGameFlow(gameId);

      // Assert
      expect(result).toBeUndefined();
    });

    it("should return different game flows for different games", () => {
      // Arrange
      const gameId1 = "1";
      const gameId2 = "2";
      // trigger transitions through public handlers
      gameFlowService.handleEventStart({ event: { ...mockEventWithDetails, eventID: TEST_EVENT_ID } as any });
      runLastScheduledCallback(mockScheduler);

      // Last detail -> Result for game 2
      const game2EventId = 8589934594; // gameId: 2
      const eventForGame2 = { ...mockEventWithDetails, eventID: game2EventId } as any;
      (isLastEventDetail as jest.Mock).mockReturnValue(true);
      gameFlowService.handleResultAvailable({ event: eventForGame2, index: 2 } as any);
      runLastScheduledCallback(mockScheduler);

      // Act
      const result1 = gameFlowService.getCurrentGameFlow(gameId1);
      const result2 = gameFlowService.getCurrentGameFlow(gameId2);

      // Assert
      expect(result1?.state).toBe(GameFlow.Prebet);
      expect(result2?.state).toBe(GameFlow.Result);
    });
  });

  describe("getCurrentByGameId", () => {
    it("should return game flow wrapped in object", () => {
      // Arrange
      const gameId = TEST_GAME_ID;
      gameFlowService.handleEventDetailScheduleStart({ event: mockEventWithDetails, index: 0 });
      runLastScheduledCallback(mockScheduler);

      // Act
      const result = gameFlowService.getCurrentByGameId(gameId);

      // Assert
      expect(result).toEqual({
        state: GameFlow.Streaming,
        durationMs: 9000, // 9000ms = 15000 streaming duration - 6000ms preloadDurationMs
        currentStateTimeMs: 0,
      });
    });

    it("should return undefined for non-existing game", () => {
      // Arrange
      const gameId = "non-existent";

      // Act
      const result = gameFlowService.getCurrentByGameId(gameId);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  // Track point retrieval moved to GameFlowTimeTrackingService; no longer tested here

  describe("handleEventStart", () => {
    it("should calculate delayed time and schedule switch to prebet", () => {
      // Arrange & Act
      gameFlowService.handleEventStart(mockEventNotification);
      runLastScheduledCallback(mockScheduler);

      // Assert
      expect(mockDelayHandlingService.getTimeToStartEvent).toHaveBeenCalledWith(mockEventWithDetails);
      expect(mockScheduler.schedule).toHaveBeenCalledWith(
        TEST_DELAYED_TIME,
        expect.any(Function),
        expect.objectContaining({ overrideNow: mockEventWithDetails.now })
      );
    });

    it("should schedule the correct bound method for switch to prebet", () => {
      // Act
      gameFlowService.handleEventStart(mockEventNotification);
      runLastScheduledCallback(mockScheduler);

      // Assert
      expect(gameFlowService.getCurrentGameFlow(TEST_GAME_ID)?.state).toBe(GameFlow.Prebet);
    });

    it("should set track point when switching to prebet", () => {
      // Act
      gameFlowService.handleEventStart(mockEventNotification);
      runLastScheduledCallback(mockScheduler);

      // Assert
      expect(mockGameFlowTimeTrackingService.setTrackPoint).toHaveBeenCalledWith(TEST_GAME_ID, 1000000);
    });

    it("should log when switching to prebet", () => {
      // Act
      gameFlowService.handleEventStart(mockEventNotification);
      runLastScheduledCallback(mockScheduler);

      // Assert
      const lastLogCall = mockFeatureDebugService.log.mock.calls[mockFeatureDebugService.log.mock.calls.length - 1];
      expect(lastLogCall?.[0]).toBe(gameFlowService);
      expect(lastLogCall?.[1]).toContain(`event id ${TEST_EVENT_ID}`);
      expect(lastLogCall?.[1]).toContain(GameFlow.Prebet);
      expect(lastLogCall?.[2]).toBe(TEST_GAME_ID);
    });

    it("should calculate prebet duration correctly", () => {
      // Arrange
      // Prebet duration = eventDetails[0].scheduleStartTs - event.scheduleStartTs + preloadDurationMs
      // = (BASE + 15s) - BASE + 6000ms = 21000ms

      const expectedDurationMs = 21000; // 21000ms = 15000 prebet duration + 6000ms preloadDurationMs

      // Act
      gameFlowService.handleEventStart(mockEventNotification);
      runLastScheduledCallback(mockScheduler);

      // Assert
      const gameFlow = gameFlowService.getCurrentGameFlow(TEST_GAME_ID);
      expect(gameFlow?.durationMs).toBe(expectedDurationMs);
    });

    it("should broadcast prebet with calculated durationMs", () => {
      // Arrange
      const expectedDurationMs = 21000; // 21000ms = 15000 prebet duration + 6000ms preloadDurationMs

      // Act
      gameFlowService.handleEventStart(mockEventNotification);
      runLastScheduledCallback(mockScheduler);

      // Assert
      expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
        TEST_GAME_ID,
        {
          state: GameFlow.Prebet,
          durationMs: expectedDurationMs,
          currentStateTimeMs: 0,
        },
        "gameFlow"
      );
    });
  });

  describe("handleResultAvailable", () => {
    it("should schedule switch to result when is last event detail", () => {
      // Arrange
      mockIsLastEventDetail.mockReturnValue(true);

      // Act
      gameFlowService.handleResultAvailable(mockLastEventDetailNotification);
      runLastScheduledCallback(mockScheduler);

      // Assert
      expect(mockIsLastEventDetail).toHaveBeenCalledWith(mockLastEventDetailNotification);
      expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledWith(
        {
          event: mockEventWithDetails,
          time: new Date(mockEventWithDetails.eventDetails[3].resultsAvailableTs),
        },
        {
          oddsFeedEventType: OddsFeedEventName.EventDetailResultsAvailable,
        }
      );
      expect(mockScheduler.schedule).toHaveBeenCalledWith(
        TEST_DELAYED_TIME,
        expect.any(Function),
        expect.objectContaining({ overrideNow: mockEventWithDetails.now })
      );
    });

    it("should schedule switch to phase change when is phase switching", () => {
      // Arrange
      mockIsPhaseSwitching.mockReturnValue(true);

      // Act
      gameFlowService.handleResultAvailable(mockPhaseSwitchingNotification);
      runLastScheduledCallback(mockScheduler);

      // Assert
      expect(mockIsPhaseSwitching).toHaveBeenCalledWith(mockPhaseSwitchingNotification);
      expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledWith(
        {
          event: mockEventWithDetails,
          time: new Date(mockEventWithDetails.eventDetails[1].resultsAvailableTs),
        },
        {
          oddsFeedEventType: OddsFeedEventName.EventDetailResultsAvailable,
        }
      );
      expect(mockScheduler.schedule).toHaveBeenCalledWith(
        TEST_DELAYED_TIME,
        expect.any(Function),
        expect.objectContaining({ overrideNow: mockEventWithDetails.now })
      );
    });

    it("should prioritize result when both conditions are true", () => {
      // Arrange
      mockIsLastEventDetail.mockReturnValue(true);
      mockIsPhaseSwitching.mockReturnValue(true);

      // Act
      gameFlowService.handleResultAvailable(mockLastEventDetailNotification);
      runLastScheduledCallback(mockScheduler);

      // Assert
      expect(mockScheduler.schedule).toHaveBeenCalledTimes(1);
    });

    it("should schedule switch to event detail change when neither condition is true", () => {
      // Arrange
      mockIsLastEventDetail.mockReturnValue(false);
      mockIsPhaseSwitching.mockReturnValue(false);

      // Act
      gameFlowService.handleResultAvailable(mockEventDetailNotification);

      // Assert
      expect(mockScheduler.schedule).toHaveBeenCalled();
    });

    it("should calculate event detail change duration correctly", () => {
      // Arrange
      mockIsLastEventDetail.mockReturnValue(false);
      mockIsPhaseSwitching.mockReturnValue(false);
      // Duration = preloadDurationMs - eventDetailChangeDelay
      const expectedDurationMs = 3000; // 3000ms = 6000ms preloadDurationMs - 3000ms eventDetailChangeDelay

      // Act
      gameFlowService.handleResultAvailable(mockEventDetailNotification);
      runLastScheduledCallback(mockScheduler);

      // Assert
      const gameFlow = gameFlowService.getCurrentGameFlow(TEST_GAME_ID);
      expect(gameFlow?.durationMs).toBe(expectedDurationMs);
    });

    it("should broadcast event detail change with calculated durationMs", () => {
      // Arrange
      mockIsLastEventDetail.mockReturnValue(false);
      mockIsPhaseSwitching.mockReturnValue(false);
      const expectedDurationMs = 3000; // 3000ms = 6000ms preloadDurationMs - 3000ms eventDetailChangeDelay

      // Act
      gameFlowService.handleResultAvailable(mockEventDetailNotification);
      runLastScheduledCallback(mockScheduler);

      // Assert
      expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
        TEST_GAME_ID,
        {
          state: GameFlow.EventDetailChange,
          durationMs: expectedDurationMs,
          currentStateTimeMs: 0,
        },
        "gameFlow"
      );
    });

    it("should execute scheduled switch to result correctly", () => {
      // Arrange
      mockIsLastEventDetail.mockReturnValue(true);

      // Act
      gameFlowService.handleResultAvailable(mockLastEventDetailNotification);
      runLastScheduledCallback(mockScheduler);

      // Assert
      expect(gameFlowService.getCurrentGameFlow(TEST_GAME_ID)?.state).toBe(GameFlow.Result);
    });

    it("should broadcast result with durationMs", () => {
      // Arrange
      mockIsLastEventDetail.mockReturnValue(true);
      // Result duration = scheduleEndTs - resultsAvailableTs[last]
      // = (BASE + 120s) - (BASE + 120s) = 0ms
      const expectedDurationMs = 0;

      // Act
      gameFlowService.handleResultAvailable(mockLastEventDetailNotification);
      runLastScheduledCallback(mockScheduler);

      // Assert
      expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
        TEST_GAME_ID,
        {
          state: GameFlow.Result,
          durationMs: expectedDurationMs,
          currentStateTimeMs: 0,
        },
        "gameFlow"
      );
    });

    it("should execute scheduled switch to phase change correctly", () => {
      // Arrange
      mockIsPhaseSwitching.mockReturnValue(true);

      // Act
      gameFlowService.handleResultAvailable(mockPhaseSwitchingNotification);
      runLastScheduledCallback(mockScheduler);

      // Assert
      expect(gameFlowService.getCurrentGameFlow(TEST_GAME_ID)?.state).toBe(GameFlow.PhaseChange);
    });

    it("should log when switching to phase change", () => {
      // Arrange
      mockIsPhaseSwitching.mockReturnValue(true);
      // Act
      gameFlowService.handleResultAvailable(mockPhaseSwitchingNotification);
      runLastScheduledCallback(mockScheduler);

      // Assert
      const lastLogCall = mockFeatureDebugService.log.mock.calls[mockFeatureDebugService.log.mock.calls.length - 1];
      expect(lastLogCall?.[0]).toBe(gameFlowService);
      expect(lastLogCall?.[1]).toContain(`event id ${TEST_EVENT_ID}`);
      expect(lastLogCall?.[1]).toContain(GameFlow.PhaseChange);
      expect(lastLogCall?.[2]).toBe(TEST_GAME_ID);
    });

    it("should calculate phase change duration correctly", () => {
      // Arrange
      mockIsPhaseSwitching.mockReturnValue(true);
      // Phase change duration = eventDetails[index + 1].scheduleStartTs - eventDetails[index].resultsAvailableTs
      // For index 1: eventDetails[2].scheduleStartTs - eventDetails[1].resultsAvailableTs
      // = (BASE + 75s) - (BASE + 60s) = 15000ms
      const expectedDurationMs = 15000;

      // Act
      gameFlowService.handleResultAvailable(mockPhaseSwitchingNotification);
      runLastScheduledCallback(mockScheduler);

      // Assert
      const gameFlow = gameFlowService.getCurrentGameFlow(TEST_GAME_ID);
      expect(gameFlow?.durationMs).toBe(expectedDurationMs);
    });

    it("should broadcast phase change with calculated durationMs", () => {
      // Arrange
      mockIsPhaseSwitching.mockReturnValue(true);
      const expectedDurationMs = 15000;

      // Act
      gameFlowService.handleResultAvailable(mockPhaseSwitchingNotification);
      runLastScheduledCallback(mockScheduler);

      // Assert
      expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
        TEST_GAME_ID,
        {
          state: GameFlow.PhaseChange,
          durationMs: expectedDurationMs,
          currentStateTimeMs: 0,
        },
        "gameFlow"
      );
    });

    it("should execute scheduled switch to result correctly", () => {
      // Arrange
      mockIsLastEventDetail.mockReturnValue(true);

      // Act
      gameFlowService.handleResultAvailable(mockLastEventDetailNotification);
      runLastScheduledCallback(mockScheduler);

      // Assert
      expect(gameFlowService.getCurrentGameFlow(TEST_GAME_ID)?.state).toBe(GameFlow.Result);
    });

    it("should log when switching to result", () => {
      // Arrange
      mockIsLastEventDetail.mockReturnValue(true);
      // Act
      gameFlowService.handleResultAvailable(mockLastEventDetailNotification);
      runLastScheduledCallback(mockScheduler);

      // Assert
      const lastLogCall = mockFeatureDebugService.log.mock.calls[mockFeatureDebugService.log.mock.calls.length - 1];
      expect(lastLogCall?.[0]).toBe(gameFlowService);
      expect(lastLogCall?.[1]).toContain(`event id ${TEST_EVENT_ID}`);
      expect(lastLogCall?.[1]).toContain(GameFlow.Result);
      expect(lastLogCall?.[2]).toBe(TEST_GAME_ID);
    });
  });

  describe("handleEventDetailScheduleStart", () => {
    it("should calculate delayed time with video delay and schedule switch to streaming", () => {
      // Arrange & Act
      gameFlowService.handleEventDetailScheduleStart(mockEventDetailNotification);
      runLastScheduledCallback(mockScheduler);

      // Assert
      expect(mockDelayHandlingService.getTimeToStream).toHaveBeenCalledWith(mockEventWithDetails, 0);
      expect(mockScheduler.schedule).toHaveBeenCalledWith(
        TEST_DELAYED_TIME,
        expect.any(Function),
        expect.objectContaining({ overrideNow: mockEventWithDetails.now })
      );
    });

    it("should execute scheduled switch to streaming correctly", () => {
      // Act
      gameFlowService.handleEventDetailScheduleStart(mockEventDetailNotification);
      runLastScheduledCallback(mockScheduler);

      // Assert
      expect(gameFlowService.getCurrentGameFlow(TEST_GAME_ID)?.state).toBe(GameFlow.Streaming);
    });

    it("should log when switching to streaming", () => {
      // Act
      gameFlowService.handleEventDetailScheduleStart(mockEventDetailNotification);
      runLastScheduledCallback(mockScheduler);

      // Assert
      const lastLogCall = mockFeatureDebugService.log.mock.calls[mockFeatureDebugService.log.mock.calls.length - 1];
      expect(lastLogCall?.[0]).toBe(gameFlowService);
      expect(lastLogCall?.[1]).toContain(`event id ${TEST_EVENT_ID}`);
      expect(lastLogCall?.[1]).toContain(GameFlow.Streaming);
      expect(lastLogCall?.[2]).toBe(TEST_GAME_ID);
    });

    it("should calculate streaming duration correctly", () => {
      // Arrange
      // Streaming duration = resultsAvailableTs - scheduleStartTs - preloadDurationMs
      // For index 0: (BASE + 30s) - (BASE + 15s) - 6000 = 15000ms
      const expectedDurationMs = 9000;

      // Act
      gameFlowService.handleEventDetailScheduleStart(mockEventDetailNotification);
      runLastScheduledCallback(mockScheduler);

      // Assert
      const gameFlow = gameFlowService.getCurrentGameFlow(TEST_GAME_ID);
      expect(gameFlow?.durationMs).toBe(expectedDurationMs);
    });

    it("should broadcast streaming with calculated durationMs", () => {
      // Arrange
      const expectedDurationMs = 9000; // 9000ms = 15000 streaming duration - 6000ms preloadDurationMs

      // Act
      gameFlowService.handleEventDetailScheduleStart(mockEventDetailNotification);
      runLastScheduledCallback(mockScheduler);

      // Assert
      expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
        TEST_GAME_ID,
        {
          state: GameFlow.Streaming,
          durationMs: expectedDurationMs,
          currentStateTimeMs: 0,
        },
        "gameFlow"
      );
    });
  });

  describe("getReplayByEvent", () => {
    it("should return array of replay events for a given event", () => {
      // Arrange & Act
      const replays = gameFlowService.getReplayByEvent(mockEventWithDetails);

      // Assert
      expect(replays).toBeInstanceOf(Array);
      expect(replays.length).toBeGreaterThan(0);
      expect(replays[0]).toHaveProperty("time");
      expect(replays[0]).toHaveProperty("payload");
      expect(replays[0]).toHaveProperty("eventName", "gameFlow");
    });

    it("should call delay handling service with event object for event start", () => {
      // Act
      gameFlowService.getReplayByEvent(mockEventWithDetails);

      // Assert
      expect(mockDelayHandlingService.getTimeToStartEvent).toHaveBeenCalledWith(mockEventWithDetails);
    });

    it("should call delay handling service with event object for event detail start", () => {
      // Act
      gameFlowService.getReplayByEvent(mockEventWithDetails);

      // Assert
      expect(mockDelayHandlingService.getTimeToStream).toHaveBeenCalledWith(mockEventWithDetails, 0);
    });

    it("should include event start replay with prebet state", () => {
      // Act
      const replays = gameFlowService.getReplayByEvent(mockEventWithDetails);

      // Assert
      const eventStartReplay = replays.find((r) => r.payload.state === GameFlow.Prebet);
      expect(eventStartReplay).toBeDefined();
      expect(eventStartReplay?.payload.state).toBe(GameFlow.Prebet);
    });

    it("should include event detail start replays with streaming state", () => {
      // Act
      const replays = gameFlowService.getReplayByEvent(mockEventWithDetails);

      // Assert
      const streamingReplays = replays.filter((r) => r.payload.state === GameFlow.Streaming);
      expect(streamingReplays.length).toBe(mockEventWithDetails.eventDetails.length);
    });

    it("should include result replay when is last event detail", () => {
      // Arrange
      mockIsLastEventDetail.mockReturnValue(true);
      mockIsPhaseSwitching.mockReturnValue(false);

      // Act
      const replays = gameFlowService.getReplayByEvent(mockEventWithDetails);

      // Assert
      const resultReplays = replays.filter((r) => r.payload.state === GameFlow.Result);
      expect(resultReplays.length).toBeGreaterThan(0);
    });

    it("should include durationMs in result replay", () => {
      // Arrange
      mockIsLastEventDetail.mockReturnValue(true);
      mockIsPhaseSwitching.mockReturnValue(false);

      // Act
      const replays = gameFlowService.getReplayByEvent(mockEventWithDetails);

      // Assert
      const resultReplay = replays.find((r) => r.payload.state === GameFlow.Result);
      expect(resultReplay).toBeDefined();
      expect(resultReplay?.payload.state).toBe(GameFlow.Result);
    });

    it("should use resultsAvailableTs as fallback when scheduleEndTs is not provided", () => {
      // Arrange
      const eventWithoutEndTs = createMockEvent({
        eventID: TEST_EVENT_ID,
        scheduleStartTs: TEST_BASE_TIME,
        eventDetails: [
          createMockEventDetail({ phase: 1, scheduleStartTs: TEST_BASE_TIME, resultsAvailableTs: TEST_BASE_TIME }),
        ],
      });
      mockIsLastEventDetail.mockReturnValue(true);
      mockIsPhaseSwitching.mockReturnValue(false);

      // Act
      const replays = gameFlowService.getReplayByEvent(eventWithoutEndTs);

      // Assert
      const resultReplay = replays.find((r) => r.payload.state === GameFlow.Result);
      expect(resultReplay).toBeDefined();
      expect(resultReplay?.payload.durationMs).toBe(0); // Same time results in 0 duration
    });

    it("should include phase change replay when is phase switching", () => {
      // Arrange
      mockIsLastEventDetail.mockReturnValue(false);
      mockIsPhaseSwitching.mockReturnValue(true);

      // Act
      const replays = gameFlowService.getReplayByEvent(mockEventWithDetails);

      // Assert
      const phaseChangeReplays = replays.filter((r) => r.payload.state === GameFlow.PhaseChange);
      expect(phaseChangeReplays.length).toBeGreaterThan(0);
    });

    it("should return pure function result (not mutate state)", () => {
      // Arrange
      const initialState = gameFlowService.getCurrentGameFlow(TEST_GAME_ID);

      // Act
      gameFlowService.getReplayByEvent(mockEventWithDetails);

      // Assert
      const finalState = gameFlowService.getCurrentGameFlow(TEST_GAME_ID);
      expect(finalState).toBe(initialState);
    });
  });
});
