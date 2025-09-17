import { GameFlowService, GameFlow } from "../../../../src/features/game-flow/game-flow-service";
import { OddFeedEventSource, OddFeedEventName, EventNotification, EventDetailNotification } from "../../../../src/features/odd-feed-data";
import { DelayHandlingService } from "../../../../src/features/delay/delay-handling-service";
import { Scheduler } from "../../../../src/features/scheduler/scheduler";
import { GameBroadcastService } from "../../../../src/services/game-broadcast.service";
import { Event } from "../../../../src/types";
import { idHelper } from "../../../../src/helpers";
import { isLastEventDetail, isPhaseSwitching } from "../../../../src/helpers/phase-helper";

// Mock dependencies
const mockOddFeedEventSource = {
    registerEventListener: jest.fn(),
    unregisterEventListener: jest.fn(),
    registerEventDetailEventListener: jest.fn(),
    unregisterEventDetailEventListener: jest.fn(),
} as unknown as jest.Mocked<OddFeedEventSource>;

const mockScheduler = {
    schedule: jest.fn().mockReturnValue('scheduled-id'),
} as unknown as jest.Mocked<Scheduler>;

const mockDelayHandlingService = {
    getDelayedTime: jest.fn(),
    getDelayedTimeWithVideoDelay: jest.fn(),
} as unknown as jest.Mocked<DelayHandlingService>;

const mockGameBoardcastService = {
    broadcastToAllClientByGameId: jest.fn(),
} as unknown as jest.Mocked<GameBroadcastService>;

// Mock helper functions
jest.mock("../../../../src/helpers/phase-helper", () => ({
    isLastEventDetail: jest.fn(),
    isPhaseSwitching: jest.fn(),
}));

const mockIsLastEventDetail = isLastEventDetail as jest.MockedFunction<typeof isLastEventDetail>;
const mockIsPhaseSwitching = isPhaseSwitching as jest.MockedFunction<typeof isPhaseSwitching>;

// Test constants
const TEST_GAME_ID = '1';
const TEST_EVENT_ID = 4294967298; // gameId: 1, roundId: 2
const TEST_BASE_TIME = '2023-01-01T10:00:00Z';
const TEST_DELAYED_TIME = new Date('2023-01-01T10:05:00Z');

// Test data
const createMockEvent = (eventID: number, eventDetails: any[] = []): Event => ({
    eventID,
    eventNameAKey: "Team A",
    eventNameBKey: "Team B",
    scheduleStartTs: TEST_BASE_TIME,
    productCode: "TEST",
    productTypeKey: "MARBLE",
    eventDetails,
});

const createMockEventDetail = (phase = 1) => ({
    eventID: TEST_EVENT_ID,
    oddsAvailableTs: TEST_BASE_TIME,
    scheduleStartTs: TEST_BASE_TIME,
    resultsAvailableTs: TEST_BASE_TIME,
    hasResults: false,
    goalInfo: "{}",
    playlist: "playlist.m3u8",
    result: "",
    markets: {},
    inGameEventInfo: "{}",
    phase,
});

const mockEventWithDetails = createMockEvent(TEST_EVENT_ID, [
    createMockEventDetail(1),
    createMockEventDetail(2),
    createMockEventDetail(2),
]);

const mockEventNotification: EventNotification = {
    event: mockEventWithDetails
};

const mockEventDetailNotification: EventDetailNotification = {
    event: mockEventWithDetails,
    index: 0
};

const mockLastEventDetailNotification: EventDetailNotification = {
    event: mockEventWithDetails,
    index: 2 // Last index
};

const mockPhaseSwitchingNotification: EventDetailNotification = {
    event: mockEventWithDetails,
    index: 0 // Phase switches from 1 to 2
};


// Helper functions for test setup
const createContainer = () => ({
    oddFeedEventSource: mockOddFeedEventSource,
    scheduler: mockScheduler,
    delayHandlingService: mockDelayHandlingService,
    gameBoardcastService: mockGameBoardcastService,
});

const setupMocks = () => {
    jest.clearAllMocks();
    mockDelayHandlingService.getDelayedTime.mockReturnValue(TEST_DELAYED_TIME);
    mockDelayHandlingService.getDelayedTimeWithVideoDelay.mockReturnValue(TEST_DELAYED_TIME);
    mockIsLastEventDetail.mockReturnValue(false);
    mockIsPhaseSwitching.mockReturnValue(false);
    
    // Mock Date.now for consistent tracking
    jest.spyOn(Date, 'now').mockReturnValue(1000000);
};

