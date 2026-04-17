export function getCurrentSeasonRange(now = new Date()): {
    name: string;
    startsAt: Date;
    endsAt: Date;
} {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const startMonth = Math.floor(month / 2) * 2;

    const startsAt = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0));
    const nextStart = new Date(Date.UTC(year, startMonth + 2, 1, 0, 0, 0, 0));
    const endsAt = new Date(nextStart.getTime() - 1);

    const startMonthOneBased = startMonth + 1;
    const endMonthOneBased = startMonth + 2;
    const name = `${year}-${String(startMonthOneBased).padStart(2, "0")}_${String(endMonthOneBased).padStart(2, "0")}`;

    return {
        name,
        startsAt,
        endsAt,
    };
}

export function levelFromXp(xp: number): number {
    return Math.floor(xp / 100) + 1;
}
