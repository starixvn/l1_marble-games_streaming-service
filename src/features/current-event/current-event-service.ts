import { idHelper } from "../../helpers";
import { GameBroadcastService } from "../../services/game-broadcast.service";
import { DelayHandlingService } from "../delay/delay-handling-service";
import { Replay, ReplayService } from "../event-replay/event-replay-service";
import { FeatureDebugService } from "../feature-debug/feature-debug-service";
import { EventDetailNotification, EventNotification, OddsFeedEventName, OddsFeedEventSource, SystemNotification, Scheduler, Event } from "odds-feed-client";

interface CurrentEventServiceContainer {
    oddsFeedEventSource: OddsFeedEventSource;
    delayHandlingService: DelayHandlingService;
    scheduler: Scheduler;
    gameBroadcastService: GameBroadcastService;
    featureDebugService: FeatureDebugService;
}

interface CurrentEventPayload {
    eventID: number;
    eventDetailIndex: number;
    phase: number;
}

export class CurrentEventService implements ReplayService<CurrentEventPayload> {
    private readonly oddsFeedEventSource: OddsFeedEventSource;
    private readonly delayHandlingService: DelayHandlingService;
    private readonly scheduler: Scheduler;
    private readonly gameBroadcastService: GameBroadcastService;
    private readonly featureDebugService: FeatureDebugService;
    private readonly _currentEventByGameId: Record<string, number> = {};
    private readonly _currentEventDetailIndexByGameId: Record<string, number> = {};
    private readonly _eventByEventId: Record<number, Event> = {};

    private readonly boundHandleEventStart: (notification: EventNotification) => void;
    private readonly boundHandleEventDetailResultAvailable: (notification: EventDetailNotification) => void;
    private readonly boundHandleEventCleanup: (notification: SystemNotification) => void;


    constructor(container: CurrentEventServiceContainer) {
        this.oddsFeedEventSource = container.oddsFeedEventSource;
        this.delayHandlingService = container.delayHandlingService;
        this.scheduler = container.scheduler;
        this.gameBroadcastService = container.gameBroadcastService;
        this.featureDebugService = container.featureDebugService;   

        this.boundHandleEventStart = this.handleEventStart.bind(this);
        this.boundHandleEventDetailResultAvailable = this.handleEventDetailResultAvailable.bind(this);
        this.boundHandleEventCleanup = this.cleanup.bind(this);
    }
    
    getReplayByEvent(event: Event): Replay<CurrentEventPayload>[] {
        const eventIndexReset = this.delayHandlingService.getDelayedTime({ event, time: new Date(event.scheduleStartTs) }, {
            oddsFeedEventType: OddsFeedEventName.EventStart,
        });

        const eventIndexResetReplay = {
            time: eventIndexReset,
            payload: {
                eventID: event.eventID,
                eventDetailIndex: 0,
                phase: event.eventDetails[0].phase,
            },
        }

        const eventDetailIndexIncrementReplays = event.eventDetails.map((_, index) => {

            if (index === event.eventDetails.length - 1) {
                return null;
            }

            const whenToIncrement = this.delayHandlingService.getDelayedTime({ event, time: new Date(event.eventDetails[index].resultsAvailableTs) }, {
                oddsFeedEventType: OddsFeedEventName.EventDetailResultsAvailable,
            });
            return {
                time: whenToIncrement,
                payload: {
                    eventID: event.eventID,
                    eventDetailIndex: index + 1,
                    phase: event.eventDetails[index + 1].phase,
                }   
            }
        });

        return [
            eventIndexResetReplay,
            ...eventDetailIndexIncrementReplays,
        ].filter((replay) => replay !== null);
    }

    public readonly eventName = "currentEvent";

    public getCurrentEventByGameId(gameId: string) {
        return this._currentEventByGameId[gameId];
    }

    public getCurrentEventDetailIndexByGameId(gameId: string) {
        return this._currentEventDetailIndexByGameId[gameId];
    }

