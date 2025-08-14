import { Chance } from "chance";

enum EVENT_NAMES {
    GOAL_H = "goal_H",
    GOAL_A = "goal_A",
    GLOVE_B = "hit_glove_B",
    GLOVE_R = "hit_glove_R",
}

type Event = {
    eventName: string;
    eventTime: number;
}

type TrackingStas = {
    totalGoal: number;
    homeScore: number;
    awayScore: number;
    consecutiveGoal: number;
    currentEvent?: Event;
    previousEvent?: Event;
    nextEvent?: Event;
    previousVoiceEndTime?: number;
    prevGoal?: {
        time?: number;
        team: "H" | "A";
    }
    currentGoal?: {
        time?: number;
        team: "H" | "A";
    },
    isFirstHalf: boolean;
    totalGoalCurrentHalf: number;
}

export type VoiceGenerationArgs = {
    timeline: number[];
    result: string;
    firstHalfScoreSequence?: string;
}

export type EventTimelineArgs = {
    timeline: number[];
    eventName: string[];
    firstHalfScore?: string;
    firstHalfVoices?: string[];
}

export type VoiceGenerationResult = {
    timeline: number[];
    voice: string[];
}

export type VoiceDurationConfig = {
    [key: string]: {
        [key: number]: number;
    }
}

type Voice = {
    file: string;
    duration: number;
    index: number;
    key: string;
}

type VoiceChoiceConfig = {
    limitDuration?: number;
    exclusion?: Set<string>;
}

export const DEFAULT_VOICE_DURATION_CONFIG: VoiceDurationConfig = {
    "draw4": {
        "2": 3,
        "3": 4,
        "4": 2
    },
    "lastGoal": {
        "2": 4,
        "3": 3
    },
    "draw3": {
        "2": 4,
        "3": 5,
        "4": 1
    },
    "draw2": {
        "2": 6,
        "3": 4
    },
    "draw1": {
        "1": 2,
        "2": 2,
        "3": 5,
        "4": 1
    },
    "fastGoal": {
        "2": 1,
        "3": 4,
        "4": 1
    },
    "goal5th": {
        "2": 4,
        "3": 2,
        "4": 1
    },
    "goal4th": {
        "2": 4,
        "3": 4,
        "4": 1
    },
    "goal3rd": {
        "2": 3,
        "3": 3,
        "4": 4
    },
    "goal2nd": {
        "2": 3,
        "3": 3,
        "4": 1
    },
    "firstGoal": {
        "1": 1,
        "2": 6,
        "3": 1
    },
    "goal": {
        "1": 6,
        "2": 12,
        "3": 4,
        "4": 1
    },
    "noGoal": {
        "2": 6,
        "3": 4,
        "4": 1
    },
    "save": {
        "1": 1,
        "2": 10,
        "3": 5,
        "4": 2
    }
}

const TIME_WITHIN_TO_BE_CONSIDERED_AS_FAST_GOAL = 5;
const GOAL_COUNT_TO_BE_CONSIDERED_AS_FAST_GOAL = 2;
const TIME_TO_BE_CONSIDERED_AS_LAST_GOAL = 25;
const TIME_TO_BE_CONSIDERED_AS_NO_GOAL_WITHIN = 15;

export function generateVoiceWithEventTimeline(args: EventTimelineArgs, config: VoiceDurationConfig): VoiceGenerationResult {
    const events = args.eventName;

    const { initialVoice, initialTracker } = initVoiceEvents(args, config);
    let tracker = initialTracker;
    const { timeline, voice } = initialVoice;
    const exclusion = new Set(args.firstHalfVoices ?? []);
    
    events.forEach((event, index) => {
        const eventTime = args.timeline[index];
        const eventName = event;
        const possibleEventNames: string[] = [];

        const nextEvent = events[index + 1] ? {
            eventName: events[index + 1],
            eventTime: args.timeline[index + 1]
        } : undefined;

        tracker = trackEventBeforeProcess(tracker, {
            eventName,
            eventTime
        }, nextEvent);

        const durationLimit = nextEvent?.eventTime ? Math.ceil(nextEvent.eventTime - eventTime) : undefined;

        if (isNoGoalWithinTime(tracker, TIME_TO_BE_CONSIDERED_AS_NO_GOAL_WITHIN) && !isPreviousEventPassedTime(tracker, TIME_TO_BE_CONSIDERED_AS_NO_GOAL_WITHIN)) {
            const noGoalVoices = getPossibleVoiceArray(config, "noGoal", {
                limitDuration: durationLimit,
                exclusion
            });
            const chance = new Chance();
            const chosenVoice = chance.pickone(noGoalVoices);
            if (chosenVoice) {
                timeline.push(TIME_TO_BE_CONSIDERED_AS_NO_GOAL_WITHIN);
                voice.push(chosenVoice.file);
                tracker = trackEventOnVoiceChosen(tracker, TIME_TO_BE_CONSIDERED_AS_NO_GOAL_WITHIN, chosenVoice);
            }
        }

        if (isGoalForEventName(eventName)) {
            tracker = trackGoal(tracker, {
                eventTime,
                eventName
            });
        }

        possibleEventNames.push(...getPossibleVoiceEvent(tracker, config));
        
        if (isOverlappingPrevious(tracker)) {
            if (isGoalAndPreviousIsNotGoal(tracker)) {
                const ignoredVoice = voice.pop();
                const ignoredTimeline = timeline.pop();
                console.log(`Ignored voice: ${ignoredVoice} at ${ignoredTimeline}`);
            } else {
                return;
            }
        };

        const chosenEvent = possibleEventNames[0];
        const possibleVoices = getPossibleVoiceArray(config, chosenEvent, {
            limitDuration: durationLimit,
            exclusion
        });
        const chance = new Chance();

        const chosenVoice =
            possibleVoices.length > 0
                ? chance.pickone(possibleVoices)
                : null;
        if (chosenVoice) {
            timeline.push(eventTime);
            voice.push(chosenVoice.file);
            tracker = trackEventOnVoiceChosen(tracker, eventTime, chosenVoice);
            exclusion.add(chosenVoice.file);
        }
    });

    return {
        timeline,
        voice
    }
}

