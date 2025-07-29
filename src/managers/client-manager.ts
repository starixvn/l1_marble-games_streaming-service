import { AppContainer } from "../types";
import { logger } from "sc-common";
import { Response } from "express";

export class ClientManager {
  private clients = new Map<string, Set<Response>>();
  private readonly cleanupInterval: NodeJS.Timeout;
  private readonly logService: typeof logger;

  constructor(container: AppContainer) {
    this.logService = container.logService;

    // Cleanup dead connections every 60 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupDeadConnections();
    }, 60000);
  }

  addClient(res: Response, gameId: string): void {
    if (!this.clients.has(gameId)) {
      this.clients.set(gameId, new Set());
    }

    this.clients.get(gameId)?.add(res);

    res.on("close", () => {
      this.removeClient(gameId, res);
    });
  }

  removeClient(gameId: string, res: Response): void {
    const clients = this.clients.get(gameId);
    if (!clients) {
      return;
    }

    clients.delete(res);
  }

  getClientSetForGame(gameId: string): Set<Response> {
    const clients = this.clients.get(gameId);
    return clients ?? new Set();
  }

  getClientCount(gameId: string): number {
    const clients = this.clients.get(gameId);
    return clients ? clients.size : 0;
  }

  getTotalClientCount(): number {
    let total = 0;
    for (const clients of this.clients.values()) {
      total += clients.size;
    }
    return total;
  }

  cleanupDeadConnections(): void {
    for (const [gameId, clients] of this.clients) {
      const initialSize = clients.size;

      for (const client of clients) {
        if (client.destroyed || client.writableEnded) {
          clients.delete(client);
        }
      }

      if (clients.size !== initialSize) {
        this.logService.log(`Cleaned up ${initialSize - clients.size} dead connections from game ${gameId}`);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);

    for (const clients of this.clients.values()) {
      for (const client of clients) {
        if (!client.destroyed && !client.writableEnded) {
          client.end();
        }
      }
    }

    this.clients.clear();
  }

  getConnectionStats(): Record<string, number> {
    return Object.fromEntries(this.clients.entries().map(([gameId, clients]) => [gameId, clients.size]));
  }
}
