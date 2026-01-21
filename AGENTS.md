# AGENTS.md

> **Convention:** To keep agent instructions agnostic, always create `AGENTS.md` as the source of truth and symlink `CLAUDE.md` to it:
> ```bash
> ln -s AGENTS.md CLAUDE.md
> ```
> **Important:** When asked to create a `CLAUDE.md` file (in any directory), always create `AGENTS.md` instead and symlink `CLAUDE.md` to it.

This is a Rust CLI tool for managing AI agent skills with lock file support, similar to how npm/pnpm manage packages.

## Purpose

Provides deterministic, reproducible skill installation by tracking git SHAs in a lock file. Works with the [Agent Skills specification](https://agentskills.io/) used by Claude Code, OpenCode, Cursor, Codex, and other AI coding agents.

## Key Concepts

### skills.json
User-edited config file declaring which skills to install. Supports:
- **Individual skills**: Direct references to skill repos
- **Marketplaces**: Skill repositories (like `anthropics/skills`) where you enable specific skills

### skills-lock.json  
Auto-generated lock file that pins each skill to a specific git SHA. Ensures reproducible installs across machines/time.

### SKILL.md
The standard skill format - a markdown file with YAML frontmatter containing `name` and `description` fields, followed by instructions for the agent.

## Project Structure

```
skills-cli/
├── Cargo.toml              # Rust dependencies
├── schemas/
│   ├── skills.json         # JSON Schema for skills.json
│   └── skills-lock.json    # JSON Schema for skills-lock.json
└── src/
    ├── main.rs             # Entry point, CLI dispatch
    ├── cli/
    │   ├── mod.rs          # CLI argument parsing (clap)
    │   ├── add.rs          # `skills add` - add skill to config
    │   ├── install.rs      # `skills install` - install from lock/config
    │   ├── update.rs       # `skills update` - update lock to latest
    │   ├── list.rs         # `skills list` - show configured skills
    │   └── remove.rs       # `skills remove` - remove a skill
    ├── config.rs           # skills.json and skills-lock.json types
    ├── git.rs              # Git operations (clone, SHA resolution)
    ├── skill.rs            # SKILL.md discovery and parsing
    └── tui/
        ├── mod.rs          # TUI entry point and event loop
        ├── app.rs          # Application state
        └── ui.rs           # Ratatui rendering
```

## Commands

| Command | Description |
|---------|-------------|
| `skills` | Launch interactive TUI |
| `skills add <source>` | Add a skill to skills.json |
| `skills add <source> --skill <name>` | Add specific skill from a multi-skill repo |
| `skills install` | Install skills (uses lock file if present) |
| `skills update` | Update all skills to latest (updates lock file) |
| `skills update <name>` | Update specific skill |
| `skills list` | Show configured skills and their status |
| `skills remove <name>` | Remove a skill |

## Source Formats

The `<source>` argument accepts:
- `owner/repo` - GitHub shorthand
- `owner/repo/path/to/skill` - With subpath
- `https://github.com/owner/repo` - Full URL
- `https://github.com/owner/repo/tree/branch/path` - URL with ref and path

## How Installation Works

1. **Add**: `skills add anthropics/skills --skill pdf`
   - Clones repo to temp directory
   - Discovers SKILL.md files
   - Adds entry to `skills.json`

2. **Install**: `skills install`
   - Reads `skills.json`
   - If `skills-lock.json` exists, uses locked SHAs
   - Otherwise, resolves latest SHA and updates lock
   - Copies skill directories to agent paths:
     - `.claude/skills/<name>/`
     - `.opencode/skills/<name>/`
     - `.cursor/skills/<name>/`
     - `.codex/skills/<name>/`

3. **Update**: `skills update`
   - Fetches latest SHA for each skill source
   - Updates `skills-lock.json`
   - Run `skills install` after to apply

## Key Dependencies

- **ratatui** + **crossterm**: Terminal UI
- **clap**: CLI argument parsing
- **git2**: Git operations (libgit2 bindings)
- **tokio**: Async runtime
- **serde** + **serde_json** + **serde_yaml**: Serialization
- **reqwest**: HTTP client (for GitHub API SHA resolution)
- **walkdir**: Directory traversal
- **tempfile**: Temporary directories for cloning

## File Formats

### skills.json
```json
{
  "$schema": "https://skills.sh/schemas/skills.json",
  "marketplaces": [
    {
      "name": "anthropic",
      "source": "anthropics/skills",
      "enabled": ["pdf", "docx"]
    }
  ],
  "skills": [
    {
      "name": "my-skill",
      "source": "owner/repo",
      "ref": "main",
      "path": "skills/my-skill"
    }
  ]
}
```

### skills-lock.json
```json
{
  "$schema": "https://skills.sh/schemas/skills-lock.json",
  "version": 1,
  "marketplaces": {},
  "skills": {
    "pdf": {
      "name": "pdf",
      "source": "https://github.com/anthropics/skills.git",
      "sha": "69c0b1a0674149f27b61b2635f935524b6add202",
      "path": "skills/pdf",
      "description": "PDF manipulation toolkit...",
      "marketplace": "anthropic"
    }
  }
}
```

## Building

```bash
cargo build --release
# Binary at: target/release/skills
```

## TUI Keybindings

**Main Screen:**
- `q` - Quit
- `a` - Add skill
- `m` - Manage marketplaces
- `i` - Install skills
- `u` - Update skills
- `d` - Delete selected skill
- `j/k` or arrows - Navigate

**Marketplaces Screen:**
- `a` - Add marketplace
- `Enter` - Browse marketplace skills
- `d` - Delete marketplace
- `Esc` - Back

**Marketplace Skills:**
- `Space/Enter` - Toggle skill enabled/disabled
- `Esc` - Back

## Known Limitations

- SHA checkout not implemented (always clones HEAD, but records correct SHA)
- TUI marketplace skill discovery requires running update first
- No support for private repos requiring auth tokens (SSH agent works)
