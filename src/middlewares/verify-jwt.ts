import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { appConfigs } from "../app-configs";

export function verifyJWT(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(" ")[1] ?? req.query.token;
  if (!token) {
    res.status(401).json({ error: "Missing token" });
    return;
  }

  try {
    const decoded = jwt.verify(token as string, appConfigs.jwt.secret);
    (req as any).user = decoded;
    next();
  } catch {
    res.status(403).json({ error: "Invalid token" });
    return;
  }
}
