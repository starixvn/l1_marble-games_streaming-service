import { logger } from "sc-common";
import { idHelper } from "../../helpers";
import { OddsFeedService } from "../../services/odds-feed-service";
import { AppContainer } from "../../types";
import { OddFeedStore } from "./odd-feed-store";

interface OddFeedPullServiceContainer extends AppContainer {
    oddFeedStore: OddFeedStore;
}

export class OddFeedPullService {
    private readonly oddsFeedService: OddsFeedService;
    private readonly oddFeedStore: OddFeedStore;
    private readonly logService: typeof logger;

    constructor(container: OddFeedPullServiceContainer) {
        this.oddsFeedService = container.oddsFeedService;
        this.oddFeedStore = container.oddFeedStore;
        this.logService = container.logService;
    }

    async pullUpcoming() {
        const upcomingEvents = await this.oddsFeedService.getScheduleWithRetry();
        upcomingEvents.forEach((event) => {
            const gameId = idHelper.extractGameId(event.eventID);
            this.oddFeedStore.setEventByGameId(gameId, event.eventID, event);
        });

        return upcomingEvents;
    }

    async pullEventWithEventDetails(eventId: number) {
        const event = await this.oddsFeedService.getEventDetailsWithRetry(eventId);
        if (!event) {
            this.logService.logError(`Failed to get event details for event ${eventId}`);
            return undefined;
        }
        const gameId = idHelper.extractGameId(event.eventID);
        this.oddFeedStore.setEventByGameId(gameId, event.eventID, event);

        return event;
    }
}