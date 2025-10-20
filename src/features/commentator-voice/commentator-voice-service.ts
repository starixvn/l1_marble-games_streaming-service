import { GameBroadcastService } from "../../services/game-broadcast.service";
import { DelayHandlingService } from "../delay/delay-handling-service";
import { FeatureDebugService } from "../feature-debug/feature-debug-service";
import { OddsFeedService, Scheduler, OddsFeedEventName, OddsFeedEventSource, SystemNotification, EventDetailNotification, EventNotification } from "odds-feed-client";
import { idHelper } from "../../helpers";
import { generateVoiceWithEventTimeline, VoiceDurationConfig } from "../../helpers/voices";
import { GoalInfoData, InGameEvent } from "../../types";

const GLOBAL_DEFAULT_VIDEO_LENGTH = 30;

interface InternalVoiceEvent {
    eventName: string[];
    timeline: number[];
    voices: string[];
    voiceTimelines: number[];
    scoreSequence: string;
    videoLength: number;
}

const DEFAULT_VOICE_EVENT: InternalVoiceEvent = {
    eventName: [],
    timeline: [],
    voices: [],
    voiceTimelines: [],
    scoreSequence: "",
    videoLength: 0,
};

interface CommentatorVoiceConfig {
    configJson: string;
    configVoice: VoiceDurationConfig;
}


type InternalVoiceState = Map<number, InternalVoiceEvent>;

export interface VoiceState {
    fileName: string;
}

export interface CommentatorVoiceServiceContainer {
    oddsFeedEventSource: OddsFeedEventSource;
    scheduler: Scheduler;
    delayHandlingService: DelayHandlingService;
    gameBroadcastService: GameBroadcastService;
    featureDebugService: FeatureDebugService;
    oddsFeedService: OddsFeedService;
}

export class CommentatorVoiceService {

    private readonly oddsFeedEventSource: OddsFeedEventSource;
    private readonly scheduler: Scheduler;
    private readonly delayHandlingService: DelayHandlingService;
    private readonly gameBroadcastService: GameBroadcastService;
    private readonly featureDebugService: FeatureDebugService;
    private readonly oddsFeedService: OddsFeedService;

    private _voiceStateByGameId: Record<string, InternalVoiceState> = {};
    private _videoLengthByEventId: Record<number, number> = {};
    private _commentatorVoiceConfigByEventId: Record<number, CommentatorVoiceConfig> = {};

    private readonly boundHandleEventUpcoming: (notification: EventNotification) => void;
    private readonly boundHandleEventDetailScheduleStart: (notification: EventDetailNotification) => void;
    private readonly boundHandleEventCleanup: (notification: SystemNotification) => void;
    private readonly boundHandleEventStart: (notification: EventNotification) => void;

    constructor(container: CommentatorVoiceServiceContainer) {
        this.oddsFeedEventSource = container.oddsFeedEventSource;
        this.scheduler = container.scheduler;
        this.delayHandlingService = container.delayHandlingService;
        this.gameBroadcastService = container.gameBroadcastService;
        this.featureDebugService = container.featureDebugService;
        this.oddsFeedService = container.oddsFeedService;

        this.boundHandleEventDetailScheduleStart = this.handleEventDetailScheduleStart.bind(this);
        this.boundHandleEventUpcoming = this.handleEventUpcoming.bind(this);
        this.boundHandleEventCleanup = this.handleEventCleanup.bind(this);
        this.boundHandleEventStart = this.handleEventStart.bind(this);
    }

    public eventName = "commentatorVoice";

    public initEvent() {

        this.oddsFeedEventSource.eventOn(
            OddsFeedEventName.EventStart,
            this.boundHandleEventStart
        );
        this.oddsFeedEventSource.eventDetailOn(
            OddsFeedEventName.EventDetailStart,
            this.boundHandleEventDetailScheduleStart
        );
        this.oddsFeedEventSource.eventOn(
            OddsFeedEventName.EventUpcoming,
            this.boundHandleEventUpcoming
        );
        this.oddsFeedEventSource.cleanupOn(
            this.boundHandleEventCleanup
        );
    }

