import { AppContainer } from "../types";
import { Response } from "express";
import { appSettings } from "../app-settings";
import { ClientManager } from "../managers/client-manager";
import { InGameConsumer } from "../features/in-game-consumer/in-game-consumer";

export class EventStreamService {
  private readonly clientManager: ClientManager;
  private readonly inGameConsumer: InGameConsumer;

  constructor(container: AppContainer & { inGameConsumer: InGameConsumer }) {
    this.clientManager = container.clientManager;
    this.inGameConsumer = container.inGameConsumer;
  }

  public async addClient(res: Response, gameId: string): Promise<void> {
    if (!appSettings.gameIds.includes(gameId)) {
      res.write(`data: ${JSON.stringify({ message: "Game not supported" })}\n\n`);
      res.end();
      return;
    }

    this.clientManager.addClient(res, gameId);
    const currentFeaturePayload = this.inGameConsumer.getCurrentByGameId(gameId);

    res.write(`data: ${JSON.stringify({...currentFeaturePayload, message: "FeatureBroadCast" })}\n\n`);
  }
}
