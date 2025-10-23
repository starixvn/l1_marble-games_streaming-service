import { Event, EventDetailNotification, EventNotification } from "odds-feed-client";
import { Schedule } from "../dto/schedule";
;

export interface EventStartHandler<TEvent extends Event = Event> {
    handleEventStart({ event }: EventNotification<TEvent>): Schedule[];
}

export interface EventDetailStartHandler<TEvent extends Event = Event> {
    handleEventDetailScheduleStart({ event, index }: EventDetailNotification<TEvent>): Schedule[];
}

export interface EventDetailResultsAvailableHandler<TEvent extends Event = Event> {
    handleEventDetailResultsAvailable({ event, index }: EventDetailNotification<TEvent>): Schedule[];
}