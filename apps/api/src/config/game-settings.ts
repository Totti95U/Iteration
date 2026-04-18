import { TaskType } from "../generated/prisma/client";

type DefaultXpOptionTemplate = {
    type: TaskType;
    value: number;
    label: string;
    sortOrder: number;
};

type UtcWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const gameSettings = {
    seasonDurationMonths: 2,
    xpPerLevel: 100,
    minTaskTargetCount: 1,
    minTaskCurrentCount: 0,
    // Shared reset time for all task cadences (daily/weekly/season) in UTC.
    resetTimeUtc: {
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
    },
    // Weekly reset weekday in UTC. 0=Sunday, 1=Monday, ... 6=Saturday.
    weeklyResetWeekdayUtc: 1 as UtcWeekday,
};

export const defaultXpOptionTemplates: DefaultXpOptionTemplate[] = [
    { type: TaskType.DAILY, value: 5, label: "Daily 5", sortOrder: 0 },
    { type: TaskType.DAILY, value: 10, label: "Daily 10", sortOrder: 1 },
    { type: TaskType.DAILY, value: 15, label: "Daily 15", sortOrder: 2 },
    { type: TaskType.WEEKLY, value: 20, label: "Weekly 20", sortOrder: 0 },
    { type: TaskType.WEEKLY, value: 35, label: "Weekly 35", sortOrder: 1 },
    { type: TaskType.WEEKLY, value: 50, label: "Weekly 50", sortOrder: 2 },
    { type: TaskType.SEASON, value: 120, label: "Season 120", sortOrder: 0 },
    { type: TaskType.SEASON, value: 180, label: "Season 180", sortOrder: 1 },
    { type: TaskType.SEASON, value: 240, label: "Season 240", sortOrder: 2 },
];