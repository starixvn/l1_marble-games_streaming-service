import { ClientManager } from "../managers/client-manager";

interface GameBroadcastServiceContainer {
    clientManager: ClientManager;
}

export class GameBroadcastService {
    
    private readonly clientManager: ClientManager;

    constructor(container: GameBroadcastServiceContainer) {
        this.clientManager = container.clientManager;
    }

    public broadcastToAllClientByGameId(gameId: string, payload: object, eventName?: string): void {
        const clientsToBroadcast = this.clientManager.getClientSetForGame(gameId);
        for (const client of clientsToBroadcast) {
          client.write(`data: ${JSON.stringify({ [eventName ?? "data"]: payload, message: "FeatureBoardCast" })}\n\n`);
        }
    }
}