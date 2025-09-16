import { idHelper } from "../../helpers";
import { Event } from "../../types";
import { OddFeedEventSource, SystemNotification } from "./odd-feed-event-source";

interface OddFeedStoreContainer {
    oddFeedEventSource: OddFeedEventSource;
}

export class OddFeedStore {
    // [gameId][eventId]
    private readonly eventByGameId: Record<string, Record<number, Event>> = {};
    private readonly oddFeedEventSource: OddFeedEventSource;
    private readonly boundHandleSystemDataCleanup: (notification: SystemNotification) => void;
    constructor(container: OddFeedStoreContainer) {
        this.oddFeedEventSource = container.oddFeedEventSource;
        this.boundHandleSystemDataCleanup = this.handleSystemDataCleanup.bind(this);
        this.oddFeedEventSource.registerSystemDataCleanupEventListener(this.boundHandleSystemDataCleanup);
    }

    public initEvent() {
        this.oddFeedEventSource.registerSystemDataCleanupEventListener(this.boundHandleSystemDataCleanup);
    }

    public dispose() {
        this.oddFeedEventSource.unregisterSystemDataCleanupEventListener(this.boundHandleSystemDataCleanup);
    }

    public handleSystemDataCleanup({ eventID }: SystemNotification) {
        this.cleanup(eventID);
    }

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

    cleanup(eventId: number): void {
        
        const gameId = idHelper.extractGameId(eventId);

        console.log(`Cleaning up event ${eventId} for game ${gameId}`);
        if (!this.eventByGameId[gameId]) {
            return;
        }

        delete this.eventByGameId[gameId][eventId];
    }
}