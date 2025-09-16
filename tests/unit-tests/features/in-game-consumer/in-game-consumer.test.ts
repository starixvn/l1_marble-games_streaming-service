import { InGameConsumer } from "../../../../src/features/in-game-consumer/in-game-consumer";
import { GameFlowService, GameFlow } from "../../../../src/features/game-flow/game-flow-service";
import { CurrentEventService } from "../../../../src/features/current-event/current-event-service";
import { VideoStreamingService } from "../../../../src/features/video-streaming/video-streaming-service";

// Mock dependencies
const mockGameFlowService = {
    getCurrentByGameId: jest.fn(),
} as unknown as jest.Mocked<GameFlowService>;

const mockCurrentEventService = {
    getCurrentByGameId: jest.fn(),
} as unknown as jest.Mocked<CurrentEventService>;

const mockVideoStreamingService = {
    getCurrentByGameId: jest.fn(),
} as unknown as jest.Mocked<VideoStreamingService>;

// Test constants
const TEST_GAME_ID = '1';
const TEST_EVENT_ID = 4294967298;

// Test data
const mockGameFlowData = {
    gameFlow: GameFlow.Streaming
};

const mockCurrentEventData = {
    currentEvent: {
        event: TEST_EVENT_ID,
        eventDetailIndex: 2,
    }
};

