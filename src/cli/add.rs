//! Add command - add a skill to skills.json

use anyhow::Result;

use crate::config::{SkillsConfig, SkillSpec};
use crate::git::{GitSource, ClonedRepo};
use crate::skill::discover_skills;

pub async fn run(source: &str, skill_name: Option<&str>) -> Result<()> {
    let cwd = std::env::current_dir()?;
    
    println!("Parsing source: {}", source);
    let git_source = GitSource::parse(source)?;
    
    println!("Cloning {}...", git_source.url);
    let cloned = ClonedRepo::clone(&git_source)?;
    println!("Resolved SHA: {}", cloned.sha);
    
    println!("Discovering skills...");
    let skills = discover_skills(&cloned.path, git_source.subpath.as_deref()).await?;
    
    if skills.is_empty() {
        anyhow::bail!("No skills found in {}", source);
    }

    println!("Found {} skill(s):", skills.len());
    for skill in &skills {
        println!("  - {} ({})", skill.metadata.name, skill.metadata.description);
    }

    // Select skill(s) to add
    let selected_skills: Vec<_> = if let Some(name) = skill_name {
        skills.into_iter()
            .filter(|s| s.metadata.name == name)
            .collect()
    } else if skills.len() == 1 {
        skills
    } else {
        // TODO: Interactive selection with TUI
        println!("\nMultiple skills found. Use --skill <name> to select one.");
        return Ok(());
    };

    if selected_skills.is_empty() {
        anyhow::bail!("Skill '{}' not found", skill_name.unwrap_or(""));
    }

    // Load or create config
    let mut config = SkillsConfig::load(&cwd).await?;
    
    // Add skills to config
    for skill in &selected_skills {
        let spec = SkillSpec {
            name: skill.metadata.name.clone(),
            source: git_source.canonical(),
            ref_: git_source.ref_.clone(),
            path: if skill.relative_path.is_empty() {
                None
            } else {
                Some(skill.relative_path.clone())
            },
        };
        
        // Check if already exists
        if config.skills.iter().any(|s| s.name == spec.name) {
            println!("Skill '{}' already in skills.json, updating...", spec.name);
            config.skills.retain(|s| s.name != spec.name);
        }
        
        config.skills.push(spec);
        println!("Added '{}' to skills.json", skill.metadata.name);
    }
    
    config.save(&cwd).await?;
    
    println!("\nRun 'skills install' to install the skill(s).");
    
    Ok(())
}
