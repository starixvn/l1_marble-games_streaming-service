import { HealthController } from "../../../src/controllers/health-controller";
import { Request, Response } from "express";

// Mock Express Request and Response
const createMockRequest = (): jest.Mocked<Request> => {
  return {
    ip: "192.168.1.1",
    headers: {
      host: "localhost:5000",
      "x-forwarded-for": "10.0.0.1, 192.168.1.1",
    },
    socket: {
      remoteAddress: "192.168.1.100",
    },
  } as any;
};

const createMockResponse = (): jest.Mocked<Response> => {
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as any;
  return mockRes;
};

describe("HealthController", () => {
  let healthController: HealthController;
  let mockReq: jest.Mocked<Request>;
  let mockRes: jest.Mocked<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    healthController = new HealthController();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
  });

  describe("healthCheck", () => {
    it("should return healthy status with correct response format", async () => {
      // Arrange
      const mockDate = new Date("2024-01-01T10:00:00Z");
      jest.spyOn(global, "Date").mockImplementation(() => mockDate as any);

      // Act
      await healthController.healthCheck(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "ok",
        message: "Streaming service running",
        timestamp: mockDate.toISOString(),
        host: mockReq.headers.host,
        clientIP: mockReq.ip,
        forwardedFor: mockReq.headers["x-forwarded-for"],
        remoteAddress: mockReq.socket.remoteAddress,
      });
    });
  });
});
