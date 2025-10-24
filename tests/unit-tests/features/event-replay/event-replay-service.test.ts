import { EventReplayService, NotFoundError } from "../../../../src/features/event-replay/event-replay-service";
import { OddsFeedService } from "odds-feed-client";
import { DelayHandlingService } from "../../../../src/features/delay/delay-handling-service";
import { idHelper } from "../../../../src/helpers";
import { createMockEvent, createMockEventDetail } from "../../test-utils/mock-event";

// Mock dependencies
const mockOddsFeedService = {
    fetchEventDetails: jest.fn(),
} as unknown as jest.Mocked<OddsFeedService>;

const mockDelayHandlingService = {
    getDelayedTime: jest.fn(),
} as unknown as jest.Mocked<DelayHandlingService>;

const mockGameFlowService = {
    eventName: "gameFlow",
    getReplayByEvent: jest.fn(),
} as any;

const mockCurrentEventService = {
    eventName: "currentEvent",
    getReplayByEvent: jest.fn(),
} as any;

const mockVideoStreamingService = {
    getReplayByEvent: jest.fn(),
} as any;

const mockIntroService = {
    eventName: "intro",
    getReplayByEvent: jest.fn(),
} as any;

const mockLiveScoreService = {
    eventName: "liveScore",
    getReplayByEvent: jest.fn(),
} as any;

const mockResultService = {
    eventName: "result",
    getReplayByEvent: jest.fn(),
} as any;

const mockTeamNameService = {
    eventName: "teamName",
    getReplayByEvent: jest.fn(),
} as any;

// Test constants
const TEST_EVENT_ID = 4294967298; // gameId: 1, roundId: 2
const TEST_GAME_ID = "1";
const TEST_SCHEDULE_START_TS = "2023-01-01T10:00:00Z";
const TEST_RESULTS_AVAILABLE_TS = "2023-01-01T12:00:00Z";
const TEST_DELAYED_TIME = new Date("2023-01-01T10:05:00Z");
const TEST_FROM_TIME = TEST_DELAYED_TIME.getTime();

// Test data using shared mock utils
const mockPastEvent = createMockEvent({
    eventID: TEST_EVENT_ID,
    scheduleStartTs: TEST_SCHEDULE_START_TS,
    eventDetails: [
        createMockEventDetail({
            eventID: TEST_EVENT_ID,
            scheduleStartTs: TEST_SCHEDULE_START_TS,
            resultsAvailableTs: TEST_RESULTS_AVAILABLE_TS,
            phase: 1
        })
    ]
});

const mockFutureEvent = createMockEvent({
    eventID: TEST_EVENT_ID,
    scheduleStartTs: "2025-01-01T10:00:00Z",
    eventDetails: [
        createMockEventDetail({
            eventID: TEST_EVENT_ID,
            scheduleStartTs: "2025-01-01T10:00:00Z",
            resultsAvailableTs: "2025-01-01T12:00:00Z",
            phase: 1
        })
    ]
});

// Helper functions for test setup
const createContainer = () => ({
    oddsFeedService: mockOddsFeedService,
    delayHandlingService: mockDelayHandlingService,
    gameFlowService: mockGameFlowService,
    currentEventService: mockCurrentEventService,
    videoStreamingService: mockVideoStreamingService,
    introService: mockIntroService,
    liveScoreService: mockLiveScoreService,
    resultService: mockResultService,
    teamNameService: mockTeamNameService,
});

const setupMocks = () => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockDelayHandlingService.getDelayedTime.mockReturnValue(TEST_DELAYED_TIME);
    
    // Mock all replay services to return empty arrays by default
    mockGameFlowService.getReplayByEvent.mockResolvedValue([]);
    mockCurrentEventService.getReplayByEvent.mockResolvedValue([]);
    mockVideoStreamingService.getReplayByEvent.mockResolvedValue([]);
    mockIntroService.getReplayByEvent.mockResolvedValue([]);
    mockLiveScoreService.getReplayByEvent.mockResolvedValue([]);
    mockResultService.getReplayByEvent.mockResolvedValue([]);
    mockTeamNameService.getReplayByEvent.mockResolvedValue([]);
    
    // Mock idHelper
    jest.spyOn(idHelper, 'extractGameId').mockReturnValue(TEST_GAME_ID);
    
    // Use fake timers with a fixed time
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2023-01-02T10:00:00Z"));
};

