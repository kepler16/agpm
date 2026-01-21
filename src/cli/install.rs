//! Install command - install skills from lock file or resolve from skills.json

use anyhow::{Result, Context};
use std::path::PathBuf;

use crate::config::{SkillsConfig, SkillsLock, LockedSkill};
use crate::git::{GitSource, ClonedRepo};
use crate::skill::discover_skills;

/// Target agents and their skill directories
const AGENTS: &[(&str, &str)] = &[
    ("claude-code", ".claude/skills"),
    ("opencode", ".opencode/skills"),
    ("cursor", ".cursor/skills"),
    ("codex", ".codex/skills"),
];

pub async fn run() -> Result<()> {
    let cwd = std::env::current_dir()?;
    
    let config = SkillsConfig::load(&cwd).await?;
    let mut lock = SkillsLock::load(&cwd).await?;
    
    if config.skills.is_empty() && config.marketplaces.is_empty() {
        println!("No skills configured in skills.json");
        println!("Run 'skills add <source>' to add skills.");
        return Ok(());
    }

    let mut installed_count = 0;

    // Install individual skills
    for skill_spec in &config.skills {
        println!("\nProcessing skill: {}", skill_spec.name);
        
        // Check if we have a lock entry
        let locked = lock.skills.get(&skill_spec.name);
        
        // Clone the repo (keep it alive until we're done copying)
        let git_source = if let Some(locked) = locked {
            println!("  Using locked SHA: {}", &locked.sha[..8]);
            GitSource::parse(&locked.source)?
        } else {
            println!("  Resolving from source: {}", skill_spec.source);
            GitSource::parse(&skill_spec.source)?
        };
        
        let cloned = ClonedRepo::clone(&git_source)?;
        let sha = cloned.sha.clone();
        
        // Find the skill in the cloned repo
        let skills = discover_skills(&cloned.path, skill_spec.path.as_deref()).await?;
        let skill = skills.into_iter()
            .find(|s| s.metadata.name == skill_spec.name)
            .ok_or_else(|| anyhow::anyhow!("Skill '{}' not found in {}", skill_spec.name, skill_spec.source))?;
        
        // Update lock file
        let locked_skill = LockedSkill {
            name: skill.metadata.name.clone(),
            source: git_source.url.clone(),
            sha: sha.clone(),
            path: skill.relative_path.clone(),
            description: Some(skill.metadata.description.clone()),
            marketplace: None,
        };
        lock.skills.insert(skill_spec.name.clone(), locked_skill);
        
        // Install to agent directories (cloned repo is still alive here)
        install_skill_to_agents(&skill_spec.name, &skill.path, &cwd).await?;
        installed_count += 1;
        
        println!("  Installed: {} @ {}", skill_spec.name, &sha[..8]);
    }

    // Install marketplace skills
    for marketplace in &config.marketplaces {
        if marketplace.enabled.is_empty() {
            continue;
        }
        
        println!("\nProcessing marketplace: {}", marketplace.name);
        
        let git_source = GitSource::parse(&marketplace.source)?;
        let cloned = ClonedRepo::clone(&git_source)?;
        
        let skills = discover_skills(&cloned.path, None).await?;
        
        for skill_name in &marketplace.enabled {
            let skill = skills.iter()
                .find(|s| &s.metadata.name == skill_name)
                .ok_or_else(|| anyhow::anyhow!(
                    "Skill '{}' not found in marketplace '{}'", 
                    skill_name, marketplace.name
                ))?;
            
            // Update lock
            let locked_skill = LockedSkill {
                name: skill.metadata.name.clone(),
                source: git_source.url.clone(),
                sha: cloned.sha.clone(),
                path: skill.relative_path.clone(),
                description: Some(skill.metadata.description.clone()),
                marketplace: Some(marketplace.name.clone()),
            };
            lock.skills.insert(skill_name.clone(), locked_skill);
            
            install_skill_to_agents(skill_name, &skill.path, &cwd).await?;
            installed_count += 1;
            
            println!("  Installed: {} @ {}", skill_name, &cloned.sha[..8]);
        }
    }

    // Save lock file
    lock.save(&cwd).await?;
    
    println!("\n{} skill(s) installed.", installed_count);
    println!("Lock file updated: skills-lock.json");
    
    Ok(())
}

async fn install_skill_to_agents(name: &str, source_path: &PathBuf, cwd: &PathBuf) -> Result<()> {
    for (agent_name, skills_dir) in AGENTS {
        let target_dir = cwd.join(skills_dir).join(name);
        
        // Create parent directory
        if let Some(parent) = target_dir.parent() {
            tokio::fs::create_dir_all(parent).await
                .context(format!("Failed to create {} directory", agent_name))?;
        }
        
        // Copy skill directory
        copy_dir_recursive(source_path, &target_dir).await
            .context(format!("Failed to copy skill to {}", agent_name))?;
    }
    
    Ok(())
}

async fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> Result<()> {
    tokio::fs::create_dir_all(dst).await?;
    
    let mut entries = tokio::fs::read_dir(src).await?;
    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();
        let file_name = path.file_name().unwrap();
        let dst_path = dst.join(file_name);
        
        if path.is_dir() {
            Box::pin(copy_dir_recursive(&path, &dst_path)).await?;
        } else {
            tokio::fs::copy(&path, &dst_path).await?;
        }
    }
    
    Ok(())
}
