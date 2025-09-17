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

    describe('Constructor', () => {
        it('should initialize with all dependencies', () => {
            // Arrange & Act
            const service = new InGameConsumer(container);

            // Assert
            expect(service['gameFlowService']).toBe(mockGameFlowService);
            expect(service['currentEventService']).toBe(mockCurrentEventService);
            expect(service['videoStreamingService']).toBe(mockVideoStreamingService);
        });
    });

    describe('Data Aggregation', () => {
        describe('getCurrentByGameId', () => {
            it('should aggregate data from all services correctly', () => {
                // Arrange
                const gameId = TEST_GAME_ID;

                // Act
                const result = inGameConsumer.getCurrentByGameId(gameId);

                // Assert
                expect(mockGameFlowService.getCurrentByGameId).toHaveBeenCalledWith(gameId);
                expect(mockCurrentEventService.getCurrentByGameId).toHaveBeenCalledWith(gameId);
                expect(mockVideoStreamingService.getCurrentVideoStateByGameId).toHaveBeenCalledWith(gameId);
                expect(mockVideoStreamingService.getCurrentPreloadVideoStateByGameId).toHaveBeenCalledWith(gameId);

                expect(result).toEqual({
                    gameFlow: mockGameFlowData,
                    currentEvent: mockCurrentEventData,
                    videoStreaming: mockVideoStreamingData,
                    preloadVideo: mockPreloadVideoData,
                });
            });

            it('should call each service exactly once', () => {
                // Arrange
                const gameId = TEST_GAME_ID;

                // Act
                inGameConsumer.getCurrentByGameId(gameId);

                // Assert
                expect(mockGameFlowService.getCurrentByGameId).toHaveBeenCalledTimes(1);
                expect(mockCurrentEventService.getCurrentByGameId).toHaveBeenCalledTimes(1);
                expect(mockVideoStreamingService.getCurrentVideoStateByGameId).toHaveBeenCalledTimes(1);
                expect(mockVideoStreamingService.getCurrentPreloadVideoStateByGameId).toHaveBeenCalledTimes(1);
            });

            it('should pass the correct game ID to all services', () => {
                // Arrange
                const gameId = 'test-game-123';

                // Act
                inGameConsumer.getCurrentByGameId(gameId);

                // Assert
                expect(mockGameFlowService.getCurrentByGameId).toHaveBeenCalledWith(gameId);
                expect(mockCurrentEventService.getCurrentByGameId).toHaveBeenCalledWith(gameId);
                expect(mockVideoStreamingService.getCurrentVideoStateByGameId).toHaveBeenCalledWith(gameId);
                expect(mockVideoStreamingService.getCurrentPreloadVideoStateByGameId).toHaveBeenCalledWith(gameId);
            });

            it('should handle video streaming service data correctly', () => {
                // Arrange
                const gameId = TEST_GAME_ID;
                const customVideoData = {
                    videoLink: "test-stream.m3u8",
                    timeToStream: 1000000,
                    currentTime: 30000,
                    phaseIndex: 0
                };
                const customPreloadData = { videoLink: "test-preload.m3u8" };
                mockVideoStreamingService.getCurrentVideoStateByGameId.mockReturnValue(customVideoData);
                mockVideoStreamingService.getCurrentPreloadVideoStateByGameId.mockReturnValue(customPreloadData);

                // Act
                const result = inGameConsumer.getCurrentByGameId(gameId);

                // Assert
                expect(result).toEqual({
                    gameFlow: mockGameFlowData,
                    currentEvent: mockCurrentEventData,
                    videoStreaming: customVideoData,
                    preloadVideo: customPreloadData,
                });
            });
        });
    });

    describe('Service Integration', () => {
        describe('GameFlowService integration', () => {
            it('should handle different game flow states', () => {
                // Arrange
                const gameId = TEST_GAME_ID;
                const prebetFlowData = { state: GameFlow.Prebet };
                mockGameFlowService.getCurrentByGameId.mockReturnValue(prebetFlowData);

                // Act
                const result = inGameConsumer.getCurrentByGameId(gameId);

                // Assert
                expect(result.gameFlow).toEqual(prebetFlowData);
            });

            it('should handle undefined game flow data', () => {
                // Arrange
                const gameId = TEST_GAME_ID;
                mockGameFlowService.getCurrentByGameId.mockReturnValue(undefined as any);

                // Act
                const result = inGameConsumer.getCurrentByGameId(gameId);

                // Assert
                expect(result.gameFlow).toBeUndefined();
            });
        });

        describe('CurrentEventService integration', () => {
            it('should handle different current event data', () => {
                // Arrange
                const gameId = TEST_GAME_ID;
                const differentEventData = {
                    event: 999999,
                    eventDetailIndex: 0,
                };
                mockCurrentEventService.getCurrentByGameId.mockReturnValue(differentEventData);

                // Act
                const result = inGameConsumer.getCurrentByGameId(gameId);

                // Assert
                expect(result.currentEvent).toEqual(differentEventData);
            });

            it('should handle undefined current event data', () => {
                // Arrange
                const gameId = TEST_GAME_ID;
                mockCurrentEventService.getCurrentByGameId.mockReturnValue(undefined as any);

                // Act
                const result = inGameConsumer.getCurrentByGameId(gameId);

                // Assert
                expect(result.currentEvent).toBeUndefined();
            });
        });

        describe('VideoStreamingService integration', () => {
            it('should handle different video streaming data', () => {
                // Arrange
                const gameId = TEST_GAME_ID;
                const differentVideoData = {
                    videoLink: "https://different.com/stream.m3u8",
                    timeToStream: 1640998800000,
                    currentTime: 120000,
                    phaseIndex: 2
                };
                const differentPreloadData = {
                    videoLink: "https://different.com/preload.m3u8"
                };
                mockVideoStreamingService.getCurrentVideoStateByGameId.mockReturnValue(differentVideoData);
                mockVideoStreamingService.getCurrentPreloadVideoStateByGameId.mockReturnValue(differentPreloadData);

                // Act
                const result = inGameConsumer.getCurrentByGameId(gameId);

                // Assert
                expect(result.preloadVideo).toEqual(differentPreloadData);
                expect(result.videoStreaming).toEqual(differentVideoData);
            });

            it('should handle empty video streaming data', () => {
                // Arrange
                const gameId = TEST_GAME_ID;
                mockVideoStreamingService.getCurrentVideoStateByGameId.mockReturnValue(undefined as any);
                mockVideoStreamingService.getCurrentPreloadVideoStateByGameId.mockReturnValue(undefined as any);

                // Act
                const result = inGameConsumer.getCurrentByGameId(gameId);

                // Assert
                expect(result.preloadVideo).toBeUndefined();
                expect(result.videoStreaming).toBeUndefined();
            });

            it('should handle undefined video streaming data', () => {
                // Arrange
                const gameId = TEST_GAME_ID;
                mockVideoStreamingService.getCurrentVideoStateByGameId.mockReturnValue(undefined as any);
                mockVideoStreamingService.getCurrentPreloadVideoStateByGameId.mockReturnValue(undefined as any);

                // Act
                const result = inGameConsumer.getCurrentByGameId(gameId);

                // Assert
                expect(result.preloadVideo).toBeUndefined();
                expect(result.videoStreaming).toBeUndefined();
            });
        });
    });

    describe('Edge Cases and Error Scenarios', () => {
        describe('Service failures', () => {
            it('should handle GameFlowService throwing an error', () => {
                // Arrange
                const gameId = TEST_GAME_ID;
                mockGameFlowService.getCurrentByGameId.mockImplementation(() => {
                    throw new Error('GameFlowService error');
                });

                // Act & Assert
                expect(() => {
                    inGameConsumer.getCurrentByGameId(gameId);
                }).toThrow('GameFlowService error');
            });

            it('should handle CurrentEventService throwing an error', () => {
                // Arrange
                const gameId = TEST_GAME_ID;
                mockCurrentEventService.getCurrentByGameId.mockImplementation(() => {
                    throw new Error('CurrentEventService error');
                });

                // Act & Assert
                expect(() => {
                    inGameConsumer.getCurrentByGameId(gameId);
                }).toThrow('CurrentEventService error');
            });

            it('should handle VideoStreamingService throwing an error', () => {
                // Arrange
                const gameId = TEST_GAME_ID;
                mockVideoStreamingService.getCurrentVideoStateByGameId.mockImplementation(() => {
                    throw new Error('VideoStreamingService error');
                });

                // Act & Assert
                expect(() => {
                    inGameConsumer.getCurrentByGameId(gameId);
                }).toThrow('VideoStreamingService error');
            });
        });

        describe('Data consistency', () => {
            it('should maintain data structure consistency with null values', () => {
                // Arrange
                const gameId = TEST_GAME_ID;
                mockGameFlowService.getCurrentByGameId.mockReturnValue(null as any);
                mockCurrentEventService.getCurrentByGameId.mockReturnValue(null as any);
                mockVideoStreamingService.getCurrentVideoStateByGameId.mockReturnValue(null as any);
                mockVideoStreamingService.getCurrentPreloadVideoStateByGameId.mockReturnValue(null as any);

                // Act
                const result = inGameConsumer.getCurrentByGameId(gameId);

                // Assert
                expect(result).toEqual({
                    gameFlow: null,
                    currentEvent: null,
                    videoStreaming: null,
                    preloadVideo: null,
                });
            });

            it('should handle mixed valid and invalid service responses', () => {
                // Arrange
                const gameId = TEST_GAME_ID;
                mockGameFlowService.getCurrentByGameId.mockReturnValue(mockGameFlowData);
                mockCurrentEventService.getCurrentByGameId.mockReturnValue(null as any);
                mockVideoStreamingService.getCurrentVideoStateByGameId.mockReturnValue(mockVideoStreamingData);
                mockVideoStreamingService.getCurrentPreloadVideoStateByGameId.mockReturnValue(mockPreloadVideoData);

                // Act
                const result = inGameConsumer.getCurrentByGameId(gameId);

                // Assert
                expect(result).toEqual({
                    gameFlow: mockGameFlowData,
                    currentEvent: null,
                    videoStreaming: mockVideoStreamingData,
                    preloadVideo: mockPreloadVideoData,
                });
            });
        });

        describe('Multiple game IDs', () => {
            it('should handle different game IDs independently', () => {
                // Arrange
                const gameId1 = 'game-1';
                const gameId2 = 'game-2';
                
                const gameFlowData1 = { state: GameFlow.Prebet };
                const gameFlowData2 = { state: GameFlow.Result };
                
                mockGameFlowService.getCurrentByGameId
                    .mockReturnValueOnce(gameFlowData1)
                    .mockReturnValueOnce(gameFlowData2);
                
                mockCurrentEventService.getCurrentByGameId
                    .mockReturnValue(mockCurrentEventData);
                    
                mockVideoStreamingService.getCurrentVideoStateByGameId
                    .mockReturnValue(mockVideoStreamingData);
                mockVideoStreamingService.getCurrentPreloadVideoStateByGameId
                    .mockReturnValue(mockPreloadVideoData);

                // Act
                const result1 = inGameConsumer.getCurrentByGameId(gameId1);
                const result2 = inGameConsumer.getCurrentByGameId(gameId2);

                // Assert
                expect(result1.gameFlow).toEqual(gameFlowData1);
                expect(result2.gameFlow).toEqual(gameFlowData2);
                expect(mockGameFlowService.getCurrentByGameId).toHaveBeenCalledWith(gameId1);
                expect(mockGameFlowService.getCurrentByGameId).toHaveBeenCalledWith(gameId2);
            });
        });

    });
});