describe("EventReplayService", () => {
    let eventReplayService: EventReplayService;
    let container: any;

    beforeEach(() => {
        setupMocks();
        container = createContainer();
        eventReplayService = new EventReplayService(container);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    describe("constructor", () => {
        it("should initialize with all dependencies", () => {
            // Arrange & Act
            const service = new EventReplayService(container);

            // Assert
            expect(service['oddsFeedService']).toBe(mockOddsFeedService);
            expect(service['delayHandlingService']).toBe(mockDelayHandlingService);
            expect(service['replayServices']).toHaveLength(7);
        });

        it("should initialize replay services array with correct services", () => {
            // Arrange & Act
            const service = new EventReplayService(container);

            // Assert
            expect(service['replayServices']).toEqual([
                mockGameFlowService,
                mockCurrentEventService,
                mockVideoStreamingService,
                mockIntroService,
                mockLiveScoreService,
                mockResultService,
                mockTeamNameService,
            ]);
        });

        it("should set all required dependencies", () => {
            // Arrange & Act
            const service = new EventReplayService(container);

            // Assert
            expect(service['oddsFeedService']).toBeDefined();
            expect(service['delayHandlingService']).toBeDefined();
            expect(service['replayServices']).toBeDefined();
        });
    });

    describe("getReplayByEvent", () => {
        beforeEach(() => {
            mockOddsFeedService.fetchEventDetails.mockResolvedValue(mockPastEvent);
        });

        it("should return replay payload for valid past event", async () => {
            // Arrange & Act
            const result = await eventReplayService.getReplayByEvent(TEST_EVENT_ID);

            // Assert
            expect(result).toHaveProperty('payload');
            expect(result).toHaveProperty('meta');
            expect(result.meta.gameId).toBe(TEST_GAME_ID);
            expect(result.meta.fromTime).toBe(TEST_FROM_TIME);
            expect(Array.isArray(result.payload)).toBe(true);
        });

        it("should fetch event details from odds feed service", async () => {
            // Act
            await eventReplayService.getReplayByEvent(TEST_EVENT_ID);

            // Assert
            expect(mockOddsFeedService.fetchEventDetails).toHaveBeenCalledWith(TEST_EVENT_ID);
            expect(mockOddsFeedService.fetchEventDetails).toHaveBeenCalledTimes(1);
        });

        it("should call delay handling service with event object", async () => {
            // Act
            await eventReplayService.getReplayByEvent(TEST_EVENT_ID);

            // Assert
            expect(mockDelayHandlingService.getDelayedTime).toHaveBeenCalledWith(
                {
                    event: mockPastEvent,
                    time: new Date(mockPastEvent.scheduleStartTs)
                },
                {
                    oddsFeedEventType: "EventStart"
                }
            );
        });

        it("should call getReplayByEvent on all replay services", async () => {
            // Act
            await eventReplayService.getReplayByEvent(TEST_EVENT_ID);

            // Assert
            expect(mockGameFlowService.getReplayByEvent).toHaveBeenCalledWith(mockPastEvent);
            expect(mockCurrentEventService.getReplayByEvent).toHaveBeenCalledWith(mockPastEvent);
            expect(mockVideoStreamingService.getReplayByEvent).toHaveBeenCalledWith(mockPastEvent);
            expect(mockIntroService.getReplayByEvent).toHaveBeenCalledWith(mockPastEvent);
            expect(mockLiveScoreService.getReplayByEvent).toHaveBeenCalledWith(mockPastEvent);
            expect(mockResultService.getReplayByEvent).toHaveBeenCalledWith(mockPastEvent);
            expect(mockTeamNameService.getReplayByEvent).toHaveBeenCalledWith(mockPastEvent);
        });

        it("should extract game ID using idHelper", async () => {
            // Act
            await eventReplayService.getReplayByEvent(TEST_EVENT_ID);

            // Assert
            expect(idHelper.extractGameId).toHaveBeenCalledWith(TEST_EVENT_ID);
        });

        it("should process replays from multiple services and create sorted payload", async () => {
            // Arrange
            const gameFlowReplay = {
                time: new Date("2023-01-01T10:06:00Z"),
                payload: { state: "prebet" },
                eventName: "gameFlow"
            };
            const currentEventReplay = {
                time: new Date("2023-01-01T10:05:30Z"),
                payload: { eventDetailIndex: 0 },
            };

            mockGameFlowService.getReplayByEvent.mockResolvedValue([gameFlowReplay]);
            mockCurrentEventService.getReplayByEvent.mockResolvedValue([currentEventReplay]);

            // Act
            const result = await eventReplayService.getReplayByEvent(TEST_EVENT_ID);

            // Assert
            expect(result.payload).toHaveLength(2);
            // Should be sorted by time (earlier first)
            expect(result.payload[0].time).toBe(30); // 30 seconds after fromTime
            expect(result.payload[1].time).toBe(60); // 60 seconds after fromTime
            expect(result.payload[0].payload).toEqual({ currentEvent: { eventDetailIndex: 0 } });
            expect(result.payload[1].payload).toEqual({ gameFlow: { state: "prebet" } });
        });

        it("should handle replay with explicit eventName", async () => {
            // Arrange
            const replayWithEventName = {
                time: new Date("2023-01-01T10:06:00Z"),
                payload: { state: "streaming" },
                eventName: "videoStreaming"
            };

            mockVideoStreamingService.getReplayByEvent.mockResolvedValue([replayWithEventName]);

            // Act
            const result = await eventReplayService.getReplayByEvent(TEST_EVENT_ID);

            // Assert
            expect(result.payload).toHaveLength(1);
            expect(result.payload[0].payload).toEqual({ videoStreaming: { state: "streaming" } });
        });

        it("should handle replay without eventName using service eventName", async () => {
            // Arrange
            const replayWithoutEventName = {
                time: new Date("2023-01-01T10:06:00Z"),
                payload: { homeScore: 1, awayScore: 0 },
            };

            mockLiveScoreService.getReplayByEvent.mockResolvedValue([replayWithoutEventName]);

            // Act
            const result = await eventReplayService.getReplayByEvent(TEST_EVENT_ID);

            // Assert
            expect(result.payload).toHaveLength(1);
            expect(result.payload[0].payload).toEqual({ liveScore: { homeScore: 1, awayScore: 0 } });
        });

        it("should calculate correct relative times", async () => {
            // Arrange
            const replay1 = {
                time: TEST_DELAYED_TIME, // Same as fromTime
                payload: { action: "start" },
            };
            const replay2 = {
                time: new Date(TEST_DELAYED_TIME.getTime() + 30000), // 30 seconds later
                payload: { action: "update" },
            };

            mockGameFlowService.getReplayByEvent.mockResolvedValue([replay1, replay2]);

            // Act
            const result = await eventReplayService.getReplayByEvent(TEST_EVENT_ID);

            // Assert
            expect(result.payload).toHaveLength(2);
            expect(result.payload[0].time).toBe(0); // At fromTime
            expect(result.payload[1].time).toBe(30); // 30 seconds after fromTime
        });

        it("should throw NotFoundError when event is not found", async () => {
            // Arrange
            mockOddsFeedService.fetchEventDetails.mockResolvedValue(null);

            // Act & Assert
            await expect(eventReplayService.getReplayByEvent(TEST_EVENT_ID)).rejects.toThrow(NotFoundError);
            await expect(eventReplayService.getReplayByEvent(TEST_EVENT_ID)).rejects.toThrow("Event not found");
        });

        it("should throw NotFoundError when event is undefined", async () => {
            // Arrange
            mockOddsFeedService.fetchEventDetails.mockResolvedValue(undefined as any);

            // Act & Assert
            await expect(eventReplayService.getReplayByEvent(TEST_EVENT_ID)).rejects.toThrow(NotFoundError);
        });

        it("should throw NotFoundError when event is in the future", async () => {
            // Arrange
            mockOddsFeedService.fetchEventDetails.mockResolvedValue(mockFutureEvent);

            // Act & Assert
            await expect(eventReplayService.getReplayByEvent(TEST_EVENT_ID)).rejects.toThrow(NotFoundError);
        });

        it("should handle empty replays from all services", async () => {
            // Arrange - All services already return empty arrays by default

            // Act
            const result = await eventReplayService.getReplayByEvent(TEST_EVENT_ID);

            // Assert
            expect(result.payload).toEqual([]);
            expect(result.meta.gameId).toBe(TEST_GAME_ID);
            expect(result.meta.fromTime).toBe(TEST_FROM_TIME);
        });

        it("should handle service returning Promise<Replay[]>", async () => {
            // Arrange
            const asyncReplay = {
                time: new Date("2023-01-01T10:06:00Z"),
                payload: { homeScore: 0, awayScore: 0 },
            };

            mockLiveScoreService.getReplayByEvent.mockResolvedValue([asyncReplay]);

            // Act
            const result = await eventReplayService.getReplayByEvent(TEST_EVENT_ID);

            // Assert
            expect(result.payload).toHaveLength(1);
            expect(result.payload[0].payload).toEqual({ liveScore: { homeScore: 0, awayScore: 0 } });
        });

        it("should handle large number of replays and maintain correct sorting", async () => {
            // Arrange
            const replays = Array.from({ length: 100 }, (_, i) => ({
                time: new Date(TEST_DELAYED_TIME.getTime() + (i * 1000)),
                payload: { index: i },
            }));

            mockGameFlowService.getReplayByEvent.mockResolvedValue(replays);

            // Act
            const result = await eventReplayService.getReplayByEvent(TEST_EVENT_ID);

            // Assert
            expect(result.payload).toHaveLength(100);
            // Verify sorting
            for (let i = 1; i < result.payload.length; i++) {
                expect(result.payload[i].time).toBeGreaterThanOrEqual(result.payload[i - 1].time);
            }
        });

        it("should handle replay service throwing an error", async () => {
            // Arrange
            const error = new Error("Service error");
            mockGameFlowService.getReplayByEvent.mockRejectedValue(error);

            // Act & Assert
            await expect(eventReplayService.getReplayByEvent(TEST_EVENT_ID)).rejects.toThrow("Service error");
        });

        it("should handle odds feed service throwing an error", async () => {
            // Arrange
            const error = new Error("Network error");
            mockOddsFeedService.fetchEventDetails.mockRejectedValue(error);

            // Act & Assert
            await expect(eventReplayService.getReplayByEvent(TEST_EVENT_ID)).rejects.toThrow("Network error");
        });

        it("should handle service with missing eventName property", async () => {
            // Arrange
            const serviceWithoutEventName = {
                getReplayByEvent: jest.fn().mockResolvedValue([{
                    time: new Date("2023-01-01T10:06:00Z"),
                    payload: { data: "test" },
                }])
            };

            // Replace one service temporarily
            eventReplayService['replayServices'][0] = serviceWithoutEventName as any;

            // Act
            const result = await eventReplayService.getReplayByEvent(TEST_EVENT_ID);

            // Assert
            expect(result.payload).toHaveLength(1);
            expect(result.payload[0].payload).toEqual({ "": { data: "test" } }); // Empty string for missing eventName
        });

        describe("edge cases", () => {
            beforeEach(() => {
                mockOddsFeedService.fetchEventDetails.mockResolvedValue(mockPastEvent);
            });

            it("should handle event with no event details", async () => {
                // Arrange
                const eventWithNoDetails = {
                    ...mockPastEvent,
                    eventDetails: []
                };
                mockOddsFeedService.fetchEventDetails.mockResolvedValue(eventWithNoDetails);

                // Act & Assert
                await expect(eventReplayService.getReplayByEvent(TEST_EVENT_ID)).rejects.toThrow();
            });

            it("should handle very large event ID", async () => {
                // Arrange
                const largeEventId = 999999999999;
                jest.spyOn(idHelper, 'extractGameId').mockReturnValue("999999");

                // Act
                const result = await eventReplayService.getReplayByEvent(largeEventId);

                // Assert
                expect(mockOddsFeedService.fetchEventDetails).toHaveBeenCalledWith(largeEventId);
                expect(result.meta.gameId).toBe("999999");
            });

            it("should handle negative relative times", async () => {
                // Arrange
                const replayBeforeFromTime = {
                    time: new Date(TEST_DELAYED_TIME.getTime() - 30000), // 30 seconds before fromTime
                    payload: { early: true },
                };

                mockGameFlowService.getReplayByEvent.mockResolvedValue([replayBeforeFromTime]);

                // Act
                const result = await eventReplayService.getReplayByEvent(TEST_EVENT_ID);

                // Assert
                expect(result.payload).toHaveLength(1);
                expect(result.payload[0].time).toBe(-30); // Negative relative time
            });

            it("should handle multiple services with same relative time", async () => {
                // Arrange
                const sameTime = new Date("2023-01-01T10:06:00Z");
                const replay1 = { time: sameTime, payload: { service: 1 } };
                const replay2 = { time: sameTime, payload: { service: 2 } };

                mockGameFlowService.getReplayByEvent.mockResolvedValue([replay1]);
                mockCurrentEventService.getReplayByEvent.mockResolvedValue([replay2]);

                // Act
                const result = await eventReplayService.getReplayByEvent(TEST_EVENT_ID);

                // Assert
                expect(result.payload).toHaveLength(2);
                expect(result.payload[0].time).toBe(60);
                expect(result.payload[1].time).toBe(60);
            });
        });
    });
});

describe("NotFoundError", () => {
    it("should create error with default message", () => {
        // Act
        const error = new NotFoundError();

        // Assert
        expect(error.message).toBe("Event not found");
        expect(error.name).toBe("NotFoundError");
        expect(error).toBeInstanceOf(Error);
    });

    it("should create error with custom message", () => {
        // Act
        const error = new NotFoundError("Custom error message");

        // Assert
        expect(error.message).toBe("Custom error message");
        expect(error.name).toBe("NotFoundError");
    });
});