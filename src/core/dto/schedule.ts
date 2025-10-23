export class Schedule<TPayload = any> {
    time: Date;
    callback?: () => void;
    payload?: TPayload;
    meta?: {
        gameId: string;
    };
    eventName: string;

    constructor({ time, callback, payload, meta, eventName }: { time: Date, callback?: () => void, payload?: TPayload, meta?: { gameId: string }, eventName?: string }) {
        this.time = time;
        this.callback = callback;
        this.payload = payload;
        this.meta = meta;
        this.eventName = eventName ?? "Unknown";
    }

}