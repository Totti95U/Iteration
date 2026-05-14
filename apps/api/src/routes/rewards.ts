import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";

export const rewardRouter = Router();

type RewardScope = "TOTAL" | "SEASON";

rewardRouter.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const scope = req.query.scope as RewardScope | undefined;

    const rewards = await prisma.reward.findMany({
        where: {
            userId,
            scope,
        },
        include: {
            season: true,
        },
        orderBy: [
            { scope: "asc" },
            { requiredLevel: "asc" },
            { createdAt: "asc" },
        ],
    });

    res.json({ rewards });
});

rewardRouter.patch("/:rewardId/claim", requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const rewardIdParam = req.params.rewardId;
    const rewardId = Array.isArray(rewardIdParam) ? rewardIdParam[0] : rewardIdParam;

    const reward = await prisma.reward.findFirst({
        where: {
            id: rewardId,
            userId,
        },
    });

    if (!reward) {
        res.status(404).json({ error: "Reward not found" });
        return;
    }

    if (reward.isClaimed) {
        res.status(409).json({ error: "Reward already claimed" });
        return;
    }

    const progress = await prisma.userProgress.findUnique({
        where: { userId },
    });

    if (!progress) {
        res.status(404).json({ error: "Progress not found" });
        return;
    }

    const currentLevel = reward.scope === "TOTAL" ? progress.totalLevel : progress.seasonLevel;

    if (currentLevel < reward.requiredLevel) {
        res.status(403).json({ error: "Reward level requirement not met" });
        return;
    }

    const updatedReward = await prisma.reward.update({
        where: { id: reward.id },
        data: {
            isClaimed: true,
            claimedAt: new Date(),
        },
    });

    res.json({ reward: updatedReward });
});
