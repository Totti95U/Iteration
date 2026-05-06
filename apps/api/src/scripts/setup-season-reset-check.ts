import { gameSettings } from "../config/game-settings";
import { prisma } from "../lib/prisma";
import { getCurrentSeasonRange, levelFromXp } from "../utils/season";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseArgs(): { userId: string; seedSeasonXp: number } {
    const userId = process.argv[2];
    const seedSeasonXpRaw = process.argv[3];

    if (!userId || !uuidPattern.test(userId)) {
        throw new Error("Usage: npm run setup:season-reset-check -- <supabase-user-uuid> [seedSeasonXp]");
    }

    const parsedSeed = Number(seedSeasonXpRaw ?? 250);
    const seedSeasonXp = Number.isFinite(parsedSeed) ? Math.max(1, Math.trunc(parsedSeed)) : 250;

    return { userId, seedSeasonXp };
}

function buildSeasonName(startsAt: Date, durationMonths: number): string {
    const year = startsAt.getUTCFullYear();
    const startMonthOneBased = startsAt.getUTCMonth() + 1;
    const endMonthOneBased = startsAt.getUTCMonth() + durationMonths;
    return `${year}-${String(startMonthOneBased).padStart(2, "0")}_${String(endMonthOneBased).padStart(2, "0")}`;
}

function getPreviousSeasonRange(now = new Date()): { name: string; startsAt: Date; endsAt: Date } {
    const current = getCurrentSeasonRange(now);
    const previousStart = new Date(current.startsAt);
    previousStart.setUTCMonth(previousStart.getUTCMonth() - gameSettings.seasonDurationMonths);

    const previousNextStart = new Date(current.startsAt);
    const previousEndsAt = new Date(previousNextStart.getTime() - 1);

    return {
        name: buildSeasonName(previousStart, gameSettings.seasonDurationMonths),
        startsAt: previousStart,
        endsAt: previousEndsAt,
    };
}

async function main(): Promise<void> {
    const { userId, seedSeasonXp } = parseArgs();

    const currentRange = getCurrentSeasonRange();
    const previousRange = getPreviousSeasonRange();

    const result = await prisma.$transaction(async (tx) => {
        const currentSeason =
            (await tx.season.findUnique({
                where: {
                    startsAt_endsAt: {
                        startsAt: currentRange.startsAt,
                        endsAt: currentRange.endsAt,
                    },
                },
            })) ??
            (await tx.season.create({
                data: {
                    name: currentRange.name,
                    startsAt: currentRange.startsAt,
                    endsAt: currentRange.endsAt,
                },
            }));

        const previousSeason =
            (await tx.season.findUnique({
                where: {
                    startsAt_endsAt: {
                        startsAt: previousRange.startsAt,
                        endsAt: previousRange.endsAt,
                    },
                },
            })) ??
            (await tx.season.create({
                data: {
                    name: previousRange.name,
                    startsAt: previousRange.startsAt,
                    endsAt: previousRange.endsAt,
                },
            }));

        await tx.userProfile.upsert({
            where: { id: userId },
            update: {},
            create: { id: userId },
        });

        const progress = await tx.userProgress.upsert({
            where: { userId },
            update: {
                currentSeasonId: previousSeason.id,
                seasonXp: seedSeasonXp,
                seasonLevel: levelFromXp(seedSeasonXp),
            },
            create: {
                userId,
                currentSeasonId: previousSeason.id,
                seasonXp: seedSeasonXp,
                seasonLevel: levelFromXp(seedSeasonXp),
            },
        });

        return {
            currentSeason,
            previousSeason,
            progress,
        };
    });

    console.log("[setup] season reset check data prepared");
    console.log(`userId=${userId}`);
    console.log(`previousSeasonId=${result.previousSeason.id}`);
    console.log(`currentSeasonId=${result.currentSeason.id}`);
    console.log(`seed seasonXp=${result.progress.seasonXp}, seasonLevel=${result.progress.seasonLevel}`);
    console.log("next: call GET /api/bootstrap with the same user's bearer token");
}

main()
    .catch((error: unknown) => {
        console.error("[setup] failed", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
