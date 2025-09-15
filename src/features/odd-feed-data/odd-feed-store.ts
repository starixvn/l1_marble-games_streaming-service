import { Event } from "../../types";

export class OddFeedStore {
    // [gameId][eventId]
    private readonly eventByGameId: Record<string, Record<number, Event>> = {};

    setEventByGameId(gameId: string, eventId: number, event: Event): void {
        if (!this.eventByGameId[gameId]) {
            this.eventByGameId[gameId] = {};
        }

        this.eventByGameId[gameId][eventId] = event;
    }

    getEventByGameId(gameId: string, eventId: number): Event | undefined {
        if (!this.eventByGameId[gameId]) {
            return undefined;
        }

        return this.eventByGameId[gameId][eventId];
    }
}