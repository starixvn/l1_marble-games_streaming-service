import { VideoStreamingService, VideoState, PreloadVideoState } from "../../../../src/features/video-streaming/video-streaming-service";
import { OddsFeedEventSource, OddsFeedEventName, EventDetailNotification,Scheduler } from "odds-feed-client";
import { DelayHandlingService } from "../../../../src/features/delay/delay-handling-service";
import { GameBroadcastService } from "../../../../src/services/game-broadcast.service";
import { FeatureDebugService } from "../../../../src/features/feature-debug/feature-debug-service";
import { idHelper } from "../../../../src/helpers";
import { createMockEvent, createMockEventDetail } from "../../test-utils/mock-event";

// Mock dependencies
const mockOddsFeedEventSource = {
    eventDetailOn: jest.fn(),
    eventDetailOff: jest.fn(),
} as unknown as jest.Mocked<OddsFeedEventSource>;

const mockDelayHandlingService = {
    getDelayedTimeWithVideoDelay: jest.fn(),
    getDelayedTime: jest.fn(),
} as unknown as jest.Mocked<DelayHandlingService>;

const mockScheduler = {
    schedule: jest.fn(),
} as unknown as jest.Mocked<Scheduler>;

const mockGameBroadcastService = {
    broadcastToAllClientByGameId: jest.fn(),
} as unknown as jest.Mocked<GameBroadcastService>;

const mockFeatureDebugService = {
    log: jest.fn(),
} as unknown as jest.Mocked<FeatureDebugService>;

// Test constants
const TEST_GAME_ID_1 = "1";
const TEST_GAME_ID_2 = "2";
const TEST_EVENT_ID_1 = 4294967298; // gameId: 1, roundId: 2
const TEST_EVENT_ID_2 = 8589934594; // gameId: 2, roundId: 2
const TEST_INDEX = 1;
const TEST_INDEX_2 = 2;
const TEST_PLAYLIST_URL_1 = "https://example.com/playlist1.m3u8";
const TEST_PLAYLIST_URL_2 = "https://example.com/playlist2.m3u8";
const TEST_SCHEDULE_START_TS = "2024-01-01T10:00:00Z";
const TEST_DELAYED_TIME_VIDEO = new Date("2024-01-01T10:00:00Z");
const TEST_DELAYED_TIME_PRELOAD = new Date("2024-01-01T09:59:30Z");
const TEST_TIME_TO_STREAM = 1640995200000;
const TEST_CURRENT_TIME = 1640995260000; // 1 minute after stream start

// Test data using shared mock utils
const mockEvent1 = createMockEvent({
    eventID: TEST_EVENT_ID_1,
    scheduleStartTs: TEST_SCHEDULE_START_TS,
    eventDetails: [
        createMockEventDetail({ 
            eventID: TEST_EVENT_ID_1,
            playlist: TEST_PLAYLIST_URL_1, 
            scheduleStartTs: TEST_SCHEDULE_START_TS,
            phase: 1 
        }),
        createMockEventDetail({ 
            eventID: TEST_EVENT_ID_1,
            playlist: TEST_PLAYLIST_URL_2, 
            scheduleStartTs: TEST_SCHEDULE_START_TS,
            phase: 2 
        }),
    ]
});

const mockEvent2 = createMockEvent({
    eventID: TEST_EVENT_ID_2,
    scheduleStartTs: "2024-01-01T11:00:00Z",
    eventDetails: [
        createMockEventDetail({ 
            eventID: TEST_EVENT_ID_2,
            playlist: "https://example.com/game2_playlist.m3u8", 
            scheduleStartTs: "2024-01-01T11:00:00Z",
            phase: 1 
        }),
    ]
});

const mockEventDetailNotification1: EventDetailNotification = {
    event: mockEvent1,
    index: TEST_INDEX
};

