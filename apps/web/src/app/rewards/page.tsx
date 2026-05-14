"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type SessionInfo = {
    accessToken: string;
    email: string | null;
};

type RewardScope = "TOTAL" | "SEASON";

type Reward = {
    id: string;
    title: string;
    description: string | null;
    scope: RewardScope;
    requiredLevel: number;
    isClaimed: boolean;
    claimedAt: string | null;
    seasonId: string | null;
    season?: {
        id: string;
        name: string;
    } | null;
};

type RewardsResponse = {
    rewards: Reward[];
};

type ClaimResponse = {
    reward: Reward;
};

type BootstrapResponse = {
    progress: {
        totalLevel: number;
        seasonLevel: number;
    };
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function scopeLabel(scope: RewardScope): string {
    return scope === "TOTAL" ? "通算報酬" : "シーズン報酬";
}

function statusLabel(isClaimed: boolean): string {
    return isClaimed ? "受け取り済み" : "未受け取り";
}

export default function RewardsPage() {
    const [supabase] = useState<SupabaseClient>(() => createSupabaseBrowserClient());
    const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
    const [mutationError, setMutationError] = useState<string | null>(null);
    const [claimingRewardId, setClaimingRewardId] = useState<string | null>(null);
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!supabase) {
            return;
        }

        supabase.auth.getSession().then(({ data }) => {
            const session = data.session;
            if (!session) {
                setSessionInfo(null);
                return;
            }

            setSessionInfo({
                accessToken: session.access_token,
                email: session.user.email ?? null,
            });
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                setSessionInfo(null);
                return;
            }

            setSessionInfo({
                accessToken: session.access_token,
                email: session.user.email ?? null,
            });
        });

        return () => subscription.unsubscribe();
    }, [supabase]);

    const rewardsQuery = useQuery({
        queryKey: ["rewards", sessionInfo?.email],
        enabled: !!sessionInfo,
        queryFn: async (): Promise<RewardsResponse> => {
            const response = await fetch(`${apiBaseUrl}/api/rewards`, {
                headers: {
                    Authorization: `Bearer ${sessionInfo!.accessToken}`,
                },
            });

            if (!response.ok) {
                let detail = "Unknown error";
                try {
                    const body = (await response.json()) as { error?: string; message?: string };
                    detail = body.error ?? body.message ?? JSON.stringify(body);
                } catch {
                    const text = await response.text();
                    detail = text || detail;
                }
                throw new Error(`Rewards load failed (${response.status}): ${detail}`);
            }

            return response.json() as Promise<RewardsResponse>;
        },
    });

    const bootstrapQuery = useQuery({
        queryKey: ["bootstrap", sessionInfo?.email],
        enabled: !!sessionInfo,
        queryFn: async (): Promise<BootstrapResponse> => {
            const response = await fetch(`${apiBaseUrl}/api/bootstrap`, {
                headers: {
                    Authorization: `Bearer ${sessionInfo!.accessToken}`,
                },
            });

            if (!response.ok) {
                let detail = "Unknown error";
                try {
                    const body = (await response.json()) as { error?: string; message?: string };
                    detail = body.error ?? body.message ?? JSON.stringify(body);
                } catch {
                    const text = await response.text();
                    detail = text || detail;
                }
                throw new Error(`Bootstrap failed (${response.status}): ${detail}`);
            }

            return response.json() as Promise<BootstrapResponse>;
        },
    });

    const claimRewardMutation = useMutation({
        mutationFn: async (rewardId: string): Promise<ClaimResponse> => {
            const response = await fetch(`${apiBaseUrl}/api/rewards/${rewardId}/claim`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${sessionInfo!.accessToken}`,
                },
            });

            if (!response.ok) {
                let detail = "Unknown error";
                try {
                    const body = (await response.json()) as { error?: string; message?: string };
                    detail = body.error ?? body.message ?? JSON.stringify(body);
                } catch {
                    const text = await response.text();
                    detail = text || detail;
                }
                throw new Error(`Claim failed (${response.status}): ${detail}`);
            }

            return response.json() as Promise<ClaimResponse>;
        },
        onMutate: (rewardId) => {
            setMutationError(null);
            setClaimingRewardId(rewardId);
        },
        onSuccess: (result) => {
            queryClient.setQueryData<RewardsResponse>(["rewards", sessionInfo?.email], (prev) => {
                if (!prev) {
                    return prev;
                }

                return {
                    rewards: prev.rewards.map((reward) => (reward.id === result.reward.id ? result.reward : reward)),
                };
            });
        },
        onError: (error) => {
            setMutationError((error as Error).message);
        },
        onSettled: () => {
            setClaimingRewardId(null);
        },
    });

    const rewards = rewardsQuery.data?.rewards ?? [];
    const progress = bootstrapQuery.data?.progress ?? null;

    function canClaimReward(reward: Reward): boolean {
        if (!progress) {
            return false;
        }

        const currentLevel = reward.scope === "TOTAL" ? progress.totalLevel : progress.seasonLevel;

        return currentLevel >= reward.requiredLevel;
    }

    const groupedRewards = useMemo(() => {
        return {
            total: rewards.filter((reward) => reward.scope === "TOTAL"),
            season: rewards.filter((reward) => reward.scope === "SEASON"),
        };
    }, [rewards]);

    if (!sessionInfo) {
        return (
            <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center p-6">
                <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
                    <h1 className="text-2xl font-bold text-zinc-900">報酬一覧</h1>
                    <p className="mt-2 text-sm text-zinc-600">ログイン後に報酬一覧を確認できます。</p>
                    <Link href="/login" prefetch={false} className="mt-6 inline-flex">
                        <Button>ログインへ</Button>
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-4 p-4 sm:gap-6 sm:p-6">
            <header className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-sm text-zinc-500">報酬一覧</p>
                        <h1 className="text-2xl font-bold text-zinc-900">Rewards</h1>
                        <p className="text-sm text-zinc-600">{sessionInfo.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Link href="/" prefetch={false}>
                            <Button variant="secondary">ホームへ戻る</Button>
                        </Link>
                    </div>
                </div>
            </header>

            <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                {rewardsQuery.isLoading && <p className="text-zinc-600">報酬を読み込み中です...</p>}
                {rewardsQuery.isError && (
                    <p className="text-sm text-red-600">
                        データ取得に失敗しました: {(rewardsQuery.error as Error).message}
                    </p>
                )}
                {mutationError && <p className="mt-2 text-sm text-red-600">操作に失敗しました: {mutationError}</p>}

                {!rewardsQuery.isLoading && rewards.length === 0 && (
                    <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-500">
                        まだ報酬がありません。レベル到達後にここで受け取れます。
                    </div>
                )}

                {rewards.length > 0 && (
                    <div className="grid gap-4 lg:grid-cols-2">
                        {(["TOTAL", "SEASON"] as const).map((scope) => {
                            const list = scope === "TOTAL" ? groupedRewards.total : groupedRewards.season;
                            return (
                                <div key={scope} className="rounded-lg border border-zinc-200 p-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <h2 className="text-sm font-semibold text-zinc-800">{scopeLabel(scope)}</h2>
                                        <span className="text-xs text-zinc-500">{list.length} 件</span>
                                    </div>
                                    {list.length === 0 ? (
                                        <p className="mt-3 text-sm text-zinc-500">未登録の報酬はありません。</p>
                                    ) : (
                                        <ul className="mt-3 space-y-3">
                                            {list.map((reward) => (
                                                <li key={reward.id} className="rounded-md border border-zinc-200 p-3">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div>
                                                            <p className="text-sm font-semibold text-zinc-900">{reward.title}</p>
                                                            <p className="mt-1 text-xs text-zinc-500">必要レベル: Lv {reward.requiredLevel}</p>
                                                            {reward.description && (
                                                                <p className="mt-1 text-xs text-zinc-600">{reward.description}</p>
                                                            )}
                                                            {reward.scope === "SEASON" && reward.season?.name && (
                                                                <p className="mt-1 text-[11px] text-zinc-500">対象シーズン: {reward.season.name}</p>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col items-end gap-2">
                                                            <span
                                                                className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                                                                    reward.isClaimed
                                                                        ? "bg-zinc-100 text-zinc-600"
                                                                        : "bg-emerald-100 text-emerald-700"
                                                                }`}
                                                            >
                                                                {statusLabel(reward.isClaimed)}
                                                            </span>
                                                            <Button
                                                                size="sm"
                                                                variant={reward.isClaimed ? "secondary" : "primary"}
                                                                onClick={() => claimRewardMutation.mutate(reward.id)}
                                                                disabled={reward.isClaimed || claimingRewardId === reward.id || !canClaimReward(reward)}
                                                            >
                                                                {reward.isClaimed ? "受け取り済み" : "受け取る"}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    {reward.isClaimed && reward.claimedAt && (
                                                        <p className="mt-2 text-[11px] text-zinc-500">
                                                            受け取り日時: {new Date(reward.claimedAt).toLocaleString()}
                                                        </p>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </main>
    );
}
