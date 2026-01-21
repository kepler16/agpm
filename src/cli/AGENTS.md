# CLI Module

Command-line interface implementation using clap. Each subcommand has its own module with a `run()` function.

## Structure

- `mod.rs` - CLI argument parsing with clap derive macros
- `add.rs` - Add skills to `skills.json`
- `install.rs` - Install skills from lock file or resolve from config
- `update.rs` - Update skills to latest versions
- `list.rs` - Display configured skills and their status
- `remove.rs` - Remove skills from config and disk

## Adding a New Command

1. Add variant to `Commands` enum in `mod.rs`
2. Create `<command>.rs` with `pub async fn run(...) -> Result<()>`
3. Add `pub mod <command>;` to `mod.rs`
4. Wire up dispatch in `main.rs`

## Key Dependencies

- `crate::config` - `SkillsConfig` and `SkillsLock` for reading/writing JSON files
- `crate::git` - `GitSource::parse()` for source URLs, `ClonedRepo::clone()` for cloning
- `crate::skill` - `discover_skills()` for finding SKILL.md files in repos

## Target Agents

Skills are installed to multiple agent directories (defined in `install.rs` and `remove.rs`):

```rust
const AGENTS: &[(&str, &str)] = &[
    ("claude-code", ".claude/skills"),
    ("opencode", ".opencode/skills"),
    ("cursor", ".cursor/skills"),
    ("codex", ".codex/skills"),
];
```

## Command Flow

### `add`
1. Parse source with `GitSource::parse()`
2. Clone repo to temp dir with `ClonedRepo::clone()`
3. Discover skills with `discover_skills()`
4. If multiple skills found and no `--skill` flag, prompt user
5. Add `SkillSpec` entries to config
6. Save `skills.json`

### `install`
1. Load `skills.json` and `skills-lock.json`
2. For each skill:
   - Use locked SHA if available, otherwise resolve from source
   - Clone repo and discover skill
   - Update lock entry
   - Copy skill directory to all agent paths
3. Save lock file

### `update`
1. Load config and lock
2. For each skill (or specific skill if provided):
   - Resolve latest SHA from remote
   - Compare with locked SHA
   - If different, clone and update lock entry
3. Save lock file (does NOT install - user must run `install` after)

### `list`
Display all configured skills with:
- Name and locked SHA (or "not installed")
- Description from lock file
- Source, ref, and path

### `remove`
1. Remove from `config.skills` list
2. Remove from marketplace `enabled` lists
3. Remove from lock file
4. Delete installed directories from all agent paths
5. Save both files
