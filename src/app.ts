import express from "express";
import { appConfigs } from "./app-configs";
import { Configuration } from "./configuration";
import { setupRoutes, RouteContainer } from "./routes";
import { ContainerRegistry } from "./container-registry";
import { corsMiddleware } from "./middlewares/cors";
import { errorHandler } from "./middlewares/error-handler";
import path from "path";
import { AwilixContainer } from "awilix";

const run = async () => {
  const configuration = new Configuration();
  await configuration.configureDatabaseAndSentry(appConfigs);
  const containerRegistry = new ContainerRegistry();
  const container = containerRegistry.register();
  containerRegistry.init();
  const app = express();
  app.use(express.static(path.join(process.cwd(), "public")));
  app.use(express.json());
  app.use(corsMiddleware);
  app.set("port", appConfigs.hostingPort);
  app.set("trust proxy", 1);

  app.use(setupRoutes(container as unknown as AwilixContainer<RouteContainer>));

  // Error handling middleware (must be last)
  app.use(errorHandler);

  const server = app.listen(appConfigs.hostingPort, () => {
    console.log(`Live Streaming server running at http://localhost:${appConfigs.hostingPort}`);
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    console.log(`Received ${signal}. Starting graceful shutdown...`);

    await container.dispose();

    server.close(() => {
      console.log("HTTP server closed");
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      console.error("Could not close connections in time, forcefully shutting down");
      process.exit(1);
    }, 10000);
  };

  // Handle shutdown signals
  process.on("SIGTERM", async () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", async () => gracefulShutdown("SIGINT"));
};

run().catch((error) => {
  console.error("App running error:", error);
  process.exit(1);
});
