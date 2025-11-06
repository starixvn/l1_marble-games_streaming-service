import { NextFunction, Request, Response } from "express";
import { appConfigs } from "../app-configs";

export function verifyJWT(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(" ")[1] ?? req.query.token;
  if (token !== appConfigs.adminToken) {
    res.status(401).json({ error: "Missing token" });
    return;
  }

  next();
}
