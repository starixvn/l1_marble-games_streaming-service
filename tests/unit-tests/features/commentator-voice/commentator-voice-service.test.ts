import { CommentatorVoiceService, CommentatorVoiceServiceContainer, VoiceState } from "../../../../src/features/commentator-voice/commentator-voice-service";
import { OddFeedEventSource, OddFeedEventName, EventNotification, EventDetailNotification, SystemNotification } from "../../../../src/features/odd-feed-data";
import { DelayHandlingService } from "../../../../src/features/delay/delay-handling-service";
import { Scheduler } from "../../../../src/features/scheduler/scheduler";
import { GameBroadcastService } from "../../../../src/services/game-broadcast.service";
import { FeatureDebugService } from "../../../../src/features/feature-debug/feature-debug-service";
import { OddsFeedService } from "../../../../src/services/odds-feed-service";
import { appSettings } from "../../../../src/app-settings";
import { generateVoiceWithEventTimeline } from "../../../../src/helpers/voices";
import { createMockEvent, createMockEventDetail } from "../../test-utils/mock-event";

// Mock complex helpers
jest.mock("../../../../src/helpers/voices", () => ({
    generateVoiceWithEventTimeline: jest.fn(),
}));

const mockGenerateVoiceWithEventTimeline = generateVoiceWithEventTimeline as jest.MockedFunction<typeof generateVoiceWithEventTimeline>;

// Mock dependencies
const mockOddFeedEventSource = {
    registerEventDetailEventListener: jest.fn(),
    unregisterEventDetailEventListener: jest.fn(),
    registerEventListener: jest.fn(),
    unregisterEventListener: jest.fn(),
    registerSystemDataCleanupEventListener: jest.fn(),
    unregisterSystemDataCleanupEventListener: jest.fn(),
} as unknown as jest.Mocked<OddFeedEventSource>;

const mockDelayHandlingService = {
    getDelayedTimeWithVideoDelay: jest.fn(),
} as unknown as jest.Mocked<DelayHandlingService>;

const mockScheduler = {
    schedule: jest.fn(),
} as unknown as jest.Mocked<Scheduler>;

const mockGameBoardcastService = {
    broadcastToAllClientByGameId: jest.fn(),
} as unknown as jest.Mocked<GameBroadcastService>;

const mockFeatureDebugService = {
    log: jest.fn(),
} as unknown as jest.Mocked<FeatureDebugService>;

const mockOddsFeedService = {
    getVoiceConfig: jest.fn(),
    getInGameEvent: jest.fn(),
    getGoalInfo: jest.fn(),
} as unknown as jest.Mocked<OddsFeedService>;

// Test constants
const TEST_GAME_ID = '1';
const TEST_EVENT_ID = 4294967298;
const TEST_DELAYED_TIME = new Date('2023-01-01T10:05:00Z');
const TEST_SCHEDULE_START_TS = "2023-01-01T10:00:00Z";
const TEST_VIDEO_LENGTH = 30;
const TEST_CONFIG_JSON = "test-config.json";

// Test data
const mockVoiceConfig = {
    "goal": {
        1: 5,
        2: 3
    },
    "card": {
        1: 2,
        2: 4
    }
};

const mockInGameEvent = {
    eventName: ["Goal", "Card"],
    timeLine: [10, 20],
    frame: [100, 200]
};

const mockGoalInfo = {
    result: ["1", "0"],
    length: 25,
    frame: [100, 200],
    timeLine: [50, 60] // This timeline is NOT used for voice generation
};

const mockEventWithVoiceConfig = {
    ...createMockEvent({
        eventID: TEST_EVENT_ID,
        scheduleStartTs: TEST_SCHEDULE_START_TS,
        eventDetails: [
            createMockEventDetail({
                phase: 1,
                scheduleStartTs: TEST_SCHEDULE_START_TS,
                inGameEventInfo: "test-in-game-event",
                goalInfo: "test-goal-info"
            })
        ]
    }),
    config: {
        video: { videoLength: TEST_VIDEO_LENGTH },
        voice: {
            configJson: TEST_CONFIG_JSON,
            configVoice: mockVoiceConfig
        }
    }
};

