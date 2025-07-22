import { Request, Response } from "express";
import mongoose from "mongoose";

export class HealthController {
  public async healthCheck(req: Request, res: Response): Promise<void> {
    const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    const isHealthy = dbStatus === "connected";

    res.status(isHealthy ? 200 : 500).json({
      status: isHealthy ? "ok" : "error",
      message: "Streaming service running",
      database: dbStatus,
      timestamp: new Date().toISOString(),
    });
  }
}
