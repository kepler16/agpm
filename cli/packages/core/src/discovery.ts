import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, basename } from "node:path";
import { parse as parseYaml } from "yaml";

// ============================================================================
// Types
// ============================================================================

export interface DiscoveredArtifact {
  /** Artifact name */
  name: string;
  /** Description */
  description?: string;
  /** Artifact type */
  type: "skill" | "command" | "hook";
  /** Path relative to repo root */
  path: string;
  /** Full absolute path */
  absolutePath: string;
  /** Source format that was detected */
  format: "claude-marketplace" | "simple";
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface ClaudePluginManifest {
  name: string;
  owner?: {
    name: string;
    email?: string;
  };
  metadata?: {
    description?: string;
    version?: string;
  };
  plugins: Array<{
    name: string;
    description?: string;
    source?: string;
    skills?: string[];
  }>;
}

export interface SkillMetadata {
  name: string;
  description?: string;
  [key: string]: unknown;
}

export type RepoFormat = "claude-marketplace" | "simple" | "unknown";

// ============================================================================
// Format Detection
// ============================================================================

/**
 * Detect the format of a repository.
 */
export async function detectFormat(repoPath: string): Promise<RepoFormat> {
  // Check for Claude marketplace format (.claude-plugin/marketplace.json)
  try {
    await stat(join(repoPath, ".claude-plugin", "marketplace.json"));
    return "claude-marketplace";
  } catch {
    // Not claude-marketplace format
  }

  // Check for simple format (skills/ directory)
  try {
    const skillsStat = await stat(join(repoPath, "skills"));
    if (skillsStat.isDirectory()) {
      return "simple";
    }
  } catch {
    // No skills directory
  }

  return "unknown";
}

// ============================================================================
// Discovery
// ============================================================================

/**
 * Discover all artifacts in a repository.
 */
export async function discoverArtifacts(
  repoPath: string,
  subpath?: string
): Promise<DiscoveredArtifact[]> {
  const searchPath = subpath ? join(repoPath, subpath) : repoPath;
  const format = await detectFormat(searchPath);

  switch (format) {
    case "claude-marketplace":
      return discoverClaudeMarketplace(searchPath);
    case "simple":
      return discoverSimpleFormat(searchPath);
    default:
      // Try simple format from the root anyway
      return discoverSimpleFormat(searchPath);
  }
}

/**
 * Discover artifacts from Claude plugin manifest.
 *
 * Claude marketplace format:
 * - .claude-marketplace/marketplace.json contains plugins array
 * - Each plugin has `source` pointing to a directory
 * - That directory contains a `skills/` subdirectory with skill folders
 * - Each skill folder has SKILL.md
 *
 * Some repos (like Anthropic's) also include explicit `skills` arrays
 * as a convenience, which we support as a fallback.
 */
async function discoverClaudeMarketplace(repoPath: string): Promise<DiscoveredArtifact[]> {
  const manifestPath = join(repoPath, ".claude-plugin", "marketplace.json");
  const artifacts: DiscoveredArtifact[] = [];
  const seenPaths = new Set<string>();

  const content = await readFile(manifestPath, "utf-8");
  const manifest: ClaudePluginManifest = JSON.parse(content);

  for (const plugin of manifest.plugins) {
    // Primary method: source points to plugin directory with skills/ inside
    if (plugin.source) {
      const sourcePath = plugin.source.replace(/^\.\//, "");
      const pluginDir = sourcePath ? join(repoPath, sourcePath) : repoPath;
      const skillsDir = join(pluginDir, "skills");

      try {
        const entries = await readdir(skillsDir, { withFileTypes: true });

        for (const entry of entries) {
          if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

          const skillPath = join(skillsDir, entry.name);
          const relativePath = relative(repoPath, skillPath);

          // Skip duplicates (multiple plugins may point to same skills dir)
          if (seenPaths.has(relativePath)) continue;
          seenPaths.add(relativePath);

          const metadata = await parseSkillMd(skillPath);

          artifacts.push({
            name: metadata?.name ?? entry.name,
            description: metadata?.description ?? plugin.description,
            type: "skill",
            path: relativePath,
            absolutePath: skillPath,
            format: "claude-marketplace",
            metadata: metadata as Record<string, unknown> | undefined,
          });
        }
      } catch {
        // skills/ directory doesn't exist in plugin source dir
      }
    }

    // Fallback: explicit skills array (convenience format used by some repos)
    if (plugin.skills && plugin.skills.length > 0) {
      for (const skillPath of plugin.skills) {
        const normalizedPath = skillPath.replace(/^\.\//, "");

        // Skip duplicates
        if (seenPaths.has(normalizedPath)) continue;
        seenPaths.add(normalizedPath);

        const absolutePath = join(repoPath, normalizedPath);
        const metadata = await parseSkillMd(absolutePath);

        artifacts.push({
          name: metadata?.name ?? basename(normalizedPath),
          description: metadata?.description ?? plugin.description,
          type: "skill",
          path: normalizedPath,
          absolutePath,
          format: "claude-marketplace",
          metadata: metadata as Record<string, unknown> | undefined,
        });
      }
    }
  }

  return artifacts;
}

/**
 * Discover artifacts from simple format (skills/ directory).
 */
async function discoverSimpleFormat(repoPath: string): Promise<DiscoveredArtifact[]> {
  const skillsDir = join(repoPath, "skills");
  const artifacts: DiscoveredArtifact[] = [];

  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".")) continue;

      const skillPath = join(skillsDir, entry.name);
      const metadata = await parseSkillMd(skillPath);

      // Also try metadata.json
      let jsonMetadata: Record<string, unknown> | null = null;
      try {
        const metadataContent = await readFile(join(skillPath, "metadata.json"), "utf-8");
        jsonMetadata = JSON.parse(metadataContent);
      } catch {
        // No metadata.json
      }

      const name = metadata?.name ?? jsonMetadata?.name as string ?? entry.name;
      const description = metadata?.description ??
        (jsonMetadata?.abstract as string) ??
        (jsonMetadata?.description as string);

      artifacts.push({
        name,
        description,
        type: "skill",
        path: relative(repoPath, skillPath),
        absolutePath: skillPath,
        format: "simple",
        metadata: { ...jsonMetadata, ...metadata } as Record<string, unknown>,
      });
    }
  } catch {
    // skills/ directory doesn't exist or can't be read
  }

  return artifacts;
}

/**
 * Parse SKILL.md or AGENTS.md YAML frontmatter.
 */
async function parseSkillMd(dirPath: string): Promise<SkillMetadata | null> {
  for (const filename of ["SKILL.md", "AGENTS.md"]) {
    try {
      const content = await readFile(join(dirPath, filename), "utf-8");

      // Extract YAML frontmatter
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      if (match) {
        const yaml = parseYaml(match[1]) as Record<string, unknown>;
        return {
          name: (yaml.name as string) ?? basename(dirPath),
          description: yaml.description as string | undefined,
          ...yaml,
        };
      }

      // No frontmatter, use directory name
      return {
        name: basename(dirPath),
      };
    } catch {
      // File doesn't exist
    }
  }

  return null;
}
