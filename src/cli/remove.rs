//! Remove command - remove a skill

use anyhow::Result;

use crate::config::{SkillsConfig, SkillsLock};

/// Target agents and their skill directories  
const AGENTS: &[(&str, &str)] = &[
    ("claude-code", ".claude/skills"),
    ("opencode", ".opencode/skills"),
    ("cursor", ".cursor/skills"),
    ("codex", ".codex/skills"),
];

pub async fn run(skill_name: &str) -> Result<()> {
    let cwd = std::env::current_dir()?;
    
    let mut config = SkillsConfig::load(&cwd).await?;
    let mut lock = SkillsLock::load(&cwd).await?;
    
    let mut found = false;

    // Remove from individual skills
    let original_len = config.skills.len();
    config.skills.retain(|s| s.name != skill_name);
    if config.skills.len() < original_len {
        found = true;
        println!("Removed '{}' from skills.json", skill_name);
    }

    // Remove from marketplace enabled lists
    for marketplace in &mut config.marketplaces {
        let original_len = marketplace.enabled.len();
        marketplace.enabled.retain(|n| n != skill_name);
        if marketplace.enabled.len() < original_len {
            found = true;
            println!("Disabled '{}' in marketplace '{}'", skill_name, marketplace.name);
        }
    }

    // Remove from lock file
    if lock.skills.remove(skill_name).is_some() {
        println!("Removed '{}' from lock file", skill_name);
    }

    if !found {
        println!("Skill '{}' not found in skills.json", skill_name);
        return Ok(());
    }

    // Remove installed files
    for (agent_name, skills_dir) in AGENTS {
        let skill_path = cwd.join(skills_dir).join(skill_name);
        if skill_path.exists() {
            tokio::fs::remove_dir_all(&skill_path).await?;
            println!("Removed {} from {}", skill_name, agent_name);
        }
    }

    config.save(&cwd).await?;
    lock.save(&cwd).await?;
    
    println!("\nSkill '{}' removed.", skill_name);
    
    Ok(())
}
