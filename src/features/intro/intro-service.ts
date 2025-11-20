import { EventNotification, OddsFeedEventName, OddsFeedEventSource } from "odds-feed-client";

import { idHelper } from "../../helpers";

interface IntroServiceContainer {
  oddsFeedEventSource: OddsFeedEventSource;
}

interface IntroState {
  prebet: string;
  halftime: string;
}

export class IntroService {
  private readonly oddsFeedEventSource: OddsFeedEventSource;

  private readonly _introByGameId: Record<string, IntroState> = {};

  private readonly boundHandleEventStart: (notification: EventNotification) => void;

  constructor(container: IntroServiceContainer) {
    this.oddsFeedEventSource = container.oddsFeedEventSource;

    this.boundHandleEventStart = this.handleEventStart.bind(this);
  }

  public eventName = "intro";

  initEvent() {
    this.oddsFeedEventSource.eventOn(OddsFeedEventName.EventStart, this.boundHandleEventStart);
  }

  dispose() {
    this.oddsFeedEventSource.eventOff(OddsFeedEventName.EventStart, this.boundHandleEventStart);
  }

  handleEventStart({ event }: EventNotification) {
    if (!(event as any).config?.intro) {
      return;
    }

    const prebet = (event as any).config?.intro?.prebet;
    const halftime = (event as any).config?.intro?.halftime;

    const gameId = idHelper.extractGameId(event.eventID);
    this._introByGameId[gameId] = {
      prebet,
      halftime,
    };
  }

  getCurrentByGameId(gameId: string) {
    return this._introByGameId[gameId];
  }
}
