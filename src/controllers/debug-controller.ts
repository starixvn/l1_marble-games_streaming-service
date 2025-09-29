import { EventEmitter } from "events";
import { ANSIColor, FeatureDebugService, LogMessage } from "../features/feature-debug/feature-debug-service";
import { Request, Response } from "express";

type Color ={
    background: string;
    foreground: string;
}

interface DebugControllerContainer {
    featureDebugService: FeatureDebugService;
}

const colorMap = {
    [ANSIColor.Black]: {
        background: "#FFFFFF",
        foreground: "#000000",
    },
    [ANSIColor.Red]: {
        background: "#FFFFFF",
        foreground: "#FF0000",
    },
    [ANSIColor.Green]: {
        background: "#FFFFFF",
        foreground: "#228B22",
    },
    [ANSIColor.Yellow]: {
        background: "#FFFFFF",
        foreground: "#B8860B",
    },
    [ANSIColor.Blue]: {
        background: "#FFFFFF",
        foreground: "#0000FF",
    },
    [ANSIColor.Magenta]: {
        background: "#FFFFFF",
        foreground: "#FF00FF",
    },
    [ANSIColor.Cyan]: {
        background: "#FFFFFF",
        foreground: "#008B8B",
    },
    [ANSIColor.White]: {
        background: "#000000",
        foreground: "#FFFFFF",
    },
    [ANSIColor.BackgroundBlack]: {
        background: "#000000",
        foreground: "#FFFFFF",
    },
    [ANSIColor.BackgroundRed]: {
        background: "#FF0000",
        foreground: "#FFFFFF",
    },
    [ANSIColor.BackgroundGreen]: {
        background: "#228B22",
        foreground: "#FFFFFF",
    },
    [ANSIColor.BackgroundYellow]: {
        background: "#B8860B",
        foreground: "#FFFFFF",
    },
    [ANSIColor.BackgroundBlue]: {
        background: "#0000FF",
        foreground: "#FFFFFF",
    },
    [ANSIColor.BackgroundMagenta]: {
        background: "#FF00FF",
        foreground: "#FFFFFF",
    },
    [ANSIColor.BackgroundCyan]: {
        background: "#008B8B",
        foreground: "#FFFFFF",
    },
    [ANSIColor.BackgroundDefault]: {
        background: "#FFFFFF",
        foreground: "#000000",
    },
}

function ansiToHtmlColor(ansiColor: ANSIColor): Color {
    return colorMap[ansiColor as keyof typeof colorMap] ?? colorMap[ANSIColor.Black];
}

export class DebugController {
    private readonly featureDebugService: FeatureDebugService;

    constructor(container: DebugControllerContainer) {
        this.featureDebugService = container.featureDebugService;
    }

    handle(req: Request, res: Response) {

        const gameId = req.params.gameId;
        if (!gameId) {
            res.status(400).json({ error: "Game ID is required" });
            return;
        }
        
        const emitter = this.featureDebugService.logEventSourceByGameId[gameId];
        if (!emitter) {
            res.status(400).json({ error: "No debug stream available for this game" });
            return;
        }

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        const logs = (this.featureDebugService.logByGameId[gameId] ?? [])
            .map((log) => ({
                ...log,
                serviceColor: ansiToHtmlColor(log.serviceColor),
            }));
        res.write(`data: ${JSON.stringify({ logs })}\n\n`);

        const onLog = (log: LogMessage) => {
            const logMessage = {
                ...log,
                serviceColor: ansiToHtmlColor(log.serviceColor),
            };
            res.write(`data: ${JSON.stringify({ log: logMessage })}\n\n`);
        };

        emitter.on("log", onLog);

        const cleanup = () => {
            try {
                emitter.removeListener("log", onLog);
            } catch {}
        };

        res.on("close", cleanup);
        res.on("finish", cleanup);
        req.on("close", cleanup);
        req.on("aborted", cleanup);
    }

    dispose() {
        Object.values(this.featureDebugService.logEventSourceByGameId).forEach((emitter: EventEmitter) => {
            emitter.removeAllListeners();
        });
    }
}