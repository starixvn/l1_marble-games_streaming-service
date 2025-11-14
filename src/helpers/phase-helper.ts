import { EventDetailNotification } from "odds-feed-client";

export function isPhaseSwitching({ event, index }: EventDetailNotification) {
  return (
    index !== event.eventDetails.length - 1 && event.eventDetails[index].phase !== event.eventDetails[index + 1].phase
  );
}

export function isLastEventDetail({ event, index }: EventDetailNotification) {
  return index === event.eventDetails.length - 1;
}

export function isLastEventDetailOfPhase({ event, index }: EventDetailNotification) {
  const phase = event.eventDetails[index].phase;
  const eventDetailsOfPhase = event.eventDetails.filter((detail) => detail.phase === phase);
  return index === eventDetailsOfPhase.length - 1;
}
