# AGPM - Agent Package Manager

> [!WARNING]
> This project is in early alpha. APIs and configuration formats may change without notice. Use at your own risk.

Universal package manager for AI coding tool artifacts (skills, commands, hooks). Manages artifacts from git repos and installs them to multiple AI tool targets.

## Installation

```bash
npm install -g @agpm/cli
```

## Quick Start

```bash
# Add a source repository
agpm source add anthropics/skills

# Discover available artifacts
agpm source discover anthropics/skills

# Add an artifact to your project
agpm add anthropics/skills pdf

# Install artifacts to target directories
agpm install
```

## Commands

| Command | Description |
|---------|-------------|
| `agpm add <source> [artifact]` | Add an artifact to agpm.json |
| `agpm install` | Install artifacts to target directories |
| `agpm sync` | Alias for install |
| `agpm list` | Show configured artifacts and status |
| `agpm remove <artifact>` | Remove an artifact |
| `agpm update [artifact]` | Update lock file to latest SHAs |
| `agpm source add <repo>` | Add a source repository |
| `agpm source list` | List configured sources |
| `agpm source remove <repo>` | Remove a source |
| `agpm source discover <repo>` | Show available artifacts in a source |

## Source Formats

The `<source>` argument accepts:
- `owner/repo` - GitHub shorthand
- `owner/repo#subpath` - With subpath
- `https://github.com/owner/repo` - Full URL

## Config Files

### agpm.json

User-edited config declaring sources and artifacts:

```json
{
  "$schema": "https://agpm.dev/schemas/agpm.json",
  "targets": {},
  "sources": ["anthropics/skills"],
  "artifacts": ["anthropics/skills/pdf"]
}
```

### agpm-lock.json

Auto-generated lock file pinning artifacts to git SHAs:

```json
{
  "$schema": "https://agpm.dev/schemas/agpm-lock.json",
  "version": 1,
  "artifacts": {
    "anthropics/skills/pdf": {
      "sha": "69c0b1a...",
      "integrity": "sha256-...",
      "path": "skills/pdf",
      "metadata": {
        "name": "pdf",
        "description": "PDF manipulation toolkit..."
      }
    }
  }
}
```

## How It Works

1. **Add** - Clones source repo, discovers artifacts, adds to config
2. **Install** - Resolves SHAs, copies artifacts to target directories:
   - `.claude/skills/<name>/`
   - `.opencode/skills/<name>/`
   - `.codex/skills/<name>/`
3. **Update** - Fetches latest SHAs and updates lock file

## License

MIT
