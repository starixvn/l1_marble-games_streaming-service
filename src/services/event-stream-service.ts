import { AppContainer } from "../types";
import { Response } from "express";
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
    this.clientManager.addClient(res, gameId);
    const currentFeaturePayload = this.inGameConsumer.getCurrentByGameId(gameId);

    res.write(`data: ${JSON.stringify({ ...currentFeaturePayload, message: "FeatureBroadCast" })}\n\n`);
  }
}
