import { log } from "../../helpers/log";

interface TimedCallback {
    callback: Function;
    timeoutId: NodeJS.Timeout;
}

const DEBUG = false;

export class Scheduler {
    private readonly tasks: Record<string, TimedCallback> = {};

    public schedule(
        time: Date,
        callback: Function,
        options?: {
            key?: string;
            keyOverride?: string;
            ignorePast?: boolean;
        }
    ): string {
        const now = new Date();
        const diff = time.getTime() - now.getTime();
        const key = options?.key ?? callback.name;
        const id = options?.keyOverride ?? this.composeKeyWithTime(key, time);
        if (this.tasks[id]) {
            this.log(`Task ${id} already scheduled, ignoring it`);
            return id;
        }

        if (diff < 0 && options?.ignorePast) {
            return id;
        }

        const actualDiff = diff >= 0 ? diff : 0;

        const timeoutId = setTimeout(this.processCallback(callback, id), actualDiff);
        this.tasks[id] = { callback, timeoutId: timeoutId as unknown as NodeJS.Timeout };
        this.log(`Scheduled task ${id} at ${time}`);
        return id;
    }

    public cancel(id: string) {
        const task = this.tasks[id];
        if (task) {
            clearTimeout(task.timeoutId);
            delete this.tasks[id];
        }
    }

    public dispose() {
        Object.keys(this.tasks).forEach(task => this.cancel(task));
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

    private log(message: string) {
        if (DEBUG) {
            log(`\x1b[32m [Scheduler] \x1b[37m: ${message}`);
        }
    }
}