import { Request, Response } from "express";
import { AppContainer } from "../types";
import { EventManagementService } from "../services/event-management-service";
import { ClientManager } from "../managers/client-manager";

export class MonitorController {
  private readonly eventManagementService: EventManagementService;
  private readonly clientManager: ClientManager;

  constructor(container: AppContainer) {
    this.eventManagementService = container.eventManagementService;
    this.clientManager = container.clientManager;
  }

  public async getMonitoringData(req: Request, res: Response): Promise<void> {
    try {
      const allRemainingJobs = this.eventManagementService.getRemainingJobs();

      // Group jobs by game
      const jobsByGame = allRemainingJobs.reduce((acc: Record<string, string[]>, job) => {
        const gameId = this.extractGameIdFromJob(job);
        if (!acc[gameId]) {
          acc[gameId] = [];
        }
        acc[gameId].push(job);
        return acc;
      }, {});

      const totalClients = this.clientManager.getTotalClientCount();

      // Get client count for each game
      const clientsByGame = this.clientManager.getConnectionStats();

      const monitoringData = {
        jobs: {
          total: allRemainingJobs.length,
          details: Object.entries(jobsByGame).map(([gameId, jobs]) => ({
            gameId,
            numberOfJobs: jobs.length,
          })),
        },
        clients: {
          total: totalClients,
          details: clientsByGame,
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(monitoringData);
    } catch (error) {
      res.status(500).json({
        error: "Failed to get monitoring data",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }

  public async getGameMonitoringData(req: Request, res: Response): Promise<void> {
    try {
      const gameId = req.params.gameId;

      if (!gameId) {
        res.status(400).json({ error: "Game ID is required" });
        return;
      }

      const gameRemainingJobs = this.eventManagementService.getRemainingJobsForGame(gameId);
      const gameClientCount = this.clientManager.getClientCount(gameId);

      const gameMonitoringData = {
        gameId,
        jobs: {
          total: gameRemainingJobs.length,
          details: gameRemainingJobs,
        },
        clients: {
          total: gameClientCount,
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(gameMonitoringData);
    } catch (error) {
      res.status(500).json({
        error: "Failed to get game monitoring data",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }

  private extractGameIdFromJob(jobName: string): string {
    return jobName.split("_")[0] || "unknown";
  }
}
