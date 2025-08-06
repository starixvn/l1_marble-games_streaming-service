import { EventStreamController } from "../../../src/controllers/event-stream-controller";
import { mockContainer } from "../global-stubs";
import { Request, Response } from "express";

// Mock Express Request and Response
const createMockRequest = (params: Record<string, any> = {}, query: Record<string, any> = {}): jest.Mocked<Request> => {
  return {
    params,
    query,
  } as any;
};

const createMockResponse = (): jest.Mocked<Response> => {
  const mockRes = {
    write: jest.fn(),
    end: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as any;
  return mockRes;
};

describe("EventStreamController", () => {
  let eventStreamController: EventStreamController;
  let mockReq: jest.Mocked<Request>;
  let mockRes: jest.Mocked<Response>;
  let mockEventStreamService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create proper Jest mock for event stream service
    mockEventStreamService = {
      addClient: jest.fn(),
    };

    // Replace the auto-stubbed method with Jest mock
    mockContainer.eventStreamService = mockEventStreamService;

    eventStreamController = new EventStreamController(mockContainer);
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockRes.setHeader = jest.fn().mockReturnThis();
    mockRes.flushHeaders = jest.fn().mockReturnThis();
  });

  describe("handleEventStreamConnection", () => {
    it("should handle valid game ID connection", async () => {
      // Arrange
      const gameId = "2001";
      mockReq.params = { gameId };
      mockEventStreamService.addClient.mockResolvedValue();

      // Act
      eventStreamController.handleEventStreamConnection(mockReq, mockRes);

      // Assert
      expect(mockEventStreamService.addClient).toHaveBeenCalledWith(mockRes, gameId);
    });

    it("should handle missing game ID parameter", () => {
      // Arrange
      mockReq.params = {};

      // Act
      eventStreamController.handleEventStreamConnection(mockReq, mockRes);

      // Assert
      expect(mockEventStreamService.addClient).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Game ID is required",
      });
    });

    it("should handle null game ID parameter", () => {
      // Arrange
      mockReq.params = { gameId: null as any };

      // Act
      eventStreamController.handleEventStreamConnection(mockReq, mockRes);

      // Assert
      expect(mockEventStreamService.addClient).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Game ID is required",
      });
    });

    it("should handle undefined game ID parameter", () => {
      // Arrange
      mockReq.params = { gameId: undefined as any };

      // Act
      eventStreamController.handleEventStreamConnection(mockReq, mockRes);

      // Assert
      expect(mockEventStreamService.addClient).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Game ID is required",
      });
    });

    it("should handle empty string game ID", () => {
      // Arrange
      mockReq.params = { gameId: "" };

      // Act
      eventStreamController.handleEventStreamConnection(mockReq, mockRes);

      // Assert
      expect(mockEventStreamService.addClient).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Game ID is required",
      });
    });
  });
});
