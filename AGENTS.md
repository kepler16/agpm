# AGPM - Agent Package Manager

> **Convention:** To keep agent instructions agnostic, always create `AGENTS.md` as the source of truth and symlink `CLAUDE.md` to it:
> ```bash
> ln -s AGENTS.md CLAUDE.md
> ```
> **Important:** When asked to create a `CLAUDE.md` file (in any directory), always create `AGENTS.md` instead and symlink `CLAUDE.md` to it.

Universal package manager for AI coding tool artifacts (skills, commands, hooks). Manages artifacts from git repos and installs them to multiple AI tool targets.

**Website:** https://agpm.dev

## Project Structure

```
agpm/
├── cli/                    # TypeScript CLI implementation
│   ├── packages/
│   │   ├── core/           # @agpm/core - config, git, discovery, validation
│   │   └── cli/            # @agpm/cli - CLI commands (citty)
│   └── schemas/            # JSON schemas for agpm.json, agpm-lock.json
└── examples/
    └── simple/             # Example usage with justfile
```

## Quick Start

```bash
cd examples/simple
just agpm add anthropics/skills pdf
just agpm install
just agpm list
```

## CLI Documentation

See [`cli/AGENTS.md`](cli/AGENTS.md) for detailed documentation:
- All commands and usage
- Config file formats (agpm.json, agpm-lock.json)
- Source and artifact formats
- How discovery and installation work
