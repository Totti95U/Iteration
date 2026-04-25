"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const signInLockRef = useRef(false);
    const searchParams = useSearchParams();

    const callbackErrorMessage = useMemo(() => {
        const callbackError = searchParams.get("error");
        if (!callbackError) {
            return null;
        }

        return "ログイン処理に失敗しました。時間をおいて再度お試しください。";
    }, [searchParams]);

    async function signInWithGoogle(): Promise<void> {
        if (signInLockRef.current || isSigningIn) {
            return;
        }

        signInLockRef.current = true;
        setErrorMessage(null);
        setIsSigningIn(true);
        try {
            const supabase = createSupabaseBrowserClient();
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            });

            if (error) {
                setErrorMessage("Google ログインの開始に失敗しました。再度お試しください。");
                signInLockRef.current = false;
                setIsSigningIn(false);
            }
        } catch {
            setErrorMessage("Google ログインの開始に失敗しました。再度お試しください。");
            signInLockRef.current = false;
            setIsSigningIn(false);
        }
    }

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center p-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
                <h1 className="text-2xl font-bold text-zinc-900">ログイン</h1>
                <p className="mt-2 text-sm text-zinc-600">
                    Google アカウントでログインして習慣化バトルパスを開始します。
                </p>
                {callbackErrorMessage ? (
                    <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {callbackErrorMessage}
                    </p>
                ) : null}
                {errorMessage ? (
                    <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {errorMessage}
                    </p>
                ) : null}
                <Button className="mt-6 w-full" onClick={signInWithGoogle} disabled={isSigningIn}>
                    {isSigningIn ? "Google ログインへ遷移中..." : "Google でログイン"}
                </Button>
            </div>
        </main>
    );
}
