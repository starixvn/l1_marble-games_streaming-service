import { Request, Response } from "express";
import { AuthenticateService } from "../services/authenticate-service";
import { AppContainer } from "../types";

export class AuthController {
  private readonly authenticateService: AuthenticateService;

  constructor(container: AppContainer) {
    this.authenticateService = container.authenticateService;
  }

  public async login(req: Request, res: Response): Promise<void> {
    try {
      const { operatorId, password } = req.body;

      const token = await this.authenticateService.getAuthenticatedToken(operatorId, password);
      res.json({ token });
    } catch (error) {
      res.status(401).json({ error: error instanceof Error ? error.message : "Authentication failed" });
    }
  }
}
