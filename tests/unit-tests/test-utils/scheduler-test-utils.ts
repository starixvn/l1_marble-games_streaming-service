import { Scheduler } from "odds-feed-client";

// Extract the last scheduled callback from the mock scheduler
export const getLastScheduledCallback = (scheduler: jest.Mocked<Scheduler>): Function | undefined => {
    const calls = scheduler.schedule.mock.calls;
    if (!calls.length) return undefined;
    const [, cb] = calls[calls.length - 1];
    return cb as Function | undefined;
};

// Execute the last scheduled callback, if any
export const runLastScheduledCallback = (scheduler: jest.Mocked<Scheduler>): void => {
    const cb = getLastScheduledCallback(scheduler);
    if (typeof cb === "function") {
        cb();
    }
};

// Clear recorded schedule calls
export const clearScheduler = (scheduler: jest.Mocked<Scheduler>): void => {
    scheduler.schedule.mockClear();
};


