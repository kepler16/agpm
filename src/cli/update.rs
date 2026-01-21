//! Update command - update skills to latest versions

use anyhow::Result;

use crate::config::{SkillsConfig, SkillsLock, LockedSkill};
use crate::git::{GitSource, ClonedRepo, resolve_sha};
use crate::skill::discover_skills;

pub async fn run(skill_name: Option<&str>) -> Result<()> {
    let cwd = std::env::current_dir()?;
    
    let config = SkillsConfig::load(&cwd).await?;
    let mut lock = SkillsLock::load(&cwd).await?;
    
    if config.skills.is_empty() && config.marketplaces.is_empty() {
        println!("No skills configured in skills.json");
        return Ok(());
    }

    let mut updated_count = 0;

    // Update individual skills
    for skill_spec in &config.skills {
        if let Some(name) = skill_name {
            if skill_spec.name != name {
                continue;
            }
        }
        
        println!("Checking {}", skill_spec.name);
        
        let git_source = GitSource::parse(&skill_spec.source)?;
        let new_sha = resolve_sha(&git_source).await?;
        
        let current_sha = lock.skills.get(&skill_spec.name).map(|s| s.sha.as_str());
        
        if current_sha == Some(&new_sha) {
            println!("  Already up to date: {}", &new_sha[..8]);
            continue;
        }
        
        println!("  Updating {} -> {}", 
            current_sha.map(|s| &s[..8]).unwrap_or("none"),
            &new_sha[..8]
        );
        
        // Clone and discover skill
        let cloned = ClonedRepo::clone(&git_source)?;
        let skills = discover_skills(&cloned.path, skill_spec.path.as_deref()).await?;
        
        let skill = skills.into_iter()
            .find(|s| s.metadata.name == skill_spec.name)
            .ok_or_else(|| anyhow::anyhow!("Skill '{}' not found", skill_spec.name))?;
        
        // Update lock
        let locked_skill = LockedSkill {
            name: skill.metadata.name.clone(),
            source: git_source.url.clone(),
            sha: new_sha.clone(),
            path: skill.relative_path.clone(),
            description: Some(skill.metadata.description.clone()),
            marketplace: None,
        };
        lock.skills.insert(skill_spec.name.clone(), locked_skill);
        updated_count += 1;
    }

    // Update marketplace skills
    for marketplace in &config.marketplaces {
        let git_source = GitSource::parse(&marketplace.source)?;
        let new_sha = resolve_sha(&git_source).await?;
        
        for skill_name_to_check in &marketplace.enabled {
            if let Some(name) = skill_name {
                if skill_name_to_check != name {
                    continue;
                }
            }
            
            let current_sha = lock.skills.get(skill_name_to_check).map(|s| s.sha.as_str());
            
            if current_sha == Some(&new_sha) {
                continue;
            }
            
            println!("Updating {} (marketplace: {})", skill_name_to_check, marketplace.name);
            
            let cloned = ClonedRepo::clone(&git_source)?;
            let skills = discover_skills(&cloned.path, None).await?;
            
            let skill = skills.iter()
                .find(|s| &s.metadata.name == skill_name_to_check)
                .ok_or_else(|| anyhow::anyhow!("Skill '{}' not found", skill_name_to_check))?;
            
            let locked_skill = LockedSkill {
                name: skill.metadata.name.clone(),
                source: git_source.url.clone(),
                sha: new_sha.clone(),
                path: skill.relative_path.clone(),
                description: Some(skill.metadata.description.clone()),
                marketplace: Some(marketplace.name.clone()),
            };
            lock.skills.insert(skill_name_to_check.clone(), locked_skill);
            updated_count += 1;
        }
    }

    lock.save(&cwd).await?;
    
    if updated_count > 0 {
        println!("\n{} skill(s) updated in lock file.", updated_count);
        println!("Run 'skills install' to apply updates.");
    } else {
        println!("\nAll skills are up to date.");
    }
    
    Ok(())
}
