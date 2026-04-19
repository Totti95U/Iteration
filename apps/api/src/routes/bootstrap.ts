import { Router } from "express";
import { defaultXpOptionTemplates } from "../config/game-settings";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { getCurrentSeasonRange } from "../utils/season";

export const bootstrapRouter = Router();

bootstrapRouter.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const userEmail = req.authUser!.email;

    const seasonRange = getCurrentSeasonRange();

    const result = await prisma.$transaction(async (tx) => {
        const season =
            (await tx.season.findUnique({
                where: {
                    startsAt_endsAt: {
                        startsAt: seasonRange.startsAt,
                        endsAt: seasonRange.endsAt,
                    },
                },
            })) ??
            (await tx.season.create({
                data: {
                    name: seasonRange.name,
                    startsAt: seasonRange.startsAt,
                    endsAt: seasonRange.endsAt,
                },
            }));

        await tx.userProfile.upsert({
            where: { id: userId },
            update: {
                email: userEmail,
            },
            create: {
                id: userId,
                email: userEmail,
            },
        });

        const progress = await tx.userProgress.upsert({
            where: { userId },
            update: {
                currentSeasonId: season.id,
            },
            create: {
                userId,
                currentSeasonId: season.id,
            },
        });

        const seasonState = await tx.userSeasonState.upsert({
            where: {
                userId_seasonId: {
                    userId,
                    seasonId: season.id,
                },
            },
            update: {},
            create: {
                userId,
                seasonId: season.id,
                dailyUnseen: true,
                weeklyUnseen: true,
                seasonUnseen: true,
            },
        });

        const optionCount = await tx.xpOption.count({
            where: { userId },
        });

        if (optionCount === 0) {
            await tx.xpOption.createMany({
                data: defaultXpOptionTemplates.map((option) => ({
                    ...option,
                    userId,
                })),
            });
        }

        const xpOptions = await tx.xpOption.findMany({
            where: { userId },
            orderBy: [
                { type: "asc" },
                { sortOrder: "asc" },
            ],
        });

        return {
            season,
            progress,
            seasonState,
            xpOptions,
        };
    });

    res.json(result);
});
