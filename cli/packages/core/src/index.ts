// Config types and I/O
export {
  type AgpmConfig,
  type AgpmLock,
  type TargetConfig,
  type LockedArtifact,
  DEFAULT_CONFIG,
  DEFAULT_LOCK,
  CONFIG_SCHEMA_URL,
  LOCK_SCHEMA_URL,
  loadConfig,
  saveConfig,
  loadLock,
  saveLock,
} from "./config.js";

// Validation
export {
  type ValidationError,
  type ValidationResult,
  validateConfig,
  validateLock,
  formatValidationErrors,
} from "./validate.js";

// Git operations
export {
  type ParsedSource,
  type RepoInfo,
  parseSource,
  getAgpmDir,
  getRepoPath,
  ensureRepo,
  checkoutRef,
  resolveRef,
} from "./git.js";

// Discovery
export {
  type DiscoveredArtifact,
  type ClaudePluginManifest,
  type SkillMetadata,
  type RepoFormat,
  detectFormat,
  discoverArtifacts,
} from "./discovery.js";
