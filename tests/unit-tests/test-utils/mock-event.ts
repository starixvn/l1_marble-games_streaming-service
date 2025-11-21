import { Event, EventDetail } from "../../../src/types";

export interface MockEventOptions {
  eventID?: number;
  eventNameAKey?: string;
  eventNameBKey?: string;
  theme?: string;
  scheduleStartTs?: string;
  scheduleEndTs?: string;
  productCode?: string;
  productTypeKey?: string;
  voiceConfig?: string;
  eventDetails?: EventDetail[];
  now?: string;
}

export interface MockEventDetailOptions {
  eventID?: number;
  oddsAvailableTs?: string;
  scheduleStartTs?: string;
  resultsAvailableTs?: string;
  hasResults?: boolean;
  goalInfo?: string;
  playlist?: string;
  result?: string;
  markets?: any;
  inGameEventInfo?: string;
  phase?: number;
}

/**
 * Creates a mock EventDetail for testing purposes
 */
export const createMockEventDetail = (options: MockEventDetailOptions = {}): EventDetail => ({
  eventID: options.eventID ?? 1,
  oddsAvailableTs: options.oddsAvailableTs ?? "2024-01-01T10:00:00Z",
  scheduleStartTs: options.scheduleStartTs ?? "2024-01-01T10:00:30Z",
  resultsAvailableTs: options.resultsAvailableTs ?? "2024-01-01T10:01:00Z",
  hasResults: options.hasResults ?? false,
  goalInfo: options.goalInfo ?? "{}",
  playlist: options.playlist ?? "https://example.com/playlist.m3u8",
  result: options.result ?? "",
  markets: options.markets ?? {},
  inGameEventInfo: options.inGameEventInfo ?? "{}",
  phase: options.phase ?? 1,
});

/**
 * Creates a mock Event for testing purposes
 */
export const createMockEvent = (options: MockEventOptions = {}): Event & { now?: string } => {
  const eventID = options.eventID ?? 1;
  const scheduleStartTs = options.scheduleStartTs ?? "2024-01-01T10:00:00Z";

  // Create default event details if not provided
  const defaultEventDetails = [
    createMockEventDetail({
      eventID,
      scheduleStartTs,
      playlist: "https://example.com/playlist1.m3u8",
      phase: 1,
    }),
    createMockEventDetail({
      eventID,
      scheduleStartTs,
      playlist: "https://example.com/playlist2.m3u8",
      phase: 2,
    }),
  ];

  return {
    eventID,
    eventConfig: (options as any)?.eventConfig ?? null,
    eventNameAKey: options.eventNameAKey ?? "Team A",
    eventNameBKey: options.eventNameBKey ?? "Team B",
    theme: options.theme,
    scheduleStartTs,
    scheduleEndTs: options.scheduleEndTs,
    productCode: options.productCode ?? "TEST",
    productTypeKey: options.productTypeKey ?? "MARBLE",
    eventDetails: options.eventDetails ?? defaultEventDetails,
    config: (options as any)?.config ?? null,
    voiceConfig: options.voiceConfig,
    now: options.now ?? new Date(scheduleStartTs).toISOString(),
  } as any;
};

/**
 * Helper to create a simple mock event with just eventID and basic details
 */
export const createSimpleMockEvent = (eventID: number, teamA = "Team A", teamB = "Team B"): Event => {
  return createMockEvent({
    eventID,
    eventNameAKey: teamA,
    eventNameBKey: teamB,
  });
};

/**
 * Helper to create a mock event with custom playlist URLs
 */
export const createMockEventWithPlaylists = (eventID: number, scheduleStartTs: string, playlist: string): Event => {
  return createMockEvent({
    eventID,
    scheduleStartTs,
    eventDetails: [
      createMockEventDetail({
        eventID,
        scheduleStartTs,
        playlist,
        phase: 1,
      }),
      createMockEventDetail({
        eventID,
        scheduleStartTs,
        playlist: playlist + "_phase2",
        phase: 2,
      }),
    ],
  });
};

/**
 * Helper to create a mock event with empty event details
 */
export const createMockEventWithoutDetails = (eventID: number): Event => {
  return createMockEvent({
    eventID,
    eventDetails: [],
  });
};
