import path from "path";
import dotenv from "dotenv";
import { PrismaClient } from "../generated/prisma/client";

// Ensure scripts executed from workspace root can still resolve apps/api/.env.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const prisma = new PrismaClient();
