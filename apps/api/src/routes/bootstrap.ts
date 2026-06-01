import { Router } from "express";
import { defaultXpOptionTemplates } from "../config/game-settings";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { getCurrentSeasonRange, getLastDailyResetAt, getLastWeeklyResetAt } from "../utils/season";

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

        const existingProgress = await tx.userProgress.findUnique({
            where: { userId },
        });

        const progress = existingProgress
            ? await tx.userProgress.update({
                where: { userId },
                data:
                    existingProgress.currentSeasonId !== season.id
                        ? {
                            currentSeasonId: season.id,
                            seasonXp: 0,
                            seasonLevel: 1,
                        }
                        : {
                            currentSeasonId: season.id,
                        },
            })
            : await tx.userProgress.create({
                data: {
                    userId,
                    currentSeasonId: season.id,
                },
            });

        let seasonState = await tx.userSeasonState.upsert({
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

        const lastDailyResetAt = getLastDailyResetAt();
        const lastWeeklyResetAt = getLastWeeklyResetAt();
        const shouldDailyUnseen = !seasonState.dailySeenAt || seasonState.dailySeenAt < lastDailyResetAt;
        const shouldWeeklyUnseen = !seasonState.weeklySeenAt || seasonState.weeklySeenAt < lastWeeklyResetAt;
        const shouldSeasonUnseen = !seasonState.seasonSeenAt || seasonState.seasonSeenAt < season.startsAt;

        const unseenUpdate: {
            dailyUnseen?: boolean;
            weeklyUnseen?: boolean;
            seasonUnseen?: boolean;
        } = {};

        if (shouldDailyUnseen && !seasonState.dailyUnseen) {
            unseenUpdate.dailyUnseen = true;
        }

        if (shouldWeeklyUnseen && !seasonState.weeklyUnseen) {
            unseenUpdate.weeklyUnseen = true;
        }

        if (shouldSeasonUnseen && !seasonState.seasonUnseen) {
            unseenUpdate.seasonUnseen = true;
        }

        if (Object.keys(unseenUpdate).length > 0) {
            seasonState = await tx.userSeasonState.update({
                where: { id: seasonState.id },
                data: unseenUpdate,
            });
        }

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
