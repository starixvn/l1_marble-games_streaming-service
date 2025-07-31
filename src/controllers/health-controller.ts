import { Request, Response } from "express";

export class HealthController {
  public async healthCheck(req: Request, res: Response): Promise<void> {
    const isHealthy = true;

    res.status(isHealthy ? 200 : 500).json({
      status: isHealthy ? "ok" : "error",
      message: "Streaming service running",
      timestamp: new Date().toISOString(),
    });
  }
}