    public dispose() {
        this.oddsFeedEventSource.eventDetailOff(
            OddsFeedEventName.EventDetailStart,
            this.boundHandleEventDetailScheduleStart
        );
        this.oddsFeedEventSource.eventOff(
            OddsFeedEventName.EventUpcoming,
            this.boundHandleEventUpcoming,
        );
        this.oddsFeedEventSource.eventOff(
            OddsFeedEventName.EventStart,
            this.boundHandleEventStart
        );
        this.oddsFeedEventSource.cleanupOff(
            this.boundHandleEventCleanup
        );
    }

    async handleEventUpcoming({ event }: EventNotification) {
        const videoLength = 
            (event as any).config?.video?.videoLength 
            ?? GLOBAL_DEFAULT_VIDEO_LENGTH;
        this._videoLengthByEventId[event.eventID] = videoLength;

        const config = (event as any).config.voice as CommentatorVoiceConfig;
        
        if (!config) {
            return;
        }

        const configJson = config.configJson;
        const configVoice = await this.oddsFeedService.getRemoteJson<VoiceDurationConfig>(configJson, {
            eventId: event.eventID,
        });

        if (!configVoice) {
            return;
        }
        this._commentatorVoiceConfigByEventId[event.eventID] = {
            configJson,
            configVoice,
        };
    }

    handleEventCleanup({ eventID }: SystemNotification) {
        delete this._videoLengthByEventId[eventID];
        delete this._commentatorVoiceConfigByEventId[eventID];
    }
    
    handleEventStart({ event }: EventNotification) {
        const gameId = idHelper.extractGameId(event.eventID);
        this.resetVoiceState(gameId);
    }

    async handleEventDetailScheduleStart({ event, index}: EventDetailNotification) {

        const config = this._commentatorVoiceConfigByEventId[event.eventID];
        if (!config) {
            return;
        }

        const gameId = idHelper.extractGameId(event.eventID);
        // get in game event
        const inGameEvent = await this.oddsFeedService.getRemoteJson<InGameEvent>(event.eventDetails[index].inGameEventInfo, {
            eventId: event.eventID,
        });
        // get goal info for video length
        const goalInfo = await this.oddsFeedService.getRemoteJson<GoalInfoData>(event.eventDetails[index].goalInfo, {
            eventId: event.eventID,
        });
        const videoLength = goalInfo?.length ?? this._videoLengthByEventId[event.eventID];

        // get previous state
        const currentPhase = event.eventDetails[index].phase;
        const previousPhase = currentPhase - 1;

        const previousState = this._voiceStateByGameId[gameId]?.get(previousPhase) ?? DEFAULT_VOICE_EVENT;
        const currentState = this._voiceStateByGameId[gameId]?.get(currentPhase) ?? DEFAULT_VOICE_EVENT;

        const firstHalfVoices = previousState.voices;
        const firstHalfScoreSequence = previousState.scoreSequence;

        const thisScoreSequence = this.getOrDefault(goalInfo?.result.join(""), "");

        const previousVideoLength = currentState.videoLength;
        const previousVoices = currentState.voices;
        const previousTimelines = currentState.voiceTimelines;
        const previousEvents = currentState.eventName;
        const previousVoiceTimelines = currentState.voiceTimelines;
        const previousScoreSequence = currentState.scoreSequence;

        const thisTimeline = this.getAbsoluteTimeline(this.getOrDefault(inGameEvent?.timeLine, []), previousVideoLength);
        const thisInGameEvent = this.getOrDefault(inGameEvent?.eventName, []);
        
        // generate voice
        const voices = generateVoiceWithEventTimeline({
            timeline: thisTimeline,
            eventName: thisInGameEvent,
            previousVoices: previousVoices,
            previousTimelines: previousTimelines,
            previousEvents: previousEvents,
            previousVoiceTimelines: previousVoiceTimelines,
            firstHalfScore: firstHalfScoreSequence,
            firstHalfVoices: firstHalfVoices,
        }, config.configVoice);

        this.scheduler.schedule(
            this.delayHandlingService.getDelayedTimeWithVideoDelay({ eventId: event.eventID, time: new Date(event.eventDetails[index].scheduleStartTs) }, {
                oddsFeedEventType: OddsFeedEventName.EventDetailStart,
            }),
            this.debugVoice.bind(this, gameId, voices, {
                videoLength,
                previousVideoLength,
                eventName: thisInGameEvent,
                timeline: thisTimeline,
                firstHalfScore: firstHalfScoreSequence,
                firstHalfVoices,
                previousVoices,
                previousTimelines,
                previousEvents,
                previousVoiceTimelines,
            }, config.configVoice),
        );

        // absolute timeline is counted from the start time of the first event detail of the phase
        const updatedVideoLength = previousVideoLength + videoLength;
        const updatedScoreSequence = previousScoreSequence.concat(thisScoreSequence);
        const updatedVoiceTimelines = previousVoiceTimelines.concat(this.getAbsoluteTimeline(voices.timeline, updatedVideoLength));
        const updatedEventTimelines = previousTimelines.concat(this.getAbsoluteTimeline(thisTimeline, updatedVideoLength));
        const updatedEventNames = previousEvents.concat(thisInGameEvent);
        const updatedVoices = previousVoices.concat(voices.voice);

        if (!this._voiceStateByGameId[gameId]) {
            this._voiceStateByGameId[gameId] = new Map();
        }
        this._voiceStateByGameId[gameId].set(currentPhase, {
            eventName: updatedEventNames,
            timeline: updatedEventTimelines,
            voices: updatedVoices,
            voiceTimelines: updatedVoiceTimelines,
            scoreSequence: updatedScoreSequence,
            videoLength: updatedVideoLength,
        });

        // relative timeline is counted from event detail start
        const scheduledVoiceTimelines = this.getRelativeTimeline(voices.timeline, previousVideoLength);

        scheduledVoiceTimelines.forEach((timeline, voiceIndex) => {
            const voiceTime = new Date(event.eventDetails[index].scheduleStartTs).getTime() + timeline * 1000;
            const scheduledVoiceTime = this.delayHandlingService.getDelayedTimeWithVideoDelay({ eventId: event.eventID, time: new Date(voiceTime) }, {
                oddsFeedEventType: OddsFeedEventName.EventDetailStart,
            });
            this.scheduler.schedule(
                scheduledVoiceTime,
                this.playVoice.bind(this, 
                    gameId, {
                        fileName: voices.voice[voiceIndex],
                    }
                )
            )
        });
    }

