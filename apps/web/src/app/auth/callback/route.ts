import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const next = requestUrl.searchParams.get("next") ?? "/";
    const safeNext = next.startsWith("/") ? next : "/";

    if (!code) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("error", "oauth_code_missing");
        return NextResponse.redirect(loginUrl);
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("error", "oauth_exchange_failed");
        return NextResponse.redirect(loginUrl);
    }

    const redirectUrl = new URL(safeNext, request.url);
    return NextResponse.redirect(redirectUrl);
}
