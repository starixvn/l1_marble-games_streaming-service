import { Request, Response } from "express";

export class HealthController {
  public async healthCheck(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: "ok",
      message: "Streaming service running",
      timestamp: new Date().toISOString(),
    });
  }
}
