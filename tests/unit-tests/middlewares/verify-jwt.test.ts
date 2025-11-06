import { verifyJWT } from "../../../src/middlewares/verify-jwt";
import { Response, NextFunction } from "express";
import { appConfigs } from "../../../src/app-configs";

// Mock Express objects
const createMockRequest = (headers: any = {}, query: any = {}): any => {
  return {
    headers,
    query,
  } as any;
};

const createMockResponse = (): jest.Mocked<Response> => {
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as any;
  return mockRes;
};

const createMockNextFunction = (): jest.Mocked<NextFunction> => {
  return jest.fn() as any;
};

describe("verifyJWT", () => {
  let mockReq: any;
  let mockRes: jest.Mocked<Response>;
  let mockNext: jest.Mocked<NextFunction>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock appConfigs
    (appConfigs as any) = {
      adminToken: "test-admin-token",
    };

    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNextFunction();
  });

  describe("token extraction", () => {
    it("should extract token from Authorization header with Bearer prefix and call next() when valid", () => {
      // Arrange
      mockReq.headers.authorization = `Bearer test-admin-token`;

      // Act
      verifyJWT(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it("should extract token from query parameter when Authorization header is missing", () => {
      // Arrange
      mockReq.query.token = "test-admin-token";

      // Act
      verifyJWT(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it("should prioritize Authorization header over query parameter", () => {
      // Arrange
      mockReq.headers.authorization = `Bearer test-admin-token`;
      mockReq.query.token = "wrong-token";

      // Act
      verifyJWT(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe("missing or invalid token scenarios", () => {
    it("should return 401 when no token is provided", () => {
      // Arrange
      mockReq.headers = {};
      mockReq.query = {};

      // Act
      verifyJWT(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Missing token" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 when Authorization header is empty", () => {
      // Arrange
      mockReq.headers.authorization = "";

      // Act
      verifyJWT(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Missing token" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 when Authorization header is undefined", () => {
      // Arrange
      mockReq.headers.authorization = undefined;

      // Act
      verifyJWT(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Missing token" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 when query token is empty string", () => {
      // Arrange
      mockReq.query.token = "";

      // Act
      verifyJWT(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Missing token" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 when query token is undefined", () => {
      // Arrange
      mockReq.query.token = undefined;

      // Act
      verifyJWT(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Missing token" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 when token does not match admin token", () => {
      // Arrange
      mockReq.headers.authorization = "Bearer wrong-token";

      // Act
      verifyJWT(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Missing token" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 when Authorization header does not have Bearer prefix", () => {
      // Arrange
      mockReq.headers.authorization = "test-admin-token";

      // Act
      verifyJWT(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Missing token" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 when query token does not match admin token", () => {
      // Arrange
      mockReq.query.token = "wrong-token";

      // Act
      verifyJWT(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Missing token" });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("valid token scenarios", () => {
    it("should call next() with valid admin token from Authorization header", () => {
      // Arrange
      mockReq.headers.authorization = `Bearer test-admin-token`;

      // Act
      verifyJWT(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it("should call next() with valid admin token from query parameter", () => {
      // Arrange
      mockReq.query.token = "test-admin-token";

      // Act
      verifyJWT(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });
  });
});
