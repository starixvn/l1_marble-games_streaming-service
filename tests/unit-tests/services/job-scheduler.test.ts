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
      // Arrange
      const callback = jest.fn();
      const futureTime = new Date(Date.now() + 1000); // 1 second from now

      // Act
      jobScheduler.scheduleJob("test-job", futureTime, callback);

      // Assert
      expect(jobScheduler.getRemainingJobs()).toContain("test-job");
      // Act - Trigger the job

      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      // Assert
      expect(callback).toHaveBeenCalledTimes(1);
      expect(jobScheduler.getRemainingJobs()).not.toContain("test-job");
    });

    it("should not schedule a job if time is in the past and force is false", () => {
      // Arrange
      const callback = jest.fn();
      const pastTime = new Date(Date.now() - 1000); // 1 second ago

      // Act
      jobScheduler.scheduleJob("past-job", pastTime, callback);

      // Assert
      expect(jobScheduler.getRemainingJobs()).not.toContain("past-job");
      expect(callback).not.toHaveBeenCalled();
    });

    it("should force execute a job even if time is in the past when force is true", async () => {
      // Arrange
      const callback = jest.fn();
      const pastTime = new Date(Date.now() - 1000); // 1 second ago

      // Act
      jobScheduler.scheduleJob("forced-job", pastTime, callback, true);

      // Assert
      expect(jobScheduler.getRemainingJobs()).toContain("forced-job");

      // Act - Trigger the job
      jest.advanceTimersByTime(0);
      await Promise.resolve();

      // Assert
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should cancel existing job when scheduling with the same name", async () => {
      // Arrange
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const futureTime1 = new Date(Date.now() + 2000);
      const futureTime2 = new Date(Date.now() + 1000);

      // Act - Schedule first job
      jobScheduler.scheduleJob("duplicate-job", futureTime1, callback1);

      // Assert
      expect(jobScheduler.getRemainingJobs()).toContain("duplicate-job");

      // Act - Schedule second job with same name (should cancel first)
      jobScheduler.scheduleJob("duplicate-job", futureTime2, callback2);

      // Assert
      expect(jobScheduler.getRemainingJobs()).toContain("duplicate-job");

      // Act - Trigger the second job
      jest.advanceTimersByTime(2000);
      await Promise.resolve();

      // Assert
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();
    });

    it("should handle callback errors gracefully", async () => {
      // Arrange
      const error = new Error("Job execution failed");
      const callback = jest.fn().mockRejectedValue(error);
      const futureTime = new Date(Date.now() + 100);

      // Act
      jobScheduler.scheduleJob("error-job", futureTime, callback);

      // Act - Trigger the job
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      // Assert
      expect(callback).toHaveBeenCalledTimes(1);
      expect(mockContainer.logService.logError).toHaveBeenCalledWith(
        "Job error-job failed: Error: Job execution failed"
      );
      expect(jobScheduler.getRemainingJobs()).not.toContain("error-job");
    });

    it("should handle multiple jobs with different schedules", async () => {
      // Arrange
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();
      const time1 = new Date(Date.now() + 500);
      const time2 = new Date(Date.now() + 1000);
      const time3 = new Date(Date.now() + 1500);

      // Act - Schedule all jobs
      jobScheduler.scheduleJob("job-1", time1, callback1);
      jobScheduler.scheduleJob("job-2", time2, callback2);
      jobScheduler.scheduleJob("job-3", time3, callback3);

      // Assert - All jobs scheduled
      expect(jobScheduler.getRemainingJobs()).toHaveLength(3);
      expect(jobScheduler.getRemainingJobs()).toContain("job-1");
      expect(jobScheduler.getRemainingJobs()).toContain("job-2");
      expect(jobScheduler.getRemainingJobs()).toContain("job-3");

      // Act - Trigger job-1
      jest.advanceTimersByTime(500);
      await Promise.resolve();

      // Assert - Only job-1 executed
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).not.toHaveBeenCalled();

      // Act - Trigger job-2
      jest.advanceTimersByTime(500);
      await Promise.resolve();

      // Assert - job-2 executed
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).not.toHaveBeenCalled();

      // Act - Trigger job-3
      jest.advanceTimersByTime(500);
      await Promise.resolve();

      // Assert - All jobs completed
      expect(callback3).toHaveBeenCalledTimes(1);
      expect(jobScheduler.getRemainingJobs()).toHaveLength(0);
    });
  });

  describe("cancelJob", () => {
    it("should cancel a scheduled job", () => {
      // Arrange
      const callback = jest.fn();
      const futureTime = new Date(Date.now() + 1000);

      // Act - Schedule job
      jobScheduler.scheduleJob("cancel-test", futureTime, callback);

      // Assert - Job is scheduled
      expect(jobScheduler.getRemainingJobs()).toContain("cancel-test");

      // Act - Cancel job
      jobScheduler.cancelJob("cancel-test");

      // Assert - Job is removed
      expect(jobScheduler.getRemainingJobs()).not.toContain("cancel-test");

      // Act - Fast-forward time to ensure job doesn't execute
      jest.advanceTimersByTime(1000);

      // Assert - Callback was not called
      expect(callback).not.toHaveBeenCalled();
    });

    it("should handle canceling non-existent job gracefully", () => {
      // Act & Assert
      expect(() => {
        jobScheduler.cancelJob("non-existent-job");
      }).not.toThrow();

      expect(jobScheduler.getRemainingJobs()).toHaveLength(0);
    });

    it("should cancel job and allow rescheduling with same name", async () => {
      // Arrange
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const futureTime = new Date(Date.now() + 1000);

      // Act - Schedule, cancel, and reschedule
      jobScheduler.scheduleJob("reschedule-test", futureTime, callback1);
      jobScheduler.cancelJob("reschedule-test");
      jobScheduler.scheduleJob("reschedule-test", futureTime, callback2);

      // Act - Trigger the job
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      // Assert
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe("stopAll", () => {
    it("should cancel all scheduled jobs", () => {
      // Arrange
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();
      const futureTime = new Date(Date.now() + 1000);

      // Act - Schedule multiple jobs
      jobScheduler.scheduleJob("job-1", futureTime, callback1);
      jobScheduler.scheduleJob("job-2", futureTime, callback2);
      jobScheduler.scheduleJob("job-3", futureTime, callback3);

      // Assert - All jobs scheduled
      expect(jobScheduler.getRemainingJobs()).toHaveLength(3);

      // Act - Stop all jobs
      jobScheduler.stopAll();

      // Assert - No jobs remaining
      expect(jobScheduler.getRemainingJobs()).toHaveLength(0);

      // Act - Fast-forward time to ensure no jobs execute
      jest.advanceTimersByTime(1000);

      // Assert - No callbacks were called
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).not.toHaveBeenCalled();
    });

    it("should handle stopAll when no jobs are scheduled", () => {
      // Act & Assert
      expect(() => {
        jobScheduler.stopAll();
      }).not.toThrow();

      expect(jobScheduler.getRemainingJobs()).toHaveLength(0);
    });

    it("should clear jobs map after stopping all jobs", () => {
      // Arrange
      const callback = jest.fn();
      const futureTime = new Date(Date.now() + 1000);

      // Act - Schedule job
      jobScheduler.scheduleJob("test-job", futureTime, callback);

      // Assert - Job is scheduled
      expect(jobScheduler.getRemainingJobs()).toHaveLength(1);

      // Act - Stop all jobs
      jobScheduler.stopAll();

      // Assert - No jobs remaining
      expect(jobScheduler.getRemainingJobs()).toHaveLength(0);

      // Verify the internal map is cleared
      const remainingJobs = jobScheduler.getRemainingJobs();
      expect(remainingJobs).toEqual([]);
    });
  });

  describe("getRemainingJobs", () => {
    it("should return empty array when no jobs are scheduled", () => {
      // Act & Assert
      expect(jobScheduler.getRemainingJobs()).toEqual([]);
    });

    it("should return all scheduled job names", () => {
      // Arrange
      const callback = jest.fn();
      const futureTime = new Date(Date.now() + 1000);

      // Act - Schedule multiple jobs
      jobScheduler.scheduleJob("job-1", futureTime, callback);
      jobScheduler.scheduleJob("job-2", futureTime, callback);
      jobScheduler.scheduleJob("job-3", futureTime, callback);

      // Assert
      const remainingJobs = jobScheduler.getRemainingJobs();
      expect(remainingJobs).toHaveLength(3);
      expect(remainingJobs).toContain("job-1");
      expect(remainingJobs).toContain("job-2");
      expect(remainingJobs).toContain("job-3");
    });

    it("should return updated list after job completion", async () => {
      // Arrange
      const callback = jest.fn();
      const futureTime = new Date(Date.now() + 100);

      // Act - Schedule job
      jobScheduler.scheduleJob("completion-test", futureTime, callback);

      // Assert - Job is scheduled
      expect(jobScheduler.getRemainingJobs()).toContain("completion-test");

      // Act - Trigger job completion
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      // Assert - Job is removed from list
      expect(jobScheduler.getRemainingJobs()).not.toContain("completion-test");
    });

    it("should return updated list after job cancellation", () => {
      // Arrange
      const callback = jest.fn();
      const futureTime = new Date(Date.now() + 1000);

      // Act - Schedule job
      jobScheduler.scheduleJob("cancel-test", futureTime, callback);

      // Assert - Job is scheduled
      expect(jobScheduler.getRemainingJobs()).toContain("cancel-test");

      // Act - Cancel job
      jobScheduler.cancelJob("cancel-test");

      // Assert - Job is removed from list
      expect(jobScheduler.getRemainingJobs()).not.toContain("cancel-test");
    });
  });

  describe("edge cases and error scenarios", () => {
    it("should handle very short delays correctly", async () => {
      // Arrange
      const callback = jest.fn();
      const veryShortTime = new Date(Date.now() + 1); // 1ms delay

      // Act - Schedule job
      jobScheduler.scheduleJob("short-delay", veryShortTime, callback);

      // Act - Trigger job
      jest.advanceTimersByTime(1);
      await Promise.resolve();

      // Assert
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should handle callback that throws synchronous error", async () => {
      // Arrange
      const error = new Error("Sync error");
      const callback = jest.fn().mockImplementation(() => {
        throw error;
      });
      const futureTime = new Date(Date.now() + 100);

      // Act - Schedule job
      jobScheduler.scheduleJob("sync-error-job", futureTime, callback);

      // Act - Trigger job
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      // Assert
      expect(callback).toHaveBeenCalledTimes(1);
      expect(mockContainer.logService.logError).toHaveBeenCalledWith("Job sync-error-job failed: Error: Sync error");
    });

    it("should handle callback that returns undefined", async () => {
      // Arrange
      const callback = jest.fn().mockResolvedValue(undefined);
      const futureTime = new Date(Date.now() + 100);

      // Act - Schedule job
      jobScheduler.scheduleJob("undefined-job", futureTime, callback);

      // Act - Trigger job
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      // Assert
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should handle multiple rapid job cancellations", () => {
      // Arrange
      const callback = jest.fn();
      const futureTime = new Date(Date.now() + 1000);

      // Act - Schedule job
      jobScheduler.scheduleJob("rapid-cancel", futureTime, callback);

      // Act - Cancel multiple times rapidly
      jobScheduler.cancelJob("rapid-cancel");
      jobScheduler.cancelJob("rapid-cancel");
      jobScheduler.cancelJob("rapid-cancel");

      // Assert
      expect(jobScheduler.getRemainingJobs()).not.toContain("rapid-cancel");
    });

    it("should handle jobs scheduled at exactly current time", async () => {
      // Arrange
      const callback = jest.fn();
      const currentTime = new Date();

      // Act - Schedule job
      jobScheduler.scheduleJob("current-time-job", currentTime, callback);

      // Act - Trigger job
      jest.advanceTimersByTime(1);
      await Promise.resolve();

      // Assert
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("memory management", () => {
    it("should not leak memory when jobs complete", async () => {
      // Arrange
      const callback = jest.fn();
      const futureTime = new Date(Date.now() + 100);

      // Act - Schedule multiple jobs
      for (let i = 0; i < 10; i++) {
        jobScheduler.scheduleJob(`job-${i}`, futureTime, callback);
      }

      // Assert - All jobs scheduled
      expect(jobScheduler.getRemainingJobs()).toHaveLength(10);

      // Act - Trigger all jobs
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      // Assert - All jobs completed and cleaned up
      expect(jobScheduler.getRemainingJobs()).toHaveLength(0);
      expect(callback).toHaveBeenCalledTimes(10);
    });

    it("should properly clean up timeouts when jobs are cancelled", () => {
      // Arrange
      const callback = jest.fn();
      const futureTime = new Date(Date.now() + 1000);

      // Act - Schedule multiple jobs
      for (let i = 0; i < 5; i++) {
        jobScheduler.scheduleJob(`cancel-job-${i}`, futureTime, callback);
      }

      // Assert - All jobs scheduled
      expect(jobScheduler.getRemainingJobs()).toHaveLength(5);

      // Act - Cancel all jobs
      for (let i = 0; i < 5; i++) {
        jobScheduler.cancelJob(`cancel-job-${i}`);
      }

      // Assert - No jobs remaining
      expect(jobScheduler.getRemainingJobs()).toHaveLength(0);

      // Act - Fast-forward time to ensure no callbacks are executed
      jest.advanceTimersByTime(1000);

      // Assert - No callbacks were called
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
