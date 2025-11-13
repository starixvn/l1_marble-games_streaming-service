import { IntroService } from "../../../../src/features/intro/intro-service";
import { OddsFeedEventSource, OddsFeedEventName, EventNotification, SystemNotification, Scheduler } from "odds-feed-client";
import { DelayHandlingService } from "../../../../src/features/delay/delay-handling-service";
import { GameBroadcastService } from "../../../../src/services/game-broadcast.service";
import { FeatureDebugService } from "../../../../src/features/feature-debug/feature-debug-service";
import { idHelper } from "../../../../src/helpers";
import { createMockEvent, createMockEventDetail } from "../../test-utils/mock-event";

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
    cleanupOn: jest.fn(),
    cleanupOff: jest.fn(),
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
const TEST_DELAYED_TIME_HALFTIME = new Date('2023-01-01T10:15:00Z');
const TEST_GAME_ID = '1';
const TEST_EVENT_ID = 4294967298; // gameId: 1, roundId: 2
const TEST_SCHEDULE_START_TS = "2023-01-01T10:00:00Z";
const TEST_DURATION = 30; // 30 seconds
const TEST_RESOURCE_SERVER = "https://example.com/intro";
const TEST_TIME_TO_PLAY = 1640995200000;

// Test data using shared mock utils
const mockEventWithIntroConfig = {
    ...createMockEvent({
        eventID: TEST_EVENT_ID,
        scheduleStartTs: TEST_SCHEDULE_START_TS,
        eventDetails: [
            createMockEventDetail({ 
                phase: 0,
                scheduleStartTs: TEST_SCHEDULE_START_TS
            }),
            createMockEventDetail({ 
                phase: 1,
                scheduleStartTs: "2023-01-01T10:20:00Z"
            }),
        ]
    }),
    config: {
        intro: {
            resourceServer: TEST_RESOURCE_SERVER,
            duration: TEST_DURATION
        }
    }
};

const mockEventWithoutIntroConfig = createMockEvent({
    eventID: TEST_EVENT_ID,
    scheduleStartTs: TEST_SCHEDULE_START_TS,
});

const mockEventNotificationWithConfig: EventNotification = {
    event: mockEventWithIntroConfig as any
};

const mockEventNotificationWithoutConfig: EventNotification = {
    event: mockEventWithoutIntroConfig as any
};

const mockSystemNotification: SystemNotification = {
    eventID: TEST_EVENT_ID
};

// Helper functions for test setup
const createContainer = () => ({
    oddsFeedEventSource: mockOddsFeedEventSource,
    delayHandlingService: mockDelayHandlingService,
    scheduler: mockScheduler,
    gameBroadcastService: mockGameBroadcastService,
    featureDebugService: mockFeatureDebugService,
});

const setupMocks = () => {
    jest.clearAllMocks();
    mockDelayHandlingService.getDelayedTime.mockReturnValue(TEST_DELAYED_TIME);
};

