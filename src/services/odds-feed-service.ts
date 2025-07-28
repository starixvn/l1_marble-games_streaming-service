import { appConfigs } from "../app-configs";
import { retry } from "../helpers/retry-helper";
import { AppContainer, Event, EventValidator, GoalInfoData } from "../types";
import { logger } from "sc-common";

export class OddsFeedService {
  private readonly logService: typeof logger;
  private token = "";

  constructor(container: AppContainer) {
    this.logService = container.logService;
  }

  async getAndUpdateOddsFeedToken() {
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

  private async getSchedule(): Promise<Event[]> {
    const token = this.token || (await this.getAndUpdateOddsFeedToken());
    const response = await fetch(`${appConfigs.oddsFeedAPI.url}/api/schedule`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      await this.getAndUpdateOddsFeedToken();
      throw new Error("Unauthorized! Invalid token, attempt retry...");
    }

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

  private async getEventDetails(eventId: number, validator: EventValidator): Promise<Event | null> {
    const token = this.token || (await this.getAndUpdateOddsFeedToken());

    const response = await fetch(`${appConfigs.oddsFeedAPI.url}/api/events?eventID=${eventId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      await this.getAndUpdateOddsFeedToken();
      throw new Error("Unauthorized! Invalid token, attempt retry...");
    }

    if (response.status !== 200) {
      throw new Error(`Failed to get event details: ${response.status}`);
    }

    const data = await response.json();

    if (!validator(data)) {
      this.logService.logError(`Error missing data for event ${eventId}, attempt retry...`);
      throw new Error(`Invalid event details: ${eventId}`);
    }

    return data;
  }

  async getEventDetailsWithRetry(eventId: number, validator: EventValidator = () => true): Promise<Event | null> {
    try {
      return await retry(() => this.getEventDetails(eventId, validator));
    } catch (error) {
      this.logService.logError(`Failed to get event details of event ${eventId} with error: ${error}`);
      return null;
    }
  }

  async getGoalInfo(url: string): Promise<GoalInfoData | null> {
    try {
      const response = await retry(() => fetch(url));

      return await response.json();
    } catch (error) {
      this.logService.logError(`Failed to get goal info: ${error}`);
      return null;
    }
  }
}
