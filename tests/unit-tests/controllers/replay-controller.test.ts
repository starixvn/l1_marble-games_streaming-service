import { ReplayController } from "../../../src/controllers/replay-controller";
import { NotFoundError } from "../../../src/features/event-replay/event-replay-service";
import { Request, Response } from "express";

// Mock dependencies
const mockEventReplayService = {
    getReplayByEvent: jest.fn(),
} as any;

// Test constants
const TEST_EVENT_ID = 4294967298;
const TEST_INVALID_EVENT_ID = "invalid";
const TEST_REPLAY_PAYLOAD = {
    payload: [
        {
            time: 0,
            payload: { gameFlow: { state: "prebet" } }
        }
    ],
    meta: {
        gameId: "1",
        fromTime: 1672567500000
    }
};

// Helper functions for test setup
const createContainer = () => ({
    eventReplayService: mockEventReplayService,
});

const createMockRequest = (eventID: string): Partial<Request> => ({
    params: { eventID }
});

const createMockResponse = (): Partial<Response> => {
    const res = {} as any;
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

const setupMocks = () => {
    jest.clearAllMocks();
    mockEventReplayService.getReplayByEvent.mockResolvedValue(TEST_REPLAY_PAYLOAD);
};

describe("ReplayController", () => {
    let replayController: ReplayController;
    let container: any;

    beforeEach(() => {
        setupMocks();
        container = createContainer();
        replayController = new ReplayController(container);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("constructor", () => {
        it("should initialize with all dependencies", () => {
            // Arrange & Act
            const controller = new ReplayController(container);

            // Assert
            expect(controller['eventReplayService']).toBe(mockEventReplayService);
        });

        it("should set all required dependencies", () => {
            // Arrange & Act
            const controller = new ReplayController(container);

            // Assert
            expect(controller['eventReplayService']).toBeDefined();
        });
    });

    describe("handle", () => {
        let mockRequest: Partial<Request>;
        let mockResponse: Partial<Response>;

        beforeEach(() => {
            mockResponse = createMockResponse();
        });

        it("should return replay payload for valid event ID", async () => {
            // Arrange
            mockRequest = createMockRequest(TEST_EVENT_ID.toString());

            // Act
            await replayController.handle(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockEventReplayService.getReplayByEvent).toHaveBeenCalledWith(TEST_EVENT_ID);
            expect(mockResponse.json).toHaveBeenCalledWith(TEST_REPLAY_PAYLOAD);
            expect(mockResponse.status).not.toHaveBeenCalled();
        });

        it("should call event replay service with parsed event ID", async () => {
            // Arrange
            mockRequest = createMockRequest("123456789");

            // Act
            await replayController.handle(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockEventReplayService.getReplayByEvent).toHaveBeenCalledWith(123456789);
            expect(mockEventReplayService.getReplayByEvent).toHaveBeenCalledTimes(1);
        });

        it("should return 404 error for invalid event ID", async () => {
            // Arrange
            mockRequest = createMockRequest(TEST_INVALID_EVENT_ID);

            // Act
            await replayController.handle(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({ error: "Event invalid" });
            expect(mockEventReplayService.getReplayByEvent).not.toHaveBeenCalled();
        });

        it("should return 404 error for NaN event ID", async () => {
            // Arrange
            mockRequest = createMockRequest("abc");

            // Act
            await replayController.handle(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({ error: "Event invalid" });
            expect(mockEventReplayService.getReplayByEvent).not.toHaveBeenCalled();
        });

        it("should return 404 error for empty event ID", async () => {
            // Arrange
            mockRequest = createMockRequest("");

            // Act
            await replayController.handle(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({ error: "Event invalid" });
            expect(mockEventReplayService.getReplayByEvent).not.toHaveBeenCalled();
        });

        it("should return 404 error when service throws NotFoundError", async () => {
            // Arrange
            mockRequest = createMockRequest(TEST_EVENT_ID.toString());
            const notFoundError = new NotFoundError("Event not found");
            mockEventReplayService.getReplayByEvent.mockRejectedValue(notFoundError);

            // Act
            await replayController.handle(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({ error: "Event not found" });
        });

        it("should return 404 error with custom message from NotFoundError", async () => {
            // Arrange
            mockRequest = createMockRequest(TEST_EVENT_ID.toString());
            const customError = new NotFoundError("Custom not found message");
            mockEventReplayService.getReplayByEvent.mockRejectedValue(customError);

            // Act
            await replayController.handle(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({ error: "Custom not found message" });
        });

        it("should return 500 error for other service errors", async () => {
            // Arrange
            mockRequest = createMockRequest(TEST_EVENT_ID.toString());
            const serviceError = new Error("Database connection failed");
            mockEventReplayService.getReplayByEvent.mockRejectedValue(serviceError);

            // Act
            await replayController.handle(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({ error: "Internal server error" });
        });

        it("should handle large event IDs correctly", async () => {
            // Arrange
            const largeEventId = "999999999999";
            mockRequest = createMockRequest(largeEventId);

            // Act
            await replayController.handle(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockEventReplayService.getReplayByEvent).toHaveBeenCalledWith(999999999999);
            expect(mockResponse.json).toHaveBeenCalledWith(TEST_REPLAY_PAYLOAD);
        });

        it("should handle negative event IDs correctly", async () => {
            // Arrange
            mockRequest = createMockRequest("-123");

            // Act
            await replayController.handle(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockEventReplayService.getReplayByEvent).toHaveBeenCalledWith(-123);
            expect(mockResponse.json).toHaveBeenCalledWith(TEST_REPLAY_PAYLOAD);
        });

        it("should handle zero event ID correctly", async () => {
            // Arrange
            mockRequest = createMockRequest("0");

            // Act
            await replayController.handle(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockEventReplayService.getReplayByEvent).toHaveBeenCalledWith(0);
            expect(mockResponse.json).toHaveBeenCalledWith(TEST_REPLAY_PAYLOAD);
        });

        it("should handle floating point event IDs by converting to integer", async () => {
            // Arrange
            mockRequest = createMockRequest("123.456");

            // Act
            await replayController.handle(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockEventReplayService.getReplayByEvent).toHaveBeenCalledWith(123);
            expect(mockResponse.json).toHaveBeenCalledWith(TEST_REPLAY_PAYLOAD);
        });

        it("should return correct response type", async () => {
            // Arrange
            mockRequest = createMockRequest(TEST_EVENT_ID.toString());

            // Act
            const result = await replayController.handle(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(result).toBe(mockResponse);
        });

        describe("edge cases", () => {
            it("should handle missing params object", async () => {
                // Arrange
                mockRequest = { params: undefined } as any;

                // Act & Assert
                await expect(replayController.handle(mockRequest as Request, mockResponse as Response))
                    .rejects.toThrow(TypeError);
                await expect(replayController.handle(mockRequest as Request, mockResponse as Response))
                    .rejects.toThrow("Cannot read properties of undefined (reading 'eventID')");
            });

            it("should handle missing eventID parameter", async () => {
                // Arrange
                mockRequest = { params: {} } as any;

                // Act
                await replayController.handle(mockRequest as Request, mockResponse as Response);

                // Assert
                expect(mockResponse.status).toHaveBeenCalledWith(404);
                expect(mockResponse.json).toHaveBeenCalledWith({ error: "Event invalid" });
            });

            it("should handle null eventID parameter", async () => {
                // Arrange
                mockRequest = { params: { eventID: null } } as any;

                // Act
                await replayController.handle(mockRequest as Request, mockResponse as Response);

                // Assert
                expect(mockResponse.status).toHaveBeenCalledWith(404);
                expect(mockResponse.json).toHaveBeenCalledWith({ error: "Event invalid" });
            });

            it("should handle undefined eventID parameter", async () => {
                // Arrange
                mockRequest = { params: { eventID: undefined } } as any;

                // Act
                await replayController.handle(mockRequest as Request, mockResponse as Response);

                // Assert
                expect(mockResponse.status).toHaveBeenCalledWith(404);
                expect(mockResponse.json).toHaveBeenCalledWith({ error: "Event invalid" });
            });

            it("should handle service returning null", async () => {
                // Arrange
                mockRequest = createMockRequest(TEST_EVENT_ID.toString());
                mockEventReplayService.getReplayByEvent.mockResolvedValue(null);

                // Act
                await replayController.handle(mockRequest as Request, mockResponse as Response);

                // Assert
                expect(mockResponse.json).toHaveBeenCalledWith(null);
                expect(mockResponse.status).not.toHaveBeenCalled();
            });

            it("should handle service returning undefined", async () => {
                // Arrange
                mockRequest = createMockRequest(TEST_EVENT_ID.toString());
                mockEventReplayService.getReplayByEvent.mockResolvedValue(undefined);

                // Act
                await replayController.handle(mockRequest as Request, mockResponse as Response);

                // Assert
                expect(mockResponse.json).toHaveBeenCalledWith(undefined);
                expect(mockResponse.status).not.toHaveBeenCalled();
            });

            it("should handle very long event ID strings", async () => {
                // Arrange
                const veryLongId = "1".repeat(50);
                mockRequest = createMockRequest(veryLongId);

                // Act
                await replayController.handle(mockRequest as Request, mockResponse as Response);

                // Assert
                expect(mockEventReplayService.getReplayByEvent).toHaveBeenCalledWith(parseInt(veryLongId));
                expect(mockResponse.json).toHaveBeenCalledWith(TEST_REPLAY_PAYLOAD);
            });

            it("should handle mixed alphanumeric event IDs", async () => {
                // Arrange
                mockRequest = createMockRequest("123abc456");

                // Act
                await replayController.handle(mockRequest as Request, mockResponse as Response);

                // Assert
                expect(mockEventReplayService.getReplayByEvent).toHaveBeenCalledWith(123);
                expect(mockResponse.json).toHaveBeenCalledWith(TEST_REPLAY_PAYLOAD);
                expect(mockResponse.status).not.toHaveBeenCalled();
            });

            it("should handle leading/trailing whitespace in event ID", async () => {
                // Arrange
                mockRequest = createMockRequest("  123  ");

                // Act
                await replayController.handle(mockRequest as Request, mockResponse as Response);

                // Assert
                expect(mockEventReplayService.getReplayByEvent).toHaveBeenCalledWith(123);
                expect(mockResponse.json).toHaveBeenCalledWith(TEST_REPLAY_PAYLOAD);
            });
        });
    });
});