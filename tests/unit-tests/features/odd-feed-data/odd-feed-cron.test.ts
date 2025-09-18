import { OddFeedCron } from "../../../../src/features/odd-feed-data/odd-feed-cron";
import { Event } from "../../../../src/types";

// Mock dependencies
jest.mock("cron", () => ({
  CronJob: jest.fn().mockImplementation((expression, callback, onComplete) => ({
    start: jest.fn(),
  })),
}));

jest.mock("sc-common", () => ({
  logger: {
    logError: jest.fn(),
  },
}));

// Simple test data
const mockEvent: Event = {
  eventID: 1001,
  eventNameAKey: "Team A",
  eventNameBKey: "Team B",
  scheduleStartTs: "2024-01-01T10:00:00Z",
  productCode: "SPORT",
  productTypeKey: "FOOTBALL",
  eventDetails: [
    {
      eventID: 1001,
      oddsAvailableTs: "2024-01-01T10:00:00Z",
      scheduleStartTs: "2024-01-01T10:00:30Z",
      resultsAvailableTs: "2024-01-01T10:01:00Z",
      hasResults: true,
      goalInfo: "goal-info-1",
      playlist: "playlist1",
      result: "1-0",
      markets: [],
      inGameEventInfo: "info-1",
      phase: 0
    },
  ],
};

describe("OddFeedCron", () => {
  let oddFeedCron: OddFeedCron;
  let mockOddFeedPullService: any;
  let mockOddFeedScheduler: any;
  let mockLogService: any;
  let mockCronJob: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOddFeedPullService = {
      pullUpcoming: jest.fn(),
      pullEventWithEventDetails: jest.fn(),
    };

    mockOddFeedScheduler = {
      scheduleEvent: jest.fn(),
    };

    mockLogService = {
      logError: jest.fn(),
    };

    mockCronJob = {
      start: jest.fn(),
    };
    
    const cron = require("cron");
    cron.CronJob.mockImplementation(() => mockCronJob);

    oddFeedCron = new OddFeedCron({
      logService: mockLogService,
      oddFeedPullService: mockOddFeedPullService,
      oddFeedScheduler: mockOddFeedScheduler,
    } as any);
  });

  describe("start", () => {
    it("should call schedule and scheduleNextEventsCron", async () => {
      // Arrange
      const scheduleSpy = jest.spyOn(oddFeedCron, "schedule").mockResolvedValue();
      const scheduleNextEventsCronSpy = jest.spyOn(oddFeedCron, "scheduleNextEventsCron").mockImplementation();

      // Act
      await oddFeedCron.start();

      // Assert
      expect(scheduleSpy).toHaveBeenCalledTimes(1);
      expect(scheduleNextEventsCronSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("scheduleNextEventsCron", () => {
    it("should create and start cron job with correct expression", () => {
      // Arrange
      const cron = require("cron");

      // Act
      oddFeedCron.scheduleNextEventsCron();

      // Assert
      expect(cron.CronJob).toHaveBeenCalledWith(
        "*/30 * * * * *",
        expect.any(Function),
        expect.any(Function)
      );
      expect(mockCronJob.start).toHaveBeenCalledTimes(1);
    });

    it("should execute schedule in cron callback", async () => {
      // Arrange
      const cron = require("cron");
      const scheduleSpy = jest.spyOn(oddFeedCron, "schedule").mockResolvedValue();
      let cronCallback: Function | undefined;

      cron.CronJob.mockImplementation((expression: any, callback: any) => {
        cronCallback = callback;
        return mockCronJob;
      });

      // Act
      oddFeedCron.scheduleNextEventsCron();
      if (cronCallback) {
        await cronCallback();
      }

      // Assert
      expect(scheduleSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle cron job restart on completion", () => {
      // Arrange
      const cron = require("cron");
      let onCompleteCallback: Function | undefined;

      cron.CronJob.mockImplementation((expression: any, callback: any, onComplete: any) => {
        onCompleteCallback = onComplete;
        return mockCronJob;
      });

      // Act
      oddFeedCron.scheduleNextEventsCron();
      if (onCompleteCallback) {
        onCompleteCallback();
      }

      // Assert
      expect(mockLogService.logError).toHaveBeenCalledWith(
        "Cron job unexpectedly stopped because some other tasks halt it."
      );
      expect(mockCronJob.start).toHaveBeenCalledTimes(2);
    });
  });

  describe("schedule", () => {
    it("should pull upcoming events and schedule each with details", async () => {
      // Arrange
      const upcomingEvents = [mockEvent, { ...mockEvent, eventID: 1002 }];
      const eventWithDetails = { ...mockEvent, eventDetails: mockEvent.eventDetails };

      mockOddFeedPullService.pullUpcoming.mockResolvedValue(upcomingEvents);
      mockOddFeedPullService.pullEventWithEventDetails.mockResolvedValue(eventWithDetails);

      // Act
      await oddFeedCron.schedule();

      // Assert
      expect(mockOddFeedPullService.pullUpcoming).toHaveBeenCalledTimes(1);
      expect(mockOddFeedPullService.pullEventWithEventDetails).toHaveBeenCalledTimes(2);
      expect(mockOddFeedPullService.pullEventWithEventDetails).toHaveBeenCalledWith(1001);
      expect(mockOddFeedPullService.pullEventWithEventDetails).toHaveBeenCalledWith(1002);
    });

    it("should handle empty upcoming events", async () => {
      // Arrange
      mockOddFeedPullService.pullUpcoming.mockResolvedValue([]);

      // Act
      await oddFeedCron.schedule();

      // Assert
      expect(mockOddFeedPullService.pullUpcoming).toHaveBeenCalledTimes(1);
      expect(mockOddFeedPullService.pullEventWithEventDetails).not.toHaveBeenCalled();
      expect(mockOddFeedScheduler.scheduleEvent).not.toHaveBeenCalled();
    });

    it("should skip events when pullEventWithEventDetails returns null", async () => {
      // Arrange
      mockOddFeedPullService.pullUpcoming.mockResolvedValue([mockEvent]);
      mockOddFeedPullService.pullEventWithEventDetails.mockResolvedValue(null);

      // Act
      await oddFeedCron.schedule();

      // Assert
      expect(mockOddFeedPullService.pullUpcoming).toHaveBeenCalledTimes(1);
      expect(mockOddFeedPullService.pullEventWithEventDetails).toHaveBeenCalledWith(1001);
      expect(mockOddFeedScheduler.scheduleEvent).not.toHaveBeenCalled();
    });

    it("should call scheduleEvent for valid events", async () => {
      // Arrange
      const eventWithDetails = { ...mockEvent };
      mockOddFeedPullService.pullUpcoming.mockResolvedValue([mockEvent]);
      mockOddFeedPullService.pullEventWithEventDetails.mockResolvedValue(eventWithDetails);

      // Act
      await oddFeedCron.schedule();
      await new Promise(resolve => setTimeout(resolve, 0)); // Wait for forEach

      // Assert
      expect(mockOddFeedScheduler.scheduleEvent).toHaveBeenCalledWith(eventWithDetails);
    });
  });
});