import { logger } from "sc-common";
import { AppContainer } from "../types";

export type JobHandle = {
  timeoutId: NodeJS.Timeout;
  name: string;
};

export class JobScheduler {
  private readonly jobs: Map<string, JobHandle> = new Map();
  private jobsCompleted: Array<string> = [];
  private readonly logService: typeof logger;

  constructor(container: AppContainer) {
    this.logService = container.logService;
  }

  scheduleJob(name: string, time: Date, callback: () => Promise<void>, force = false) {
    const delay = time.getTime() - Date.now();

    if (delay < 0 && !force) {
      this.log(`Scheduled time is in the past for job ${name}`);
      return;
    }

    if (this.jobs.has(name)) {
      this.log(`Job already exists, ignoring it: ${name}`);
      return;
    }

    if (delay < 0 && force) {
      this.logService.log(`Scheduled time is late ${delay}ms for job ${name}, forcing it`, "debug");
    }

    const timeoutId = setTimeout(async () => {
      try {
        await callback();
      } catch (error) {
        this.logService.logError(`Job ${name} failed: ${error}`);
      } finally {
        this.addJobCompleted(name);
        this.jobs.delete(name);
      }
    }, delay);

    this.jobs.set(name, { name, timeoutId });
  }

  cancelJob(name: string) {
    const job = this.jobs.get(name);
    if (job) {
      clearTimeout(job.timeoutId);
      this.jobs.delete(name);
    }
  }

  stopAll() {
    for (const job of this.jobs.values()) {
      clearTimeout(job.timeoutId);
    }
    this.jobs.clear();
  }

  addJobCompleted(name: string) {
    if (this.jobsCompleted.length >= 100) {
      console.log(`Jobs completed: ${this.jobsCompleted.join("\n")}`);
      this.logService.log(`Jobs completed: ${this.jobsCompleted.length}`, "debug");
      this.jobsCompleted = [];
    }

    this.jobsCompleted.push(name);
  }

  getRemainingJobs(): string[] {
    return Array.from(this.jobs.keys());
  }

  private log(message: string) {
    // console.log(`\x1b[32m [JobScheduler] \x1b[37m: ${message}`);
  }
}