    public getCurrentPhaseByGameId(gameId: string) {
        const currentEvent = this.getCurrentEventByGameId(gameId);
        const currentEventDetailIndex = this.getCurrentEventDetailIndexByGameId(gameId);
        const currentEventDetail = this._eventByEventId[currentEvent]?.eventDetails[currentEventDetailIndex];
        return currentEventDetail?.phase;
    }

    public getCurrentByGameId(gameId: string) {

        if (!this._currentEventByGameId[gameId]) {
            return null;
        }

        return {
            event: this.getCurrentEventByGameId(gameId),
            eventDetailIndex: this.getCurrentEventDetailIndexByGameId(gameId),
            phase: this.getCurrentPhaseByGameId(gameId),
        }
    }

    public initEvent() {
        this.oddsFeedEventSource.eventOn(
            OddsFeedEventName.EventStart,
            this.boundHandleEventStart
        );
        this.oddsFeedEventSource.eventDetailOn(
            OddsFeedEventName.EventDetailResultsAvailable,
            this.boundHandleEventDetailResultAvailable
        );
        this.oddsFeedEventSource.cleanupOn(this.boundHandleEventCleanup);
    }

    public dispose() {
        this.oddsFeedEventSource.eventOff(OddsFeedEventName.EventStart, this.boundHandleEventStart);
        this.oddsFeedEventSource.eventDetailOff(OddsFeedEventName.EventDetailResultsAvailable, this.boundHandleEventDetailResultAvailable);
        this.oddsFeedEventSource.cleanupOff(this.boundHandleEventCleanup);
    }

    public cleanup({ eventID }: SystemNotification) {
        delete this._eventByEventId[eventID];
    }



    public handleEventStart({ event }: EventNotification) {
        const whenToSetCurrentEvent = this.delayHandlingService.getDelayedTime({ event, time: new Date(event.scheduleStartTs) }, {
            oddsFeedEventType: OddsFeedEventName.EventStart,
        });
        this.scheduler.schedule(whenToSetCurrentEvent, this.handleEventIndexReset.bind(this, { event }));
    }

    public handleEventDetailResultAvailable({ event, index }: EventDetailNotification) {
        const delayedTime = this.delayHandlingService.getDelayedTime({ event, time: new Date(event.eventDetails[index].resultsAvailableTs) }, {
            oddsFeedEventType: OddsFeedEventName.EventDetailResultsAvailable,
        });
        this.scheduler.schedule(delayedTime, this.handleEventDetailIndexIncrement.bind(this, { event, index }));
    }

    public handleEventDetailIndexIncrement({ event, index }: EventDetailNotification) {
        const gameId = idHelper.extractGameId(event.eventID);
        const eventDetails = event.eventDetails;
        if (index === eventDetails.length - 1) {
            return;
        }

        this._currentEventDetailIndexByGameId[gameId] = index + 1;
        this.log(`event index increment for event ${event.eventID} to ${index + 1}`, gameId);
        this.notifyClient({
            gameId,
            eventID: event.eventID,
            index: index + 1,
        });
    }

    public handleEventIndexReset({ event }: EventNotification) {
        const gameId = idHelper.extractGameId(event.eventID);
        this._currentEventDetailIndexByGameId[gameId] = 0;
        this._eventByEventId[event.eventID] = event;
        this._currentEventByGameId[gameId] = event.eventID;
        this.log(`event index reset for event ${event.eventID}`, gameId);
        this.notifyClient({
            gameId,
            eventID: event.eventID,
            index: 0,
        });
    }
    

    private log(message: string, gameId: string) {
        this.featureDebugService.log(this, message, gameId);
    }

    private notifyClient({
        gameId,
    }: {
        gameId: string,
        eventID: number,
        index: number,
    }) {
        const currentEvent = this.getCurrentByGameId(gameId);
        if (currentEvent) {
            this.gameBroadcastService.broadcastToAllClientByGameId(
                gameId,
                currentEvent,
                this.eventName
            );
        }
    }
}