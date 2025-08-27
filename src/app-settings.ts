export const appSettings = {
  gameIds: ["2000"],
  videoLength: {
    // in seconds
    "2000": 30,
    "2001": 30,
    "2002": 30,
    "2003": 30,
    "2004": 10,
  } as Record<string, number>,

  scheduleDelay: {
    // in milliseconds
    "2001": 10 * 1000,
    "2002": 10 * 1000,
    "2003": 10 * 1000,
  } as Record<string, number>,

  videoDelay: {
    // in milliseconds
    "2000": 3 * 1000,
    "2001": 3 * 1000,
    "2002": 3 * 1000,
    "2003": 3 * 1000,
  } as Record<string, number>,
};
