// ============================================================================
// Target Definitions
// ============================================================================

/**
 * Definition of a target tool's directory structure.
 */
export interface TargetDefinition {
  /** Base directory for this target (e.g., ".claude") */
  basePath: string;
  /** Subdirectory for skills (relative to basePath) */
  skillsDir: string;
  /** Subdirectory for commands (relative to basePath), undefined if not supported */
  commandsDir?: string;
  /** Subdirectory for hooks (relative to basePath), undefined if not supported */
  hooksDir?: string;
}

/**
 * Built-in target definitions.
 * Only these targets are supported.
 */
export const BUILT_IN_TARGETS: Record<string, TargetDefinition> = {
  "claude-code": {
    basePath: ".claude",
    skillsDir: "skills",
    commandsDir: "commands",
    hooksDir: "hooks",
  },
  opencode: {
    basePath: ".opencode",
    skillsDir: "skills",
    hooksDir: "hooks",
  },
  codex: {
    basePath: ".codex",
    skillsDir: "skills",
  },
};

/**
 * Artifact types that can be installed.
 */
export type ArtifactType = "skill" | "command" | "hook";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the target path for a specific artifact type.
 * Returns null if the target doesn't exist or doesn't support the artifact type.
 */
export function getTargetPath(
  targetName: string,
  artifactType: ArtifactType
): string | null {
  const target = BUILT_IN_TARGETS[targetName];
  if (!target) return null;

  let subdir: string | undefined;
  switch (artifactType) {
    case "skill":
      subdir = target.skillsDir;
      break;
    case "command":
      subdir = target.commandsDir;
      break;
    case "hook":
      subdir = target.hooksDir;
      break;
  }

  return subdir ? `${target.basePath}/${subdir}` : null;
}

/**
 * Get all target paths for enabled targets.
 * Only returns paths for targets that support the given artifact type.
 *
 * Target config can be:
 * - `true` (simplified form): target is enabled with defaults
 * - `{}` (object form): target is enabled, allows future options
 * - `false` or missing: target is disabled
 */
export function getEnabledTargetPaths(
  targets: Record<string, unknown>,
  artifactType: ArtifactType
): string[] {
  const paths: string[] = [];

  for (const [targetName, config] of Object.entries(targets)) {
    // Skip disabled targets (false or falsy, but not empty object)
    if (config === false) continue;

    const path = getTargetPath(targetName, artifactType);
    if (path) {
      paths.push(path);
    }
  }

  return paths;
}

/**
 * Check if a target name is valid (built-in).
 */
export function isValidTarget(targetName: string): boolean {
  return targetName in BUILT_IN_TARGETS;
}

/**
 * Get list of all valid target names.
 */
export function getValidTargetNames(): string[] {
  return Object.keys(BUILT_IN_TARGETS);
}
