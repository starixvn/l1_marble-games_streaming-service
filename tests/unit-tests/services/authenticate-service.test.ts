import { AuthenticateService } from "../../../src/services/authenticate-service";
import { Operator } from "../../../src/models/operators";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { appConfigs } from "../../../src/app-configs";

// Mock dependencies
jest.mock("jsonwebtoken");
jest.mock("bcryptjs");
jest.mock("../../../src/models/operators");
jest.mock("../../../src/app-configs");

const mockJwt = jwt as jest.Mocked<any>;
const mockBcrypt = bcrypt as jest.Mocked<any>;
const mockOperator = Operator as jest.Mocked<any>;

describe("AuthenticateService", () => {
  let authenticateService: AuthenticateService;

  beforeEach(() => {
    jest.clearAllMocks();
    authenticateService = new AuthenticateService();

    // Mock appConfigs
    (appConfigs as any) = {
      jwt: {
        secret: "test-secret-key",
      },
    };
  });

  describe("generateJwtToken", () => {
    it("should generate a JWT token with correct payload and options", async () => {
      // Arrange
      const payload = { id: "123", name: "test-user" };
      const expectedToken = "mock-jwt-token";
      mockJwt.sign.mockReturnValue(expectedToken);

      // Act
      const result = await authenticateService.generateJwtToken(payload);

      // Assert
      expect(result).toBe(expectedToken);
      expect(mockJwt.sign).toHaveBeenCalledWith(payload, "test-secret-key", { expiresIn: "2h" });
    });

    it("should handle different payload types", async () => {
      // Arrange
      const payload = { userId: "456", role: "admin", permissions: ["read", "write"] };
      const expectedToken = "mock-jwt-token-with-complex-payload";
      mockJwt.sign.mockReturnValue(expectedToken);

      // Act
      const result = await authenticateService.generateJwtToken(payload);

      // Assert
      expect(result).toBe(expectedToken);
      expect(mockJwt.sign).toHaveBeenCalledWith(payload, "test-secret-key", { expiresIn: "2h" });
    });

    it("should handle empty payload", async () => {
      // Arrange
      const payload = {};
      const expectedToken = "mock-jwt-token-empty-payload";
      mockJwt.sign.mockReturnValue(expectedToken);

      // Act
      const result = await authenticateService.generateJwtToken(payload);

      // Assert
      expect(result).toBe(expectedToken);
      expect(mockJwt.sign).toHaveBeenCalledWith(payload, "test-secret-key", { expiresIn: "2h" });
    });

    it("should handle JWT signing errors", async () => {
      // Arrange
      const payload = { id: "123" };
      const jwtError = new Error("JWT signing failed");
      mockJwt.sign.mockImplementation(() => {
        throw jwtError;
      });

      // Act & Assert
      await expect(authenticateService.generateJwtToken(payload)).rejects.toThrow("JWT signing failed");
    });
  });

  describe("getAuthenticatedToken", () => {
    it("should return JWT token for valid credentials", async () => {
      // Arrange
      const operatorId = "123";
      const password = "valid-password";
      const hashedPassword = "hashed-password";
      const mockOperatorData = {
        _id: "123",
        name: "test-operator",
        password: hashedPassword,
      };
      const expectedToken = "valid-jwt-token";

      mockOperator.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockOperatorData),
        }),
      } as any);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockReturnValue(expectedToken);

      // Act
      const result = await authenticateService.getAuthenticatedToken(operatorId, password);

      // Assert
      expect(result).toBe(expectedToken);
      expect(mockOperator.findById).toHaveBeenCalledWith(operatorId);
      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(mockJwt.sign).toHaveBeenCalledWith({ id: "123", name: "test-operator" }, "test-secret-key", {
        expiresIn: "2h",
      });
    });

    it("should throw error when operator is not found", async () => {
      // Arrange
      const operatorId = "non-existent";
      const password = "any-password";

      mockOperator.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      } as any);

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(operatorId, password)).rejects.toThrow(
        "Invalid username or password"
      );
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
      expect(mockJwt.sign).not.toHaveBeenCalled();
    });

    it("should throw error when operator has no password", async () => {
      // Arrange
      const operatorId = "123";
      const password = "any-password";
      const mockOperatorData = {
        _id: "123",
        name: "test-operator",
        password: null,
      };

      mockOperator.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockOperatorData),
        }),
      } as any);

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(operatorId, password)).rejects.toThrow(
        "Invalid username or password"
      );
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
      expect(mockJwt.sign).not.toHaveBeenCalled();
    });

    it("should throw error when password is incorrect", async () => {
      // Arrange
      const operatorId = "123";
      const password = "wrong-password";
      const hashedPassword = "hashed-password";
      const mockOperatorData = {
        _id: "123",
        name: "test-operator",
        password: hashedPassword,
      };

      mockOperator.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockOperatorData),
        }),
      } as any);
      mockBcrypt.compare.mockResolvedValue(false);

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(operatorId, password)).rejects.toThrow(
        "Invalid username or password"
      );
      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(mockJwt.sign).not.toHaveBeenCalled();
    });

    it("should handle bcrypt comparison errors", async () => {
      // Arrange
      const operatorId = "123";
      const password = "test-password";
      const hashedPassword = "hashed-password";
      const mockOperatorData = {
        _id: "123",
        name: "test-operator",
        password: hashedPassword,
      };
      const bcryptError = new Error("Bcrypt comparison failed");

      mockOperator.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockOperatorData),
        }),
      } as any);
      mockBcrypt.compare.mockRejectedValue(bcryptError);

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(operatorId, password)).rejects.toThrow(
        "Bcrypt comparison failed"
      );
    });

    it("should handle database query errors", async () => {
      // Arrange
      const operatorId = "123";
      const password = "test-password";
      const dbError = new Error("Database connection failed");

      mockOperator.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockRejectedValue(dbError),
        }),
      } as any);

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(operatorId, password)).rejects.toThrow(
        "Database connection failed"
      );
    });

    it("should handle empty operator ID", async () => {
      // Arrange
      const operatorId = "";
      const password = "test-password";

      mockOperator.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      } as any);

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(operatorId, password)).rejects.toThrow(
        "Invalid username or password"
      );
    });

    it("should handle empty password", async () => {
      // Arrange
      const operatorId = "123";
      const password = "";
      const hashedPassword = "hashed-password";
      const mockOperatorData = {
        _id: "123",
        name: "test-operator",
        password: hashedPassword,
      };

      mockOperator.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockOperatorData),
        }),
      } as any);
      mockBcrypt.compare.mockResolvedValue(false);

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(operatorId, password)).rejects.toThrow(
        "Invalid username or password"
      );
    });

    it("should handle operator with undefined password field", async () => {
      // Arrange
      const operatorId = "123";
      const password = "test-password";
      const mockOperatorData = {
        _id: "123",
        name: "test-operator",
        // password field is undefined
      };

      mockOperator.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockOperatorData),
        }),
      } as any);

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(operatorId, password)).rejects.toThrow(
        "Invalid username or password"
      );
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    it("should handle operator with empty string password", async () => {
      // Arrange
      const operatorId = "123";
      const password = "test-password";
      const mockOperatorData = {
        _id: "123",
        name: "test-operator",
        password: "",
      };

      mockOperator.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockOperatorData),
        }),
      } as any);

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(operatorId, password)).rejects.toThrow(
        "Invalid username or password"
      );
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    it("should create correct JWT payload with operator data", async () => {
      // Arrange
      const operatorId = "123";
      const password = "valid-password";
      const hashedPassword = "hashed-password";
      const mockOperatorData = {
        _id: "123",
        name: "John Doe",
        email: "john@example.com",
        role: "admin",
        password: hashedPassword,
      };
      const expectedToken = "valid-jwt-token";

      mockOperator.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockOperatorData),
        }),
      } as any);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockReturnValue(expectedToken);

      // Act
      const result = await authenticateService.getAuthenticatedToken(operatorId, password);

      // Assert
      expect(result).toBe(expectedToken);
      expect(mockJwt.sign).toHaveBeenCalledWith({ id: "123", name: "John Doe" }, "test-secret-key", {
        expiresIn: "2h",
      });
    });
  });

  describe("integration scenarios", () => {
    it("should handle successful authentication flow end-to-end", async () => {
      // Arrange
      const operatorId = "user-123";
      const password = "secure-password";
      const hashedPassword = "$2a$10$hashed.password.hash";
      const mockOperatorData = {
        _id: "user-123",
        name: "Alice Johnson",
        password: hashedPassword,
      };
      const expectedToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

      mockOperator.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockOperatorData),
        }),
      } as any);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockReturnValue(expectedToken);

      // Act
      const result = await authenticateService.getAuthenticatedToken(operatorId, password);

      // Assert
      expect(result).toBe(expectedToken);
      expect(mockOperator.findById).toHaveBeenCalledWith(operatorId);
      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(mockJwt.sign).toHaveBeenCalledWith({ id: "user-123", name: "Alice Johnson" }, "test-secret-key", {
        expiresIn: "2h",
      });
    });

    it("should handle multiple authentication attempts", async () => {
      // Arrange
      const operatorId = "user-456";
      const password = "correct-password";
      const hashedPassword = "$2a$10$correct.hash";
      const mockOperatorData = {
        _id: "user-456",
        name: "Bob Smith",
        password: hashedPassword,
      };
      const expectedToken = "valid-jwt-token";

      mockOperator.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockOperatorData),
        }),
      } as any);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockReturnValue(expectedToken);

      // Act - Multiple authentication attempts
      const result1 = await authenticateService.getAuthenticatedToken(operatorId, password);
      const result2 = await authenticateService.getAuthenticatedToken(operatorId, password);
      const result3 = await authenticateService.getAuthenticatedToken(operatorId, password);

      // Assert
      expect(result1).toBe(expectedToken);
      expect(result2).toBe(expectedToken);
      expect(result3).toBe(expectedToken);
      expect(mockOperator.findById).toHaveBeenCalledTimes(3);
      expect(mockBcrypt.compare).toHaveBeenCalledTimes(3);
      expect(mockJwt.sign).toHaveBeenCalledTimes(3);
    });
  });

  describe("error handling and edge cases", () => {
    it("should handle null operator data", async () => {
      // Arrange
      const operatorId = "123";
      const password = "test-password";

      mockOperator.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      } as any);

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(operatorId, password)).rejects.toThrow(
        "Invalid username or password"
      );
    });

    it("should handle undefined operator data", async () => {
      // Arrange
      const operatorId = "123";
      const password = "test-password";

      mockOperator.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(undefined),
        }),
      } as any);

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(operatorId, password)).rejects.toThrow(
        "Invalid username or password"
      );
    });

    it("should handle special characters in operator ID", async () => {
      // Arrange
      const operatorId = "user-123@example.com";
      const password = "test-password";

      mockOperator.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      } as any);

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(operatorId, password)).rejects.toThrow(
        "Invalid username or password"
      );
    });

    it("should handle very long passwords", async () => {
      // Arrange
      const operatorId = "123";
      const password = "a".repeat(1000); // Very long password
      const hashedPassword = "hashed-password";
      const mockOperatorData = {
        _id: "123",
        name: "test-operator",
        password: hashedPassword,
      };

      mockOperator.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockOperatorData),
        }),
      } as any);
      mockBcrypt.compare.mockResolvedValue(false);

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(operatorId, password)).rejects.toThrow(
        "Invalid username or password"
      );
      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
    });

    it("should handle JWT signing errors during authentication", async () => {
      // Arrange
      const operatorId = "123";
      const password = "valid-password";
      const hashedPassword = "hashed-password";
      const mockOperatorData = {
        _id: "123",
        name: "test-operator",
        password: hashedPassword,
      };
      const jwtError = new Error("JWT signing failed");

      mockOperator.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockOperatorData),
        }),
      } as any);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockImplementation(() => {
        throw jwtError;
      });

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(operatorId, password)).rejects.toThrow(
        "JWT signing failed"
      );
    });
  });
});
