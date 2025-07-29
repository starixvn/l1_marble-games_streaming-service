import { JobScheduler } from "../../../src/services/job-scheduler";
import { mockContainer } from "../global-stubs";

describe("JobScheduler", () => {
  let jobScheduler: JobScheduler;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jobScheduler = new JobScheduler(mockContainer);
  });

  afterEach(() => {
    jest.useRealTimers();
    jobScheduler.stopAll();
  });

  describe("scheduleJob", () => {
    it("should schedule a job for future execution", async () => {
      const callback = jest.fn();
      const futureTime = new Date(Date.now() + 1000); // 1 second from now

      jobScheduler.scheduleJob("test-job", futureTime, callback);

      expect(jobScheduler.getRemainingJobs()).toContain("test-job");

      // Fast-forward time to trigger the job
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(jobScheduler.getRemainingJobs()).not.toContain("test-job");
    });

    it("should not schedule a job if time is in the past and force is false", () => {
      const callback = jest.fn();
      const pastTime = new Date(Date.now() - 1000); // 1 second ago

      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      jobScheduler.scheduleJob("past-job", pastTime, callback);

      expect(jobScheduler.getRemainingJobs()).not.toContain("past-job");
      expect(consoleSpy).toHaveBeenCalledWith("Scheduled time is in the past for job past-job");
      expect(callback).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should force execute a job even if time is in the past when force is true", async () => {
      const callback = jest.fn();
      const pastTime = new Date(Date.now() - 1000); // 1 second ago

      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      jobScheduler.scheduleJob("forced-job", pastTime, callback, true);

      expect(consoleSpy).toHaveBeenCalledWith("Scheduled time is late -1000ms for job forced-job, forcing it");
      expect(jobScheduler.getRemainingJobs()).toContain("forced-job");

      jest.advanceTimersByTime(0);
      await Promise.resolve();

      expect(callback).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });

    it("should cancel existing job when scheduling with the same name", async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const futureTime1 = new Date(Date.now() + 2000);
      const futureTime2 = new Date(Date.now() + 1000);

      // Schedule first job
      jobScheduler.scheduleJob("duplicate-job", futureTime1, callback1);
      expect(jobScheduler.getRemainingJobs()).toContain("duplicate-job");

      // Schedule second job with same name
      jobScheduler.scheduleJob("duplicate-job", futureTime2, callback2);
      expect(jobScheduler.getRemainingJobs()).toContain("duplicate-job");

      // Fast-forward time to trigger the second job
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it("should handle callback errors gracefully", async () => {
      const error = new Error("Job execution failed");
      const callback = jest.fn().mockRejectedValue(error);
      const futureTime = new Date(Date.now() + 100);

      jobScheduler.scheduleJob("error-job", futureTime, callback);

      // Fast-forward time to trigger the job
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(mockContainer.logService.logError).toHaveBeenCalledWith(
        "Job error-job failed: Error: Job execution failed"
      );
      expect(jobScheduler.getRemainingJobs()).not.toContain("error-job");
    });

    it("should handle multiple jobs with different schedules", async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();

      const time1 = new Date(Date.now() + 500);
      const time2 = new Date(Date.now() + 1000);
      const time3 = new Date(Date.now() + 1500);

      jobScheduler.scheduleJob("job-1", time1, callback1);
      jobScheduler.scheduleJob("job-2", time2, callback2);
      jobScheduler.scheduleJob("job-3", time3, callback3);

      expect(jobScheduler.getRemainingJobs()).toHaveLength(3);
      expect(jobScheduler.getRemainingJobs()).toContain("job-1");
      expect(jobScheduler.getRemainingJobs()).toContain("job-2");
      expect(jobScheduler.getRemainingJobs()).toContain("job-3");

      // Fast-forward to trigger job-1
      jest.advanceTimersByTime(500);
      await Promise.resolve();

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).not.toHaveBeenCalled();

      // Fast-forward to trigger job-2
      jest.advanceTimersByTime(500);
      await Promise.resolve();

      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).not.toHaveBeenCalled();

      // Fast-forward to trigger job-3
      jest.advanceTimersByTime(500);
      await Promise.resolve();

      expect(callback3).toHaveBeenCalledTimes(1);

      expect(jobScheduler.getRemainingJobs()).toHaveLength(0);
    });
  });

  describe("cancelJob", () => {
    it("should cancel a scheduled job", () => {
      const callback = jest.fn();
      const futureTime = new Date(Date.now() + 1000);

      jobScheduler.scheduleJob("cancel-test", futureTime, callback);
      expect(jobScheduler.getRemainingJobs()).toContain("cancel-test");

      jobScheduler.cancelJob("cancel-test");
      expect(jobScheduler.getRemainingJobs()).not.toContain("cancel-test");

      // Fast-forward time to ensure job doesn't execute
      jest.advanceTimersByTime(1000);
      expect(callback).not.toHaveBeenCalled();
    });

    it("should handle canceling non-existent job gracefully", () => {
      expect(() => {
        jobScheduler.cancelJob("non-existent-job");
      }).not.toThrow();

      expect(jobScheduler.getRemainingJobs()).toHaveLength(0);
    });

    it("should cancel job and allow rescheduling with same name", async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const futureTime = new Date(Date.now() + 1000);

      jobScheduler.scheduleJob("reschedule-test", futureTime, callback1);
      jobScheduler.cancelJob("reschedule-test");

      // Reschedule with same name
      jobScheduler.scheduleJob("reschedule-test", futureTime, callback2);

      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe("stopAll", () => {
    it("should cancel all scheduled jobs", () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();

      const futureTime = new Date(Date.now() + 1000);

      jobScheduler.scheduleJob("job-1", futureTime, callback1);
      jobScheduler.scheduleJob("job-2", futureTime, callback2);
      jobScheduler.scheduleJob("job-3", futureTime, callback3);

      expect(jobScheduler.getRemainingJobs()).toHaveLength(3);

      jobScheduler.stopAll();

      expect(jobScheduler.getRemainingJobs()).toHaveLength(0);

      // Fast-forward time to ensure no jobs execute
      jest.advanceTimersByTime(1000);
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).not.toHaveBeenCalled();
    });

    it("should handle stopAll when no jobs are scheduled", () => {
      expect(() => {
        jobScheduler.stopAll();
      }).not.toThrow();

      expect(jobScheduler.getRemainingJobs()).toHaveLength(0);
    });

    it("should clear jobs map after stopping all jobs", () => {
      const callback = jest.fn();
      const futureTime = new Date(Date.now() + 1000);

      jobScheduler.scheduleJob("test-job", futureTime, callback);
      expect(jobScheduler.getRemainingJobs()).toHaveLength(1);

      jobScheduler.stopAll();
      expect(jobScheduler.getRemainingJobs()).toHaveLength(0);

      // Verify the internal map is cleared
      const remainingJobs = jobScheduler.getRemainingJobs();
      expect(remainingJobs).toEqual([]);
    });
  });

  describe("getRemainingJobs", () => {
    it("should return empty array when no jobs are scheduled", () => {
      expect(jobScheduler.getRemainingJobs()).toEqual([]);
    });

    it("should return all scheduled job names", () => {
      const callback = jest.fn();
      const futureTime = new Date(Date.now() + 1000);

      jobScheduler.scheduleJob("job-1", futureTime, callback);
      jobScheduler.scheduleJob("job-2", futureTime, callback);
      jobScheduler.scheduleJob("job-3", futureTime, callback);

      const remainingJobs = jobScheduler.getRemainingJobs();
      expect(remainingJobs).toHaveLength(3);
      expect(remainingJobs).toContain("job-1");
      expect(remainingJobs).toContain("job-2");
      expect(remainingJobs).toContain("job-3");
    });

    it("should return updated list after job completion", async () => {
      const callback = jest.fn();
      const futureTime = new Date(Date.now() + 100);

      jobScheduler.scheduleJob("completion-test", futureTime, callback);
      expect(jobScheduler.getRemainingJobs()).toContain("completion-test");

      jest.advanceTimersByTime(100);
      await Promise.resolve();

      expect(jobScheduler.getRemainingJobs()).not.toContain("completion-test");
    });

    it("should return updated list after job cancellation", () => {
      const callback = jest.fn();
      const futureTime = new Date(Date.now() + 1000);

      jobScheduler.scheduleJob("cancel-test", futureTime, callback);
      expect(jobScheduler.getRemainingJobs()).toContain("cancel-test");

      jobScheduler.cancelJob("cancel-test");
      expect(jobScheduler.getRemainingJobs()).not.toContain("cancel-test");
    });
  });

  describe("edge cases and error scenarios", () => {
    it("should handle very short delays correctly", async () => {
      const callback = jest.fn();
      const veryShortTime = new Date(Date.now() + 1); // 1ms delay

      jobScheduler.scheduleJob("short-delay", veryShortTime, callback);

      jest.advanceTimersByTime(1);
      await Promise.resolve();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should handle callback that throws synchronous error", async () => {
      const error = new Error("Sync error");
      const callback = jest.fn().mockImplementation(() => {
        throw error;
      });
      const futureTime = new Date(Date.now() + 100);

      jobScheduler.scheduleJob("sync-error-job", futureTime, callback);

      jest.advanceTimersByTime(100);
      await Promise.resolve();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(mockContainer.logService.logError).toHaveBeenCalledWith("Job sync-error-job failed: Error: Sync error");
    });

    it("should handle callback that returns undefined", async () => {
      const callback = jest.fn().mockResolvedValue(undefined);
      const futureTime = new Date(Date.now() + 100);

      jobScheduler.scheduleJob("undefined-job", futureTime, callback);

      jest.advanceTimersByTime(100);
      await Promise.resolve();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should handle multiple rapid job cancellations", () => {
      const callback = jest.fn();
      const futureTime = new Date(Date.now() + 1000);

      jobScheduler.scheduleJob("rapid-cancel", futureTime, callback);

      // Cancel multiple times rapidly
      jobScheduler.cancelJob("rapid-cancel");
      jobScheduler.cancelJob("rapid-cancel");
      jobScheduler.cancelJob("rapid-cancel");

      expect(jobScheduler.getRemainingJobs()).not.toContain("rapid-cancel");
    });

    it("should handle jobs scheduled at exactly current time", async () => {
      const callback = jest.fn();
      const currentTime = new Date();

      jobScheduler.scheduleJob("current-time-job", currentTime, callback);

      // Fast-forward a small amount to ensure the job executes
      jest.advanceTimersByTime(1);
      await Promise.resolve();

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("memory management", () => {
    it("should not leak memory when jobs complete", async () => {
      const callback = jest.fn();
      const futureTime = new Date(Date.now() + 100);

      // Schedule and complete multiple jobs
      for (let i = 0; i < 10; i++) {
        jobScheduler.scheduleJob(`job-${i}`, futureTime, callback);
      }

      expect(jobScheduler.getRemainingJobs()).toHaveLength(10);

      jest.advanceTimersByTime(100);
      await Promise.resolve();

      expect(jobScheduler.getRemainingJobs()).toHaveLength(0);
      expect(callback).toHaveBeenCalledTimes(10);
    });

    it("should properly clean up timeouts when jobs are cancelled", () => {
      const callback = jest.fn();
      const futureTime = new Date(Date.now() + 1000);

      // Schedule multiple jobs
      for (let i = 0; i < 5; i++) {
        jobScheduler.scheduleJob(`cancel-job-${i}`, futureTime, callback);
      }

      expect(jobScheduler.getRemainingJobs()).toHaveLength(5);

      // Cancel all jobs
      for (let i = 0; i < 5; i++) {
        jobScheduler.cancelJob(`cancel-job-${i}`);
      }

      expect(jobScheduler.getRemainingJobs()).toHaveLength(0);

      // Fast-forward time to ensure no callbacks are executed
      jest.advanceTimersByTime(1000);
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
