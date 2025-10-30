import EventEmitter from "node:events";
import { log } from "../../helpers/log";
import { GameFlowTimeTrackingService } from "../game-flow-time-tracking-service/game-flow-time-tracking-service";

export enum ANSIColor {
  Black = "\x1b[30m",
  Red = "\x1b[31m",
  Green = "\x1b[32m",
  Yellow = "\x1b[33m",
  Blue = "\x1b[34m",
  Magenta = "\x1b[35m",
  Cyan = "\x1b[36m",
  White = "\x1b[37m",
  Default = "\x1b[37m",
  BackgroundBlack = "\x1b[40m",
  BackgroundRed = "\x1b[41m",
  BackgroundGreen = "\x1b[42m",
  BackgroundYellow = "\x1b[43m",
  BackgroundBlue = "\x1b[44m",
  BackgroundMagenta = "\x1b[45m",
  BackgroundCyan = "\x1b[46m",
  BackgroundWhite = "\x1b[47m",
  BackgroundDefault = "\x1b[47m",
  Reset = "\x1b[0m",
}

enum ServiceWithDebug {
  GameFlowService = "GameFlowService",
  CurrentEventService = "CurrentEventService",
  LiveScoreService = "LiveScoreService",
  ResultService = "ResultService",
  VideoStreamingService = "VideoStreamingService",
  CommentatorVoiceService = "CommentatorVoiceService",
  IntroService = "IntroService",
  TeamNameService = "TeamNameService",
  Default = "Default",
}

const colorMap = {
  [ServiceWithDebug.GameFlowService]: ANSIColor.Yellow,
  [ServiceWithDebug.CurrentEventService]: ANSIColor.Blue,
  [ServiceWithDebug.LiveScoreService]: ANSIColor.Green,
  [ServiceWithDebug.ResultService]: ANSIColor.Magenta,
  [ServiceWithDebug.VideoStreamingService]: ANSIColor.Cyan,
  [ServiceWithDebug.CommentatorVoiceService]: ANSIColor.BackgroundRed,
  [ServiceWithDebug.IntroService]: ANSIColor.BackgroundGreen,
  [ServiceWithDebug.TeamNameService]: ANSIColor.BackgroundBlue,
  [ServiceWithDebug.Default]: ANSIColor.White,
};

const debugEnabledServices = new Set<string>([ServiceWithDebug.GameFlowService, ServiceWithDebug.CurrentEventService]);

export interface DebugServiceContainer {
  gameFlowTimeTrackingService: GameFlowTimeTrackingService;
}

function debugLog(
  service: object,
  message: string,
  gameId: string,
  gameFlowTimeTrackingService: GameFlowTimeTrackingService
) {
  const serviceName = Object.getPrototypeOf(service)?.constructor?.name ?? "UnknownService";

  if (!debugEnabledServices.has(serviceName)) {
    return;
  }

  const title = `${colorMap[serviceName as keyof typeof colorMap] ?? colorMap[ServiceWithDebug.Default]}[${serviceName}]${ANSIColor.Reset}:`;
  const diffInSecond = gameFlowTimeTrackingService.getRelativeTime(gameId);
  const gameIdMessage = `${ANSIColor.Blue}[GameId: ${gameId}]${ANSIColor.Reset}`;
  const relativeTimeMessage = `${ANSIColor.Green}[RelativeTime: ${diffInSecond}s]${ANSIColor.Reset}`;
  log(`${title}${gameIdMessage}${relativeTimeMessage}${message}`);
}

export interface LogMessage {
  serviceColor: ANSIColor;
  message: string;
  serviceName: string;
  absoluteTime: number;
  relativeTime: number;
}

const MAX_LOG_LENGTH = 1000;

export class FeatureDebugService {
  private readonly gameFlowTimeTrackingService: GameFlowTimeTrackingService;
  constructor(container: DebugServiceContainer) {
    this.gameFlowTimeTrackingService = container.gameFlowTimeTrackingService;
  }

  public logEventSourceByGameId: Record<string, EventEmitter> = {};
  public logByGameId: Record<string, LogMessage[]> = {};

  public log(service: object, message: string, gameId: string) {
    debugLog(service, message, gameId, this.gameFlowTimeTrackingService);

    if (!this.logByGameId[gameId]) {
      this.logByGameId[gameId] = [];
    }

    const serviceName = Object.getPrototypeOf(service)?.constructor?.name ?? "UnknownService";

    if (!this.logEventSourceByGameId[gameId]) {
      this.logEventSourceByGameId[gameId] = new EventEmitter();
    }

    this.logByGameId[gameId].push({
      serviceColor: colorMap[serviceName as keyof typeof colorMap] ?? colorMap[ServiceWithDebug.Default],
      message,
      serviceName: serviceName,
      absoluteTime: Date.now(),
      relativeTime: this.gameFlowTimeTrackingService.getRelativeTime(gameId),
    });

    if (this.logByGameId[gameId].length > MAX_LOG_LENGTH) {
      this.logByGameId[gameId].shift();
    }

    this.logEventSourceByGameId[gameId].emit("log", {
      serviceColor: colorMap[serviceName as keyof typeof colorMap] ?? colorMap[ServiceWithDebug.Default],
      message,
      serviceName: serviceName,
      absoluteTime: Date.now(),
      relativeTime: this.gameFlowTimeTrackingService.getRelativeTime(gameId),
    });
  }

  public dispose() {
    Object.values(this.logEventSourceByGameId).forEach((emitter: EventEmitter) => {
      emitter.removeAllListeners();
    });
    this.logByGameId = {};
    this.logEventSourceByGameId = {};
  }
}
