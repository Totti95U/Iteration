import { Button } from "@/components/ui/button";
import { type MouseEvent, useEffect, useId, useRef } from "react";

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
    const id = useId();
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const lastActiveElementRef = useRef<HTMLElement | null>(null);
    const titleId = `confirm-dialog-title-${id}`;
    const descriptionId = description ? `confirm-dialog-desc-${id}` : undefined;

    const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) {
            onCancel();
        }
    };

    const getFocusableElements = (container: HTMLElement) =>
        Array.from(
            container.querySelectorAll<HTMLElement>(
                "a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])"
            )
        );

    useEffect(() => {
        if (!open) {
            return;
        }

        const dialog = dialogRef.current;
        if (!dialog) {
            return;
        }

        const body = document.body;
        const previousOverflow = body.style.overflow;
        const previousPaddingRight = body.style.paddingRight;
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

        body.style.overflow = "hidden";
        if (scrollbarWidth > 0) {
            body.style.paddingRight = `${scrollbarWidth}px`;
        }

        lastActiveElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

        const focusable = getFocusableElements(dialog);
        if (focusable.length > 0) {
            focusable[0].focus();
        } else {
            dialog.focus();
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onCancel();
                return;
            }

            if (event.key !== "Tab") {
                return;
            }

            const focusableElements = getFocusableElements(dialog);
            if (focusableElements.length === 0) {
                event.preventDefault();
                dialog.focus();
                return;
            }

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];
            const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

            if (event.shiftKey) {
                if (activeElement === firstElement || !dialog.contains(activeElement)) {
                    event.preventDefault();
                    lastElement.focus();
                }
                return;
            }

            if (activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            lastActiveElementRef.current?.focus();
            body.style.overflow = previousOverflow;
            body.style.paddingRight = previousPaddingRight;
        };
    }, [onCancel, open]);

    if (!open) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/45 p-4"
            onMouseDown={handleBackdropMouseDown}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                tabIndex={-1}
                className="w-full max-w-[min(92vw,28rem)] rounded-xl border border-zinc-200 bg-white p-5 shadow-xl sm:max-w-md"
            >
                <h2 id={titleId} className="text-lg font-semibold text-zinc-900">
                    {title}
                </h2>
                {description && (
                    <p id={descriptionId} className="mt-2 text-sm text-zinc-600">
                        {description}
                    </p>
                )}
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button className="w-full sm:w-auto" variant="ghost" onClick={onCancel} disabled={isPending}>
                        {cancelLabel}
                    </Button>
                    <Button className="w-full sm:w-auto" variant="danger" onClick={onConfirm} disabled={isPending}>
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
}