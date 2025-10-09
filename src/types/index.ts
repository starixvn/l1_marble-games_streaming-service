import { AuthController } from "../controllers/auth-controller";
import { HealthController } from "../controllers/health-controller";
import { EventStreamController } from "../controllers/event-stream-controller";
import { AuthenticateService } from "../services/authenticate-service";
import { OddsFeedService } from "odds-feed-client";
import { EventStreamService } from "../services/event-stream-service";
import { logger } from "sc-common";
import { Response } from "express";
import { ClientManager } from "../managers/client-manager";
import { DebugController } from "../controllers/debug-controller";

export interface AppContainer {
  eventStreamService: EventStreamService;
  authenticateService: AuthenticateService;
  oddsFeedService: OddsFeedService;
  logService: typeof logger;
  authController: AuthController;
  eventStreamController: EventStreamController;
  healthController: HealthController;
  clientManager: ClientManager;
  debugController: DebugController;
}

export type Event = {
  eventID: number;
  eventNameAKey: string;
  eventNameBKey: string;
  theme?: string;
  scheduleStartTs: string;
  productCode: string;
  productTypeKey: string;
  eventDetails: EventDetail[];
  voiceConfig?: string;
};

export type EventDetail = {
  eventID: number;
  oddsAvailableTs: string;
  scheduleStartTs: string;
  resultsAvailableTs: string;
  hasResults: boolean;
  goalInfo: string;
  playlist: string;
  result: string;
  markets: any;
  inGameEventInfo: string;
  phase: number;
};

export type GoalInfoData = {
  frame: number[];
  timeLine: number[];
  result: string[];
  length?: number;
};

export type InGameEvent = {
  timeLine: number[];
  frame: number[];
  eventName: string[];
};

export type EventStreamState = Event & {
  currentEventDetailIndex: number;
  liveScores: string[];
  goalInfos: (GoalInfoData | null)[];
  currentPhase: JobName;
  inGameEvents?: (InGameEvent | null)[];
  voices?: VoiceEvent;
  liveVoices: string[];
  voiceConfigDetail?: VoiceConfig;
  introTime?: Date;
};

export type VoiceEvent = {
  timeline: number[];
  voice: string[];
};

export type VoiceConfig = {
  [event: string]: {
    [duration: number]: number;
  };
};

export interface Video {
  url: string;
  length: number;
  startTime: Date;
  gameId: string;
}

export type EventDetailStreamPayload = {
  playlist: string;
  videoLiveTimeMs: number;
  videoLength: number;
  result: string;
};

export interface EventStreamPayload {
  gameId: string;
  eventId: number;
  homeTeam: string;
  awayTeam: string;
  currentIndex: number;
  updatedIndex: number;
  eventDetails: EventDetailStreamPayload[];
  liveScores: string[];
  voice?: string;
  goalInfos: (GoalInfoData | null)[];
  voiceConfigDetail?: VoiceConfig;
  matchLiveTimeMs: number;
  currentPhase: JobName;
  message: string;
  introTime?: number;
}

export enum JobName {
  ScheduleEvent = "ScheduleEvent",
  UpdateOdds = "UpdateOdds",
  UpdatePreloadVideoInfo = "UpdatePreloadVideoInfo",
  UpdateVideoInfo = "UpdateVideoInfo",
  UpdateGoalInfo = "UpdateGoalInfo",
  UpdateResult = "UpdateResult",
  UpdateVoice = "UpdateVoice",
  PlayIntro = "PlayIntro",
}

export type StreamingClient = { res: Response; gameId: string };

export type EventValidator = (data: Event) => boolean;
