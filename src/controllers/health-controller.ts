import { Request, Response } from "express";

export class HealthController {
  public async healthCheck(req: Request, res: Response): Promise<void> {
    const notAvailable = "Not available";
    res.status(200).json({
      status: "ok",
      message: "Streaming service running",
      timestamp: new Date().toISOString(),
      clientIP: req.ip,
      host: req.headers.host || notAvailable,
      hostName: req.headers["x-forwarded-host"] || notAvailable,
      forwardedFor: req.headers["x-forwarded-for"] || notAvailable,
      remoteAddress: req.socket.remoteAddress || notAvailable,
    });
  }
}
