import { ClientManager } from "../../../src/managers/client-manager";
import { mockContainer } from "../global-stubs";
import { Response } from "express";

// Mock Express Response
const createMockResponse = (): jest.Mocked<Response> => {
  const mockRes = {
    on: jest.fn(),
    destroyed: false,
    writableEnded: false,
    end: jest.fn(),
  } as any;
  return mockRes;
};

describe("ClientManager", () => {
  let clientManager: ClientManager;
  let mockRes1: jest.Mocked<Response>;
  let mockRes2: jest.Mocked<Response>;
  let mockRes3: jest.Mocked<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    clientManager = new ClientManager(mockContainer);
    mockRes1 = createMockResponse();
    mockRes2 = createMockResponse();
    mockRes3 = createMockResponse();
  });

  afterEach(() => {
    jest.useRealTimers();
    clientManager.destroy();
  });

  describe("addClient", () => {
    it("should add a client to a new game", () => {
      // Arrange
      const gameId = "game-123";

      // Act
      clientManager.addClient(mockRes1, gameId);

      // Assert
      expect(clientManager.getClientCount(gameId)).toBe(1);
      expect(clientManager.getTotalClientCount()).toBe(1);
      expect(mockRes1.on).toHaveBeenCalledWith("close", expect.any(Function));
    });

    it("should add multiple clients to the same game", () => {
      // Arrange
      const gameId = "game-123";

      // Act
      clientManager.addClient(mockRes1, gameId);
      clientManager.addClient(mockRes2, gameId);

      // Assert
      expect(clientManager.getClientCount(gameId)).toBe(2);
      expect(clientManager.getTotalClientCount()).toBe(2);
    });

    it("should add clients to different games", () => {
      // Arrange
      const gameId1 = "game-123";
      const gameId2 = "game-456";

      // Act
      clientManager.addClient(mockRes1, gameId1);
      clientManager.addClient(mockRes2, gameId2);

      // Assert
      expect(clientManager.getClientCount(gameId1)).toBe(1);
      expect(clientManager.getClientCount(gameId2)).toBe(1);
      expect(clientManager.getTotalClientCount()).toBe(2);
    });

    it("should register close event handler for each client", () => {
      // Arrange
      const gameId = "game-123";

      // Act
      clientManager.addClient(mockRes1, gameId);

      // Assert
      expect(mockRes1.on).toHaveBeenCalledWith("close", expect.any(Function));
    });

    it("should handle adding the same client multiple times", () => {
      // Arrange
      const gameId = "game-123";

      // Act
      clientManager.addClient(mockRes1, gameId);
      clientManager.addClient(mockRes1, gameId);

      // Assert
      expect(clientManager.getClientCount(gameId)).toBe(1);
      expect(clientManager.getTotalClientCount()).toBe(1);
    });
  });

  describe("removeClient", () => {
    it("should remove a client from a game", () => {
      // Arrange
      const gameId = "game-123";
      clientManager.addClient(mockRes1, gameId);
      clientManager.addClient(mockRes2, gameId);

      // Act
      clientManager.removeClient(gameId, mockRes1);

      // Assert
      expect(clientManager.getClientCount(gameId)).toBe(1);
      expect(clientManager.getTotalClientCount()).toBe(1);
    });

    it("should remove the last client and delete the game entry", () => {
      // Arrange
      const gameId = "game-123";
      clientManager.addClient(mockRes1, gameId);

      // Act
      clientManager.removeClient(gameId, mockRes1);

      // Assert
      expect(clientManager.getClientCount(gameId)).toBe(0);
      expect(clientManager.getTotalClientCount()).toBe(0);
      expect(clientManager.getClientSetForGame(gameId).size).toBe(0);
    });

    it("should handle removing client from non-existent game", () => {
      // Act & Assert
      expect(() => {
        clientManager.removeClient("non-existent", mockRes1);
      }).not.toThrow();

      expect(clientManager.getTotalClientCount()).toBe(0);
    });

    it("should handle removing non-existent client", () => {
      // Arrange
      const gameId = "game-123";
      clientManager.addClient(mockRes1, gameId);

      // Act
      clientManager.removeClient(gameId, mockRes2);

      // Assert
      expect(clientManager.getClientCount(gameId)).toBe(1);
      expect(clientManager.getTotalClientCount()).toBe(1);
    });

    it("should handle removing client multiple times", () => {
      // Arrange
      const gameId = "game-123";
      clientManager.addClient(mockRes1, gameId);

      // Act
      clientManager.removeClient(gameId, mockRes1);
      clientManager.removeClient(gameId, mockRes1);

      // Assert
      expect(clientManager.getClientCount(gameId)).toBe(0);
      expect(clientManager.getTotalClientCount()).toBe(0);
    });
  });

  describe("getClientSetForGame", () => {
    it("should return empty set for non-existent game", () => {
      // Act
      const clientSet = clientManager.getClientSetForGame("non-existent");

      // Assert
      expect(clientSet.size).toBe(0);
    });

    it("should return set with clients for existing game", () => {
      // Arrange
      const gameId = "game-123";
      clientManager.addClient(mockRes1, gameId);
      clientManager.addClient(mockRes2, gameId);

      // Act
      const clientSet = clientManager.getClientSetForGame(gameId);

      // Assert
      expect(clientSet.size).toBe(2);
      expect(clientSet.has(mockRes1)).toBe(true);
      expect(clientSet.has(mockRes2)).toBe(true);
    });

    it("should return empty set after all clients are removed", () => {
      // Arrange
      const gameId = "game-123";
      clientManager.addClient(mockRes1, gameId);
      clientManager.removeClient(gameId, mockRes1);

      // Act
      const clientSet = clientManager.getClientSetForGame(gameId);

      // Assert
      expect(clientSet.size).toBe(0);
    });
  });

  describe("getClientCount", () => {
    it("should return 0 for non-existent game", () => {
      // Act & Assert
      expect(clientManager.getClientCount("non-existent")).toBe(0);
    });

    it("should return correct count for game with clients", () => {
      // Arrange
      const gameId = "game-123";
      clientManager.addClient(mockRes1, gameId);
      clientManager.addClient(mockRes2, gameId);

      // Act & Assert
      expect(clientManager.getClientCount(gameId)).toBe(2);
    });

    it("should return 0 after all clients are removed", () => {
      // Arrange
      const gameId = "game-123";
      clientManager.addClient(mockRes1, gameId);
      clientManager.removeClient(gameId, mockRes1);

      // Act & Assert
      expect(clientManager.getClientCount(gameId)).toBe(0);
    });
  });

  describe("getTotalClientCount", () => {
    it("should return 0 when no clients exist", () => {
      // Act & Assert
      expect(clientManager.getTotalClientCount()).toBe(0);
    });

    it("should return total count across all games", () => {
      // Arrange
      clientManager.addClient(mockRes1, "game-123");
      clientManager.addClient(mockRes2, "game-123");
      clientManager.addClient(mockRes3, "game-456");

      // Act & Assert
      expect(clientManager.getTotalClientCount()).toBe(3);
    });

    it("should update count when clients are removed", () => {
      // Arrange
      clientManager.addClient(mockRes1, "game-123");
      clientManager.addClient(mockRes2, "game-123");
      clientManager.addClient(mockRes3, "game-456");

      // Act
      clientManager.removeClient("game-123", mockRes1);

      // Assert
      expect(clientManager.getTotalClientCount()).toBe(2);
    });
  });

  describe("cleanupDeadConnections", () => {
    it("should remove destroyed connections", () => {
      // Arrange
      const gameId = "game-123";
      clientManager.addClient(mockRes1, gameId);
      clientManager.addClient(mockRes2, gameId);
      mockRes1.destroyed = true;

      // Act
      clientManager.cleanupDeadConnections();

      // Assert
      expect(clientManager.getClientCount(gameId)).toBe(1);
      expect(clientManager.getTotalClientCount()).toBe(1);
      expect(mockContainer.logService.log).toHaveBeenCalledWith("Cleaned up 1 dead connections from game game-123");
    });

    it("should remove game entry when all clients are dead", () => {
      // Arrange
      const gameId = "game-123";
      clientManager.addClient(mockRes1, gameId);
      mockRes1.destroyed = true;

      // Act
      clientManager.cleanupDeadConnections();

      // Assert
      expect(clientManager.getClientCount(gameId)).toBe(0);
      expect(clientManager.getTotalClientCount()).toBe(0);
      expect(clientManager.getClientSetForGame(gameId).size).toBe(0);
    });

    it("should handle multiple dead connections", () => {
      // Arrange
      const gameId = "game-123";
      clientManager.addClient(mockRes1, gameId);
      clientManager.addClient(mockRes2, gameId);
      clientManager.addClient(mockRes3, gameId);
      mockRes1.destroyed = true;
      (mockRes2 as any).writableEnded = true;

      // Act
      clientManager.cleanupDeadConnections();

      // Assert
      expect(clientManager.getClientCount(gameId)).toBe(1);
      expect(clientManager.getTotalClientCount()).toBe(1);
      expect(mockContainer.logService.log).toHaveBeenCalledWith("Cleaned up 2 dead connections from game game-123");
    });

    it("should not log when no dead connections found", () => {
      // Arrange
      const gameId = "game-123";
      clientManager.addClient(mockRes1, gameId);

      // Act
      clientManager.cleanupDeadConnections();

      // Assert
      expect(clientManager.getClientCount(gameId)).toBe(1);
      expect(clientManager.getTotalClientCount()).toBe(1);
      expect(mockContainer.logService.log).not.toHaveBeenCalled();
    });

    it("should handle cleanup with no clients", () => {
      // Act & Assert
      expect(() => {
        clientManager.cleanupDeadConnections();
      }).not.toThrow();
    });
  });

  describe("destroy", () => {
    it("should clear all clients and stop cleanup interval", () => {
      // Arrange
      clientManager.addClient(mockRes1, "game-123");
      clientManager.addClient(mockRes2, "game-456");

      // Act
      clientManager.destroy();

      // Assert
      expect(clientManager.getTotalClientCount()).toBe(0);
      expect(clientManager.getClientCount("game-123")).toBe(0);
      expect(clientManager.getClientCount("game-456")).toBe(0);
    });

    it("should end active connections", () => {
      // Arrange
      clientManager.addClient(mockRes1, "game-123");
      clientManager.addClient(mockRes2, "game-456");
      mockRes1.destroyed = false;
      mockRes2.destroyed = true;

      // Act
      clientManager.destroy();

      // Assert
      expect(mockRes1.end).toHaveBeenCalled();
      expect(mockRes2.end).not.toHaveBeenCalled();
    });

    it("should handle destroy when no clients exist", () => {
      // Act & Assert
      expect(() => {
        clientManager.destroy();
      }).not.toThrow();
    });

    it("should clear the clients map", () => {
      // Arrange
      clientManager.addClient(mockRes1, "game-123");

      // Act
      clientManager.destroy();

      // Assert
      expect(clientManager.getClientSetForGame("game-123").size).toBe(0);
    });
  });

  describe("getConnectionStats", () => {
    it("should return empty object when no clients exist", () => {
      // Act
      const stats = clientManager.getConnectionStats();

      // Assert
      expect(stats).toEqual({});
    });

    it("should return stats for all games", () => {
      // Arrange
      clientManager.addClient(mockRes1, "game-123");
      clientManager.addClient(mockRes2, "game-123");
      clientManager.addClient(mockRes3, "game-456");

      // Act
      const stats = clientManager.getConnectionStats();

      // Assert
      expect(stats).toEqual({
        "game-123": 2,
        "game-456": 1,
      });
    });

    it("should return updated stats after client removal", () => {
      // Arrange
      clientManager.addClient(mockRes1, "game-123");
      clientManager.addClient(mockRes2, "game-123");
      clientManager.addClient(mockRes3, "game-456");
      clientManager.removeClient("game-123", mockRes1);

      // Act
      const stats = clientManager.getConnectionStats();

      // Assert
      expect(stats).toEqual({
        "game-123": 1,
        "game-456": 1,
      });
    });

    it("should not include games with zero clients", () => {
      // Arrange
      clientManager.addClient(mockRes1, "game-123");
      clientManager.removeClient("game-123", mockRes1);

      // Act
      const stats = clientManager.getConnectionStats();

      // Assert
      expect(stats).toEqual({});
    });
  });

  describe("client close event handling", () => {
    it("should remove client when close event is triggered", () => {
      // Arrange
      const gameId = "game-123";
      clientManager.addClient(mockRes1, gameId);
      clientManager.addClient(mockRes2, gameId);

      // Get the close handler
      const closeHandler = mockRes1.on.mock.calls.find((call) => call[0] === "close")?.[1];

      // Act
      if (closeHandler) {
        closeHandler();
      }

      // Assert
      expect(clientManager.getClientCount(gameId)).toBe(1);
      expect(clientManager.getTotalClientCount()).toBe(1);
    });

    it("should remove game entry when last client closes", () => {
      // Arrange
      const gameId = "game-123";
      clientManager.addClient(mockRes1, gameId);

      // Get the close handler
      const closeHandler = mockRes1.on.mock.calls.find((call) => call[0] === "close")?.[1];

      // Act
      if (closeHandler) {
        closeHandler();
      }

      // Assert
      expect(clientManager.getClientCount(gameId)).toBe(0);
      expect(clientManager.getTotalClientCount()).toBe(0);
    });
  });

  describe("cleanup interval", () => {
    it("should run cleanup every 60 seconds", () => {
      // Arrange
      jest.spyOn(clientManager, "cleanupDeadConnections");

      // Act - Advance time by 60 seconds
      jest.advanceTimersByTime(60000);

      // Assert
      expect(clientManager.cleanupDeadConnections).toHaveBeenCalled();
    });

    it("should run cleanup multiple times", () => {
      // Arrange
      jest.spyOn(clientManager, "cleanupDeadConnections");

      // Act - Advance time by 120 seconds (2 intervals)
      jest.advanceTimersByTime(120000);

      // Assert
      expect(clientManager.cleanupDeadConnections).toHaveBeenCalledTimes(2);
    });

    it("should stop cleanup interval on destroy", () => {
      // Arrange
      jest.spyOn(clientManager, "cleanupDeadConnections");

      // Act
      clientManager.destroy();
      jest.advanceTimersByTime(60000);

      // Assert
      expect(clientManager.cleanupDeadConnections).not.toHaveBeenCalled();
    });
  });
});