function initTracker(firstHalfScoreSequence = "") {
    const tracker: TrackingStas = {
        totalGoal: 0,
        homeScore: 0,
        awayScore: 0,
        consecutiveGoal: 0,
        isFirstHalf: firstHalfScoreSequence === "",
        totalGoalCurrentHalf: 0
    }

    firstHalfScoreSequence.split("").forEach((score, index, scores) => {
        tracker.totalGoal++;
        tracker.homeScore += score === "H" ? 1 : 0;
        tracker.awayScore += score === "A" ? 1 : 0;
        if (index > 0 && scores[index - 1] !== score) {
            tracker.consecutiveGoal = 0;
        }
        tracker.consecutiveGoal++;
        tracker.currentGoal = {
            team: score as "H" | "A"
        }
    });

    return tracker;
}

function trackGoal(tracker: TrackingStas, {
    eventTime,
    eventName
}: {
    eventTime: number,
    eventName: string
}) {
    const newTracker = { ...tracker }
    newTracker.prevGoal = newTracker.currentGoal;
    newTracker.currentGoal = {
        time: eventTime,
        team: isHomeGoal(eventName) ? "H" : "A"
    }

    if (!isConsecutiveGoal(newTracker)) {
        newTracker.consecutiveGoal = 0;
    }
    newTracker.consecutiveGoal++;
    newTracker.totalGoal++;
    newTracker.awayScore += isAwayGoal(eventName) ? 1 : 0;
    newTracker.homeScore += isHomeGoal(eventName) ? 1 : 0;
    newTracker.totalGoalCurrentHalf++;

    return newTracker;
}

function trackEventBeforeProcess(tracker: TrackingStas, event: Event, nextEvent?: Event) {
    const newTracker = { ...tracker }
    newTracker.previousEvent = newTracker.currentEvent;
    newTracker.currentEvent = event;
    newTracker.nextEvent = nextEvent;
    newTracker.prevGoal = newTracker.currentGoal;
    return newTracker;
}

function trackEventOnVoiceChosen(tracker: TrackingStas, eventTime: number, chosenVoice: Voice) {
    const newTracker = { ...tracker }
    const voiceDuration = chosenVoice?.duration ?? 0;
    newTracker.previousVoiceEndTime = eventTime + voiceDuration;
    return newTracker;
}

function isConsecutiveGoal(tracker: TrackingStas) {
    return tracker.prevGoal && tracker.prevGoal.team === tracker.currentGoal?.team;
}

function getPossibleVoiceArray(config: VoiceDurationConfig, key: string, extraConfigs: VoiceChoiceConfig = {}) {
    const possibeVoices: { file: string, duration: number, index: number, key: string }[] = []
    if (!Object.hasOwn(config, key)) {
        return possibeVoices;
    }
    const durationList: string[] = Object.keys(config[key]).sort((a, b) => parseInt(a) - parseInt(b));
    for (const duration of durationList) {
        const durationNumber = parseInt(duration);
        if (extraConfigs.limitDuration && durationNumber > extraConfigs.limitDuration) {
            if (possibeVoices.length > 0) {
                break;
            }
        }
        for (let i = 1; i <= config[key][durationNumber]; i++) {
            possibeVoices.push({
                key,
                file: `${key}_${duration}_${i}`,
                duration: durationNumber,
                index: i
            });
        }
    }

    return possibeVoices.filter(voice => !extraConfigs.exclusion?.has(voice.file));
}

function getPossibleVoiceEvent(tracker: TrackingStas, config: VoiceDurationConfig) {
    const key = Object.keys(config).find(key => voiceConditionMap[key]?.(tracker) ?? false);
    return key ? [key] : [];
}

const voiceConditionMap: Record<string, (tracker: TrackingStas) => boolean> = {
    draw4: isDraw4,
    lastGoal: isLastGoal,
    draw3: isDraw3,
    draw2: isDraw2,
    draw1: isDraw1,
    fastGoal: isFastGoal,
    goal5th: isGoal5th,
    goal4th: isGoal4th,
    goal3rd: isGoal3rd,
    goal2nd: isGoal2nd,
    firstGoal: isFirstGoal,
    noGoal: () => false,
    goal: isGoal,
    save: isSave
}