const mockEventWithoutVoiceConfig = createMockEvent({
    eventID: TEST_EVENT_ID,
    scheduleStartTs: TEST_SCHEDULE_START_TS,
});

const mockEventNotificationWithConfig: EventNotification = {
    event: mockEventWithVoiceConfig as any
};


const mockEventDetailNotification: EventDetailNotification = {
    event: mockEventWithVoiceConfig as any,
    index: 0
};

const mockSystemNotification: SystemNotification = {
    eventID: TEST_EVENT_ID
};

const createContainer = (): CommentatorVoiceServiceContainer => ({
    oddFeedEventSource: mockOddFeedEventSource,
    scheduler: mockScheduler,
    delayHandlingService: mockDelayHandlingService,
    gameBoardcastService: mockGameBoardcastService,
    featureDebugService: mockFeatureDebugService,
    oddsFeedService: mockOddsFeedService,
});

const setupMocks = () => {
    jest.clearAllMocks();
    mockDelayHandlingService.getDelayedTimeWithVideoDelay.mockReturnValue(TEST_DELAYED_TIME);
    mockOddsFeedService.getVoiceConfig.mockResolvedValue(mockVoiceConfig);
    mockOddsFeedService.getInGameEvent.mockResolvedValue(mockInGameEvent);
    mockOddsFeedService.getGoalInfo.mockResolvedValue(mockGoalInfo);
    mockGenerateVoiceWithEventTimeline.mockReturnValue({
        voice: ["generated-voice1.mp3", "generated-voice2.mp3"],
        timeline: [5, 15]
    });
};

