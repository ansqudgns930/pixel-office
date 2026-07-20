# Agent Backend 13b Completion Audit

## Implemented

- Shared subprocess `ModelClient` for Claude Code and Codex CLI.
- Claude non-interactive print mode with an empty tool allowlist.
- Codex non-interactive ephemeral mode with read-only sandbox and shell, apps, browser, computer, image, and MCP features disabled.
- Shell-free process execution, 120-second default timeout, 10 MB output ceiling, minimal environment, and abort propagation.
- Missing CLI, unauthenticated session, and runtime failure map to standard adapter error codes.
- Token usage is estimated from prompt and response length when the CLI does not report usage; cost remains zero and `estimated` is recorded.
- The platform does not store or broker CLI credentials.

## Contract validation

Both `claude-cli` and `codex-cli` run through the same HostAdapter contract suite as standalone and legacy NVIDIA:

- authentication and model discovery
- idempotent model invocation and usage
- idempotent events
- AbortSignal cancellation
- contract mismatch rejection
- host failure and recovery

## Scope boundary

CLI output is text only. It still passes through the existing Role Pipeline, Worktree, Tool Gateway, validators, budget checks, and approval integrity controls.
