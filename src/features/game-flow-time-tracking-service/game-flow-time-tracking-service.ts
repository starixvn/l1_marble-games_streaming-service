export class GameFlowTimeTrackingService {
    private trackPointByGameId: Record<string, number> = {};

    setTrackPoint(gameId: string, timestamp: number) {
        this.trackPointByGameId[gameId] = timestamp;
    }

    getRelativeTime(gameId: string): number {
        return (Date.now() - (this.trackPointByGameId[gameId] ?? Date.now())) / 1000;
    }
}