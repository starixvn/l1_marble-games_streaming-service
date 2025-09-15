import EventEmitter from "node:events";
import { Event } from "../../types";

export enum OddFeedEventName {
    Wildcard = "*",
    EventStart = "event.ScheduleStart",
    EventDetailStart = "eventDetail.ScheduleStart",
    EventDetailOddsAvailable = "eventDetail.OddsAvailable",
    EventDetailResultsAvailable = "eventDetail.ResultsAvailable",
}

export interface EventDetailNotification {
    event: Event;
    index: number;
}

export interface EventNotification {
    event: Event
}

export type CatchAllEventListener = (eventName: OddFeedEventName, notification: EventNotification | EventDetailNotification) => void;

export type EventListener = (eventName: OddFeedEventName, notification: EventNotification | EventDetailNotification) => void;

export class OddFeedEventSource {

    public OddFeedEventSource: EventEmitter;

    constructor() {
        this.OddFeedEventSource = new EventEmitter();
    }
    public registerWildcardEventListener(listener: CatchAllEventListener) {
        this.OddFeedEventSource.on(OddFeedEventName.Wildcard, listener);
    }
    public unregisterWildcardEventListener(listener: CatchAllEventListener) {
        this.OddFeedEventSource.off(OddFeedEventName.Wildcard, listener);
    }

    public registerEventListener(eventName: OddFeedEventName, listener: EventListener) {
        this.OddFeedEventSource.on(eventName, listener);
    }

    public unregisterEventListener(eventName: OddFeedEventName, listener: EventListener) {
        this.OddFeedEventSource.off(eventName, listener);
    }

    public registerEventDetailEventListener(eventName: OddFeedEventName, listener: EventListener) {
        this.OddFeedEventSource.on(eventName, listener);
    }
    
    public unregisterEventDetailEventListener(eventName: OddFeedEventName, listener: EventListener) {
        this.OddFeedEventSource.off(eventName, listener);
    }

    public onEventStart(event: Event) {
        const key = OddFeedEventName.EventStart;
        this.emit(key, { event });
    }

    public onEventDetailStart(event: Event, index: number) {
        const key = OddFeedEventName.EventDetailStart;
        this.emit(key, { event, index });
    }

    public onEventDetailOddsAvailable(event: Event, index: number) {
        const key = OddFeedEventName.EventDetailOddsAvailable;
        this.emit(key, { event, index });
    }

    public onEventDetailResultsAvailable(event: Event, index: number) {
        const key = OddFeedEventName.EventDetailResultsAvailable;
        this.emit(key, { event, index });
    }

    private emit(eventName: OddFeedEventName, notification: EventNotification | EventDetailNotification) {
        this.OddFeedEventSource.emit(OddFeedEventName.Wildcard, eventName, notification);
        this.OddFeedEventSource.emit(eventName, notification);
    }
}