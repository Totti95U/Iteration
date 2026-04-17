import { NextFunction, Request, Response } from "express";
import { supabase } from "../lib/supabase";

export type AuthUser = {
    id: string;
    email: string | null;
};

export type AuthenticatedRequest = Request & {
    authUser?: AuthUser;
};

export async function requireAuth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
): Promise<void> {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        res.status(401).json({ error: "Missing bearer token" });
        return;
    }

    const token = header.slice("Bearer ".length).trim();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
        res.status(401).json({ error: "Invalid token" });
        return;
    }

    req.authUser = {
        id: data.user.id,
        email: data.user.email ?? null,
    };

    next();
}
