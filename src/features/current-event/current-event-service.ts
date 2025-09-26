import { idHelper } from "../../helpers";
import { GameBroadcastService } from "../../services/game-broadcast.service";
import { Event } from "../../types";
import { DelayHandlingService } from "../delay/delay-handling-service";
import { FeatureDebugService } from "../feature-debug/feature-debug-service";
import { EventDetailNotification, EventNotification, OddFeedEventName, OddFeedEventSource, SystemNotification } from "../odd-feed-data";
import { Scheduler } from "../scheduler/scheduler";

interface CurrentEventServiceContainer {
    oddFeedEventSource: OddFeedEventSource;
    delayHandlingService: DelayHandlingService;
    scheduler: Scheduler;
    gameBoardcastService: GameBroadcastService;
    featureDebugService: FeatureDebugService;
}

export class CurrentEventService {
    private readonly oddFeedEventSource: OddFeedEventSource;
    private readonly delayHandlingService: DelayHandlingService;
    private readonly scheduler: Scheduler;
    private readonly gameBoardcastService: GameBroadcastService;
    private readonly featureDebugService: FeatureDebugService;
    private readonly _currentEventByGameId: Record<string, number> = {};
    private readonly _currentEventDetailIndexByGameId: Record<string, number> = {};
    private readonly _eventByEventId: Record<number, Event> = {};

    private readonly boundHandleEventStart: (notification: EventNotification) => void;
    private readonly boundHandleEventDetailResultAvailable: (notification: EventDetailNotification) => void;
    private readonly boundHandleEventCleanup: (notification: SystemNotification) => void;


    constructor(container: CurrentEventServiceContainer) {
        this.oddFeedEventSource = container.oddFeedEventSource;
        this.delayHandlingService = container.delayHandlingService;
        this.scheduler = container.scheduler;
        this.gameBoardcastService = container.gameBoardcastService;
        this.featureDebugService = container.featureDebugService;   

        this.boundHandleEventStart = this.handleEventStart.bind(this);
        this.boundHandleEventDetailResultAvailable = this.handleEventDetailResultAvailable.bind(this);
        this.boundHandleEventCleanup = this.cleanup.bind(this);
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
        return {
            event: this.getCurrentEventByGameId(gameId),
            eventDetailIndex: this.getCurrentEventDetailIndexByGameId(gameId),
            phase: this.getCurrentPhaseByGameId(gameId),
        }
    }

    public initEvent() {
        this.oddFeedEventSource.registerEventListener(
            OddFeedEventName.EventStart,
            this.boundHandleEventStart
        );
        this.oddFeedEventSource.registerEventDetailEventListener(
            OddFeedEventName.EventDetailResultsAvailable,
            this.boundHandleEventDetailResultAvailable
        );
        this.oddFeedEventSource.registerSystemDataCleanupEventListener(this.boundHandleEventCleanup);
    }

    public dispose() {
        this.oddFeedEventSource.unregisterEventListener(OddFeedEventName.EventStart, this.boundHandleEventStart);
        this.oddFeedEventSource.unregisterEventDetailEventListener(OddFeedEventName.EventDetailResultsAvailable, this.boundHandleEventDetailResultAvailable);
        this.oddFeedEventSource.unregisterSystemDataCleanupEventListener(this.boundHandleEventCleanup);
    }

    public cleanup({ eventID }: SystemNotification) {
        delete this._eventByEventId[eventID];
    }

    public handleEventStart({ event }: EventNotification) {
        const whenToSetCurrentEvent = this.delayHandlingService.getDelayedTime({ eventId: event.eventID, time: new Date(event.scheduleStartTs) }, {
            oddFeedEventType: OddFeedEventName.EventStart,
        });
        this.scheduler.schedule(whenToSetCurrentEvent, this.handleEventIndexReset.bind(this, { event }));
    }

    public handleEventDetailResultAvailable({ event, index }: EventDetailNotification) {
        const delayedTime = this.delayHandlingService.getDelayedTime({ eventId: event.eventID, time: new Date(event.eventDetails[index].resultsAvailableTs) }, {
            oddFeedEventType: OddFeedEventName.EventDetailResultsAvailable,
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
    
    public handleEventDetailStart({ event, index }: EventDetailNotification) {
        const gameId = idHelper.extractGameId(event.eventID);
        this._currentEventDetailIndexByGameId[gameId] = index;
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
        this.gameBoardcastService.broadcastToAllClientByGameId(
            gameId,
            this.getCurrentByGameId(gameId),
            this.eventName
        );
    }
}