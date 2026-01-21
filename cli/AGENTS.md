# AGPM CLI

TypeScript CLI for the Agent Package Manager. Built with pnpm workspaces.

## Packages

| Package | Description |
|---------|-------------|
| `@agpm/core` | Config loading, git operations, artifact discovery, schema validation |
| `@agpm/cli` | CLI commands built with citty |

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
      "sha": "69c0b1a0674149f27b61b2635f935524b6add202",
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

## How Installation Works

1. **Add**: `agpm add anthropics/skills pdf`
   - Clones repo to `~/.agpm/repos/`
   - Discovers artifacts (SKILL.md files)
   - Adds to `agpm.json`

2. **Install**: `agpm install`
   - Reads `agpm.json`
   - Resolves SHAs (uses lock file if present)
   - Copies to target directories:
     - `.claude/skills/<name>/`
     - `.opencode/skills/<name>/`
     - `.codex/skills/<name>/`

3. **Update**: `agpm update`
   - Fetches latest SHAs
   - Updates `agpm-lock.json`
   - Run `agpm install` to apply

## Discovery Formats

AGPM discovers artifacts in two formats:

### claude-marketplace
Repos with `.claude-plugin/marketplace.json`:
```json
{
  "plugins": [{
    "name": "plugin-name",
    "source": "./",
    "description": "..."
  }]
}
```
Each plugin's `source` directory contains a `skills/` subdirectory.

### simple
Repos with a top-level `skills/` directory containing skill subdirectories, each with a `SKILL.md` file.

## Project Structure

```
cli/
├── packages/
│   ├── core/
│   │   └── src/
│   │       ├── config.ts      # AgpmConfig, AgpmLock types, load/save
│   │       ├── git.ts         # parseSource, ensureRepo, resolveRef
│   │       ├── discovery.ts   # detectFormat, discoverArtifacts
│   │       ├── validate.ts    # JSON schema validation with ajv
│   │       └── index.ts       # Exports
│   └── cli/
│       └── src/
│           ├── commands/      # add, install, list, remove, source, update
│           └── index.ts       # CLI entry point
├── schemas/
│   ├── agpm.json              # Config schema
│   └── agpm-lock.json         # Lock file schema
└── pnpm-workspace.yaml
```

## Development

```bash
cd cli
pnpm install
pnpm --filter @agpm/cli dev -- --help
```

## Dependencies

- **citty** - CLI framework
- **simple-git** - Git operations
- **ajv** - JSON schema validation
- **yaml** - SKILL.md frontmatter parsing
