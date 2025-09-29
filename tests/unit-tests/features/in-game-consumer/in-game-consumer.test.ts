import { InGameConsumer } from "../../../../src/features/in-game-consumer/in-game-consumer";
import { GameFlowService, GameFlow } from "../../../../src/features/game-flow/game-flow-service";
import { CurrentEventService } from "../../../../src/features/current-event/current-event-service";
import { VideoStreamingService } from "../../../../src/features/video-streaming/video-streaming-service";
import { ResultService } from "../../../../src/features/result/result-service";
import { LiveScoreService } from "../../../../src/features/live-score/live-score-service";
import { TeamNameService } from "../../../../src/features/team-name/team-name-service";
import { IntroService } from "../../../../src/features/intro/intro-service";

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

const mockResultService = {
    getCurrentByGameId: jest.fn(),
    eventName: "result",
} as unknown as jest.Mocked<ResultService>;

const mockLiveScoreService = {
    getCurrentByGameId: jest.fn(),
    eventName: "liveScore",
} as unknown as jest.Mocked<LiveScoreService>;

const mockTeamNameService = {
    getCurrentByGameId: jest.fn(),
    eventName: "teamName",
} as unknown as jest.Mocked<TeamNameService>;

const mockIntroService = {
    getCurrentByGameId: jest.fn(),
    eventName: "intro",
} as unknown as jest.Mocked<IntroService>;

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
    phase: 1
};

const mockVideoStreamingData = {
    videoLink: "https://example.com/stream.m3u8",
    timeToStream: 1640995200000,
    currentTime: 45000,
    phaseIndex: 1,
    timeFromPhaseStart: 1640995200000
};

const mockPreloadVideoData = {
    videoLink: "https://example.com/preload.m3u8"
};

const mockResultData = {
    result: {
        1: { homeScore: 2, awayScore: 1 },
        2: { homeScore: 2, awayScore: 1 }
    }
};

const mockLiveScoreData = {
    homeScore: 1,
    awayScore: 1
};

const mockTeamNameData = {
    homeTeamName: "Team A",
    awayTeamName: "Team B"
};

const mockIntroData = {
    resourceServer: "https://example.com",
    introTime: 1640995200000,
    timeToPlay: 1640995205000,
    isPlaying: false,
    duration: 5000
};

// Helper functions for test setup
const createContainer = () => ({
    gameFlowService: mockGameFlowService,
    currentEventService: mockCurrentEventService,
    videoStreamingService: mockVideoStreamingService,
    resultService: mockResultService,
    liveScoreService: mockLiveScoreService,
    teamNameService: mockTeamNameService,
    introService: mockIntroService,
});

