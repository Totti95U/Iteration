import { execSync } from "node:child_process";

function readStdin() {
    const chunks = [];
    return new Promise((resolve) => {
        process.stdin.on("data", (chunk) => chunks.push(chunk));
        process.stdin.on("end", () => {
            const raw = Buffer.concat(chunks).toString("utf8").trim();
            if (!raw) {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(raw));
            } catch {
                resolve({});
            }
        });
    });
}

function writeJson(payload) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function getEventName(input) {
    return (
        input.hookEventName ||
        input.event ||
        input.hook_event_name ||
        input?.hookSpecificInput?.hookEventName ||
        ""
    );
}

function getToolName(input) {
    return (
        input.toolName ||
        input?.tool?.name ||
        input?.hookSpecificInput?.toolName ||
        ""
    );
}

function getToolInput(input) {
    return input.toolInput || input?.tool?.input || input?.hookSpecificInput?.toolInput || {};
}

function textIncludesIssueCloseIntent(text) {
    if (typeof text !== "string") {
        return false;
    }

    const normalized = text.toLowerCase();

    return (
        /\b(close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s+#\d+\b/.test(normalized) ||
        /(^|\s)\/close(\s|$)/.test(normalized)
    );
}

function hasIssueCloseIntentInToolInput(toolInput) {
    if (!toolInput || typeof toolInput !== "object") {
        return false;
    }

    const candidates = [toolInput.body, toolInput.message, toolInput.title, toolInput.custom_instructions];

    return candidates.some((value) => textIncludesIssueCloseIntent(value));
}

function policyMessage() {
    return "Issue workflow policy: after completing issue-related work, create a commit. Close the related issue only after user verification confirms no problems.";
}

function hasUncommittedChanges() {
    try {
        const out = execSync("git status --porcelain", {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        }).trim();
        return out.length > 0;
    } catch {
        return false;
    }
}

async function main() {
    const input = await readStdin();
    const eventName = getEventName(input);

    if (eventName === "SessionStart" || eventName === "UserPromptSubmit") {
        writeJson({
            continue: true,
            systemMessage: policyMessage(),
        });
        return;
    }

    if (eventName === "PreToolUse") {
        const toolName = getToolName(input);
        const toolInput = getToolInput(input);
        const closingIssueViaStateUpdate =
            toolName === "mcp_github_issue_write" &&
            toolInput &&
            toolInput.method === "update" &&
            toolInput.state === "closed";

        const closingIssueViaCommentOrMetadata =
            ["mcp_github_add_issue_comment", "mcp_github_push_files", "mcp_github_create_or_update_file"].includes(toolName) &&
            hasIssueCloseIntentInToolInput(toolInput);

        const closingIssue = closingIssueViaStateUpdate || closingIssueViaCommentOrMetadata;

        if (closingIssue) {
            writeJson({
                hookSpecificOutput: {
                    hookEventName: "PreToolUse",
                    permissionDecision: "ask",
                    permissionDecisionReason:
                        "Potential issue-closing action detected. Close related issues only after user verification confirms the changes work as expected.",
                },
            });
            return;
        }

        writeJson({
            hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: "allow",
            },
        });
        return;
    }

    if (eventName === "Stop") {
        if (hasUncommittedChanges()) {
            writeJson({
                continue: true,
                systemMessage:
                    "Uncommitted changes detected. If issue-related implementation is complete, create a commit before ending the workflow.",
            });
            return;
        }
    }

    writeJson({ continue: true });
}

main().catch(() => {
    writeJson({ continue: true });
    process.exit(0);
});
