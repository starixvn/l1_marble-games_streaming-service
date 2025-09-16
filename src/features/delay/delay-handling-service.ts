import { EventNotification, OddFeedEventName, OddFeedEventSource } from "../odd-feed-data";

type DelayConfig = {
    globalDelayInMillisecond: number;
    videoDelayInMillisecond: number;
}

export interface DelayHandlingServiceContainer {
    oddFeedEventSource: OddFeedEventSource;
}


export class DelayHandlingService {

    private readonly _delayConfigByEventId: Record<number, DelayConfig> = {};
    private readonly oddsFeedEventSource: OddFeedEventSource;
    private readonly boundHandleEventUpcoming: (notification: EventNotification) => void;

    constructor(container: DelayHandlingServiceContainer) {
        this.oddsFeedEventSource = container.oddFeedEventSource;
        this.boundHandleEventUpcoming = this.handleEventUpcoming.bind(this);
    }

    public initEvent() {
        this.oddsFeedEventSource.registerEventListener(
            OddFeedEventName.EventUpcoming,
            this.boundHandleEventUpcoming
        )
    }

    public getDelayConfig(eventId: number): DelayConfig | undefined {
        return this._delayConfigByEventId[eventId];
    }

    public getDelayedTime({ eventId, time }: { eventId: number, time: Date }): Date {
        const config = this._delayConfigByEventId[eventId];
        if (!config) {
            return time;
        }
        return new Date(time.getTime() + config.globalDelayInMillisecond);
    }

    public getDelayedTimeWithVideoDelay({ eventId, time }: { eventId: number, time: Date }): Date {
        const config = this._delayConfigByEventId[eventId];
        if (!config) {
            return time;
        }
        return new Date(this.getDelayedTime({ eventId, time }).getTime() + config.videoDelayInMillisecond);
    }

    public handleEventUpcoming({ event }: EventNotification) {
        const config = (event as any).config.delay as DelayConfig;
        if (config) {
            this._delayConfigByEventId[event.eventID] = config;
        }
    }

    public dispose() {
        this.oddsFeedEventSource.unregisterEventListener(
            OddFeedEventName.EventUpcoming,
            this.boundHandleEventUpcoming
        )
        return this;
    }
}