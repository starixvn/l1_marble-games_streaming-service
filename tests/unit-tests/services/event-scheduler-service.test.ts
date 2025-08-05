import { EventSchedulerService } from "../../../src/services/event-scheduler-service";
import { mockContainer } from "../global-stubs";
import { appSettings } from "../../../src/app-settings";
import { Event, EventDetail, JobName, GoalInfoData } from "../../../src/types";
import { idHelper } from "../../../src/helpers";

// Mock dependencies
jest.mock("../../../src/app-settings");
jest.mock("../../../src/helpers");
jest.mock("sc-common", () => ({
  logger: {
    logError: jest.fn(),
  },
}));

// Test data factories
const createMockEventDetail = (eventId: number = 1, index: number = 0): EventDetail => ({
  eventID: eventId,
  oddsAvailableTs: "2024-01-01T10:00:00Z",
  scheduleStartTs: "2024-01-01T10:00:30Z",
  resultsAvailableTs: "2024-01-01T10:01:00Z",
  hasResults: true,
  goalInfo: "goal-info-1",
  playlist: "playlist1",
  result: "1-0",
  markets: [{ id: 1, name: "market1" }],
});

const createMockEvent = (eventId: number = 1, name: string = "Test Event"): Event => ({
  eventID: eventId,
  eventNameAKey: `${name} Home`,
  eventNameBKey: `${name} Away`,
  theme: "football",
  scheduleStartTs: "2024-01-01T10:00:00Z",
  productCode: "SPORT",
  productTypeKey: "FOOTBALL",
  eventDetails: [createMockEventDetail(eventId, 0), createMockEventDetail(eventId, 1)],
});

const createMockGoalInfo = (): GoalInfoData => ({
  frame: [1, 2, 3],
  timeLine: [10, 20, 30],
  result: ["goal", "assist", "save"],
});

