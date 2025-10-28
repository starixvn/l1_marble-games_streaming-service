import { EventNotification, OddsFeedEventName, OddsFeedEventSource, Scheduler, Event } from "odds-feed-client";
import { DelayHandlingService } from "../delay/delay-handling-service";
import { GameBroadcastService } from "../../services/game-broadcast.service";
import { FeatureDebugService } from "../feature-debug/feature-debug-service";
import { idHelper } from "../../helpers";
import { Replay, ReplayService } from "../event-replay/event-replay-service";

interface IntroServiceContainer {
    oddsFeedEventSource: OddsFeedEventSource;
    scheduler: Scheduler;
    delayHandlingService: DelayHandlingService;
    gameBroadcastService: GameBroadcastService;
    featureDebugService: FeatureDebugService;
}

interface IntroState {
    resourceServer: string;
    introTime: number;
    timeToPlay: number;
    isPlaying: boolean;
    duration: number;
}

export class IntroService implements ReplayService<IntroState> {
    private readonly oddsFeedEventSource: OddsFeedEventSource;
    private readonly scheduler: Scheduler;
    private readonly delayHandlingService: DelayHandlingService;
    private readonly gameBroadcastService: GameBroadcastService;
    private readonly featureDebugService: FeatureDebugService;

    private readonly _introByGameId: Record<string, IntroState> = {};

    private readonly boundHandleEventStart: (notification: EventNotification) => void;

    constructor(container: IntroServiceContainer) {
        this.oddsFeedEventSource = container.oddsFeedEventSource;
        this.scheduler = container.scheduler;
        this.delayHandlingService = container.delayHandlingService;
        this.gameBroadcastService = container.gameBroadcastService;
        this.featureDebugService = container.featureDebugService;

        this.boundHandleEventStart = this.handleEventStart.bind(this);
    }
	getReplayByEvent(event: Event): Replay<IntroState>[] {
        if (!(event as any).config?.intro) {
            return [];
        }

		const duration = (event as any).config?.intro?.duration ?? 0;
		const resourceServer = (event as any).config?.intro?.resourceServer ?? "";
		const durationInMilliseconds = duration * 1000;

		const timeToPlayPrebetIntro = this.delayHandlingService.getDelayedTime({ event, time: new Date(event.scheduleStartTs) }, {
			oddsFeedEventType: OddsFeedEventName.EventStart,
		});
		const timeToStopPrebetIntro = new Date(timeToPlayPrebetIntro.getTime() + durationInMilliseconds + 1);

		const secondHalfIndex = this.getFirst2ndHalfEventDetailIndex(event);
		const timeToPlayHalfTimeIntro = secondHalfIndex >= 0
			? this.delayHandlingService.getDelayedTime({ event, time: new Date(new Date(event.eventDetails[secondHalfIndex].scheduleStartTs).getTime() - durationInMilliseconds) }, {
				oddsFeedEventType: OddsFeedEventName.EventDetailStart,
			})
			: undefined;

		const halftimeReplays: Replay<IntroState>[] = [];
		if (timeToPlayHalfTimeIntro) {
			const halfPlayMs = timeToPlayHalfTimeIntro.getTime();
			const timeToStopHalfTimeIntro = new Date(halfPlayMs + durationInMilliseconds + 1);
			halftimeReplays.push({
				time: timeToPlayHalfTimeIntro,
				payload: {
					resourceServer,
					introTime: 0,
					timeToPlay: halfPlayMs,
					isPlaying: true,
					duration,
				},
				eventName: this.eventName,
			});
			halftimeReplays.push({
				time: timeToStopHalfTimeIntro,
				payload: {
					resourceServer,
					introTime: duration,
					timeToPlay: halfPlayMs,
					isPlaying: false,
					duration,
				},
				eventName: this.eventName,
			});
		}

		return [
			{
				time: timeToPlayPrebetIntro,
				payload: {
					resourceServer,
					introTime: 0,
					timeToPlay: timeToPlayPrebetIntro.getTime(),
					isPlaying: true,
					duration,
				},
				eventName: this.eventName,
			},
			{
				time: timeToStopPrebetIntro,
				payload: {
					resourceServer,
					introTime: duration,
					timeToPlay: timeToPlayPrebetIntro.getTime(),
					isPlaying: false,
					duration,
				},
				eventName: this.eventName,
			},
			...halftimeReplays,
		];
	}

