import { Request, Response } from "express";

export class HealthController {
  public async healthCheck(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: "ok",
      message: "Streaming service running",
      timestamp: new Date().toISOString(),
      clientIP: req.ip,
      forwardedFor: req.headers["x-forwarded-for"] || "Not available",
      remoteAddress: req.socket.remoteAddress || "Not available",
    });
  }
}
