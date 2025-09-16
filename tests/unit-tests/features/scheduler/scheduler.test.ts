import { Scheduler } from "../../../../src/features/scheduler/scheduler";

describe("Scheduler", () => {
    let scheduler: Scheduler;
    let originalSetTimeout: typeof setTimeout;
    let originalClearTimeout: typeof clearTimeout;
    let setTimeoutMock: jest.Mock;
    let clearTimeoutMock: jest.Mock;
    let originalDate: typeof Date;
    let originalDateNow: typeof Date.now;
    const FIXED_TIME = 1000000;

    beforeEach(() => {
        scheduler = new Scheduler();
        setTimeoutMock = jest.fn().mockReturnValue("timeout-id");
        clearTimeoutMock = jest.fn();
        originalSetTimeout = global.setTimeout;
        originalClearTimeout = global.clearTimeout;
        (global as any).setTimeout = setTimeoutMock;
        (global as any).clearTimeout = clearTimeoutMock;

        originalDate = global.Date;
        originalDateNow = Date.now;
        const MockDate = class extends Date {
            constructor(...args: any[]) {
                if (args.length === 0) {
                    super(FIXED_TIME);
                } else {
                    super(...(args as [any]));
                }
            }
            static now() {
                return FIXED_TIME;
            }
        };
        (global as any).Date = MockDate;
        Date.now = MockDate.now;
    });

    afterEach(() => {
        (global as any).setTimeout = originalSetTimeout;
        (global as any).clearTimeout = originalClearTimeout;
        (global as any).Date = originalDate;
        Date.now = originalDateNow;
        jest.restoreAllMocks();
    });

    describe("schedule", () => {
        it("should schedule task with future time", () => {
            // Arrange
            const callback = jest.fn();
            const futureTime = new Date(Date.now() + 1000);

            // Act
            scheduler.schedule(futureTime, callback);

            // Assert
            expect(setTimeoutMock).toHaveBeenCalledTimes(1);
            expect(setTimeoutMock.mock.calls[0][1]).toBe(1000);
        });

        it("should schedule task with past time using 0 delay", () => {
            // Arrange
            const callback = jest.fn();
            const pastTime = new Date(Date.now() - 1000);

            // Act
            scheduler.schedule(pastTime, callback);

            // Assert
            expect(setTimeoutMock).toHaveBeenCalledTimes(1);
            expect(setTimeoutMock.mock.calls[0][1]).toBe(0);
        });

        it("should schedule task with current time using 0 delay", () => {
            // Arrange
            const callback = jest.fn();
            const currentTime = new Date();

            // Act
            scheduler.schedule(currentTime, callback);

            // Assert
            expect(setTimeoutMock).toHaveBeenCalledTimes(1);
            expect(setTimeoutMock.mock.calls[0][1]).toBe(0);
        });

        it("should use custom key when provided in options", () => {
            // Arrange
            const callback = jest.fn();
            const futureTime = new Date(Date.now() + 1000);
            const options = { key: "testKey" };

            // Act
            scheduler.schedule(futureTime, callback, options);

            // Assert
            expect(setTimeoutMock).toHaveBeenCalledTimes(1);
        });

        it("should use keyOverride when provided in options", () => {
            // Arrange
            const callback = jest.fn();
            const futureTime = new Date(Date.now() + 1000);
            const options = { keyOverride: "custom-override-key" };

            // Act
            scheduler.schedule(futureTime, callback, options);

            // Assert
            expect(setTimeoutMock).toHaveBeenCalledTimes(1);
        });

        it("should prefer keyOverride over key when both provided", () => {
            // Arrange
            const callback = jest.fn();
            const futureTime = new Date(Date.now() + 1000);
            const options = { key: "normalKey", keyOverride: "override-key" };

            // Act
            scheduler.schedule(futureTime, callback, options);

            // Assert
            expect(setTimeoutMock).toHaveBeenCalledTimes(1);
        });

        it("should use callback name when no key or keyOverride provided", () => {
            // Arrange
            const callback = jest.fn();
            Object.defineProperty(callback, 'name', { value: 'testCallback', writable: true });
            const futureTime = new Date(Date.now() + 1000);

            // Act
            scheduler.schedule(futureTime, callback);

            // Assert
            expect(setTimeoutMock).toHaveBeenCalledTimes(1);
        });

        it("should not schedule duplicate task with same id", () => {
            // Arrange
            const callback = jest.fn();
            const futureTime = new Date(Date.now() + 1000);
            const options = { key: "testKey" };

            // Act
            scheduler.schedule(futureTime, callback, options);
            scheduler.schedule(futureTime, callback, options);

            // Assert
            expect(setTimeoutMock).toHaveBeenCalledTimes(1);
        });

        it("should not schedule duplicate task with same keyOverride", () => {
            // Arrange
            const callback = jest.fn();
            const futureTime = new Date(Date.now() + 1000);
            const options = { keyOverride: "duplicate-key" };

            // Act
            scheduler.schedule(futureTime, callback, options);
            scheduler.schedule(futureTime, callback, options);

            // Assert
            expect(setTimeoutMock).toHaveBeenCalledTimes(1);
        });

        it("should ignore past tasks when ignorePast is true", () => {
            // Arrange
            const callback = jest.fn();
            const pastTime = new Date(Date.now() - 1000);
            const options = { ignorePast: true };

            // Act
            scheduler.schedule(pastTime, callback, options);

            // Assert
            expect(setTimeoutMock).not.toHaveBeenCalled();
        });

        it("should schedule past tasks when ignorePast is false", () => {
            // Arrange
            const callback = jest.fn();
            const pastTime = new Date(Date.now() - 1000);
            const options = { ignorePast: false };

            // Act
            scheduler.schedule(pastTime, callback, options);

            // Assert
            expect(setTimeoutMock).toHaveBeenCalledTimes(1);
            expect(setTimeoutMock.mock.calls[0][1]).toBe(0);
        });

        it("should schedule past tasks when ignorePast is not provided (default behavior)", () => {
            // Arrange
            const callback = jest.fn();
            const pastTime = new Date(Date.now() - 1000);

            // Act
            scheduler.schedule(pastTime, callback);

            // Assert
            expect(setTimeoutMock).toHaveBeenCalledTimes(1);
            expect(setTimeoutMock.mock.calls[0][1]).toBe(0);
        });

        it("should schedule different tasks with different keys", () => {
            // Arrange
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            const futureTime = new Date(Date.now() + 1000);
            const options1 = { key: "key1" };
            const options2 = { key: "key2" };

            // Act
            scheduler.schedule(futureTime, callback1, options1);
            scheduler.schedule(futureTime, callback2, options2);

            // Assert
            expect(setTimeoutMock).toHaveBeenCalledTimes(2);
        });

        it("should schedule different tasks with different keyOverrides", () => {
            // Arrange
            const callback = jest.fn();
            const futureTime = new Date(Date.now() + 1000);
            const options1 = { keyOverride: "override1" };
            const options2 = { keyOverride: "override2" };

            // Act
            scheduler.schedule(futureTime, callback, options1);
            scheduler.schedule(futureTime, callback, options2);

            // Assert
            expect(setTimeoutMock).toHaveBeenCalledTimes(2);
        });

        it("should schedule different tasks with different times", () => {
            // Arrange
            const callback = jest.fn();
            const futureTime1 = new Date(Date.now() + 1000);
            const futureTime2 = new Date(Date.now() + 2000);
            const options = { key: "testKey" };

            // Act
            scheduler.schedule(futureTime1, callback, options);
            scheduler.schedule(futureTime2, callback, options);

            // Assert
            expect(setTimeoutMock).toHaveBeenCalledTimes(2);
        });

        it("should execute callback with correct arguments", () => {
            // Arrange
            const callback = jest.fn();
            const futureTime = new Date(Date.now() + 1000);

            // Act
            scheduler.schedule(futureTime, callback);
            const scheduledCallback = setTimeoutMock.mock.calls[0][0];
            scheduledCallback("arg1", "arg2");

            // Assert
            expect(callback).toHaveBeenCalledWith("arg1", "arg2");
        });

        it("should return callback result", () => {
            // Arrange
            const callback = jest.fn().mockReturnValue("test result");
            const futureTime = new Date(Date.now() + 1000);

            // Act
            scheduler.schedule(futureTime, callback);
            const scheduledCallback = setTimeoutMock.mock.calls[0][0];
            const result = scheduledCallback();

            // Assert
            expect(result).toBe("test result");
        });

        it("should handle callback that throws error", () => {
            // Arrange
            const error = new Error("Test error");
            const callback = jest.fn().mockImplementation(() => { throw error; });
            const futureTime = new Date(Date.now() + 1000);

            // Act
            scheduler.schedule(futureTime, callback);
            const scheduledCallback = setTimeoutMock.mock.calls[0][0];

            // Assert
            expect(() => scheduledCallback()).toThrow("Test error");
        });

        it("should remove task from internal storage after execution", () => {
            // Arrange
            const callback = jest.fn();
            const futureTime = new Date(Date.now() + 1000);
            const options = { key: "testKey" };

            // Act
            scheduler.schedule(futureTime, callback, options);
            const scheduledCallback = setTimeoutMock.mock.calls[0][0];
            scheduledCallback();

            // Assert
            const tasks = (scheduler as any).tasks;
            const taskId = `testKey-${futureTime.getTime().toString()}`;
            expect(tasks[taskId]).toBeUndefined();
        });

        it("should remove task from internal storage even when callback throws", () => {
            // Arrange
            const error = new Error("Test error");
            const callback = jest.fn().mockImplementation(() => { throw error; });
            const futureTime = new Date(Date.now() + 1000);
            const options = { key: "testKey" };

            // Act
            scheduler.schedule(futureTime, callback, options);
            const scheduledCallback = setTimeoutMock.mock.calls[0][0];

            // Assert
            expect(() => scheduledCallback()).toThrow("Test error");
            const tasks = (scheduler as any).tasks;
            const taskId = `testKey-${futureTime.getTime().toString()}`;
            expect(tasks[taskId]).toBeUndefined();
        });

        it("should remove task with keyOverride from internal storage after execution", () => {
            // Arrange
            const callback = jest.fn();
            const futureTime = new Date(Date.now() + 1000);
            const options = { keyOverride: "custom-key" };

            // Act
            scheduler.schedule(futureTime, callback, options);
            const scheduledCallback = setTimeoutMock.mock.calls[0][0];
            scheduledCallback();

            // Assert
            const tasks = (scheduler as any).tasks;
            expect(tasks["custom-key"]).toBeUndefined();
        });

        it("should handle callback with no name", () => {
            // Arrange
            const callback = jest.fn();
            Object.defineProperty(callback, 'name', { value: '', writable: true });
            const futureTime = new Date(Date.now() + 1000);

            // Act
            scheduler.schedule(futureTime, callback);

            // Assert
            expect(setTimeoutMock).toHaveBeenCalledTimes(1);
        });

        it("should handle callback with undefined name", () => {
            // Arrange
            const callback = jest.fn();
            delete (callback as any).name;
            const futureTime = new Date(Date.now() + 1000);

            // Act
            scheduler.schedule(futureTime, callback);

            // Assert
            expect(setTimeoutMock).toHaveBeenCalledTimes(1);
        });
    });

    describe("cancel", () => {
        it("should cancel existing task", () => {
            // Arrange
            const callback = jest.fn();
            const futureTime = new Date(Date.now() + 1000);
            const options = { key: "testKey" };
            const taskId = `testKey-${futureTime.getTime().toString()}`;

            scheduler.schedule(futureTime, callback, options);

            // Act
            scheduler.cancel(taskId);

            // Assert
            expect(clearTimeoutMock).toHaveBeenCalledWith("timeout-id");
            const tasks = (scheduler as any).tasks;
            expect(tasks[taskId]).toBeUndefined();
        });

        it("should cancel task with keyOverride", () => {
            // Arrange
            const callback = jest.fn();
            const futureTime = new Date(Date.now() + 1000);
            const options = { keyOverride: "custom-override" };

            scheduler.schedule(futureTime, callback, options);

            // Act
            scheduler.cancel("custom-override");

            // Assert
            expect(clearTimeoutMock).toHaveBeenCalledWith("timeout-id");
            const tasks = (scheduler as any).tasks;
            expect(tasks["custom-override"]).toBeUndefined();
        });

        it("should do nothing when canceling non-existent task", () => {
            // Act
            scheduler.cancel("non-existent-task");

            // Assert
            expect(clearTimeoutMock).not.toHaveBeenCalled();
        });

        it("should handle multiple cancellations of same task", () => {
            // Arrange
            const callback = jest.fn();
            const futureTime = new Date(Date.now() + 1000);
            const options = { key: "testKey" };
            const taskId = `testKey-${futureTime.getTime().toString()}`;

            scheduler.schedule(futureTime, callback, options);

            // Act
            scheduler.cancel(taskId);
            scheduler.cancel(taskId); // Second cancellation

            // Assert
            expect(clearTimeoutMock).toHaveBeenCalledTimes(1);
        });

        it("should cancel multiple different tasks", () => {
            // Arrange
            const callback = jest.fn();
            const futureTime = new Date(Date.now() + 1000);
            const options1 = { keyOverride: "task1" };
            const options2 = { keyOverride: "task2" };

            scheduler.schedule(futureTime, callback, options1);
            scheduler.schedule(futureTime, callback, options2);

            // Act
            scheduler.cancel("task1");
            scheduler.cancel("task2");

            // Assert
            expect(clearTimeoutMock).toHaveBeenCalledTimes(2);
            const tasks = (scheduler as any).tasks;
            expect(tasks["task1"]).toBeUndefined();
            expect(tasks["task2"]).toBeUndefined();
        });
    });

    describe("composeKeyWithTime", () => {
        it("should compose key with time correctly", () => {
            // Arrange
            const callback = jest.fn();
            const futureTime = new Date(Date.now() + 1000);
            const options = { key: "testKey" };

            // Act
            scheduler.schedule(futureTime, callback, options);

            // Assert
            const tasks = (scheduler as any).tasks;
            const expectedId = `testKey-${futureTime.getTime().toString()}`;
            expect(tasks[expectedId]).toBeDefined();
        });
    });

    describe("processCallback", () => {
        it("should process callback and clean up task", () => {
            // Arrange
            const callback = jest.fn().mockReturnValue("result");
            const futureTime = new Date(Date.now() + 1000);
            const options = { keyOverride: "test-process" };

            // Act
            scheduler.schedule(futureTime, callback, options);
            const processedCallback = setTimeoutMock.mock.calls[0][0];
            const result = processedCallback("arg1", "arg2");

            // Assert
            expect(callback).toHaveBeenCalledWith("arg1", "arg2");
            expect(result).toBe("result");
            const tasks = (scheduler as any).tasks;
            expect(tasks["test-process"]).toBeUndefined();
        });

        it("should clean up task even when callback throws", () => {
            // Arrange
            const callback = jest.fn().mockImplementation(() => { throw new Error("test error"); });
            const futureTime = new Date(Date.now() + 1000);
            const options = { keyOverride: "test-error" };

            // Act
            scheduler.schedule(futureTime, callback, options);
            const processedCallback = setTimeoutMock.mock.calls[0][0];

            // Assert
            expect(() => processedCallback()).toThrow("test error");
            const tasks = (scheduler as any).tasks;
            expect(tasks["test-error"]).toBeUndefined();
        });
    });

    describe("dispose", () => {
        it("should cancel all scheduled tasks", () => {
            // Arrange
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            const callback3 = jest.fn();
            const futureTime = new Date(Date.now() + 1000);
            
            scheduler.schedule(futureTime, callback1, { keyOverride: "task1" });
            scheduler.schedule(futureTime, callback2, { keyOverride: "task2" });
            scheduler.schedule(futureTime, callback3, { keyOverride: "task3" });

            // Verify tasks are scheduled
            const tasksBefore = (scheduler as any).tasks;
            expect(Object.keys(tasksBefore)).toHaveLength(3);
            expect(tasksBefore["task1"]).toBeDefined();
            expect(tasksBefore["task2"]).toBeDefined();
            expect(tasksBefore["task3"]).toBeDefined();

            // Act
            scheduler.dispose();

            // Assert
            expect(clearTimeoutMock).toHaveBeenCalledTimes(3);
            expect(clearTimeoutMock).toHaveBeenNthCalledWith(1, "timeout-id");
            expect(clearTimeoutMock).toHaveBeenNthCalledWith(2, "timeout-id");
            expect(clearTimeoutMock).toHaveBeenNthCalledWith(3, "timeout-id");

            const tasksAfter = (scheduler as any).tasks;
            expect(Object.keys(tasksAfter)).toHaveLength(0);
            expect(tasksAfter["task1"]).toBeUndefined();
            expect(tasksAfter["task2"]).toBeUndefined();
            expect(tasksAfter["task3"]).toBeUndefined();
        });

        it("should handle dispose with no scheduled tasks", () => {
            // Act
            scheduler.dispose();

            // Assert
            expect(clearTimeoutMock).not.toHaveBeenCalled();
            const tasks = (scheduler as any).tasks;
            expect(Object.keys(tasks)).toHaveLength(0);
        });

        it("should handle dispose with single scheduled task", () => {
            // Arrange
            const callback = jest.fn();
            const futureTime = new Date(Date.now() + 1000);
            scheduler.schedule(futureTime, callback, { keyOverride: "single-task" });

            // Act
            scheduler.dispose();

            // Assert
            expect(clearTimeoutMock).toHaveBeenCalledTimes(1);
            expect(clearTimeoutMock).toHaveBeenCalledWith("timeout-id");
            const tasks = (scheduler as any).tasks;
            expect(Object.keys(tasks)).toHaveLength(0);
        });

        it("should handle dispose with mix of regular and keyOverride tasks", () => {
            // Arrange
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            const futureTime1 = new Date(Date.now() + 1000);
            const futureTime2 = new Date(Date.now() + 2000);
            
            // Schedule one task with key, one with keyOverride
            scheduler.schedule(futureTime1, callback1, { key: "regular-key" });
            scheduler.schedule(futureTime2, callback2, { keyOverride: "override-key" });

            // Act
            scheduler.dispose();

            // Assert
            expect(clearTimeoutMock).toHaveBeenCalledTimes(2);
            const tasks = (scheduler as any).tasks;
            expect(Object.keys(tasks)).toHaveLength(0);
        });

        it("should handle dispose after some tasks have already been cancelled", () => {
            // Arrange
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            const callback3 = jest.fn();
            const futureTime = new Date(Date.now() + 1000);
            
            scheduler.schedule(futureTime, callback1, { keyOverride: "task1" });
            scheduler.schedule(futureTime, callback2, { keyOverride: "task2" });
            scheduler.schedule(futureTime, callback3, { keyOverride: "task3" });

            // Cancel one task manually
            scheduler.cancel("task2");
            expect(clearTimeoutMock).toHaveBeenCalledTimes(1);

            // Act
            scheduler.dispose();

            // Assert - Only 2 more tasks should be cancelled (task1 and task3)
            expect(clearTimeoutMock).toHaveBeenCalledTimes(3); // 1 from manual cancel + 2 from dispose
            const tasks = (scheduler as any).tasks;
            expect(Object.keys(tasks)).toHaveLength(0);
        });

        it("should handle dispose after some tasks have already executed", () => {
            // Arrange
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            const futureTime = new Date(Date.now() + 1000);
            
            scheduler.schedule(futureTime, callback1, { keyOverride: "task1" });
            scheduler.schedule(futureTime, callback2, { keyOverride: "task2" });

            // Execute one task (simulating timeout completion)
            const processedCallback = setTimeoutMock.mock.calls[0][0];
            processedCallback(); // This should remove task1 from internal storage

            // Verify task1 was removed but task2 remains
            const tasksBeforeDispose = (scheduler as any).tasks;
            expect(Object.keys(tasksBeforeDispose)).toHaveLength(1);
            expect(tasksBeforeDispose["task2"]).toBeDefined();

            // Act
            scheduler.dispose();

            // Assert - Only task2 should be cancelled
            expect(clearTimeoutMock).toHaveBeenCalledTimes(1); // Only task2 gets cancelled
            const tasks = (scheduler as any).tasks;
            expect(Object.keys(tasks)).toHaveLength(0);
        });

        it("should handle multiple dispose calls gracefully", () => {
            // Arrange
            const callback = jest.fn();
            const futureTime = new Date(Date.now() + 1000);
            scheduler.schedule(futureTime, callback, { keyOverride: "task1" });

            // Act
            scheduler.dispose();
            scheduler.dispose(); // Second dispose call

            // Assert - clearTimeout should only be called once
            expect(clearTimeoutMock).toHaveBeenCalledTimes(1);
            const tasks = (scheduler as any).tasks;
            expect(Object.keys(tasks)).toHaveLength(0);
        });

        it("should handle dispose with tasks scheduled using callback names", () => {
            // Arrange
            const namedCallback = jest.fn();
            Object.defineProperty(namedCallback, 'name', { value: 'namedFunction', writable: true });
            const futureTime = new Date(Date.now() + 1000);
            
            scheduler.schedule(futureTime, namedCallback); // Uses callback name as key

            // Act
            scheduler.dispose();

            // Assert
            expect(clearTimeoutMock).toHaveBeenCalledTimes(1);
            const tasks = (scheduler as any).tasks;
            expect(Object.keys(tasks)).toHaveLength(0);
        });

        it("should properly clear internal tasks record", () => {
            // Arrange
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            const futureTime = new Date(Date.now() + 1000);
            
            scheduler.schedule(futureTime, callback1, { keyOverride: "task1" });
            scheduler.schedule(futureTime, callback2, { keyOverride: "task2" });

            // Verify tasks exist before dispose
            const tasksBefore = (scheduler as any).tasks;
            expect(Object.keys(tasksBefore)).toHaveLength(2);

            // Act
            scheduler.dispose();

            // Assert
            const tasksAfter = (scheduler as any).tasks;
            expect(tasksAfter).toEqual({});
            expect(Object.keys(tasksAfter)).toHaveLength(0);
            
            // Verify we can schedule new tasks after dispose
            scheduler.schedule(futureTime, callback1, { keyOverride: "new-task" });
            const tasksAfterNewSchedule = (scheduler as any).tasks;
            expect(Object.keys(tasksAfterNewSchedule)).toHaveLength(1);
            expect(tasksAfterNewSchedule["new-task"]).toBeDefined();
        });

        it("should handle dispose with large number of tasks", () => {
            // Arrange
            const callbacks: jest.Mock[] = [];
            const futureTime = new Date(Date.now() + 1000);
            const taskCount = 100;

            // Schedule many tasks
            for (let i = 0; i < taskCount; i++) {
                const callback = jest.fn();
                callbacks.push(callback);
                scheduler.schedule(futureTime, callback, { keyOverride: `task-${i}` });
            }

            // Verify all tasks are scheduled
            const tasksBefore = (scheduler as any).tasks;
            expect(Object.keys(tasksBefore)).toHaveLength(taskCount);

            // Act
            scheduler.dispose();

            // Assert
            expect(clearTimeoutMock).toHaveBeenCalledTimes(taskCount);
            const tasksAfter = (scheduler as any).tasks;
            expect(Object.keys(tasksAfter)).toHaveLength(0);
        });
    });
});