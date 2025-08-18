import { AuthenticateService } from "../../../src/services/authenticate-service";
import jwt from "jsonwebtoken";
import { appConfigs } from "../../../src/app-configs";

// Mock dependencies
jest.mock("jsonwebtoken");
jest.mock("../../../src/app-configs");

const mockJwt = jwt as jest.Mocked<any>;

describe("AuthenticateService", () => {
  let authenticateService: AuthenticateService;

  beforeEach(() => {
    jest.clearAllMocks();
    authenticateService = new AuthenticateService();

    // Mock appConfigs
    (appConfigs as any) = {
      jwt: {
        username: "marble-tv",
        password: "marble-tv-123",
        secret: "stream-service-secret",
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
      expect(mockJwt.sign).toHaveBeenCalledWith(payload, "stream-service-secret", { expiresIn: "2h" });
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
      expect(mockJwt.sign).toHaveBeenCalledWith(payload, "stream-service-secret", { expiresIn: "2h" });
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
      expect(mockJwt.sign).toHaveBeenCalledWith(payload, "stream-service-secret", { expiresIn: "2h" });
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
      const username = "marble-tv";
      const password = "marble-tv-123";
      const expectedToken = "valid-jwt-token";
      mockJwt.sign.mockReturnValue(expectedToken);

      // Act
      const result = await authenticateService.getAuthenticatedToken(username, password);

      // Assert
      expect(result).toBe(expectedToken);
      expect(mockJwt.sign).toHaveBeenCalledWith({ name: "marble-tv" }, "stream-service-secret", { expiresIn: "2h" });
    });

    it("should throw error when username is incorrect", async () => {
      // Arrange
      const username = "wrong-username";
      const password = "marble-tv-123";

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(username, password)).rejects.toThrow(
        "Invalid username or password"
      );
      expect(mockJwt.sign).not.toHaveBeenCalled();
    });

    it("should throw error when password is incorrect", async () => {
      // Arrange
      const username = "marble-tv";
      const password = "wrong-password";

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(username, password)).rejects.toThrow(
        "Invalid username or password"
      );
      expect(mockJwt.sign).not.toHaveBeenCalled();
    });

    it("should throw error when both username and password are incorrect", async () => {
      // Arrange
      const username = "wrong-username";
      const password = "wrong-password";

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(username, password)).rejects.toThrow(
        "Invalid username or password"
      );
      expect(mockJwt.sign).not.toHaveBeenCalled();
    });

    it("should handle empty username", async () => {
      // Arrange
      const username = "";
      const password = "marble-tv-123";

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(username, password)).rejects.toThrow(
        "Invalid username or password"
      );
    });

    it("should handle empty password", async () => {
      // Arrange
      const username = "marble-tv";
      const password = "";

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(username, password)).rejects.toThrow(
        "Invalid username or password"
      );
    });

    it("should handle null username", async () => {
      // Arrange
      const username = null as any;
      const password = "marble-tv-123";

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(username, password)).rejects.toThrow(
        "Invalid username or password"
      );
    });

    it("should handle null password", async () => {
      // Arrange
      const username = "marble-tv";
      const password = null as any;

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(username, password)).rejects.toThrow(
        "Invalid username or password"
      );
    });

    it("should handle undefined username", async () => {
      // Arrange
      const username = undefined as any;
      const password = "marble-tv-123";

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(username, password)).rejects.toThrow(
        "Invalid username or password"
      );
    });

    it("should handle undefined password", async () => {
      // Arrange
      const username = "marble-tv";
      const password = undefined as any;

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(username, password)).rejects.toThrow(
        "Invalid username or password"
      );
    });

    it("should create correct JWT payload with username", async () => {
      // Arrange
      const username = "marble-tv";
      const password = "marble-tv-123";
      const expectedToken = "valid-jwt-token";

      mockJwt.sign.mockReturnValue(expectedToken);

      // Act
      const result = await authenticateService.getAuthenticatedToken(username, password);

      // Assert
      expect(result).toBe(expectedToken);
      expect(mockJwt.sign).toHaveBeenCalledWith({ name: "marble-tv" }, "stream-service-secret", {
        expiresIn: "2h",
      });
    });
  });

  describe("integration scenarios", () => {
    it("should handle successful authentication flow end-to-end", async () => {
      // Arrange
      const username = "marble-tv";
      const password = "marble-tv-123";
      const expectedToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

      mockJwt.sign.mockReturnValue(expectedToken);

      // Act
      const result = await authenticateService.getAuthenticatedToken(username, password);

      // Assert
      expect(result).toBe(expectedToken);
      expect(mockJwt.sign).toHaveBeenCalledWith({ name: "marble-tv" }, "stream-service-secret", {
        expiresIn: "2h",
      });
    });

    it("should handle multiple authentication attempts", async () => {
      // Arrange
      const username = "marble-tv";
      const password = "marble-tv-123";
      const expectedToken = "valid-jwt-token";

      mockJwt.sign.mockReturnValue(expectedToken);

      // Act - Multiple authentication attempts
      const result1 = await authenticateService.getAuthenticatedToken(username, password);
      const result2 = await authenticateService.getAuthenticatedToken(username, password);
      const result3 = await authenticateService.getAuthenticatedToken(username, password);

      // Assert
      expect(result1).toBe(expectedToken);
      expect(result2).toBe(expectedToken);
      expect(result3).toBe(expectedToken);
      expect(mockJwt.sign).toHaveBeenCalledTimes(3);
      expect(mockJwt.sign).toHaveBeenCalledWith({ name: "marble-tv" }, "stream-service-secret", {
        expiresIn: "2h",
      });
    });
  });

  describe("error handling and edge cases", () => {
    it("should handle case-sensitive username comparison", async () => {
      // Arrange
      const username = "MARBLE-TV"; // Different case
      const password = "marble-tv-123";

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(username, password)).rejects.toThrow(
        "Invalid username or password"
      );
    });

    it("should handle case-sensitive password comparison", async () => {
      // Arrange
      const username = "marble-tv";
      const password = "MARBLE-TV-123"; // Different case

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(username, password)).rejects.toThrow(
        "Invalid username or password"
      );
    });

    it("should handle special characters in username", async () => {
      // Arrange
      const username = "marble-tv@example.com";
      const password = "marble-tv-123";

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(username, password)).rejects.toThrow(
        "Invalid username or password"
      );
    });

    it("should handle special characters in password", async () => {
      // Arrange
      const username = "marble-tv";
      const password = "marble-tv-123!@#";

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(username, password)).rejects.toThrow(
        "Invalid username or password"
      );
    });

    it("should handle very long username", async () => {
      // Arrange
      const username = "a".repeat(1000); // Very long username
      const password = "marble-tv-123";

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(username, password)).rejects.toThrow(
        "Invalid username or password"
      );
    });

    it("should handle very long password", async () => {
      // Arrange
      const username = "marble-tv";
      const password = "a".repeat(1000); // Very long password

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(username, password)).rejects.toThrow(
        "Invalid username or password"
      );
    });

    it("should handle JWT signing errors during authentication", async () => {
      // Arrange
      const username = "marble-tv";
      const password = "marble-tv-123";
      const jwtError = new Error("JWT signing failed");

      mockJwt.sign.mockImplementation(() => {
        throw jwtError;
      });

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(username, password)).rejects.toThrow("JWT signing failed");
    });

    it("should handle whitespace in username", async () => {
      // Arrange
      const username = " marble-tv "; // With whitespace
      const password = "marble-tv-123";

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(username, password)).rejects.toThrow(
        "Invalid username or password"
      );
    });

    it("should handle whitespace in password", async () => {
      // Arrange
      const username = "marble-tv";
      const password = " marble-tv-123 "; // With whitespace

      // Act & Assert
      await expect(authenticateService.getAuthenticatedToken(username, password)).rejects.toThrow(
        "Invalid username or password"
      );
    });
  });
});
