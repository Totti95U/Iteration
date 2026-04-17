"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUiStore } from "@/store/ui-store";

type TaskType = "DAILY" | "WEEKLY" | "SEASON";

type SessionInfo = {
  accessToken: string;
  email: string | null;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  type: TaskType;
  targetCount: number;
  currentCount: number;
  xpValue: number;
  rewardHint: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  createdAt: string;
};

type BootstrapResponse = {
  season: {
    id: string;
    name: string;
    startsAt: string;
    endsAt: string;
  };
  progress: {
    totalXp: number;
    totalLevel: number;
    seasonXp: number;
    seasonLevel: number;
  };
  xpOptions: Array<{
    id: string;
    type: TaskType;
    label: string;
    value: number;
  }>;
};

type TaskFormState = {
  title: string;
  description: string;
  type: TaskType;
  targetCount: number;
  xpValue: number;
  rewardHint: string;
};

const taskTemplates: Record<TaskType, Array<Omit<TaskFormState, "type"> & { name: string }>> = {
  DAILY: [
    {
      name: "軽い筋トレ",
      title: "腕立てを10回やる",
      description: "フォーム重視で丁寧に実施",
      targetCount: 10,
      xpValue: 10,
      rewardHint: "コーヒーを飲む",
    },
    {
      name: "ストレッチ",
      title: "ストレッチを5回やる",
      description: "朝か夜のどちらかで実施",
      targetCount: 5,
      xpValue: 5,
      rewardHint: "5分休憩",
    },
  ],
  WEEKLY: [
    {
      name: "有酸素",
      title: "30分の有酸素運動を3回やる",
      description: "ランニングやウォーキング",
      targetCount: 3,
      xpValue: 35,
      rewardHint: "週末に好きな食事",
    },
    {
      name: "筋トレセット",
      title: "筋トレメニューを4回こなす",
      description: "上半身2回・下半身2回",
      targetCount: 4,
      xpValue: 50,
      rewardHint: "動画視聴時間を確保",
    },
  ],
  SEASON: [
    {
      name: "累積挑戦",
      title: "シーズンで筋トレを40回行う",
      description: "記録を途切れさせない",
      targetCount: 40,
      xpValue: 180,
      rewardHint: "良い食事を食べる",
    },
    {
      name: "体力改善",
      title: "10km相当の運動量を達成する",
      description: "複数日に分割可",
      targetCount: 10,
      xpValue: 240,
      rewardHint: "欲しかった小物を買う",
    },
  ],
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function emptyTaskForm(type: TaskType, xpValue = 10): TaskFormState {
  return {
    title: "",
    description: "",
    type,
    targetCount: 1,
    xpValue,
    rewardHint: "",
  };
}

export default function Home() {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState<"new" | "template" | "duplicate">("new");
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);
  const [duplicateSourceId, setDuplicateSourceId] = useState<string>("");
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const { activeTab, setActiveTab } = useUiStore();
  const queryClient = useQueryClient();
  const [createForm, setCreateForm] = useState<TaskFormState>(() => emptyTaskForm("DAILY"));
  const [editForm, setEditForm] = useState<TaskFormState>(() => emptyTaskForm("DAILY"));

  useEffect(() => {
    setSupabase(createSupabaseBrowserClient());
  }, []);

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

  useEffect(() => {
    setCreateForm((prev) => ({ ...prev, type: activeTab }));
  }, [activeTab]);

  const authHeaders = sessionInfo
    ? {
        Authorization: `Bearer ${sessionInfo.accessToken}`,
        "Content-Type": "application/json",
      }
    : undefined;

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

  const tasksQuery = useQuery({
    queryKey: ["tasks", activeTab, sessionInfo?.email],
    enabled: !!sessionInfo,
    queryFn: async (): Promise<{ tasks: Task[] }> => {
      const response = await fetch(`${apiBaseUrl}/api/tasks?type=${activeTab}`, {
        headers: authHeaders,
      });

      if (!response.ok) {
        throw new Error("Failed to load tasks");
      }

      return response.json() as Promise<{ tasks: Task[] }>;
    },
  });

  const allTasksQuery = useQuery({
    queryKey: ["tasks", "all", sessionInfo?.email],
    enabled: !!sessionInfo,
    queryFn: async (): Promise<{ tasks: Task[] }> => {
      const response = await fetch(`${apiBaseUrl}/api/tasks`, {
        headers: authHeaders,
      });

      if (!response.ok) {
        throw new Error("Failed to load all tasks");
      }

      return response.json() as Promise<{ tasks: Task[] }>;
    },
  });

  const selectedTaskQuery = useQuery({
    queryKey: ["task-detail", selectedTaskId, sessionInfo?.email],
    enabled: !!sessionInfo && !!selectedTaskId,
    queryFn: async (): Promise<{ task: Task }> => {
      const response = await fetch(`${apiBaseUrl}/api/tasks/${selectedTaskId}`, {
        headers: authHeaders,
      });

      if (!response.ok) {
        throw new Error("Failed to load task detail");
      }

      return response.json() as Promise<{ task: Task }>;
    },
  });

  useEffect(() => {
    const option = bootstrapQuery.data?.xpOptions.find((value) => value.type === createForm.type);
    if (!option) {
      return;
    }

    setCreateForm((prev) => (prev.xpValue === option.value ? prev : { ...prev, xpValue: option.value }));
  }, [bootstrapQuery.data?.xpOptions, createForm.type]);

  const createTaskMutation = useMutation({
    mutationFn: async (payload: TaskFormState) => {
      const response = await fetch(`${apiBaseUrl}/api/tasks`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to create task");
      }

      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setCreateForm(emptyTaskForm(activeTab, createForm.xpValue));
      setCreateMode("new");
      setDuplicateSourceId("");
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, payload }: { taskId: string; payload: TaskFormState }) => {
      const response = await fetch(`${apiBaseUrl}/api/tasks/${taskId}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to update task");
      }

      return response.json();
    },
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["task-detail", variables.taskId] });
      setEditTaskId(null);
    },
  });

  const taskActionMutation = useMutation({
    mutationFn: async ({ taskId, action }: { taskId: string; action: "increment" | "decrement" | "complete" }) => {
      const response = await fetch(`${apiBaseUrl}/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error("Failed task action");
      }

      return response.json();
    },
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["task-detail", variables.taskId] });
      void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });

  const activeOptions = bootstrapQuery.data?.xpOptions.filter((option) => option.type === createForm.type) ?? [];
  const duplicateCandidates = allTasksQuery.data?.tasks.filter((task) => task.type === createForm.type) ?? [];

  function applyTemplate(index: number, type: TaskType): void {
    const template = taskTemplates[type][index];
    if (!template) {
      return;
    }

    setCreateForm({
      title: template.title,
      description: template.description,
      type,
      targetCount: template.targetCount,
      xpValue: template.xpValue,
      rewardHint: template.rewardHint,
    });
  }

  function applyDuplicate(taskId: string): void {
    const source = allTasksQuery.data?.tasks.find((task) => task.id === taskId);
    if (!source) {
      return;
    }

    setCreateForm({
      title: source.title,
      description: source.description ?? "",
      type: source.type,
      targetCount: source.targetCount,
      xpValue: source.xpValue,
      rewardHint: source.rewardHint ?? "",
    });
  }

  async function handleSignOut(): Promise<void> {
    if (!supabase) {
      return;
    }
    await supabase.auth.signOut();
    }

  function openEdit(task: Task): void {
    setEditTaskId(task.id);
    setEditForm({
      title: task.title,
      description: task.description ?? "",
      type: task.type,
      targetCount: task.targetCount,
      xpValue: task.xpValue,
      rewardHint: task.rewardHint ?? "",
    });
  }

  function submitCreateForm(): void {
    createTaskMutation.mutate(createForm);
  }

  function submitEditForm(): void {
    if (!editTaskId) {
      return;
    }

    updateTaskMutation.mutate({ taskId: editTaskId, payload: editForm });
  }

  if (!supabase) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center p-6">
        <p className="text-zinc-600">初期化中です...</p>
      </main>
    );
  }

  if (!sessionInfo) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 p-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-zinc-900">Habit Battle Pass</h1>
          <p className="mt-2 text-zinc-600">習慣をゲーム化して、デイリー・ウィークリー・シーズンの目標を進めます。</p>
          <Link href="/login" className="mt-6 inline-flex">
            <Button>ログインして開始</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-6">
      <header className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Habit Battle Pass</h1>
            <p className="text-sm text-zinc-600">{sessionInfo.email}</p>
          </div>
          <Button variant="secondary" onClick={handleSignOut}>
            ログアウト
          </Button>
        </div>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        {bootstrapQuery.isLoading && <p className="text-zinc-600">初期データを読み込み中です...</p>}
        {bootstrapQuery.isError && (
          <p className="text-sm text-red-600">
            データ取得に失敗しました: {(bootstrapQuery.error as Error).message}
          </p>
        )}

        {bootstrapQuery.data && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-200 p-4">
                <p className="text-sm text-zinc-500">通算レベル</p>
                <p className="text-2xl font-bold text-zinc-900">Lv {bootstrapQuery.data.progress.totalLevel}</p>
                <p className="text-sm text-zinc-600">XP: {bootstrapQuery.data.progress.totalXp}</p>
              </div>
              <div className="rounded-lg border border-zinc-200 p-4">
                <p className="text-sm text-zinc-500">シーズンレベル</p>
                <p className="text-2xl font-bold text-zinc-900">Lv {bootstrapQuery.data.progress.seasonLevel}</p>
                <p className="text-sm text-zinc-600">XP: {bootstrapQuery.data.progress.seasonXp}</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-zinc-500">現在のシーズン</p>
              <p className="text-lg font-semibold text-zinc-900">{bootstrapQuery.data.season.name}</p>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                {(["DAILY", "WEEKLY", "SEASON"] as const).map((tab: TaskType) => (
                  <Button key={tab} variant={activeTab === tab ? "primary" : "secondary"} size="sm" onClick={() => setActiveTab(tab)}>
                    {tab}
                  </Button>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-5">
                <div className="rounded-lg border border-zinc-200 p-4 lg:col-span-2">
                  <p className="text-sm font-semibold text-zinc-700">{activeTab} のタスク一覧</p>
                  {tasksQuery.isLoading && <p className="mt-3 text-sm text-zinc-500">読み込み中...</p>}
                  {tasksQuery.data?.tasks.length === 0 && <p className="mt-3 text-sm text-zinc-500">タスクがまだありません。</p>}
                  <ul className="mt-3 space-y-2">
                    {tasksQuery.data?.tasks.map((task) => (
                      <li key={task.id}>
                        <button
                          className={`w-full rounded-md border p-3 text-left transition ${task.id === selectedTaskId ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 bg-white"} ${task.isCompleted ? "opacity-55" : "opacity-100"}`}
                          onClick={() => setSelectedTaskId(task.id)}
                        >
                          <p className="text-sm font-semibold text-zinc-900">{task.title}</p>
                          <p className="text-xs text-zinc-600">
                            {task.currentCount}/{task.targetCount} • {task.xpValue} XP
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg border border-zinc-200 p-4 lg:col-span-3">
                  <p className="text-sm font-semibold text-zinc-700">タスク詳細</p>
                  {!selectedTaskId && <p className="mt-3 text-sm text-zinc-500">左の一覧からタスクを選択してください。</p>}
                  {selectedTaskQuery.isLoading && <p className="mt-3 text-sm text-zinc-500">詳細を読み込み中...</p>}
                  {selectedTaskQuery.data?.task && (
                    <div className="mt-3 space-y-3">
                      <p className="text-lg font-semibold text-zinc-900">{selectedTaskQuery.data.task.title}</p>
                      <p className="text-sm text-zinc-600">{selectedTaskQuery.data.task.description ?? "説明なし"}</p>
                      <p className="text-sm text-zinc-700">進捗: {selectedTaskQuery.data.task.currentCount}/{selectedTaskQuery.data.task.targetCount}</p>
                      <p className="text-sm text-zinc-700">経験値: {selectedTaskQuery.data.task.xpValue} XP</p>
                                            <p className="text-xs text-zinc-500">作成日時: {new Date(selectedTaskQuery.data.task.createdAt).toLocaleString()}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => taskActionMutation.mutate({ taskId: selectedTaskQuery.data!.task.id, action: "increment" })} disabled={selectedTaskQuery.data.task.isCompleted}>
                          +1
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => taskActionMutation.mutate({ taskId: selectedTaskQuery.data!.task.id, action: "decrement" })} disabled={selectedTaskQuery.data.task.isCompleted}>
                          -1
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => taskActionMutation.mutate({ taskId: selectedTaskQuery.data!.task.id, action: "complete" })}
                          disabled={selectedTaskQuery.data.task.isCompleted || selectedTaskQuery.data.task.currentCount < selectedTaskQuery.data.task.targetCount}
                        >
                          完了
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => openEdit(selectedTaskQuery.data!.task)}>
                          編集
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setCreateMode("duplicate");
                            setDuplicateSourceId(selectedTaskQuery.data!.task.id);
                            applyDuplicate(selectedTaskQuery.data!.task.id);
                          }}
                        >
                          複製して新規作成
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 p-4">
                <p className="text-sm font-semibold text-zinc-700">タスク作成</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant={createMode === "new" ? "primary" : "secondary"} onClick={() => setCreateMode("new")}>
                    新規
                  </Button>
                  <Button
                    size="sm"
                    variant={createMode === "template" ? "primary" : "secondary"}
                    onClick={() => {
                      setCreateMode("template");
                      setSelectedTemplateIndex(0);
                      applyTemplate(0, createForm.type);
                    }}
                  >
                    テンプレート
                  </Button>
                  <Button size="sm" variant={createMode === "duplicate" ? "primary" : "secondary"} onClick={() => setCreateMode("duplicate")}>
                    既存タスク流用
                  </Button>
                </div>
                <p className="mt-2 text-xs text-zinc-500">新規は空フォーム、テンプレートは定型入力、既存タスク流用は選択したタスク内容を複製します。</p>

                {createMode === "template" && (
                  <div className="mt-3 space-y-2">
                    <label className="text-xs text-zinc-600">テンプレート選択</label>
                    <select
                      className="w-full rounded-md border border-zinc-300 bg-white p-2 text-sm"
                      value={selectedTemplateIndex}
                      onChange={(event) => {
                        const index = Number(event.target.value);
                        setSelectedTemplateIndex(index);
                        applyTemplate(index, createForm.type);
                      }}
                    >
                      {taskTemplates[createForm.type].map((template, index) => (
                        <option key={template.name} value={index}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {createMode === "duplicate" && (
                  <div className="mt-3 space-y-2">
                    <label className="text-xs text-zinc-600">流用元タスク</label>
                    <select
                      className="w-full rounded-md border border-zinc-300 bg-white p-2 text-sm"
                      value={duplicateSourceId}
                      onChange={(event) => {
                        const value = event.target.value;
                        setDuplicateSourceId(value);
                        applyDuplicate(value);
                      }}
                    >
                      <option value="">選択してください</option>
                      {duplicateCandidates.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="text-xs text-zinc-600 md:col-span-2">
                    タイトル
                    <input className="mt-1 w-full rounded-md border border-zinc-300 p-2 text-sm" value={createForm.title} onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))} />
                  </label>
                  <label className="text-xs text-zinc-600 md:col-span-2">
                    説明
                    <textarea className="mt-1 w-full rounded-md border border-zinc-300 p-2 text-sm" value={createForm.description} onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))} />
                  </label>
                  <label className="text-xs text-zinc-600">
                    種類
                    <select className="mt-1 w-full rounded-md border border-zinc-300 bg-white p-2 text-sm" value={createForm.type} onChange={(event) => setCreateForm((prev) => ({ ...prev, type: event.target.value as TaskType }))}>
                      <option value="DAILY">DAILY</option>
                      <option value="WEEKLY">WEEKLY</option>
                      <option value="SEASON">SEASON</option>
                    </select>
                  </label>
                  <label className="text-xs text-zinc-600">
                    目標回数
                    <input type="number" min={1} className="mt-1 w-full rounded-md border border-zinc-300 p-2 text-sm" value={createForm.targetCount} onChange={(event) => setCreateForm((prev) => ({ ...prev, targetCount: Number(event.target.value) }))} />
                  </label>
                  <label className="text-xs text-zinc-600">
                    経験値候補
                    <select className="mt-1 w-full rounded-md border border-zinc-300 bg-white p-2 text-sm" value={createForm.xpValue} onChange={(event) => setCreateForm((prev) => ({ ...prev, xpValue: Number(event.target.value) }))}>
                      {activeOptions.map((option) => (
                        <option key={option.id} value={option.value}>
                          {option.label} ({option.value} XP)
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-zinc-600">
                    報酬メモ
                    <input className="mt-1 w-full rounded-md border border-zinc-300 p-2 text-sm" value={createForm.rewardHint} onChange={(event) => setCreateForm((prev) => ({ ...prev, rewardHint: event.target.value }))} />
                  </label>
                </div>

                <div className="mt-4">
                  <Button onClick={submitCreateForm} disabled={createTaskMutation.isPending || !createForm.title.trim()}>
                    タスクを作成
                  </Button>
                </div>
              </div>

              {editTaskId && (
                <div className="rounded-lg border border-zinc-200 p-4">
                  <p className="text-sm font-semibold text-zinc-700">タスク編集</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="text-xs text-zinc-600 md:col-span-2">
                      タイトル
                      <input className="mt-1 w-full rounded-md border border-zinc-300 p-2 text-sm" value={editForm.title} onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))} />
                    </label>
                    <label className="text-xs text-zinc-600 md:col-span-2">
                      説明
                      <textarea className="mt-1 w-full rounded-md border border-zinc-300 p-2 text-sm" value={editForm.description} onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))} />
                    </label>
                    <label className="text-xs text-zinc-600">
                      種類
                      <select className="mt-1 w-full rounded-md border border-zinc-300 bg-white p-2 text-sm" value={editForm.type} onChange={(event) => setEditForm((prev) => ({ ...prev, type: event.target.value as TaskType }))}>
                        <option value="DAILY">DAILY</option>
                        <option value="WEEKLY">WEEKLY</option>
                        <option value="SEASON">SEASON</option>
                      </select>
                    </label>
                    <label className="text-xs text-zinc-600">
                      目標回数
                      <input type="number" min={1} className="mt-1 w-full rounded-md border border-zinc-300 p-2 text-sm" value={editForm.targetCount} onChange={(event) => setEditForm((prev) => ({ ...prev, targetCount: Number(event.target.value) }))} />
                    </label>
                    <label className="text-xs text-zinc-600">
                      経験値
                      <input type="number" min={1} className="mt-1 w-full rounded-md border border-zinc-300 p-2 text-sm" value={editForm.xpValue} onChange={(event) => setEditForm((prev) => ({ ...prev, xpValue: Number(event.target.value) }))} />
                    </label>
                    <label className="text-xs text-zinc-600">
                      報酬メモ
                      <input className="mt-1 w-full rounded-md border border-zinc-300 p-2 text-sm" value={editForm.rewardHint} onChange={(event) => setEditForm((prev) => ({ ...prev, rewardHint: event.target.value }))} />
                    </label>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button onClick={submitEditForm} disabled={updateTaskMutation.isPending || !editForm.title.trim()}>
                      編集を保存
                    </Button>
                    <Button variant="ghost" onClick={() => setEditTaskId(null)}>
                      キャンセル
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
