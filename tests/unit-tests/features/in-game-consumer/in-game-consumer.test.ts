import { InGameConsumer } from "../../../../src/features/in-game-consumer/in-game-consumer";
import { GameFlowService, GameFlow } from "../../../../src/features/game-flow/game-flow-service";
import { CurrentEventService } from "../../../../src/features/current-event/current-event-service";
import { VideoStreamingService } from "../../../../src/features/video-streaming/video-streaming-service";

// Mock dependencies
const mockGameFlowService = {
    getCurrentByGameId: jest.fn(),
    eventName: "gameFlow",
} as unknown as jest.Mocked<GameFlowService>;

const mockCurrentEventService = {
    getCurrentByGameId: jest.fn(),
    eventName: "currentEvent",
} as unknown as jest.Mocked<CurrentEventService>;

const mockVideoStreamingService = {
    getCurrentVideoStateByGameId: jest.fn(),
    getCurrentPreloadVideoStateByGameId: jest.fn(),
    streamingEventName: "videoStreaming",
    preloadEventName: "preloadVideo",
} as unknown as jest.Mocked<VideoStreamingService>;

// Test constants
const TEST_GAME_ID = '1';
const TEST_EVENT_ID = 4294967298;

// Test data
const mockGameFlowData = {
    state: GameFlow.Streaming
};

const mockCurrentEventData = {
    event: TEST_EVENT_ID,
    eventDetailIndex: 2,
};

const mockVideoStreamingData = {
    videoLink: "https://example.com/stream.m3u8",
    timeToStream: 1640995200000,
    currentTime: 45000,
    phaseIndex: 1
};

const mockPreloadVideoData = {
    videoLink: "https://example.com/preload.m3u8"
};

// Helper functions for test setup
const createContainer = () => ({
    gameFlowService: mockGameFlowService,
    currentEventService: mockCurrentEventService,
    videoStreamingService: mockVideoStreamingService,
});

const setupMocks = () => {
    jest.clearAllMocks();
    mockGameFlowService.getCurrentByGameId.mockReturnValue(mockGameFlowData);
    mockCurrentEventService.getCurrentByGameId.mockReturnValue(mockCurrentEventData);
    mockVideoStreamingService.getCurrentVideoStateByGameId.mockReturnValue(mockVideoStreamingData);
    mockVideoStreamingService.getCurrentPreloadVideoStateByGameId.mockReturnValue(mockPreloadVideoData);
};

describe('InGameConsumer', () => {
    let inGameConsumer: InGameConsumer;
    let container: any;

    beforeEach(() => {
        setupMocks();
        container = createContainer();
        inGameConsumer = new InGameConsumer(container);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with all dependencies', () => {
            // Arrange & Act
            const service = new InGameConsumer(container);

            // Assert
            expect(service['gameFlowService']).toBe(mockGameFlowService);
            expect(service['currentEventService']).toBe(mockCurrentEventService);
            expect(service['videoStreamingService']).toBe(mockVideoStreamingService);
        });
    });

    describe('getCurrentByGameId', () => {
        it('should aggregate data from all services using event names as keys', () => {
            // Arrange
            const gameId = TEST_GAME_ID;

            // Act
            const result = inGameConsumer.getCurrentByGameId(gameId);

            // Assert - Test the aggregated data structure
            expect(result).toEqual({
                gameFlow: mockGameFlowData,
                currentEvent: mockCurrentEventData,
                videoStreaming: mockVideoStreamingData,
                preloadVideo: mockPreloadVideoData,
            });
        });

        it('should call all service query methods with correct game ID', () => {
            // Arrange
            const gameId = 'test-game-123';

            // Act
            inGameConsumer.getCurrentByGameId(gameId);

            // Assert - Test that it calls all the query methods
            expect(mockGameFlowService.getCurrentByGameId).toHaveBeenCalledWith(gameId);
            expect(mockCurrentEventService.getCurrentByGameId).toHaveBeenCalledWith(gameId);
            expect(mockVideoStreamingService.getCurrentVideoStateByGameId).toHaveBeenCalledWith(gameId);
            expect(mockVideoStreamingService.getCurrentPreloadVideoStateByGameId).toHaveBeenCalledWith(gameId);
        });

        it('should call each service exactly once', () => {
            // Arrange
            const gameId = TEST_GAME_ID;

            // Act
            inGameConsumer.getCurrentByGameId(gameId);

            // Assert - Test call frequency
            expect(mockGameFlowService.getCurrentByGameId).toHaveBeenCalledTimes(1);
            expect(mockCurrentEventService.getCurrentByGameId).toHaveBeenCalledTimes(1);
            expect(mockVideoStreamingService.getCurrentVideoStateByGameId).toHaveBeenCalledTimes(1);
            expect(mockVideoStreamingService.getCurrentPreloadVideoStateByGameId).toHaveBeenCalledTimes(1);
        });

        it('should handle different mock data correctly', () => {
            // Arrange
            const customGameFlowData = { state: GameFlow.Prebet };
            const customCurrentEventData = { event: 999, eventDetailIndex: 0 };
            const customVideoData = { videoLink: "custom.m3u8", timeToStream: 0, currentTime: 0, phaseIndex: 0 };
            const customPreloadData = { videoLink: "custom-preload.m3u8" };

            mockGameFlowService.getCurrentByGameId.mockReturnValue(customGameFlowData);
            mockCurrentEventService.getCurrentByGameId.mockReturnValue(customCurrentEventData);
            mockVideoStreamingService.getCurrentVideoStateByGameId.mockReturnValue(customVideoData);
            mockVideoStreamingService.getCurrentPreloadVideoStateByGameId.mockReturnValue(customPreloadData);

            // Act
            const result = inGameConsumer.getCurrentByGameId(TEST_GAME_ID);

            // Assert - Test with different data
            expect(result).toEqual({
                gameFlow: customGameFlowData,
                currentEvent: customCurrentEventData,
                videoStreaming: customVideoData,
                preloadVideo: customPreloadData,
            });
        });

        it('should handle undefined preload data', () => {
            // Arrange
            (mockVideoStreamingService.getCurrentPreloadVideoStateByGameId as jest.Mock).mockReturnValue(undefined);

            // Act
            const result = inGameConsumer.getCurrentByGameId(TEST_GAME_ID);

            // Assert - Test with undefined preload data
            expect(result).toEqual({
                gameFlow: mockGameFlowData,
                currentEvent: mockCurrentEventData,
                videoStreaming: mockVideoStreamingData,
                preloadVideo: undefined,
            });
        });
    });
});