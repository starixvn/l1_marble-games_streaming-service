import { idHelper } from "../../helpers";
import { EventNotification, OddFeedEventName, OddFeedEventSource } from "../odd-feed-data";

interface EventCleanerServiceContainer {
    oddFeedEventSource: OddFeedEventSource;
}

export class EventCleanerService {
    private readonly oddFeedEventSource: OddFeedEventSource;
    private _eventQueueByGameId: Record<string, number[]> = {};
    private readonly maxLength = 3;
    private readonly boundHandleEventStart: (notification: EventNotification) => void;

    constructor(container: EventCleanerServiceContainer) {
        this.oddFeedEventSource = container.oddFeedEventSource;
        this.boundHandleEventStart = this.handleEventStart.bind(this);
    }

    public initEvent() {
        this.oddFeedEventSource.registerEventListener(
            OddFeedEventName.EventStart,
            this.boundHandleEventStart
        );
    }

    public dispose() {
        this.oddFeedEventSource.unregisterEventListener(
            OddFeedEventName.EventStart,
            this.boundHandleEventStart
        );
    }

    public handleEventStart({ event }: EventNotification) {
        const gameId = idHelper.extractGameId(event.eventID);
        if (!this._eventQueueByGameId[gameId]) {
            this._eventQueueByGameId[gameId] = [];
        }
        this._eventQueueByGameId[gameId].push(event.eventID);
        this.log(`event added event ${event.eventID} for game ${gameId}`);

        if (this._eventQueueByGameId[gameId].length > this.maxLength) {
            const eventIdToRemove = this._eventQueueByGameId[gameId].shift();
            if (eventIdToRemove) {
                this.log(`event queue want to clear event ${eventIdToRemove} for game ${gameId}`);
                this.oddFeedEventSource.onDataCleanup(eventIdToRemove);
            }
        }
    }

    private log(message: string) {
        console.log(`\x1b[31m[EventCleanerService]\x1b[37m: ${message}`);
    }
}