const setupMocks = () => {
    jest.clearAllMocks();
    mockGameFlowService.getCurrentByGameId.mockReturnValue(mockGameFlowData);
    mockCurrentEventService.getCurrentByGameId.mockReturnValue(mockCurrentEventData);
    mockVideoStreamingService.getCurrentVideoStateByGameId.mockReturnValue(mockVideoStreamingData);
    mockVideoStreamingService.getCurrentPreloadVideoStateByGameId.mockReturnValue(mockPreloadVideoData);
    mockResultService.getCurrentByGameId.mockReturnValue(mockResultData);
    mockLiveScoreService.getCurrentByGameId.mockReturnValue(mockLiveScoreData);
    mockTeamNameService.getCurrentByGameId.mockReturnValue(mockTeamNameData);
    mockIntroService.getCurrentByGameId.mockReturnValue(mockIntroData);
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
            expect(service['resultService']).toBe(mockResultService);
            expect(service['liveScoreService']).toBe(mockLiveScoreService);
            expect(service['teamNameService']).toBe(mockTeamNameService);
            expect(service['introService']).toBe(mockIntroService);
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
                result: mockResultData,
                liveScore: mockLiveScoreData,
                teamName: mockTeamNameData,
                intro: mockIntroData,
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
            expect(mockResultService.getCurrentByGameId).toHaveBeenCalledWith(gameId);
            expect(mockLiveScoreService.getCurrentByGameId).toHaveBeenCalledWith(gameId);
            expect(mockTeamNameService.getCurrentByGameId).toHaveBeenCalledWith(gameId);
            expect(mockIntroService.getCurrentByGameId).toHaveBeenCalledWith(gameId);
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
            expect(mockResultService.getCurrentByGameId).toHaveBeenCalledTimes(1);
            expect(mockLiveScoreService.getCurrentByGameId).toHaveBeenCalledTimes(1);
            expect(mockTeamNameService.getCurrentByGameId).toHaveBeenCalledTimes(1);
            expect(mockIntroService.getCurrentByGameId).toHaveBeenCalledTimes(1);
        });

        it('should handle different mock data correctly', () => {
            // Arrange
            const customGameFlowData = { state: GameFlow.Prebet };
            const customCurrentEventData = { event: 999, eventDetailIndex: 0, phase: 0 };
            const customVideoData = { videoLink: "custom.m3u8", timeToStream: 0, currentTime: 0, phaseIndex: 0, timeFromPhaseStart: 0 };
            const customPreloadData = { videoLink: "custom-preload.m3u8" };
            const customResultData = { result: { 1: { homeScore: 0, awayScore: 0 } } };
            const customLiveScoreData = { homeScore: 0, awayScore: 0 };
            const customTeamNameData = { homeTeamName: "Custom Home", awayTeamName: "Custom Away" };
            const customIntroData = { resourceServer: "https://custom.com", introTime: 0, timeToPlay: 3000, isPlaying: true, duration: 3000 };

            mockGameFlowService.getCurrentByGameId.mockReturnValue(customGameFlowData);
            mockCurrentEventService.getCurrentByGameId.mockReturnValue(customCurrentEventData);
            mockVideoStreamingService.getCurrentVideoStateByGameId.mockReturnValue(customVideoData);
            mockVideoStreamingService.getCurrentPreloadVideoStateByGameId.mockReturnValue(customPreloadData);
            mockResultService.getCurrentByGameId.mockReturnValue(customResultData);
            mockLiveScoreService.getCurrentByGameId.mockReturnValue(customLiveScoreData);
            mockTeamNameService.getCurrentByGameId.mockReturnValue(customTeamNameData);
            mockIntroService.getCurrentByGameId.mockReturnValue(customIntroData);

            // Act
            const result = inGameConsumer.getCurrentByGameId(TEST_GAME_ID);

            // Assert - Test with different data
            expect(result).toEqual({
                gameFlow: customGameFlowData,
                currentEvent: customCurrentEventData,
                videoStreaming: customVideoData,
                preloadVideo: customPreloadData,
                result: customResultData,
                liveScore: customLiveScoreData,
                teamName: customTeamNameData,
                intro: customIntroData,
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
                result: mockResultData,
                liveScore: mockLiveScoreData,
                teamName: mockTeamNameData,
                intro: mockIntroData,
            });
        });

        it('should handle null data from any service', () => {
            // Arrange
            (mockResultService.getCurrentByGameId as jest.Mock).mockReturnValue(null);
            (mockLiveScoreService.getCurrentByGameId as jest.Mock).mockReturnValue(null);
            (mockTeamNameService.getCurrentByGameId as jest.Mock).mockReturnValue(null);
            (mockIntroService.getCurrentByGameId as jest.Mock).mockReturnValue(null);

            // Act
            const result = inGameConsumer.getCurrentByGameId(TEST_GAME_ID);

            // Assert - Test with multiple null data
            expect(result).toEqual({
                gameFlow: mockGameFlowData,
                currentEvent: mockCurrentEventData,
                videoStreaming: mockVideoStreamingData,
                preloadVideo: mockPreloadVideoData,
                result: null,
                liveScore: null,
                teamName: null,
                intro: null,
            });
        });
    });
});