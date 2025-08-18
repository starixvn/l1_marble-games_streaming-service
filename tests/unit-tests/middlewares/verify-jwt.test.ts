import { verifyJWT } from "../../../src/middlewares/verify-jwt";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { appConfigs } from "../../../src/app-configs";

// Mock dependencies
jest.mock("jsonwebtoken");
jest.mock("../../../src/app-configs");

const mockJwt = jwt as jest.Mocked<typeof jwt>;

// Mock Express objects
const createMockRequest = (headers: any = {}, query: any = {}): any => {
  return {
    headers,
    query,
    user: undefined,
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
      jwt: {
        secret: "test-secret-key",
      },
    };

    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNextFunction();
  });

  describe("token extraction", () => {
    it("should extract token from Authorization header with Bearer prefix", () => {
      // Arrange
      const token = "valid-jwt-token";
      const decodedToken = { userId: "123", name: "test-user" };
      mockReq.headers.authorization = `Bearer ${token}`;
      mockJwt.verify.mockReturnValue(decodedToken as any);

      // Act
      verifyJWT(mockReq, mockRes, mockNext);

      // Assert
      expect(mockJwt.verify).toHaveBeenCalledWith(token, "test-secret-key");
      expect(mockReq.user).toEqual(decodedToken);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it("should extract token from query parameter when Authorization header is missing", () => {
      // Arrange
      const token = "valid-jwt-token";
      const decodedToken = { userId: "123", name: "test-user" };
      mockReq.query.token = token;
      mockJwt.verify.mockReturnValue(decodedToken as any);

      // Act
      verifyJWT(mockReq, mockRes, mockNext);

      // Assert
      expect(mockJwt.verify).toHaveBeenCalledWith(token, "test-secret-key");
      expect(mockReq.user).toEqual(decodedToken);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it("should prioritize Authorization header over query parameter", () => {
      // Arrange
      const headerToken = "header-token";
      const queryToken = "query-token";
      const decodedToken = { userId: "123", name: "test-user" };
      mockReq.headers.authorization = `Bearer ${headerToken}`;
      mockReq.query.token = queryToken;
      mockJwt.verify.mockReturnValue(decodedToken as any);

      // Act
      verifyJWT(mockReq, mockRes, mockNext);

      // Assert
      expect(mockJwt.verify).toHaveBeenCalledWith(headerToken, "test-secret-key");
      expect(mockJwt.verify).not.toHaveBeenCalledWith(queryToken, "test-secret-key");
      expect(mockReq.user).toEqual(decodedToken);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("missing token scenarios", () => {
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
      expect(mockJwt.verify).not.toHaveBeenCalled();
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
  });

  describe("valid token scenarios", () => {
    it("should call next() with valid JWT token", () => {
      // Arrange
      const token = "valid-jwt-token";
      const decodedToken = { userId: "123", name: "test-user" };
      mockReq.headers.authorization = `Bearer ${token}`;
      mockJwt.verify.mockReturnValue(decodedToken as any);

      // Act
      verifyJWT(mockReq, mockRes, mockNext);

      // Assert
      expect(mockJwt.verify).toHaveBeenCalledWith(token, "test-secret-key");
      expect(mockReq.user).toEqual(decodedToken);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it("should handle complex decoded token payload", () => {
      // Arrange
      const token = "valid-jwt-token";
      const decodedToken = {
        userId: "123",
        name: "test-user",
        email: "test@example.com",
        roles: ["admin", "user"],
        permissions: ["read", "write"],
        exp: 1234567890,
        iat: 1234567890,
      };
      mockReq.headers.authorization = `Bearer ${token}`;
      mockJwt.verify.mockReturnValue(decodedToken as any);

      // Act
      verifyJWT(mockReq, mockRes, mockNext);

      // Assert
      expect(mockJwt.verify).toHaveBeenCalledWith(token, "test-secret-key");
      expect(mockReq.user).toEqual(decodedToken);
      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle empty decoded token payload", () => {
      // Arrange
      const token = "valid-jwt-token";
      const decodedToken = {};
      mockReq.headers.authorization = `Bearer ${token}`;
      mockJwt.verify.mockReturnValue(decodedToken as any);

      // Act
      verifyJWT(mockReq, mockRes, mockNext);

      // Assert
      expect(mockJwt.verify).toHaveBeenCalledWith(token, "test-secret-key");
      expect(mockReq.user).toEqual(decodedToken);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("invalid token scenarios", () => {
    it("should return 403 when JWT verification fails", () => {
      // Arrange
      const token = "invalid-jwt-token";
      mockReq.headers.authorization = `Bearer ${token}`;
      mockJwt.verify.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      // Act
      verifyJWT(mockReq, mockRes, mockNext);

      // Assert
      expect(mockJwt.verify).toHaveBeenCalledWith(token, "test-secret-key");
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Invalid token" });
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });

    it("should return 403 when token is expired", () => {
      // Arrange
      const token = "expired-jwt-token";
      mockReq.headers.authorization = `Bearer ${token}`;
      mockJwt.verify.mockImplementation(() => {
        throw new Error("jwt expired");
      });

      // Act
      verifyJWT(mockReq, mockRes, mockNext);

      // Assert
      expect(mockJwt.verify).toHaveBeenCalledWith(token, "test-secret-key");
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Invalid token" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 403 when token has invalid signature", () => {
      // Arrange
      const token = "invalid-signature-token";
      mockReq.headers.authorization = `Bearer ${token}`;
      mockJwt.verify.mockImplementation(() => {
        throw new Error("invalid signature");
      });

      // Act
      verifyJWT(mockReq, mockRes, mockNext);

      // Assert
      expect(mockJwt.verify).toHaveBeenCalledWith(token, "test-secret-key");
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Invalid token" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 403 when token is malformed", () => {
      // Arrange
      const token = "malformed-token";
      mockReq.headers.authorization = `Bearer ${token}`;
      mockJwt.verify.mockImplementation(() => {
        throw new Error("jwt malformed");
      });

      // Act
      verifyJWT(mockReq, mockRes, mockNext);

      // Assert
      expect(mockJwt.verify).toHaveBeenCalledWith(token, "test-secret-key");
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Invalid token" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 403 when token is not yet valid", () => {
      // Arrange
      const token = "not-yet-valid-token";
      mockReq.headers.authorization = `Bearer ${token}`;
      mockJwt.verify.mockImplementation(() => {
        throw new Error("jwt not active");
      });

      // Act
      verifyJWT(mockReq, mockRes, mockNext);

      // Assert
      expect(mockJwt.verify).toHaveBeenCalledWith(token, "test-secret-key");
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Invalid token" });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
