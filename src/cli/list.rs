//! List command - list installed skills

use anyhow::Result;

use crate::config::{SkillsConfig, SkillsLock};

pub async fn run() -> Result<()> {
    let cwd = std::env::current_dir()?;
    
    let config = SkillsConfig::load(&cwd).await?;
    let lock = SkillsLock::load(&cwd).await?;
    
    if config.skills.is_empty() && config.marketplaces.is_empty() {
        println!("No skills configured.");
        println!("Run 'skills add <source>' to add skills.");
        return Ok(());
    }

    println!("Configured Skills:\n");
    
    // List individual skills
    if !config.skills.is_empty() {
        for skill in &config.skills {
            let locked = lock.skills.get(&skill.name);
            let status = if let Some(l) = locked {
                format!("@ {}", &l.sha[..8])
            } else {
                "not installed".to_string()
            };
            
            let desc = locked
                .and_then(|l| l.description.as_ref())
                .map(|d| format!(" - {}", d))
                .unwrap_or_default();
            
            println!("  {} ({}){}", skill.name, status, desc);
            println!("    source: {}", skill.source);
            if let Some(ref_) = &skill.ref_ {
                println!("    ref: {}", ref_);
            }
            if let Some(path) = &skill.path {
                println!("    path: {}", path);
            }
            println!();
        }
    }

    // List marketplace skills
    for marketplace in &config.marketplaces {
        if marketplace.enabled.is_empty() {
            continue;
        }
        
        println!("  Marketplace: {} ({})", marketplace.name, marketplace.source);
        for skill_name in &marketplace.enabled {
            let locked = lock.skills.get(skill_name);
            let status = if let Some(l) = locked {
                format!("@ {}", &l.sha[..8])
            } else {
                "not installed".to_string()
            };
            
            let desc = locked
                .and_then(|l| l.description.as_ref())
                .map(|d| format!(" - {}", d))
                .unwrap_or_default();
            
            println!("    - {} ({}){}", skill_name, status, desc);
        }
        println!();
    }

    Ok(())
}
