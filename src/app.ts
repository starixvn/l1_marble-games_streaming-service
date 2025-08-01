import express from "express";
import { appConfigs } from "./app-configs";
import { Configuration } from "./configuration";
import { setupRoutes } from "./routes";
import { ContainerRegistry } from "./container-registry";
import cors from "cors";

const run = async () => {
  const configuration = new Configuration();
  await configuration.configureDatabaseAndSentry(appConfigs);
  const container = new ContainerRegistry().register();
  const eventManagementService = container.resolve("eventManagementService");
  const clientManager = container.resolve("clientManager");

  await eventManagementService.start();
  const app = express();
  app.use(express.json());
  app.use(cors());
  app.set("port", appConfigs.hostingPort);
  app.set("trust proxy", 1);

  app.use(setupRoutes(container));

  const server = app.listen(appConfigs.hostingPort, () => {
    console.log(`Live Streaming server running at http://localhost:${appConfigs.hostingPort}`);
  });

  // Graceful shutdown
  const gracefulShutdown = (signal: string) => {
    console.log(`Received ${signal}. Starting graceful shutdown...`);

    // Clean up broadcast jobs
    eventManagementService.cleanup();

    clientManager.destroy();

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
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
};

run().catch((error) => {
  console.error("App running error:", error);
  process.exit(1);
});
