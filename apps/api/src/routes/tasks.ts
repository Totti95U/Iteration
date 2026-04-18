import { Prisma, TaskType } from "../generated/prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { levelFromXp } from "../utils/season";

export const taskRouter = Router();

taskRouter.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const typeParam = req.query.type as string | undefined;

    const where: Prisma.TaskWhereInput = {
        userId,
    };

    if (typeParam && Object.values(TaskType).includes(typeParam as TaskType)) {
        where.type = typeParam as TaskType;
    }

    const tasks = await prisma.task.findMany({
        where,
        orderBy: [
            { isCompleted: "asc" },
            { createdAt: "desc" },
        ],
    });

    res.json({ tasks });
});

taskRouter.get("/:taskId", requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const taskIdParam = req.params.taskId;
    const taskId = Array.isArray(taskIdParam) ? taskIdParam[0] : taskIdParam;

    const task = await prisma.task.findFirst({
        where: {
            id: taskId,
            userId,
        },
    });

    if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
    }

    res.json({ task });
});

taskRouter.post("/", requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const {
        title,
        description,
        type,
        targetCount,
        xpValue,
        rewardHint,
    } = req.body as {
        title?: string;
        description?: string;
        type?: TaskType;
        targetCount?: number;
        xpValue?: number;
        rewardHint?: string;
    };

    if (!title || !type || !Object.values(TaskType).includes(type) || !xpValue) {
        res.status(400).json({ error: "Invalid payload" });
        return;
    }

    const progress = await prisma.userProgress.findUnique({
        where: { userId },
    });

    const task = await prisma.task.create({
        data: {
            userId,
            title,
            description,
            type,
            targetCount: Math.max(1, targetCount ?? 1),
            xpValue,
            rewardHint,
            seasonId: type === TaskType.SEASON ? progress?.currentSeasonId : null,
        },
    });

    res.status(201).json({ task });
});

taskRouter.put("/:taskId", requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const taskIdParam = req.params.taskId;
    const taskId = Array.isArray(taskIdParam) ? taskIdParam[0] : taskIdParam;
    const {
        title,
        description,
        type,
        targetCount,
        xpValue,
        rewardHint,
    } = req.body as {
        title?: string;
        description?: string;
        type?: TaskType;
        targetCount?: number;
        xpValue?: number;
        rewardHint?: string;
    };

    const existingTask = await prisma.task.findFirst({
        where: {
            id: taskId,
            userId,
        },
    });

    if (!existingTask) {
        res.status(404).json({ error: "Task not found" });
        return;
    }

    if (!title || !type || !Object.values(TaskType).includes(type) || !xpValue) {
        res.status(400).json({ error: "Invalid payload" });
        return;
    }

    const progress = await prisma.userProgress.findUnique({
        where: { userId },
    });

    const updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: {
            title,
            description,
            type,
            targetCount: Math.max(1, targetCount ?? existingTask.targetCount),
            xpValue,
            rewardHint,
            seasonId: type === TaskType.SEASON ? progress?.currentSeasonId : null,
        },
    });

    res.json({ task: updatedTask });
});

taskRouter.delete("/:taskId", requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const taskIdParam = req.params.taskId;
    const taskId = Array.isArray(taskIdParam) ? taskIdParam[0] : taskIdParam;

    const existingTask = await prisma.task.findFirst({
        where: {
            id: taskId,
            userId,
        },
    });

    if (!existingTask) {
        res.status(404).json({ error: "Task not found" });
        return;
    }

    await prisma.task.delete({
        where: { id: taskId },
    });

    res.status(204).send();
});

taskRouter.patch("/:taskId", requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const taskIdParam = req.params.taskId;
    const taskId = Array.isArray(taskIdParam) ? taskIdParam[0] : taskIdParam;
    const { action } = req.body as { action?: "increment" | "decrement" | "reset" | "complete" };

    const task = await prisma.task.findFirst({
        where: {
            id: taskId,
            userId,
        },
    });

    if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
    }

    if (!action) {
        res.status(400).json({ error: "Missing action" });
        return;
    }

    if (task.isCompleted) {
        res.json({ task });
        return;
    }

    if (action === "increment") {
        const updated = await prisma.task.update({
            where: { id: task.id },
            data: {
                currentCount: Math.min(task.targetCount, task.currentCount + 1),
            },
        });
        res.json({ task: updated });
        return;
    }

    if (action === "decrement") {
        const updated = await prisma.task.update({
            where: { id: task.id },
            data: {
                currentCount: Math.max(0, task.currentCount - 1),
            },
        });
        res.json({ task: updated });
        return;
    }

    if (action === "reset") {
        const updated = await prisma.task.update({
            where: { id: task.id },
            data: {
                currentCount: 0,
            },
        });
        res.json({ task: updated });
        return;
    }

    if (action === "complete") {
        if (task.currentCount < task.targetCount) {
            res.status(400).json({ error: "Target count not reached" });
            return;
        }

        const updatedTask = await prisma.$transaction(async (tx) => {
            const completedTask = await tx.task.update({
                where: { id: task.id },
                data: {
                    isCompleted: true,
                    completedAt: new Date(),
                },
            });

            const progress = await tx.userProgress.findUnique({
                where: { userId },
            });

            if (progress) {
                const totalXp = progress.totalXp + completedTask.xpValue;
                const seasonXp = progress.seasonXp + completedTask.xpValue;

                await tx.userProgress.update({
                    where: { userId },
                    data: {
                        totalXp,
                        seasonXp,
                        totalLevel: levelFromXp(totalXp),
                        seasonLevel: levelFromXp(seasonXp),
                    },
                });
            }

            return completedTask;
        });

        res.json({ task: updatedTask });
        return;
    }

    res.status(400).json({ error: "Unsupported action" });
});
