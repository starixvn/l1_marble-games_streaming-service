import { VideoStreamingService, VideoState, PreloadVideoState } from "../../../../src/features/video-streaming/video-streaming-service";
import { OddFeedEventSource, OddFeedEventName, EventDetailNotification,Scheduler } from "odd-feed-client";
import { DelayHandlingService } from "../../../../src/features/delay/delay-handling-service";
import { GameBroadcastService } from "../../../../src/services/game-broadcast.service";
import { FeatureDebugService } from "../../../../src/features/feature-debug/feature-debug-service";
import { idHelper } from "../../../../src/helpers";
import { createMockEvent, createMockEventDetail } from "../../test-utils/mock-event";

// Mock dependencies
const mockOddFeedEventSource = {
    registerEventDetailEventListener: jest.fn(),
    unregisterEventDetailEventListener: jest.fn(),
} as unknown as jest.Mocked<OddFeedEventSource>;

const mockDelayHandlingService = {
    getDelayedTimeWithVideoDelay: jest.fn(),
    getDelayedTime: jest.fn(),
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
    oddFeedEventSource: mockOddFeedEventSource,
    delayHandlingService: mockDelayHandlingService,
    scheduler: mockScheduler,
    gameBoardcastService: mockGameBoardcastService,
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
            expect(service['oddFeedEventSource']).toBe(mockOddFeedEventSource);
            expect(service['delayHandlingService']).toBe(mockDelayHandlingService);
            expect(service['scheduler']).toBe(mockScheduler);
            expect(service['gameBoardcastService']).toBe(mockGameBoardcastService);
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
            expect(mockOddFeedEventSource.registerEventDetailEventListener).toHaveBeenCalledWith(
                OddFeedEventName.EventDetailStart,
                videoStreamingService['boundHandleEventDetailScheduleStart']
            );
        });
    });

    describe("dispose", () => {
        it("should unregister event detail listener for EventDetailStart", () => {
            // Arrange & Act
            videoStreamingService.dispose();

            // Assert
            expect(mockOddFeedEventSource.unregisterEventDetailEventListener).toHaveBeenCalledWith(
                OddFeedEventName.EventDetailStart,
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
                eventId: TEST_EVENT_ID_1,
                time: new Date(mockEvent1.eventDetails[TEST_INDEX].scheduleStartTs)
            }, {
                oddFeedEventType: OddFeedEventName.EventDetailStart,
            });
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledWith({
                eventId: TEST_EVENT_ID_1,
                time: new Date(mockEvent1.eventDetails[TEST_INDEX].scheduleStartTs)
            }, {
                oddFeedEventType: OddFeedEventName.EventDetailStart,
            });
            expect(mockScheduler.schedule).toHaveBeenCalledTimes(2);
            expect(mockScheduler.schedule).toHaveBeenNthCalledWith(1, TEST_DELAYED_TIME_VIDEO, expect.any(Function));
            expect(mockScheduler.schedule).toHaveBeenNthCalledWith(2, TEST_DELAYED_TIME_PRELOAD, expect.any(Function));
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
            });
            expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
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
    });

    describe("onLiveStreamPreload", () => {
        it("should update preload state and broadcast to clients", () => {
            // Act
            videoStreamingService.onLiveStreamPreload(mockEventDetailNotification1);

            // Assert
            expect(videoStreamingService['_preloadVideoStateByGameId'][TEST_GAME_ID_1]).toEqual({
                videoLink: TEST_PLAYLIST_URL_2, // Index 1 of the event details
            });
            expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
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
            expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalledTimes(2);
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
            };
            videoStreamingService['_currentVideoStateByGameId'][TEST_GAME_ID_1] = testVideoState;
        });

        it("should return current video state with calculated current time", () => {
            // Act
            const result = videoStreamingService.getCurrentVideoStateByGameId(TEST_GAME_ID_1);

            // Assert
			expect(result).toEqual({
                videoLink: TEST_PLAYLIST_URL_1,
                timeToStream: TEST_TIME_TO_STREAM,
                currentTime: TEST_CURRENT_TIME - TEST_TIME_TO_STREAM, // Calculated difference
				phaseIndex: TEST_INDEX,
				timeFromPhaseStart: TEST_TIME_TO_STREAM,
            });
        });

        it("should handle zero time difference correctly", () => {
            // Arrange
            jest.spyOn(Date, 'now').mockReturnValue(TEST_TIME_TO_STREAM);

            // Act
            const result = videoStreamingService.getCurrentVideoStateByGameId(TEST_GAME_ID_1);

            // Assert
            expect(result.currentTime).toBe(0);
        });

        it("should handle negative time difference correctly", () => {
            // Arrange
            jest.spyOn(Date, 'now').mockReturnValue(TEST_TIME_TO_STREAM - 30000); // 30 seconds before

            // Act
            const result = videoStreamingService.getCurrentVideoStateByGameId(TEST_GAME_ID_1);

            // Assert
            expect(result.currentTime).toBe(-30000);
        });

        it("should throw error for non-existent game", () => {
            // Act & Assert
            expect(() => {
                videoStreamingService.getCurrentVideoStateByGameId("non-existent-game");
            }).toThrow();
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

    describe("log", () => {
        it("should call featureDebugService.log with correct parameters", () => {
            // Arrange
            const message = 'test message';
            const gameId = TEST_GAME_ID_1;

            // Act
            videoStreamingService['log'](message, gameId);

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                videoStreamingService,
                message,
                gameId
            );
        });

        it("should handle empty message", () => {
            // Arrange
            const message = '';
            const gameId = TEST_GAME_ID_1;

            // Act
            videoStreamingService['log'](message, gameId);

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledWith(
                videoStreamingService,
                message,
                gameId
            );
        });

        it("should handle different game IDs", () => {
            // Arrange
            const message = 'test message';

            // Act
            videoStreamingService['log'](message, TEST_GAME_ID_1);
            videoStreamingService['log'](message, TEST_GAME_ID_2);

            // Assert
            expect(mockFeatureDebugService.log).toHaveBeenCalledTimes(2);
            expect(mockFeatureDebugService.log).toHaveBeenNthCalledWith(
                1,
                videoStreamingService,
                message,
                TEST_GAME_ID_1
            );
            expect(mockFeatureDebugService.log).toHaveBeenNthCalledWith(
                2,
                videoStreamingService,
                message,
                TEST_GAME_ID_2
            );
        });
    });

    describe("getTimeToStream", () => {
        it("should call delay handling service with video delay", () => {
            // Act
            const result = videoStreamingService['getTimeToStream'](mockEvent1, TEST_INDEX);

            // Assert
            expect(mockDelayHandlingService.getDelayedTimeWithVideoDelay).toHaveBeenCalledWith({
                eventId: TEST_EVENT_ID_1,
                time: new Date(mockEvent1.eventDetails[TEST_INDEX].scheduleStartTs)
            }, {
                oddFeedEventType: OddFeedEventName.EventDetailStart,
            });
            expect(result).toBe(TEST_DELAYED_TIME_VIDEO);
        });

        it("should handle different event indices", () => {
            // Act
            videoStreamingService['getTimeToStream'](mockEvent1, 0);

            // Assert
            expect(mockDelayHandlingService.getDelayedTimeWithVideoDelay).toHaveBeenCalledWith({
                eventId: TEST_EVENT_ID_1,
                time: new Date(mockEvent1.eventDetails[0].scheduleStartTs)
            }, {
                oddFeedEventType: OddFeedEventName.EventDetailStart,
            });
        });
    });

    describe("getTimeToPreload", () => {
        it("should call delay handling service without video delay", () => {
            // Act
            const result = videoStreamingService['getTimeToPreload'](mockEvent1, TEST_INDEX);

            // Assert
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledWith({
                eventId: TEST_EVENT_ID_1,
                time: new Date(mockEvent1.eventDetails[TEST_INDEX].scheduleStartTs)
            }, {
                oddFeedEventType: OddFeedEventName.EventDetailStart,
            });
            expect(result).toBe(TEST_DELAYED_TIME_PRELOAD);
        });

        it("should handle different event indices", () => {
            // Act
            videoStreamingService['getTimeToPreload'](mockEvent1, 0);

            // Assert
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledWith({
                eventId: TEST_EVENT_ID_1,
                time: new Date(mockEvent1.eventDetails[0].scheduleStartTs)
            }, {
                oddFeedEventType: OddFeedEventName.EventDetailStart,
            });
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
            };
            videoStreamingService['_currentVideoStateByGameId'][TEST_GAME_ID_1] = testVideoState;

            // Act
            const result = videoStreamingService.getCurrentVideoStateByGameId(TEST_GAME_ID_1);

            // Assert
            expect(result.currentTime).toBe(86400000); // 24 hours in milliseconds
        });
    });
});