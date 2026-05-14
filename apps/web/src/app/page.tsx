"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUiStore } from "@/store/ui-store";

type TaskType = "DAILY" | "WEEKLY" | "SEASON";
type TaskActionType = "increment" | "decrement" | "reset" | "complete" | "adjust";
type ServerSeenTab = "DAILY" | "WEEKLY" | "SEASON";

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
  seasonState: {
    id: string;
    userId: string;
    seasonId: string;
    dailyUnseen: boolean;
    weeklyUnseen: boolean;
    seasonUnseen: boolean;
    dailySeenAt: string | null;
    weeklySeenAt: string | null;
    seasonSeenAt: string | null;
  };
  xpOptions: Array<{
    id: string;
    type: TaskType;
    label: string;
    value: number;
  }>;
};

type TasksResponse = { tasks: Task[] };
type TaskDetailResponse = { task: Task };
type SeasonStateResponse = { seasonState: BootstrapResponse["seasonState"] };

type CachedTaskSnapshots = {
  daily: TasksResponse | undefined;
  weekly: TasksResponse | undefined;
  season: TasksResponse | undefined;
  all: TasksResponse | undefined;
  detail: TaskDetailResponse | undefined;
};

type TaskFormState = {
  title: string;
  description: string;
  type: TaskType;
  targetCount: number;
  xpValue: number;
  rewardHint: string;
};

type DeleteTarget = {
  id: string;
  title: string;
};

type ResetTarget = {
  id: string;
  title: string;
  currentCount: number;
  targetCount: number;
};

