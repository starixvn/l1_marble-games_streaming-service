export interface StatefulService<T> {
    getCurrentByGameId(gameId: string): T | undefined;
    setCurrentByGameId(gameId: string, state: T): void;
}