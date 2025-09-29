import { Router } from "express";
import path from "path";
import { AppContainer } from "../types";
import { AwilixContainer } from "awilix";
import { DebugController } from "../controllers/debug-controller";

export function setupRoutes(container: AwilixContainer<AppContainer & { debugController: DebugController }>): Router {
  const router = Router();
  const eventStreamController = container.resolve("eventStreamController");
  const healthController = container.resolve("healthController");
  const authController = container.resolve("authController");
  const debugController = container.resolve("debugController");

  router.get("/", (req, res) => healthController.healthCheck(req, res));

  router.post("/api/token", (req, res) => authController.login(req, res));

  router.get("/live/:gameId", (req, res) => eventStreamController.handleEventStreamConnection(req, res));
  router.get("/debug-stream/:gameId", (req, res) => debugController.handle(req, res));


  return router;
}
