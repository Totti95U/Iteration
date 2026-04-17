---
name: create-issue
description: Turn newly discovered bugs or feature requests into a clear requirements definition and a new GitHub issue. Use with grill-me to resolve ambiguity one question at a time.
---

# Issue Definition and Issue Creation

Use this skill when the user has found a problem, gap, bug, or new request and needs it turned into a well-scoped issue.

This skill is meant to be used together with `grill-me`.
Follow the same one-question-at-a-time style when requirements are unclear, and keep drilling down until the issue can be written with confidence.

## Goal

Convert an informal request into an issue that is ready to be filed in GitHub, with:

- a concise title
- a clear problem or opportunity statement
- concrete requirements
- acceptance criteria
- dependencies or related work
- known risks, constraints, or open questions

## Workflow

1. Classify the request first.
   - Bug: something is broken or incorrect.
   - Feature: a new capability is needed.
   - Refactor: the behavior should stay the same, but the structure should improve.
   - Research: the goal is to investigate, compare, or validate an approach.

2. Gather only the missing information.
   - Ask one question at a time.
   - Provide a recommended answer when possible.
   - If the answer can be inferred from the codebase, inspect the code instead of asking.
   - Prefer concrete decisions over open-ended discussion.

3. Resolve the issue shape.
   - For bugs: capture expected behavior, actual behavior, reproduction steps, scope, and impact.
   - For features: capture the user need, target workflow, boundaries, and completion criteria.
   - For research tasks: capture the question, hypothesis, evaluation method, and output format.

4. Write the issue draft.
   - Title: short and action-oriented.
   - Summary: 2 to 4 sentences.
   - Requirements: a flat list of what must be true.
   - Acceptance criteria: observable completion conditions.
   - Notes: dependencies, non-goals, risks, edge cases, and follow-up work.

5. Validate completeness.
   - Check that the issue is specific enough for implementation or triage.
   - Check that success can be judged without extra interpretation.
   - Check that any unresolved ambiguity is called out explicitly.

6. Create the GitHub issue when the scope is clear enough.
   - Use the repository's issue creation flow available in the current environment.
   - If the user only wants a draft, stop after producing the issue body.

## Issue Template

Use this structure when writing the issue body:

```markdown
## Summary

## Context

## Requirements

## Acceptance Criteria

## Dependencies

## Risks / Open Questions
```

## Decision Rules

- If the request is still ambiguous after one round of questioning, continue with the narrowest possible question.
- If multiple interpretations exist, surface them and recommend one.
- If the request touches several concerns, split it into separate issues instead of forcing one oversized issue.
- If the user is already in a debugging or planning workflow, preserve the language and assumptions already in use.

## Quality Bar

The final issue should let another person answer these questions immediately:

- What is the problem or opportunity?
- What exactly should change?
- How do we know it is done?
- What could block or shape the implementation?
