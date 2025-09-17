import { VideoStreamingService, VideoState, PreloadVideoState } from "../../../../src/features/video-streaming/video-streaming-service";
import { OddFeedEventSource, OddFeedEventName, EventDetailNotification } from "../../../../src/features/odd-feed-data/odd-feed-event-source";
import { DelayHandlingService } from "../../../../src/features/delay/delay-handling-service";
import { Scheduler } from "../../../../src/features/scheduler/scheduler";
import { GameFlowService } from "../../../../src/features/game-flow/game-flow-service";
import { GameBroadcastService } from "../../../../src/services/game-broadcast.service";
import { Event } from "../../../../src/types";
import { idHelper } from "../../../../src/helpers";

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

const mockGameFlowService = {
    getTrackPointByGameId: jest.fn(),
} as unknown as jest.Mocked<GameFlowService>;

const mockGameBoardcastService = {
    broadcastToAllClientByGameId: jest.fn(),
} as unknown as jest.Mocked<GameBroadcastService>;

// Test constants
const TEST_GAME_ID_1 = "1";
const TEST_EVENT_ID_1 = 4294967298; // gameId: 1, roundId: 2
const TEST_EVENT_ID_2 = 8589934594; // gameId: 2, roundId: 2
const TEST_INDEX = 1;
const TEST_INDEX_2 = 2;
const TEST_TRACK_POINT = 1640995200000; // Mock timestamp
const TEST_PLAYLIST_URL_1 = "https://example.com/playlist1.m3u8";
const TEST_PLAYLIST_URL_2 = "https://example.com/playlist2.m3u8";

// Test data
const createMockEvent = (eventID: number, scheduleStartTs: string, playlist: string): Event => ({
    eventID,
    eventNameAKey: "Team A",
    eventNameBKey: "Team B",
    scheduleStartTs,
    productCode: "TEST",
    productTypeKey: "MARBLE",
    eventDetails: [
        {
            eventID,
            oddsAvailableTs: scheduleStartTs,
            scheduleStartTs,
            resultsAvailableTs: scheduleStartTs,
            hasResults: false,
            goalInfo: "{}",
            playlist,
            result: "",
            markets: {},
            inGameEventInfo: "{}"
        },
        {
            eventID,
            oddsAvailableTs: scheduleStartTs,
            scheduleStartTs,
            resultsAvailableTs: scheduleStartTs,
            hasResults: false,
            goalInfo: "{}",
            playlist: playlist + "_phase2",
            result: "",
            markets: {},
            inGameEventInfo: "{}"
        }
    ]
});

const mockEvent1 = createMockEvent(TEST_EVENT_ID_1, "2024-01-01T10:00:00Z", TEST_PLAYLIST_URL_1);
const mockEvent2 = createMockEvent(TEST_EVENT_ID_2, "2024-01-01T11:00:00Z", TEST_PLAYLIST_URL_2);

const mockEventDetailNotification1: EventDetailNotification = {
    event: mockEvent1,
    index: TEST_INDEX
};

const mockEventDetailNotification2: EventDetailNotification = {
    event: mockEvent2,
    index: TEST_INDEX_2
};

// Helper functions for test setup
const createContainer = () => ({
    oddFeedEventSource: mockOddFeedEventSource,
    delayHandlingService: mockDelayHandlingService,
    scheduler: mockScheduler,
    gameFlowService: mockGameFlowService,
    gameBoardcastService: mockGameBoardcastService,
});