describe("EventSchedulerService", () => {
  let eventSchedulerService: EventSchedulerService;
  let mockJobScheduler: any;
  let mockOddsFeedService: any;
  let mockEventStreamService: any;
  let mockEventManager: any;
  let mockLogService: any;
  let mockIdHelper: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create proper Jest mocks
    mockJobScheduler = {
      scheduleJob: jest.fn(),
    };
    mockOddsFeedService = {
      getEventDetailsWithRetry: jest.fn(),
      getGoalInfo: jest.fn(),
    };
    mockEventStreamService = {
      broadcastUpdateEventDataToClients: jest.fn(),
    };
    mockEventManager = {
      initializeCurrentEvent: jest.fn(),
      getCurrentEventForGame: jest.fn(),
      updateGoalInfo: jest.fn(),
      updateLiveScore: jest.fn(),
      incrementCurrentEventDetailIndex: jest.fn(),
      updateCurrentEventDetail: jest.fn(),
    };
    mockLogService = {
      logError: jest.fn(),
    };
    mockIdHelper = {
      extractGameId: jest.fn(),
    };

    // Replace the auto-stubbed methods with Jest mocks
    mockContainer.jobScheduler = mockJobScheduler;
    mockContainer.oddsFeedService = mockOddsFeedService;
    mockContainer.eventStreamService = mockEventStreamService;
    mockContainer.eventManager = mockEventManager;
    mockContainer.logService = mockLogService;

    // Mock helpers
    (idHelper as any) = mockIdHelper;

    // Mock appSettings
    (appSettings as any) = {
      scheduleDelay: {
        "2001": 10000,
        "2002": 10000,
        "2003": 10000,
      },
    };

    eventSchedulerService = new EventSchedulerService(mockContainer);
  });

  describe("scheduleEvents", () => {
    it("should schedule multiple events", async () => {
      // Arrange
      const eventIds = [1001, 1002, 1003];
      const mockEvent = createMockEvent(1001);

      mockOddsFeedService.getEventDetailsWithRetry.mockResolvedValue(mockEvent);
      mockIdHelper.extractGameId.mockReturnValue("2001");

      // Act
      eventSchedulerService.scheduleEvents(eventIds);

      // Assert
      expect(mockOddsFeedService.getEventDetailsWithRetry).toHaveBeenCalledTimes(3);
      expect(mockOddsFeedService.getEventDetailsWithRetry).toHaveBeenCalledWith(1001);
      expect(mockOddsFeedService.getEventDetailsWithRetry).toHaveBeenCalledWith(1002);
      expect(mockOddsFeedService.getEventDetailsWithRetry).toHaveBeenCalledWith(1003);
    });

    it("should handle empty event IDs array", () => {
      // Arrange
      const eventIds: number[] = [];

      // Act
      eventSchedulerService.scheduleEvents(eventIds);

      // Assert
      expect(mockOddsFeedService.getEventDetailsWithRetry).not.toHaveBeenCalled();
    });
  });

  describe("scheduleEvent", () => {
    it("should successfully schedule an event", async () => {
      // Arrange
      const eventId = 1001;
      const gameId = "2001";
      const mockEvent = createMockEvent(eventId);

      mockOddsFeedService.getEventDetailsWithRetry.mockResolvedValue(mockEvent);
      mockIdHelper.extractGameId.mockReturnValue(gameId);

      // Act
      await eventSchedulerService.scheduleEvent(eventId);

      // Assert
      expect(mockOddsFeedService.getEventDetailsWithRetry).toHaveBeenCalledWith(eventId);
      expect(mockIdHelper.extractGameId).toHaveBeenCalledWith(eventId);
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledWith(
        `${gameId}_${eventId}_0_${JobName.ScheduleEvent}`,
        expect.any(Date),
        expect.any(Function)
      );
    });

    it("should handle event not found", async () => {
      // Arrange
      const eventId = 9999;

      mockOddsFeedService.getEventDetailsWithRetry.mockResolvedValue(null);

      // Act
      await eventSchedulerService.scheduleEvent(eventId);

      // Assert
      expect(mockLogService.logError).toHaveBeenCalledWith(`Schedule event ${eventId} failed, event not found`);
      expect(mockJobScheduler.scheduleJob).not.toHaveBeenCalled();
    });

    it("should handle missing schedule delay", async () => {
      // Arrange
      const eventId = 1001;
      const gameId = "2001";
      const mockEvent = createMockEvent(eventId);

      mockOddsFeedService.getEventDetailsWithRetry.mockResolvedValue(mockEvent);
      mockIdHelper.extractGameId.mockReturnValue(gameId);
      (appSettings as any).scheduleDelay = {};

      // Act
      await eventSchedulerService.scheduleEvent(eventId);

      // Assert
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledWith(
        `${gameId}_${eventId}_0_${JobName.ScheduleEvent}`,
        expect.any(Date),
        expect.any(Function)
      );
    });

    it("should execute scheduled job callback correctly", async () => {
      // Arrange
      const eventId = 1001;
      const gameId = "2001";
      const mockEvent = createMockEvent(eventId);

      mockOddsFeedService.getEventDetailsWithRetry.mockResolvedValue(mockEvent);
      mockIdHelper.extractGameId.mockReturnValue(gameId);

      // Act
      await eventSchedulerService.scheduleEvent(eventId);

      // Get the scheduled callback
      const scheduledCallback = mockJobScheduler.scheduleJob.mock.calls[0][2];

      // Execute the callback
      await scheduledCallback();

      // Assert
      expect(mockEventManager.initializeCurrentEvent).toHaveBeenCalledWith(mockEvent);
      expect(mockEventStreamService.broadcastUpdateEventDataToClients).toHaveBeenCalledWith(
        gameId,
        JobName.ScheduleEvent,
        0
      );
    });
  });

  describe("scheduleEventDetails", () => {
    it("should schedule all event details", () => {
      // Arrange
      const event = createMockEvent(1001);
      const gameId = "2001";

      mockIdHelper.extractGameId.mockReturnValue(gameId);

      // Act
      eventSchedulerService.scheduleEventDetails(event);

      // Assert
      expect(mockIdHelper.extractGameId).toHaveBeenCalledWith(event.eventID);
      // Should schedule 3 jobs per event detail (odds, video, result) * 2 details = 6 jobs
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledTimes(6);
    });

    it("should handle event with no details", () => {
      // Arrange
      const event = { ...createMockEvent(1001), eventDetails: [] };
      const gameId = "2001";

      mockIdHelper.extractGameId.mockReturnValue(gameId);

      // Act
      eventSchedulerService.scheduleEventDetails(event);

      // Assert
      expect(mockJobScheduler.scheduleJob).not.toHaveBeenCalled();
    });
  });

  describe("scheduleUpdateOdds", () => {
    it("should schedule odds update job", async () => {
      // Arrange
      const eventDetail = createMockEventDetail(1001, 0);
      const index = 0;
      const gameId = "2001";

      // Act
      await eventSchedulerService.scheduleUpdateOdds(eventDetail, index, gameId);

      // Assert
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledWith(
        `${gameId}_${eventDetail.eventID}_${index}_${JobName.UpdateOdds}`,
        new Date(eventDetail.oddsAvailableTs),
        expect.any(Function)
      );
    });

    it("should execute odds update job callback correctly", async () => {
      // Arrange
      const eventDetail = createMockEventDetail(1001, 0);
      const index = 0;
      const gameId = "2001";
      const mockEvent = createMockEvent(1001);

      // Mock the updateCurrentEventDetail method
      mockOddsFeedService.getEventDetailsWithRetry.mockResolvedValue(mockEvent);

      // Act
      await eventSchedulerService.scheduleUpdateOdds(eventDetail, index, gameId);

      // Get the scheduled callback
      const scheduledCallback = mockJobScheduler.scheduleJob.mock.calls[0][2];

      // Execute the callback
      await scheduledCallback();

      // Assert
      expect(mockEventManager.updateCurrentEventDetail).toHaveBeenCalledWith(mockEvent, JobName.UpdateOdds, index);
      expect(mockEventStreamService.broadcastUpdateEventDataToClients).toHaveBeenCalledWith(
        gameId,
        JobName.UpdateOdds,
        index
      );
    });
  });

  describe("scheduleUpdateVideoInfo", () => {
    it("should schedule video info update job", async () => {
      // Arrange
      const eventDetail = createMockEventDetail(1001, 0);
      const index = 0;
      const gameId = "2001";

      // Act
      await eventSchedulerService.scheduleUpdateVideoInfo(eventDetail, index, gameId);

      // Assert
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledWith(
        `${gameId}_${eventDetail.eventID}_${index}_${JobName.UpdateVideoInfo}`,
        new Date(eventDetail.scheduleStartTs),
        expect.any(Function)
      );
    });

    it("should execute video info update job callback correctly", async () => {
      // Arrange
      const eventDetail = createMockEventDetail(1001, 0);
      const index = 0;
      const gameId = "2001";
      const mockEvent = createMockEvent(1001);

      // Mock the current event for scheduleUpdateGoalInfo
      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);
      // Mock the updateCurrentEventDetail method
      mockOddsFeedService.getEventDetailsWithRetry.mockResolvedValue(mockEvent);

      // Act
      await eventSchedulerService.scheduleUpdateVideoInfo(eventDetail, index, gameId);

      // Get the scheduled callback
      const scheduledCallback = mockJobScheduler.scheduleJob.mock.calls[0][2];

      // Execute the callback
      await scheduledCallback();

      // Assert
      expect(mockEventManager.updateCurrentEventDetail).toHaveBeenCalledWith(mockEvent, JobName.UpdateVideoInfo, index);
      expect(mockEventStreamService.broadcastUpdateEventDataToClients).toHaveBeenCalledWith(
        gameId,
        JobName.UpdateVideoInfo,
        index
      );
    });
  });

  describe("scheduleUpdateGoalInfo", () => {
    it("should schedule goal info updates with given goal info", async () => {
      // Arrange
      const gameId = "2001";
      const index = 0;
      const givenGoalInfo = createMockGoalInfo();
      const mockEvent = createMockEvent(1001);
      const eventDetail = mockEvent.eventDetails[index];

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);

      // Act
      await eventSchedulerService.scheduleUpdateGoalInfo(gameId, index, givenGoalInfo);

      // Assert
      expect(mockEventManager.updateGoalInfo).toHaveBeenCalledWith(gameId, givenGoalInfo, index);
      expect(mockOddsFeedService.getGoalInfo).not.toHaveBeenCalled();
      // Should schedule jobs for each timeline entry
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledTimes(3);
    });

    it("should fetch goal info when not provided", async () => {
      // Arrange
      const gameId = "2001";
      const index = 0;
      const mockGoalInfo = createMockGoalInfo();
      const mockEvent = createMockEvent(1001);
      const eventDetail = mockEvent.eventDetails[index];

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockOddsFeedService.getGoalInfo.mockResolvedValue(mockGoalInfo);

      // Act
      await eventSchedulerService.scheduleUpdateGoalInfo(gameId, index);

      // Assert
      expect(mockOddsFeedService.getGoalInfo).toHaveBeenCalledWith(eventDetail.goalInfo);
      expect(mockEventManager.updateGoalInfo).toHaveBeenCalledWith(gameId, mockGoalInfo, index);
    });

    it("should handle goal info fetch failure", async () => {
      // Arrange
      const gameId = "2001";
      const index = 0;
      const mockEvent = createMockEvent(1001);

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockOddsFeedService.getGoalInfo.mockResolvedValue(null);

      // Act
      await eventSchedulerService.scheduleUpdateGoalInfo(gameId, index);

      // Assert
      expect(mockLogService.logError).toHaveBeenCalledWith(
        `Failed to get goal info for event ${mockEvent.eventDetails[index].eventID} index: ${index}`
      );
      expect(mockJobScheduler.scheduleJob).not.toHaveBeenCalled();
    });

    it("should execute goal info update job callback correctly", async () => {
      // Arrange
      const gameId = "2001";
      const index = 0;
      const givenGoalInfo = createMockGoalInfo();
      const mockEvent = createMockEvent(1001);
      const eventDetail = mockEvent.eventDetails[index];

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);

      // Act
      await eventSchedulerService.scheduleUpdateGoalInfo(gameId, index, givenGoalInfo);

      // Get the first scheduled callback
      const scheduledCallback = mockJobScheduler.scheduleJob.mock.calls[0][2];

      // Execute the callback
      await scheduledCallback();

      // Assert
      expect(mockEventManager.updateLiveScore).toHaveBeenCalledWith(gameId, givenGoalInfo.result, 0, index);
      expect(mockEventStreamService.broadcastUpdateEventDataToClients).toHaveBeenCalledWith(
        gameId,
        JobName.UpdateGoalInfo,
        index
      );
    });
  });

  describe("scheduleUpdateResult", () => {
    it("should schedule result update job", async () => {
      // Arrange
      const eventDetail = createMockEventDetail(1001, 0);
      const index = 0;
      const gameId = "2001";

      // Act
      await eventSchedulerService.scheduleUpdateResult(eventDetail, index, gameId);

      // Assert
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledWith(
        `${gameId}_${eventDetail.eventID}_${index}_${JobName.UpdateResult}`,
        new Date(eventDetail.resultsAvailableTs),
        expect.any(Function)
      );
    });

    it("should execute result update job callback correctly", async () => {
      // Arrange
      const eventDetail = createMockEventDetail(1001, 0);
      const index = 0;
      const gameId = "2001";
      const mockEvent = createMockEvent(1001);

      // Mock the updateCurrentEventDetail method
      mockOddsFeedService.getEventDetailsWithRetry.mockResolvedValue(mockEvent);

      // Act
      await eventSchedulerService.scheduleUpdateResult(eventDetail, index, gameId);

      // Get the scheduled callback
      const scheduledCallback = mockJobScheduler.scheduleJob.mock.calls[0][2];

      // Execute the callback
      await scheduledCallback();

      // Assert
      expect(mockEventManager.updateCurrentEventDetail).toHaveBeenCalledWith(mockEvent, JobName.UpdateResult, index);
      expect(mockEventManager.incrementCurrentEventDetailIndex).toHaveBeenCalledWith(gameId);
      expect(mockEventStreamService.broadcastUpdateEventDataToClients).toHaveBeenCalledWith(
        gameId,
        JobName.UpdateResult,
        index
      );
    });
  });

  describe("updateCurrentEventDetail", () => {
    it("should successfully update current event detail", async () => {
      // Arrange
      const eventId = 1001;
      const phase = JobName.UpdateOdds;
      const eventDetailIndex = 0;
      const mockEvent = createMockEvent(eventId);

      mockOddsFeedService.getEventDetailsWithRetry.mockResolvedValue(mockEvent);

      // Act
      await eventSchedulerService.updateCurrentEventDetail(eventId, phase, eventDetailIndex);

      // Assert
      expect(mockOddsFeedService.getEventDetailsWithRetry).toHaveBeenCalledWith(eventId, expect.any(Function));
      expect(mockEventManager.updateCurrentEventDetail).toHaveBeenCalledWith(mockEvent, phase, eventDetailIndex);
    });

    it("should handle update failure", async () => {
      // Arrange
      const eventId = 1001;
      const phase = JobName.UpdateOdds;
      const eventDetailIndex = 0;

      mockOddsFeedService.getEventDetailsWithRetry.mockResolvedValue(null);

      // Act
      await eventSchedulerService.updateCurrentEventDetail(eventId, phase, eventDetailIndex);

      // Assert
      expect(mockLogService.logError).toHaveBeenCalledWith(`Failed to update event ${eventId} for phase ${phase}`);
      expect(mockEventManager.updateCurrentEventDetail).not.toHaveBeenCalled();
    });
  });

  describe("generateJobId", () => {
    it("should generate correct job ID", () => {
      // Arrange
      const gameId = "2001";
      const eventId = 1001;
      const index = 0;
      const jobName = JobName.UpdateOdds;

      // Act
      const result = eventSchedulerService.generateJobId(gameId, eventId, index, jobName);

      // Assert
      expect(result).toBe(`${gameId}_${eventId}_${index}_${jobName}`);
    });

    it("should handle different job names", () => {
      // Arrange
      const gameId = "2001";
      const eventId = 1001;
      const index = 1;
      const jobName = JobName.UpdateVideoInfo;

      // Act
      const result = eventSchedulerService.generateJobId(gameId, eventId, index, jobName);

      // Assert
      expect(result).toBe(`${gameId}_${eventId}_${index}_${jobName}`);
    });
  });

  describe("getValidatorForPhase", () => {
    it("should return correct validator for UpdateVideoInfo phase", () => {
      // Arrange
      const phase = JobName.UpdateVideoInfo;
      const eventDetailIndex = 0;

      // Act
      const validator = eventSchedulerService.getValidatorForPhase(phase, eventDetailIndex);

      // Assert
      const validEvent = createMockEvent(1001);
      const invalidEvent = {
        ...createMockEvent(1001),
        eventDetails: [{ ...createMockEventDetail(1001, 0), playlist: "" }],
      };

      expect(validator(validEvent)).toBe(true);
      expect(validator(invalidEvent)).toBe(false);
    });

    it("should return correct validator for UpdateResult phase", () => {
      // Arrange
      const phase = JobName.UpdateResult;
      const eventDetailIndex = 0;

      // Act
      const validator = eventSchedulerService.getValidatorForPhase(phase, eventDetailIndex);

      // Assert
      const validEvent = createMockEvent(1001);
      const invalidEvent = {
        ...createMockEvent(1001),
        eventDetails: [{ ...createMockEventDetail(1001, 0), hasResults: false }],
      };

      expect(validator(validEvent)).toBe(true);
      expect(validator(invalidEvent)).toBe(false);
    });

    it("should return default validator for unknown phase", () => {
      // Arrange
      const phase = "UnknownPhase" as JobName;
      const eventDetailIndex = 0;

      // Act
      const validator = eventSchedulerService.getValidatorForPhase(phase, eventDetailIndex);

      // Assert
      const event = createMockEvent(1001);
      expect(validator(event)).toBe(true);
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete event scheduling flow", async () => {
      // Arrange
      const eventId = 1001;
      const gameId = "2001";
      const mockEvent = createMockEvent(eventId);

      mockOddsFeedService.getEventDetailsWithRetry.mockResolvedValue(mockEvent);
      mockIdHelper.extractGameId.mockReturnValue(gameId);

      // Act
      await eventSchedulerService.scheduleEvent(eventId);

      // Get the scheduled callback and execute it
      const scheduledCallback = mockJobScheduler.scheduleJob.mock.calls[0][2];
      await scheduledCallback();

      // Assert
      expect(mockEventManager.initializeCurrentEvent).toHaveBeenCalledWith(mockEvent);
      expect(mockEventStreamService.broadcastUpdateEventDataToClients).toHaveBeenCalledWith(
        gameId,
        JobName.ScheduleEvent,
        0
      );
      // Should schedule event details after initialization
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledTimes(7); // 1 for schedule + 6 for details
    });

    it("should handle multiple events with different game IDs", async () => {
      // Arrange
      const eventIds = [1001, 2001, 3001];
      const mockEvent1 = createMockEvent(1001);
      const mockEvent2 = createMockEvent(2001);
      const mockEvent3 = createMockEvent(3001);

      mockOddsFeedService.getEventDetailsWithRetry
        .mockResolvedValueOnce(mockEvent1)
        .mockResolvedValueOnce(mockEvent2)
        .mockResolvedValueOnce(mockEvent3);
      mockIdHelper.extractGameId.mockReturnValueOnce("2001").mockReturnValueOnce("2002").mockReturnValueOnce("2003");

      // Act
      eventSchedulerService.scheduleEvents(eventIds);

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Assert
      expect(mockOddsFeedService.getEventDetailsWithRetry).toHaveBeenCalledTimes(3);
      // Each event should schedule one job initially
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledTimes(3);
    });
  });
});
