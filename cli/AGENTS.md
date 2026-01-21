# AGPM CLI

TypeScript CLI for the Agent Package Manager. Built with pnpm workspaces.

## Packages

| Package | Description |
|---------|-------------|
| `@agpm/core` | Config loading, git operations, artifact discovery, caching, validation |
| `@agpm/cli` | CLI commands built with citty |

## Commands

| Command | Description |
|---------|-------------|
| `agpm add <source> [artifact[@version]]` | Add an artifact to agpm.json |
| `agpm install` | Install artifacts to target directories |
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

## Version Pinning

Artifacts can be pinned to specific versions using `@ref` syntax:

```bash
agpm add anthropics/skills pdf@v1.0.0    # Pin to tag
agpm add anthropics/skills pdf@main       # Pin to branch
agpm add anthropics/skills pdf@abc123     # Pin to SHA
```

Without a version, artifacts track HEAD. The lock file stores the resolved SHA.

## Config Files

### agpm.json

User-edited config declaring targets, sources, and artifacts:

```json
{
  "$schema": "https://agpm.dev/schemas/agpm.json",
  "targets": {
    "claude-code": true,
    "opencode": true
  },
  "sources": [
    {
      "name": "anthropics/skills",
      "url": "https://github.com/anthropics/skills.git"
    }
  ],
  "artifacts": [
    "anthropics/skills/pdf",
    "anthropics/skills/docx@main"
  ],
  "collections": []
}
```

### Targets

Only explicitly listed targets receive installed artifacts:

| Target | Base Path | Description |
|--------|-----------|-------------|
| `claude-code` | `.claude` | Claude Code CLI |
| `opencode` | `.opencode` | OpenCode |
| `codex` | `.codex` | Codex |

Target values can be:
- `true` - Enable target (simplified form)
- `{}` - Enable target (allows future options)
- `false` - Disable target

### agpm-lock.json

Auto-generated lock file pinning artifacts to git SHAs with integrity hashes:

```json
{
  "$schema": "https://agpm.dev/schemas/agpm-lock.json",
  "version": 1,
  "artifacts": {
    "anthropics/skills/pdf": {
      "sha": "69c0b1a0674149f27b61b2635f935524b6add202",
      "integrity": "sha256-Wu/6igdMZY2jlV7XESCt6/VyMFuXcXiz9F8z7URlZk8=",
      "path": "skills/pdf",
      "ref": "main",
      "metadata": {
        "name": "pdf",
        "description": "PDF manipulation toolkit..."
      }
    }
  }
}
```

## How Installation Works

1. **Add**: `agpm add anthropics/skills pdf@v1.0.0`
   - Clones repo to `~/.agpm/repos/`
   - Discovers artifacts
   - Adds to `agpm.json` with optional version ref

2. **Install**: `agpm install`
   - Reads `agpm.json` and configured targets
   - Resolves refs to SHAs
   - Caches repo at SHA to `~/.agpm/cache/<sha>/`
   - Computes integrity hash (SHA256 of file contents)
   - Copies to enabled target directories only

3. **Update**: `agpm update`
   - Fetches latest SHAs for each ref (tag/branch/HEAD)
   - Updates `agpm-lock.json`
   - Run `agpm install` to apply

## Storage Model

```
~/.agpm/
├── repos/github.com/owner/repo/    # Full git repos (for fetching)
└── cache/<sha>/                     # Immutable snapshots at specific SHAs
    └── <full repo contents>
```

## Discovery Formats

AGPM discovers artifacts in three formats:

### claude-marketplace
Repos with `.claude-plugin/marketplace.json`:
```json
{
  "plugins": [{
    "name": "plugin-name",
    "source": "./",
    "skills": ["./skills/pdf", "./skills/docx"]
  }]
}
```

### claude-plugin
Repos with `.claude-plugin/plugin.json`:
```json
{
  "name": "plugin-name",
  "skills": "./custom/skills/"
}
```

### simple
Repos with a top-level `skills/` directory containing skill subdirectories with `metadata.json`.

## Project Structure

```
cli/
├── packages/
│   ├── core/
│   │   └── src/
│   │       ├── config.ts      # AgpmConfig, AgpmLock types, load/save
│   │       ├── git.ts         # parseSource, ensureRepo, checkoutToCache
│   │       ├── cache.ts       # SHA-based caching, integrity hashing
│   │       ├── targets.ts     # Target definitions
│   │       ├── discovery.ts   # detectFormat, discover
│   │       ├── validate.ts    # JSON schema validation
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
pnpm build
pnpm --filter @agpm/cli dev -- --help
```

## Dependencies

- **citty** - CLI framework
- **simple-git** - Git operations
- **ajv** - JSON schema validation
- **yaml** - SKILL.md frontmatter parsing
