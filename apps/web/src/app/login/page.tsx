"use client";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
    async function signInWithGoogle(): Promise<void> {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
    }

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center p-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
                <h1 className="text-2xl font-bold text-zinc-900">ログイン</h1>
                <p className="mt-2 text-sm text-zinc-600">
                    Google アカウントでログインして習慣化バトルパスを開始します。
                </p>
                <Button className="mt-6 w-full" onClick={signInWithGoogle}>
                    Google でログイン
                </Button>
            </div>
        </main>
    );
}
