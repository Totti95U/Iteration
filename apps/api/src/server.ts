import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { bootstrapRouter } from "./routes/bootstrap";
import { healthRouter } from "./routes/health";
import { meRouter } from "./routes/me";
import { rewardRouter } from "./routes/rewards";
import { taskRouter } from "./routes/tasks";

const app = express();

app.use(
    cors({
        origin: env.corsOrigin,
        credentials: true,
    }),
);
app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/me", meRouter);
app.use("/api/bootstrap", bootstrapRouter);
app.use("/api/tasks", taskRouter);
app.use("/api/rewards", rewardRouter);

app.get("/", (_req, res) => {
    res.json({ message: "Habit battle pass API is running" });
});

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(env.port, () => {
    console.log(`API server listening on port ${env.port}`);
});

async function shutdown(): Promise<void> {
    await prisma.$disconnect();
    server.close(() => {
        process.exit(0);
    });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
