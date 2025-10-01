jest.mock("odd-feed-client", () => {
    return {
        OddFeedEventName: {
            EventDetailStart: "EventDetailStart",
            EventStart: "EventStart",
            EventUpcoming: "EventUpcoming",
        },
        Scheduler: class {
            schedule = jest.fn();
        },
        OddFeedEventSource: class {
            registerEventDetailEventListener = jest.fn();
            unregisterEventDetailEventListener = jest.fn();
            registerEventListener = jest.fn();
            unregisterEventListener = jest.fn();
            registerSystemDataCleanupEventListener = jest.fn();
            unregisterSystemDataCleanupEventListener = jest.fn();
        },
        OddFeedService: class {
            getRemoteJson = jest.fn();
        },
    };
});

import { CommentatorVoiceService, CommentatorVoiceServiceContainer, VoiceState } from "../../../../src/features/commentator-voice/commentator-voice-service";
import { OddFeedEventSource, OddFeedEventName, EventNotification, EventDetailNotification, SystemNotification, OddFeedService } from "odd-feed-client";
import { DelayHandlingService } from "../../../../src/features/delay/delay-handling-service";
import { Scheduler } from "odd-feed-client";
import { GameBroadcastService } from "../../../../src/services/game-broadcast.service";
import { FeatureDebugService } from "../../../../src/features/feature-debug/feature-debug-service";
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
    getRemoteJson: jest.fn(),
} as unknown as jest.Mocked<OddFeedService>;

type GoalInfo = import("../../../../src/types").GoalInfoData;

// Test constants
const TEST_GAME_ID = '1';
const TEST_EVENT_ID = 4294967298;
const TEST_DELAYED_TIME = new Date('2023-01-01T10:05:00Z');
const TEST_SCHEDULE_START_TS = "2023-01-01T10:00:00Z";
const TEST_VIDEO_LENGTH = 30;
const TEST_CONFIG_JSON = "test-config.json";

// Common test data
const TEST_VOICE_FILE = 'voice1.mp3';
const MOCK_VOICE_STATE_DATA = {
    eventName: ['Goal'],
    timeline: [10],
    voices: [TEST_VOICE_FILE],
    voiceTimelines: [5],
    scoreSequence: '1-0',
    videoLength: 30
};

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

const mockGoalInfo: GoalInfo = {
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
    oddFeedService: mockOddsFeedService,
});

