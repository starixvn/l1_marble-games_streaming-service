import dayjs from "dayjs";
import { AppContainer, Event, JobName, StreamingClient, EventStreamPayload } from "../types";
import { EventState } from "../stores/event-state";
import { Response } from "express";
import { appSettings } from "../app-settings";
import { logger } from "sc-common";

export class EventStreamService {
  private clients: Record<string, StreamingClient[]> = {};
  private readonly eventState: EventState;
  private readonly logService: typeof logger;

  constructor(container: AppContainer) {
    this.eventState = container.eventState;
    this.logService = container.logService;

    appSettings.gameIds.forEach((gameId) => {
      this.clients[gameId] = [];
    });
  }

  broadcastEventDataToClients(gameId: string, eventJobName: JobName, eventDetailIndex: number): void {
    const currentEvent = this.eventState.currentEvents[gameId].eventDetails[eventDetailIndex];
    const clientsToBroadcast = this.clients[gameId];

    clientsToBroadcast.forEach((client) => {
      const payload: EventStreamPayload = {
        gameId: gameId,
        eventId: currentEvent.eventID,
        eventDetailIndex: eventDetailIndex,
        playlist: currentEvent.playlist,
        liveTimeMs: 0,
        liveScore: "",
        videoLength: 0,
        currentPhase: eventJobName,
        message: "Broadcasted updated data",
        result: currentEvent.result,
      };

      client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
    });

    console.log(
      `Sent data to ${clientsToBroadcast.length} client(s) for game: ${gameId} with eventID: ${currentEvent.eventID} index: ${eventDetailIndex} and phase: ${eventJobName}`
    );
  }

  public async addClient(res: Response, gameId: string): Promise<void> {
    if (!appSettings.gameIds.includes(gameId)) {
      console.error(`Game ${gameId} not supported`);
      res.write(`data: ${JSON.stringify({ message: "Game not supported" })}\n\n`);
      res.end();
      return;
    }

    if (!this.clients[gameId]) {
      this.clients[gameId] = [];
    }

    this.clients[gameId].push({ res, gameId });

    const currentEvent = this.eventState.currentEvents[gameId];
    const currentEventDetail = currentEvent?.eventDetails[currentEvent?.currentEventDetailIndex];

    if (currentEventDetail) {
      const liveTimeMs = new Date().getTime() - new Date(currentEventDetail.scheduleStartTs).getTime();

      const payload: EventStreamPayload = {
        gameId: gameId,
        eventId: currentEventDetail.eventID,
        eventDetailIndex: currentEvent.currentEventDetailIndex,
        playlist: currentEventDetail.playlist,
        liveTimeMs: liveTimeMs,
        liveScore: "",
        videoLength: 0,
        currentPhase: JobName.ScheduleEvent,
        result: currentEventDetail.result,
        message: "First connection",
      };

      console.log(`First connection for game ${gameId}`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  }

  public removeClient(res: Response, gameId: string): void {
    if (!this.clients[gameId]) {
      return;
    }

    this.clients[gameId] = this.clients[gameId].filter((client) => client.res !== res);
  }

  public getClientCount(): number {
    return Object.values(this.clients).reduce((acc, clients) => acc + clients.length, 0);
  }

  public getClientCountForGame(gameId: string): number {
    return this.clients[gameId]?.length || 0;
  }
}
