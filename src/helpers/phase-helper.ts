import { EventDetailNotification } from "odds-feed-client";

export function isPhaseSwitching({ event, index }: EventDetailNotification) {
  return (
    index !== event.eventDetails.length - 1 && event.eventDetails[index].phase !== event.eventDetails[index + 1].phase
  );
}

export function isLastEventDetail({ event, index }: EventDetailNotification) {
  return index === event.eventDetails.length - 1;
}
