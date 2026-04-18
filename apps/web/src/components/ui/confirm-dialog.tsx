import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
    open: boolean;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isPending?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
};

export function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel = "削除する",
    cancelLabel = "キャンセル",
    isPending = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/45 p-4">
            <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
                <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
                {description && <p className="mt-2 text-sm text-zinc-600">{description}</p>}
                <div className="mt-5 flex justify-end gap-2">
                    <Button variant="ghost" onClick={onCancel} disabled={isPending}>
                        {cancelLabel}
                    </Button>
                    <Button variant="danger" onClick={onConfirm} disabled={isPending}>
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
}