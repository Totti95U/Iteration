import { prisma } from "../lib/prisma";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function main(): Promise<void> {
    const userId = process.argv[2];

    if (!userId || !uuidPattern.test(userId)) {
        throw new Error("Usage: npm run inspect:season-progress -- <supabase-user-uuid>");
    }

    const progress = await prisma.userProgress.findUnique({
        where: { userId },
        include: {
            currentSeason: true,
        },
    });

    if (!progress) {
        console.log("No userProgress found");
        return;
    }

    console.log(JSON.stringify({
        userId: progress.userId,
        currentSeasonId: progress.currentSeasonId,
        currentSeasonName: progress.currentSeason?.name ?? null,
        totalXp: progress.totalXp,
        totalLevel: progress.totalLevel,
        seasonXp: progress.seasonXp,
        seasonLevel: progress.seasonLevel,
    }, null, 2));
}

main()
    .catch((error: unknown) => {
        console.error("[inspect] failed", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