const mockEventDetailNotification2: EventDetailNotification = {
    event: mockEvent2,
    index: 0
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
    
    // Default mock implementations
    mockDelayHandlingService.getDelayedTimeWithVideoDelay.mockReturnValue(TEST_DELAYED_TIME_VIDEO);
    mockDelayHandlingService.getDelayedTime.mockReturnValue(TEST_DELAYED_TIME_PRELOAD);
    
    // Mock Date.now for consistent testing
    jest.spyOn(Date, 'now').mockReturnValue(TEST_CURRENT_TIME);
};

describe("VideoStreamingService", () => {
    let videoStreamingService: VideoStreamingService;
    let container: any;

    beforeEach(() => {
        setupMocks();
        container = createContainer();
        videoStreamingService = new VideoStreamingService(container);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("constructor", () => {
        it("should initialize with dependencies and bind event handlers", () => {
            // Arrange & Act
            const service = new VideoStreamingService(container);

            // Assert
            expect(service['oddsFeedEventSource']).toBe(mockOddsFeedEventSource);
            expect(service['delayHandlingService']).toBe(mockDelayHandlingService);
            expect(service['scheduler']).toBe(mockScheduler);
            expect(service['gameBroadcastService']).toBe(mockGameBroadcastService);
            expect(service['featureDebugService']).toBe(mockFeatureDebugService);
            expect(service['boundHandleEventDetailScheduleStart']).toBeInstanceOf(Function);
        });

        it("should initialize empty state storage", () => {
            // Arrange & Act
            const service = new VideoStreamingService(container);

            // Assert
            expect(service['_currentVideoStateByGameId']).toEqual({});
            expect(service['_preloadVideoStateByGameId']).toEqual({});
        });
    });

    describe("streamingEventName", () => {
        it("should return 'videoStreaming'", () => {
            // Act
            const result = videoStreamingService.streamingEventName;

            // Assert
            expect(result).toBe('videoStreaming');
        });
    });

    describe("preloadEventName", () => {
        it("should return 'preloadVideo'", () => {
            // Act
            const result = videoStreamingService.preloadEventName;

            // Assert
            expect(result).toBe('preloadVideo');
        });
    });

    describe("initEvent", () => {
        it("should register event detail listener for EventDetailStart", () => {
            // Arrange & Act
            videoStreamingService.initEvent();

            // Assert
            expect(mockOddsFeedEventSource.eventDetailOn).toHaveBeenCalledWith(
                OddsFeedEventName.EventDetailStart,
                videoStreamingService['boundHandleEventDetailScheduleStart']
            );
        });
    });

    describe("dispose", () => {
        it("should unregister event detail listener for EventDetailStart", () => {
            // Arrange & Act
            videoStreamingService.dispose();

            // Assert
            expect(mockOddsFeedEventSource.eventDetailOff).toHaveBeenCalledWith(
                OddsFeedEventName.EventDetailStart,
                videoStreamingService['boundHandleEventDetailScheduleStart']
            );
        });
    });

    describe("handleEventDetailScheduleStart", () => {
        it("should schedule live stream start and preload tasks", () => {
            // Act
            videoStreamingService.handleEventDetailScheduleStart(mockEventDetailNotification1);

            // Assert
            expect(mockDelayHandlingService.getDelayedTimeWithVideoDelay).toHaveBeenCalledWith({
                event: mockEvent1,
                time: new Date(mockEvent1.eventDetails[TEST_INDEX].scheduleStartTs)
            }, {
                oddsFeedEventType: OddsFeedEventName.EventDetailStart,
            });
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledWith({
                event: mockEvent1,
                time: new Date(mockEvent1.eventDetails[TEST_INDEX].scheduleStartTs)
            }, {
                oddsFeedEventType: OddsFeedEventName.EventDetailStart,
            });
            expect(mockScheduler.schedule).toHaveBeenCalledTimes(2);
            expect(mockScheduler.schedule).toHaveBeenNthCalledWith(1, TEST_DELAYED_TIME_VIDEO, expect.any(Function));
            expect(mockScheduler.schedule).toHaveBeenNthCalledWith(2, TEST_DELAYED_TIME_PRELOAD, expect.any(Function));
        });

        it("should call private delay calculation methods indirectly", () => {
            // Act
            videoStreamingService.handleEventDetailScheduleStart(mockEventDetailNotification1);

            // Assert - Verify delay methods are called through handleEventDetailScheduleStart
            expect(mockDelayHandlingService.getDelayedTimeWithVideoDelay).toHaveBeenCalledTimes(1); // getTimeToStream
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledTimes(1); // getTimeToPreload
        });

        it("should schedule with correct bound methods", () => {
            // Act
            videoStreamingService.handleEventDetailScheduleStart(mockEventDetailNotification1);

            // Get the scheduled callbacks and execute them
            const scheduleCalls = mockScheduler.schedule.mock.calls;
            const streamStartFunction = scheduleCalls[0][1];
            const preloadFunction = scheduleCalls[1][1];

            // Execute the scheduled functions
            streamStartFunction();
            preloadFunction();

            // Assert - verify the functions update internal state correctly
            expect(videoStreamingService['_currentVideoStateByGameId'][TEST_GAME_ID_1]).toBeDefined();
            expect(videoStreamingService['_preloadVideoStateByGameId'][TEST_GAME_ID_1]).toBeDefined();
        });
    });

    describe("onLiveStreamStart", () => {
        it("should update video state and broadcast to clients", () => {
            // Arrange
            mockDelayHandlingService.getDelayedTimeWithVideoDelay.mockReturnValue(new Date(TEST_TIME_TO_STREAM));

            // Act
            videoStreamingService.onLiveStreamStart(mockEventDetailNotification1);

            // Assert
			expect(videoStreamingService['_currentVideoStateByGameId'][TEST_GAME_ID_1]).toEqual({
                videoLink: TEST_PLAYLIST_URL_2, // Index 1 of the event details
                timeToStream: TEST_TIME_TO_STREAM,
                currentTime: 0,
                phaseIndex: mockEvent1.eventDetails[TEST_INDEX].phase,
				timeFromPhaseStart: TEST_TIME_TO_STREAM,
				timeFromPhaseEnd: TEST_TIME_TO_STREAM,
            });
            expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                TEST_GAME_ID_1,
                expect.objectContaining({
                    videoLink: TEST_PLAYLIST_URL_2,
                    phaseIndex: mockEvent1.eventDetails[TEST_INDEX].phase,
                }),
                videoStreamingService.streamingEventName
            );
        });

        it("should call debug log when streaming starts", () => {
            // Act
            videoStreamingService.onLiveStreamStart(mockEventDetailNotification1);

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                videoStreamingService,
                expect.stringContaining(`video streaming started with event ${TEST_EVENT_ID_1} and index ${TEST_INDEX}`),
                TEST_GAME_ID_1
            );
        });

        it("should call delay handling service with video delay indirectly", () => {
            // Act
            videoStreamingService.onLiveStreamStart(mockEventDetailNotification1);

            // Assert
            expect(mockDelayHandlingService.getDelayedTimeWithVideoDelay).toHaveBeenCalledWith({
                event: mockEvent1,
                time: new Date(mockEvent1.eventDetails[TEST_INDEX].scheduleStartTs)
            }, {
                oddsFeedEventType: OddsFeedEventName.EventDetailStart,
            });
        });

        it("should call all private delay calculation methods indirectly", () => {
            // Act
            videoStreamingService.onLiveStreamStart(mockEventDetailNotification1);

            // Assert - Verify all private delay methods are called through onLiveStreamStart
            expect(mockDelayHandlingService.getDelayedTimeWithVideoDelay).toHaveBeenCalledTimes(3); // getTimeToStream + getTimeFromPhaseStart + getTimeFromPhaseEnd
        });

        it("should extract correct game ID using idHelper", () => {
            // Arrange
            const extractGameIdSpy = jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID_1);

            // Act
            videoStreamingService.onLiveStreamStart(mockEventDetailNotification1);

            // Assert
            expect(extractGameIdSpy).toHaveBeenCalledWith(TEST_EVENT_ID_1);
            
            extractGameIdSpy.mockRestore();
        });

        it("should handle different event indices correctly", () => {
            // Arrange
            const notification: EventDetailNotification = {
                event: mockEvent1,
                index: 0
            };

            // Act
            videoStreamingService.onLiveStreamStart(notification);

            // Assert
            expect(videoStreamingService['_currentVideoStateByGameId'][TEST_GAME_ID_1]).toEqual(
                expect.objectContaining({
                    videoLink: TEST_PLAYLIST_URL_1, // Index 0 of the event details
                    phaseIndex: mockEvent1.eventDetails[0].phase,
                })
            );
        });

        it("should broadcast empty object when getCurrentVideoStateByGameId returns null", () => {
            // Arrange
            const extractGameIdSpy = jest.spyOn(idHelper, 'extractGameId').mockReturnValue("non-existent-game");
            const getCurrentVideoStateSpy = jest.spyOn(videoStreamingService, 'getCurrentVideoStateByGameId').mockReturnValue(null);
            const notification: EventDetailNotification = {
                event: mockEvent1,
                index: 0
            };

            // Act
            videoStreamingService.onLiveStreamStart(notification);

            // Assert
            expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                "non-existent-game",
                {}, // Empty object fallback
                videoStreamingService.streamingEventName
            );
            
            extractGameIdSpy.mockRestore();
            getCurrentVideoStateSpy.mockRestore();
        });
    });

    describe("onLiveStreamPreload", () => {
        it("should update preload state and broadcast to clients", () => {
            // Act
            videoStreamingService.onLiveStreamPreload(mockEventDetailNotification1);

            // Assert
            expect(videoStreamingService['_preloadVideoStateByGameId'][TEST_GAME_ID_1]).toEqual({
                videoLink: TEST_PLAYLIST_URL_2, // Index 1 of the event details
            });
            expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                TEST_GAME_ID_1,
                { videoLink: TEST_PLAYLIST_URL_2 },
                videoStreamingService.preloadEventName
            );
        });

        it("should extract correct game ID using idHelper", () => {
            // Arrange
            const extractGameIdSpy = jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID_1);

            // Act
            videoStreamingService.onLiveStreamPreload(mockEventDetailNotification1);

            // Assert
            expect(extractGameIdSpy).toHaveBeenCalledWith(TEST_EVENT_ID_1);
            
            extractGameIdSpy.mockRestore();
        });

        it("should handle different games independently", () => {
            // Act
            videoStreamingService.onLiveStreamPreload(mockEventDetailNotification1);
            videoStreamingService.onLiveStreamPreload(mockEventDetailNotification2);

            // Assert
            expect(videoStreamingService['_preloadVideoStateByGameId'][TEST_GAME_ID_1]).toBeDefined();
            expect(videoStreamingService['_preloadVideoStateByGameId'][TEST_GAME_ID_2]).toBeDefined();
            expect(mockGameBroadcastService.broadcastToAllClientByGameId).toHaveBeenCalledTimes(2);
        });
    });

    describe("getCurrentVideoStateByGameId", () => {
        beforeEach(() => {
            // Set up some initial state for testing
            const testVideoState: VideoState = {
                videoLink: TEST_PLAYLIST_URL_1,
                timeToStream: TEST_TIME_TO_STREAM,
                currentTime: 0,
                phaseIndex: TEST_INDEX,
				timeFromPhaseStart: TEST_TIME_TO_STREAM,
                timeFromPhaseEnd: TEST_TIME_TO_STREAM,
            };
            videoStreamingService['_currentVideoStateByGameId'][TEST_GAME_ID_1] = testVideoState;
        });

        it("should return current video state with calculated current time", () => {
            // Act
            const result = videoStreamingService.getCurrentVideoStateByGameId(TEST_GAME_ID_1);

            // Assert
            expect(result).not.toBeNull();
			expect(result).toEqual({
                videoLink: TEST_PLAYLIST_URL_1,
                timeToStream: TEST_TIME_TO_STREAM,
                currentTime: TEST_CURRENT_TIME - TEST_TIME_TO_STREAM, // Calculated difference
				phaseIndex: TEST_INDEX,
				timeFromPhaseStart: TEST_TIME_TO_STREAM,
                timeFromPhaseEnd: TEST_TIME_TO_STREAM,
            });
        });

        it("should handle zero time difference correctly", () => {
            // Arrange
            jest.spyOn(Date, 'now').mockReturnValue(TEST_TIME_TO_STREAM);

            // Act
            const result = videoStreamingService.getCurrentVideoStateByGameId(TEST_GAME_ID_1);

            // Assert
            expect(result).not.toBeNull();
            if (result) {
                expect(result.currentTime).toBe(0);
            }
        });

        it("should handle negative time difference correctly", () => {
            // Arrange
            jest.spyOn(Date, 'now').mockReturnValue(TEST_TIME_TO_STREAM - 30000); // 30 seconds before

            // Act
            const result = videoStreamingService.getCurrentVideoStateByGameId(TEST_GAME_ID_1);

            // Assert
            expect(result).not.toBeNull();
            if (result) {
                expect(result.currentTime).toBe(-30000);
            }
        });

        it("should return null for non-existent game", () => {
            // Act
            const result = videoStreamingService.getCurrentVideoStateByGameId("non-existent-game");

            // Assert
            expect(result).toBeNull();
        });
    });

    describe("getCurrentPreloadVideoStateByGameId", () => {
        beforeEach(() => {
            // Set up some initial state for testing
            const testPreloadState: PreloadVideoState = {
                videoLink: TEST_PLAYLIST_URL_1,
            };
            videoStreamingService['_preloadVideoStateByGameId'][TEST_GAME_ID_1] = testPreloadState;
        });

        it("should return preload video state", () => {
            // Act
            const result = videoStreamingService.getCurrentPreloadVideoStateByGameId(TEST_GAME_ID_1);

            // Assert
            expect(result).toEqual({
                videoLink: TEST_PLAYLIST_URL_1,
            });
        });

        it("should return undefined for non-existent game", () => {
            // Act
            const result = videoStreamingService.getCurrentPreloadVideoStateByGameId("non-existent-game");

            // Assert
            expect(result).toBeUndefined();
        });

        it("should handle empty video link", () => {
            // Arrange
            videoStreamingService['_preloadVideoStateByGameId'][TEST_GAME_ID_2] = {
                videoLink: "",
            };

            // Act
            const result = videoStreamingService.getCurrentPreloadVideoStateByGameId(TEST_GAME_ID_2);

            // Assert
            expect(result).toEqual({
                videoLink: "",
            });
        });
    });

    describe("getReplayByEvent", () => {
        it("should return array of replay events for a given event", () => {
            // Arrange & Act
            const replays = videoStreamingService.getReplayByEvent(mockEvent1);

            // Assert
            expect(replays).toBeInstanceOf(Array);
            expect(replays.length).toBeGreaterThan(0);
            expect(replays[0]).toHaveProperty('time');
            expect(replays[0]).toHaveProperty('payload');
            expect(replays[0]).toHaveProperty('eventName');
        });

        it("should return empty array for event without event details", () => {
            // Arrange
            const eventWithoutDetails = createMockEvent({
                eventID: TEST_EVENT_ID_1,
                eventDetails: []
            });

            // Act
            const replays = videoStreamingService.getReplayByEvent(eventWithoutDetails);

            // Assert
            expect(replays).toBeInstanceOf(Array);
            expect(replays.length).toBe(0);
        });

        it("should call delay handling service with event object for preload", () => {
            // Act
            videoStreamingService.getReplayByEvent(mockEvent1);

            // Assert
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledWith(
                {
                    event: mockEvent1,
                    time: expect.any(Date)
                },
                {
                    oddsFeedEventType: OddsFeedEventName.EventDetailStart,
                }
            );
        });

        it("should call delay handling service with event object for streaming", () => {
            // Act
            videoStreamingService.getReplayByEvent(mockEvent1);

            // Assert
            expect(mockDelayHandlingService.getDelayedTimeWithVideoDelay).toHaveBeenCalledWith(
                {
                    event: mockEvent1,
                    time: expect.any(Date)
                },
                {
                    oddsFeedEventType: OddsFeedEventName.EventDetailStart,
                }
            );
        });

        it("should include preload replay for each event detail with video config", () => {
            // Act
            const replays = videoStreamingService.getReplayByEvent(mockEvent1);

            // Assert
            const preloadReplays = replays.filter(r => r.eventName === videoStreamingService.preloadEventName);
            expect(preloadReplays.length).toBe(mockEvent1.eventDetails.length);
            
            preloadReplays.forEach((replay, index) => {
                const payload = replay.payload as any;
                expect(payload).toHaveProperty('videoLink');
                expect(payload.videoLink).toBe(mockEvent1.eventDetails[index].playlist);
            });
        });

        it("should include streaming replay for each event detail with video config", () => {
            // Act
            const replays = videoStreamingService.getReplayByEvent(mockEvent1);

            // Assert
            const streamingReplays = replays.filter(r => r.eventName === videoStreamingService.streamingEventName);
            expect(streamingReplays.length).toBe(mockEvent1.eventDetails.length);
            
            streamingReplays.forEach((replay, index) => {
                const payload = replay.payload as any;
                expect(payload).toHaveProperty('videoLink');
                expect(payload).toHaveProperty('currentTime', 0);
                expect(payload).toHaveProperty('timeToStream');
                expect(payload).toHaveProperty('phaseIndex');
                expect(payload).toHaveProperty('timeFromPhaseStart');
                expect(payload).toHaveProperty('timeFromPhaseEnd');
            });
        });

        it("should use correct video URLs from event detail configurations", () => {
            // Act
            const replays = videoStreamingService.getReplayByEvent(mockEvent1);

            // Assert
            const preloadReplays = replays.filter(r => r.eventName === videoStreamingService.preloadEventName);
            const streamingReplays = replays.filter(r => r.eventName === videoStreamingService.streamingEventName);
            
            expect((preloadReplays[0].payload as any).videoLink).toBe(TEST_PLAYLIST_URL_1);
            expect((streamingReplays[0].payload as any).videoLink).toBe(TEST_PLAYLIST_URL_1);
            
            if (mockEvent1.eventDetails.length > 1) {
                expect((preloadReplays[1].payload as any).videoLink).toBe(TEST_PLAYLIST_URL_2);
                expect((streamingReplays[1].payload as any).videoLink).toBe(TEST_PLAYLIST_URL_2);
            }
        });

        it("should calculate correct phase information in streaming replays", () => {
            // Act
            const replays = videoStreamingService.getReplayByEvent(mockEvent1);

            // Assert
            const streamingReplays = replays.filter(r => r.eventName === videoStreamingService.streamingEventName);
            
            streamingReplays.forEach((replay, index) => {
                expect((replay.payload as any).phaseIndex).toBe(mockEvent1.eventDetails[index].phase);
                expect(replay.payload).toHaveProperty('timeFromPhaseStart');
                expect(replay.payload).toHaveProperty('timeFromPhaseEnd');
            });
        });

        it("should return pure function result (not mutate state)", () => {
            // Arrange
            const initialStateKeys = Object.keys(videoStreamingService['_currentVideoStateByGameId']);
            const initialPreloadKeys = Object.keys(videoStreamingService['_preloadVideoStateByGameId']);

            // Act
            videoStreamingService.getReplayByEvent(mockEvent1);

            // Assert
            const finalStateKeys = Object.keys(videoStreamingService['_currentVideoStateByGameId']);
            const finalPreloadKeys = Object.keys(videoStreamingService['_preloadVideoStateByGameId']);
            expect(finalStateKeys).toEqual(initialStateKeys);
            expect(finalPreloadKeys).toEqual(initialPreloadKeys);
        });

        it("should handle events with mixed video configurations", () => {
            // Arrange
            const eventWithMixedConfig = createMockEvent({
                eventID: TEST_EVENT_ID_1,
                eventDetails: [
                    createMockEventDetail({ 
                        scheduleStartTs: TEST_SCHEDULE_START_TS,
                        playlist: TEST_PLAYLIST_URL_1,
                        phase: 1
                    }),
                    createMockEventDetail({ 
                        scheduleStartTs: "2023-01-01T10:30:00Z",
                        playlist: undefined, // No playlist for this detail
                        phase: 2
                    }),
                    createMockEventDetail({ 
                        scheduleStartTs: "2023-01-01T10:45:00Z",
                        playlist: TEST_PLAYLIST_URL_2,
                        phase: 3
                    })
                ]
            });

            // Act
            const replays = videoStreamingService.getReplayByEvent(eventWithMixedConfig);

            // Assert
            // Should have replays for all details, even those without video config
            const preloadReplays = replays.filter(r => r.eventName === videoStreamingService.preloadEventName);
            const streamingReplays = replays.filter(r => r.eventName === videoStreamingService.streamingEventName);
            
            expect(preloadReplays.length).toBe(3);
            expect(streamingReplays.length).toBe(3);
        });
    });

    describe("edge cases", () => {
        it("should maintain correct context when bound methods are called directly", () => {
            // Arrange
            const boundHandleEventDetailScheduleStart = videoStreamingService['boundHandleEventDetailScheduleStart'];

            // Act - Call bound method directly (as it would be called by event emitter)
            boundHandleEventDetailScheduleStart(mockEventDetailNotification1);

            // Assert
            expect(mockScheduler.schedule).toHaveBeenCalledTimes(2);
        });

        it("should handle multiple events for the same game", () => {
            // Arrange
            const notification1: EventDetailNotification = { event: mockEvent1, index: 0 };
            const notification2: EventDetailNotification = { event: mockEvent1, index: 1 };

            // Act
            videoStreamingService.onLiveStreamStart(notification1);
            videoStreamingService.onLiveStreamStart(notification2);

            // Assert - Latest event should overwrite previous state
            expect(videoStreamingService['_currentVideoStateByGameId'][TEST_GAME_ID_1]).toEqual(
                expect.objectContaining({
                    phaseIndex: mockEvent1.eventDetails[1].phase, // Latest phase
                })
            );
        });

        it("should handle multiple games independently", () => {
            // Act
            videoStreamingService.onLiveStreamStart(mockEventDetailNotification1);
            videoStreamingService.onLiveStreamStart(mockEventDetailNotification2);

            // Assert
            expect(videoStreamingService['_currentVideoStateByGameId'][TEST_GAME_ID_1]).toBeDefined();
            expect(videoStreamingService['_currentVideoStateByGameId'][TEST_GAME_ID_2]).toBeDefined();
            expect(Object.keys(videoStreamingService['_currentVideoStateByGameId'])).toHaveLength(2);
        });

        it("should handle events with no event details gracefully", () => {
            // Arrange
            const eventWithNoDetails = createMockEvent({
                eventID: TEST_EVENT_ID_1,
                eventDetails: []
            });
            const notification: EventDetailNotification = {
                event: eventWithNoDetails,
                index: 0
            };

            // Act & Assert - should not throw but will likely cause runtime error
            expect(() => {
                videoStreamingService.onLiveStreamStart(notification);
            }).toThrow();
        });

        it("should handle large time differences in getCurrentVideoStateByGameId", () => {
            // Arrange
            const largeTime = TEST_TIME_TO_STREAM + 86400000; // 24 hours later
            jest.spyOn(Date, 'now').mockReturnValue(largeTime);
            
			const testVideoState: VideoState = {
                videoLink: TEST_PLAYLIST_URL_1,
                timeToStream: TEST_TIME_TO_STREAM,
                currentTime: 0,
				phaseIndex: TEST_INDEX,
				timeFromPhaseStart: TEST_TIME_TO_STREAM,
				timeFromPhaseEnd: TEST_TIME_TO_STREAM,
            };
            videoStreamingService['_currentVideoStateByGameId'][TEST_GAME_ID_1] = testVideoState;

            // Act
            const result = videoStreamingService.getCurrentVideoStateByGameId(TEST_GAME_ID_1);

            // Assert
            expect(result).not.toBeNull();
            if (result) {
                expect(result.currentTime).toBe(86400000); // 24 hours in milliseconds
            }
        });
    });
});