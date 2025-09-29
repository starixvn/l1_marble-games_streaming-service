import { logger } from "sc-common";
import { AppContainer, Event as OddFeedEvent } from "../../types";
import { Scheduler } from "../scheduler/scheduler";
import { OddFeedEventName, OddFeedEventSource } from "./odd-feed-event-source";
import { OddFeedPullService } from "./odd-feed-pull-service";
import { isNullOrUndefinedOrEmpty } from "../../helpers/string";

interface OddFeedSchedulerContainer extends AppContainer {
    oddFeedEventSource: OddFeedEventSource;
    scheduler: Scheduler;
    oddFeedPullService: OddFeedPullService;
    logService: typeof logger;
}

export class OddFeedScheduler {
    private readonly oddFeedEventSource: OddFeedEventSource;
    private readonly scheduler: Scheduler;
    private readonly oddFeedPullService: OddFeedPullService;
    private readonly logService: typeof logger;

    constructor(container: OddFeedSchedulerContainer) {
        this.oddFeedEventSource = container.oddFeedEventSource;
        this.scheduler = container.scheduler;
        this.oddFeedPullService = container.oddFeedPullService;
        this.logService = container.logService;
    }

    public scheduleEventUpcoming(event: OddFeedEvent) {
        this.oddFeedEventSource.onEventUpcoming(event);
    }

    public scheduleEvent(event: OddFeedEvent) {
        this.scheduleEventUpcoming(event);
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
    
    protected async handleEventDetailResultsAvailable(event: OddFeedEvent, index: number, retry = 3) {
        const updatedEvent = await this.pullEventAndUpdateStore(event);
        if (retry < 0) {
            console.error(`Failed to get event details for event ${event.eventID} and index ${index} after ${retry} retries`);
            return;
        }

        if (!updatedEvent) {
            await this.handleEventDetailResultsAvailable(event, index, retry - 1);
            return;
        }

        if (isNullOrUndefinedOrEmpty(updatedEvent.eventDetails[index].result)) {
            await this.handleEventDetailResultsAvailable(event, index, retry - 1);
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
        return updatedEvent;
    }
    
    private composeKey(eventName: OddFeedEventName, eventId: number, index: number) {
        return `${eventName}-${eventId}-${index}`;
    }
}