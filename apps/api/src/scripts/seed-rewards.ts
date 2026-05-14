import { prisma } from "../lib/prisma";
import { getCurrentSeasonRange } from "../utils/season";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const rowPattern = /^(TOTAL|SEASON)\s*,\s*Lv\s*(\d+)\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"\s*$/i;

type RewardRow = {
    scope: "TOTAL" | "SEASON";
    requiredLevel: number;
    title: string;
    description: string | null;
};

function getArgValue(flag: string): string | undefined {
    const index = process.argv.indexOf(flag);
    if (index === -1) {
        return undefined;
    }
    return process.argv[index + 1];
}

function parseRewardRows(rowsInput: string): RewardRow[] {
    const rows = rowsInput
        .split(";")
        .map((row) => row.trim())
        .filter(Boolean);

    if (rows.length === 0) {
        throw new Error("No reward rows provided.");
    }

    return rows.map((row) => {
        const match = rowPattern.exec(row);
        if (!match) {
            throw new Error(`Invalid row format: ${row}`);
        }

        const scope = match[1].toUpperCase() as "TOTAL" | "SEASON";
        const requiredLevel = Number(match[2]);
        if (!Number.isFinite(requiredLevel) || requiredLevel < 1) {
            throw new Error(`Invalid required level in row: ${row}`);
        }

        const title = match[3].trim();
        if (!title) {
            throw new Error(`Title cannot be empty in row: ${row}`);
        }

        const description = match[4].trim();

        return {
            scope,
            requiredLevel,
            title,
            description: description ? description : null,
        };
    });
}

async function resolveUserId(rawValue: string): Promise<string> {
    if (uuidPattern.test(rawValue)) {
        return rawValue;
    }

    const user = await prisma.userProfile.findUnique({
        where: { email: rawValue },
    });

    if (!user) {
        throw new Error(`User not found for email: ${rawValue}`);
    }

    return user.id;
}

async function resolveSeasonId(): Promise<string> {
    const range = getCurrentSeasonRange();
    const existing = await prisma.season.findUnique({
        where: {
            startsAt_endsAt: {
                startsAt: range.startsAt,
                endsAt: range.endsAt,
            },
        },
    });

    if (existing) {
        return existing.id;
    }

    const created = await prisma.season.create({
        data: {
            name: range.name,
            startsAt: range.startsAt,
            endsAt: range.endsAt,
        },
    });

    return created.id;
}

async function main(): Promise<void> {
    const userArg = getArgValue("--user");
    const rowsArg = getArgValue("--rows");

    if (!userArg || !rowsArg) {
        throw new Error("Usage: tsx src/scripts/seed-rewards.ts --user <uuid|email> --rows \"TOTAL, Lv 2, \"Title\", \"Desc\"; SEASON, Lv 3, \"Title\", \"\"\"");
    }

    const userId = await resolveUserId(userArg);
    const rows = parseRewardRows(rowsArg);
    const seasonId = await resolveSeasonId();

    const createRows = rows.map((row) => ({
        userId,
        seasonId: row.scope === "SEASON" ? seasonId : null,
        scope: row.scope,
        requiredLevel: row.requiredLevel,
        title: row.title,
        description: row.description,
    }));

    await prisma.reward.createMany({
        data: createRows,
    });

    const created = await prisma.reward.findMany({
        where: {
            userId,
            title: {
                in: rows.map((row) => row.title),
            },
        },
        orderBy: {
            createdAt: "desc",
        },
        take: rows.length,
    });

    console.log(JSON.stringify({
        createdCount: createRows.length,
        rewards: created.map((reward) => ({
            id: reward.id,
            scope: reward.scope,
            requiredLevel: reward.requiredLevel,
            title: reward.title,
            isClaimed: reward.isClaimed,
        })),
    }, null, 2));
}

main()
    .catch((error: unknown) => {
        console.error("[seed-rewards] failed", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