const setupMocks = () => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockDelayHandlingService.getDelayedTimeWithVideoDelay.mockReturnValue(new Date("2024-01-01T10:00:00Z"));
    mockDelayHandlingService.getDelayedTime.mockReturnValue(new Date("2024-01-01T09:59:30Z"));
    mockGameFlowService.getTrackPointByGameId.mockReturnValue(TEST_TRACK_POINT);
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
            expect(service['gameFlowService']).toBe(mockGameFlowService);
            expect(service['gameBoardcastService']).toBe(mockGameBoardcastService);
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
            // Arrange
            const expectedVideoDelayTime = new Date("2024-01-01T10:00:00Z");
            const expectedPreloadTime = new Date("2024-01-01T09:59:30Z");
            mockDelayHandlingService.getDelayedTimeWithVideoDelay.mockReturnValue(expectedVideoDelayTime);
            mockDelayHandlingService.getDelayedTime.mockReturnValue(expectedPreloadTime);

            // Act
            videoStreamingService.handleEventDetailScheduleStart(mockEventDetailNotification1);

            // Assert - Test that it calls the scheduler with correct parameters
            expect(mockScheduler.schedule).toHaveBeenCalledTimes(2);
            expect(mockScheduler.schedule).toHaveBeenNthCalledWith(1, expectedVideoDelayTime, expect.any(Function));
            expect(mockScheduler.schedule).toHaveBeenNthCalledWith(2, expectedPreloadTime, expect.any(Function));
        });
    });

    describe("onLiveStreamStart", () => {
        beforeEach(() => {
            // Mock Date.now for consistent testing
            jest.spyOn(Date, 'now').mockReturnValue(1640995260000); // 1 minute after track point
            // Mock query methods to return predictable data
            mockDelayHandlingService.getDelayedTimeWithVideoDelay.mockReturnValue(new Date("2024-01-01T10:00:00Z"));
            mockGameFlowService.getTrackPointByGameId.mockReturnValue(TEST_TRACK_POINT);
        });

        it("should update video state and broadcast to clients", () => {
            // Arrange
            jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID_1);

            // Act
            videoStreamingService.onLiveStreamStart(mockEventDetailNotification1);

            // Assert - Test that it calls the broadcast service
            expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                TEST_GAME_ID_1,
                expect.any(Object), // We don't test the exact object structure here
                videoStreamingService.streamingEventName
            );
        });

        it("should call gameFlowService to get track point for logging", () => {
            // Arrange
            jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID_1);

            // Act
            videoStreamingService.onLiveStreamStart(mockEventDetailNotification1);

            // Assert - Test that it calls the query method
            expect(mockGameFlowService.getTrackPointByGameId).toHaveBeenCalledWith(TEST_GAME_ID_1);
        });
    });

    describe("onLiveStreamPreload", () => {
        it("should broadcast preload video state to clients", () => {
            // Arrange
            jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID_1);

            // Act
            videoStreamingService.onLiveStreamPreload(mockEventDetailNotification1);

            // Assert - Test that it calls the broadcast service
            expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                TEST_GAME_ID_1,
                expect.any(Object), // We don't test the exact object structure here
                videoStreamingService.preloadEventName
            );
        });
    });

    describe("getCurrentVideoStateByGameId", () => {
        beforeEach(() => {
            // Set up some initial state for testing query methods
            const testVideoState: VideoState = {
                videoLink: TEST_PLAYLIST_URL_1,
                timeToStream: 1640995200000,
                currentTime: 0,
                phaseIndex: TEST_INDEX,
            };
            videoStreamingService['_currentVideoStateByGameId'][TEST_GAME_ID_1] = testVideoState;
        });

        it("should return current video state with calculated current time", () => {
            // Arrange
            const currentTime = 1640995260000; // 1 minute after stream start
            jest.spyOn(Date, 'now').mockReturnValue(currentTime);

            // Act
            const result = videoStreamingService.getCurrentVideoStateByGameId(TEST_GAME_ID_1);

            // Assert - Test the data structure and calculation
            expect(result).toEqual({
                videoLink: TEST_PLAYLIST_URL_1,
                timeToStream: 1640995200000,
                currentTime: 60000, // 1 minute difference
                phaseIndex: TEST_INDEX,
            });
        });

        it("should handle non-existent game gracefully", () => {
            // Act & Assert
            expect(() => {
                videoStreamingService.getCurrentVideoStateByGameId("non-existent-game");
            }).toThrow();
        });
    });

    describe("getCurrentPreloadVideoStateByGameId", () => {
        beforeEach(() => {
            // Set up some initial state for testing query methods
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
    });


});
