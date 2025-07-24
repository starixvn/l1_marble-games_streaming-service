import { Request, Response } from "express";
import { EventStreamService } from "../services/event-stream-service";
import { AppContainer } from "../types";

export class EventStreamController {
  private readonly eventStreamService: EventStreamService;

  constructor(container: AppContainer) {
    this.eventStreamService = container.eventStreamService;
  }

  public handleEventStreamConnection(req: Request, res: Response): void {
    const gameId = req.params.gameId;

    if (!gameId) {
      res.status(400).json({ error: "Game ID is required" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();

    this.eventStreamService.addClient(res, gameId);

    req.on("close", () => {
      this.eventStreamService.removeClient(res, gameId);
    });
  }
}
