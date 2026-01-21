import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { validateConfig, validateLock, formatValidationErrors } from "./validate.js";

// ============================================================================
// Types
// ============================================================================

export interface TargetConfig {
  // Target-specific options (to be expanded)
}

export interface AgpmConfig {
  $schema?: string;
  targets: Record<string, TargetConfig>;
  sources: string[];
  artifacts: string[];
}

export interface LockedArtifact {
  sha: string;
  integrity: string;
  path: string;
  metadata: {
    name: string;
    description?: string;
    [key: string]: unknown;
  };
}

export interface AgpmLock {
  $schema?: string;
  version: number;
  artifacts: Record<string, LockedArtifact>;
}

// ============================================================================
// Schema URLs
// ============================================================================

export const CONFIG_SCHEMA_URL = "https://agpm.dev/schemas/agpm.json";
export const LOCK_SCHEMA_URL = "https://agpm.dev/schemas/agpm-lock.json";

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_CONFIG: AgpmConfig = {
  $schema: CONFIG_SCHEMA_URL,
  targets: {},
  sources: [],
  artifacts: [],
};

export const DEFAULT_LOCK: AgpmLock = {
  $schema: LOCK_SCHEMA_URL,
  version: 1,
  artifacts: {},
};

// ============================================================================
// File I/O
// ============================================================================

const CONFIG_FILE = "agpm.json";
const LOCK_FILE = "agpm-lock.json";

export async function loadConfig(dir: string): Promise<AgpmConfig> {
  const path = join(dir, CONFIG_FILE);
  try {
    const content = await readFile(path, "utf-8");
    const config = JSON.parse(content) as AgpmConfig;

    // Validate against schema
    const result = await validateConfig(config);
    if (!result.valid) {
      throw new Error(
        `Invalid ${CONFIG_FILE}:\n${formatValidationErrors(result.errors)}`
      );
    }

    return config;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { ...DEFAULT_CONFIG };
    }
    throw error;
  }
}

export async function saveConfig(dir: string, config: AgpmConfig): Promise<void> {
  const path = join(dir, CONFIG_FILE);
  // Ensure $schema is always included
  const configWithSchema = { $schema: CONFIG_SCHEMA_URL, ...config };
  const content = JSON.stringify(configWithSchema, null, 2) + "\n";
  await writeFile(path, content, "utf-8");
}

export async function loadLock(dir: string): Promise<AgpmLock> {
  const path = join(dir, LOCK_FILE);
  try {
    const content = await readFile(path, "utf-8");
    const lock = JSON.parse(content) as AgpmLock;

    // Validate against schema
    const result = await validateLock(lock);
    if (!result.valid) {
      throw new Error(
        `Invalid ${LOCK_FILE}:\n${formatValidationErrors(result.errors)}`
      );
    }

    return lock;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { ...DEFAULT_LOCK };
    }
    throw error;
  }
}

export async function saveLock(dir: string, lock: AgpmLock): Promise<void> {
  const path = join(dir, LOCK_FILE);
  // Ensure $schema is always included
  const lockWithSchema = { $schema: LOCK_SCHEMA_URL, ...lock };
  const content = JSON.stringify(lockWithSchema, null, 2) + "\n";
  await writeFile(path, content, "utf-8");
}
