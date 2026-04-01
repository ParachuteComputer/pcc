# PCC — Parachute Claude Control

A lightweight bridge that lets Claude Code sessions discover each other and communicate in real-time using [MCP channels](https://code.claude.com/docs/en/channels.md).

PCC has two parts:
- **A CLI** (`pcc`) for managing Claude Code sessions — create, stop, restore after reboot, and more
- **An MCP server** (`pcc-bridge`) that gives every session 5 communication tools, with messages delivered instantly via channel push

## How it works

```
You (tablet / Telegram / claude.ai)
  │
  ▼
Orchestrator session ──bridge msg──▶ Worker sessions
  (pcc-bridge + telegram)            (pcc-bridge)
  ◀──bridge msg──────────────────────┘
```

Every Claude Code session runs the `pcc-bridge` MCP server as a subprocess. A shared SQLite broker on localhost routes messages between them. Messages arrive in Claude's context as `<channel>` tags — like a coworker tapping it on the shoulder — so Claude reacts immediately without polling.

## Install

```bash
bun install -g github:ParachuteComputer/pcc
```

## Setup

```bash
pcc init
```

This adds the `pcc-bridge` MCP server to `~/.claude/settings.json` so every Claude Code session gets it automatically.

## Usage

### Create sessions

```bash
# Worker session (auto-mode permissions, remote-control enabled)
pcc create atlas ~/Code/atlas

# Orchestrator with yolo + Telegram
pcc create orchestrator ~/Code --yolo --channel "plugins:telegram@claude-plugins-official"

# Session with normal interactive permissions
pcc create careful-worker ~/Code/sensitive --ask
```

### Manage sessions

```bash
pcc list                    # Show all sessions with status
pcc stop atlas              # Stop (keeps in registry for restore)
pcc remove atlas            # Stop and remove from registry
pcc output atlas            # Capture terminal output
pcc status                  # Broker health and connected peers
```

### After a reboot

```bash
pcc restore
```

Recreates all registered sessions and resumes their previous conversations.

### Adopt existing sessions

```bash
pcc adopt atlas ~/Code/atlas --continue       # Most recent session in that dir
pcc adopt atlas ~/Code/atlas --session <id>   # Specific session ID
```

### Send messages from the terminal

```bash
pcc send atlas "check for open PRs and summarize them"
```

## How sessions communicate

Every session gets 5 MCP tools:

| Tool | Description |
|------|-------------|
| `list_peers` | See all connected sessions with their status |
| `send_peer_message` | Send a message to a peer by name |
| `check_messages` | Manual message check (fallback) |
| `set_my_status` | Announce what you're working on |
| `whoami` | Your identity on the bridge |

Messages are delivered via MCP channel push — the bridge's MCP server polls a local SQLite broker every second and pushes new messages into Claude's context as `<channel>` notifications. Claude sees them and responds immediately.

### Example flow

The orchestrator asks atlas to review a PR:

```
Orchestrator calls: send_peer_message(to: "atlas", message: "Review PR #42")
         │
         ▼
    SQLite broker (localhost:7899)
         │
         ▼ (within 1 second)
    Atlas's MCP server polls, pushes via channel
         │
         ▼
    Atlas sees: <channel source="pcc-bridge" from="orchestrator">
                Review PR #42
                </channel>
         │
         ▼
    Atlas does the review, calls: send_peer_message(to: "orchestrator", message: "Found 2 issues...")
```

## Architecture

```
~/.pcc/sessions.json          Session registry (survives reboots)
~/.pcc-bridge.db              SQLite broker database
~/.claude/settings.json       MCP server registration

cli.ts                        CLI (pcc command)
bridge/
  broker.ts                   SQLite HTTP broker (auto-launched)
  server.ts                   MCP server (one per Claude session)
  types.ts                    Shared types
```

**The broker** is a single-process HTTP server on localhost:7899 backed by SQLite. It's auto-launched by the first MCP server that starts — no manual setup needed.

**Message delivery** uses ACK-based delivery: messages aren't marked as delivered until the MCP server confirms the channel push succeeded. If the MCP server crashes between poll and ACK, messages are retried on next startup.

**Session persistence** uses Claude Code's `--name` flag. Each session is named `pcc-{name}`, so `pcc restore` can resume conversations by name after a reboot.

## Defaults

| Setting | Default | Override |
|---------|---------|----------|
| Permissions | `--enable-auto-mode` (safe classifier) | `--yolo` for skip-permissions, `--ask` for interactive |
| Remote control | On (`/remote-control`) | `--no-remote-control` |
| Bridge channel | Always enabled | — |
| Extra channels | None | `--channel <ch>` (repeatable) |

## Requirements

- [Bun](https://bun.sh) runtime
- [tmux](https://github.com/tmux/tmux) (sessions run in tmux)
- Claude Code with channels support (v2.1.80+)

## License

MIT