const mockVideoStreamingData = {
    preloadVideo: {
        videoLink: "https://example.com/preload.m3u8"
    },
    videoStreaming: {
        videoLink: "https://example.com/stream.m3u8",
        timeToStream: 1640995200000,
        currentTime: 45000,
        phaseIndex: 1
    }
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
    mockVideoStreamingService.getCurrentByGameId.mockReturnValue(mockVideoStreamingData);
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
                expect(mockVideoStreamingService.getCurrentByGameId).toHaveBeenCalledWith(gameId);

                expect(result).toEqual({
                    gameFlow: mockGameFlowData.gameFlow,
                    currentEvent: mockCurrentEventData.currentEvent,
                    preloadVideo: mockVideoStreamingData.preloadVideo,
                    videoStreaming: mockVideoStreamingData.videoStreaming,
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
                expect(mockVideoStreamingService.getCurrentByGameId).toHaveBeenCalledTimes(1);
            });

            it('should pass the correct game ID to all services', () => {
                // Arrange
                const gameId = 'test-game-123';

                // Act
                inGameConsumer.getCurrentByGameId(gameId);

                // Assert
                expect(mockGameFlowService.getCurrentByGameId).toHaveBeenCalledWith(gameId);
                expect(mockCurrentEventService.getCurrentByGameId).toHaveBeenCalledWith(gameId);
                expect(mockVideoStreamingService.getCurrentByGameId).toHaveBeenCalledWith(gameId);
            });

            it('should spread video streaming service data correctly', () => {
                // Arrange
                const gameId = TEST_GAME_ID;
                const videoData = {
                    preloadVideo: { videoLink: "test-preload.m3u8" },
                    videoStreaming: { 
                        videoLink: "test-stream.m3u8",
                        timeToStream: 1000000,
                        currentTime: 30000,
                        phaseIndex: 0
                    },
                    additionalProperty: "should be included"
                };
                mockVideoStreamingService.getCurrentByGameId.mockReturnValue(videoData as any);

                // Act
                const result = inGameConsumer.getCurrentByGameId(gameId);

                // Assert
                expect(result).toEqual({
                    gameFlow: mockGameFlowData.gameFlow,
                    currentEvent: mockCurrentEventData.currentEvent,
                    preloadVideo: videoData.preloadVideo,
                    videoStreaming: videoData.videoStreaming,
                    additionalProperty: videoData.additionalProperty,
                });
            });
        });
    });

    describe('Service Integration', () => {
        describe('GameFlowService integration', () => {
            it('should handle different game flow states', () => {
                // Arrange
                const gameId = TEST_GAME_ID;
                const prebetFlowData = { gameFlow: GameFlow.Prebet };
                mockGameFlowService.getCurrentByGameId.mockReturnValue(prebetFlowData);

                // Act
                const result = inGameConsumer.getCurrentByGameId(gameId);

                // Assert
                expect(result.gameFlow).toBe(prebetFlowData.gameFlow);
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
                    currentEvent: {
                        event: 999999,
                        eventDetailIndex: 0,
                    }
                };
                mockCurrentEventService.getCurrentByGameId.mockReturnValue(differentEventData);

                // Act
                const result = inGameConsumer.getCurrentByGameId(gameId);

                // Assert
                expect(result.currentEvent).toEqual(differentEventData.currentEvent);
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
                    preloadVideo: {
                        videoLink: "https://different.com/preload.m3u8"
                    },
                    videoStreaming: {
                        videoLink: "https://different.com/stream.m3u8",
                        timeToStream: 1640998800000,
                        currentTime: 120000,
                        phaseIndex: 2
                    }
                };
                mockVideoStreamingService.getCurrentByGameId.mockReturnValue(differentVideoData as any);

                // Act
                const result = inGameConsumer.getCurrentByGameId(gameId);

                // Assert
                expect(result.preloadVideo).toEqual(differentVideoData.preloadVideo);
                expect(result.videoStreaming).toEqual(differentVideoData.videoStreaming);
            });

            it('should handle empty video streaming data', () => {
                // Arrange
                const gameId = TEST_GAME_ID;
                const emptyVideoData = {};
                mockVideoStreamingService.getCurrentByGameId.mockReturnValue(emptyVideoData as any);

                // Act
                const result = inGameConsumer.getCurrentByGameId(gameId);

                // Assert
                expect(result.preloadVideo).toBeUndefined();
                expect(result.videoStreaming).toBeUndefined();
            });

            it('should handle undefined video streaming data', () => {
                // Arrange
                const gameId = TEST_GAME_ID;
                mockVideoStreamingService.getCurrentByGameId.mockReturnValue(undefined as any);

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
                mockVideoStreamingService.getCurrentByGameId.mockImplementation(() => {
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
                mockVideoStreamingService.getCurrentByGameId.mockReturnValue(null as any);

                // Act
                const result = inGameConsumer.getCurrentByGameId(gameId);

                // Assert
                expect(result).toEqual({});
                expect(result).not.toHaveProperty('gameFlow');
                expect(result).not.toHaveProperty('currentEvent');
            });

            it('should handle mixed valid and invalid service responses', () => {
                // Arrange
                const gameId = TEST_GAME_ID;
                mockGameFlowService.getCurrentByGameId.mockReturnValue(mockGameFlowData);
                mockCurrentEventService.getCurrentByGameId.mockReturnValue(null as any);
                mockVideoStreamingService.getCurrentByGameId.mockReturnValue(mockVideoStreamingData as any);

                // Act
                const result = inGameConsumer.getCurrentByGameId(gameId);

                // Assert
                expect(result).toEqual({
                    gameFlow: mockGameFlowData.gameFlow,
                    preloadVideo: mockVideoStreamingData.preloadVideo,
                    videoStreaming: mockVideoStreamingData.videoStreaming,
                });
            });
        });

        describe('Multiple game IDs', () => {
            it('should handle different game IDs independently', () => {
                // Arrange
                const gameId1 = 'game-1';
                const gameId2 = 'game-2';
                
                const gameFlowData1 = { gameFlow: GameFlow.Prebet };
                const gameFlowData2 = { gameFlow: GameFlow.Result };
                
                mockGameFlowService.getCurrentByGameId
                    .mockReturnValueOnce(gameFlowData1)
                    .mockReturnValueOnce(gameFlowData2);
                
                mockCurrentEventService.getCurrentByGameId
                    .mockReturnValue(mockCurrentEventData);
                    
                mockVideoStreamingService.getCurrentByGameId
                    .mockReturnValue(mockVideoStreamingData as any);

                // Act
                const result1 = inGameConsumer.getCurrentByGameId(gameId1);
                const result2 = inGameConsumer.getCurrentByGameId(gameId2);

                // Assert
                expect(result1.gameFlow).toBe(gameFlowData1.gameFlow);
                expect(result2.gameFlow).toBe(gameFlowData2.gameFlow);
                expect(mockGameFlowService.getCurrentByGameId).toHaveBeenCalledWith(gameId1);
                expect(mockGameFlowService.getCurrentByGameId).toHaveBeenCalledWith(gameId2);
            });
        });

        describe('Object spread behavior', () => {
            it('should handle object spread with conflicting properties', () => {
                // Arrange
                const gameId = TEST_GAME_ID;
                const videoDataWithConflict = {
                    gameFlow: "conflicting-game-flow", // This should override the gameFlow property
                    currentEvent: "conflicting-current-event", // This should override the currentEvent property
                    preloadVideo: mockVideoStreamingData.preloadVideo,
                    videoStreaming: mockVideoStreamingData.videoStreaming,
                };
                mockVideoStreamingService.getCurrentByGameId.mockReturnValue(videoDataWithConflict as any);

                // Act
                const result = inGameConsumer.getCurrentByGameId(gameId);

                // Assert
                // The spread operator should override the earlier properties
                expect(result.gameFlow).toBe("conflicting-game-flow");
                expect(result.currentEvent).toBe("conflicting-current-event");
                expect(result.preloadVideo).toEqual(mockVideoStreamingData.preloadVideo);
                expect(result.videoStreaming).toEqual(mockVideoStreamingData.videoStreaming);
            });

            it('should preserve all properties from video streaming service', () => {
                // Arrange
                const gameId = TEST_GAME_ID;
                const videoDataWithExtra = {
                    ...mockVideoStreamingData,
                    extraProperty1: "value1",
                    extraProperty2: { nested: "value2" },
                    extraProperty3: 12345,
                };
                mockVideoStreamingService.getCurrentByGameId.mockReturnValue(videoDataWithExtra as any);

                // Act
                const result = inGameConsumer.getCurrentByGameId(gameId);

                // Assert
                expect((result as any).extraProperty1).toBe("value1");
                expect((result as any).extraProperty2).toEqual({ nested: "value2" });
                expect((result as any).extraProperty3).toBe(12345);
            });
        });
    });
});
