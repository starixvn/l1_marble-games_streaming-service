import { Router } from "express";
import { AppContainer } from "../types";
import { AwilixContainer } from "awilix";

export function setupRoutes(container: AwilixContainer<AppContainer>): Router {
  const router = Router();
  const eventStreamController = container.resolve("eventStreamController");
  const healthController = container.resolve("healthController");
  const authController = container.resolve("authController");
  const monitorController = container.resolve("monitorController");

  router.get("/", (req, res) => healthController.healthCheck(req, res));

  router.post("/api/token", (req, res) => authController.login(req, res));

  router.get("/live/:gameId", (req, res) => eventStreamController.handleEventStreamConnection(req, res));

  // Monitoring endpoints
  router.get("/api/monitor", (req, res) => monitorController.getMonitoringData(req, res));
  router.get("/api/monitor/:gameId", (req, res) => monitorController.getGameMonitoringData(req, res));

  return router;
}