    public playVoice(gameId: string, voice: VoiceState) {
        this.log(`Playing voice: ${voice.fileName}`, gameId);
        this.gameBroadcastService.broadcastToAllClientByGameId(
            gameId,
            voice,
            this.eventName
        );
    }

    public resetVoiceState(gameId: string) {
        this._voiceStateByGameId[gameId] = new Map();
    }

    private getAbsoluteTimeline(timeline: number[], videoLength: number) {
        return timeline.map((timeline) => timeline + videoLength);
    }

    private getOrDefault<T>(value: T | undefined, defaultValue: T) {
        return value ?? defaultValue;
    }

    private getRelativeTimeline(timeline: number[], videoLength: number) {
        return timeline.map((timeline) => timeline - videoLength);
    }

    private log(message: string, gameId: string) {
        this.featureDebugService.log(this, message, gameId);
    }

    private debugVoice(
        gameId: string,
        output: ReturnType<typeof generateVoiceWithEventTimeline>,
        input: {
            eventName: string[],
            timeline: number[],
            firstHalfScore: string,
            firstHalfVoices: string[],
            previousVoices: string[],
            previousTimelines: number[],
            previousEvents: string[],
            previousVoiceTimelines: number[],
            videoLength: number,
            previousVideoLength: number,
        },
        config: VoiceDurationConfig
    ) {
        this.log(`----- Debug voice: 
            input:
                - eventName: ${input.eventName}
                - timeline: ${input.timeline}
                - firstHalfScore: ${input.firstHalfScore}
                - firstHalfVoices: ${input.firstHalfVoices}
                - previousVoices: ${input.previousVoices}
                - previousTimelines: ${input.previousTimelines}
                - previousEvents: ${input.previousEvents}
                - previousVoiceTimelines: ${input.previousVoiceTimelines}
                - videoLength: ${input.videoLength}
                - previousVideoLength: ${input.previousVideoLength}
            output:
                - voice: ${output.voice}
                - timeline: ${output.timeline}
            `, gameId);
    }
}