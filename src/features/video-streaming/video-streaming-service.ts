import { idHelper } from "../../helpers";
import { DelayHandlingService } from "../delay/delay-handling-service";
import {
  Event,
  EventDetailNotification,
  OddsFeedEventName,
  OddsFeedEventSource,
  OddsFeedService,
  Scheduler,
} from "odds-feed-client";
import { GameBroadcastService } from "../../services/game-broadcast.service";
import { FeatureDebugService } from "../feature-debug/feature-debug-service";
import { Replay, ReplayService } from "../event-replay/event-replay-service";
import { GoalInfoData } from "../../types";
import { GLOBAL_DEFAULT_VIDEO_LENGTH } from "../../misc/constants";

interface VideoStreamingServiceContainer {
  oddsFeedEventSource: OddsFeedEventSource;
  delayHandlingService: DelayHandlingService;
  scheduler: Scheduler;
  gameBroadcastService: GameBroadcastService;
  featureDebugService: FeatureDebugService;
  oddsFeedService: OddsFeedService;
}

export interface VideoState {
  videoLink: string;
  timeToStream: number;
  currentTime: number;
  phaseIndex: number;
  timeFromPhaseStart: number;
  timeFromPhaseEnd: number;
  durationInSeconds: number;
}

export interface PreloadVideoState {
  videoLink: string;
}

export class VideoStreamingService implements ReplayService<VideoState | PreloadVideoState> {
  private readonly oddsFeedEventSource: OddsFeedEventSource;
  private readonly delayHandlingService: DelayHandlingService;
  private readonly scheduler: Scheduler;
  private readonly gameBroadcastService: GameBroadcastService;
  private readonly featureDebugService: FeatureDebugService;
  private readonly oddsFeedService: OddsFeedService;

  private readonly _currentVideoStateByGameId: Record<string, VideoState> = {};
  private readonly _preloadVideoStateByGameId: Record<string, PreloadVideoState> = {};

  private readonly boundHandleEventDetailScheduleStart: (notification: EventDetailNotification) => void;

  constructor(container: VideoStreamingServiceContainer) {
    this.oddsFeedEventSource = container.oddsFeedEventSource;
    this.delayHandlingService = container.delayHandlingService;
    this.scheduler = container.scheduler;
    this.gameBroadcastService = container.gameBroadcastService;
    this.featureDebugService = container.featureDebugService;
    this.oddsFeedService = container.oddsFeedService;

    this.boundHandleEventDetailScheduleStart = this.handleEventDetailScheduleStart.bind(this);
  }

  async getReplayByEvent(event: Event): Promise<Replay<VideoState | PreloadVideoState>[]> {
    const replays: Replay<VideoState | PreloadVideoState>[] = [];

    for (let index = 0; index < event.eventDetails.length; index++) {
      const timeToPreload = this.getTimeToPreload(event, index);
      const timeToStream = this.getTimeToStream(event, index);
      const timeFromPhaseStart = this.getTimeFromPhaseStart(event, index);
      const timeFromPhaseEnd = this.getTimeFromPhaseEnd(event, index);
      const durationInSeconds = await this.getVideoLength({ event, index });

      replays.push(
        {
          time: timeToPreload,
          payload: {
            videoLink: event.eventDetails[index].playlist,
          },
          eventName: this.preloadEventName,
        },
        {
          time: timeToStream,
          payload: {
            videoLink: event.eventDetails[index].playlist,
            timeToStream: timeToStream.getTime(),
            currentTime: 0,
            phaseIndex: event.eventDetails[index].phase,
            timeFromPhaseStart: timeFromPhaseStart.getTime(),
            timeFromPhaseEnd: timeFromPhaseEnd.getTime(),
            durationInSeconds,
          },
          eventName: this.streamingEventName,
        }
      );
    }

    return replays;
  }

  public readonly streamingEventName = "videoStreaming";
  public readonly preloadEventName = "preloadVideo";

  public initEvent() {
    this.oddsFeedEventSource.eventDetailOn(
      OddsFeedEventName.EventDetailStart,
      this.boundHandleEventDetailScheduleStart
    );
  }

  public dispose() {
    this.oddsFeedEventSource.eventDetailOff(
      OddsFeedEventName.EventDetailStart,
      this.boundHandleEventDetailScheduleStart
    );
  }

  public async handleEventDetailScheduleStart({ event, index }: EventDetailNotification) {
    const timeToStream = this.getTimeToStream(event, index);
    const timeToPreload = this.getTimeToPreload(event, index);
    const durationInSeconds = await this.getVideoLength({ event, index });
    this.scheduler.schedule(timeToStream, this.onLiveStreamStart.bind(this, { event, index, durationInSeconds }));
    this.scheduler.schedule(timeToPreload, this.onLiveStreamPreload.bind(this, { event, index }));
  }