describe('GameFlowService', () => {
    let gameFlowService: GameFlowService;
    let container: any;

    beforeEach(() => {
        setupMocks();
        container = createContainer();
        gameFlowService = new GameFlowService(container);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Constructor', () => {
        it('should initialize with all dependencies and bind event handlers', () => {
            // Arrange & Act
            const service = new GameFlowService(container);

            // Assert
            expect(service['oddFeedEventSource']).toBe(mockOddFeedEventSource);
            expect(service['scheduler']).toBe(mockScheduler);
            expect(service['delayHandlingService']).toBe(mockDelayHandlingService);
            expect(service['gameBoardcastService']).toBe(mockGameBoardcastService);
            expect(service['boundHandleEventStart']).toBeInstanceOf(Function);
            expect(service['boundHandleResultAvailable']).toBeInstanceOf(Function);
            expect(service['boundHandleEventDetailScheduleStart']).toBeInstanceOf(Function);
        });

        it('should initialize empty game flow and track point tracking objects', () => {
            // Arrange & Act
            const service = new GameFlowService(container);

            // Assert
            expect(service['_gameFlowByGameId']).toEqual({});
            expect(service['_trackPointByGameId']).toEqual({});
        });
    });

    describe('Event Listener Management', () => {
        describe('initEvent', () => {
            it('should register all required event listeners', () => {
                // Arrange & Act
                gameFlowService.initEvent();

                // Assert
                expect(mockOddFeedEventSource.registerEventListener).toHaveBeenCalledWith(
                    OddFeedEventName.EventStart,
                    gameFlowService['boundHandleEventStart']
                );
                expect(mockOddFeedEventSource.registerEventDetailEventListener).toHaveBeenCalledWith(
                    OddFeedEventName.EventDetailResultsAvailable,
                    gameFlowService['boundHandleResultAvailable']
                );
                expect(mockOddFeedEventSource.registerEventDetailEventListener).toHaveBeenCalledWith(
                    OddFeedEventName.EventDetailStart,
                    gameFlowService['boundHandleEventDetailScheduleStart']
                );
            });
        });

        describe('dispose', () => {
            it('should unregister all event listeners', () => {
                // Arrange & Act
                gameFlowService.dispose();

                // Assert
                expect(mockOddFeedEventSource.unregisterEventListener).toHaveBeenCalledWith(
                    OddFeedEventName.EventStart,
                    gameFlowService['boundHandleEventStart']
                );
                expect(mockOddFeedEventSource.unregisterEventDetailEventListener).toHaveBeenCalledWith(
                    OddFeedEventName.EventDetailResultsAvailable,
                    gameFlowService['boundHandleResultAvailable']
                );
                expect(mockOddFeedEventSource.unregisterEventDetailEventListener).toHaveBeenCalledWith(
                    OddFeedEventName.EventDetailStart,
                    gameFlowService['boundHandleEventDetailScheduleStart']
                );
            });
        });
    });

    describe('Game Flow State Management', () => {
        beforeEach(() => {
            // Set up some test game flow state
            gameFlowService['_gameFlowByGameId'][TEST_GAME_ID] = GameFlow.Streaming;
        });

        describe('getCurrentGameFlow', () => {
            it('should return game flow for existing game with current event', () => {
                // Arrange
                const gameId = TEST_GAME_ID;
                gameFlowService['_gameFlowByGameId'][gameId] = GameFlow.Streaming;

                // Act
                const result = gameFlowService.getCurrentGameFlow(gameId);

                // Assert
                expect(result).toBe(GameFlow.Streaming);
            });

            it('should return undefined when no current event exists', () => {
                // Arrange
                const gameId = '999'; // Non-existing game (not set up in beforeEach)

                // Act
                const result = gameFlowService.getCurrentGameFlow(gameId);

                // Assert
                expect(result).toBeUndefined();
            });

            it('should return undefined when current event has no game flow', () => {
                // Arrange
                const gameId = '888'; // Different non-existing game

                // Act
                const result = gameFlowService.getCurrentGameFlow(gameId);

                // Assert
                expect(result).toBeUndefined();
            });
        });

        describe('getCurrentByGameId', () => {
            it('should return game flow wrapped in object', () => {
                // Arrange
                const gameId = TEST_GAME_ID;
                gameFlowService['_gameFlowByGameId'][gameId] = GameFlow.Streaming;

                // Act
                const result = gameFlowService.getCurrentByGameId(gameId);

                // Assert
                expect(result).toEqual({
                    state: GameFlow.Streaming
                });
            });
        });

        describe('getTrackPointByGameId', () => {
            it('should return track point for existing game', () => {
                // Arrange
                const gameId = TEST_GAME_ID;
                const trackPoint = 123456;
                gameFlowService['_trackPointByGameId'][gameId] = trackPoint;

                // Act
                const result = gameFlowService.getTrackPointByGameId(gameId);

                // Assert
                expect(result).toBe(trackPoint);
            });

            it('should return undefined for non-existing game', () => {
                // Arrange
                const gameId = 'non-existent';

                // Act
                const result = gameFlowService.getTrackPointByGameId(gameId);

                // Assert
                expect(result).toBeUndefined();
            });
        });
    });

    describe('Event Handlers', () => {
        describe('handleEventStart', () => {
            it('should calculate delayed time and schedule switch to prebet', () => {
                // Arrange & Act
                gameFlowService.handleEventStart(mockEventNotification);

                // Assert
                expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledWith({
                    eventId: TEST_EVENT_ID,
                    time: new Date(mockEventWithDetails.scheduleStartTs)
                });
                expect(mockScheduler.schedule).toHaveBeenCalledWith(
                    TEST_DELAYED_TIME,
                    expect.any(Function)
                );
            });

            it('should schedule the correct bound method for switch to prebet', () => {
                // Act
                gameFlowService.handleEventStart(mockEventNotification);

                // Get the scheduled callback and execute it
                const scheduleCalls = mockScheduler.schedule.mock.calls;
                const scheduledFunction = scheduleCalls[0][1];
                scheduledFunction();

                // Assert
                expect(gameFlowService['_gameFlowByGameId'][TEST_GAME_ID]).toBe(GameFlow.Prebet);
                expect(gameFlowService['_trackPointByGameId'][TEST_GAME_ID]).toBe(1000000);
            });
        });

        describe('handleResultAvailable', () => {
            it('should schedule switch to result when is last event detail', () => {
                // Arrange
                mockIsLastEventDetail.mockReturnValue(true);

                // Act
                gameFlowService.handleResultAvailable(mockLastEventDetailNotification);

                // Assert
                expect(mockIsLastEventDetail).toHaveBeenCalledWith(mockLastEventDetailNotification);
                expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledWith({
                    eventId: TEST_EVENT_ID,
                    time: new Date(mockEventWithDetails.eventDetails[2].resultsAvailableTs)
                });
                expect(mockScheduler.schedule).toHaveBeenCalledWith(
                    TEST_DELAYED_TIME,
                    expect.any(Function)
                );
            });

            it('should schedule switch to half time when is phase switching', () => {
                // Arrange
                mockIsPhaseSwitching.mockReturnValue(true);

                // Act
                gameFlowService.handleResultAvailable(mockPhaseSwitchingNotification);

                // Assert
                expect(mockIsPhaseSwitching).toHaveBeenCalledWith(mockPhaseSwitchingNotification);
                expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledWith({
                    eventId: TEST_EVENT_ID,
                    time: new Date(mockEventWithDetails.eventDetails[0].resultsAvailableTs)
                });
                expect(mockScheduler.schedule).toHaveBeenCalledWith(
                    TEST_DELAYED_TIME,
                    expect.any(Function)
                );
            });

            it('should schedule both transitions when both conditions are true', () => {
                // Arrange
                mockIsLastEventDetail.mockReturnValue(true);
                mockIsPhaseSwitching.mockReturnValue(true);

                // Act
                gameFlowService.handleResultAvailable(mockLastEventDetailNotification);

                // Assert
                expect(mockScheduler.schedule).toHaveBeenCalledTimes(2);
            });

            it('should not schedule any transitions when neither condition is true', () => {
                // Arrange
                mockIsLastEventDetail.mockReturnValue(false);
                mockIsPhaseSwitching.mockReturnValue(false);

                // Act
                gameFlowService.handleResultAvailable(mockEventDetailNotification);

                // Assert
                expect(mockScheduler.schedule).not.toHaveBeenCalled();
            });

            it('should execute scheduled switch to result correctly', () => {
                // Arrange
                mockIsLastEventDetail.mockReturnValue(true);

                // Act
                gameFlowService.handleResultAvailable(mockLastEventDetailNotification);

                // Get the scheduled callback and execute it
                const scheduleCalls = mockScheduler.schedule.mock.calls;
                const scheduledFunction = scheduleCalls[0][1];
                scheduledFunction();

                // Assert
                expect(gameFlowService['_gameFlowByGameId'][TEST_GAME_ID]).toBe(GameFlow.Result);
            });

            it('should execute scheduled switch to half time correctly', () => {
                // Arrange
                mockIsPhaseSwitching.mockReturnValue(true);

                // Act
                gameFlowService.handleResultAvailable(mockPhaseSwitchingNotification);

                // Get the scheduled callback and execute it
                const scheduleCalls = mockScheduler.schedule.mock.calls;
                const scheduledFunction = scheduleCalls[0][1];
                scheduledFunction();

                // Assert
                expect(gameFlowService['_gameFlowByGameId'][TEST_GAME_ID]).toBe(GameFlow.HalfTime);
            });
        });

        describe('handleEventDetailScheduleStart', () => {
            it('should calculate delayed time with video delay and schedule switch to streaming', () => {
                // Arrange & Act
                gameFlowService.handleEventDetailScheduleStart(mockEventDetailNotification);

                // Assert
                expect(mockDelayHandlingService.getDelayedTimeWithVideoDelay).toHaveBeenCalledWith({
                    eventId: TEST_EVENT_ID,
                    time: new Date(mockEventWithDetails.eventDetails[0].scheduleStartTs)
                });
                expect(mockScheduler.schedule).toHaveBeenCalledWith(
                    TEST_DELAYED_TIME,
                    expect.any(Function)
                );
            });

            it('should execute scheduled switch to streaming correctly', () => {
                // Act
                gameFlowService.handleEventDetailScheduleStart(mockEventDetailNotification);

                // Get the scheduled callback and execute it
                const scheduleCalls = mockScheduler.schedule.mock.calls;
                const scheduledFunction = scheduleCalls[0][1];
                scheduledFunction();

                // Assert
                expect(gameFlowService['_gameFlowByGameId'][TEST_GAME_ID]).toBe(GameFlow.Streaming);
            });
        });

    });

    describe('Game Flow Transitions', () => {
        beforeEach(() => {
            // Set up track point
            gameFlowService['_trackPointByGameId'][TEST_GAME_ID] = 500000;
        });

        describe('switchToPrebet', () => {
            it('should set game flow to Prebet and update track point', () => {
                // Act
                gameFlowService['switchToPrebet']({ eventId: TEST_EVENT_ID });

                // Assert
                expect(gameFlowService['_gameFlowByGameId'][TEST_GAME_ID]).toBe(GameFlow.Prebet);
                expect(gameFlowService['_trackPointByGameId'][TEST_GAME_ID]).toBe(1000000);
            });
        });

        describe('switchToStreaming', () => {
            it('should set game flow to Streaming', () => {
                // Act
                gameFlowService['switchToStreaming']({ eventId: TEST_EVENT_ID });

                // Assert
                expect(gameFlowService['_gameFlowByGameId'][TEST_GAME_ID]).toBe(GameFlow.Streaming);
            });
        });

        describe('switchToHalfTime', () => {
            it('should set game flow to HalfTime', () => {
                // Act
                gameFlowService['switchToHalfTime']({ eventId: TEST_EVENT_ID });

                // Assert
                expect(gameFlowService['_gameFlowByGameId'][TEST_GAME_ID]).toBe(GameFlow.HalfTime);
            });
        });

        describe('switchToResult', () => {
            it('should set game flow to Result', () => {
                // Act
                gameFlowService['switchToResult']({ eventId: TEST_EVENT_ID });

                // Assert
                expect(gameFlowService['_gameFlowByGameId'][TEST_GAME_ID]).toBe(GameFlow.Result);
            });
        });

        describe('switchGameFlow', () => {
            it('should update game flow state and broadcast to clients', () => {
                // Act
                gameFlowService['switchGameFlow']({ eventId: TEST_EVENT_ID, gameFlow: GameFlow.Streaming });

                // Assert
                expect(gameFlowService['_gameFlowByGameId'][TEST_GAME_ID]).toBe(GameFlow.Streaming);
                expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                    TEST_GAME_ID,
                    {
                        state: GameFlow.Streaming,
                    },
                    gameFlowService.eventName
                );
            });

            it('should extract correct game ID using idHelper', () => {
                // Arrange
                const extractGameIdSpy = jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID);

                // Act
                gameFlowService['switchGameFlow']({ eventId: TEST_EVENT_ID, gameFlow: GameFlow.Result });

                // Assert
                expect(extractGameIdSpy).toHaveBeenCalledWith(TEST_EVENT_ID);
                expect(gameFlowService['_gameFlowByGameId'][TEST_GAME_ID]).toBe(GameFlow.Result);

                extractGameIdSpy.mockRestore();
            });

            it('should calculate and use time difference for logging', () => {
                // Arrange
                gameFlowService['_trackPointByGameId'][TEST_GAME_ID] = 500000; // 500 seconds ago
                const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

                // Act
                gameFlowService['switchGameFlow']({ eventId: TEST_EVENT_ID, gameFlow: GameFlow.Result });

                // Assert
                const expectedDiffInSeconds = (1000000 - 500000) / 1000;
                expect(consoleSpy).toHaveBeenCalledWith(
                    `\x1b[33m[GameFlowService] \x1b[37m: switch to \x1b[32m${GameFlow.Result}\x1b[37m for game ${TEST_GAME_ID} track time: ${expectedDiffInSeconds}`
                );

                consoleSpy.mockRestore();
            });
        });
    });

    describe('Edge Cases and Error Scenarios', () => {
        describe('Bound methods preservation', () => {
            it('should maintain correct context when bound methods are called directly', () => {
                // Arrange
                const boundHandleEventStart = gameFlowService['boundHandleEventStart'];
                const boundHandleResultAvailable = gameFlowService['boundHandleResultAvailable'];
                const boundHandleEventDetailScheduleStart = gameFlowService['boundHandleEventDetailScheduleStart'];

                mockIsLastEventDetail.mockReturnValue(true);

                // Act - Call bound methods directly (as they would be called by event emitter)
                boundHandleEventStart(mockEventNotification);
                boundHandleResultAvailable(mockLastEventDetailNotification);
                boundHandleEventDetailScheduleStart(mockEventDetailNotification);

                // Assert
                expect(mockScheduler.schedule).toHaveBeenCalledTimes(3);
            });
        });

        describe('Multiple events and games', () => {
            it('should handle multiple events for the same game', () => {
                // Arrange
                const event1 = TEST_EVENT_ID;
                const event2 = TEST_EVENT_ID + 1;
                const gameId = TEST_GAME_ID; // Both events belong to same game

                // Act
                gameFlowService['switchGameFlow']({ eventId: event1, gameFlow: GameFlow.Prebet });
                gameFlowService['switchGameFlow']({ eventId: event2, gameFlow: GameFlow.Streaming });

                // Assert - Both events update the same game's flow state (latest wins)
                expect(gameFlowService['_gameFlowByGameId'][gameId]).toBe(GameFlow.Streaming);
            });

            it('should handle multiple games independently', () => {
                // Arrange
                const game1EventId = TEST_EVENT_ID; // gameId: 1
                const game2EventId = 8589934594; // gameId: 2
                const game1Id = '1';
                const game2Id = '2';

                // Set up track points
                gameFlowService['_trackPointByGameId'][game1Id] = 100000;
                gameFlowService['_trackPointByGameId'][game2Id] = 200000;

                // Act
                gameFlowService['switchGameFlow']({ eventId: game1EventId, gameFlow: GameFlow.Streaming });
                gameFlowService['switchGameFlow']({ eventId: game2EventId, gameFlow: GameFlow.Result });

                // Assert
                expect(gameFlowService['_gameFlowByGameId'][game1Id]).toBe(GameFlow.Streaming);
                expect(gameFlowService['_gameFlowByGameId'][game2Id]).toBe(GameFlow.Result);
                expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(game1Id, { state: GameFlow.Streaming }, gameFlowService.eventName);
                expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(game2Id, { state: GameFlow.Result }, gameFlowService.eventName);
            });
        });

        describe('Helper function integration', () => {
            it('should correctly use isLastEventDetail helper', () => {
                // Arrange
                mockIsLastEventDetail.mockReturnValue(true);

                // Act
                gameFlowService.handleResultAvailable(mockEventDetailNotification);

                // Assert
                expect(mockIsLastEventDetail).toHaveBeenCalledWith(mockEventDetailNotification);
            });

            it('should correctly use isPhaseSwitching helper', () => {
                // Arrange
                mockIsPhaseSwitching.mockReturnValue(true);

                // Act
                gameFlowService.handleResultAvailable(mockEventDetailNotification);

                // Assert
                expect(mockIsPhaseSwitching).toHaveBeenCalledWith(mockEventDetailNotification);
            });
        });

        describe('Time calculations', () => {
            it('should handle missing track point gracefully', () => {
                // Arrange
                delete gameFlowService['_trackPointByGameId'][TEST_GAME_ID];
                const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

                // Act
                gameFlowService['switchGameFlow']({ eventId: TEST_EVENT_ID, gameFlow: GameFlow.Streaming });

                // Assert - Should not throw and should handle NaN gracefully
                expect(consoleSpy).toHaveBeenCalled();
                expect(gameFlowService['_gameFlowByGameId'][TEST_GAME_ID]).toBe(GameFlow.Streaming);

                consoleSpy.mockRestore();
            });
        });
    });
});