describe('CommentatorVoiceService', () => {
    let commentatorVoiceService: CommentatorVoiceService;
    let container: CommentatorVoiceServiceContainer;

    beforeEach(() => {
        setupMocks();
        container = createContainer();
        commentatorVoiceService = new CommentatorVoiceService(container);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with all dependencies and bind event handlers', () => {
            // Arrange & Act
            const service = new CommentatorVoiceService(container);

            // Assert
            expect(service['oddFeedEventSource']).toBe(mockOddFeedEventSource);
            expect(service['scheduler']).toBe(mockScheduler);
            expect(service['delayHandlingService']).toBe(mockDelayHandlingService);
            expect(service['gameBoardcastService']).toBe(mockGameBoardcastService);
            expect(service['featureDebugService']).toBe(mockFeatureDebugService);
            expect(service['oddsFeedService']).toBe(mockOddsFeedService);
            expect(service['boundHandleEventDetailScheduleStart']).toBeInstanceOf(Function);
            expect(service['boundHandleEventUpcoming']).toBeInstanceOf(Function);
            expect(service['boundHandleEventCleanup']).toBeInstanceOf(Function);
        });

        it('should initialize empty state tracking objects', () => {
            // Arrange & Act
            const service = new CommentatorVoiceService(container);

            // Assert
            expect(service['_voiceStateByGameId']).toEqual({});
            expect(service['_videoLengthByEventId']).toEqual({});
            expect(service['_commentatorVoiceConfigByEventId']).toEqual({});
        });
    });

    describe('eventName', () => {
        it('should return "commentatorVoice"', () => {
            // Act
            const result = commentatorVoiceService.eventName;

            // Assert
            expect(result).toBe('commentatorVoice');
        });
    });

    describe('initEvent', () => {
        it('should register all required event listeners', () => {
            // Arrange & Act
            commentatorVoiceService.initEvent();

            // Assert
            expect(mockOddFeedEventSource.registerEventDetailEventListener).toHaveBeenCalledWith(
                OddFeedEventName.EventDetailStart,
                commentatorVoiceService['boundHandleEventDetailScheduleStart']
            );
            expect(mockOddFeedEventSource.registerEventListener).toHaveBeenCalledWith(
                OddFeedEventName.EventUpcoming,
                commentatorVoiceService['boundHandleEventUpcoming']
            );
            expect(mockOddFeedEventSource.registerSystemDataCleanupEventListener).toHaveBeenCalledWith(
                commentatorVoiceService['boundHandleEventCleanup']
            );
        });
    });

    describe('dispose', () => {
        it('should unregister all event listeners', () => {
            // Arrange & Act
            commentatorVoiceService.dispose();

            // Assert
            expect(mockOddFeedEventSource.unregisterEventDetailEventListener).toHaveBeenCalledWith(
                OddFeedEventName.EventDetailStart,
                commentatorVoiceService['boundHandleEventDetailScheduleStart']
            );
            expect(mockOddFeedEventSource.unregisterEventListener).toHaveBeenCalledWith(
                OddFeedEventName.EventUpcoming,
                commentatorVoiceService['boundHandleEventUpcoming']
            );
            expect(mockOddFeedEventSource.unregisterSystemDataCleanupEventListener).toHaveBeenCalledWith(
                commentatorVoiceService['boundHandleEventCleanup']
            );
        });
    });

    describe('handleEventUpcoming', () => {
        it('should store video length and voice config when config is present', async () => {
            // Arrange & Act
            await commentatorVoiceService.handleEventUpcoming(mockEventNotificationWithConfig);

            // Assert
            expect(commentatorVoiceService['_videoLengthByEventId'][TEST_EVENT_ID]).toBe(TEST_VIDEO_LENGTH);
            expect(mockOddsFeedService.getVoiceConfig).toHaveBeenCalledWith(TEST_CONFIG_JSON);
            expect(commentatorVoiceService['_commentatorVoiceConfigByEventId'][TEST_EVENT_ID]).toEqual({
                configJson: TEST_CONFIG_JSON,
                configVoice: mockVoiceConfig
            });
        });

        it('should use app settings video length when config video length is not present', async () => {
            // Arrange
            const eventWithoutVideoLength = {
                event: {
                    ...mockEventWithVoiceConfig,
                    config: {
                        voice: {
                            configJson: TEST_CONFIG_JSON,
                            configVoice: mockVoiceConfig
                        }
                    }
                }
            };
            appSettings.videoLength = { [TEST_GAME_ID]: 45 };

            // Act
            await commentatorVoiceService.handleEventUpcoming(eventWithoutVideoLength as any);

            // Assert
            expect(commentatorVoiceService['_videoLengthByEventId'][TEST_EVENT_ID]).toBe(45);
        });

        it('should use global default video length when no config or app settings', async () => {
            // Arrange
            const eventWithoutVideoLength = {
                event: {
                    ...mockEventWithVoiceConfig,
                    config: {
                        voice: {
                            configJson: TEST_CONFIG_JSON,
                            configVoice: mockVoiceConfig
                        }
                    }
                }
            };
            appSettings.videoLength = {};

            // Act
            await commentatorVoiceService.handleEventUpcoming(eventWithoutVideoLength as any);

            // Assert
            expect(commentatorVoiceService['_videoLengthByEventId'][TEST_EVENT_ID]).toBe(30);
        });

        it('should return early when voice config is not present', async () => {
            // Arrange
            const eventWithoutVoiceConfig = {
                event: {
                    ...mockEventWithoutVoiceConfig,
                    config: { video: { videoLength: TEST_VIDEO_LENGTH } }
                }
            };

            // Act
            await commentatorVoiceService.handleEventUpcoming(eventWithoutVoiceConfig as any);

            // Assert
            expect(mockOddsFeedService.getVoiceConfig).not.toHaveBeenCalled();
            expect(commentatorVoiceService['_commentatorVoiceConfigByEventId'][TEST_EVENT_ID]).toBeUndefined();
        });

        it('should return early when voice config from service is null', async () => {
            // Arrange
            mockOddsFeedService.getVoiceConfig.mockResolvedValue(null);

            // Act
            await commentatorVoiceService.handleEventUpcoming(mockEventNotificationWithConfig);

            // Assert
            expect(mockOddsFeedService.getVoiceConfig).toHaveBeenCalledWith(TEST_CONFIG_JSON);
            expect(commentatorVoiceService['_commentatorVoiceConfigByEventId'][TEST_EVENT_ID]).toBeUndefined();
        });
    });

    describe('handleEventCleanup', () => {
        it('should remove video length and voice config for specified event', () => {
            // Arrange
            commentatorVoiceService['_videoLengthByEventId'][TEST_EVENT_ID] = TEST_VIDEO_LENGTH;
            commentatorVoiceService['_commentatorVoiceConfigByEventId'][TEST_EVENT_ID] = {
                configJson: TEST_CONFIG_JSON,
                configVoice: mockVoiceConfig
            };

            // Act
            commentatorVoiceService.handleEventCleanup(mockSystemNotification);

            // Assert
            expect(commentatorVoiceService['_videoLengthByEventId'][TEST_EVENT_ID]).toBeUndefined();
            expect(commentatorVoiceService['_commentatorVoiceConfigByEventId'][TEST_EVENT_ID]).toBeUndefined();
        });
    });

    describe('handleEventDetailScheduleStart', () => {
        beforeEach(() => {
            commentatorVoiceService['_commentatorVoiceConfigByEventId'][TEST_EVENT_ID] = {
                configJson: TEST_CONFIG_JSON,
                configVoice: mockVoiceConfig
            };
            commentatorVoiceService['_videoLengthByEventId'][TEST_EVENT_ID] = TEST_VIDEO_LENGTH;
        });

        it('should return early when config is not present', async () => {
            // Arrange
            delete commentatorVoiceService['_commentatorVoiceConfigByEventId'][TEST_EVENT_ID];

            // Act
            await commentatorVoiceService.handleEventDetailScheduleStart(mockEventDetailNotification);

            // Assert
            expect(mockOddsFeedService.getInGameEvent).not.toHaveBeenCalled();
        });

        it('should process voice generation with all data sources', async () => {
            // Arrange & Act
            await commentatorVoiceService.handleEventDetailScheduleStart(mockEventDetailNotification);

            // Assert
            expect(mockOddsFeedService.getInGameEvent).toHaveBeenCalledWith("test-in-game-event");
            expect(mockOddsFeedService.getGoalInfo).toHaveBeenCalledWith("test-goal-info");
            expect(mockGenerateVoiceWithEventTimeline).toHaveBeenCalled();
            expect(mockScheduler.schedule).toHaveBeenCalled();
        });

        it('should use goal info length when available', async () => {
            // Arrange
            mockOddsFeedService.getGoalInfo.mockResolvedValue({ 
                result: ["1", "0"], 
                length: 35,
                frame: [100, 200],
                timeLine: [50, 60] // GoalInfo timeline is not used for voice generation
            });

            // Act
            await commentatorVoiceService.handleEventDetailScheduleStart(mockEventDetailNotification);

            // Assert
            const voiceState = commentatorVoiceService['_voiceStateByGameId'][TEST_GAME_ID];
            expect(voiceState.get(1)?.videoLength).toBe(35); // 0 + 35 (first event detail in phase)
        });

        it('should use default video length when goal info length is not available', async () => {
            // Arrange
            mockOddsFeedService.getGoalInfo.mockResolvedValue({ 
                result: ["1", "0"],
                frame: [100, 200],
                timeLine: [50, 60] // GoalInfo timeline is not used for voice generation
            });

            // Act
            await commentatorVoiceService.handleEventDetailScheduleStart(mockEventDetailNotification);

            // Assert
            const voiceState = commentatorVoiceService['_voiceStateByGameId'][TEST_GAME_ID];
            expect(voiceState.get(1)?.videoLength).toBe(30); // 0 + 30 (first event detail in phase)
        });

        it('should schedule debug voice call', async () => {
            // Arrange & Act
            await commentatorVoiceService.handleEventDetailScheduleStart(mockEventDetailNotification);

            // Assert
            expect(mockScheduler.schedule).toHaveBeenCalledWith(
                TEST_DELAYED_TIME,
                expect.any(Function)
            );
        });

        it('should schedule voice playback for each generated voice', async () => {
            // Arrange & Act
            await commentatorVoiceService.handleEventDetailScheduleStart(mockEventDetailNotification);

            // Assert
            expect(mockScheduler.schedule).toHaveBeenCalledTimes(3); // 1 debug + 2 voices
        });

        it('should use InGameEvent timeline for voice generation, not GoalInfo timeline', async () => {
            // Arrange
            const customInGameEvent = {
                eventName: ["Goal", "Celebration"],
                timeLine: [15, 25], // This timeline should be used
                frame: [150, 250]
            };
            const customGoalInfo = {
                result: ["2", "1"],
                length: 40,
                frame: [300, 400],
                timeLine: [99, 100] // This timeline should NOT be used
            };
            mockOddsFeedService.getInGameEvent.mockResolvedValue(customInGameEvent);
            mockOddsFeedService.getGoalInfo.mockResolvedValue(customGoalInfo);

            // Act
            await commentatorVoiceService.handleEventDetailScheduleStart(mockEventDetailNotification);

            // Assert
            expect(mockGenerateVoiceWithEventTimeline).toHaveBeenCalledWith(
                expect.objectContaining({
                    timeline: [15, 25], // Should use InGameEvent timeline (absolute: 0 + [15, 25])
                    eventName: ["Goal", "Celebration"]
                }),
                mockVoiceConfig
            );
        });

        it('should accumulate video length within the same phase across multiple event details', async () => {
            // Arrange - First event detail in phase 1 (uses mockGoalInfo.length = 25)
            await commentatorVoiceService.handleEventDetailScheduleStart(mockEventDetailNotification);
            
            // Set up second event detail in the same phase with different goal info
            mockOddsFeedService.getGoalInfo.mockResolvedValueOnce({ 
                result: ["2", "1"],
                length: 30, // Different length for second event detail
                frame: [200, 300],
                timeLine: [70, 80]
            });
            
            const secondEventDetailNotification = {
                ...mockEventDetailNotification,
                event: {
                    ...mockEventDetailNotification.event,
                    eventDetails: [
                        ...mockEventDetailNotification.event.eventDetails,
                        createMockEventDetail({
                            phase: 1, // Same phase
                            scheduleStartTs: "2023-01-01T10:01:00Z",
                            inGameEventInfo: "test-in-game-event-2",
                            goalInfo: "test-goal-info-2"
                        })
                    ]
                },
                index: 1
            };

            // Act - Second event detail in same phase
            await commentatorVoiceService.handleEventDetailScheduleStart(secondEventDetailNotification as any);

            // Assert - Video length should accumulate within the phase
            const voiceState = commentatorVoiceService['_voiceStateByGameId'][TEST_GAME_ID];
            expect(voiceState.get(1)?.videoLength).toBe(55); // 25 (first) + 30 (second)
        });
    });

    describe('playVoice', () => {
        it('should broadcast voice to clients and log message', () => {
            // Arrange
            const voiceState: VoiceState = { fileName: "test-voice.mp3" };

            // Act
            commentatorVoiceService.playVoice(TEST_GAME_ID, voiceState);

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                commentatorVoiceService,
                "Playing voice: test-voice.mp3",
                TEST_GAME_ID
            );
            expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                TEST_GAME_ID,
                voiceState,
                commentatorVoiceService.eventName
            );
        });
    });

    describe('getAbsoluteTimeline', () => {
        it('should add video length to each timeline value', () => {
            // Arrange
            const timeline = [5, 10, 15];
            const videoLength = 30;

            // Act
            const result = commentatorVoiceService['getAbsoluteTimeline'](timeline, videoLength);

            // Assert
            expect(result).toEqual([35, 40, 45]);
        });

        it('should handle empty timeline', () => {
            // Arrange
            const timeline: number[] = [];
            const videoLength = 30;

            // Act
            const result = commentatorVoiceService['getAbsoluteTimeline'](timeline, videoLength);

            // Assert
            expect(result).toEqual([]);
        });
    });

    describe('getOrDefault', () => {
        it('should return value when value is defined', () => {
            // Arrange
            const value = "test-value";
            const defaultValue = "default";

            // Act
            const result = commentatorVoiceService['getOrDefault'](value, defaultValue);

            // Assert
            expect(result).toBe("test-value");
        });

        it('should return default value when value is undefined', () => {
            // Arrange
            const value = undefined;
            const defaultValue = "default";

            // Act
            const result = commentatorVoiceService['getOrDefault'](value, defaultValue);

            // Assert
            expect(result).toBe("default");
        });

        it('should return default value when value is null', () => {
            // Arrange
            const value = null;
            const defaultValue = "default";

            // Act
            const result = commentatorVoiceService['getOrDefault'](value, defaultValue);

            // Assert
            expect(result).toBe("default");
        });
    });

    describe('getRelativeTimeline', () => {
        it('should subtract video length from each timeline value', () => {
            // Arrange
            const timeline = [35, 40, 45];
            const videoLength = 30;

            // Act
            const result = commentatorVoiceService['getRelativeTimeline'](timeline, videoLength);

            // Assert
            expect(result).toEqual([5, 10, 15]);
        });

        it('should handle empty timeline', () => {
            // Arrange
            const timeline: number[] = [];
            const videoLength = 30;

            // Act
            const result = commentatorVoiceService['getRelativeTimeline'](timeline, videoLength);

            // Assert
            expect(result).toEqual([]);
        });
    });

    describe('log', () => {
        it('should call featureDebugService.log with correct parameters', () => {
            // Arrange
            const message = 'test message';
            const gameId = TEST_GAME_ID;

            // Act
            commentatorVoiceService['log'](message, gameId);

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                commentatorVoiceService,
                message,
                gameId
            );
        });
    });

    describe('debugVoice', () => {
        it('should log detailed voice generation information', () => {
            // Arrange
            const gameId = TEST_GAME_ID;
            const output = { voice: ["voice1.mp3"], timeline: [10] };
            const input = {
                eventName: ["Goal"],
                timeline: [5],
                firstHalfScore: "1-0",
                firstHalfVoices: ["first-half.mp3"],
                previousVoices: ["prev.mp3"],
                previousTimelines: [3],
                previousEvents: ["Card"],
                previousVoiceTimelines: [7],
            };
            const config = mockVoiceConfig;

            // Act
            commentatorVoiceService['debugVoice'](gameId, output, input, config);

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                commentatorVoiceService,
                expect.stringContaining('Debug voice:'),
                gameId
            );
        });
    });

    describe('edge cases', () => {
        it('should maintain correct context when bound methods are called directly', async () => {
            // Arrange
            const boundHandleEventUpcoming = commentatorVoiceService['boundHandleEventUpcoming'];
            const boundHandleEventDetailScheduleStart = commentatorVoiceService['boundHandleEventDetailScheduleStart'];
            const boundHandleEventCleanup = commentatorVoiceService['boundHandleEventCleanup'];

            // Act
            await boundHandleEventUpcoming(mockEventNotificationWithConfig);
            await boundHandleEventDetailScheduleStart(mockEventDetailNotification);
            boundHandleEventCleanup(mockSystemNotification);

            // Assert
            expect(mockOddsFeedService.getVoiceConfig).toHaveBeenCalled();
            expect(mockOddsFeedService.getInGameEvent).toHaveBeenCalled();
        });

        it('should handle multiple phases for same game', async () => {
            // Arrange
            commentatorVoiceService['_commentatorVoiceConfigByEventId'][TEST_EVENT_ID] = {
                configJson: TEST_CONFIG_JSON,
                configVoice: mockVoiceConfig
            };
            const phase1Notification = { ...mockEventDetailNotification };
            const phase2Notification = {
                ...mockEventDetailNotification,
                event: {
                    ...mockEventDetailNotification.event,
                    eventDetails: [
                        ...mockEventDetailNotification.event.eventDetails,
                        createMockEventDetail({ phase: 2 })
                    ]
                },
                index: 1
            };

            // Act
            await commentatorVoiceService.handleEventDetailScheduleStart(phase1Notification);
            await commentatorVoiceService.handleEventDetailScheduleStart(phase2Notification as any);

            // Assert - Each phase should have its own state, video length starts from 0 for each phase
            const voiceState = commentatorVoiceService['_voiceStateByGameId'][TEST_GAME_ID];
            expect(voiceState.has(1)).toBe(true);
            expect(voiceState.has(2)).toBe(true);
            expect(voiceState.get(1)?.videoLength).toBe(25); // Phase 1: 0 + 25
            expect(voiceState.get(2)?.videoLength).toBe(25); // Phase 2: 0 + 25 (starts fresh)
        });
    });
});
