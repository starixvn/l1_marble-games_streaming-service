import { TeamNameService, TeamNameState, TeamNameServiceContainer } from "../../../../src/features/team-name/team-name-service";
import { OddsFeedEventSource, OddsFeedEventName, EventNotification } from "odds-feed-client";
import { DelayHandlingService } from "../../../../src/features/delay/delay-handling-service";
import { Scheduler } from "odds-feed-client";
import { GameBroadcastService } from "../../../../src/services/game-broadcast.service";
import { FeatureDebugService } from "../../../../src/features/feature-debug/feature-debug-service";
import { idHelper } from "../../../../src/helpers";
import { createMockEvent } from "../../test-utils/mock-event";

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

// Mock dependencies
const mockOddsFeedEventSource = {
    eventOn: jest.fn(),
    eventOff: jest.fn(),
} as unknown as jest.Mocked<OddsFeedEventSource>;

const mockDelayHandlingService = {
    getDelayedTime: jest.fn(),
} as unknown as jest.Mocked<DelayHandlingService>;

const mockScheduler = {
    schedule: jest.fn().mockReturnValue('scheduled-id'),
} as unknown as jest.Mocked<Scheduler>;

const mockGameBroadcastService = {
    broadcastToAllClientByGameId: jest.fn(),
} as unknown as jest.Mocked<GameBroadcastService>;

const mockFeatureDebugService = {
    log: jest.fn(),
} as unknown as jest.Mocked<FeatureDebugService>;

// Test constants
const TEST_DELAYED_TIME = new Date('2023-01-01T10:05:00Z');
const TEST_GAME_ID = '1';
const TEST_GAME_ID_2 = '2';
const TEST_EVENT_ID = 4294967298; // gameId: 1, roundId: 2
const TEST_EVENT_ID_2 = 8589934594; // gameId: 2, roundId: 2
const TEST_SCHEDULE_START_TS = "2023-01-01T10:00:00Z";
const TEST_HOME_TEAM_NAME = "Team A";
const TEST_AWAY_TEAM_NAME = "Team B";

// Test data using shared mock utils
const mockEvent = createMockEvent({
    eventID: TEST_EVENT_ID,
    eventNameAKey: TEST_HOME_TEAM_NAME,
    eventNameBKey: TEST_AWAY_TEAM_NAME,
    scheduleStartTs: TEST_SCHEDULE_START_TS,
});

const mockEvent2 = createMockEvent({
    eventID: TEST_EVENT_ID_2,
    eventNameAKey: "Team C",
    eventNameBKey: "Team D",
    scheduleStartTs: "2023-01-01T11:00:00Z",
});

const mockEventNotification: EventNotification = {
    event: mockEvent
};

const mockEventNotification2: EventNotification = {
    event: mockEvent2
};

// Helper functions for test setup
const createContainer = (): TeamNameServiceContainer => ({
    oddsFeedEventSource: mockOddsFeedEventSource,
    scheduler: mockScheduler,
    gameBroadcastService: mockGameBroadcastService,
    delayHandlingService: mockDelayHandlingService,
    featureDebugService: mockFeatureDebugService,
});

const setupMocks = () => {
    jest.clearAllMocks();
    mockDelayHandlingService.getDelayedTime.mockReturnValue(TEST_DELAYED_TIME);
};

