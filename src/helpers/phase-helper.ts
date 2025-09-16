import { EventDetailNotification } from "../features/odd-feed-data";

export function isPhaseSwitching({ event, index }: EventDetailNotification) {
    return index !== event.eventDetails.length - 1 
        && event.eventDetails[index].phase !== event.eventDetails[index + 1].phase;
}

export function isLastEventDetail({ event, index }: EventDetailNotification) {
    return index === event.eventDetails.length - 1;
}