import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, basename } from "node:path";
import { parse as parseYaml } from "yaml";
import type { SourceFormat } from "./config.js";

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
  format: SourceFormat;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface DiscoveredCollection {
  /** Collection name (e.g., plugin name) */
  name: string;
  /** Description */
  description?: string;
  /** Names of artifacts in this collection */
  artifacts: string[];
  /** Path to collection root relative to repo */
  path: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface DiscoveryResult {
  /** Individual artifacts discovered */
  artifacts: DiscoveredArtifact[];
  /** Collections (groups of artifacts) discovered */
  collections: DiscoveredCollection[];
  /** Format that was detected/used */
  format: RepoFormat;
}

/** Marketplace manifest (.claude-plugin/marketplace.json) - multiple plugins */
export interface ClaudeMarketplaceManifest {
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

/** Plugin manifest (.claude-plugin/plugin.json) - single plugin */
export interface ClaudePluginManifest {
  name: string;
  version?: string;
  description?: string;
  author?: {
    name: string;
    email?: string;
    url?: string;
  };
  /** Skills path(s) - can be string or array */
  skills?: string | string[];
  commands?: string | string[];
  agents?: string | string[];
}

export interface SkillMetadata {
  name: string;
  description?: string;
  [key: string]: unknown;
}

/** Detected format or unknown */
export type RepoFormat = SourceFormat | "unknown";

// ============================================================================
// Format Detection
// ============================================================================

/**
 * Detect the format of a repository.
 * Checks in order of specificity: marketplace > plugin > simple
 */
export async function detectFormat(repoPath: string): Promise<RepoFormat> {
  // Check for Claude marketplace format (.claude-plugin/marketplace.json)
  try {
    await stat(join(repoPath, ".claude-plugin", "marketplace.json"));
    return "claude-marketplace";
  } catch {
    // Not claude-marketplace format
  }

  // Check for Claude plugin format (.claude-plugin/plugin.json)
  try {
    await stat(join(repoPath, ".claude-plugin", "plugin.json"));
    return "claude-plugin";
  } catch {
    // Not claude-plugin format
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
 * Discover all artifacts and collections in a repository.
 *
 * @param repoPath - Path to the repository
 * @param subdir - Optional subdirectory to search within
 * @param explicitFormat - If provided, use this format instead of auto-detecting
 */
export async function discover(
  repoPath: string,
  subdir?: string,
  explicitFormat?: SourceFormat
): Promise<DiscoveryResult> {
  const searchPath = subdir ? join(repoPath, subdir) : repoPath;

  // Use explicit format if provided and not "auto", otherwise detect
  const format = (explicitFormat && explicitFormat !== "auto")
    ? explicitFormat
    : await detectFormat(searchPath);

  switch (format) {
    case "claude-marketplace":
      return discoverClaudeMarketplace(searchPath);
    case "claude-plugin":
      return discoverClaudePlugin(searchPath);
    case "simple":
      return discoverSimpleFormat(searchPath);
    default:
      // Try simple format from the root anyway
      return discoverSimpleFormat(searchPath);
  }
}

/**
 * @deprecated Use `discover` instead. This is kept for backwards compatibility.
 */
export async function discoverArtifacts(
  repoPath: string,
  subdir?: string,
  explicitFormat?: SourceFormat
): Promise<DiscoveredArtifact[]> {
  const result = await discover(repoPath, subdir, explicitFormat);
  return result.artifacts;
}

/**
 * Discover artifacts from Claude marketplace manifest.
 *
 * Marketplace format (.claude-plugin/marketplace.json):
 * - Contains `plugins` array with multiple plugin entries
 * - Each plugin has `source` pointing to a plugin directory
 * - That directory contains a `skills/` subdirectory with skill folders
 * - Each skill folder has SKILL.md
 * - Each plugin becomes a collection containing its artifacts
 */
async function discoverClaudeMarketplace(repoPath: string): Promise<DiscoveryResult> {
  const manifestPath = join(repoPath, ".claude-plugin", "marketplace.json");
  const artifacts: DiscoveredArtifact[] = [];
  const collections: DiscoveredCollection[] = [];
  const seenPaths = new Set<string>();

  const content = await readFile(manifestPath, "utf-8");
  const manifest: ClaudeMarketplaceManifest = JSON.parse(content);

  for (const plugin of manifest.plugins) {
    const collectionArtifacts: string[] = [];
    const sourcePath = (typeof plugin.source === "string" ? plugin.source : "").replace(/^\.\//, "");

    // Primary method: source points to plugin directory with skills/ inside
    if (plugin.source) {
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
          const artifactName = metadata?.name ?? entry.name;

          artifacts.push({
            name: artifactName,
            description: metadata?.description ?? plugin.description,
            type: "skill",
            path: relativePath,
            absolutePath: skillPath,
            format: "claude-marketplace",
            metadata: metadata as Record<string, unknown> | undefined,
          });

          collectionArtifacts.push(artifactName);
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
        const artifactName = metadata?.name ?? basename(normalizedPath);

        artifacts.push({
          name: artifactName,
          description: metadata?.description ?? plugin.description,
          type: "skill",
          path: normalizedPath,
          absolutePath,
          format: "claude-marketplace",
          metadata: metadata as Record<string, unknown> | undefined,
        });

        collectionArtifacts.push(artifactName);
      }
    }

    // Create collection for this plugin
    if (collectionArtifacts.length > 0) {
      collections.push({
        name: plugin.name,
        description: plugin.description,
        artifacts: collectionArtifacts,
        path: sourcePath || ".",
      });
    }
  }

  return { artifacts, collections, format: "claude-marketplace" };
}

/**
 * Discover artifacts from Claude plugin manifest.
 *
 * Plugin format (.claude-plugin/plugin.json):
 * - Single plugin with optional `skills` field (string or array of paths)
 * - Default `skills/` directory is always searched
 * - Each skill is a directory with SKILL.md
 * - The plugin itself is the collection containing all artifacts
 */
async function discoverClaudePlugin(repoPath: string): Promise<DiscoveryResult> {
  const manifestPath = join(repoPath, ".claude-plugin", "plugin.json");
  const artifacts: DiscoveredArtifact[] = [];
  const seenPaths = new Set<string>();

  const content = await readFile(manifestPath, "utf-8");
  const manifest: ClaudePluginManifest = JSON.parse(content);

  // Collect skill directories to search
  const skillsDirs: string[] = [];

  // Add custom skills paths from manifest
  if (manifest.skills) {
    const paths = Array.isArray(manifest.skills) ? manifest.skills : [manifest.skills];
    for (const p of paths) {
      const normalized = p.replace(/^\.\//, "");
      skillsDirs.push(join(repoPath, normalized));
    }
  }

  // Always add default skills/ directory
  skillsDirs.push(join(repoPath, "skills"));

  // Search each skills directory
  for (const skillsDir of skillsDirs) {
    try {
      const entries = await readdir(skillsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

        const skillPath = join(skillsDir, entry.name);
        const relativePath = relative(repoPath, skillPath);

        // Skip duplicates
        if (seenPaths.has(relativePath)) continue;
        seenPaths.add(relativePath);

        const metadata = await parseSkillMd(skillPath);

        artifacts.push({
          name: metadata?.name ?? entry.name,
          description: metadata?.description ?? manifest.description,
          type: "skill",
          path: relativePath,
          absolutePath: skillPath,
          format: "claude-plugin",
          metadata: metadata as Record<string, unknown> | undefined,
        });
      }
    } catch {
      // skills directory doesn't exist or can't be read
    }
  }

  // The plugin itself is the single collection
  const collection: DiscoveredCollection = {
    name: manifest.name,
    description: manifest.description,
    artifacts: artifacts.map((a) => a.name),
    path: ".",
    metadata: {
      version: manifest.version,
      author: manifest.author,
    },
  };

  return {
    artifacts,
    collections: artifacts.length > 0 ? [collection] : [],
    format: "claude-plugin",
  };
}

/**
 * Discover artifacts from simple format (skills/ directory).
 * Simple format has no collections - just raw artifacts.
 */
async function discoverSimpleFormat(repoPath: string): Promise<DiscoveryResult> {
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

  // Simple format has no collections
  return { artifacts, collections: [], format: "simple" };
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
