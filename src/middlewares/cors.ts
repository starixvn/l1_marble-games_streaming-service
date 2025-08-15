import cors from "cors";
import { NextFunction, Request, Response } from "express";
import { getDomain } from "tldts";

export const validateOrigin = (origin: any, host: any): boolean => {
  console.log("validateOrigin", origin, host);
  if (!origin) {
    return false;
  }

  const originDomain = getDomain(origin);
  const hostDomain = getDomain(host);
  const isLocalHost = /^https?:\/\/localhost:745(6|7|8|9)$/.test(origin);
  let isSameDomain = false;

  if (originDomain && hostDomain) {
    isSameDomain = originDomain === hostDomain;
  }

  return isLocalHost || isSameDomain;
};

export const applyCors = (req: Request, res: Response, next: NextFunction) => {
  const corsOptions = {
    origin: function (origin: any, callback: any) {
      if (validateOrigin(origin, req.headers.host)) {
        callback(null, true);
      } else {
        callback(new Error("Access denied"));
      }
    },
    credentials: true,
  };

  return cors(corsOptions)(req, res, next);
};

export const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === "/") {
    return next();
  }

  console.log("corsMiddleware", req.path);

  return applyCors(req, res, next);
};
