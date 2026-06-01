import { gameSettings } from "../config/game-settings";

export function getCurrentSeasonRange(now = new Date()): {
    name: string;
    startsAt: Date;
    endsAt: Date;
} {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const startMonth = Math.floor(month / gameSettings.seasonDurationMonths) * gameSettings.seasonDurationMonths;
    const { hour, minute, second, millisecond } = gameSettings.resetTimeUtc;

    const startsAt = new Date(Date.UTC(year, startMonth, 1, hour, minute, second, millisecond));
    const nextStart = new Date(Date.UTC(year, startMonth + gameSettings.seasonDurationMonths, 1, hour, minute, second, millisecond));
    const endsAt = new Date(nextStart.getTime() - 1);

    const startMonthOneBased = startMonth + 1;
    const endMonthOneBased = startMonth + gameSettings.seasonDurationMonths;
    const name = `${year}-${String(startMonthOneBased).padStart(2, "0")}_${String(endMonthOneBased).padStart(2, "0")}`;

    return {
        name,
        startsAt,
        endsAt,
    };
}

export function getLastDailyResetAt(now = new Date()): Date {
    const { hour, minute, second, millisecond } = gameSettings.resetTimeUtc;
    const resetAt = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        hour,
        minute,
        second,
        millisecond,
    ));

    if (now.getTime() < resetAt.getTime()) {
        resetAt.setUTCDate(resetAt.getUTCDate() - 1);
    }

    return resetAt;
}

export function getLastWeeklyResetAt(now = new Date()): Date {
    const { hour, minute, second, millisecond } = gameSettings.resetTimeUtc;
    const nowWeekday = now.getUTCDay();
    const daysSinceReset = (nowWeekday - gameSettings.weeklyResetWeekdayUtc + 7) % 7;

    const resetAt = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - daysSinceReset,
        hour,
        minute,
        second,
        millisecond,
    ));

    if (now.getTime() < resetAt.getTime()) {
        resetAt.setUTCDate(resetAt.getUTCDate() - 7);
    }

    return resetAt;
}

export function levelFromXp(xp: number): number {
    return Math.floor(xp / gameSettings.xpPerLevel) + 1;
}
