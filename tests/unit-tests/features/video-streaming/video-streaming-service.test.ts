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
const TEST_GAME_ID_2 = "2";
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

    describe("Constructor", () => {
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

    describe("Event Listener Management", () => {
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
    });

    describe("Event Handlers", () => {
        describe("handleEventDetailScheduleStart", () => {
            it("should schedule live stream start and preload with correct timing", () => {
                // Arrange
                const expectedVideoDelayTime = new Date("2024-01-01T10:00:00Z");
                const expectedPreloadTime = new Date("2024-01-01T09:59:30Z");
                mockDelayHandlingService.getDelayedTimeWithVideoDelay.mockReturnValue(expectedVideoDelayTime);
                mockDelayHandlingService.getDelayedTime.mockReturnValue(expectedPreloadTime);

                // Act
                videoStreamingService.handleEventDetailScheduleStart(mockEventDetailNotification1);

                // Assert
                expect(mockDelayHandlingService.getDelayedTimeWithVideoDelay).toHaveBeenCalledWith({
                    eventId: TEST_EVENT_ID_1,
                    time: new Date(mockEvent1.eventDetails[TEST_INDEX].scheduleStartTs)
                });
                expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledWith({
                    eventId: TEST_EVENT_ID_1,
                    time: new Date(mockEvent1.eventDetails[TEST_INDEX].scheduleStartTs)
                });
                expect(mockScheduler.schedule).toHaveBeenCalledTimes(2);
                expect(mockScheduler.schedule).toHaveBeenNthCalledWith(1, expectedVideoDelayTime, expect.any(Function));
                expect(mockScheduler.schedule).toHaveBeenNthCalledWith(2, expectedPreloadTime, expect.any(Function));
            });

            it("should handle different events with different timings", () => {
                // Arrange
                const videoDelayTime1 = new Date("2024-01-01T10:00:00Z");
                const preloadTime1 = new Date("2024-01-01T09:59:30Z");
                const videoDelayTime2 = new Date("2024-01-01T11:00:00Z");
                const preloadTime2 = new Date("2024-01-01T10:59:30Z");

                // Create notification with valid index for second event
                const validNotification2: EventDetailNotification = {
                    event: mockEvent2,
                    index: 0 // Use index 0 which exists in the mock data
                };

                mockDelayHandlingService.getDelayedTimeWithVideoDelay
                    .mockReturnValueOnce(videoDelayTime1)
                    .mockReturnValueOnce(videoDelayTime2);
                mockDelayHandlingService.getDelayedTime
                    .mockReturnValueOnce(preloadTime1)
                    .mockReturnValueOnce(preloadTime2);

                // Act
                videoStreamingService.handleEventDetailScheduleStart(mockEventDetailNotification1);
                videoStreamingService.handleEventDetailScheduleStart(validNotification2);

                // Assert
                expect(mockScheduler.schedule).toHaveBeenCalledTimes(4);
                expect(mockScheduler.schedule).toHaveBeenNthCalledWith(1, videoDelayTime1, expect.any(Function));
                expect(mockScheduler.schedule).toHaveBeenNthCalledWith(2, preloadTime1, expect.any(Function));
                expect(mockScheduler.schedule).toHaveBeenNthCalledWith(3, videoDelayTime2, expect.any(Function));
                expect(mockScheduler.schedule).toHaveBeenNthCalledWith(4, preloadTime2, expect.any(Function));
            });
        });

        describe("onLiveStreamStart", () => {
            beforeEach(() => {
                // Mock Date.now for consistent testing
                jest.spyOn(Date, 'now').mockReturnValue(1640995260000); // 1 minute after track point
            });

            it("should set current video state for game", () => {
                // Arrange
                jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID_1);

                // Act
                videoStreamingService.onLiveStreamStart(mockEventDetailNotification1);

                // Assert
                const actualState = videoStreamingService['_currentVideoStateByGameId'][TEST_GAME_ID_1];
                expect(actualState.videoLink).toBe(mockEvent1.eventDetails[TEST_INDEX].playlist);
                expect(actualState.currentTime).toBe(0);
                expect(actualState.phaseIndex).toBe(TEST_INDEX);
                expect(actualState.timeToStream).toBeDefined();
                expect(typeof actualState.timeToStream).toBe('number');
            });

            it("should call gameFlowService to get track point and log message", () => {
                // Arrange
                jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID_1);
                const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

                // Act
                videoStreamingService.onLiveStreamStart(mockEventDetailNotification1);

                // Assert
                expect(mockGameFlowService.getTrackPointByGameId).toHaveBeenCalledWith(TEST_GAME_ID_1);
                expect(consoleSpy).toHaveBeenCalledWith(
                    expect.stringContaining(`video streaming started for game ${TEST_GAME_ID_1} with event ${TEST_EVENT_ID_1} and index ${TEST_INDEX}`)
                );

                consoleSpy.mockRestore();
            });

            it("should handle multiple games correctly", () => {
                // Arrange
                const validNotification2: EventDetailNotification = {
                    event: mockEvent2,
                    index: 0 // Use valid index
                };
                jest.spyOn(idHelper, 'extractGameId')
                    .mockReturnValueOnce(TEST_GAME_ID_1)
                    .mockReturnValueOnce(TEST_GAME_ID_2);

                // Act
                videoStreamingService.onLiveStreamStart(mockEventDetailNotification1);
                videoStreamingService.onLiveStreamStart(validNotification2);

                // Assert
                expect(videoStreamingService['_currentVideoStateByGameId'][TEST_GAME_ID_1]).toBeDefined();
                expect(videoStreamingService['_currentVideoStateByGameId'][TEST_GAME_ID_2]).toBeDefined();
                expect(videoStreamingService['_currentVideoStateByGameId'][TEST_GAME_ID_1].videoLink).toBe(mockEvent1.eventDetails[TEST_INDEX].playlist);
                expect(videoStreamingService['_currentVideoStateByGameId'][TEST_GAME_ID_2].videoLink).toBe(mockEvent2.eventDetails[0].playlist);
            });

            it("should calculate correct track time difference", () => {
                // Arrange
                const currentTime = 1640995320000; // 2 minutes after track point
                jest.spyOn(Date, 'now').mockReturnValue(currentTime);
                jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID_1);
                const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

                // Act
                videoStreamingService.onLiveStreamStart(mockEventDetailNotification1);

                // Assert
                const expectedDiffInSeconds = (currentTime - TEST_TRACK_POINT) / 1000;
                expect(consoleSpy).toHaveBeenCalledWith(
                    expect.stringContaining(`track time: ${expectedDiffInSeconds}`)
                );

                consoleSpy.mockRestore();
            });
        });

        describe("onLiveStreamPreload", () => {
            it("should set preload video state for game", () => {
                // Arrange
                jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID_1);

                // Act
                videoStreamingService.onLiveStreamPreload(mockEventDetailNotification1);

                // Assert
                const expectedPreloadState: PreloadVideoState = {
                    videoLink: mockEvent1.eventDetails[TEST_INDEX].playlist,
                };
                expect(videoStreamingService['_preloadVideoStateByGameId'][TEST_GAME_ID_1]).toEqual(expectedPreloadState);
            });

            it("should broadcast preload video state to clients", () => {
                // Arrange
                jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID_1);

                // Act
                videoStreamingService.onLiveStreamPreload(mockEventDetailNotification1);

                // Assert
                const expectedBroadcastData = {
                    preloadVideo: {
                        videoLink: mockEvent1.eventDetails[TEST_INDEX].playlist,
                    }
                };
                expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalledWith(
                    TEST_GAME_ID_1,
                    expectedBroadcastData
                );
            });

            it("should handle multiple games preloading", () => {
                // Arrange
                const validNotification2: EventDetailNotification = {
                    event: mockEvent2,
                    index: 0 // Use valid index
                };
                jest.spyOn(idHelper, 'extractGameId')
                    .mockReturnValueOnce(TEST_GAME_ID_1)
                    .mockReturnValueOnce(TEST_GAME_ID_2);

                // Act
                videoStreamingService.onLiveStreamPreload(mockEventDetailNotification1);
                videoStreamingService.onLiveStreamPreload(validNotification2);

                // Assert
                expect(videoStreamingService['_preloadVideoStateByGameId'][TEST_GAME_ID_1]).toBeDefined();
                expect(videoStreamingService['_preloadVideoStateByGameId'][TEST_GAME_ID_2]).toBeDefined();
                expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalledTimes(2);
                expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenNthCalledWith(1, TEST_GAME_ID_1, expect.any(Object));
                expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenNthCalledWith(2, TEST_GAME_ID_2, expect.any(Object));
            });
        });
    });

    describe("State Management", () => {
        beforeEach(() => {
            // Set up some initial state for testing
            const testVideoState: VideoState = {
                videoLink: TEST_PLAYLIST_URL_1,
                timeToStream: 1640995200000,
                currentTime: 0,
                phaseIndex: TEST_INDEX,
            };
            const testPreloadState: PreloadVideoState = {
                videoLink: TEST_PLAYLIST_URL_1,
            };
            videoStreamingService['_currentVideoStateByGameId'][TEST_GAME_ID_1] = testVideoState;
            videoStreamingService['_preloadVideoStateByGameId'][TEST_GAME_ID_1] = testPreloadState;
        });

        describe("getCurrentVideoStateByGameId", () => {
            it("should return current video state with updated current time", () => {
                // Arrange
                const currentTime = 1640995260000; // 1 minute after stream start
                jest.spyOn(Date, 'now').mockReturnValue(currentTime);

                // Act
                const result = videoStreamingService.getCurrentVideoStateByGameId(TEST_GAME_ID_1);

                // Assert
                const expectedCurrentTime = currentTime - 1640995200000; // 60000ms = 1 minute
                expect(result).toEqual({
                    videoLink: TEST_PLAYLIST_URL_1,
                    timeToStream: 1640995200000,
                    currentTime: expectedCurrentTime,
                    phaseIndex: TEST_INDEX,
                });
            });

            it("should throw error when game state does not exist", () => {
                // Act & Assert
                expect(() => {
                    videoStreamingService.getCurrentVideoStateByGameId("non-existent-game");
                }).toThrow();
            });
        });

        describe("getCurrentPreloadVideoStateByGameId", () => {
            it("should return preload video state", () => {
                // Act
                const result = videoStreamingService.getCurrentPreloadVideoStateByGameId(TEST_GAME_ID_1);

                // Assert
                expect(result).toEqual({
                    videoLink: TEST_PLAYLIST_URL_1,
                });
            });

            it("should return undefined when preload state does not exist", () => {
                // Act
                const result = videoStreamingService.getCurrentPreloadVideoStateByGameId("non-existent-game");

                // Assert
                expect(result).toBeUndefined();
            });
        });

        describe("getCurrentByGameId", () => {
            it("should return combined preload and video streaming state", () => {
                // Arrange
                const currentTime = 1640995260000;
                jest.spyOn(Date, 'now').mockReturnValue(currentTime);

                // Act
                const result = videoStreamingService.getCurrentByGameId(TEST_GAME_ID_1);

                // Assert
                expect(result).toEqual({
                    preloadVideo: {
                        videoLink: TEST_PLAYLIST_URL_1,
                    },
                    videoStreaming: {
                        videoLink: TEST_PLAYLIST_URL_1,
                        timeToStream: 1640995200000,
                        currentTime: 60000,
                        phaseIndex: TEST_INDEX,
                    }
                });
            });

            it("should throw error when video streaming state does not exist", () => {
                // Act & Assert
                expect(() => {
                    videoStreamingService.getCurrentByGameId("non-existent-game");
                }).toThrow();
            });

            it("should throw error when video state is missing but preload state exists", () => {
                // Arrange
                // Remove video state but keep preload state
                delete videoStreamingService['_currentVideoStateByGameId'][TEST_GAME_ID_1];

                // Act & Assert
                expect(() => {
                    videoStreamingService.getCurrentByGameId(TEST_GAME_ID_1);
                }).toThrow();
            });
        });
    });

    describe("Edge Cases and Integration", () => {
        describe("Bound methods preservation", () => {
            it("should maintain correct context when bound method is called directly", () => {
                // Arrange
                const boundHandler = videoStreamingService['boundHandleEventDetailScheduleStart'];
                
                // Act & Assert - should not throw
                expect(() => {
                    boundHandler(mockEventDetailNotification1);
                }).not.toThrow();

                // Verify the method was called correctly
                expect(mockDelayHandlingService.getDelayedTimeWithVideoDelay).toHaveBeenCalled();
                expect(mockScheduler.schedule).toHaveBeenCalledTimes(2);
            });
        });

        describe("Time calculations", () => {
            it("should handle negative current time correctly", () => {
                // Arrange - Set stream time in the future
                const futureStreamTime = Date.now() + 60000; // 1 minute in the future
                const testVideoState: VideoState = {
                    videoLink: TEST_PLAYLIST_URL_1,
                    timeToStream: futureStreamTime,
                    currentTime: 0,
                    phaseIndex: TEST_INDEX,
                };
                videoStreamingService['_currentVideoStateByGameId'][TEST_GAME_ID_1] = testVideoState;

                // Act
                const result = videoStreamingService.getCurrentVideoStateByGameId(TEST_GAME_ID_1);

                // Assert - Current time should be negative (stream hasn't started yet)
                expect(result.currentTime).toBeLessThan(0);
            });

            it("should handle very large time differences", () => {
                // Arrange
                const veryOldStreamTime = 1000000000; // Very old timestamp
                const testVideoState: VideoState = {
                    videoLink: TEST_PLAYLIST_URL_1,
                    timeToStream: veryOldStreamTime,
                    currentTime: 0,
                    phaseIndex: TEST_INDEX,
                };
                videoStreamingService['_currentVideoStateByGameId'][TEST_GAME_ID_1] = testVideoState;

                // Act
                const result = videoStreamingService.getCurrentVideoStateByGameId(TEST_GAME_ID_1);

                // Assert - Should handle large time differences
                expect(result.currentTime).toBeGreaterThan(1000000000);
                expect(result.currentTime).toBeLessThan(Date.now());
            });
        });

        describe("Multiple events and phases", () => {
            it("should handle multiple phases for same game", () => {
                // Arrange
                jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID_1);
                const phase1Notification = { ...mockEventDetailNotification1, index: 0 };
                const phase2Notification = { ...mockEventDetailNotification1, index: 1 };

                // Act
                videoStreamingService.onLiveStreamStart(phase1Notification);
                videoStreamingService.onLiveStreamStart(phase2Notification);

                // Assert - Second phase should overwrite first
                expect(videoStreamingService['_currentVideoStateByGameId'][TEST_GAME_ID_1].phaseIndex).toBe(1);
                expect(videoStreamingService['_currentVideoStateByGameId'][TEST_GAME_ID_1].videoLink).toBe(
                    mockEvent1.eventDetails[1].playlist
                );
            });

            it("should handle rapid successive preload and stream start calls", () => {
                // Arrange
                jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID_1);

                // Act
                videoStreamingService.onLiveStreamPreload(mockEventDetailNotification1);
                videoStreamingService.onLiveStreamStart(mockEventDetailNotification1);

                // Assert
                expect(videoStreamingService['_preloadVideoStateByGameId'][TEST_GAME_ID_1]).toBeDefined();
                expect(videoStreamingService['_currentVideoStateByGameId'][TEST_GAME_ID_1]).toBeDefined();
                expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalledTimes(1);
            });
        });

        describe("Error handling and edge cases", () => {
            it("should throw error when event details are missing", () => {
                // Arrange
                const eventWithoutDetails = { ...mockEvent1, eventDetails: [] };
                const notificationWithoutDetails: EventDetailNotification = {
                    event: eventWithoutDetails,
                    index: 0
                };

                // Act & Assert - Should throw error
                expect(() => {
                    videoStreamingService.handleEventDetailScheduleStart(notificationWithoutDetails);
                }).toThrow();
            });

            it("should throw error with invalid index", () => {
                // Arrange
                const invalidIndexNotification: EventDetailNotification = {
                    event: mockEvent1,
                    index: 999 // Index beyond eventDetails array
                };

                // Act & Assert - Should throw error
                expect(() => {
                    videoStreamingService.onLiveStreamStart(invalidIndexNotification);
                }).toThrow();

                expect(() => {
                    videoStreamingService.onLiveStreamPreload(invalidIndexNotification);
                }).toThrow();
            });
        });

        describe("Integration with dependencies", () => {
            it("should integrate correctly with all dependencies", () => {
                // Arrange
                jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID_1);

                // Act - Full workflow
                videoStreamingService.initEvent();
                videoStreamingService.handleEventDetailScheduleStart(mockEventDetailNotification1);
                videoStreamingService.onLiveStreamPreload(mockEventDetailNotification1);
                videoStreamingService.onLiveStreamStart(mockEventDetailNotification1);
                const currentState = videoStreamingService.getCurrentByGameId(TEST_GAME_ID_1);
                videoStreamingService.dispose();

                // Assert - All dependencies should have been called
                expect(mockOddFeedEventSource.registerEventDetailEventListener).toHaveBeenCalled();
                expect(mockDelayHandlingService.getDelayedTimeWithVideoDelay).toHaveBeenCalledTimes(2); // Once in handle, once in onLiveStreamStart
                expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalled();
                expect(mockScheduler.schedule).toHaveBeenCalledTimes(2);
                expect(mockGameFlowService.getTrackPointByGameId).toHaveBeenCalled();
                expect(mockGameBoardcastService.broadcastToAllClientByGameId).toHaveBeenCalled();
                expect(mockOddFeedEventSource.unregisterEventDetailEventListener).toHaveBeenCalled();
                expect(currentState).toBeDefined();
            });
        });
    });
});
