interface TimedCallback {
    callback: Function;
    timeoutId: NodeJS.Timeout;
}

export class SchedulerConsumer {
    private readonly tasks: Record<string, TimedCallback> = {};

    public schedule(
        time: Date,
        callback: Function,
        options?: {
            key?: string;
            keyOverride?: string;
            ignorePast?: boolean;
        }
    ): void {
        const now = new Date();
        const diff = time.getTime() - now.getTime();
        const key = options?.key ?? callback.name;
        const id = options?.keyOverride ?? this.composeKeyWithTime(key, time);
        if (this.tasks[id]) {
            console.log(`Scheduler: Task ${id} already scheduled, ignoring it`);
            return;
        }
        if (diff >= 0) {
            const timeoutId = setTimeout(this.processCallback(callback, id), diff);
            this.tasks[id] = { callback, timeoutId: timeoutId as unknown as NodeJS.Timeout };
        } else {
            if (options?.ignorePast) {
                return;
            }
            console.log(`Scheduler: Task ${id} is in the past, ignoring it`);
            const timeoutId = setTimeout(this.processCallback(callback, id), 0);
            this.tasks[id] = { callback, timeoutId: timeoutId as unknown as NodeJS.Timeout };
        }
        console.log(`Scheduler: Scheduled task ${id} at ${time}`);
    }

    public cancel(id: string) {
        const task = this.tasks[id];
        if (task) {
            clearTimeout(task.timeoutId);
            delete this.tasks[id];
        }
    }

    private processCallback(callback: Function, id: string) {
        return (...args: any[]) => {
            try {
                return callback(...args);
            } finally {
                delete this.tasks[id];
            }
        };
    }

    private composeKeyWithTime(key: string, time: Date) {
        return `${key}-${time.getTime().toString()}`;
    }
}