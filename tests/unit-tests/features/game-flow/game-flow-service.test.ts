import { GameFlowService, GameFlow } from "../../../../src/features/game-flow/game-flow-service";
import { OddsFeedEventSource, OddsFeedEventName, EventNotification, EventDetailNotification } from "odds-feed-client";
import { DelayHandlingService } from "../../../../src/features/delay/delay-handling-service";
import { Scheduler } from "odds-feed-client";
import { GameBroadcastService } from "../../../../src/services/game-broadcast.service";
import { FeatureDebugService } from "../../../../src/features/feature-debug/feature-debug-service";
import { idHelper } from "../../../../src/helpers";
import { isLastEventDetail, isPhaseSwitching } from "../../../../src/helpers/phase-helper";
import { createMockEvent, createMockEventDetail } from "../../test-utils/mock-event";

// Mock dependencies
const mockOddsFeedEventSource = {
    eventOn: jest.fn(),
    eventOff: jest.fn(),
    eventDetailOn: jest.fn(),
    eventDetailOff: jest.fn(),
} as unknown as jest.Mocked<OddsFeedEventSource>;

const mockScheduler = {
    schedule: jest.fn().mockReturnValue('scheduled-id'),
} as unknown as jest.Mocked<Scheduler>;

const mockDelayHandlingService = {
    getDelayedTime: jest.fn(),
    getDelayedTimeWithVideoDelay: jest.fn(),
} as unknown as jest.Mocked<DelayHandlingService>;

const mockGameBroadcastService = {
    broadcastToAllClientByGameId: jest.fn(),
} as unknown as jest.Mocked<GameBroadcastService>;

const mockFeatureDebugService = {
    log: jest.fn(),
} as unknown as jest.Mocked<FeatureDebugService>;

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