describe('TeamNameService', () => {
    let teamNameService: TeamNameService;
    let container: TeamNameServiceContainer;

    beforeEach(() => {
        setupMocks();
        container = createContainer();
        teamNameService = new TeamNameService(container);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with all dependencies and bind event handlers', () => {
            // Arrange & Act
            const service = new TeamNameService(container);

            // Assert
            expect(service['oddsFeedEventSource']).toBe(mockOddsFeedEventSource);
            expect(service['scheduler']).toBe(mockScheduler);
            expect(service['gameBroadcastService']).toBe(mockGameBroadcastService);
            expect(service['delayHandlingService']).toBe(mockDelayHandlingService);
            expect(service['featureDebugService']).toBe(mockFeatureDebugService);
            expect(service['boundHandleEventStart']).toBeInstanceOf(Function);
        });

        it('should initialize empty team name tracking object', () => {
            // Arrange & Act
            const service = new TeamNameService(container);

            // Assert
            expect(service['teamNameByGameId']).toEqual({});
        });
    });

    describe('eventName', () => {
        it('should return "teamName"', () => {
            // Act
            const result = teamNameService.eventName;

            // Assert
            expect(result).toBe('teamName');
        });
    });

    describe('getCurrentByGameId', () => {
        it('should return team name state for existing game', () => {
            // Arrange
            const expectedState: TeamNameState = {
                homeTeamName: TEST_HOME_TEAM_NAME,
                awayTeamName: TEST_AWAY_TEAM_NAME
            };
            teamNameService['teamNameByGameId'][TEST_GAME_ID] = expectedState;

            // Act
            const result = teamNameService.getCurrentByGameId(TEST_GAME_ID);

            // Assert
            expect(result).toBe(expectedState);
        });

        it('should return undefined for non-existing game', () => {
            // Act
            const result = teamNameService.getCurrentByGameId('999');

            // Assert
            expect(result).toBeUndefined();
        });

        it('should return different states for different games', () => {
            // Arrange
            const state1: TeamNameState = {
                homeTeamName: "Home Team 1",
                awayTeamName: "Away Team 1"
            };
            const state2: TeamNameState = {
                homeTeamName: "Home Team 2",
                awayTeamName: "Away Team 2"
            };
            teamNameService['teamNameByGameId'][TEST_GAME_ID] = state1;
            teamNameService['teamNameByGameId'][TEST_GAME_ID_2] = state2;

            // Act
            const result1 = teamNameService.getCurrentByGameId(TEST_GAME_ID);
            const result2 = teamNameService.getCurrentByGameId(TEST_GAME_ID_2);

            // Assert
            expect(result1).toBe(state1);
            expect(result2).toBe(state2);
        });
    });

    describe('initEvent', () => {
        it('should register event listener for EventStart', () => {
            // Arrange & Act
            teamNameService.initEvent();

            // Assert
            expect(mockOddsFeedEventSource.eventOn).toHaveBeenCalledWith(
                OddsFeedEventName.EventStart,
                teamNameService['boundHandleEventStart']
            );
        });
    });

    describe('dispose', () => {
        it('should unregister event listener for EventStart', () => {
            // Arrange & Act
            teamNameService.dispose();

            // Assert
            expect(mockOddsFeedEventSource.eventOff).toHaveBeenCalledWith(
                OddsFeedEventName.EventStart,
                teamNameService['boundHandleEventStart']
            );
        });
    });

    describe('handleEventStart', () => {
        it('should calculate delayed time and schedule team name update', () => {
            // Act
            teamNameService.handleEventStart(mockEventNotification);

            // Assert
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledWith({
                event: mockEvent,
                time: new Date(mockEvent.scheduleStartTs)
            }, {
                oddsFeedEventType: OddsFeedEventName.EventStart,
            });
            expect(mockScheduler.schedule).toHaveBeenCalledWith(
                TEST_DELAYED_TIME,
                expect.any(Function)
            );
        });

        it('should schedule the correct bound method for team name update', () => {
            // Act
            teamNameService.handleEventStart(mockEventNotification);

            // Get the scheduled callback and execute it
            const scheduleCalls = mockScheduler.schedule.mock.calls;
            const scheduledFunction = scheduleCalls[0][1];
            scheduledFunction();

            // Assert
            expect(mockScheduler.schedule).toHaveBeenCalledTimes(1);
            // Verify the scheduled function updates the team name state
            expect(teamNameService['teamNameByGameId'][TEST_GAME_ID]).toEqual({
                homeTeamName: TEST_HOME_TEAM_NAME,
                awayTeamName: TEST_AWAY_TEAM_NAME
            });
        });

        it('should handle different events correctly', () => {
            // Act
            teamNameService.handleEventStart(mockEventNotification);
            teamNameService.handleEventStart(mockEventNotification2);

            // Assert
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledTimes(2);
            expect(mockScheduler.schedule).toHaveBeenCalledTimes(2);
        });
    });

    describe('handleTeamNameUpdate', () => {
        it('should update team name state and broadcast to clients', () => {
            // Act
            teamNameService.handleTeamNameUpdate(mockEventNotification);

            // Assert
            expect(teamNameService['teamNameByGameId'][TEST_GAME_ID]).toEqual({
                homeTeamName: TEST_HOME_TEAM_NAME,
                awayTeamName: TEST_AWAY_TEAM_NAME
            });
            expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                TEST_GAME_ID,
                teamNameService.getCurrentByGameId(TEST_GAME_ID),
                teamNameService.eventName
            );
        });

        it('should extract correct game ID using idHelper', () => {
            // Arrange
            const extractGameIdSpy = jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID);

            // Act
            teamNameService.handleTeamNameUpdate(mockEventNotification);

            // Assert
            expect(extractGameIdSpy).toHaveBeenCalledWith(TEST_EVENT_ID);
            expect(teamNameService['teamNameByGameId'][TEST_GAME_ID]).toBeDefined();
            
            extractGameIdSpy.mockRestore();
        });

        it('should handle empty team names', () => {
            // Arrange
            const eventWithEmptyNames = createMockEvent({
                eventID: TEST_EVENT_ID,
                eventNameAKey: "",
                eventNameBKey: "",
                scheduleStartTs: TEST_SCHEDULE_START_TS,
            });
            const notification: EventNotification = {
                event: eventWithEmptyNames
            };

            // Act
            teamNameService.handleTeamNameUpdate(notification);

            // Assert
            expect(teamNameService['teamNameByGameId'][TEST_GAME_ID]).toEqual({
                homeTeamName: "",
                awayTeamName: ""
            });
        });


        it('should overwrite existing team names for the same game', () => {
            // Arrange
            teamNameService['teamNameByGameId'][TEST_GAME_ID] = {
                homeTeamName: "Old Home Team",
                awayTeamName: "Old Away Team"
            };

            // Act
            teamNameService.handleTeamNameUpdate(mockEventNotification);

            // Assert
            expect(teamNameService['teamNameByGameId'][TEST_GAME_ID]).toEqual({
                homeTeamName: TEST_HOME_TEAM_NAME,
                awayTeamName: TEST_AWAY_TEAM_NAME
            });
        });

        it('should handle multiple games independently', () => {
            // Act
            teamNameService.handleTeamNameUpdate(mockEventNotification);
            teamNameService.handleTeamNameUpdate(mockEventNotification2);

            // Assert
            expect(teamNameService['teamNameByGameId'][TEST_GAME_ID]).toEqual({
                homeTeamName: TEST_HOME_TEAM_NAME,
                awayTeamName: TEST_AWAY_TEAM_NAME
            });
            expect(teamNameService['teamNameByGameId'][TEST_GAME_ID_2]).toEqual({
                homeTeamName: "Team C",
                awayTeamName: "Team D"
            });
            expect(Object.keys(teamNameService['teamNameByGameId'])).toHaveLength(2);
        });

        it('should call broadcastTeamName after updating state', () => {
            // Arrange
            const broadcastSpy = jest.spyOn(teamNameService as any, 'broadcastTeamName');

            // Act
            teamNameService.handleTeamNameUpdate(mockEventNotification);

            // Assert
            expect(broadcastSpy).toHaveBeenCalledWith({ gameId: TEST_GAME_ID });
            
            broadcastSpy.mockRestore();
        });
    });

    describe('broadcastTeamName', () => {
        beforeEach(() => {
            // Set up team name state for testing
            teamNameService['teamNameByGameId'][TEST_GAME_ID] = {
                homeTeamName: TEST_HOME_TEAM_NAME,
                awayTeamName: TEST_AWAY_TEAM_NAME
            };
        });

        it('should broadcast current team name state to clients', () => {
            // Act
            teamNameService['broadcastTeamName']({ gameId: TEST_GAME_ID });

            // Assert
            expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                TEST_GAME_ID,
                teamNameService.getCurrentByGameId(TEST_GAME_ID),
                teamNameService.eventName
            );
        });

        it('should call debug log with JSON stringified team names', () => {
            // Act
            teamNameService['broadcastTeamName']({ gameId: TEST_GAME_ID });

            // Assert
            const expectedState = {
                homeTeamName: TEST_HOME_TEAM_NAME,
                awayTeamName: TEST_AWAY_TEAM_NAME
            };
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                teamNameService,
                `broadcast team name ${JSON.stringify(expectedState)}`,
                TEST_GAME_ID
            );
        });

        it('should handle empty team name state', () => {
            // Arrange
            teamNameService['teamNameByGameId'][TEST_GAME_ID] = {
                homeTeamName: "",
                awayTeamName: ""
            };

            // Act
            teamNameService['broadcastTeamName']({ gameId: TEST_GAME_ID });

            // Assert
            const expectedState = { homeTeamName: "", awayTeamName: "" };
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                teamNameService,
                `broadcast team name ${JSON.stringify(expectedState)}`,
                TEST_GAME_ID
            );
            expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                TEST_GAME_ID,
                expectedState,
                teamNameService.eventName
            );
        });

        it('should handle undefined team name state', () => {
            // Arrange
            delete teamNameService['teamNameByGameId'][TEST_GAME_ID];

            // Act
            teamNameService['broadcastTeamName']({ gameId: TEST_GAME_ID });

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                teamNameService,
                `broadcast team name undefined`,
                TEST_GAME_ID
            );
            expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                TEST_GAME_ID,
                undefined,
                teamNameService.eventName
            );
        });
    });

    describe('log', () => {
        it('should call featureDebugService.log with correct parameters', () => {
            // Arrange
            const message = 'test message';
            const gameId = TEST_GAME_ID;

            // Act
            teamNameService['log'](message, gameId);

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                teamNameService,
                message,
                gameId
            );
        });

        it('should handle empty message', () => {
            // Arrange
            const message = '';
            const gameId = TEST_GAME_ID;

            // Act
            teamNameService['log'](message, gameId);

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                teamNameService,
                message,
                gameId
            );
        });

        it('should handle different game IDs', () => {
            // Arrange
            const message = 'test message';

            // Act
            teamNameService['log'](message, TEST_GAME_ID);
            teamNameService['log'](message, TEST_GAME_ID_2);

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledTimes(2);
            expect(mockFeatureDebugService.log).toHaveBeenNthCalledWith(
                1,
                teamNameService,
                message,
                TEST_GAME_ID
            );
            expect(mockFeatureDebugService.log).toHaveBeenNthCalledWith(
                2,
                teamNameService,
                message,
                TEST_GAME_ID_2
            );
        });
    });

    describe('edge cases', () => {
        it('should maintain correct context when bound methods are called directly', () => {
            // Arrange
            const boundHandleEventStart = teamNameService['boundHandleEventStart'];

            // Act - Call bound method directly (as it would be called by event emitter)
            boundHandleEventStart(mockEventNotification);

            // Assert
            expect(mockScheduler.schedule).toHaveBeenCalledTimes(1);
        });

        it('should handle multiple events for the same game', () => {
            // Arrange
            const event1 = createMockEvent({
                eventID: TEST_EVENT_ID,
                eventNameAKey: "First Team A",
                eventNameBKey: "First Team B",
            });
            const event2 = createMockEvent({
                eventID: TEST_EVENT_ID, // Same event ID (same game)
                eventNameAKey: "Second Team A",
                eventNameBKey: "Second Team B",
            });

            // Act
            teamNameService.handleTeamNameUpdate({ event: event1 });
            teamNameService.handleTeamNameUpdate({ event: event2 });

            // Assert - Latest event should overwrite previous state
            expect(teamNameService['teamNameByGameId'][TEST_GAME_ID]).toEqual({
                homeTeamName: "Second Team A",
                awayTeamName: "Second Team B"
            });
        });

        it('should handle very long team names', () => {
            // Arrange
            const longHomeName = "A".repeat(1000);
            const longAwayName = "B".repeat(1000);
            const eventWithLongNames = createMockEvent({
                eventID: TEST_EVENT_ID,
                eventNameAKey: longHomeName,
                eventNameBKey: longAwayName,
            });
            const notification: EventNotification = {
                event: eventWithLongNames
            };

            // Act
            teamNameService.handleTeamNameUpdate(notification);

            // Assert
            expect(teamNameService['teamNameByGameId'][TEST_GAME_ID]).toEqual({
                homeTeamName: longHomeName,
                awayTeamName: longAwayName
            });
        });

        it('should handle special characters in team names', () => {
            // Arrange
            const specialHomeName = "Team A & B (2023) - 🏆";
            const specialAwayName = "Team C/D [Winners] + More";
            const eventWithSpecialNames = createMockEvent({
                eventID: TEST_EVENT_ID,
                eventNameAKey: specialHomeName,
                eventNameBKey: specialAwayName,
            });
            const notification: EventNotification = {
                event: eventWithSpecialNames
            };

            // Act
            teamNameService.handleTeamNameUpdate(notification);

            // Assert
            expect(teamNameService['teamNameByGameId'][TEST_GAME_ID]).toEqual({
                homeTeamName: specialHomeName,
                awayTeamName: specialAwayName
            });
        });

        it('should handle JSON serialization in debug log correctly', () => {
            // Arrange
            const teamNamesWithSpecialChars = {
                homeTeamName: 'Team "A"',
                awayTeamName: "Team 'B'"
            };
            teamNameService['teamNameByGameId'][TEST_GAME_ID] = teamNamesWithSpecialChars;

            // Act
            teamNameService['broadcastTeamName']({ gameId: TEST_GAME_ID });

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                teamNameService,
                `broadcast team name ${JSON.stringify(teamNamesWithSpecialChars)}`,
                TEST_GAME_ID
            );
        });
    });

    describe('getReplayByEvent', () => {
        it('should return array of replay events for a given event', () => {
            // Arrange & Act
            const replays = teamNameService.getReplayByEvent(mockEvent);

            // Assert
            expect(replays).toBeInstanceOf(Array);
            expect(replays.length).toBeGreaterThan(0);
            expect(replays[0]).toHaveProperty('time');
            expect(replays[0]).toHaveProperty('payload');
            expect(replays[0]).toHaveProperty('eventName', 'teamName');
        });

        it('should call delay handling service with event object', () => {
            // Act
            teamNameService.getReplayByEvent(mockEvent);

            // Assert
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledWith(
                {
                    event: mockEvent,
                    time: new Date(mockEvent.scheduleStartTs)
                },
                {
                    oddsFeedEventType: OddsFeedEventName.EventStart,
                }
            );
        });

        it('should include team name replay with correct payload structure', () => {
            // Act
            const replays = teamNameService.getReplayByEvent(mockEvent);

            // Assert
            expect(replays.length).toBe(1);
            const teamNameReplay = replays[0];
            expect(teamNameReplay.payload).toHaveProperty('homeTeamName');
            expect(teamNameReplay.payload).toHaveProperty('awayTeamName');
            expect(teamNameReplay.payload.homeTeamName).toBe(mockEvent.eventNameAKey);
            expect(teamNameReplay.payload.awayTeamName).toBe(mockEvent.eventNameBKey);
        });

        it('should use delayed time from delay handling service', () => {
            // Arrange
            const expectedDelayedTime = new Date('2023-01-01T10:05:00Z');
            mockDelayHandlingService.getDelayedTime.mockReturnValue(expectedDelayedTime);

            // Act
            const replays = teamNameService.getReplayByEvent(mockEvent);

            // Assert
            expect(replays[0].time).toBe(expectedDelayedTime);
        });

        it('should handle events with empty team names', () => {
            // Arrange
            const eventWithEmptyNames = {
                ...mockEvent,
                eventNameAKey: "",
                eventNameBKey: ""
            };

            // Act
            const replays = teamNameService.getReplayByEvent(eventWithEmptyNames);

            // Assert
            expect(replays[0].payload).toEqual({
                homeTeamName: "",
                awayTeamName: ""
            });
        });

        it('should handle events with special characters in team names', () => {
            // Arrange
            const eventWithSpecialNames = {
                ...mockEvent,
                eventNameAKey: "Team \"A\"",
                eventNameBKey: "Team 'B'"
            };

            // Act
            const replays = teamNameService.getReplayByEvent(eventWithSpecialNames);

            // Assert
            expect(replays[0].payload).toEqual({
                homeTeamName: "Team \"A\"",
                awayTeamName: "Team 'B'"
            });
        });

        it('should return pure function result (not mutate state)', () => {
            // Arrange
            const initialStateKeys = Object.keys(teamNameService['teamNameByGameId']);

            // Act
            teamNameService.getReplayByEvent(mockEvent);

            // Assert
            const finalStateKeys = Object.keys(teamNameService['teamNameByGameId']);
            expect(finalStateKeys).toEqual(initialStateKeys);
        });
    });
});
