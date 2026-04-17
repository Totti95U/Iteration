import { TaskType } from "../generated/prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { getCurrentSeasonRange } from "../utils/season";

export const bootstrapRouter = Router();

const defaultXpOptions = [
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
                weeklyUnseen: true,
                seasonUnseen: true,
            },
        });

        const optionCount = await tx.xpOption.count({
            where: { userId },
        });

        if (optionCount === 0) {
            await tx.xpOption.createMany({
                data: defaultXpOptions.map((option) => ({
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
