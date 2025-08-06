import { AuthController } from "../../../src/controllers/auth-controller";
import { mockContainer } from "../global-stubs";
import { Request, Response } from "express";

// Mock Express Request and Response
const createMockRequest = (body: any = {}): jest.Mocked<Request> => {
  return {
    body,
  } as any;
};

const createMockResponse = (): jest.Mocked<Response> => {
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as any;
  return mockRes;
};

describe("AuthController", () => {
  let authController: AuthController;
  let mockReq: jest.Mocked<Request>;
  let mockRes: jest.Mocked<Response>;
  let mockAuthenticateService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create proper Jest mock for authenticate service
    mockAuthenticateService = {
      getAuthenticatedToken: jest.fn(),
    };

    // Replace the auto-stubbed method with Jest mock
    mockContainer.authenticateService = mockAuthenticateService;

    authController = new AuthController(mockContainer);
    mockReq = createMockRequest();
    mockRes = createMockResponse();
  });

  describe("login", () => {
    it("should return JWT token for valid credentials", async () => {
      // Arrange
      const operatorId = "marble-tv";
      const password = "marble-tv-123";
      const expectedToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

      mockReq.body = { operatorId: operatorId, password };
      mockAuthenticateService.getAuthenticatedToken.mockResolvedValue(expectedToken);

      // Act
      await authController.login(mockReq, mockRes);

      // Assert
      expect(mockAuthenticateService.getAuthenticatedToken).toHaveBeenCalledWith(operatorId, password);
      expect(mockRes.json).toHaveBeenCalledWith({
        token: expectedToken,
      });
    });

    it("should handle invalid credentials", async () => {
      // Arrange
      const operatorId = "wrong-username";
      const password = "wrong-password";
      const authError = new Error("Invalid username or password");

      mockReq.body = { operatorId, password };
      mockAuthenticateService.getAuthenticatedToken.mockRejectedValue(authError);

      // Act
      await authController.login(mockReq, mockRes);

      // Assert
      expect(mockAuthenticateService.getAuthenticatedToken).toHaveBeenCalledWith(operatorId, password);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invalid username or password",
      });
    });

    it("should handle null request body", async () => {
      // Arrange
      mockReq.body = null;

      // Act
      await authController.login(mockReq, mockRes);

      // Assert
      expect(mockAuthenticateService.getAuthenticatedToken).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });
});
