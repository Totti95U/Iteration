import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";

export const meRouter = Router();

type SeenTab = "DAILY" | "WEEKLY" | "SEASON";

meRouter.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;

    const profile = await prisma.userProfile.findUnique({
        where: { id: userId },
        include: {
            progress: true,
        },
    });

    res.json({
        user: req.authUser,
        profile,
    });
});

meRouter.patch("/season-state/seen", requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const { seasonId, tab } = req.body as { seasonId?: string; tab?: SeenTab };

    if (!seasonId || (tab !== "DAILY" && tab !== "WEEKLY" && tab !== "SEASON")) {
        res.status(400).json({ error: "Invalid payload" });
        return;
    }

    const seenAt = new Date();

    const seasonState = await prisma.userSeasonState.upsert({
        where: {
            userId_seasonId: {
                userId,
                seasonId,
            },
        },
        update:
            tab === "DAILY"
                ? {
                      dailyUnseen: false,
                      dailySeenAt: seenAt,
                  }
                : tab === "WEEKLY"
                  ? {
                        weeklyUnseen: false,
                        weeklySeenAt: seenAt,
                    }
                  : {
                        seasonUnseen: false,
                        seasonSeenAt: seenAt,
                    },
        create:
            tab === "DAILY"
                ? {
                      userId,
                      seasonId,
                      dailyUnseen: false,
                      dailySeenAt: seenAt,
                      weeklyUnseen: true,
                      seasonUnseen: true,
                  }
                : tab === "WEEKLY"
                  ? {
                        userId,
                        seasonId,
                        dailyUnseen: true,
                        weeklyUnseen: false,
                        weeklySeenAt: seenAt,
                        seasonUnseen: true,
                    }
                  : {
                        userId,
                        seasonId,
                        dailyUnseen: true,
                        weeklyUnseen: true,
                        seasonUnseen: false,
                        seasonSeenAt: seenAt,
                    },
    });

    res.json({ seasonState });
});