function isGoal(tracker: TrackingStas) {
    return isGoalForEventName(tracker.currentEvent?.eventName ?? "");
}

function isDraw(tracker: TrackingStas) {
    if (!isGoal(tracker)) {
        return false;
    }
    return tracker.homeScore === tracker.awayScore;
}

function isDraw1(tracker: TrackingStas) {
    return isDraw(tracker) && tracker.homeScore === 1   ;
}

function isDraw2(tracker: TrackingStas) {
    return isDraw(tracker) && tracker.homeScore === 2;
}

function isDraw3(tracker: TrackingStas) {
    return isDraw(tracker) && tracker.homeScore === 3;
}

function isDraw4(tracker: TrackingStas) {
    return isDraw(tracker) && tracker.homeScore === 4;
}

function isGoalNth(tracker: TrackingStas) {
    return tracker.consecutiveGoal > 1;
}

function isGoal2nd(tracker: TrackingStas) {
    return isGoalNth(tracker) && tracker.consecutiveGoal === 2;
}

function isGoal3rd(tracker: TrackingStas) {
    return isGoalNth(tracker) && tracker.consecutiveGoal === 3;
}

function isGoal4th(tracker: TrackingStas) {
    return isGoalNth(tracker) && tracker.consecutiveGoal === 4;
}

function isGoal5th(tracker: TrackingStas) {
    return isGoalNth(tracker) && tracker.consecutiveGoal >= 5;
}


function isFastGoal(tracker: TrackingStas) {
    if (!isGoal(tracker)) {
        return false;
    }
    return Boolean(tracker.totalGoalCurrentHalf === GOAL_COUNT_TO_BE_CONSIDERED_AS_FAST_GOAL && tracker.currentGoal?.time && tracker.currentGoal?.time < TIME_WITHIN_TO_BE_CONSIDERED_AS_FAST_GOAL);
}

function isFirstGoal(tracker: TrackingStas) {
    if (!isGoal(tracker)) {
        return false;
    }
    return Boolean(tracker.isFirstHalf && tracker.totalGoalCurrentHalf === 1 && tracker.currentGoal?.time && tracker.currentGoal?.time < TIME_WITHIN_TO_BE_CONSIDERED_AS_FAST_GOAL);
}   

function isLastGoal(tracker: TrackingStas) {
    if (!isGoal(tracker)) {
        return false;
    }
    return Boolean(!tracker.isFirstHalf && tracker.currentGoal?.time && tracker.currentGoal?.time > TIME_TO_BE_CONSIDERED_AS_LAST_GOAL);
}

function isSave(tracker: TrackingStas) {
    return Boolean(tracker.currentEvent && isEventNameForGlove(tracker.currentEvent.eventName));
}

function isGoalForEventName(eventName: string) {
    return eventName === EVENT_NAMES.GOAL_H || eventName === EVENT_NAMES.GOAL_A;
}

function isEventNameForGlove(eventName: string) {
    return eventName === EVENT_NAMES.GLOVE_B || eventName === EVENT_NAMES.GLOVE_R;
}

function isHomeGoal(eventName: string) {
    return eventName === EVENT_NAMES.GOAL_H;
}

function isAwayGoal(eventName: string) {
    return eventName === EVENT_NAMES.GOAL_A;
}

function isOverlappingPrevious(tracker: TrackingStas) {
    return tracker.previousVoiceEndTime && tracker.currentEvent && tracker.previousVoiceEndTime > tracker.currentEvent?.eventTime;
}

function isGoalAndPreviousIsNotGoal(tracker: TrackingStas) {
    return isGoalForEventName(tracker.currentEvent?.eventName ?? "") && !isGoalForEventName(tracker.previousEvent?.eventName ?? "");
}

function ordinal(number: number) {
    const digitMap: Record<number, string> = {
        1: "st",
        2: "nd",
        3: "rd"
    }

    return `${number}${Object.hasOwn(digitMap, number) ? digitMap[number] : "th"}`;
}

function initVoiceEvents(args: EventTimelineArgs, config: VoiceDurationConfig): {
    initialVoice: VoiceGenerationResult,
    initialTracker: TrackingStas
} {
    const tracker = initTracker(args.firstHalfScore);

    return {
        initialVoice: {
            timeline: [],
            voice: []
        },
        initialTracker: tracker
    }

}

function isPassedTime(tracker: TrackingStas, time: number) {
    return tracker.currentEvent?.eventTime && tracker.currentEvent?.eventTime > time;
}

function isNoGoalWithinTime(tracker: TrackingStas, time: number) {
    return tracker.totalGoal === 0 && isPassedTime(tracker, time);
}

function isPreviousEventPassedTime(tracker: TrackingStas, time: number) {
    return tracker.previousEvent?.eventTime && tracker.previousEvent?.eventTime >= time;
}
