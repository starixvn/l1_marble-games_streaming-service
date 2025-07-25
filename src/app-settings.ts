export const appSettings = {
  gameIds: ["2001", "2002", "2003"],
  videoLength: {
    // in seconds
    "2001": 30,
    "2002": 30,
    "2003": 30,
  } as Record<string, number>,

  scheduleDelay: {
    // in milliseconds
    "2001": 10 * 1000,
    "2002": 10 * 1000,
    "2003": 10 * 1000,
  } as Record<string, number>,
};
