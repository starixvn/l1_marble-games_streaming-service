import { AppContainer, JobName, EventStreamPayload, EventDetailStreamPayload } from "../types";
import { EventStore } from "../stores/event-store";
import { Response } from "express";
import { appSettings } from "../app-settings";
import { logger } from "sc-common";
import { ClientManager } from "../managers/client-manager";
import { InGameConsumer } from "../features/in-game-consumer/in-game-consumer";

interface AdditionalPayload {
  voice?: string;
  [key: string]: any;
}

export class EventStreamService {
  private readonly clientManager: ClientManager;
  private readonly eventStore: EventStore;
  private readonly logService: typeof logger;
  private readonly inGameConsumer: InGameConsumer;

  constructor(container: AppContainer & { inGameConsumer: InGameConsumer }) {
    this.eventStore = container.eventStore;
    this.logService = container.logService;
    this.clientManager = container.clientManager;
    this.inGameConsumer = container.inGameConsumer;
  }

  buildCurrentEventDetailsPayload(gameId: string, updatedIndex = -1, additionalPayload: AdditionalPayload = {}) {
    const currentEvent = this.eventStore.getCurrentEventForGame(gameId);
    if (!currentEvent) {
      this.logService.logError(`No current event for game ${gameId}`);
      return null;
    }

    const currentIndex = currentEvent.currentEventDetailIndex;
    const now = Date.now();

    const eventDetailsPayload: EventDetailStreamPayload[] = currentEvent.eventDetails.map((eventDetail) => ({
      playlist: eventDetail.playlist,
      videoLiveTimeMs: now - new Date(eventDetail.scheduleStartTs).getTime() - (appSettings.videoDelay[gameId] || 0),
      videoLength: appSettings.videoLength[gameId],
      result: eventDetail.result,
    }));

    const matchLiveTimeMs = eventDetailsPayload.reduce((acc, eventDetail) => {
      const videoLiveTimeMs = Math.max(0, eventDetail.videoLiveTimeMs);
      return acc + Math.min(videoLiveTimeMs, appSettings.videoLength[gameId] * 1000);
    }, 0);

    const introTime = currentEvent.introTime 
    ? now - currentEvent.introTime.getTime() 
    : -1;

    const payload: EventStreamPayload = {
      gameId: gameId,
      voiceConfigDetail: currentEvent.voiceConfigDetail,
      eventId: currentEvent.eventID,
      homeTeam: currentEvent.eventNameAKey,
      awayTeam: currentEvent.eventNameBKey,
      currentIndex: currentIndex,
      updatedIndex: updatedIndex === -1 ? currentIndex : updatedIndex,
      eventDetails: eventDetailsPayload,
      liveScores: currentEvent.liveScores,
      goalInfos: [],
      matchLiveTimeMs: matchLiveTimeMs,
      currentPhase: currentEvent.currentPhase,
      message: "",
      introTime,
      ...additionalPayload,
    };

    return payload;
  }

  broadcastUpdateEventDataToClients(gameId: string, eventJobName: JobName, updatedIndex: number, additionalPayload: AdditionalPayload = {}): void {
    const clientsToBroadcast = this.clientManager.getClientSetForGame(gameId);
    const payload = this.buildCurrentEventDetailsPayload(gameId, updatedIndex, additionalPayload);

    if (!payload) {
      this.logService.logError(`No payload for game ${gameId} updatedIndex: ${updatedIndex}`);
      return;
    }

    payload.message = `Broadcasted ${eventJobName} on index: ${updatedIndex}`;

    for (const client of clientsToBroadcast) {
      client.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  }

  public async addClient(res: Response, gameId: string): Promise<void> {
    if (!appSettings.gameIds.includes(gameId)) {
      res.write(`data: ${JSON.stringify({ message: "Game not supported" })}\n\n`);
      res.end();
      return;
    }

    this.clientManager.addClient(res, gameId);

    const currentFeaturePayload = this.inGameConsumer.getCurrentByGameId(gameId);
    const payload = this.buildCurrentEventDetailsPayload(gameId, -1, currentFeaturePayload);


    if (!payload) {
      this.logService.logError(`No payload for game ${gameId}`);
      return;
    }

    payload.message = "First connection";

    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
}
