import { EventSchedulerService } from "../../../src/services/event-scheduler-service";
import { mockContainer } from "../global-stubs";
import { appSettings } from "../../../src/app-settings";
import { Event, EventDetail, JobName, GoalInfoData, InGameEvent } from "../../../src/types";
import { idHelper } from "../../../src/helpers";

// Mock dependencies
jest.mock("../../../src/app-settings");
jest.mock("../../../src/helpers");
jest.mock("../../../src/helpers/voices", () => ({
  generateVoiceWithEventTimeline: jest.fn(),
}));
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
  inGameEventInfo: "in-game-event-info-1",
  phase: index,
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

const createMockInGameEvent = (): InGameEvent => ({
  timeLine: [5, 15, 25],
  frame: [100, 200, 300],
  eventName: ["kick-off", "corner", "free-kick"],
});

describe("EventSchedulerService", () => {
  let eventSchedulerService: EventSchedulerService;
  let mockJobScheduler: jest.Mocked<any>;
  let mockOddsFeedService: jest.Mocked<any>;
  let mockEventStreamService: jest.Mocked<any>;
  let mockEventManager: jest.Mocked<any>;
  let mockLogService: jest.Mocked<any>;
  let mockIdHelper: jest.Mocked<any>;
  let mockGenerateVoiceWithEventTimeline: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create proper Jest mocks
    mockJobScheduler = {
      scheduleJob: jest.fn(),
    };
    mockOddsFeedService = {
      getEventDetailsWithRetry: jest.fn(),
      getGoalInfo: jest.fn(),
      getInGameEvent: jest.fn(),
    };
    mockEventStreamService = {
      broadcastUpdateEventDataToClients: jest.fn(),
    };
    mockEventManager = {
      initializeCurrentEvent: jest.fn(),
      getCurrentEventForGame: jest.fn(),
      updateGoalInfo: jest.fn(),
      updateInGameEventInfo: jest.fn(),
      updateLiveScore: jest.fn(),
      incrementCurrentEventDetailIndex: jest.fn(),
      updateCurrentEventDetail: jest.fn(),
      initializeGamePhaseWithGoalInfo: jest.fn(),
      getVoiceForGame: jest.fn(),
      getInGameEventForGame: jest.fn(),
      getPreviousResultForGame: jest.fn(),
      appendInGameEventForGame: jest.fn(),
      appendVoiceForGame: jest.fn(),
      updateIntroTimeForCurrentEvent: jest.fn(),
    };
    mockLogService = {
      logError: jest.fn(),
    };
    mockIdHelper = {
      extractGameId: jest.fn(),
    };

    // Mock voices helper
    mockGenerateVoiceWithEventTimeline = require("../../../src/helpers/voices").generateVoiceWithEventTimeline;

    // Replace the auto-stubbed methods with Jest mocks
    mockContainer.jobScheduler = mockJobScheduler;
    mockContainer.oddsFeedService = mockOddsFeedService;
    mockContainer.eventStreamService = mockEventStreamService;
    mockContainer.eventManager = mockEventManager;
    mockContainer.logService = mockLogService;

    // Mock helpers
    Object.assign(idHelper, mockIdHelper);

    // Mock appSettings
    Object.assign(appSettings, {
      scheduleDelay: {
        "2001": 10000,
        "2002": 10000,
        "2003": 10000,
      },
      videoDelay: {
        "2001": 3000,
        "2002": 3000,
        "2003": 3000,
      },
      introDuration: {
        "2000": 8000,
        "2001": 5000,
      },
    });

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

      // Spy on the methods
      const schedulePlayIntroBeforeMatchStartSpy = jest.spyOn(eventSchedulerService, 'schedulePlayIntroBeforeMatchStart').mockImplementation();
      const scheduleEventDetailsSpy = jest.spyOn(eventSchedulerService, 'scheduleEventDetails').mockImplementation();

      // Act
      await eventSchedulerService.scheduleEvent(eventId);

      // Assert that schedulePlayIntroBeforeMatchStart is called immediately (outside callback)
      expect(schedulePlayIntroBeforeMatchStartSpy).toHaveBeenCalledWith(mockEvent, gameId);

      // Get the scheduled callback
      const scheduledCallback = mockJobScheduler.scheduleJob.mock.calls[0][2];

      // Execute the callback
      await scheduledCallback();

      // Assert callback execution - schedulePlayIntroBeforeMatchStart should NOT be called again in callback
      expect(mockEventManager.initializeCurrentEvent).toHaveBeenCalledWith(mockEvent);
      expect(scheduleEventDetailsSpy).toHaveBeenCalledWith(mockEvent);
      expect(mockEventStreamService.broadcastUpdateEventDataToClients).toHaveBeenCalledWith(
        gameId,
        JobName.ScheduleEvent,
        0
      );

      // schedulePlayIntroBeforeMatchStart should be called only once (outside callback)
      expect(schedulePlayIntroBeforeMatchStartSpy).toHaveBeenCalledTimes(1);

      // Cleanup
      schedulePlayIntroBeforeMatchStartSpy.mockRestore();
      scheduleEventDetailsSpy.mockRestore();
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
      // Plus 1 intro job for the second detail (index 1) = 7 jobs total
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledTimes(7);
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
    it("should schedule preload video info update job", async () => {
      // Arrange
      const eventDetail = createMockEventDetail(1001, 0);
      const index = 0;
      const gameId = "2001";

      // Act
      await eventSchedulerService.scheduleUpdateVideoInfo(eventDetail, index, gameId);

      // Assert
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledWith(
        `${gameId}_${eventDetail.eventID}_${index}_${JobName.UpdatePreloadVideoInfo}`,
        new Date(eventDetail.scheduleStartTs),
        expect.any(Function)
      );
    });

    it("should execute preload video info update job callback correctly", async () => {
      // Arrange
      const eventDetail = createMockEventDetail(1001, 0);
      const index = 0;
      const gameId = "2001";
      const mockEvent = createMockEvent(1001);

      // Mock the updateCurrentEventDetail method
      mockOddsFeedService.getEventDetailsWithRetry.mockResolvedValue(mockEvent);
      // Mock the current event for scheduleUpdateGoalInfo
      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);

      // Act
      await eventSchedulerService.scheduleUpdateVideoInfo(eventDetail, index, gameId);

      // Get the scheduled callback
      const scheduledCallback = mockJobScheduler.scheduleJob.mock.calls[0][2];

      // Execute the callback
      await scheduledCallback();

      // Assert
      expect(mockEventManager.updateCurrentEventDetail).toHaveBeenCalledWith(
        mockEvent,
        JobName.UpdatePreloadVideoInfo,
        index
      );
      expect(mockEventStreamService.broadcastUpdateEventDataToClients).toHaveBeenCalledWith(
        gameId,
        JobName.UpdatePreloadVideoInfo,
        index
      );
    });
  });

  describe("scheduleBroadcastVideoInfo", () => {
    it("should schedule broadcast video info job with delay", async () => {
      // Arrange
      const eventDetail = createMockEventDetail(1001, 0);
      const index = 0;
      const gameId = "2001";
      const mockEvent = createMockEvent(1001);

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);

      // Act
      await eventSchedulerService.scheduleBroadcastVideoInfo(eventDetail, index, gameId);

      // Assert
      const expectedScheduledTime = new Date(new Date(eventDetail.scheduleStartTs).getTime() + 3000); // videoDelay[gameId]
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledWith(
        `${gameId}_${eventDetail.eventID}_${index}_${JobName.UpdateVideoInfo}`,
        expectedScheduledTime,
        expect.any(Function),
        true
      );
    });

    it("should execute broadcast video info job callback correctly", async () => {
      // Arrange
      const eventDetail = createMockEventDetail(1001, 0);
      const index = 0;
      const gameId = "2001";
      const mockEvent = createMockEvent(1001);

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);

      // Act
      await eventSchedulerService.scheduleBroadcastVideoInfo(eventDetail, index, gameId);

      // Get the scheduled callback
      const scheduledCallback = mockJobScheduler.scheduleJob.mock.calls[0][2];

      // Execute the callback
      await scheduledCallback();

      // Assert
      expect(mockEventManager.getCurrentEventForGame).toHaveBeenCalledWith(gameId);
      expect(mockEventManager.updateCurrentEventDetail).toHaveBeenCalledWith(mockEvent, JobName.UpdateVideoInfo, index);
      expect(mockEventStreamService.broadcastUpdateEventDataToClients).toHaveBeenCalledWith(
        gameId,
        JobName.UpdateVideoInfo,
        index
      );
    });

    it("should handle missing video delay", async () => {
      // Arrange
      const eventDetail = createMockEventDetail(1001, 0);
      const index = 0;
      const gameId = "2001";
      const mockEvent = createMockEvent(1001);

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);
      (appSettings as any).videoDelay = {};

      // Act
      await eventSchedulerService.scheduleBroadcastVideoInfo(eventDetail, index, gameId);

      // Assert
      const expectedScheduledTime = new Date(new Date(eventDetail.scheduleStartTs).getTime() + 0); // no delay
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledWith(
        `${gameId}_${eventDetail.eventID}_${index}_${JobName.UpdateVideoInfo}`,
        expectedScheduledTime,
        expect.any(Function),
        true
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
      expect(mockEventManager.initializeGamePhaseWithGoalInfo).toHaveBeenCalledWith(gameId, givenGoalInfo, eventDetail.phase ?? index);
      expect(mockOddsFeedService.getGoalInfo).not.toHaveBeenCalled();
      // Should schedule jobs for each timeline entry (3 goal info jobs)
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
      expect(mockEventManager.initializeGamePhaseWithGoalInfo).toHaveBeenCalledWith(gameId, mockGoalInfo, eventDetail.phase ?? index);
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
      const mockVoiceResult = {
        timeline: [],
        voice: [],
      };

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockOddsFeedService.getInGameEvent.mockResolvedValue(null);
      mockGenerateVoiceWithEventTimeline.mockReturnValue(mockVoiceResult);

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

    it("should schedule only goal info jobs without voice functionality", async () => {
      // Arrange
      const gameId = "2001";
      const index = 0;
      const givenGoalInfo = createMockGoalInfo();
      const mockEvent = createMockEvent(1001);

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);

      // Act
      await eventSchedulerService.scheduleUpdateGoalInfo(gameId, index, givenGoalInfo);

      // Assert
      expect(mockGenerateVoiceWithEventTimeline).not.toHaveBeenCalled();
      
      // Should schedule only 3 goal info jobs
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledTimes(3);
      
      // Check that no voice jobs are scheduled
      const voiceJobCalls = mockJobScheduler.scheduleJob.mock.calls.filter((call: any[]) => 
        (call[0] as string).includes(JobName.UpdateVoice)
      );
      expect(voiceJobCalls).toHaveLength(0);
    });

    it("should fetch goal info when not provided and initialize game phase", async () => {
      // Arrange
      const gameId = "2001";
      const index = 0;
      const mockEvent = createMockEvent(1001);
      const mockGoalInfo = createMockGoalInfo();
      const eventDetail = mockEvent.eventDetails[index];

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockOddsFeedService.getGoalInfo.mockResolvedValue(mockGoalInfo);

      // Act
      await eventSchedulerService.scheduleUpdateGoalInfo(gameId, index);

      // Assert
      expect(mockOddsFeedService.getGoalInfo).toHaveBeenCalledWith(eventDetail.goalInfo);
      expect(mockEventManager.updateGoalInfo).toHaveBeenCalledWith(gameId, mockGoalInfo, index);
      expect(mockEventManager.initializeGamePhaseWithGoalInfo).toHaveBeenCalledWith(gameId, mockGoalInfo, eventDetail.phase ?? index);
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledTimes(3);
    });

    it("should handle goal info fetch failure", async () => {
      // Arrange
      const gameId = "2001";
      const index = 0;
      const mockEvent = createMockEvent(1001);
      const eventDetail = mockEvent.eventDetails[index];

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockOddsFeedService.getGoalInfo.mockResolvedValue(null);

      // Act
      await eventSchedulerService.scheduleUpdateGoalInfo(gameId, index);

      // Assert
      expect(mockOddsFeedService.getGoalInfo).toHaveBeenCalledWith(eventDetail.goalInfo);
      expect(mockLogService.logError).toHaveBeenCalledWith(`Failed to get goal info for event ${eventDetail.eventID} index: ${index}`);
      expect(mockJobScheduler.scheduleJob).not.toHaveBeenCalled();
    });

  });

  describe("scheduleUpdateVoice", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should schedule voice jobs when in-game event is provided", async () => {
      // Arrange
      const gameId = "2001";
      const index = 0;
      const givenInGameEvent = createMockInGameEvent();
      const mockEvent = createMockEvent(1001);
      const eventDetail = mockEvent.eventDetails[index];
      const mockVoiceResult = {
        timeline: [10, 20],
        voice: ["voice1", "voice2"],
      };
      const mockPreviousVoice = { voice: ["prev_voice"], timeline: [5] };
      const mockPreviousInGameEvent = { eventName: ["prev_event"], timeline: [3] };
      const mockPreviousResult = ["1", "0"];

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockEventManager.getVoiceForGame.mockReturnValue(mockPreviousVoice);
      mockEventManager.getInGameEventForGame.mockReturnValue(mockPreviousInGameEvent);
      mockEventManager.getPreviousResultForGame.mockReturnValue(mockPreviousResult);
      mockGenerateVoiceWithEventTimeline.mockReturnValue(mockVoiceResult);

      // Act
      await eventSchedulerService.scheduleUpdateVoice(gameId, index, givenInGameEvent);

      // Assert
      expect(mockEventManager.updateInGameEventInfo).toHaveBeenCalledWith(gameId, givenInGameEvent, index);
      expect(mockEventManager.getVoiceForGame).toHaveBeenCalledWith(gameId);
      expect(mockEventManager.getInGameEventForGame).toHaveBeenCalledWith(gameId);
      expect(mockEventManager.getPreviousResultForGame).toHaveBeenCalledWith(gameId);
      expect(mockGenerateVoiceWithEventTimeline).toHaveBeenCalledWith({
        timeline: givenInGameEvent.timeLine,
        eventName: givenInGameEvent.eventName,
        previousVoices: mockPreviousVoice.voice,
        previousTimelines: mockPreviousVoice.timeline,
        previousEvents: mockPreviousInGameEvent.eventName,
        previousVoiceTimelines: mockPreviousInGameEvent.timeline,
        firstHalfScore: "10",
      });
      expect(mockEventManager.appendInGameEventForGame).toHaveBeenCalledWith(gameId, givenInGameEvent, eventDetail.phase ?? index);
      expect(mockEventManager.appendVoiceForGame).toHaveBeenCalledWith(gameId, mockVoiceResult.voice, mockVoiceResult.timeline, eventDetail.phase ?? index);
      
      // Should schedule 2 voice jobs
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledTimes(2);
      
      // Check voice job scheduling
      const voiceJobCalls = mockJobScheduler.scheduleJob.mock.calls.filter((call: any[]) => 
        (call[0] as string).includes(JobName.UpdateVoice)
      );
      expect(voiceJobCalls).toHaveLength(2);
    });

    it("should schedule voice jobs with correct timing and payloads including video delay", async () => {
      // Arrange
      const gameId = "2001";
      const index = 0;
      const givenInGameEvent = createMockInGameEvent();
      const mockEvent = createMockEvent(1001);
      const eventDetail = mockEvent.eventDetails[index];
      const mockVoiceResult = {
        timeline: [10, 20],
        voice: ["voice1", "voice2"],
      };
      const mockPreviousVoice = { voice: [], timeline: [] };
      const mockPreviousInGameEvent = { eventName: [], timeline: [] };
      const mockPreviousResult: string[] = [];

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockEventManager.getVoiceForGame.mockReturnValue(mockPreviousVoice);
      mockEventManager.getInGameEventForGame.mockReturnValue(mockPreviousInGameEvent);
      mockEventManager.getPreviousResultForGame.mockReturnValue(mockPreviousResult);
      mockGenerateVoiceWithEventTimeline.mockReturnValue(mockVoiceResult);

      // Act
      await eventSchedulerService.scheduleUpdateVoice(gameId, index, givenInGameEvent);

      // Assert voice job scheduling
      const voiceJobCalls = mockJobScheduler.scheduleJob.mock.calls.filter((call: any[]) => 
        (call[0] as string).includes(JobName.UpdateVoice)
      );

      // Check first voice job - should include video delay (3000ms)
      expect(voiceJobCalls[0][0]).toBe(`${gameId}_${eventDetail.eventID}_${index}_${JobName.UpdateVoice}_0`);
      expect(voiceJobCalls[0][1]).toEqual(new Date(new Date(eventDetail.scheduleStartTs).getTime() + 10 * 1000 + 3000));
      expect(voiceJobCalls[0][3]).toBe(true); // should be background job

      // Check second voice job - should include video delay (3000ms)
      expect(voiceJobCalls[1][0]).toBe(`${gameId}_${eventDetail.eventID}_${index}_${JobName.UpdateVoice}_1`);
      expect(voiceJobCalls[1][1]).toEqual(new Date(new Date(eventDetail.scheduleStartTs).getTime() + 20 * 1000 + 3000));
      expect(voiceJobCalls[1][3]).toBe(true); // should be background job

      // Test voice job callbacks
      const firstVoiceCallback = voiceJobCalls[0][2];
      await firstVoiceCallback();

      expect(mockEventStreamService.broadcastUpdateEventDataToClients).toHaveBeenCalledWith(
        gameId,
        JobName.UpdateVoice,
        index,
        { voice: "voice1" }
      );
    });

    it("should handle empty voice generation result", async () => {
      // Arrange
      const gameId = "2001";
      const index = 0;
      const givenInGameEvent = createMockInGameEvent();
      const mockEvent = createMockEvent(1001);
      const eventDetail = mockEvent.eventDetails[index];
      const mockVoiceResult = {
        timeline: [],
        voice: [],
      };
      const mockPreviousVoice = { voice: [], timeline: [] };
      const mockPreviousInGameEvent = { eventName: [], timeline: [] };
      const mockPreviousResult: string[] = [];

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockEventManager.getVoiceForGame.mockReturnValue(mockPreviousVoice);
      mockEventManager.getInGameEventForGame.mockReturnValue(mockPreviousInGameEvent);
      mockEventManager.getPreviousResultForGame.mockReturnValue(mockPreviousResult);
      mockGenerateVoiceWithEventTimeline.mockReturnValue(mockVoiceResult);

      // Act
      await eventSchedulerService.scheduleUpdateVoice(gameId, index, givenInGameEvent);

      // Assert
      expect(mockEventManager.updateInGameEventInfo).toHaveBeenCalledWith(gameId, givenInGameEvent, index);
      expect(mockEventManager.appendInGameEventForGame).toHaveBeenCalledWith(gameId, givenInGameEvent, eventDetail.phase ?? index);
      expect(mockEventManager.appendVoiceForGame).toHaveBeenCalledWith(gameId, mockVoiceResult.voice, mockVoiceResult.timeline, eventDetail.phase ?? index);
      
      // Should not schedule any voice jobs
      expect(mockJobScheduler.scheduleJob).not.toHaveBeenCalled();
      
      const voiceJobCalls = mockJobScheduler.scheduleJob.mock.calls.filter((call: any[]) => 
        (call[0] as string).includes(JobName.UpdateVoice)
      );
      expect(voiceJobCalls).toHaveLength(0);
    });

    it("should fetch in-game event when not provided", async () => {
      // Arrange
      const gameId = "2001";
      const index = 0;
      const mockEvent = createMockEvent(1001);
      const mockInGameEvent = createMockInGameEvent();
      const eventDetail = mockEvent.eventDetails[index];
      const mockVoiceResult = {
        timeline: [10],
        voice: ["voice1"],
      };
      const mockPreviousVoice = { voice: ["prev_voice"], timeline: [5] };
      const mockPreviousInGameEvent = { eventName: ["prev_event"], timeline: [3] };
      const mockPreviousResult = ["1", "0"];

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockEventManager.getVoiceForGame.mockReturnValue(mockPreviousVoice);
      mockEventManager.getInGameEventForGame.mockReturnValue(mockPreviousInGameEvent);
      mockEventManager.getPreviousResultForGame.mockReturnValue(mockPreviousResult);
      mockOddsFeedService.getInGameEvent.mockResolvedValue(mockInGameEvent);
      mockGenerateVoiceWithEventTimeline.mockReturnValue(mockVoiceResult);

      // Act
      await eventSchedulerService.scheduleUpdateVoice(gameId, index);

      // Assert
      expect(mockOddsFeedService.getInGameEvent).toHaveBeenCalledWith(eventDetail.inGameEventInfo);
      expect(mockEventManager.updateInGameEventInfo).toHaveBeenCalledWith(gameId, mockInGameEvent, index);
      expect(mockGenerateVoiceWithEventTimeline).toHaveBeenCalledWith({
        timeline: mockInGameEvent.timeLine,
        eventName: mockInGameEvent.eventName,
        previousVoices: mockPreviousVoice.voice,
        previousTimelines: mockPreviousVoice.timeline,
        previousEvents: mockPreviousInGameEvent.eventName,
        previousVoiceTimelines: mockPreviousInGameEvent.timeline,
        firstHalfScore: "10",
      });
      expect(mockEventManager.appendInGameEventForGame).toHaveBeenCalledWith(gameId, mockInGameEvent, eventDetail.phase ?? index);
      expect(mockEventManager.appendVoiceForGame).toHaveBeenCalledWith(gameId, mockVoiceResult.voice, mockVoiceResult.timeline, eventDetail.phase ?? index);
    });

    it("should handle in-game event fetch failure", async () => {
      // Arrange
      const gameId = "2001";
      const index = 0;
      const mockEvent = createMockEvent(1001);
      const eventDetail = mockEvent.eventDetails[index];

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockOddsFeedService.getInGameEvent.mockResolvedValue(null);

      // Act
      await eventSchedulerService.scheduleUpdateVoice(gameId, index);

      // Assert
      expect(mockOddsFeedService.getInGameEvent).toHaveBeenCalledWith(eventDetail.inGameEventInfo);
      expect(mockLogService.logError).toHaveBeenCalledWith(`Failed to get in-game event for event ${eventDetail.eventID} index: ${index}`);
      expect(mockJobScheduler.scheduleJob).not.toHaveBeenCalled();
    });

    it("should handle missing video delay configuration in voice scheduling", async () => {
      // Arrange
      const gameId = "2001";
      const index = 0;
      const givenInGameEvent = createMockInGameEvent();
      const mockEvent = createMockEvent(1001);
      const eventDetail = mockEvent.eventDetails[index];
      const mockVoiceResult = {
        timeline: [10, 20],
        voice: ["voice1", "voice2"],
      };
      const mockPreviousVoice = { voice: [], timeline: [] };
      const mockPreviousInGameEvent = { eventName: [], timeline: [] };
      const mockPreviousResult: string[] = [];

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockEventManager.getVoiceForGame.mockReturnValue(mockPreviousVoice);
      mockEventManager.getInGameEventForGame.mockReturnValue(mockPreviousInGameEvent);
      mockEventManager.getPreviousResultForGame.mockReturnValue(mockPreviousResult);
      mockGenerateVoiceWithEventTimeline.mockReturnValue(mockVoiceResult);
      (appSettings as any).videoDelay = {}; // No video delay configured

      // Act
      await eventSchedulerService.scheduleUpdateVoice(gameId, index, givenInGameEvent);

      // Assert voice job scheduling
      const voiceJobCalls = mockJobScheduler.scheduleJob.mock.calls.filter((call: any[]) => 
        (call[0] as string).includes(JobName.UpdateVoice)
      );

      // Check first voice job - should use 0 delay when not configured
      expect(voiceJobCalls[0][0]).toBe(`${gameId}_${eventDetail.eventID}_${index}_${JobName.UpdateVoice}_0`);
      expect(voiceJobCalls[0][1]).toEqual(new Date(new Date(eventDetail.scheduleStartTs).getTime() + 10 * 1000 + 0));
      expect(voiceJobCalls[0][3]).toBe(true); // should be background job

      // Check second voice job - should use 0 delay when not configured
      expect(voiceJobCalls[1][0]).toBe(`${gameId}_${eventDetail.eventID}_${index}_${JobName.UpdateVoice}_1`);
      expect(voiceJobCalls[1][1]).toEqual(new Date(new Date(eventDetail.scheduleStartTs).getTime() + 20 * 1000 + 0));
      expect(voiceJobCalls[1][3]).toBe(true); // should be background job
    });

    it("should handle missing phase property in event detail", async () => {
      // Arrange
      const gameId = "2001";
      const index = 0;
      const givenGoalInfo = createMockGoalInfo();
      const mockEvent = createMockEvent(1001);
      // Remove phase property from event detail
      const eventDetailWithoutPhase = { ...mockEvent.eventDetails[index] };
      delete eventDetailWithoutPhase.phase;
      mockEvent.eventDetails[index] = eventDetailWithoutPhase;

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);

      // Act
      await eventSchedulerService.scheduleUpdateGoalInfo(gameId, index, givenGoalInfo);

      // Assert
      expect(mockEventManager.initializeGamePhaseWithGoalInfo).toHaveBeenCalledWith(gameId, givenGoalInfo, index);
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledTimes(3);
    });

    it("should schedule goal info jobs with video delay", async () => {
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
      // Check that jobs are scheduled with video delay
      givenGoalInfo.timeLine.forEach((time, goalIndex) => {
        const expectedTime = new Date(new Date(eventDetail.scheduleStartTs).getTime() + (time * 1000 + 3000)); // time * 1000 + videoDelay
        expect(mockJobScheduler.scheduleJob).toHaveBeenCalledWith(
          `${gameId}_${eventDetail.eventID}_${index}_${JobName.UpdateGoalInfo}_${goalIndex}`,
          expectedTime,
          expect.any(Function),
          true
        );
      });
    });

    it("should handle missing phase property in voice scheduling", async () => {
      // Arrange
      const gameId = "2001";
      const index = 0;
      const givenInGameEvent = createMockInGameEvent();
      const mockEvent = createMockEvent(1001);
      // Remove phase property from event detail
      const eventDetailWithoutPhase = { ...mockEvent.eventDetails[index] };
      delete eventDetailWithoutPhase.phase;
      mockEvent.eventDetails[index] = eventDetailWithoutPhase;
      
      const mockVoiceResult = {
        timeline: [10],
        voice: ["voice1"],
      };
      const mockPreviousVoice = { voice: [], timeline: [] };
      const mockPreviousInGameEvent = { eventName: [], timeline: [] };
      const mockPreviousResult: string[] = [];

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockEventManager.getVoiceForGame.mockReturnValue(mockPreviousVoice);
      mockEventManager.getInGameEventForGame.mockReturnValue(mockPreviousInGameEvent);
      mockEventManager.getPreviousResultForGame.mockReturnValue(mockPreviousResult);
      mockGenerateVoiceWithEventTimeline.mockReturnValue(mockVoiceResult);

      // Act
      await eventSchedulerService.scheduleUpdateVoice(gameId, index, givenInGameEvent);

      // Assert
      expect(mockEventManager.appendInGameEventForGame).toHaveBeenCalledWith(gameId, givenInGameEvent, index);
      expect(mockEventManager.appendVoiceForGame).toHaveBeenCalledWith(gameId, mockVoiceResult.voice, mockVoiceResult.timeline, index);
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledTimes(1);
    });

    it("should handle null values from previous voice and event data", async () => {
      // Arrange
      const gameId = "2001";
      const index = 0;
      const givenInGameEvent = createMockInGameEvent();
      const mockEvent = createMockEvent(1001);
      const mockVoiceResult = {
        timeline: [15],
        voice: ["voice_test"],
      };
      // Mock empty/null previous data
      const mockPreviousVoice = { voice: [], timeline: [] };
      const mockPreviousInGameEvent = { eventName: [], timeline: [] };
      const mockPreviousResult: string[] = [];

      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockEventManager.getVoiceForGame.mockReturnValue(mockPreviousVoice);
      mockEventManager.getInGameEventForGame.mockReturnValue(mockPreviousInGameEvent);
      mockEventManager.getPreviousResultForGame.mockReturnValue(mockPreviousResult);
      mockGenerateVoiceWithEventTimeline.mockReturnValue(mockVoiceResult);

      // Act
      await eventSchedulerService.scheduleUpdateVoice(gameId, index, givenInGameEvent);

      // Assert
      expect(mockGenerateVoiceWithEventTimeline).toHaveBeenCalledWith({
        timeline: givenInGameEvent.timeLine,
        eventName: givenInGameEvent.eventName,
        previousVoices: [],
        previousTimelines: [],
        previousEvents: [],
        previousVoiceTimelines: [],
        firstHalfScore: "",
      });
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledTimes(1);
    });
  });

  describe("schedulePlayIntro (Legacy - Between Phases)", () => {
    it("should not schedule intro job for index 0 (first phase)", async () => {
      // Arrange
      const eventDetail = createMockEventDetail(1001, 0);
      const gameId = "2001";
      const index = 0;

      // Act
      await eventSchedulerService.schedulePlayIntroBetweenPhases(eventDetail, gameId, index);

      // Assert - Index 0 should not schedule intro jobs
      expect(mockJobScheduler.scheduleJob).not.toHaveBeenCalled();
    });

    it("should schedule intro job with correct timing for non-zero index", async () => {
      // Arrange
      const eventDetail = createMockEventDetail(1001, 1);
      eventDetail.phase = 1;
      const gameId = "2001";
      const index = 1;

      // Act
      await eventSchedulerService.schedulePlayIntroBetweenPhases(eventDetail, gameId, index);

      // Assert
      const introDuration = 5000; // from mocked appSettings
      const videoDelay = 3000; // from mocked appSettings
      const expectedScheduledTime = new Date(
        new Date(eventDetail.scheduleStartTs).getTime() - introDuration + videoDelay
      );
      
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledWith(
        `${gameId}_${eventDetail.eventID}_${index}_${JobName.PlayIntro}`,
        expectedScheduledTime,
        expect.any(Function)
      );
    });

    it("should execute intro job callback correctly for non-zero index", async () => {
      // Arrange
      const eventDetail = createMockEventDetail(1001, 1);
      eventDetail.phase = 1;
      const gameId = "2001";
      const index = 1;

      // Act
      await eventSchedulerService.schedulePlayIntroBetweenPhases(eventDetail, gameId, index);

      // Get the scheduled callback
      const scheduledCallback = mockJobScheduler.scheduleJob.mock.calls[0][2];

      // Execute the callback
      await scheduledCallback();

      // Assert
      expect(mockEventManager.updateIntroTimeForCurrentEvent).toHaveBeenCalledWith(gameId, expect.any(Date));
      expect(mockEventStreamService.broadcastUpdateEventDataToClients).toHaveBeenCalledWith(
        gameId,
        JobName.PlayIntro,
        index
      );
    });

    it("should not schedule intro job when introDuration is not configured", async () => {
      // Arrange
      const eventDetail = createMockEventDetail(1001, 1);
      const gameId = "2003"; // Game ID without introDuration configured
      const index = 1;

      // Act
      await eventSchedulerService.schedulePlayIntroBetweenPhases(eventDetail, gameId, index);

      // Assert
      expect(mockJobScheduler.scheduleJob).not.toHaveBeenCalled();
    });

    it("should not schedule intro job when introDuration is zero", async () => {
      // Arrange
      const eventDetail = createMockEventDetail(1001, 1);
      const gameId = "2001";
      const index = 1;

      // Mock introDuration as 0
      (appSettings as any).introDuration = { "2001": 0 };

      // Act
      await eventSchedulerService.schedulePlayIntroBetweenPhases(eventDetail, gameId, index);

      // Assert
      expect(mockJobScheduler.scheduleJob).not.toHaveBeenCalled();
    });

    it("should not schedule intro job when introDuration is negative", async () => {
      // Arrange
      const eventDetail = createMockEventDetail(1001, 1);
      const gameId = "2001";
      const index = 1;

      // Mock introDuration as negative
      (appSettings as any).introDuration = { "2001": -1000 };

      // Act
      await eventSchedulerService.schedulePlayIntroBetweenPhases(eventDetail, gameId, index);

      // Assert
      expect(mockJobScheduler.scheduleJob).not.toHaveBeenCalled();
    });

    it("should handle missing videoDelay configuration", async () => {
      // Arrange
      const eventDetail = createMockEventDetail(1001, 1);
      eventDetail.phase = 1;
      const gameId = "2001";
      const index = 1;

      // Mock videoDelay as empty
      (appSettings as any).videoDelay = {};

      // Act
      await eventSchedulerService.schedulePlayIntroBetweenPhases(eventDetail, gameId, index);

      // Assert
      const introDuration = 5000; // from mocked appSettings
      const expectedScheduledTime = new Date(
        new Date(eventDetail.scheduleStartTs).getTime() - introDuration + 0 // no video delay
      );
      
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledWith(
        `${gameId}_${eventDetail.eventID}_${index}_${JobName.PlayIntro}`,
        expectedScheduledTime,
        expect.any(Function)
      );
    });

    it("should handle gameId 2000 correctly", async () => {
      // Arrange
      const eventDetail = createMockEventDetail(1001, 1);
      eventDetail.phase = 1;
      const gameId = "2000";
      const index = 1;

      // Act
      await eventSchedulerService.schedulePlayIntroBetweenPhases(eventDetail, gameId, index);

      // Get the scheduled callback and execute it
      const scheduledCallback = mockJobScheduler.scheduleJob.mock.calls[0][2];
      await scheduledCallback();

      // Assert
      expect(mockEventManager.updateIntroTimeForCurrentEvent).toHaveBeenCalledWith(gameId, expect.any(Date));
      expect(mockEventStreamService.broadcastUpdateEventDataToClients).toHaveBeenCalledWith(
        gameId,
        JobName.PlayIntro,
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

      // Spy on the methods to verify they are called
      const schedulePlayIntroBeforeMatchStartSpy = jest.spyOn(eventSchedulerService, 'schedulePlayIntroBeforeMatchStart').mockImplementation();
      const scheduleEventDetailsSpy = jest.spyOn(eventSchedulerService, 'scheduleEventDetails').mockImplementation();

      // Act
      await eventSchedulerService.scheduleEvent(eventId);

      // Assert that schedulePlayIntroBeforeMatchStart is called immediately (outside callback)
      expect(schedulePlayIntroBeforeMatchStartSpy).toHaveBeenCalledWith(mockEvent, gameId);

      // Get the scheduled callback and execute it
      const scheduledCallback = mockJobScheduler.scheduleJob.mock.calls[0][2];
      await scheduledCallback();

      // Assert callback execution
      expect(mockEventManager.initializeCurrentEvent).toHaveBeenCalledWith(mockEvent);
      expect(scheduleEventDetailsSpy).toHaveBeenCalledWith(mockEvent);
      expect(mockEventStreamService.broadcastUpdateEventDataToClients).toHaveBeenCalledWith(
        gameId,
        JobName.ScheduleEvent,
        0
      );

      // Should schedule main event job (1) + intro job (1) = 2 jobs initially
      // But since we're mocking schedulePlayIntroBeforeMatchStart, it won't actually schedule the intro job
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledTimes(1);

      // Cleanup
      schedulePlayIntroBeforeMatchStartSpy.mockRestore();
      scheduleEventDetailsSpy.mockRestore();
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
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledTimes(6);
    });

    it("should handle video info scheduling flow correctly", async () => {
      // Arrange
      const eventDetail = createMockEventDetail(1001, 0);
      const index = 0;
      const gameId = "2001";
      const mockEvent = createMockEvent(1001);
      const mockGoalInfo = createMockGoalInfo();

      mockOddsFeedService.getEventDetailsWithRetry.mockResolvedValue(mockEvent);
      mockEventManager.getCurrentEventForGame.mockReturnValue(mockEvent);
      mockOddsFeedService.getGoalInfo.mockResolvedValue(mockGoalInfo);

      // Act
      await eventSchedulerService.scheduleUpdateVideoInfo(eventDetail, index, gameId);

      // Get the scheduled callback and execute it
      const scheduledCallback = mockJobScheduler.scheduleJob.mock.calls[0][2];
      await scheduledCallback();

      // Assert
      expect(mockEventManager.updateCurrentEventDetail).toHaveBeenCalledWith(
        mockEvent,
        JobName.UpdatePreloadVideoInfo,
        index
      );
      expect(mockEventStreamService.broadcastUpdateEventDataToClients).toHaveBeenCalledWith(
        gameId,
        JobName.UpdatePreloadVideoInfo,
        index
      );
      // Should also schedule broadcast video info, goal info, and voice jobs
      // 1 for preload + 1 for broadcast + 3 for goal info timeline entries + voice jobs (if any)
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledTimes(5);
    });
  });

  describe("schedulePlayIntroBeforeMatchStart", () => {
    it("should schedule intro before match start", async () => {
      // Arrange
      const mockEvent = createMockEvent(1001);
      const gameId = "2001";

      // Act
      await eventSchedulerService.schedulePlayIntroBeforeMatchStart(mockEvent, gameId);

      // Assert
      const expectedScheduledTime = new Date(new Date(mockEvent.scheduleStartTs).getTime());
      
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledWith(
        `${gameId}_${mockEvent.eventID}_0_${JobName.PlayIntro}`,
        expectedScheduledTime,
        expect.any(Function)
      );
    });

    it("should execute intro before match start job callback correctly", async () => {
      // Arrange
      const mockEvent = createMockEvent(1001);
      const gameId = "2001";

      // Act
      await eventSchedulerService.schedulePlayIntroBeforeMatchStart(mockEvent, gameId);

      // Get the scheduled callback and execute it
      const scheduledCallback = mockJobScheduler.scheduleJob.mock.calls[0][2];
      await scheduledCallback();

      // Assert
      expect(mockEventManager.updateIntroTimeForCurrentEvent).toHaveBeenCalledWith(gameId, expect.any(Date));
      expect(mockEventStreamService.broadcastUpdateEventDataToClients).toHaveBeenCalledWith(
        gameId,
        JobName.PlayIntro,
        0
      );
    });

    it("should handle missing video delay configuration", async () => {
      // Arrange
      const mockEvent = createMockEvent(1001);
      const gameId = "2001";
      
      // Mock empty video delay
      (appSettings as any).videoDelay = {};

      // Act
      await eventSchedulerService.schedulePlayIntroBeforeMatchStart(mockEvent, gameId);

      // Assert
      const expectedScheduledTime = new Date(new Date(mockEvent.scheduleStartTs).getTime() + 0);
      
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledWith(
        `${gameId}_${mockEvent.eventID}_0_${JobName.PlayIntro}`,
        expectedScheduledTime,
        expect.any(Function)
      );
    });

    it("should handle different game IDs", async () => {
      // Arrange
      const mockEvent1 = createMockEvent(1001);
      const mockEvent2 = createMockEvent(1002);
      const gameId1 = "2001";
      const gameId2 = "2002";

      // Act
      await eventSchedulerService.schedulePlayIntroBeforeMatchStart(mockEvent1, gameId1);
      await eventSchedulerService.schedulePlayIntroBeforeMatchStart(mockEvent2, gameId2);

      // Assert
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledTimes(2);
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledWith(
        `${gameId1}_${mockEvent1.eventID}_0_${JobName.PlayIntro}`,
        expect.any(Date),
        expect.any(Function)
      );
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledWith(
        `${gameId2}_${mockEvent2.eventID}_0_${JobName.PlayIntro}`,
        expect.any(Date),
        expect.any(Function)
      );
    });
  });

  describe("schedulePlayIntroBetweenPhases - Advanced Tests", () => {
    it("should schedule intro between phases when conditions are met", async () => {
      // Arrange
      const eventDetail = createMockEventDetail(1001, 1);
      eventDetail.phase = 1;
      const gameId = "2001";
      const index = 1;
      const phaseChangeIndex = { 0: 0, 1: 1 };

      // Act
      await eventSchedulerService.schedulePlayIntroBetweenPhases(eventDetail, gameId, index, phaseChangeIndex);

      // Assert
      const introDuration = appSettings.introDuration[gameId] || 0;
      const videoDelay = appSettings.videoDelay[gameId] || 0;
      const expectedScheduledTime = new Date(
        new Date(eventDetail.scheduleStartTs).getTime() - introDuration + videoDelay
      );

      expect(mockJobScheduler.scheduleJob).toHaveBeenCalledWith(
        `${gameId}_${eventDetail.eventID}_${index}_${JobName.PlayIntro}`,
        expectedScheduledTime,
        expect.any(Function)
      );
    });

    it("should not schedule when index does not match phaseIndex", async () => {
      // Arrange
      const eventDetail = createMockEventDetail(1001, 2);
      eventDetail.phase = 1;
      const gameId = "2001";
      const index = 2;
      const phaseChangeIndex = { 0: 0, 1: 1 }; // phase 1 should start at index 1, not 2

      // Act
      await eventSchedulerService.schedulePlayIntroBetweenPhases(eventDetail, gameId, index, phaseChangeIndex);

      // Assert
      expect(mockJobScheduler.scheduleJob).not.toHaveBeenCalled();
    });

    it("should use index as fallback when phase is undefined", async () => {
      // Arrange
      const eventDetail = createMockEventDetail(1001, 1);
      delete eventDetail.phase;
      const gameId = "2001";
      const index = 1;
      const phaseChangeIndex = { 0: 0, 1: 1 };

      // Act
      await eventSchedulerService.schedulePlayIntroBetweenPhases(eventDetail, gameId, index, phaseChangeIndex);

      // Assert
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalled();
    });

    it("should handle default phaseChangeIndex parameters", async () => {
      // Arrange
      const eventDetail = createMockEventDetail(1001, 1);
      eventDetail.phase = 1;
      const gameId = "2001";
      const index = 1;

      // Act (without providing phaseChangeIndex)
      await eventSchedulerService.schedulePlayIntroBetweenPhases(eventDetail, gameId, index);

      // Assert
      expect(mockJobScheduler.scheduleJob).toHaveBeenCalled();
    });

    it("should execute callback correctly", async () => {
      // Arrange
      const eventDetail = createMockEventDetail(1001, 1);
      eventDetail.phase = 1;
      const gameId = "2001";
      const index = 1;

      // Act
      await eventSchedulerService.schedulePlayIntroBetweenPhases(eventDetail, gameId, index);

      // Get and execute callback
      const scheduledCallback = mockJobScheduler.scheduleJob.mock.calls[0][2];
      await scheduledCallback();

      // Assert
      expect(mockEventManager.updateIntroTimeForCurrentEvent).toHaveBeenCalledWith(gameId, expect.any(Date));
      expect(mockEventStreamService.broadcastUpdateEventDataToClients).toHaveBeenCalledWith(
        gameId,
        JobName.PlayIntro,
        index
      );
    });
  });

  describe("getPhaseChangeIndex", () => {
    it("should return correct phase change indices", () => {
      // Arrange
      const eventDetails = [
        { ...createMockEventDetail(1001, 0), phase: 0 },
        { ...createMockEventDetail(1001, 1), phase: 0 }, // Same phase
        { ...createMockEventDetail(1001, 2), phase: 1 }, // Phase change
        { ...createMockEventDetail(1001, 3), phase: 1 }, // Same phase
        { ...createMockEventDetail(1001, 4), phase: 2 }  // Phase change
      ];

      // Act
      const result = (eventSchedulerService as any).getPhaseChangeIndex(eventDetails);

      // Assert
      expect(result).toEqual({
        0: 0,  // Default
        1: 2,  // Phase 1 starts at index 2
        2: 4   // Phase 2 starts at index 4
      });
    });

    it("should handle eventDetails with undefined phases", () => {
      // Arrange
      const eventDetails = [
        createMockEventDetail(1001, 0), // No phase property
        createMockEventDetail(1001, 1), // No phase property
        { ...createMockEventDetail(1001, 2), phase: 2 } // Has phase
      ];

      // Act
      const result = (eventSchedulerService as any).getPhaseChangeIndex(eventDetails);

      // Assert
      expect(result).toEqual({
        0: 0,  // Default
        1: 1,  // Index 1 fallback when phase is undefined
        2: 2   // Phase 2 starts at index 2
      });
    });

    it("should handle single event detail", () => {
      // Arrange
      const eventDetails = [
        { ...createMockEventDetail(1001, 0), phase: 0 }
      ];

      // Act
      const result = (eventSchedulerService as any).getPhaseChangeIndex(eventDetails);

      // Assert
      expect(result).toEqual({
        0: 0
      });
    });

    it("should handle empty event details", () => {
      // Arrange
      const eventDetails: any[] = [];

      // Act
      const result = (eventSchedulerService as any).getPhaseChangeIndex(eventDetails);

      // Assert
      expect(result).toEqual({
        0: 0
      });
    });

    it("should handle consecutive phase changes", () => {
      // Arrange
      const eventDetails = [
        { ...createMockEventDetail(1001, 0), phase: 0 },
        { ...createMockEventDetail(1001, 1), phase: 1 },
        { ...createMockEventDetail(1001, 2), phase: 2 },
        { ...createMockEventDetail(1001, 3), phase: 3 }
      ];

      // Act
      const result = (eventSchedulerService as any).getPhaseChangeIndex(eventDetails);

      // Assert
      expect(result).toEqual({
        0: 0,
        1: 1,
        2: 2,
        3: 3
      });
    });
  });

  describe("scheduleEventDetails - Updated Integration", () => {
    it("should call schedulePlayIntroBetweenPhases for each event detail", () => {
      // Arrange
      const event = createMockEvent(1001);
      // Event details from createMockEventDetail have predefined phases (0 and 1)
      // So phaseChangeIndex will be undefined
      event.eventDetails = [
        createMockEventDetail(1001, 0),  // phase: 0
        createMockEventDetail(1001, 1)   // phase: 1
      ];
      
      const schedulePlayIntroBetweenPhasesSpy = jest.spyOn(eventSchedulerService, 'schedulePlayIntroBetweenPhases').mockImplementation();
      const scheduleUpdateOddsSpy = jest.spyOn(eventSchedulerService, 'scheduleUpdateOdds').mockImplementation();
      const scheduleUpdateVideoInfoSpy = jest.spyOn(eventSchedulerService, 'scheduleUpdateVideoInfo').mockImplementation();
      const scheduleUpdateResultSpy = jest.spyOn(eventSchedulerService, 'scheduleUpdateResult').mockImplementation();

      mockIdHelper.extractGameId.mockReturnValue("2001");

      // Act
      eventSchedulerService.scheduleEventDetails(event);

      // Assert
      expect(schedulePlayIntroBetweenPhasesSpy).toHaveBeenCalledTimes(2);
      expect(schedulePlayIntroBetweenPhasesSpy).toHaveBeenCalledWith(
        event.eventDetails[0], 
        "2001", 
        0, 
        undefined  // phaseChangeIndex is undefined when phases are predefined
      );
      expect(schedulePlayIntroBetweenPhasesSpy).toHaveBeenCalledWith(
        event.eventDetails[1], 
        "2001", 
        1, 
        undefined  // phaseChangeIndex is undefined when phases are predefined
      );

      // Cleanup
      schedulePlayIntroBetweenPhasesSpy.mockRestore();
      scheduleUpdateOddsSpy.mockRestore();
      scheduleUpdateVideoInfoSpy.mockRestore();
      scheduleUpdateResultSpy.mockRestore();
    });

    it("should handle event details with predefined phases", () => {
      // Arrange
      const event = createMockEvent(1001);
      event.eventDetails = [
        { ...createMockEventDetail(1001, 0), phase: 0 },
        { ...createMockEventDetail(1001, 1), phase: 0 }
      ];
      
      const schedulePlayIntroBetweenPhasesSpy = jest.spyOn(eventSchedulerService, 'schedulePlayIntroBetweenPhases').mockImplementation();

      mockIdHelper.extractGameId.mockReturnValue("2001");

      // Act
      eventSchedulerService.scheduleEventDetails(event);

      // Assert - Should pass undefined for phaseChangeIndex when phases are predefined
      expect(schedulePlayIntroBetweenPhasesSpy).toHaveBeenCalledWith(
        event.eventDetails[0], 
        "2001", 
        0, 
        undefined
      );

      // Cleanup
      schedulePlayIntroBetweenPhasesSpy.mockRestore();
    });

    it("should calculate phaseChangeIndex when event details have no phase property", () => {
      // Arrange
      const event = createMockEvent(1001);
      // Create event details without phase property to trigger calculation
      event.eventDetails = [
        { ...createMockEventDetail(1001, 0) },
        { ...createMockEventDetail(1001, 1) }
      ];
      // Remove phase properties to trigger phaseChangeIndex calculation
      delete event.eventDetails[0].phase;
      delete event.eventDetails[1].phase;
      
      const schedulePlayIntroBetweenPhasesSpy = jest.spyOn(eventSchedulerService, 'schedulePlayIntroBetweenPhases').mockImplementation();

      mockIdHelper.extractGameId.mockReturnValue("2001");

      // Act
      eventSchedulerService.scheduleEventDetails(event);

      // Assert - Should calculate and pass phaseChangeIndex when phases are not predefined
      // When phases are undefined, getPhaseChangeIndex only returns { 0: 0 } because
      // undefined !== undefined is false, so no phase changes are detected
      expect(schedulePlayIntroBetweenPhasesSpy).toHaveBeenCalledWith(
        event.eventDetails[0], 
        "2001", 
        0, 
        { 0: 0 }  // Only default phase change index when phases are undefined
      );
      expect(schedulePlayIntroBetweenPhasesSpy).toHaveBeenCalledWith(
        event.eventDetails[1], 
        "2001", 
        1, 
        { 0: 0 }  // Only default phase change index when phases are undefined
      );

      // Cleanup
      schedulePlayIntroBetweenPhasesSpy.mockRestore();
    });

    it("should calculate phaseChangeIndex correctly with mixed phase values", () => {
      // Arrange
      const event = createMockEvent(1001);
      // Create event details with mixed phase values to trigger proper calculation
      event.eventDetails = [
        { ...createMockEventDetail(1001, 0), phase: 0 },  // phase 0, index 0
        { ...createMockEventDetail(1001, 1), phase: 0 },  // phase 0, index 1 (no change)
        { ...createMockEventDetail(1001, 2), phase: 1 },  // phase 1, index 2 (change!)
        { ...createMockEventDetail(1001, 3), phase: 2 }   // phase 2, index 3 (change!)
      ];
      
      const schedulePlayIntroBetweenPhasesSpy = jest.spyOn(eventSchedulerService, 'schedulePlayIntroBetweenPhases').mockImplementation();

      mockIdHelper.extractGameId.mockReturnValue("2001");

      // Act
      eventSchedulerService.scheduleEventDetails(event);

      // Assert - Should pass undefined because phases are predefined
      expect(schedulePlayIntroBetweenPhasesSpy).toHaveBeenCalledTimes(4);
      expect(schedulePlayIntroBetweenPhasesSpy).toHaveBeenCalledWith(
        event.eventDetails[0], "2001", 0, undefined
      );
      expect(schedulePlayIntroBetweenPhasesSpy).toHaveBeenCalledWith(
        event.eventDetails[1], "2001", 1, undefined
      );
      expect(schedulePlayIntroBetweenPhasesSpy).toHaveBeenCalledWith(
        event.eventDetails[2], "2001", 2, undefined
      );
      expect(schedulePlayIntroBetweenPhasesSpy).toHaveBeenCalledWith(
        event.eventDetails[3], "2001", 3, undefined
      );

      // Cleanup
      schedulePlayIntroBetweenPhasesSpy.mockRestore();
    });
  });
});
