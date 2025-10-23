import { EventReplayService, NotFoundError } from "../features/event-replay/event-replay-service";
import { Request, Response } from "express";

interface ReplayControllerContainer {
    eventReplayService: EventReplayService;
}

export class ReplayController {
    private readonly eventReplayService: EventReplayService;

    constructor(container: ReplayControllerContainer) {
        this.eventReplayService = container.eventReplayService;
    }

    public async handle(req: Request, res: Response): Promise<ReturnType<typeof res.json>> {
        const eventID = parseInt(req.params.eventID);
        try {
            if (isNaN(eventID)) {
                return res.status(404).json({ error: "Event invalid" });
            }

            const replayPayload = await this.eventReplayService.getReplayByEvent(eventID);

            return res.json(replayPayload);

        } catch (error) {
            if (error instanceof NotFoundError) {
                return res.status(404).json({ error: error.message });
            }
            return res.status(500).json({ error: "Internal server error" });
        }
    }
}