import { idHelper } from "../../helpers";
import { GameBroadcastService } from "../../services/game-broadcast.service";
import { DelayHandlingService } from "../delay/delay-handling-service";
import { FeatureDebugService } from "../feature-debug/feature-debug-service";
import { EventNotification, OddFeedEventName, OddFeedEventSource } from "../odd-feed-data";
import { Scheduler } from "../scheduler/scheduler";

export interface TeamNameState {
    homeTeamName: string;
    awayTeamName: string;
}

export type TeamNameServiceContainer = {
    oddFeedEventSource: OddFeedEventSource;
    scheduler: Scheduler;
    gameBoardcastService: GameBroadcastService;
    delayHandlingService: DelayHandlingService;
    featureDebugService: FeatureDebugService;
}

export class TeamNameService {
    private readonly oddFeedEventSource: OddFeedEventSource;
    private readonly scheduler: Scheduler;
    private readonly gameBoardcastService: GameBroadcastService;
    private readonly delayHandlingService: DelayHandlingService;
    private readonly featureDebugService: FeatureDebugService;
    
    private readonly teamNameByGameId: Record<string, TeamNameState> = {};

    private readonly boundHandleEventStart: (notification: EventNotification) => void;

    constructor(container: TeamNameServiceContainer) {
        this.oddFeedEventSource = container.oddFeedEventSource;
        this.scheduler = container.scheduler;
        this.gameBoardcastService = container.gameBoardcastService;
        this.delayHandlingService = container.delayHandlingService;
        this.featureDebugService = container.featureDebugService;
        
        this.boundHandleEventStart = this.handleEventStart.bind(this);
    }

    public readonly eventName = "teamName";

    public getCurrentByGameId(gameId: string): TeamNameState {
        return this.teamNameByGameId[gameId];
    }

    public initEvent() {
        this.oddFeedEventSource.registerEventListener(
            OddFeedEventName.EventStart,
            this.boundHandleEventStart
        );
    }

    public dispose() {
        this.oddFeedEventSource.unregisterEventListener(
            OddFeedEventName.EventStart,
            this.boundHandleEventStart);
    }

    public handleEventStart({ event }: EventNotification) {
        const timeToUpdate = this.delayHandlingService.getDelayedTime({ eventId: event.eventID, time: new Date(event.scheduleStartTs) });
        this.scheduler.schedule(timeToUpdate, this.handleTeamNameUpdate.bind(this, { event }));
    }

    public handleTeamNameUpdate({ event }: EventNotification) {
        const gameId = idHelper.extractGameId(event.eventID);
        this.teamNameByGameId[gameId] = {
            homeTeamName: event.eventNameAKey,
            awayTeamName: event.eventNameBKey,
        };
        this.broadcastTeamName({ gameId });
    }

    private broadcastTeamName({ gameId }: { gameId: string }) {
        this.log(`broadcast team name ${JSON.stringify(this.getCurrentByGameId(gameId))}`, gameId);

        this.gameBoardcastService.broadcastToAllClientByGameId(
            gameId,
            this.getCurrentByGameId(gameId),
            this.eventName
        );
    }

    private log(message: string, gameId: string) {
        this.featureDebugService.log(this, message, gameId);
    }
}