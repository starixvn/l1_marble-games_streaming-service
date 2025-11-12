import { idHelper } from "../../helpers";
import { DelayHandlingService } from "../delay/delay-handling-service";
import {
  Event,
  EventDetailNotification,
  EventNotification,
  OddsFeedEventName,
  OddsFeedEventSource,
  OddsFeedService,
  Scheduler,
} from "odds-feed-client";
import { GameBroadcastService } from "../../services/game-broadcast.service";
import { FeatureDebugService } from "../feature-debug/feature-debug-service";
import { Replay, ReplayService } from "../event-replay/event-replay-service";

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
  videoLengthMs: number;
  preloadDurationMs: number;
  streamingPhaseTime: number;
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

  private readonly _currentVideoStateByGameId: Record<string, VideoState> = {};
  private readonly _preloadVideoStateByGameId: Record<string, PreloadVideoState> = {};
  private readonly _currentEventByGameId: Record<string, Event> = {};

  private readonly boundHandleEventDetailScheduleStart: (notification: EventDetailNotification) => void;
  private readonly boundHandleEventStart: (notification: EventNotification) => void;

  constructor(container: VideoStreamingServiceContainer) {
    this.oddsFeedEventSource = container.oddsFeedEventSource;
    this.delayHandlingService = container.delayHandlingService;
    this.scheduler = container.scheduler;
    this.gameBroadcastService = container.gameBroadcastService;
    this.featureDebugService = container.featureDebugService;

    this.boundHandleEventDetailScheduleStart = this.handleEventDetailScheduleStart.bind(this);
    this.boundHandleEventStart = this.handleEventStart.bind(this);
  }

  async getReplayByEvent(event: Event): Promise<Replay<VideoState | PreloadVideoState>[]> {
    const replays: Replay<VideoState | PreloadVideoState>[] = [];

    for (let index = 0; index < event.eventDetails.length; index++) {
      const timeToPreload = this.getTimeToPreload(event, index);
      const timeToStream = this.delayHandlingService.getTimeToStream(event, index);
      const timeFromPhaseStart = this.getTimeFromPhaseStart(event, index);
      const timeFromPhaseEnd = this.getTimeFromPhaseEnd(event, index);
      const videoLengthMs = this.getVideoLength({ event, index });

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
            videoLengthMs,
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
    this.oddsFeedEventSource.eventOn(OddsFeedEventName.EventStart, this.boundHandleEventStart);

    this.oddsFeedEventSource.eventDetailOn(
      OddsFeedEventName.EventDetailStart,
      this.boundHandleEventDetailScheduleStart
    );
  }

  public dispose() {
    this.oddsFeedEventSource.eventOff(OddsFeedEventName.EventStart, this.boundHandleEventStart);

    this.oddsFeedEventSource.eventDetailOff(
      OddsFeedEventName.EventDetailStart,
      this.boundHandleEventDetailScheduleStart
    );
  }

  public handleEventStart({ event }: EventNotification) {
    const whenToSwitchToPrebet = this.delayHandlingService.getTimeToStartEvent(event);
    this.scheduler.schedule(whenToSwitchToPrebet, this.onEventStart.bind(this, { event }), {
      overrideNow: event.now
    });
  }

  public async handleEventDetailScheduleStart({ event, index }: EventDetailNotification) {
    const timeToStream = this.delayHandlingService.getTimeToStream(event, index);
    const timeToPreload = this.getTimeToPreload(event, index);
    this.scheduler.schedule(timeToStream, this.onLiveStreamStart.bind(this, { event, index }), {
      overrideNow: event.now
    });
    this.scheduler.schedule(timeToPreload, this.onLiveStreamPreload.bind(this, { event, index }), {
      overrideNow: event.now
    });
  }

  async onLiveStreamStart({ event, index }: { event: Event; index: number }) {
    const gameId = idHelper.extractGameId(event.eventID);
    const timeToStream = this.delayHandlingService.getTimeToStream(event, index);
    const timeFromPhaseStart = this.getTimeFromPhaseStart(event, index);
    const timeFromPhaseEnd = this.getTimeFromPhaseEnd(event, index);
    const videoLengthMs = this.getVideoLength({ event, index });
    this._currentEventByGameId[gameId] = event;
    this._currentVideoStateByGameId[gameId] = {
      videoLink: event.eventDetails[index].playlist,
      timeToStream: timeToStream.getTime(),
      currentTime: 0,
      streamingPhaseTime: this.calculateCurrentStreamingPhaseTime(gameId, index),
      phaseIndex: event.eventDetails[index].phase,
      timeFromPhaseStart: timeFromPhaseStart.getTime(),
      timeFromPhaseEnd: timeFromPhaseEnd.getTime(),
      videoLengthMs,
      preloadDurationMs: event.eventConfig?.preloadDurationMs ?? 0,
    };
    const currentVideoState = this.getCurrentVideoStateByGameId(gameId, index);
    this.log(
      `video streaming started with event ${event.eventID} and index ${index}
            ${JSON.stringify(currentVideoState, null, 2)}
            `,
      gameId
    );
    const payload = currentVideoState ?? {};
    this.gameBroadcastService.broadcastToAllClientByGameId(gameId, payload, this.streamingEventName);
  }

  onEventStart({ event }: EventNotification) {
    const gameId = idHelper.extractGameId(event.eventID);
    this._preloadVideoStateByGameId[gameId] = {
      videoLink: "",
    };

    const timeToStream = this.delayHandlingService.getTimeToStream(event, 0);

    this._currentVideoStateByGameId[gameId] = {
      videoLink: "",
      timeToStream: timeToStream.getTime(),
      currentTime: 0,
      streamingPhaseTime: 0,
      phaseIndex: 0,
      timeFromPhaseStart: 0,
      timeFromPhaseEnd: 0,
      videoLengthMs: this.getVideoLength({ event, index: 0 }),
      preloadDurationMs: event.eventConfig?.preloadDurationMs ?? 0,
    };

    this._currentEventByGameId[gameId] = event;
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

  getCurrentVideoStateByGameId(gameId: string, index: number) {
    if (!this._currentVideoStateByGameId[gameId]) {
      return null;
    }

    return {
      ...this._currentVideoStateByGameId[gameId],
      currentTime: Date.now() - this._currentVideoStateByGameId[gameId].timeToStream,
      streamingPhaseTime: this.calculateCurrentStreamingPhaseTime(gameId, index),
    };
  }

  getCurrentPreloadVideoStateByGameId(gameId: string) {
    return this._preloadVideoStateByGameId[gameId];
  }

  private log(message: string, gameId: string) {
    this.featureDebugService.log(this, message, gameId);
  }

  private getVideoLength({ event, index }: EventDetailNotification) {
    const preloadDuration = event.eventConfig?.preloadDurationMs ?? 0;
    const detail = event.eventDetails[index];
    return new Date(detail.resultsAvailableTs).getTime() - new Date(detail.scheduleStartTs).getTime() - preloadDuration;
  }

  private getTimeToPreload(event: Event, index: number) {
    return this.delayHandlingService.getDelayedTime(
      { event, time: new Date(event.eventDetails[index].scheduleStartTs) },
      {
        oddsFeedEventType: OddsFeedEventName.EventDetailStart,
      }
    );
  }

  private calculateCurrentStreamingPhaseTime(gameId: string, index: number) {
    const event = this._currentEventByGameId[gameId];

    const preloadDuration = event.eventConfig?.preloadDurationMs ?? 0;

    const currentPhase = event.eventDetails[index].phase;

    const preEventDetailsOfPhase = event.eventDetails.filter(
      (detail, detailIndex) => detail.phase === currentPhase && detailIndex < index
    );

    const totalTimeOfPreEventDetailsOfPhase = preEventDetailsOfPhase.reduce((acc, detail) => {
      return (
        acc +
        (new Date(detail.resultsAvailableTs).getTime() - new Date(detail.scheduleStartTs).getTime() - preloadDuration)
      );
    }, 0);

    const currentEventDetailStreamingTime = Math.max(
      0,
      Date.now() - this.delayHandlingService.getTimeToStream(event, index).getTime()
    );

    return totalTimeOfPreEventDetailsOfPhase + currentEventDetailStreamingTime;
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