// Test data using shared mock utils
const mockEventWithDetails = createMockEvent({
    eventID: TEST_EVENT_ID,
    scheduleStartTs: TEST_BASE_TIME,
    eventDetails: [
        createMockEventDetail({ phase: 1, scheduleStartTs: TEST_BASE_TIME, resultsAvailableTs: TEST_BASE_TIME }),
        createMockEventDetail({ phase: 2, scheduleStartTs: TEST_BASE_TIME, resultsAvailableTs: TEST_BASE_TIME }),
        createMockEventDetail({ phase: 2, scheduleStartTs: TEST_BASE_TIME, resultsAvailableTs: TEST_BASE_TIME }),
    ]
});

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
    oddsFeedEventSource: mockOddsFeedEventSource,
    scheduler: mockScheduler,
    delayHandlingService: mockDelayHandlingService,
    gameBroadcastService: mockGameBroadcastService,
    featureDebugService: mockFeatureDebugService,
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

    describe('constructor', () => {
        it('should initialize with all dependencies and bind event handlers', () => {
            // Arrange & Act
            const service = new GameFlowService(container);

            // Assert
            expect(service['oddsFeedEventSource']).toBe(mockOddsFeedEventSource);
            expect(service['scheduler']).toBe(mockScheduler);
            expect(service['delayHandlingService']).toBe(mockDelayHandlingService);
            expect(service['gameBroadcastService']).toBe(mockGameBroadcastService);
            expect(service['featureDebugService']).toBe(mockFeatureDebugService);
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

    describe('eventName', () => {
        it('should return "gameFlow"', () => {
            // Act
            const result = gameFlowService.eventName;

            // Assert
            expect(result).toBe('gameFlow');
        });
    });

    describe('initEvent', () => {
        it('should register all required event listeners', () => {
            // Arrange & Act
            gameFlowService.initEvent();

            // Assert
            expect(mockOddsFeedEventSource.eventOn).toHaveBeenCalledWith(
                OddsFeedEventName.EventStart,
                gameFlowService['boundHandleEventStart']
            );
            expect(mockOddsFeedEventSource.eventDetailOn).toHaveBeenCalledWith(
                OddsFeedEventName.EventDetailResultsAvailable,
                gameFlowService['boundHandleResultAvailable']
            );
            expect(mockOddsFeedEventSource.eventDetailOn).toHaveBeenCalledWith(
                OddsFeedEventName.EventDetailStart,
                gameFlowService['boundHandleEventDetailScheduleStart']
            );
        });
    });

    describe('dispose', () => {
        it('should unregister all event listeners', () => {
            // Arrange & Act
            gameFlowService.dispose();

            // Assert
            expect(mockOddsFeedEventSource.eventOff).toHaveBeenCalledWith(
                OddsFeedEventName.EventStart,
                gameFlowService['boundHandleEventStart']
            );
            expect(mockOddsFeedEventSource.eventDetailOff).toHaveBeenCalledWith(
                OddsFeedEventName.EventDetailResultsAvailable,
                gameFlowService['boundHandleResultAvailable']
            );
            expect(mockOddsFeedEventSource.eventDetailOff).toHaveBeenCalledWith(
                OddsFeedEventName.EventDetailStart,
                gameFlowService['boundHandleEventDetailScheduleStart']
            );
        });
    });

    describe('getCurrentGameFlow', () => {
        beforeEach(() => {
            // Set up some test game flow state
            gameFlowService['_gameFlowByGameId'][TEST_GAME_ID] = GameFlow.Streaming;
        });

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
            const gameId = '999'; // Non-existing game

            // Act
            const result = gameFlowService.getCurrentGameFlow(gameId);

            // Assert
            expect(result).toBeUndefined();
        });

        it('should return different game flows for different games', () => {
            // Arrange
            const gameId1 = '1';
            const gameId2 = '2';
            gameFlowService['_gameFlowByGameId'][gameId1] = GameFlow.Prebet;
            gameFlowService['_gameFlowByGameId'][gameId2] = GameFlow.Result;

            // Act
            const result1 = gameFlowService.getCurrentGameFlow(gameId1);
            const result2 = gameFlowService.getCurrentGameFlow(gameId2);

            // Assert
            expect(result1).toBe(GameFlow.Prebet);
            expect(result2).toBe(GameFlow.Result);
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

        it('should return undefined state for non-existing game', () => {
            // Arrange
            const gameId = 'non-existent';

            // Act
            const result = gameFlowService.getCurrentByGameId(gameId);

            // Assert
            expect(result).toEqual({
                state: undefined
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

        it('should return zero track point correctly', () => {
            // Arrange
            const gameId = TEST_GAME_ID;
            gameFlowService['_trackPointByGameId'][gameId] = 0;

            // Act
            const result = gameFlowService.getTrackPointByGameId(gameId);

            // Assert
            expect(result).toBe(0);
        });
    });

    describe('handleEventStart', () => {
        it('should calculate delayed time and schedule switch to prebet', () => {
            // Arrange & Act
            gameFlowService.handleEventStart(mockEventNotification);

            // Assert
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledWith({
                eventId: TEST_EVENT_ID,
                time: new Date(mockEventWithDetails.scheduleStartTs)
            }, {
                oddsFeedEventType: OddsFeedEventName.EventStart,
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
            }, {
                oddsFeedEventType: OddsFeedEventName.EventDetailResultsAvailable,
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
            }, {
                oddsFeedEventType: OddsFeedEventName.EventDetailResultsAvailable,
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
            }, {
                oddsFeedEventType: OddsFeedEventName.EventDetailStart,
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

    describe('switchToPrebet', () => {
        it('should set game flow to Prebet and update track point', () => {
            // Act
            gameFlowService['switchToPrebet']({ eventId: TEST_EVENT_ID });

            // Assert
            expect(gameFlowService['_gameFlowByGameId'][TEST_GAME_ID]).toBe(GameFlow.Prebet);
            expect(gameFlowService['_trackPointByGameId'][TEST_GAME_ID]).toBe(1000000);
        });

        it('should call debug log when switching to prebet', () => {
            // Act
            gameFlowService['switchToPrebet']({ eventId: TEST_EVENT_ID });

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                gameFlowService,
                'switch to \x1b[32mPrebet\x1b[37m',
                TEST_GAME_ID
            );
        });

        it('should extract game ID correctly', () => {
            // Arrange
            const extractGameIdSpy = jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID);

            // Act
            gameFlowService['switchToPrebet']({ eventId: TEST_EVENT_ID });

            // Assert
            expect(extractGameIdSpy).toHaveBeenCalledWith(TEST_EVENT_ID);
            
            extractGameIdSpy.mockRestore();
        });
    });

    describe('switchToStreaming', () => {
        it('should set game flow to Streaming', () => {
            // Act
            gameFlowService['switchToStreaming']({ eventId: TEST_EVENT_ID });

            // Assert
            expect(gameFlowService['_gameFlowByGameId'][TEST_GAME_ID]).toBe(GameFlow.Streaming);
        });

        it('should call debug log when switching to streaming', () => {
            // Act
            gameFlowService['switchToStreaming']({ eventId: TEST_EVENT_ID });

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                gameFlowService,
                'switch to \x1b[32mStreaming\x1b[37m',
                TEST_GAME_ID
            );
        });
    });

    describe('switchToHalfTime', () => {
        it('should set game flow to HalfTime', () => {
            // Act
            gameFlowService['switchToHalfTime']({ eventId: TEST_EVENT_ID });

            // Assert
            expect(gameFlowService['_gameFlowByGameId'][TEST_GAME_ID]).toBe(GameFlow.HalfTime);
        });

        it('should call debug log when switching to half time', () => {
            // Act
            gameFlowService['switchToHalfTime']({ eventId: TEST_EVENT_ID });

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                gameFlowService,
                'switch to \x1b[32mHalfTime\x1b[37m',
                TEST_GAME_ID
            );
        });
    });

    describe('switchToResult', () => {
        it('should set game flow to Result', () => {
            // Act
            gameFlowService['switchToResult']({ eventId: TEST_EVENT_ID });

            // Assert
            expect(gameFlowService['_gameFlowByGameId'][TEST_GAME_ID]).toBe(GameFlow.Result);
        });

        it('should call debug log when switching to result', () => {
            // Act
            gameFlowService['switchToResult']({ eventId: TEST_EVENT_ID });

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                gameFlowService,
                'switch to \x1b[32mResult\x1b[37m',
                TEST_GAME_ID
            );
        });
    });

    describe('switchGameFlow', () => {
        it('should update game flow state and broadcast to clients', () => {
            // Act
            gameFlowService['switchGameFlow']({ eventId: TEST_EVENT_ID, gameFlow: GameFlow.Streaming });

            // Assert
            expect(gameFlowService['_gameFlowByGameId'][TEST_GAME_ID]).toBe(GameFlow.Streaming);
            expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                TEST_GAME_ID,
                {
                    state: GameFlow.Streaming,
                },
                gameFlowService.eventName
            );
        });

        it('should call debug log with correct message and colors', () => {
            // Act
            gameFlowService['switchGameFlow']({ eventId: TEST_EVENT_ID, gameFlow: GameFlow.Streaming });

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                gameFlowService,
                'switch to \x1b[32mStreaming\x1b[37m',
                TEST_GAME_ID
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

        it('should handle all game flow states correctly', () => {
            // Test each game flow state
            const gameFlowStates = [GameFlow.Prebet, GameFlow.Streaming, GameFlow.HalfTime, GameFlow.Result];
            
            gameFlowStates.forEach((gameFlow, index) => {
                // Act
                gameFlowService['switchGameFlow']({ eventId: TEST_EVENT_ID, gameFlow });

                // Assert
                expect(gameFlowService['_gameFlowByGameId'][TEST_GAME_ID]).toBe(gameFlow);
                expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenNthCalledWith(
                    index + 1,
                    TEST_GAME_ID,
                    { state: gameFlow },
                    gameFlowService.eventName
                );
            });
        });
    });

    describe('delayedEventDetailResultAvailable', () => {
        it('should call delay handling service with correct parameters', () => {
            // Act
            gameFlowService['delayedEventDetailResultAvailable'](mockEventDetailNotification);

            // Assert
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledWith({
                eventId: TEST_EVENT_ID,
                time: new Date(mockEventWithDetails.eventDetails[0].resultsAvailableTs)
            }, {
                oddsFeedEventType: OddsFeedEventName.EventDetailResultsAvailable,
            });
        });

        it('should return delayed time from delay handling service', () => {
            // Act
            const result = gameFlowService['delayedEventDetailResultAvailable'](mockEventDetailNotification);

            // Assert
            expect(result).toBe(TEST_DELAYED_TIME);
        });
    });

    describe('delayedEventDetailtScheduleStartWithVideoDelay', () => {
        it('should call delay handling service with video delay and correct parameters', () => {
            // Act
            gameFlowService['delayedEventDetailtScheduleStartWithVideoDelay'](mockEventDetailNotification);

            // Assert
            expect(mockDelayHandlingService.getDelayedTimeWithVideoDelay).toHaveBeenCalledWith({
                eventId: TEST_EVENT_ID,
                time: new Date(mockEventWithDetails.eventDetails[0].scheduleStartTs)
            }, {
                oddsFeedEventType: OddsFeedEventName.EventDetailStart,
            });
        });

        it('should return delayed time from delay handling service', () => {
            // Act
            const result = gameFlowService['delayedEventDetailtScheduleStartWithVideoDelay'](mockEventDetailNotification);

            // Assert
            expect(result).toBe(TEST_DELAYED_TIME);
        });
    });

    describe('delayedEventScheduleStart', () => {
        it('should call delay handling service with correct parameters for event notification', () => {
            // Act
            gameFlowService['delayedEventScheduleStart'](mockEventNotification);

            // Assert
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledWith({
                eventId: TEST_EVENT_ID,
                time: new Date(mockEventWithDetails.scheduleStartTs)
            }, {
                oddsFeedEventType: OddsFeedEventName.EventStart,
            });
        });

        it('should call delay handling service with correct parameters for event detail notification', () => {
            // Act
            gameFlowService['delayedEventScheduleStart'](mockEventDetailNotification);

            // Assert
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledWith({
                eventId: TEST_EVENT_ID,
                time: new Date(mockEventWithDetails.scheduleStartTs)
            }, {
                oddsFeedEventType: OddsFeedEventName.EventStart,
            });
        });

        it('should return delayed time from delay handling service', () => {
            // Act
            const result = gameFlowService['delayedEventScheduleStart'](mockEventNotification);

            // Assert
            expect(result).toBe(TEST_DELAYED_TIME);
        });
    });

    describe('log', () => {
        it('should call featureDebugService.log with correct parameters', () => {
            // Arrange
            const message = 'test message';
            const gameId = TEST_GAME_ID;

            // Act
            gameFlowService['log'](message, gameId);

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                gameFlowService,
                message,
                gameId
            );
        });

        it('should handle empty message', () => {
            // Arrange
            const message = '';
            const gameId = TEST_GAME_ID;

            // Act
            gameFlowService['log'](message, gameId);

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                gameFlowService,
                message,
                gameId
            );
        });

        it('should handle different game IDs', () => {
            // Arrange
            const message = 'test message';
            const gameId1 = '1';
            const gameId2 = '2';

            // Act
            gameFlowService['log'](message, gameId1);
            gameFlowService['log'](message, gameId2);

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledTimes(2);
            expect(mockFeatureDebugService.log).toHaveBeenNthCalledWith(
                1,
                gameFlowService,
                message,
                gameId1
            );
            expect(mockFeatureDebugService.log).toHaveBeenNthCalledWith(
                2,
                gameFlowService,
                message,
                gameId2
            );
        });
    });

    describe('edge cases', () => {
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
            expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(game1Id, { state: GameFlow.Streaming }, gameFlowService.eventName);
            expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(game2Id, { state: GameFlow.Result }, gameFlowService.eventName);
        });

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

        it('should handle missing track point gracefully in getTrackPointByGameId', () => {
            // Arrange
            const gameId = 'missing-game';

            // Act
            const result = gameFlowService.getTrackPointByGameId(gameId);

            // Assert
            expect(result).toBeUndefined();
        });
    });
});