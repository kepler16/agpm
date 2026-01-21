// Config types and I/O
export {
  type AgpmConfig,
  type AgpmLock,
  type TargetConfig,
  type LockedArtifact,
  type Source,
  type SourceFormat,
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
  type RepoInfo,
  parseSourceString,
  getAgpmDir,
  getRepoPath,
  ensureRepo,
  checkoutRef,
  resolveRef,
} from "./git.js";

// Discovery
export {
  type DiscoveredArtifact,
  type DiscoveredCollection,
  type DiscoveryResult,
  type PluginEntry,
  type ClaudeMarketplaceManifest,
  type ClaudePluginManifest,
  type SkillMetadata,
  type RepoFormat,
  detectFormat,
  discover,
  discoverArtifacts,
} from "./discovery.js";