describe('IntroService', () => {
    let introService: IntroService;
    let container: any;

    beforeEach(() => {
        setupMocks();
        container = createContainer();
        introService = new IntroService(container);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with all dependencies and bind event handlers', () => {
            // Arrange & Act
            const service = new IntroService(container);

            // Assert
            expect(service['oddsFeedEventSource']).toBe(mockOddsFeedEventSource);
            expect(service['scheduler']).toBe(mockScheduler);
            expect(service['delayHandlingService']).toBe(mockDelayHandlingService);
            expect(service['gameBroadcastService']).toBe(mockGameBroadcastService);
            expect(service['featureDebugService']).toBe(mockFeatureDebugService);
            expect(service['boundHandleEventStart']).toBeInstanceOf(Function);
        });

        it('should initialize empty intro tracking objects', () => {
            // Arrange & Act
            const service = new IntroService(container);

            // Assert
            expect(service['_introByGameId']).toEqual({});
        });
    });

    describe('eventName', () => {
        it('should return "intro"', () => {
            // Act
            const result = introService.eventName;

            // Assert
            expect(result).toBe('intro');
        });
    });

    describe('initEvent', () => {
        it('should register all required event listeners', () => {
            // Arrange & Act
            introService.initEvent();

            // Assert
            expect(mockOddsFeedEventSource.eventOn).toHaveBeenCalledWith(
                OddsFeedEventName.EventStart,
                introService['boundHandleEventStart']
            );
        });
    });

    describe('dispose', () => {
        it('should unregister all event listeners', () => {
            // Arrange & Act
            introService.dispose();

            // Assert
            expect(mockOddsFeedEventSource.eventOff).toHaveBeenCalledWith(
                OddsFeedEventName.EventStart,
                introService['boundHandleEventStart']
            );
        });
    });

    describe('getCurrentByGameId', () => {
        it('should return recalculated intro state for existing game', () => {
            // Arrange
            introService['_introByGameId'][TEST_GAME_ID] = {
                resourceServer: TEST_RESOURCE_SERVER,
                introTime: 15,
                timeToPlay: TEST_TIME_TO_PLAY,
                isPlaying: true,
                duration: TEST_DURATION
            };

            // Act
            const result = introService.getCurrentByGameId(TEST_GAME_ID);

            // Assert
            expect(result).toBeDefined();
            expect(result?.resourceServer).toBe(TEST_RESOURCE_SERVER);
            expect(result?.duration).toBe(TEST_DURATION);
            expect(result?.timeToPlay).toBe(TEST_TIME_TO_PLAY);
        });

        it('should return intro state with isPlaying false when intro time exceeds duration', () => {
            // Arrange
            introService['_introByGameId'][TEST_GAME_ID] = {
                resourceServer: TEST_RESOURCE_SERVER,
                introTime: 35, // Exceeds 30 second duration
                timeToPlay: TEST_TIME_TO_PLAY,
                isPlaying: true,
                duration: TEST_DURATION
            };

            // Act
            const result = introService.getCurrentByGameId(TEST_GAME_ID);

            // Assert
            expect(result?.isPlaying).toBe(false);
        });

        it('should return intro state with isPlaying false when intro time is before start', () => {
            // Arrange
            introService['_introByGameId'][TEST_GAME_ID] = {
                resourceServer: TEST_RESOURCE_SERVER,
                introTime: -5, // Before start
                timeToPlay: TEST_TIME_TO_PLAY,
                isPlaying: true,
                duration: TEST_DURATION
            };

            // Act
            const result = introService.getCurrentByGameId(TEST_GAME_ID);

            // Assert
            expect(result?.isPlaying).toBe(false);
        });

        it('should return undefined for non-existing game', () => {
            // Act
            const result = introService.getCurrentByGameId('nonexistent');

            // Assert
            expect(result).toBeUndefined();
        });
    });

    describe('handleEventStart', () => {
        it('should schedule prebet and halftime intro start and stop times when config is available', () => {
            // Arrange
            mockDelayHandlingService.getDelayedTime
                .mockReturnValueOnce(TEST_DELAYED_TIME) // prebet intro start
                .mockReturnValueOnce(TEST_DELAYED_TIME_HALFTIME); // halftime intro start

            // Act
            introService.handleEventStart(mockEventNotificationWithConfig);

            // Assert
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledTimes(2);
            expect(mockScheduler.schedule).toHaveBeenCalledTimes(4); // 2 start times + 2 stop times
        });

        it('should NOT schedule intros with default duration when config is not available', () => {
            // Act
            introService.handleEventStart(mockEventNotificationWithoutConfig);

            // Assert
            expect(mockScheduler.schedule).not.toHaveBeenCalled();
        });

        it('should calculate correct delay times', () => {
            // Act
            introService.handleEventStart(mockEventNotificationWithConfig);

            // Assert
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledWith(
                { event: mockEventWithIntroConfig, time: new Date(mockEventWithIntroConfig.scheduleStartTs) },
                { oddsFeedEventType: OddsFeedEventName.EventStart }
            );
        });
    });

    describe('updateIntroStatus', () => {
        it('should create intro state and update getCurrentByGameId result', () => {
            // Act
            introService.updateIntroStatus({ event: mockEventWithIntroConfig as any, timeToPlay: TEST_TIME_TO_PLAY });

            // Assert
            const result = introService.getCurrentByGameId(TEST_GAME_ID);
            expect(result).toBeDefined();
            expect(result?.resourceServer).toBe(TEST_RESOURCE_SERVER);
            expect(result?.duration).toBe(TEST_DURATION);
            expect(result?.timeToPlay).toBe(TEST_TIME_TO_PLAY);
        });

        it('should set isPlaying to false when intro time is before start', () => {
            // Arrange
            const futureTimeToPlay = Date.now() + 10000; // 10 seconds in the future

            // Act
            introService.updateIntroStatus({ event: mockEventWithIntroConfig as any, timeToPlay: futureTimeToPlay });

            // Assert
            expect(introService.getCurrentByGameId(TEST_GAME_ID)?.isPlaying).toBe(false);
        });

        it('should set isPlaying to false when intro time is after duration', () => {
            // Arrange
            const pastTimeToPlay = Date.now() - (TEST_DURATION + 5) * 1000; // Duration + 5 seconds ago

            // Act
            introService.updateIntroStatus({ event: mockEventWithIntroConfig as any, timeToPlay: pastTimeToPlay });

            // Assert
            expect(introService.getCurrentByGameId(TEST_GAME_ID)?.isPlaying).toBe(false);
        });

        it('should set isPlaying to true when intro time is exactly at start', () => {
            // Arrange
            const exactTimeToPlay = Date.now(); // Right now

            // Act
            introService.updateIntroStatus({ event: mockEventWithIntroConfig as any, timeToPlay: exactTimeToPlay });

            // Assert
            expect(introService.getCurrentByGameId(TEST_GAME_ID)?.isPlaying).toBe(true);
        });

        it('should set isPlaying to true when intro time is within duration', () => {
            // Arrange
            const withinDurationTime = Date.now() - 15000; // 15 seconds ago (within 30 second duration)

            // Act
            introService.updateIntroStatus({ event: mockEventWithIntroConfig as any, timeToPlay: withinDurationTime });

            // Assert
            expect(introService.getCurrentByGameId(TEST_GAME_ID)?.isPlaying).toBe(true);
        });

        it('should broadcast to clients when status is updated', () => {
            // Act
            introService.updateIntroStatus({ event: mockEventWithIntroConfig as any, timeToPlay: TEST_TIME_TO_PLAY });

            // Assert
            expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                TEST_GAME_ID,
                expect.any(Object),
                introService.eventName
            );
        });
    });

    describe('getReplayByEvent', () => {
        it('should return array of replay events for a given event with intro config', () => {
            // Arrange & Act
            const replays = introService.getReplayByEvent(mockEventWithIntroConfig as any);

            // Assert
            expect(replays).toBeInstanceOf(Array);
            expect(replays.length).toBeGreaterThan(0);
            expect(replays[0]).toHaveProperty('time');
            expect(replays[0]).toHaveProperty('payload');
            expect(replays[0]).toHaveProperty('eventName', 'intro');
        });

        it('should return no intro replays for event without intro config', () => {
            // Arrange & Act
            const replays = introService.getReplayByEvent(mockEventWithoutIntroConfig as any);

            // Assert
            expect(replays).toBeInstanceOf(Array);
            expect(replays.length).toBe(0);
        });

        it('should call delay handling service with event object for prebet intro', () => {
            // Act
            introService.getReplayByEvent(mockEventWithIntroConfig as any);

            // Assert
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledWith(
                {
                    event: mockEventWithIntroConfig,
                    time: new Date(mockEventWithIntroConfig.scheduleStartTs)
                },
                {
                    oddsFeedEventType: OddsFeedEventName.EventStart,
                }
            );
        });

        it('should call delay handling service with event object for halftime intro', () => {
            // Act
            introService.getReplayByEvent(mockEventWithIntroConfig as any);

            // Assert
            // Check that getDelayedTime was called for halftime (second call)
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledTimes(2);
            // The second call should be for halftime with calculated time (scheduleStartTs - duration)
            const secondCallArgs = mockDelayHandlingService.getDelayedTime.mock.calls[1];
            expect(secondCallArgs[1]).toEqual({
                oddsFeedEventType: OddsFeedEventName.EventDetailStart,
            });
        });

        it('should include intro start and stop replays for prebet phase', () => {
            // Act
            const replays = introService.getReplayByEvent(mockEventWithIntroConfig as any);

            // Assert
            const prebetReplays = replays.filter(r => r.payload.timeToPlay !== undefined);
            expect(prebetReplays.length).toBeGreaterThanOrEqual(2); // Start and stop
            
            const startReplay = prebetReplays.find(r => r.payload.isPlaying === true);
            const stopReplay = prebetReplays.find(r => r.payload.isPlaying === false);
            expect(startReplay).toBeDefined();
            expect(stopReplay).toBeDefined();
        });

        it('should include intro start and stop replays for halftime phase', () => {
            // Act
            const replays = introService.getReplayByEvent(mockEventWithIntroConfig as any);

            // Assert
            expect(replays.length).toBeGreaterThanOrEqual(4); // 2 for prebet + 2 for halftime
        });

        it('should return pure function result (not mutate state)', () => {
            // Arrange
            const initialStateKeys = Object.keys(introService['_introByGameId']);

            // Act
            introService.getReplayByEvent(mockEventWithIntroConfig as any);

            // Assert
            const finalStateKeys = Object.keys(introService['_introByGameId']);
            expect(finalStateKeys).toEqual(initialStateKeys);
        });
    });
});