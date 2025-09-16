import { ClientManager } from "../managers/client-manager";

interface GameBoardcastServiceContainer {
    clientManager: ClientManager;
}

export class GameBroadcastService {
    
    private readonly clientManager: ClientManager;

    constructor(container: GameBoardcastServiceContainer) {
        this.clientManager = container.clientManager;
    }

    public broadcastToAllClientByGameId(gameId: string, payload: object): void {
        const clientsToBroadcast = this.clientManager.getClientSetForGame(gameId);
        for (const client of clientsToBroadcast) {
          client.write(`data: ${JSON.stringify({ ...payload, message: "FeatureBoardCast" })}\n\n`);
        }
    }
}