  async onLiveStreamStart({
    event,
    index,
    durationInSeconds,
  }: {
    event: Event;
    index: number;
    durationInSeconds: number;
  }) {
    const gameId = idHelper.extractGameId(event.eventID);
    const timeToStream = this.getTimeToStream(event, index);
    const timeFromPhaseStart = this.getTimeFromPhaseStart(event, index);
    const timeFromPhaseEnd = this.getTimeFromPhaseEnd(event, index);
    this._currentVideoStateByGameId[gameId] = {
      videoLink: event.eventDetails[index].playlist,
      timeToStream: timeToStream.getTime(),
      currentTime: 0,
      phaseIndex: event.eventDetails[index].phase,
      timeFromPhaseStart: timeFromPhaseStart.getTime(),
      timeFromPhaseEnd: timeFromPhaseEnd.getTime(),
      durationInSeconds,
    };
    const currentVideoState = this.getCurrentVideoStateByGameId(gameId);
    this.log(
      `video streaming started with event ${event.eventID} and index ${index}
            ${JSON.stringify(currentVideoState, null, 2)}
            `,
      gameId
    );
    const payload = this.getCurrentVideoStateByGameId(gameId) ?? {};
    this.gameBroadcastService.broadcastToAllClientByGameId(gameId, payload, this.streamingEventName);
  }

  onLiveStreamPreload({ event, index }: EventDetailNotification) {
    const gameId = idHelper.extractGameId(event.eventID);
    this._preloadVideoStateByGameId[gameId] = {
      videoLink: event.eventDetails[index].playlist,
    };

    this.gameBroadcastService.broadcastToAllClientByGameId(
      gameId,
      this.getCurrentPreloadVideoStateByGameId(gameId),
      this.preloadEventName
    );
  }

  getCurrentVideoStateByGameId(gameId: string) {
    if (!this._currentVideoStateByGameId[gameId]) {
      return null;
    }

    return {
      ...this._currentVideoStateByGameId[gameId],
      currentTime: Date.now() - this._currentVideoStateByGameId[gameId].timeToStream,
    };
  }

  getCurrentPreloadVideoStateByGameId(gameId: string) {
    return this._preloadVideoStateByGameId[gameId];
  }

  private log(message: string, gameId: string) {
    this.featureDebugService.log(this, message, gameId);
  }

  private async getVideoLength({ event, index }: EventDetailNotification) {
    const configVideoLength = (event as any).config?.video?.defaultLength ?? GLOBAL_DEFAULT_VIDEO_LENGTH;
    const goalInfo = await this.oddsFeedService.getRemoteJson<GoalInfoData>(event.eventDetails[index].goalInfo, {
      eventId: event.eventID,
    });
    return goalInfo?.length ?? configVideoLength;
  }

  private getTimeToStream(event: Event, index: number) {
    return this.delayHandlingService.getDelayedTimeWithVideoDelay(
      { event, time: new Date(event.eventDetails[index].scheduleStartTs) },
      {
        oddsFeedEventType: OddsFeedEventName.EventDetailStart,
      }
    );
  }

  private getTimeToPreload(event: Event, index: number) {
    return this.delayHandlingService.getDelayedTime(
      { event, time: new Date(event.eventDetails[index].scheduleStartTs) },
      {
        oddsFeedEventType: OddsFeedEventName.EventDetailStart,
      }
    );
  }

  private getTimeFromPhaseStart(event: Event, index: number) {
    const currentPhase = event.eventDetails[index].phase;
    const firstEventDetailOfPhase =
      event.eventDetails.find((detail) => detail.phase === currentPhase) ?? event.eventDetails[index];
    return this.delayHandlingService.getDelayedTimeWithVideoDelay(
      { event, time: new Date(firstEventDetailOfPhase.scheduleStartTs) },
      {
        oddsFeedEventType: OddsFeedEventName.EventDetailStart,
      }
    );
  }

  private getTimeFromPhaseEnd(event: Event, index: number) {
    const currentPhase = event.eventDetails[index].phase;
    const lastEventDetailOfPhase =
      event.eventDetails.findLast((detail) => detail.phase === currentPhase) ?? event.eventDetails[index];
    return this.delayHandlingService.getDelayedTimeWithVideoDelay(
      { event, time: new Date(lastEventDetailOfPhase.resultsAvailableTs) },
      {
        oddsFeedEventType: OddsFeedEventName.EventDetailStart,
      }
    );
  }
}
