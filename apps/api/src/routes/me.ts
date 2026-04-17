import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";

export const meRouter = Router();

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
