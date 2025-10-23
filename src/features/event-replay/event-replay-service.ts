import { Event, OddsFeedEventName, OddsFeedService } from "odds-feed-client"
import { GameFlowService } from "../game-flow/game-flow-service";
import { idHelper } from "../../helpers";
import {  DelayHandlingService } from "../delay/delay-handling-service";
import { CurrentEventService } from "../current-event/current-event-service";
import { VideoStreamingService } from "../video-streaming/video-streaming-service";
import { IntroService } from "../intro/intro-service";
import { LiveScoreService } from "../live-score/live-score-service";
import { ResultService } from "../result/result-service";
import { TeamNameService } from "../team-name/team-name-service";

export interface Replay<T> {
    time: Date;
    payload: T;
    eventName?: string;
}

export interface ReplayMeta {
    gameId: string;
    fromTime: number;
}

export interface ReplayPayload {
    payload: ReplayItem[];
    meta: ReplayMeta;
}

interface ReplayItem {
    time: number;
    payload: Record<string, object>;
}

export interface RelativeReplay<T> {
    relativeTime: number;
    payload: T;
    eventName?: string;
}

export interface ReplayService<T> {
    eventName?: string;
    getReplayByEvent(event: Event): Replay<T>[] | Promise<Replay<T>[]>;
}

interface EventReplayServiceContainer {
    gameFlowService: GameFlowService;
    oddsFeedService: OddsFeedService;
    delayHandlingService: DelayHandlingService;
    currentEventService: CurrentEventService;
    videoStreamingService: VideoStreamingService;
    introService: IntroService;
    liveScoreService: LiveScoreService;
    resultService: ResultService;
    teamNameService: TeamNameService;
}

export class NotFoundError extends Error {
    constructor(message?: string) {
        super(message ?? "Event not found");
        this.name = "NotFoundError";
    }
}

export class EventReplayService {

    private readonly oddsFeedService: OddsFeedService;

    private readonly replayServices: ReplayService<object>[] = [];

    private readonly delayHandlingService: DelayHandlingService;


    constructor(container: EventReplayServiceContainer) {
        this.oddsFeedService = container.oddsFeedService;
        this.replayServices = [
            container.gameFlowService,
            container.currentEventService,
            container.videoStreamingService,
            container.introService,
            container.liveScoreService,
            container.resultService,
            container.teamNameService,
        ];
        this.delayHandlingService = container.delayHandlingService;
    }

    async getReplayByEvent(eventID: number): Promise<ReplayPayload> {
        const pastEvent = await this.getPastEvent(eventID);
        
        const validatedPastEvent = this.validatePastEvent(pastEvent);

        const fromTime = this.delayHandlingService.getDelayedTime({ event: validatedPastEvent, time: new Date(validatedPastEvent.scheduleStartTs) }, {
            oddsFeedEventType: OddsFeedEventName.EventStart,
        });
        
        const replayItems: ReplayItem[] = [];

        for (const replayService of this.replayServices) {
            const replays = await replayService.getReplayByEvent(validatedPastEvent);
            const relativeReplays: RelativeReplay<object>[] = this.getRelativeReplays({
                fromTime,
                replays,
            });
            for (const relativeReplay of relativeReplays) {
                replayItems.push({
                    time: relativeReplay.relativeTime,
                    payload: {
                        [relativeReplay.eventName ?? replayService.eventName ?? ""]: relativeReplay.payload,
                    },
                });
            }
        }

        return {
            payload: replayItems.toSorted((a, b) => a.time - b.time),
            meta: {
                gameId: idHelper.extractGameId(eventID),
                fromTime: fromTime.getTime(),
            },
        };
    }

    async getPastEvent(eventID: number) {
        return this.oddsFeedService.fetchEventDetails(eventID);
    }

    getRelativeReplays<T>({
        fromTime,
        replays
    }: {
        fromTime: Date;
        replays: Replay<T>[];
    }): RelativeReplay<T>[] {
        return replays.map((replay) => {
            return {
                relativeTime: (replay.time.getTime() - fromTime.getTime()) / 1000,
                payload: replay.payload,
                eventName: replay.eventName,
            };
        });
    }

    validatePastEvent(event?: Event | null): Event {
        if (!event) {
            throw new NotFoundError();
        }

        const eventEnd = new Date(event.eventDetails[event.eventDetails.length - 1].resultsAvailableTs);

        if (eventEnd.getTime() > new Date().getTime()) {
            throw new NotFoundError();
        }

        return event;
    }
}