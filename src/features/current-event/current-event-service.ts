import { idHelper } from "../../helpers";
import { GameBroadcastService } from "../../services/game-broadcast.service";
import { DelayHandlingService } from "../delay/delay-handling-service";
import { EventDetailNotification, EventNotification, OddFeedEventName, OddFeedEventSource } from "../odd-feed-data";
import { Scheduler } from "../scheduler/scheduler";

interface CurrentEventServiceContainer {
    oddFeedEventSource: OddFeedEventSource;
    delayHandlingService: DelayHandlingService;
    scheduler: Scheduler;
    gameBoardcastService: GameBroadcastService;
}

export class CurrentEventService {
    private readonly oddFeedEventSource: OddFeedEventSource;
    private readonly delayHandlingService: DelayHandlingService;
    private readonly scheduler: Scheduler;
    private readonly gameBoardcastService: GameBroadcastService;
    
    private readonly _currentEventByGameId: Record<string, number> = {};
    private readonly _currentEventDetailIndexByGameId: Record<string, number> = {};

    private readonly boundHandleEventStart: (notification: EventNotification) => void;
    private readonly boundHandleEventDetailResultAvailable: (notification: EventDetailNotification) => void;

    constructor(container: CurrentEventServiceContainer) {
        this.oddFeedEventSource = container.oddFeedEventSource;
        this.delayHandlingService = container.delayHandlingService;
        this.scheduler = container.scheduler;
        this.gameBoardcastService = container.gameBoardcastService;

        this.boundHandleEventStart = this.handleEventStart.bind(this);
        this.boundHandleEventDetailResultAvailable = this.handleEventDetailResultAvailable.bind(this);
    }

    public readonly eventName = "currentEvent";

    public getCurrentEventByGameId(gameId: string) {
        return this._currentEventByGameId[gameId];
    }

    public getCurrentEventDetailIndexByGameId(gameId: string) {
        return this._currentEventDetailIndexByGameId[gameId];
    }

    public getCurrentByGameId(gameId: string) {
        return {
            event: this.getCurrentEventByGameId(gameId),
            eventDetailIndex: this.getCurrentEventDetailIndexByGameId(gameId),
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
        )
    }

    public dispose() {
        this.oddFeedEventSource.unregisterEventListener(OddFeedEventName.EventStart, this.boundHandleEventStart);
        this.oddFeedEventSource.unregisterEventDetailEventListener(OddFeedEventName.EventDetailResultsAvailable, this.boundHandleEventDetailResultAvailable);
    }

    public handleEventStart({ event }: EventNotification) {
        const whenToSetCurrentEvent = this.delayHandlingService.getDelayedTime({ eventId: event.eventID, time: new Date(event.scheduleStartTs) });
        this.scheduler.schedule(whenToSetCurrentEvent, this.handleEventIndexReset.bind(this, { event }));
    }

    public handleEventDetailResultAvailable({ event, index }: EventDetailNotification) {
        const delayedTime = this.delayHandlingService.getDelayedTime({ eventId: event.eventID, time: new Date(event.eventDetails[index].resultsAvailableTs) });
        this.scheduler.schedule(delayedTime, this.handleEventDetailIndexIncrement.bind(this, { event, index }));
    }

    public handleEventDetailIndexIncrement({ event, index }: EventDetailNotification) {
        const gameId = idHelper.extractGameId(event.eventID);
        const eventDetails = event.eventDetails;
        if (index === eventDetails.length - 1) {
            return;
        }

        this._currentEventDetailIndexByGameId[gameId] = index + 1;
        this.log(`event index increment for game ${gameId} with event ${event.eventID} to ${index + 1}`);
        this.notifyClient({
            gameId,
            eventID: event.eventID,
            index: index + 1,
        });
    }

    public handleEventIndexReset({ event }: EventNotification) {
        const gameId = idHelper.extractGameId(event.eventID);
        this._currentEventDetailIndexByGameId[gameId] = 0;
        this._currentEventByGameId[gameId] = event.eventID;
        this.log(`event index reset for game ${gameId} and set current event to ${event.eventID}`);
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

    private log(message: string) {
        console.log(`\x1b[34m[CurrentEventService] \x1b[37m: ${message}`);
    }

    private notifyClient({
        gameId,
        eventID,
        index,
    }: {
        gameId: string,
        eventID: number,
        index: number,
    }) {
        this.gameBoardcastService.broadcastToAllClientByGameId(
            gameId,
            { 
                event: eventID,
                eventDetailIndex: index,
            },
            this.eventName
        );
    }
}