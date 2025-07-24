import { appConfigs } from "../app-configs";
import { retry } from "../helpers/retry-helper";
import { Event } from "../types";
import { logger } from "sc-common";

export class OddsFeedService {
  private readonly logService: typeof logger;

  constructor(logService: typeof logger) {
    this.logService = logService;
  }

  private token = "";

  async getOddsFeedToken() {
    const response = await fetch(`${appConfigs.oddsFeedAPI.url}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        operatorId: appConfigs.oddsFeedAPI.operatorId,
        password: appConfigs.oddsFeedAPI.password,
      }),
    });

    const data = await response.json();
    this.token = data.access_token;
    return this.token;
  }

  private async getSchedule() {
    const token = this.token || (await this.getOddsFeedToken());
    const response = await fetch(`${appConfigs.oddsFeedAPI.url}/api/schedule`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status !== 200) {
      throw new Error(`Failed to get schedule: ${response.status}`);
    }

    const data = await response.json();

    return data;
  }

  async getScheduleWithRetry(): Promise<Event[]> {
    try {
      return await retry(() => this.getSchedule());
    } catch (error) {
      this.logService.logError(`Failed to get schedule: ${error}`);
      return [];
    }
  }

  private async getEventDetails(eventId: number): Promise<Event | null> {
    const token = this.token || (await this.getOddsFeedToken());

    const response = await fetch(`${appConfigs.oddsFeedAPI.url}/api/events?eventID=${eventId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status !== 200) {
      throw new Error(`Failed to get event details: ${response.status}`);
    }

    const data = await response.json();
    return data;
  }

  async getEventDetailsWithRetry(eventId: number): Promise<Event | null> {
    try {
      return await retry(() => this.getEventDetails(eventId));
    } catch (error) {
      this.logService.logError(`Failed to get event details: ${error}`);
      return null;
    }
  }
}
