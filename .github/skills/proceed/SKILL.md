---
name: proceed
description: Continue work by taking an explicit issue/task if one is provided, or by selecting the next actionable GitHub issue from the repository when none is given. Use when the user wants you to proceed with implementation and report back after completion.
---

# Proceed

Use this skill when the user wants you to move work forward without having to restate the implementation plan.

## Goal

Deliver the next useful piece of work end-to-end.

- If the user provides an issue, task, or clear target, work on that item.
- If no item is specified, inspect the repository issue list and pick one that is ready to start.
- Complete the work, validate it, and report what changed.

## Workflow

1. Determine the starting point.
   - Prefer an explicitly provided issue, ticket, or bug report.
   - Otherwise inspect the repository's open issues (to see this use `github` mcp server) or task list.
   - If there are no open issues, look for the smallest clearly actionable maintenance item in the codebase.

2. Choose the work item.
   - Prefer items with clear acceptance criteria.
   - Prefer unblocked items with minimal external dependencies.
   - Prefer the item that can be completed cleanly in the current session.
   - If multiple candidates are equally ready, choose the one with the highest priority or the smallest scope.

3. Resolve only the missing ambiguity.
   - If the selected item is underspecified, inspect the codebase first.
   - Ask the user only when a decision cannot be inferred safely.
   - Keep questions narrow and concrete.

4. Execute the work.
   - Read the relevant instructions, code, and related documentation.
   - Make the minimal correct change at the root cause.
   - Preserve existing style and conventions.

5. Validate the result.
   - Run the most relevant checks available for the change.
   - Confirm there are no new errors introduced by the change.
   - If validation fails, fix the issue or explain the blocker clearly.

6. Report back.
   - Summarize what was selected, what was changed, and how it was validated.
   - Mention any remaining risks or follow-up work.

## Decision Rules

- Explicit user instructions override repository issue selection.
- If an issue is blocked or too vague, skip it and choose the next ready item.
- Do not broaden scope beyond the selected issue unless the broader change is necessary to finish it correctly.
- If no suitable issue exists, say so and explain what was checked.

## Completion Check

A task is complete when:

- the chosen issue or task has been implemented,
- the change has been validated,
- and the user has a concise report of the outcome.