    public eventName = "intro";

    initEvent() {
        this.oddsFeedEventSource.eventOn(
            OddsFeedEventName.EventStart,
            this.boundHandleEventStart
        );
    }

    dispose() {
        this.oddsFeedEventSource.eventOff(
            OddsFeedEventName.EventStart,
            this.boundHandleEventStart
        );
    }

    handleEventStart({ event }: EventNotification) {
        const duration = (event as any).config?.intro?.duration ?? 0;

        const secondHalfIndex = this.getFirst2ndHalfEventDetailIndex(event);

        const durationInMilliseconds = duration * 1000;
        const timeToPlayPrebetIntro = this.delayHandlingService.getDelayedTime({ event, time: new Date(event.scheduleStartTs) }, {
            oddsFeedEventType: OddsFeedEventName.EventStart,
        });
        const timeToStopPrebetIntro = new Date(timeToPlayPrebetIntro.getTime() + durationInMilliseconds + 1);
        
        const timeToPlayHalfTimeIntro = this.delayHandlingService.getDelayedTime({ event, time: new Date(new Date(event.eventDetails[secondHalfIndex].scheduleStartTs).getTime() - durationInMilliseconds) }, {
            oddsFeedEventType: OddsFeedEventName.EventDetailStart,
        });
        const timeToStopHalfTimeIntro = new Date(timeToPlayHalfTimeIntro.getTime() + durationInMilliseconds + 1);
        
        this.scheduler.schedule(timeToPlayPrebetIntro, this.updateIntroStatus.bind(this, { event, timeToPlay: timeToPlayPrebetIntro.getTime() }));
        this.scheduler.schedule(timeToPlayHalfTimeIntro, this.updateIntroStatus.bind(this, { event, timeToPlay: timeToPlayHalfTimeIntro.getTime() }));
        
        this.scheduler.schedule(timeToStopPrebetIntro, this.updateIntroStatus.bind(this, { event, timeToPlay: timeToPlayPrebetIntro.getTime() }));
        this.scheduler.schedule(timeToStopHalfTimeIntro, this.updateIntroStatus.bind(this, { event, timeToPlay: timeToPlayHalfTimeIntro.getTime() }));
    }

    updateIntroStatus({ event, timeToPlay }: { event: Event, timeToPlay: number }) {
        const introTime = (Date.now() - timeToPlay) / 1000;
        const duration = (event as any).config?.intro?.duration;
        const resourceServer = (event as any).config?.intro?.resourceServer;

        const updateIntroState = {
            resourceServer,
            introTime,
            timeToPlay,
            isPlaying: introTime >= 0 && introTime <= duration,
            duration,
        }

        const gameId = idHelper.extractGameId(event.eventID);
        this._introByGameId[gameId] = updateIntroState;

        this.broadcastIntro({ gameId });
    }

    getCurrentByGameId(gameId: string) {
        const introState = this._introByGameId[gameId];
        if (!introState) {
            return undefined;
        }
        const introTime = (Date.now() - introState.timeToPlay) / 1000;
        return  { 
            ...introState,
            isPlaying: this.isPlaying(introState, introTime),
            introTime,
        };
    }

    private broadcastIntro({ gameId }: { gameId: string }) {
        
        this.gameBroadcastService.broadcastToAllClientByGameId(
            gameId,
            this.getCurrentByGameId(gameId) ?? {},
            this.eventName
        );
        this.log(`broadcast intro ${JSON.stringify(this.getCurrentByGameId(gameId), null, 2)}`, gameId);
    }

    private getFirst2ndHalfEventDetailIndex(event: Event) {
        return event.eventDetails.findIndex((detail) => detail.phase === 1);
    }

    private log(message: string, gameId: string) {
        this.featureDebugService.log(this, message, gameId);
    }

    private isPlaying(introState: IntroState, introTime: number) {
        return introTime >= 0 && introTime <= introState.duration;
    }
}