import { AppContainer, JobName, StreamingClient, EventStreamPayload, EventDetailStreamPayload } from "../types";
import { EventStore } from "../stores/event-store";
import { Response } from "express";
import { appSettings } from "../app-settings";
import { logger } from "sc-common";

export class EventStreamService {
  private clients: Record<string, StreamingClient[]> = {};
  private readonly eventStore: EventStore;
  private readonly logService: typeof logger;

  constructor(container: AppContainer) {
    this.eventStore = container.eventStore;
    this.logService = container.logService;

    appSettings.gameIds.forEach((gameId) => {
      this.clients[gameId] = [];
    });
  }

  buildCurrentEventDetailsPayload(gameId: string, updatedIndex: number = -1) {
    const currentEvent = this.eventStore.getCurrentEventForGame(gameId);
    if (!currentEvent) {
      this.logService.logError(`No current event for game ${gameId}`);
      return null;
    }

    const currentIndex = currentEvent.currentEventDetailIndex;
    const now = Date.now();

    const eventDetailsPayload: EventDetailStreamPayload[] = currentEvent.eventDetails.map((eventDetail) => ({
      playlist: eventDetail.playlist,
      videoLiveTimeMs: now - new Date(eventDetail.scheduleStartTs).getTime(),
      videoLength: appSettings.videoLength[gameId],
      result: eventDetail.result,
    }));

    const matchLiveTimeMs = eventDetailsPayload.reduce((acc, eventDetail) => {
      const videoLiveTimeMs = Math.max(0, eventDetail.videoLiveTimeMs);
      return acc + Math.min(videoLiveTimeMs, appSettings.videoLength[gameId] * 1000);
    }, 0);

    const payload: EventStreamPayload = {
      gameId: gameId,
      eventId: currentEvent.eventID,
      currentIndex: currentIndex,
      updatedIndex: updatedIndex === -1 ? currentIndex : updatedIndex,
      eventDetails: eventDetailsPayload,
      liveScores: currentEvent.liveScores,
      goalInfos: [],
      matchLiveTimeMs: matchLiveTimeMs,
      currentPhase: currentEvent.currentPhase,
      message: "",
    };

    return payload;
  }

  broadcastUpdateEventDataToClients(gameId: string, eventJobName: JobName, updatedIndex: number): void {
    const currentEvent = this.eventStore.getCurrentEventForGame(gameId);
    const clientsToBroadcast = this.clients[gameId];

    const payload = this.buildCurrentEventDetailsPayload(gameId, updatedIndex);

    if (!payload) {
      this.logService.logError(`No payload for game ${gameId} updatedIndex: ${updatedIndex}`);
      return;
    }

    payload.message = `Broadcasted ${eventJobName} on index: ${updatedIndex}`;

    clientsToBroadcast.forEach((client) => {
      client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
    });

    console.log(
      `Sent data to ${clientsToBroadcast.length} client(s) for game: ${gameId} with eventID: ${currentEvent.eventID} updatedIndex: ${updatedIndex} and phase: ${eventJobName} currentIndex: ${currentEvent.currentEventDetailIndex}`
    );

    if (eventJobName !== currentEvent.currentPhase && eventJobName !== JobName.UpdateGoalInfo) {
      this.logService.logError(
        `Event job name ${eventJobName} does not match current phase ${currentEvent.currentPhase}`
      );

      return;
    }
  }

  public async addClient(res: Response, gameId: string): Promise<void> {
    if (!appSettings.gameIds.includes(gameId)) {
      res.write(`data: ${JSON.stringify({ message: "Game not supported" })}\n\n`);
      res.end();
      return;
    }

    if (!this.clients[gameId]) {
      this.clients[gameId] = [];
    }

    this.clients[gameId].push({ res, gameId });

    const payload = this.buildCurrentEventDetailsPayload(gameId);

    if (!payload) {
      this.logService.logError(`No payload for game ${gameId}`);
      return;
    }

    payload.message = "First connection";

    res.write(`data: ${JSON.stringify(payload)}\n\n`);
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
