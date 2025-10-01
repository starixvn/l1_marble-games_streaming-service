import { EventNotification, OddFeedEventName, OddFeedEventSource } from "odd-feed-client";

type DelayConfig = {
    globalDelayInMillisecond?: number;
    videoDelayInMillisecond?: number;
    eventScheduleStartDelayInMillisecond?: number;
    eventDetailScheduleStartDelayInMillisecond?: number;
    eventDetailResultAvailableDelayInMillisecond?: number;
}

export interface DelayHandlingServiceContainer {
    oddFeedEventSource: OddFeedEventSource;
}

interface DelayOptions {
    oddFeedEventType?: OddFeedEventName;
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

    public getDelayedTime({ eventId, time }: { eventId: number, time: Date }, { oddFeedEventType }: DelayOptions = {}): Date {
        const config = this._delayConfigByEventId[eventId];
        if (!config) {
            return time;
        }
        const globalDelayInMillisecond = config.globalDelayInMillisecond ?? 0;
        const eventTypeDelayMiliseconds = this.getDelayConfigByEventType({ eventId }, { oddFeedEventType });
        return new Date(time.getTime() + globalDelayInMillisecond + eventTypeDelayMiliseconds);
    }

    public getDelayedTimeWithVideoDelay({ eventId, time }: { eventId: number, time: Date }, { oddFeedEventType }: DelayOptions = {}): Date {
        const config = this._delayConfigByEventId[eventId];
        if (!config) {
            return time;
        }
        const videoDelayInMillisecond = config.videoDelayInMillisecond ?? 0;
        return new Date(this.getDelayedTime({ eventId, time }, { oddFeedEventType }).getTime() + videoDelayInMillisecond);
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

    private getDelayConfigByEventType({ eventId }: { eventId: number }, { oddFeedEventType }: DelayOptions = {}): number {
        const config = this._delayConfigByEventId[eventId];
        if (!config) {
            return 0;
        }

        if (!oddFeedEventType) {
            return 0;
        }

        switch (oddFeedEventType) {
            case OddFeedEventName.EventStart:
                return config.eventScheduleStartDelayInMillisecond ?? 0;
            case OddFeedEventName.EventDetailStart:
                return config.eventDetailScheduleStartDelayInMillisecond ?? 0;
            case OddFeedEventName.EventDetailResultsAvailable:
                return config.eventDetailResultAvailableDelayInMillisecond ?? 0;
            default:
                return 0;
        }
    }
}