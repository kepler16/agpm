//! Skill discovery and parsing

use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::fs;

/// Parsed skill metadata from SKILL.md frontmatter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillMetadata {
    pub name: String,
    pub description: String,
    #[serde(flatten)]
    pub extra: serde_yaml::Value,
}

/// A discovered skill
#[derive(Debug, Clone)]
pub struct Skill {
    pub metadata: SkillMetadata,
    pub path: PathBuf,
    pub relative_path: String,
}

const SKIP_DIRS: &[&str] = &["node_modules", ".git", "dist", "build", "__pycache__", "target"];

/// Priority search directories within a repo
const SEARCH_DIRS: &[&str] = &[
    "skills",
    "skills/.curated",
    "skills/.experimental", 
    "skills/.system",
    ".agent/skills",
    ".agents/skills",
    ".claude/skills",
    ".codex/skills",
    ".cursor/skills",
    ".github/skills",
    ".goose/skills",
    ".kilocode/skills",
    ".kiro/skills",
    ".opencode/skills",
    ".roo/skills",
    ".trae/skills",
    ".windsurf/skills",
];

/// Discover all skills in a directory
pub async fn discover_skills(base_path: &Path, subpath: Option<&str>) -> Result<Vec<Skill>> {
    let search_path = match subpath {
        Some(p) => base_path.join(p),
        None => base_path.to_path_buf(),
    };

    let mut skills = Vec::new();
    let mut seen_names = std::collections::HashSet::new();

    // Check if the search path itself is a skill
    if let Some(skill) = try_parse_skill(&search_path, base_path).await? {
        return Ok(vec![skill]);
    }

    // Search priority directories first
    for dir in SEARCH_DIRS {
        let dir_path = search_path.join(dir);
        if dir_path.exists() {
            find_skills_in_dir(&dir_path, base_path, &mut skills, &mut seen_names).await?;
        }
    }

    // If no skills found, do a recursive search
    if skills.is_empty() {
        find_skills_recursive(&search_path, base_path, &mut skills, &mut seen_names, 0, 5).await?;
    }

    Ok(skills)
}

async fn find_skills_in_dir(
    dir: &Path,
    base_path: &Path,
    skills: &mut Vec<Skill>,
    seen_names: &mut std::collections::HashSet<String>,
) -> Result<()> {
    let mut entries = fs::read_dir(dir).await?;
    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();
        if path.is_dir() {
            if let Some(skill) = try_parse_skill(&path, base_path).await? {
                if !seen_names.contains(&skill.metadata.name) {
                    seen_names.insert(skill.metadata.name.clone());
                    skills.push(skill);
                }
            }
        }
    }
    Ok(())
}

async fn find_skills_recursive(
    dir: &Path,
    base_path: &Path,
    skills: &mut Vec<Skill>,
    seen_names: &mut std::collections::HashSet<String>,
    depth: usize,
    max_depth: usize,
) -> Result<()> {
    if depth > max_depth {
        return Ok(());
    }

    if let Some(skill) = try_parse_skill(dir, base_path).await? {
        if !seen_names.contains(&skill.metadata.name) {
            seen_names.insert(skill.metadata.name.clone());
            skills.push(skill);
        }
        return Ok(()); // Don't recurse into skill directories
    }

    let mut entries = match fs::read_dir(dir).await {
        Ok(e) => e,
        Err(_) => return Ok(()),
    };

    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();
        if path.is_dir() {
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if !SKIP_DIRS.contains(&name) && !name.starts_with('.') {
                Box::pin(find_skills_recursive(&path, base_path, skills, seen_names, depth + 1, max_depth)).await?;
            }
        }
    }

    Ok(())
}

/// Try to parse a directory as a skill
async fn try_parse_skill(dir: &Path, base_path: &Path) -> Result<Option<Skill>> {
    let skill_md = dir.join("SKILL.md");
    if !skill_md.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&skill_md).await
        .context("Failed to read SKILL.md")?;

    let metadata = parse_frontmatter(&content)?;
    
    let relative_path = dir.strip_prefix(base_path)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    Ok(Some(Skill {
        metadata,
        path: dir.to_path_buf(),
        relative_path,
    }))
}

/// Parse YAML frontmatter from SKILL.md content
fn parse_frontmatter(content: &str) -> Result<SkillMetadata> {
    let content = content.trim();
    
    if !content.starts_with("---") {
        anyhow::bail!("SKILL.md must start with YAML frontmatter (---)");
    }

    let rest = &content[3..];
    let end = rest.find("---")
        .ok_or_else(|| anyhow::anyhow!("SKILL.md frontmatter not closed (missing ---)"))?;

    let yaml = &rest[..end].trim();
    let metadata: SkillMetadata = serde_yaml::from_str(yaml)
        .context("Failed to parse SKILL.md frontmatter")?;

    if metadata.name.is_empty() {
        anyhow::bail!("SKILL.md must have a 'name' field");
    }
    if metadata.description.is_empty() {
        anyhow::bail!("SKILL.md must have a 'description' field");
    }

    Ok(metadata)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_frontmatter() {
        let content = r#"---
name: test-skill
description: A test skill
---

# Test Skill

Instructions here.
"#;
        let metadata = parse_frontmatter(content).unwrap();
        assert_eq!(metadata.name, "test-skill");
        assert_eq!(metadata.description, "A test skill");
    }
}
