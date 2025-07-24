import { EventStreamState } from "../types";

export class EventState {
  currentEvents: Record<string, EventStreamState> = {};
}