type DestructiveTarget =
  | {
      kind: "delete";
      payload: DeleteTarget;
    }
  | {
      kind: "reset";
      payload: ResetTarget;
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
const adjustFlushDelayMs = 200;
const dailyResetHourUtc = 0;
const dailyResetMinuteUtc = 0;
const dailyResetSecondUtc = 0;
const dailyResetMillisecondUtc = 0;
const weeklyResetWeekdayUtc = 1;

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
  const [supabase] = useState<SupabaseClient>(() => createSupabaseBrowserClient());
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
  const [destructiveTarget, setDestructiveTarget] = useState<DestructiveTarget | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [nowForCountdown, setNowForCountdown] = useState<number>(() => Date.now());
  const taskActionVersionRef = useRef<Record<string, number>>({});
  const bufferedAdjustDeltaRef = useRef<Record<string, number>>({});
  const bufferedAdjustTimerRef = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});

  const taskListKey = (type: TaskType | "all") => ["tasks", type, sessionInfo?.email] as const;
  const taskDetailKey = (taskId: string) => ["task-detail", taskId, sessionInfo?.email] as const;

  function snapshotTaskCaches(taskId: string): CachedTaskSnapshots {
    return {
      daily: queryClient.getQueryData<TasksResponse>(taskListKey("DAILY")),
      weekly: queryClient.getQueryData<TasksResponse>(taskListKey("WEEKLY")),
      season: queryClient.getQueryData<TasksResponse>(taskListKey("SEASON")),
      all: queryClient.getQueryData<TasksResponse>(taskListKey("all")),
      detail: queryClient.getQueryData<TaskDetailResponse>(taskDetailKey(taskId)),
    };
  }

  function restoreTaskCaches(snapshots: CachedTaskSnapshots): void {
    queryClient.setQueryData(taskListKey("DAILY"), snapshots.daily);
    queryClient.setQueryData(taskListKey("WEEKLY"), snapshots.weekly);
    queryClient.setQueryData(taskListKey("SEASON"), snapshots.season);
    queryClient.setQueryData(taskListKey("all"), snapshots.all);

    if (snapshots.detail) {
      queryClient.setQueryData(taskDetailKey(snapshots.detail.task.id), snapshots.detail);
    }
  }

  function upsertTaskInList(list: Task[] | undefined, task: Task, include: boolean): Task[] | undefined {
    if (!list) {
      return list;
    }

    const withoutTarget = list.filter((item) => item.id !== task.id);
    if (!include) {
      return withoutTarget;
    }

    return [task, ...withoutTarget];
  }

  function applyTaskToCaches(task: Task): void {
    queryClient.setQueryData<TasksResponse>(taskListKey("DAILY"), (prev) =>
      prev ? { tasks: upsertTaskInList(prev.tasks, task, task.type === "DAILY") ?? prev.tasks } : prev,
    );
    queryClient.setQueryData<TasksResponse>(taskListKey("WEEKLY"), (prev) =>
      prev ? { tasks: upsertTaskInList(prev.tasks, task, task.type === "WEEKLY") ?? prev.tasks } : prev,
    );
    queryClient.setQueryData<TasksResponse>(taskListKey("SEASON"), (prev) =>
      prev ? { tasks: upsertTaskInList(prev.tasks, task, task.type === "SEASON") ?? prev.tasks } : prev,
    );
    queryClient.setQueryData<TasksResponse>(taskListKey("all"), (prev) =>
      prev ? { tasks: upsertTaskInList(prev.tasks, task, true) ?? prev.tasks } : prev,
    );
    queryClient.setQueryData<TaskDetailResponse>(taskDetailKey(task.id), { task });
  }

  function applyOptimisticTaskAction(task: Task, action: TaskActionType, delta = 0): Task {
    if (task.isCompleted) {
      return task;
    }

    if (action === "increment") {
      return {
        ...task,
        currentCount: Math.min(task.targetCount, task.currentCount + 1),
      };
    }

    if (action === "decrement") {
      return {
        ...task,
        currentCount: Math.max(0, task.currentCount - 1),
      };
    }

    if (action === "reset") {
      return {
        ...task,
        currentCount: 0,
      };
    }

    if (action === "adjust") {
      return {
        ...task,
        currentCount: Math.max(0, Math.min(task.targetCount, task.currentCount + delta)),
      };
    }

    if (task.currentCount < task.targetCount) {
      return task;
    }

    return {
      ...task,
      isCompleted: true,
      completedAt: new Date().toISOString(),
    };
  }

  function getCachedTaskById(taskId: string): Task | undefined {
    return (
      queryClient.getQueryData<TaskDetailResponse>(taskDetailKey(taskId))?.task ??
      queryClient.getQueryData<TasksResponse>(taskListKey("all"))?.tasks.find((task) => task.id === taskId) ??
      queryClient.getQueryData<TasksResponse>(taskListKey("DAILY"))?.tasks.find((task) => task.id === taskId) ??
      queryClient.getQueryData<TasksResponse>(taskListKey("WEEKLY"))?.tasks.find((task) => task.id === taskId) ??
      queryClient.getQueryData<TasksResponse>(taskListKey("SEASON"))?.tasks.find((task) => task.id === taskId)
    );
  }

  function flushBufferedAdjust(taskId: string): void {
    const delta = bufferedAdjustDeltaRef.current[taskId] ?? 0;
    if (delta === 0) {
      return;
    }

    bufferedAdjustDeltaRef.current[taskId] = 0;
    const timer = bufferedAdjustTimerRef.current[taskId];
    if (timer) {
      clearTimeout(timer);
      bufferedAdjustTimerRef.current[taskId] = undefined;
    }

    taskActionMutation.mutate({
      taskId,
      action: "adjust",
      delta,
      skipOptimistic: true,
    });
  }

  function queueBufferedAdjust(taskId: string, step: 1 | -1): void {
    const baseTask = getCachedTaskById(taskId);
    if (!baseTask || baseTask.isCompleted) {
      return;
    }

    const optimisticTask = applyOptimisticTaskAction(baseTask, "adjust", step);
    const appliedDelta = optimisticTask.currentCount - baseTask.currentCount;
    if (appliedDelta === 0) {
      return;
    }

    applyTaskToCaches(optimisticTask);
    bufferedAdjustDeltaRef.current[taskId] = (bufferedAdjustDeltaRef.current[taskId] ?? 0) + appliedDelta;

    const timer = bufferedAdjustTimerRef.current[taskId];
    if (timer) {
      clearTimeout(timer);
    }

    bufferedAdjustTimerRef.current[taskId] = setTimeout(() => {
      flushBufferedAdjust(taskId);
    }, adjustFlushDelayMs);
  }

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
    const timers = bufferedAdjustTimerRef.current;
    return () => {
      for (const timer of Object.values(timers)) {
        if (timer) {
          clearTimeout(timer);
        }
      }
    };
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNowForCountdown(Date.now());
    }, 60_000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

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
    queryKey: taskListKey(activeTab),
    enabled: !!sessionInfo,
    queryFn: async (): Promise<TasksResponse> => {
      const response = await fetch(`${apiBaseUrl}/api/tasks?type=${activeTab}`, {
        headers: authHeaders,
      });

      if (!response.ok) {
        throw new Error("Failed to load tasks");
      }

      return response.json() as Promise<TasksResponse>;
    },
  });

  const allTasksQuery = useQuery({
    queryKey: taskListKey("all"),
    enabled: !!sessionInfo,
    queryFn: async (): Promise<TasksResponse> => {
      const response = await fetch(`${apiBaseUrl}/api/tasks`, {
        headers: authHeaders,
      });

      if (!response.ok) {
        throw new Error("Failed to load all tasks");
      }

      return response.json() as Promise<TasksResponse>;
    },
  });

  const selectedTaskQuery = useQuery({
    queryKey: ["task-detail", selectedTaskId, sessionInfo?.email],
    enabled: !!sessionInfo && !!selectedTaskId,
    queryFn: async (): Promise<TaskDetailResponse> => {
      const response = await fetch(`${apiBaseUrl}/api/tasks/${selectedTaskId}`, {
        headers: authHeaders,
      });

      if (!response.ok) {
        throw new Error("Failed to load task detail");
      }

      return response.json() as Promise<TaskDetailResponse>;
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (payload: TaskFormState): Promise<TaskDetailResponse> => {
      const response = await fetch(`${apiBaseUrl}/api/tasks`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to create task");
      }

      return response.json() as Promise<TaskDetailResponse>;
    },
    onMutate: async (payload) => {
      setMutationError(null);
      await queryClient.cancelQueries({ queryKey: ["tasks"] });

      const tempId = `temp-${Date.now()}`;
      const optimisticTask: Task = {
        id: tempId,
        title: payload.title,
        description: payload.description || null,
        type: payload.type,
        targetCount: Math.max(1, payload.targetCount),
        currentCount: 0,
        xpValue: payload.xpValue,
        rewardHint: payload.rewardHint || null,
        isCompleted: false,
        completedAt: null,
        createdAt: new Date().toISOString(),
      };

      const snapshots = snapshotTaskCaches(tempId);
      applyTaskToCaches(optimisticTask);

      return {
        snapshots,
        tempId,
      };
    },
    onError: (error, _payload, context) => {
      if (context?.snapshots) {
        restoreTaskCaches(context.snapshots);
      }
      setMutationError((error as Error).message);
    },
    onSuccess: (result, _payload, context) => {
      if (context?.tempId) {
        queryClient.setQueryData<TasksResponse>(taskListKey("DAILY"), (prev) =>
          prev
            ? {
                tasks: prev.tasks.map((task) => (task.id === context.tempId ? result.task : task)),
              }
            : prev,
        );
        queryClient.setQueryData<TasksResponse>(taskListKey("WEEKLY"), (prev) =>
          prev
            ? {
                tasks: prev.tasks.map((task) => (task.id === context.tempId ? result.task : task)),
              }
            : prev,
        );
        queryClient.setQueryData<TasksResponse>(taskListKey("SEASON"), (prev) =>
          prev
            ? {
                tasks: prev.tasks.map((task) => (task.id === context.tempId ? result.task : task)),
              }
            : prev,
        );
        queryClient.setQueryData<TasksResponse>(taskListKey("all"), (prev) =>
          prev
            ? {
                tasks: prev.tasks.map((task) => (task.id === context.tempId ? result.task : task)),
              }
            : prev,
        );

        if (selectedTaskId === context.tempId) {
          setSelectedTaskId(result.task.id);
        }
      }

      queryClient.setQueryData<TaskDetailResponse>(taskDetailKey(result.task.id), result);
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setCreateForm(emptyTaskForm(activeTab, createForm.xpValue));
      setCreateMode("new");
      setDuplicateSourceId("");
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, payload }: { taskId: string; payload: TaskFormState }): Promise<TaskDetailResponse> => {
      const response = await fetch(`${apiBaseUrl}/api/tasks/${taskId}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to update task");
      }

      return response.json() as Promise<TaskDetailResponse>;
    },
    onMutate: async ({ taskId, payload }) => {
      setMutationError(null);
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      await queryClient.cancelQueries({ queryKey: ["task-detail", taskId] });

      const snapshots = snapshotTaskCaches(taskId);
      const baseTask =
        snapshots.detail?.task ??
        snapshots.all?.tasks.find((task) => task.id === taskId) ??
        snapshots.daily?.tasks.find((task) => task.id === taskId) ??
        snapshots.weekly?.tasks.find((task) => task.id === taskId) ??
        snapshots.season?.tasks.find((task) => task.id === taskId);

      if (baseTask) {
        const optimisticTask: Task = {
          ...baseTask,
          title: payload.title,
          description: payload.description || null,
          type: payload.type,
          targetCount: Math.max(1, payload.targetCount),
          xpValue: payload.xpValue,
          rewardHint: payload.rewardHint || null,
        };
        applyTaskToCaches(optimisticTask);
      }

      return { snapshots };
    },
    onError: (error, _variables, context) => {
      if (context?.snapshots) {
        restoreTaskCaches(context.snapshots);
      }
      setMutationError((error as Error).message);
    },
    onSuccess: (result, variables) => {
      applyTaskToCaches(result.task);
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["task-detail", variables.taskId] });
      setEditTaskId(null);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await fetch(`${apiBaseUrl}/api/tasks/${taskId}`, {
        method: "DELETE",
        headers: authHeaders,
      });

      if (!response.ok) {
        throw new Error("Failed to delete task");
      }
    },
    onSuccess: (_result, taskId) => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["task-detail", taskId] });
      if (selectedTaskId === taskId) {
        setSelectedTaskId(null);
      }
      if (editTaskId === taskId) {
        setEditTaskId(null);
      }
    },
  });

  const seenStateMutation = useMutation({
    mutationFn: async ({ seasonId, tab }: { seasonId: string; tab: ServerSeenTab }): Promise<SeasonStateResponse> => {
      const response = await fetch(`${apiBaseUrl}/api/me/season-state/seen`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ seasonId, tab }),
      });

      if (!response.ok) {
        throw new Error("Failed to update seen state");
      }

      return response.json() as Promise<SeasonStateResponse>;
    },
    onMutate: () => {
      setMutationError(null);
    },
    onSuccess: (result) => {
      queryClient.setQueryData<BootstrapResponse>(["bootstrap", sessionInfo?.email], (prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          seasonState: result.seasonState,
        };
      });
    },
    onError: (error) => {
      setMutationError((error as Error).message);
    },
  });

  const taskActionMutation = useMutation({
    mutationFn: async ({ taskId, action, delta }: { taskId: string; action: TaskActionType; delta?: number; skipOptimistic?: boolean }): Promise<TaskDetailResponse> => {
      const response = await fetch(`${apiBaseUrl}/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify(delta === undefined ? { action } : { action, delta }),
      });

      if (!response.ok) {
        throw new Error("Failed task action");
      }

      return response.json() as Promise<TaskDetailResponse>;
    },
    onMutate: async ({ taskId, action, delta, skipOptimistic }) => {
      setMutationError(null);
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      await queryClient.cancelQueries({ queryKey: ["task-detail", taskId] });
      await queryClient.cancelQueries({ queryKey: ["bootstrap"] });

      const nextVersion = (taskActionVersionRef.current[taskId] ?? 0) + 1;
      taskActionVersionRef.current[taskId] = nextVersion;

      const snapshots = snapshotTaskCaches(taskId);
      const bootstrapSnapshot = queryClient.getQueryData<BootstrapResponse>(["bootstrap", sessionInfo?.email]);
      const baseTask =
        snapshots.detail?.task ??
        snapshots.all?.tasks.find((task) => task.id === taskId) ??
        snapshots.daily?.tasks.find((task) => task.id === taskId) ??
        snapshots.weekly?.tasks.find((task) => task.id === taskId) ??
        snapshots.season?.tasks.find((task) => task.id === taskId);

      if (baseTask && !skipOptimistic) {
        const optimisticTask = applyOptimisticTaskAction(baseTask, action, delta ?? 0);
        applyTaskToCaches(optimisticTask);

        if (action === "complete" && optimisticTask.isCompleted && bootstrapSnapshot) {
          queryClient.setQueryData<BootstrapResponse>(["bootstrap", sessionInfo?.email], {
            ...bootstrapSnapshot,
            progress: {
              ...bootstrapSnapshot.progress,
              totalXp: bootstrapSnapshot.progress.totalXp + optimisticTask.xpValue,
              seasonXp: bootstrapSnapshot.progress.seasonXp + optimisticTask.xpValue,
            },
          });
        }
      }

      return {
        snapshots,
        bootstrapSnapshot,
        taskId,
        version: nextVersion,
      };
    },
    onError: (error, _variables, context) => {
      if (context?.taskId && context?.version !== undefined) {
        const latestVersion = taskActionVersionRef.current[context.taskId] ?? 0;
        if (latestVersion !== context.version) {
          return;
        }
      }

      if (context?.snapshots) {
        restoreTaskCaches(context.snapshots);
      }
      if (context?.bootstrapSnapshot) {
        queryClient.setQueryData(["bootstrap", sessionInfo?.email], context.bootstrapSnapshot);
      }
      setMutationError((error as Error).message);
    },
    onSuccess: (result, variables, context) => {
      if (context?.taskId && context?.version !== undefined) {
        const latestVersion = taskActionVersionRef.current[context.taskId] ?? 0;
        if (latestVersion === context.version) {
          applyTaskToCaches(result.task);
        }
      }
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["task-detail", variables.taskId] });
      void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });

  const activeOptions = bootstrapQuery.data?.xpOptions.filter((option) => option.type === createForm.type) ?? [];
  const resolvedCreateXpValue =
    activeOptions.some((option) => option.value === createForm.xpValue)
      ? createForm.xpValue
      : (activeOptions[0]?.value ?? createForm.xpValue);
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
    createTaskMutation.mutate({
      ...createForm,
      xpValue: resolvedCreateXpValue,
    });
  }

  function submitEditForm(): void {
    if (!editTaskId) {
      return;
    }

    updateTaskMutation.mutate({ taskId: editTaskId, payload: editForm });
  }

  function handleDeleteTask(taskId: string, taskTitle: string): void {
    setDestructiveTarget({
      kind: "delete",
      payload: { id: taskId, title: taskTitle },
    });
  }

  function handleConfirmDestructiveAction(): void {
    if (!destructiveTarget) {
      return;
    }

    if (destructiveTarget.kind === "delete") {
      deleteTaskMutation.mutate(destructiveTarget.payload.id, {
        onSuccess: () => {
          setDestructiveTarget(null);
        },
      });
      return;
    }

    flushBufferedAdjust(destructiveTarget.payload.id);
    taskActionMutation.mutate(
      { taskId: destructiveTarget.payload.id, action: "reset" },
      {
        onSuccess: () => {
          setDestructiveTarget(null);
        },
      },
    );
  }

  function handleResetProgress(task: Task): void {
    setDestructiveTarget({
      kind: "reset",
      payload: {
        id: task.id,
        title: task.title,
        currentCount: task.currentCount,
        targetCount: task.targetCount,
      },
    });
  }

  function isTabUnseen(tab: TaskType): boolean {
    if (!bootstrapQuery.data) {
      return false;
    }

    if (tab === "DAILY") {
      return bootstrapQuery.data.seasonState.dailyUnseen;
    }

    return tab === "WEEKLY" ? bootstrapQuery.data.seasonState.weeklyUnseen : bootstrapQuery.data.seasonState.seasonUnseen;
  }

  function getNextDailyReset(now: Date): Date {
    const next = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        dailyResetHourUtc,
        dailyResetMinuteUtc,
        dailyResetSecondUtc,
        dailyResetMillisecondUtc,
      ),
    );

    if (next.getTime() <= now.getTime()) {
      next.setUTCDate(next.getUTCDate() + 1);
    }

    return next;
  }

  function getNextWeeklyReset(now: Date): Date {
    const nowWeekday = now.getUTCDay();
    const daysUntilReset = (weeklyResetWeekdayUtc - nowWeekday + 7) % 7;
    const next = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + daysUntilReset,
        dailyResetHourUtc,
        dailyResetMinuteUtc,
        dailyResetSecondUtc,
        dailyResetMillisecondUtc,
      ),
    );

    if (next.getTime() <= now.getTime()) {
      next.setUTCDate(next.getUTCDate() + 7);
    }

    return next;
  }

  function formatRemainingHhMm(targetTime: Date, now: Date): string {
    const diffMs = Math.max(0, targetTime.getTime() - now.getTime());
    const totalMinutes = Math.ceil(diffMs / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function formatRemainingDhhMm(targetTime: Date, now: Date): string {
    const diffMs = Math.max(0, targetTime.getTime() - now.getTime());
    const totalMinutes = Math.ceil(diffMs / 60_000);
    const days = Math.floor(totalMinutes / (24 * 60));
    const remainingMinutesAfterDays = totalMinutes - days * 24 * 60;
    const hours = Math.floor(remainingMinutesAfterDays / 60);
    const minutes = remainingMinutesAfterDays % 60;

    return `${days}:${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function formatRemainingDdHhMm(targetTime: Date, now: Date): string {
    const diffMs = Math.max(0, targetTime.getTime() - now.getTime());
    const totalMinutes = Math.ceil(diffMs / 60_000);
    const days = Math.floor(totalMinutes / (24 * 60));
    const remainingMinutesAfterDays = totalMinutes - days * 24 * 60;
    const hours = Math.floor(remainingMinutesAfterDays / 60);
    const minutes = remainingMinutesAfterDays % 60;

    return `${String(days).padStart(2, "0")}:${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function getTabUpdateDescription(tab: TaskType): string | null {
    if (!bootstrapQuery.data) {
      return null;
    }

    const now = new Date(nowForCountdown);
    const isUnseen = isTabUnseen(tab);

    if (tab === "DAILY") {
      return isUnseen
        ? `デイリーは当日分の内容に更新されています。確認後に未確認バッジが消えます。次回更新まで: ${formatRemainingHhMm(getNextDailyReset(now), now)}`
        : `デイリーは当日分の内容で表示中です。次回更新まで: ${formatRemainingHhMm(getNextDailyReset(now), now)}`;
    }

    if (tab === "WEEKLY") {
      return isUnseen
        ? `ウィークリーは最新状態に更新されました。内容を確認すると未確認バッジが消えます。次回更新まで: ${formatRemainingDhhMm(getNextWeeklyReset(now), now)}`
        : `ウィークリーは最新の更新内容で表示中です。次回更新まで: ${formatRemainingDhhMm(getNextWeeklyReset(now), now)}`;
    }

    const seasonEndsAt = new Date(bootstrapQuery.data.season.endsAt);
    const seasonRemaining = formatRemainingDdHhMm(seasonEndsAt, now);

    return isUnseen
      ? `シーズン更新後の内容です。目標と進行を確認すると未確認バッジが消えます。シーズン終了まで: ${seasonRemaining}`
      : `このシーズンの内容を表示中です。シーズン終了まで: ${seasonRemaining}`;
  }

  useEffect(() => {
    if (!bootstrapQuery.data) {
      return;
    }

    const isUnseen =
      activeTab === "DAILY"
        ? bootstrapQuery.data.seasonState.dailyUnseen
        : activeTab === "WEEKLY"
          ? bootstrapQuery.data.seasonState.weeklyUnseen
          : bootstrapQuery.data.seasonState.seasonUnseen;

    if (!isUnseen || seenStateMutation.isPending) {
      return;
    }

    seenStateMutation.mutate({
      seasonId: bootstrapQuery.data.season.id,
      tab: activeTab,
    });
  }, [
    activeTab,
    bootstrapQuery.data,
    seenStateMutation,
  ]);

  const isDestructivePending = deleteTaskMutation.isPending || taskActionMutation.isPending;

  const dialogTitle =
    destructiveTarget?.kind === "delete"
      ? "タスクを削除しますか？"
      : destructiveTarget?.kind === "reset"
        ? "進捗をリセットしますか？"
        : "";

  const dialogDescription =
    destructiveTarget?.kind === "delete"
      ? `「${destructiveTarget.payload.title}」は完全に削除され、元に戻せません。`
      : destructiveTarget?.kind === "reset"
        ? `「${destructiveTarget.payload.title}」の進捗 ${destructiveTarget.payload.currentCount}/${destructiveTarget.payload.targetCount} は 0 に戻り、元に戻せません。`
        : undefined;

  const dialogConfirmLabel =
    destructiveTarget?.kind === "delete"
      ? "削除する"
      : destructiveTarget?.kind === "reset"
        ? "リセットする"
        : "";

    const activeTabDescription = getTabUpdateDescription(activeTab);

  if (!sessionInfo) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 p-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-zinc-900">Habit Battle Pass</h1>
          <p className="mt-2 text-zinc-600">習慣をゲーム化して、デイリー・ウィークリー・シーズンの目標を進めます。</p>
          <Link href="/login" prefetch={false} className="mt-6 inline-flex">
            <Button>ログインして開始</Button>
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
            <h1 className="text-2xl font-bold text-zinc-900">Habit Battle Pass</h1>
            <p className="text-sm text-zinc-600">{sessionInfo.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/rewards" prefetch={false}>
              <Button variant="secondary">報酬一覧</Button>
            </Link>
            <Button variant="secondary" onClick={handleSignOut}>
              ログアウト
            </Button>
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        {bootstrapQuery.isLoading && <p className="text-zinc-600">初期データを読み込み中です...</p>}
        {bootstrapQuery.isError && (
          <p className="text-sm text-red-600">
            データ取得に失敗しました: {(bootstrapQuery.error as Error).message}
          </p>
        )}
        {mutationError && <p className="mt-2 text-sm text-red-600">操作に失敗しました: {mutationError}</p>}

        {bootstrapQuery.data && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-200 p-4 sm:p-4">
                <p className="text-sm text-zinc-500">通算レベル</p>
                <p className="text-2xl font-bold text-zinc-900">Lv {bootstrapQuery.data.progress.totalLevel}</p>
                <p className="text-sm text-zinc-600">XP: {bootstrapQuery.data.progress.totalXp}</p>
              </div>
              <div className="rounded-lg border border-zinc-200 p-4 sm:p-4">
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
              <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                {(["DAILY", "WEEKLY", "SEASON"] as const).map((tab: TaskType) => (
                  <Button
                    key={tab}
                    variant={activeTab === tab ? "primary" : "secondary"}
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setActiveTab(tab);
                      setCreateForm((prev) => ({ ...prev, type: tab }));
                    }}
                  >
                    <span className="inline-flex items-center gap-1">
                      {tab}
                      {isTabUnseen(tab) && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">未確認</span>}
                    </span>
                  </Button>
                ))}
              </div>

              {activeTabDescription && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {activeTabDescription}
                </div>
              )}

              <div className="grid gap-3 sm:gap-4 lg:grid-cols-5">
                <div className="rounded-lg border border-zinc-200 p-3.5 sm:p-4 lg:col-span-2">
                  <p className="text-sm font-semibold text-zinc-700">{activeTab} のタスク一覧</p>
                  {tasksQuery.isLoading && <p className="mt-3 text-sm text-zinc-500">読み込み中...</p>}
                  {tasksQuery.data?.tasks.length === 0 && <p className="mt-3 text-sm text-zinc-500">タスクがまだありません。</p>}
                  <ul className="mt-3 space-y-2">
                    {tasksQuery.data?.tasks.map((task) => (
                      <li key={task.id}>
                        <button
                          className={`w-full rounded-md border p-3.5 text-left transition active:scale-[0.99] ${task.id === selectedTaskId ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 bg-white"} ${task.isCompleted ? "opacity-55" : "opacity-100"}`}
                          onClick={() => setSelectedTaskId(task.id)}
                        >
                          <p className="text-sm font-semibold leading-5 text-zinc-900">{task.title}</p>
                          <p className="mt-1 text-xs text-zinc-600">
                            {task.currentCount}/{task.targetCount} • {task.xpValue} XP
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg border border-zinc-200 p-3.5 sm:p-4 lg:col-span-3">
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
                      <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
                        <Button className="w-full sm:w-auto" size="sm" onClick={() => queueBufferedAdjust(selectedTaskQuery.data!.task.id, 1)} disabled={selectedTaskQuery.data.task.isCompleted}>
                          +1
                        </Button>
                        <Button className="w-full sm:w-auto" size="sm" variant="ghost" onClick={() => queueBufferedAdjust(selectedTaskQuery.data!.task.id, -1)} disabled={selectedTaskQuery.data.task.isCompleted}>
                          -1
                        </Button>
                        <Button
                          className="w-full sm:w-auto"
                          size="sm"
                          variant="danger"
                          onClick={() => handleResetProgress(selectedTaskQuery.data!.task)}
                          disabled={selectedTaskQuery.data.task.isCompleted || selectedTaskQuery.data.task.currentCount === 0 || isDestructivePending}
                        >
                          進捗リセット
                        </Button>
                        <Button
                          className="w-full sm:w-auto"
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            flushBufferedAdjust(selectedTaskQuery.data!.task.id);
                            taskActionMutation.mutate({ taskId: selectedTaskQuery.data!.task.id, action: "complete" });
                          }}
                          disabled={selectedTaskQuery.data.task.isCompleted || selectedTaskQuery.data.task.currentCount < selectedTaskQuery.data.task.targetCount}
                        >
                          完了
                        </Button>
                        <Button className="w-full sm:w-auto" size="sm" variant="secondary" onClick={() => openEdit(selectedTaskQuery.data!.task)}>
                          編集
                        </Button>
                        <Button
                          className="w-full sm:w-auto"
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
                        <Button
                          className="w-full sm:w-auto"
                          size="sm"
                          variant="danger"
                          onClick={() => handleDeleteTask(selectedTaskQuery.data!.task.id, selectedTaskQuery.data!.task.title)}
                          disabled={isDestructivePending}
                        >
                          削除
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 p-3.5 sm:p-4">
                <p className="text-sm font-semibold text-zinc-700">タスク作成</p>
                <div className="mt-3 grid grid-cols-3 gap-2.5 sm:flex sm:flex-wrap">
                  <Button className="w-full sm:w-auto" size="sm" variant={createMode === "new" ? "primary" : "secondary"} onClick={() => setCreateMode("new")}>
                    新規
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
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
                  <Button className="w-full sm:w-auto" size="sm" variant={createMode === "duplicate" ? "primary" : "secondary"} onClick={() => setCreateMode("duplicate")}>
                    既存タスク流用
                  </Button>
                </div>
                <p className="mt-2 text-xs text-zinc-500">新規は空フォーム、テンプレートは定型入力、既存タスク流用は選択したタスク内容を複製します。</p>

                {createMode === "template" && (
                  <div className="mt-3 space-y-2">
                    <label className="text-xs text-zinc-600">テンプレート選択</label>
                    <select
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-base sm:text-sm"
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
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-base sm:text-sm"
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
                    <input className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base sm:text-sm" value={createForm.title} onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))} />
                  </label>
                  <label className="text-xs text-zinc-600 md:col-span-2">
                    説明
                    <textarea className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base sm:text-sm" value={createForm.description} onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))} />
                  </label>
                  <label className="text-xs text-zinc-600">
                    種類
                    <select className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-base sm:text-sm" value={createForm.type} onChange={(event) => setCreateForm((prev) => ({ ...prev, type: event.target.value as TaskType }))}>
                      <option value="DAILY">DAILY</option>
                      <option value="WEEKLY">WEEKLY</option>
                      <option value="SEASON">SEASON</option>
                    </select>
                  </label>
                  <label className="text-xs text-zinc-600">
                    目標回数
                    <input type="number" min={1} className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base sm:text-sm" value={createForm.targetCount} onChange={(event) => setCreateForm((prev) => ({ ...prev, targetCount: Number(event.target.value) }))} />
                  </label>
                  <label className="text-xs text-zinc-600">
                    経験値候補
                    <select className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-base sm:text-sm" value={resolvedCreateXpValue} onChange={(event) => setCreateForm((prev) => ({ ...prev, xpValue: Number(event.target.value) }))}>
                      {activeOptions.map((option) => (
                        <option key={option.id} value={option.value}>
                          {option.label} ({option.value} XP)
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-zinc-600">
                    報酬メモ
                    <input className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base sm:text-sm" value={createForm.rewardHint} onChange={(event) => setCreateForm((prev) => ({ ...prev, rewardHint: event.target.value }))} />
                  </label>
                </div>

                <div className="mt-4">
                  <Button onClick={submitCreateForm} disabled={createTaskMutation.isPending || !createForm.title.trim()}>
                    タスクを作成
                  </Button>
                </div>
              </div>

              {editTaskId && (
                <div className="rounded-lg border border-zinc-200 p-3.5 sm:p-4">
                  <p className="text-sm font-semibold text-zinc-700">タスク編集</p>
                  <p className="mt-1 text-xs text-zinc-500">編集対象ID: {editTaskId}</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="text-xs text-zinc-600 md:col-span-2">
                      タイトル
                      <input className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base sm:text-sm" value={editForm.title} onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))} />
                    </label>
                    <label className="text-xs text-zinc-600 md:col-span-2">
                      説明
                      <textarea className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base sm:text-sm" value={editForm.description} onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))} />
                    </label>
                    <label className="text-xs text-zinc-600">
                      種類
                      <select className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-base sm:text-sm" value={editForm.type} onChange={(event) => setEditForm((prev) => ({ ...prev, type: event.target.value as TaskType }))}>
                        <option value="DAILY">DAILY</option>
                        <option value="WEEKLY">WEEKLY</option>
                        <option value="SEASON">SEASON</option>
                      </select>
                    </label>
                    <label className="text-xs text-zinc-600">
                      目標回数
                      <input type="number" min={1} className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base sm:text-sm" value={editForm.targetCount} onChange={(event) => setEditForm((prev) => ({ ...prev, targetCount: Number(event.target.value) }))} />
                    </label>
                    <label className="text-xs text-zinc-600">
                      経験値
                      <input type="number" min={1} className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base sm:text-sm" value={editForm.xpValue} onChange={(event) => setEditForm((prev) => ({ ...prev, xpValue: Number(event.target.value) }))} />
                    </label>
                    <label className="text-xs text-zinc-600">
                      報酬メモ
                      <input className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base sm:text-sm" value={editForm.rewardHint} onChange={(event) => setEditForm((prev) => ({ ...prev, rewardHint: event.target.value }))} />
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

      <ConfirmDialog
        open={!!destructiveTarget}
        title={dialogTitle}
        description={dialogDescription}
        confirmLabel={dialogConfirmLabel}
        cancelLabel="キャンセル"
        isPending={isDestructivePending}
        onCancel={() => setDestructiveTarget(null)}
        onConfirm={handleConfirmDestructiveAction}
      />
    </main>
  );
}