const setupMocks = () => {
    jest.clearAllMocks();
    mockDelayHandlingService.getDelayedTimeWithVideoDelay.mockReturnValue(TEST_DELAYED_TIME);
    // default: first call for upcoming voice config, then later calls for inGame and goalInfo
    mockOddsFeedService.getRemoteJson.mockImplementation(async (url: string) => {
        if (url === TEST_CONFIG_JSON) return mockVoiceConfig as any;
        if (url === "test-in-game-event") return mockInGameEvent as any;
        if (url === "test-goal-info") return mockGoalInfo as any;
        return null as any;
    });
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
            expect(service['oddFeedService']).toBe(mockOddsFeedService);
            expect(service['boundHandleEventDetailScheduleStart']).toBeInstanceOf(Function);
            expect(service['boundHandleEventUpcoming']).toBeInstanceOf(Function);
            expect(service['boundHandleEventCleanup']).toBeInstanceOf(Function);
            expect(service['boundHandleEventStart']).toBeInstanceOf(Function);
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
            expect(mockOddFeedEventSource.registerEventListener).toHaveBeenCalledWith(
                OddFeedEventName.EventStart,
                commentatorVoiceService['boundHandleEventStart']
            );
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
            expect(mockOddFeedEventSource.unregisterEventListener).toHaveBeenCalledWith(
                OddFeedEventName.EventStart,
                commentatorVoiceService['boundHandleEventStart']
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
            expect(mockOddsFeedService.getRemoteJson).toHaveBeenCalledWith(TEST_CONFIG_JSON);
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
            expect(mockOddsFeedService.getRemoteJson).not.toHaveBeenCalledWith(TEST_CONFIG_JSON);
            expect(commentatorVoiceService['_commentatorVoiceConfigByEventId'][TEST_EVENT_ID]).toBeUndefined();
        });

        it('should return early when voice config from service is null', async () => {
            // Arrange
            mockOddsFeedService.getRemoteJson.mockImplementation(async (url: string) => {
                if (url === TEST_CONFIG_JSON) return null as any;
                return mockVoiceConfig as any;
            });

            // Act
            await commentatorVoiceService.handleEventUpcoming(mockEventNotificationWithConfig);

            // Assert
            expect(mockOddsFeedService.getRemoteJson).toHaveBeenCalledWith(TEST_CONFIG_JSON);
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

    describe('handleEventStart', () => {
        it('should reset voice state for the game when event starts', () => {
            // Arrange
            const mockEventNotification: EventNotification = {
                event: createMockEvent({
                    eventID: TEST_EVENT_ID,
                    scheduleStartTs: TEST_SCHEDULE_START_TS,
                })
            };
            
            // Set up existing voice state to verify it gets reset
            const existingVoiceState = new Map();
            existingVoiceState.set(1, MOCK_VOICE_STATE_DATA);
            commentatorVoiceService['_voiceStateByGameId'][TEST_GAME_ID] = existingVoiceState;

            // Act
            commentatorVoiceService.handleEventStart(mockEventNotification);

            // Assert
            const voiceState = commentatorVoiceService['_voiceStateByGameId'][TEST_GAME_ID];
            expect(voiceState).toBeInstanceOf(Map);
            expect(voiceState.size).toBe(0); // Should be empty after reset
        });

        it('should create new voice state map if none exists for the game', () => {
            // Arrange
            const mockEventNotification: EventNotification = {
                event: createMockEvent({
                    eventID: TEST_EVENT_ID,
                    scheduleStartTs: TEST_SCHEDULE_START_TS,
                })
            };
            
            // Ensure no existing voice state
            delete commentatorVoiceService['_voiceStateByGameId'][TEST_GAME_ID];

            // Act
            commentatorVoiceService.handleEventStart(mockEventNotification);

            // Assert
            const voiceState = commentatorVoiceService['_voiceStateByGameId'][TEST_GAME_ID];
            expect(voiceState).toBeInstanceOf(Map);
            expect(voiceState.size).toBe(0);
        });

        it('should handle multiple games independently', () => {
            // Arrange
            const gameId1 = '1';
            const gameId2 = '2';
            const eventId1 = 4294967298;
            
            const mockEventNotification1: EventNotification = {
                event: createMockEvent({
                    eventID: eventId1, // Maps to gameId1
                    scheduleStartTs: TEST_SCHEDULE_START_TS,
                })
            };
            

            // Set up existing voice states for both games
            const voiceState1 = new Map();
            voiceState1.set(1, { eventName: ['Goal1'], timeline: [10], voices: [TEST_VOICE_FILE], voiceTimelines: [5], scoreSequence: '1-0', videoLength: 30 });
            const voiceState2 = new Map();
            voiceState2.set(1, { eventName: ['Goal2'], timeline: [15], voices: ['voice2.mp3'], voiceTimelines: [8], scoreSequence: '0-1', videoLength: 25 });
            
            commentatorVoiceService['_voiceStateByGameId'][gameId1] = voiceState1;
            commentatorVoiceService['_voiceStateByGameId'][gameId2] = voiceState2;

            // Act - Reset only gameId1
            commentatorVoiceService.handleEventStart(mockEventNotification1);

            // Assert
            const resetVoiceState1 = commentatorVoiceService['_voiceStateByGameId'][gameId1];
            const unchangedVoiceState2 = commentatorVoiceService['_voiceStateByGameId'][gameId2];
            
            expect(resetVoiceState1).toBeInstanceOf(Map);
            expect(resetVoiceState1.size).toBe(0); // Should be reset
            expect(unchangedVoiceState2).toBeInstanceOf(Map);
            expect(unchangedVoiceState2.size).toBe(1); // Should remain unchanged
            expect(unchangedVoiceState2.get(1)?.scoreSequence).toBe('0-1');
        });

        it('should call resetVoiceState method internally', () => {
            // Arrange
            const mockEventNotification: EventNotification = {
                event: createMockEvent({
                    eventID: TEST_EVENT_ID,
                    scheduleStartTs: TEST_SCHEDULE_START_TS,
                })
            };
            
            // Spy on the resetVoiceState method
            const resetVoiceStateSpy = jest.spyOn(commentatorVoiceService, 'resetVoiceState');

            // Act
            commentatorVoiceService.handleEventStart(mockEventNotification);

            // Assert
            expect(resetVoiceStateSpy).toHaveBeenCalledWith(TEST_GAME_ID);
            
            // Cleanup
            resetVoiceStateSpy.mockRestore();
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
            expect(mockOddsFeedService.getRemoteJson).not.toHaveBeenCalledWith("test-in-game-event");
        });

        it('should process voice generation with all data sources', async () => {
            // Arrange & Act
            await commentatorVoiceService.handleEventDetailScheduleStart(mockEventDetailNotification);

            // Assert
            expect(mockOddsFeedService.getRemoteJson).toHaveBeenCalledWith("test-in-game-event");
            expect(mockOddsFeedService.getRemoteJson).toHaveBeenCalledWith("test-goal-info");
            expect(mockGenerateVoiceWithEventTimeline).toHaveBeenCalled();
            expect(mockScheduler.schedule).toHaveBeenCalled();
        });

        it('should use goal info length when available', async () => {
            // Arrange
            mockOddsFeedService.getRemoteJson.mockImplementation(async (url: string) => {
                if (url === TEST_CONFIG_JSON) return mockVoiceConfig as any;
                if (url === "test-in-game-event") return mockInGameEvent as any;
                if (url === "test-goal-info") return { result: ["1", "0"], length: 35, frame: [100, 200], timeLine: [50, 60] } as any;
                return null as any;
            });

            // Act
            await commentatorVoiceService.handleEventDetailScheduleStart(mockEventDetailNotification);

            // Assert
            const voiceState = commentatorVoiceService['_voiceStateByGameId'][TEST_GAME_ID];
            expect(voiceState.get(1)?.videoLength).toBe(35); // 0 + 35 (first event detail in phase)
        });

        it('should use default video length when goal info length is not available', async () => {
            // Arrange
            mockOddsFeedService.getRemoteJson.mockImplementation(async (url: string) => {
                if (url === TEST_CONFIG_JSON) return mockVoiceConfig as any;
                if (url === "test-in-game-event") return mockInGameEvent as any;
                if (url === "test-goal-info") return { result: ["1", "0"], frame: [100, 200], timeLine: [50, 60] } as any;
                return null as any;
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
            const customGoalInfo: GoalInfo = {
                result: ["2", "1"],
                length: 40,
                frame: [300, 400],
                timeLine: [99, 100] // This timeline should NOT be used
            };
            const seq = [customInGameEvent as any, customGoalInfo as any];
            let i = 0;
            mockOddsFeedService.getRemoteJson.mockImplementation(async (url: string) => seq[i++]);

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
            mockOddsFeedService.getRemoteJson.mockResolvedValueOnce({ 
                result: ["2", "1"],
                length: 30, // Different length for second event detail
                frame: [200, 300],
                timeLine: [70, 80]
            } as any);
            
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

    describe('resetVoiceState', () => {
        it('should create a new empty Map for the specified game', () => {
            // Arrange
            const existingVoiceState = new Map();
            existingVoiceState.set(1, MOCK_VOICE_STATE_DATA);
            commentatorVoiceService['_voiceStateByGameId'][TEST_GAME_ID] = existingVoiceState;

            // Act
            commentatorVoiceService.resetVoiceState(TEST_GAME_ID);

            // Assert
            const voiceState = commentatorVoiceService['_voiceStateByGameId'][TEST_GAME_ID];
            expect(voiceState).toBeInstanceOf(Map);
            expect(voiceState.size).toBe(0);
        });

        it('should create new Map if no existing state for the game', () => {
            // Arrange
            delete commentatorVoiceService['_voiceStateByGameId'][TEST_GAME_ID];

            // Act
            commentatorVoiceService.resetVoiceState(TEST_GAME_ID);

            // Assert
            const voiceState = commentatorVoiceService['_voiceStateByGameId'][TEST_GAME_ID];
            expect(voiceState).toBeInstanceOf(Map);
            expect(voiceState.size).toBe(0);
        });

        it('should not affect voice states of other games', () => {
            // Arrange
            const gameId1 = '1';
            const gameId2 = '2';
            
            const voiceState1 = new Map();
            voiceState1.set(1, { eventName: ['Goal1'], timeline: [10], voices: [TEST_VOICE_FILE], voiceTimelines: [5], scoreSequence: '1-0', videoLength: 30 });
            const voiceState2 = new Map();
            voiceState2.set(1, { eventName: ['Goal2'], timeline: [15], voices: ['voice2.mp3'], voiceTimelines: [8], scoreSequence: '0-1', videoLength: 25 });
            
            commentatorVoiceService['_voiceStateByGameId'][gameId1] = voiceState1;
            commentatorVoiceService['_voiceStateByGameId'][gameId2] = voiceState2;

            // Act
            commentatorVoiceService.resetVoiceState(gameId1);

            // Assert
            const resetVoiceState1 = commentatorVoiceService['_voiceStateByGameId'][gameId1];
            const unchangedVoiceState2 = commentatorVoiceService['_voiceStateByGameId'][gameId2];
            
            expect(resetVoiceState1).toBeInstanceOf(Map);
            expect(resetVoiceState1.size).toBe(0);
            expect(unchangedVoiceState2).toBeInstanceOf(Map);
            expect(unchangedVoiceState2.size).toBe(1);
            expect(unchangedVoiceState2.get(1)?.scoreSequence).toBe('0-1');
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
                videoLength: 30,
                previousVideoLength: 20,
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
            const boundHandleEventStart = commentatorVoiceService['boundHandleEventStart'];

            const mockEventNotification: EventNotification = {
                event: createMockEvent({
                    eventID: TEST_EVENT_ID,
                    scheduleStartTs: TEST_SCHEDULE_START_TS,
                })
            };

            // Act
            await boundHandleEventUpcoming(mockEventNotificationWithConfig);
            await boundHandleEventDetailScheduleStart(mockEventDetailNotification);
            boundHandleEventCleanup(mockSystemNotification);
            boundHandleEventStart(mockEventNotification);

            // Assert
            expect(mockOddsFeedService.getRemoteJson).toHaveBeenCalledWith(TEST_CONFIG_JSON);
            expect(mockOddsFeedService.getRemoteJson).toHaveBeenCalledWith("test-in-game-event");
            
            // Verify voice state was reset for handleEventStart
            const voiceState = commentatorVoiceService['_voiceStateByGameId'][TEST_GAME_ID];
            expect(voiceState).toBeInstanceOf(Map);
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

            // Ensure goal info returns length for both phases
            mockOddsFeedService.getRemoteJson.mockImplementation(async (url: string) => {
                if (url === TEST_CONFIG_JSON) return mockVoiceConfig as any;
                if (url === "test-in-game-event") return mockInGameEvent as any;
                return { result: ["1", "0"], length: 25, frame: [100,200], timeLine: [1,2] } as any;
            });

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
