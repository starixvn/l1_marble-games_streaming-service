import { logger } from "sc-common";
import { AppContainer, Event as OddFeedEvent } from "../../types";
import { SchedulerConsumer } from "../scheduler/scheduler";
import { OddFeedEventName, OddFeedEventSource } from "./odd-feed-event-source";
import { OddFeedPullService } from "./odd-feed-pull-service";
import { OddFeedStore } from "./odd-feed-store";
import { idHelper } from "../../helpers";

interface OddFeedSchedulerContainer extends AppContainer {
    oddFeedEventSource: OddFeedEventSource;
    scheduler: SchedulerConsumer;
    oddFeedPullService: OddFeedPullService;
    logService: typeof logger;
    oddFeedStore: OddFeedStore;
}

export class OddFeedScheduler {
    private readonly oddFeedEventSource: OddFeedEventSource;
    private readonly scheduler: SchedulerConsumer;
    private readonly oddFeedPullService: OddFeedPullService;
    private readonly logService: typeof logger;
    private readonly oddFeedStore: OddFeedStore;

    constructor(container: OddFeedSchedulerContainer) {
        this.oddFeedEventSource = container.oddFeedEventSource;
        this.scheduler = container.scheduler;
        this.oddFeedPullService = container.oddFeedPullService;
        this.logService = container.logService;
        this.oddFeedStore = container.oddFeedStore;
    }


    public scheduleEvent(event: OddFeedEvent) {
        console.log(
            `--- SCHEDULE EVENT ---
            Game ID :${idHelper.extractGameId(event.eventID)}
            Event ID :${event.eventID}
            Round Id:${idHelper.extractRoundId(event.eventID)}
            `
        )
        this.scheduleEventStart(event);
        event.eventDetails.forEach((_, index) => {
            this.scheduleEventDetailStart(event, index);
            this.scheduleEventDetailOddsAvailable(event, index);
            this.scheduleEventDetailResultsAvailable(event, index);
        });
    }

    protected scheduleEventStart(event: OddFeedEvent) {
        const eventStart = new Date(event.scheduleStartTs);
        const key = this.composeKey(OddFeedEventName.EventStart, event.eventID, 0);
        this.scheduler.schedule(
            eventStart, 
            this.handleEventStart.bind(this, event), {
            keyOverride: key,
        });
    }

    protected scheduleEventDetailStart(event: OddFeedEvent, index: number) {
        const eventDetailStart = new Date(event.eventDetails[index].scheduleStartTs);
        const key = this.composeKey(OddFeedEventName.EventDetailStart, event.eventID, index);
        this.scheduler.schedule(
            eventDetailStart,
            this.handleEventDetailStart.bind(this, event, index), {
            keyOverride: key,
        });
    }

    protected scheduleEventDetailOddsAvailable(event: OddFeedEvent, index: number) {
        const eventDetailOddsAvailable = new Date(event.eventDetails[index].oddsAvailableTs);
        const key = this.composeKey(OddFeedEventName.EventDetailOddsAvailable, event.eventID, index);
        this.scheduler.schedule(
            eventDetailOddsAvailable, 
            this.handleEventDetailOddsAvailable.bind(this, event, index), {
            keyOverride: key,
        });
    }

    protected scheduleEventDetailResultsAvailable(event: OddFeedEvent, index: number) {
        const eventDetailResultsAvailable = new Date(event.eventDetails[index].resultsAvailableTs);
        const key = this.composeKey(OddFeedEventName.EventDetailResultsAvailable, event.eventID, index);
        this.scheduler.schedule(
            eventDetailResultsAvailable, 
            this.handleEventDetailResultsAvailable.bind(this, event, index), {
            keyOverride: key,
        });
    }

    protected async handleEventStart(event: OddFeedEvent) {
        const updatedEvent = await this.pullEventAndUpdateStore(event);
        if (!updatedEvent) {
            return;
        }
        this.oddFeedEventSource.onEventStart(updatedEvent);
    }

    protected async handleEventDetailStart(event: OddFeedEvent, index: number) {
        const updatedEvent = await this.pullEventAndUpdateStore(event);
        if (!updatedEvent) {
            return;
        }
        this.oddFeedEventSource.onEventDetailStart(updatedEvent, index);
    }

    protected async handleEventDetailOddsAvailable(event: OddFeedEvent, index: number) {
        const updatedEvent = await this.pullEventAndUpdateStore(event);
        if (!updatedEvent) {
            return;
        }
        this.oddFeedEventSource.onEventDetailOddsAvailable(updatedEvent, index);
    }
    
    protected async handleEventDetailResultsAvailable(event: OddFeedEvent, index: number) {
        const updatedEvent = await this.pullEventAndUpdateStore(event);
        if (!updatedEvent) {
            return;
        }
        this.oddFeedEventSource.onEventDetailResultsAvailable(updatedEvent, index);
    }

    protected async pullEventAndUpdateStore(event: OddFeedEvent) {
        const updatedEvent = await this.oddFeedPullService.pullEventWithEventDetails(event.eventID);
            if (!updatedEvent) {
                this.logService.logError(`Failed to get event details for event ${event.eventID}`);
                return undefined;
            }
            this.oddFeedStore.setEventByGameId(idHelper.extractGameId(updatedEvent.eventID), updatedEvent.eventID, updatedEvent);

        return updatedEvent;
    }
    
    private composeKey(eventName: OddFeedEventName, eventId: number, index: number) {
        return `${eventName}-${eventId}-${index}`;
    }
}