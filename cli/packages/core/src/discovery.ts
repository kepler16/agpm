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

/** Common plugin entry structure (shared between plugin.json and marketplace entries) */
export interface PluginEntry {
  name: string;
  version?: string;
  description?: string;
  author?: {
    name: string;
    email?: string;
    url?: string;
  };
  /**
   * Skills configuration:
   * - In plugin.json: path(s) to directories containing skills (e.g., "./custom/skills/")
   * - In marketplace: explicit paths to individual skill directories (e.g., ["./skills/pdf"])
   */
  skills?: string | string[];
  commands?: string | string[];
  agents?: string | string[];
  /** Marketplace-only: source directory for the plugin */
  source?: string;
  /** Marketplace-only: if true, plugin must have its own plugin.json */
  strict?: boolean;
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
  plugins: PluginEntry[];
}

/** Plugin manifest (.claude-plugin/plugin.json) - single plugin */
export type ClaudePluginManifest = PluginEntry;

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
// Skill Discovery Helpers
// ============================================================================

interface DiscoveredSkill {
  name: string;
  description?: string;
  path: string;
  absolutePath: string;
  metadata?: Record<string, unknown>;
}

/**
 * Discover skills from explicit paths (used by marketplace when skills array is defined).
 */
async function discoverSkillsFromPaths(
  repoPath: string,
  skillPaths: string[],
  seenPaths: Set<string>,
  fallbackDescription?: string
): Promise<DiscoveredSkill[]> {
  const skills: DiscoveredSkill[] = [];

  for (const skillPath of skillPaths) {
    const normalizedPath = skillPath.replace(/^\.\//, "");
    if (seenPaths.has(normalizedPath)) continue;
    seenPaths.add(normalizedPath);

    const absolutePath = join(repoPath, normalizedPath);
    const metadata = await parseSkillMd(absolutePath);

    skills.push({
      name: metadata?.name ?? basename(normalizedPath),
      description: metadata?.description ?? fallbackDescription,
      path: normalizedPath,
      absolutePath,
      metadata: metadata as Record<string, unknown> | undefined,
    });
  }

  return skills;
}

/**
 * Discover all skills within a directory (used by plugin.json and marketplace fallback).
 */
async function discoverSkillsFromDirectory(
  repoPath: string,
  skillsDir: string,
  seenPaths: Set<string>,
  fallbackDescription?: string
): Promise<DiscoveredSkill[]> {
  const skills: DiscoveredSkill[] = [];

  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

      const skillPath = join(skillsDir, entry.name);
      const relativePath = relative(repoPath, skillPath);

      if (seenPaths.has(relativePath)) continue;
      seenPaths.add(relativePath);

      const metadata = await parseSkillMd(skillPath);

      skills.push({
        name: metadata?.name ?? entry.name,
        description: metadata?.description ?? fallbackDescription,
        path: relativePath,
        absolutePath: skillPath,
        metadata: metadata as Record<string, unknown> | undefined,
      });
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return skills;
}

/**
 * Convert discovered skills to artifacts with format tag.
 */
function skillsToArtifacts(
  skills: DiscoveredSkill[],
  format: SourceFormat
): DiscoveredArtifact[] {
  return skills.map((skill) => ({
    name: skill.name,
    description: skill.description,
    type: "skill" as const,
    path: skill.path,
    absolutePath: skill.absolutePath,
    format,
    metadata: skill.metadata,
  }));
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
 * - Contains `plugins` array with plugin entries
 * - If plugin has explicit `skills` array → use only those
 * - Otherwise discover from `source/skills/` directory
 * - Each plugin becomes a collection containing its artifacts
 */
async function discoverClaudeMarketplace(repoPath: string): Promise<DiscoveryResult> {
  const manifestPath = join(repoPath, ".claude-plugin", "marketplace.json");
  const content = await readFile(manifestPath, "utf-8");
  const manifest: ClaudeMarketplaceManifest = JSON.parse(content);

  const allArtifacts: DiscoveredArtifact[] = [];
  const collections: DiscoveredCollection[] = [];
  const seenPaths = new Set<string>();

  for (const plugin of manifest.plugins) {
    const sourcePath = (typeof plugin.source === "string" ? plugin.source : "").replace(/^\.\//, "");
    let skills: DiscoveredSkill[] = [];

    // If plugin has explicit skills array, use ONLY those
    if (plugin.skills && Array.isArray(plugin.skills) && plugin.skills.length > 0) {
      skills = await discoverSkillsFromPaths(
        repoPath,
        plugin.skills,
        seenPaths,
        plugin.description
      );
    } else if (plugin.source) {
      // No explicit skills - discover from source/skills/ directory
      const pluginDir = sourcePath ? join(repoPath, sourcePath) : repoPath;
      const skillsDir = join(pluginDir, "skills");
      skills = await discoverSkillsFromDirectory(
        repoPath,
        skillsDir,
        seenPaths,
        plugin.description
      );
    }

    // Add to artifacts
    const artifacts = skillsToArtifacts(skills, "claude-marketplace");
    allArtifacts.push(...artifacts);

    // Create collection for this plugin
    if (skills.length > 0) {
      collections.push({
        name: plugin.name,
        description: plugin.description,
        artifacts: skills.map((s) => s.name),
        path: sourcePath || ".",
        metadata: {
          version: plugin.version,
          author: plugin.author,
        },
      });
    }
  }

  return { artifacts: allArtifacts, collections, format: "claude-marketplace" };
}

/**
 * Discover artifacts from Claude plugin manifest.
 *
 * Plugin format (.claude-plugin/plugin.json):
 * - `skills` field is path(s) to directories CONTAINING skills
 * - Default `skills/` directory is always searched
 * - The plugin itself is the collection containing all artifacts
 */
async function discoverClaudePlugin(repoPath: string): Promise<DiscoveryResult> {
  const manifestPath = join(repoPath, ".claude-plugin", "plugin.json");
  const content = await readFile(manifestPath, "utf-8");
  const manifest: ClaudePluginManifest = JSON.parse(content);

  const seenPaths = new Set<string>();
  const allSkills: DiscoveredSkill[] = [];

  // Collect skill directories to search
  const skillsDirs: string[] = [];

  // Add custom skills paths from manifest (these are directory paths, not individual skills)
  if (manifest.skills) {
    const paths = Array.isArray(manifest.skills) ? manifest.skills : [manifest.skills];
    for (const p of paths) {
      const normalized = p.replace(/^\.\//, "");
      skillsDirs.push(join(repoPath, normalized));
    }
  }

  // Always add default skills/ directory
  skillsDirs.push(join(repoPath, "skills"));

  // Discover skills from each directory
  for (const skillsDir of skillsDirs) {
    const skills = await discoverSkillsFromDirectory(
      repoPath,
      skillsDir,
      seenPaths,
      manifest.description
    );
    allSkills.push(...skills);
  }

  const artifacts = skillsToArtifacts(allSkills, "claude-plugin");

  // The plugin itself is the single collection
  const collection: DiscoveredCollection = {
    name: manifest.name,
    description: manifest.description,
    artifacts: allSkills.map((s) => s.name),
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
 * Simple format uses metadata.json, not Claude's SKILL.md structure.
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

      // Simple format uses metadata.json
      let metadata: Record<string, unknown> = {};
      try {
        const content = await readFile(join(skillPath, "metadata.json"), "utf-8");
        metadata = JSON.parse(content);
      } catch {
        // No metadata.json
      }

      const name = (metadata.name as string) ?? entry.name;
      const description = (metadata.description as string) ?? (metadata.abstract as string);

      artifacts.push({
        name,
        description,
        type: "skill",
        path: relative(repoPath, skillPath),
        absolutePath: skillPath,
        format: "simple",
        metadata,
      });
    }
  } catch {
    // skills/ directory doesn't exist or can't be read
  }

  return { artifacts, collections: [], format: "simple" };
}

/**
 * Parse Claude Code skill metadata from SKILL.md or AGENTS.md YAML frontmatter.
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
