import cors from "cors";
import { NextFunction, Request, Response } from "express";

export const validateOrigin = (origin: any) => {
  if (!origin) {
    return false;
  }

  const allowedPatterns = [
    /^https?:\/\/.*\.lumigame\.com$/,
    /^https?:\/\/.*\.sgamesuat\.com$/,
    /^https?:\/\/localhost:745(6|7|8|9)$/,
  ];
  return allowedPatterns.some((pattern) => pattern.test(origin));
};

export const applyCors = cors({
  origin: function (origin, callback) {
    if (validateOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Access denied"));
    }
  },
  credentials: true,
});

export const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === "/") {
    return next();
  }

  return applyCors(req, res, next);
};
