import { defineCommand } from "citty";
import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  loadConfig,
  loadLock,
  saveLock,
  parseSourceString,
  ensureRepo,
  getRepoPath,
  discoverArtifacts,
  resolveRef,
  type Source,
} from "@agpm/core";

// Default target directories for different AI tools
const TARGET_DIRS = [".claude/skills", ".opencode/skills", ".codex/skills"];

/**
 * Find a source in the config by name.
 */
function findSource(sources: Source[], name: string): Source | undefined {
  return sources.find((s) => s.name === name);
}

/**
 * Parse artifact reference (source/artifact-name) into source name and artifact name.
 */
function parseArtifactRef(ref: string): { sourceName: string; artifactName: string } | null {
  const lastSlash = ref.lastIndexOf("/");
  if (lastSlash === -1) return null;

  return {
    sourceName: ref.slice(0, lastSlash),
    artifactName: ref.slice(lastSlash + 1),
  };
}

export const installCommand = defineCommand({
  meta: {
    name: "install",
    description: "Install configured artifacts to target directories",
  },
  args: {
    force: {
      type: "boolean",
      alias: "f",
      description: "Force reinstall even if already installed",
      default: false,
    },
  },
  async run({ args }) {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);
    const lock = await loadLock(cwd);

    if (config.artifacts.length === 0) {
      console.log("No artifacts configured.");
      console.log("\nAdd artifacts with: agpm add <source> <artifact>");
      return;
    }

    console.log(`Installing ${config.artifacts.length} artifact(s)...\n`);

    let updated = false;

    for (const artifactRef of config.artifacts) {
      // Parse artifact reference: source-name/artifact-name
      const parsed = parseArtifactRef(artifactRef);
      if (!parsed) {
        console.log(`Invalid artifact reference: ${artifactRef}`);
        continue;
      }

      const { sourceName, artifactName } = parsed;

      // Look up source from config, fallback to parsing as new
      let source = findSource(config.sources, sourceName);
      if (!source) {
        // Source not in config, try to parse it
        try {
          source = parseSourceString(sourceName);
        } catch {
          console.log(`Source not found: ${sourceName}`);
          continue;
        }
      }

      // Check if we have a lock entry
      let lockEntry = lock.artifacts[artifactRef];

      if (!lockEntry || args.force) {
        // Need to resolve
        console.log(`Resolving ${artifactRef}...`);

        // Ensure repo is cloned
        await ensureRepo(source);
        const repoPath = getRepoPath(source);

        // Discover artifacts to get the path (use source's explicit format if set)
        const artifacts = await discoverArtifacts(repoPath, source.subdir, source.format);
        const artifact = artifacts.find((a) => a.name === artifactName);

        if (!artifact) {
          console.log(`  Artifact not found: ${artifactName}`);
          continue;
        }

        // Resolve SHA
        const sha = await resolveRef(repoPath, "HEAD");

        lockEntry = {
          sha,
          integrity: `sha256-${sha.slice(0, 16)}`, // Placeholder integrity
          path: artifact.path,
          metadata: {
            name: artifact.name,
            description: artifact.description,
          },
        };

        lock.artifacts[artifactRef] = lockEntry;
        updated = true;
      }

      // Install to target directories
      const repoPath = getRepoPath(source);
      const sourcePath = join(repoPath, lockEntry.path);

      for (const targetDir of TARGET_DIRS) {
        const targetPath = join(cwd, targetDir, artifactName);

        try {
          // Remove existing
          await rm(targetPath, { recursive: true, force: true });

          // Create parent directory
          await mkdir(join(cwd, targetDir), { recursive: true });

          // Copy skill directory
          await cp(sourcePath, targetPath, { recursive: true });

          console.log(`  Installed: ${targetDir}/${artifactName}`);
        } catch (error) {
          console.log(
            `  Failed to install to ${targetDir}: ${(error as Error).message}`
          );
        }
      }
    }

    // Save lock file if updated
    if (updated) {
      await saveLock(cwd, lock);
      console.log("\nUpdated agpm-lock.json");
    }

    console.log("\nDone.");
  },
});
