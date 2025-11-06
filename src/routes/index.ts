import { Router } from "express";
import { AwilixContainer } from "awilix";
import { DebugController } from "../controllers/debug-controller";
import { HealthController } from "../controllers/health-controller";
import { EventStreamController } from "../controllers/event-stream-controller";
import { ReplayController } from "../controllers/replay-controller";
import { verifyJWT } from "../middlewares/verify-jwt";

export interface RouteContainer {
  eventStreamController: EventStreamController;
  healthController: HealthController;
  debugController: DebugController;
  replayController: ReplayController;
}

export function setupRoutes(container: AwilixContainer<RouteContainer>): Router {
  const router = Router();
  const eventStreamController = container.resolve("eventStreamController");
  const healthController = container.resolve("healthController");
  const debugController = container.resolve("debugController");
  const replayController = container.resolve("replayController");

  router.get("/", (req, res) => healthController.healthCheck(req, res));
  router.get("/live/:gameId", (req, res) => eventStreamController.handleEventStreamConnection(req, res));
  router.get("/debug-stream/:gameId", verifyJWT, (req, res) => debugController.handle(req, res));
  router.get("/replay/:eventID", (req, res) => replayController.handle(req, res));

  return router;
}
