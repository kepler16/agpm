//! Configuration types for skills.json and skills-lock.json

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use anyhow::{Result, Context};
use tokio::fs;

pub const SKILLS_CONFIG_SCHEMA: &str = "https://skills.sh/schemas/skills.json";
pub const SKILLS_LOCK_SCHEMA: &str = "https://skills.sh/schemas/skills-lock.json";

/// skills.json - the user-edited config file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillsConfig {
    /// JSON Schema reference for editor validation
    #[serde(rename = "$schema", default = "default_config_schema")]
    pub schema: String,
    
    /// Registered marketplaces (repos containing multiple skills)
    #[serde(default)]
    pub marketplaces: Vec<Marketplace>,
    
    /// Individual skills to install
    #[serde(default)]
    pub skills: Vec<SkillSpec>,
}

fn default_config_schema() -> String {
    SKILLS_CONFIG_SCHEMA.to_string()
}

impl Default for SkillsConfig {
    fn default() -> Self {
        Self {
            schema: default_config_schema(),
            marketplaces: Vec::new(),
            skills: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Marketplace {
    /// Name for this marketplace (e.g., "anthropic", "vercel")
    pub name: String,
    
    /// Git source (owner/repo or full URL)
    pub source: String,
    
    /// Optional: pin to specific ref (branch/tag)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ref_: Option<String>,
    
    /// Skills enabled from this marketplace
    #[serde(default)]
    pub enabled: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillSpec {
    /// Skill name
    pub name: String,
    
    /// Git source (owner/repo, full URL, or marketplace reference like "anthropic/pdf")
    pub source: String,
    
    /// Optional: pin to specific ref (branch/tag)
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "ref")]
    pub ref_: Option<String>,
    
    /// Optional: subpath within repo if skill is nested
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

/// skills-lock.json - the lock file with resolved SHAs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillsLock {
    /// JSON Schema reference for editor validation
    #[serde(rename = "$schema", default = "default_lock_schema")]
    pub schema: String,
    
    /// Lock file version
    pub version: u32,
    
    /// Locked marketplace states
    #[serde(default)]
    pub marketplaces: HashMap<String, LockedMarketplace>,
    
    /// Locked skill states
    #[serde(default)]
    pub skills: HashMap<String, LockedSkill>,
}

fn default_lock_schema() -> String {
    SKILLS_LOCK_SCHEMA.to_string()
}

impl Default for SkillsLock {
    fn default() -> Self {
        Self {
            schema: default_lock_schema(),
            version: 1,
            marketplaces: HashMap::new(),
            skills: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockedMarketplace {
    /// Git source URL
    pub source: String,
    
    /// Resolved git SHA
    pub sha: String,
    
    /// Available skills discovered in this marketplace
    #[serde(default)]
    pub available_skills: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockedSkill {
    /// Skill name
    pub name: String,
    
    /// Git source URL (resolved)
    pub source: String,
    
    /// Resolved git SHA
    pub sha: String,
    
    /// Path within repo to skill directory
    pub path: String,
    
    /// Skill description from SKILL.md frontmatter
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    
    /// Whether this came from a marketplace
    #[serde(skip_serializing_if = "Option::is_none")]
    pub marketplace: Option<String>,
}

impl SkillsConfig {
    pub const FILENAME: &'static str = "skills.json";
    
    pub async fn load(dir: &Path) -> Result<Self> {
        let path = dir.join(Self::FILENAME);
        if !path.exists() {
            return Ok(Self::default());
        }
        let content = fs::read_to_string(&path).await
            .context("Failed to read skills.json")?;
        serde_json::from_str(&content)
            .context("Failed to parse skills.json")
    }
    
    pub async fn save(&self, dir: &Path) -> Result<()> {
        let path = dir.join(Self::FILENAME);
        let content = serde_json::to_string_pretty(self)?;
        fs::write(&path, content).await
            .context("Failed to write skills.json")?;
        Ok(())
    }
}

impl SkillsLock {
    pub const FILENAME: &'static str = "skills-lock.json";
    
    pub async fn load(dir: &Path) -> Result<Self> {
        let path = dir.join(Self::FILENAME);
        if !path.exists() {
            return Ok(Self::default());
        }
        let content = fs::read_to_string(&path).await
            .context("Failed to read skills-lock.json")?;
        serde_json::from_str(&content)
            .context("Failed to parse skills-lock.json")
    }
    
    pub async fn save(&self, dir: &Path) -> Result<()> {
        let path = dir.join(Self::FILENAME);
        let content = serde_json::to_string_pretty(self)?;
        fs::write(&path, content).await
            .context("Failed to write skills-lock.json")?;
        Ok(())
    }
}
