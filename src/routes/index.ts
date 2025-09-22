import { Router } from "express";
import { AppContainer } from "../types";
import { AwilixContainer } from "awilix";

export function setupRoutes(container: AwilixContainer<AppContainer>): Router {
  const router = Router();
  const eventStreamController = container.resolve("eventStreamController");
  const healthController = container.resolve("healthController");
  const authController = container.resolve("authController");

  router.get("/", (req, res) => healthController.healthCheck(req, res));

  router.post("/api/token", (req, res) => authController.login(req, res));

  router.get("/live/:gameId", (req, res) => eventStreamController.handleEventStreamConnection(req, res));


  return router;
}
