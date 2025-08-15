import { Request, Response } from "express";

export class HealthController {
  public async healthCheck(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: "ok",
      message: "Streaming service running",
      timestamp: new Date().toISOString(),
      clientIP: req.ip,
      host: req.headers.host || "Not available",
      hostName: req.headers["x-forwarded-host"] || "Not available",
      forwardedFor: req.headers["x-forwarded-for"] || "Not available",
      remoteAddress: req.socket.remoteAddress || "Not available",
    });
  }
}
