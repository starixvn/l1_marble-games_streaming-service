import { OddsFeedEventName, OddsFeedEventSource, EventNotification, Scheduler, EventDetailNotification } from "odds-feed-client";
import { GameFlowService } from "../game-flow/game-flow-service";
import { GameBroadcastService } from "../../services/game-broadcast.service";
import { idHelper } from "../../helpers";
import { GameFlowTimeTrackingService } from "../game-flow-time-tracking-service/game-flow-time-tracking-service";
import { EventStartHandler, EventDetailStartHandler, EventDetailResultsAvailableHandler } from "../../core/interfaces/event-handlers";
import { Schedule } from "../../core/dto/schedule";
import { FeatureDebugService } from "../feature-debug/feature-debug-service";

interface EventProcessServiceContainer {
    oddsFeedEventSource: OddsFeedEventSource;
    gameBroadcastService: GameBroadcastService;
    gameFlowService: GameFlowService;
    scheduler: Scheduler;
    gameFlowTimeTrackingService: GameFlowTimeTrackingService;
    featureDebugService: FeatureDebugService;
}

class EventProcessSchedule extends Schedule {
    public readonly service?: any;

    constructor({ 
        time, 
        callback, 
        payload, 
        meta, 
        eventName, 
        service 
    }: { time: Date, callback?: () => void, payload?: any, meta?: { gameId: string }, eventName?: string, service: any }) {
        super({ time, callback, payload, meta, eventName });
        this.service = service;
    }

    schedule(scheduler: Scheduler, gameId: string, gameBroadcastService: GameBroadcastService, featureDebugService: FeatureDebugService) {
        scheduler.schedule(this.time, () => {
            this.callback?.();
            this.service?.setCurrentByGameId(gameId, this.payload);
            gameBroadcastService.broadcastToAllClientByGameId(gameId, this.payload, this.eventName);
            featureDebugService.log(this.service, JSON.stringify(this.payload), gameId);
        });
    }
}

export class EventProcessService {
    private readonly oddsFeedEventSource: OddsFeedEventSource;
    private readonly scheduler: Scheduler;
    private readonly gameBroadcastService: GameBroadcastService;
    private readonly featureDebugService: FeatureDebugService;

    private readonly featureServices: any[] = [];
    private readonly eventStartHandlers: EventStartHandler[] = [];
    private readonly eventDetailStartHandlers: EventDetailStartHandler[] = [];
    private readonly eventDetailResultsAvailableHandlers: EventDetailResultsAvailableHandler[] = [];

    constructor(container: EventProcessServiceContainer) {
        this.oddsFeedEventSource = container.oddsFeedEventSource;
        this.scheduler = container.scheduler;
        this.gameBroadcastService = container.gameBroadcastService;
        this.featureDebugService = container.featureDebugService;

        this.eventStartHandlers = []
        this.eventStartHandlers = [];
        this.eventDetailStartHandlers = [];
    }

    public initEvent() {
        this.oddsFeedEventSource.eventOn(
            OddsFeedEventName.EventStart,
            this.handleEventStart.bind(this)
        );
        this.oddsFeedEventSource.eventDetailOn(
            OddsFeedEventName.EventDetailStart,
            this.handleEventDetailScheduleStart.bind(this)
        );
        this.oddsFeedEventSource.eventDetailOn(
            OddsFeedEventName.EventDetailResultsAvailable,
            this.handleEventDetailResultsAvailable.bind(this)
        );
    }

    public dispose() {
        this.oddsFeedEventSource.eventOff(
            OddsFeedEventName.EventStart,
            this.handleEventStart.bind(this)
        );
        this.oddsFeedEventSource.eventDetailOff(
            OddsFeedEventName.EventDetailStart,
            this.handleEventDetailScheduleStart.bind(this)
        );
        this.oddsFeedEventSource.eventDetailOff(
            OddsFeedEventName.EventDetailResultsAvailable,
            this.handleEventDetailResultsAvailable.bind(this)
        );
    }

    private handleEventStart({ event }: EventNotification) {
        const schedules: EventProcessSchedule[] = [];
        this.eventStartHandlers.forEach(handler => {
            schedules.push(...(handler.handleEventStart?.({ event }) ?? []).map(schedule => this.scheduleToEventProcessSchedule(schedule, handler)));
        });
        
        const gameId = idHelper.extractGameId(event.eventID);
        
        schedules.forEach(schedule => schedule.schedule(this.scheduler, gameId, this.gameBroadcastService, this.featureDebugService));
    }

    private handleEventDetailScheduleStart({ event, index }: EventDetailNotification) {
        const schedules: EventProcessSchedule[] = [];
        this.eventDetailStartHandlers.forEach(handler => {
            schedules.push(...handler.handleEventDetailScheduleStart({ event, index }).map(schedule => this.scheduleToEventProcessSchedule(schedule, handler)));
        });
        
        const gameId = idHelper.extractGameId(event.eventID);
        schedules.forEach(schedule => schedule.schedule(this.scheduler, gameId, this.gameBroadcastService, this.featureDebugService));
    }

    private handleEventDetailResultsAvailable({ event, index }: EventDetailNotification) {
        const schedules: EventProcessSchedule[] = [];
        this.eventDetailResultsAvailableHandlers.forEach(handler => {
            schedules.push(...handler.handleEventDetailResultsAvailable({ event, index }).map(schedule => this.scheduleToEventProcessSchedule(schedule, handler)));
        });
        const gameId = idHelper.extractGameId(event.eventID);
        schedules.forEach(schedule => schedule.schedule(this.scheduler, gameId, this.gameBroadcastService, this.featureDebugService));
    }

    private scheduleToEventProcessSchedule(schedule: Schedule, service: any): EventProcessSchedule {
        return new EventProcessSchedule({
            time: schedule.time,
            callback: schedule.callback,
            payload: schedule.payload,
            meta: schedule.meta,
            eventName: schedule.eventName,
            service: service,
        });
    }
}