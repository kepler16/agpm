//! TUI application state

use anyhow::Result;
use std::path::PathBuf;

use crate::config::{SkillsConfig, SkillsLock, Marketplace, SkillSpec};
use crate::git::{GitSource, ClonedRepo};
use crate::skill::discover_skills;

#[derive(Debug, Clone, PartialEq)]
pub enum AppState {
    Main,
    AddSkill,
    Marketplaces,
    AddMarketplace,
    MarketplaceSkills,
}

pub struct App {
    pub state: AppState,
    pub config: SkillsConfig,
    pub lock: SkillsLock,
    pub cwd: PathBuf,
    
    // Input field for add dialogs
    pub input: String,
    
    // Selection state
    pub selected_skill: usize,
    pub selected_marketplace: usize,
    pub selected_marketplace_skill: usize,
    
    // Current marketplace being browsed
    pub current_marketplace: Option<String>,
    pub marketplace_available_skills: Vec<String>,
    
    // Status message
    pub status: String,
}

impl App {
    pub async fn new() -> Result<Self> {
        let cwd = std::env::current_dir()?;
        let config = SkillsConfig::load(&cwd).await?;
        let lock = SkillsLock::load(&cwd).await?;
        
        Ok(Self {
            state: AppState::Main,
            config,
            lock,
            cwd,
            input: String::new(),
            selected_skill: 0,
            selected_marketplace: 0,
            selected_marketplace_skill: 0,
            current_marketplace: None,
            marketplace_available_skills: Vec::new(),
            status: String::new(),
        })
    }
    
    pub fn skills_list(&self) -> Vec<(&str, bool, Option<&str>)> {
        let mut skills = Vec::new();
        
        // Individual skills
        for skill in &self.config.skills {
            let installed = self.lock.skills.contains_key(&skill.name);
            let desc = self.lock.skills.get(&skill.name)
                .and_then(|l| l.description.as_deref());
            skills.push((skill.name.as_str(), installed, desc));
        }
        
        // Marketplace skills
        for marketplace in &self.config.marketplaces {
            for skill_name in &marketplace.enabled {
                let installed = self.lock.skills.contains_key(skill_name);
                let desc = self.lock.skills.get(skill_name)
                    .and_then(|l| l.description.as_deref());
                skills.push((skill_name.as_str(), installed, desc));
            }
        }
        
        skills
    }
    
    pub fn next_skill(&mut self) {
        let len = self.skills_list().len();
        if len > 0 {
            self.selected_skill = (self.selected_skill + 1) % len;
        }
    }
    
    pub fn previous_skill(&mut self) {
        let len = self.skills_list().len();
        if len > 0 {
            self.selected_skill = self.selected_skill.checked_sub(1).unwrap_or(len - 1);
        }
    }
    
    pub fn toggle_skill(&mut self) {
        // Toggle is handled differently - skills are either installed or not
        self.status = "Use 'i' to install or 'd' to remove skills".to_string();
    }
    
    pub async fn remove_selected_skill(&mut self) -> Result<()> {
        let skills = self.skills_list();
        if let Some((name, _, _)) = skills.get(self.selected_skill) {
            let name = name.to_string();
            
            // Remove from config
            self.config.skills.retain(|s| s.name != name);
            for marketplace in &mut self.config.marketplaces {
                marketplace.enabled.retain(|n| n != &name);
            }
            
            // Remove from lock
            self.lock.skills.remove(&name);
            
            // Save
            self.config.save(&self.cwd).await?;
            self.lock.save(&self.cwd).await?;
            
            self.status = format!("Removed '{}'", name);
            
            // Adjust selection
            let new_len = self.skills_list().len();
            if self.selected_skill >= new_len && new_len > 0 {
                self.selected_skill = new_len - 1;
            }
        }
        Ok(())
    }
    
    pub async fn add_skill_from_input(&mut self) -> Result<()> {
        if self.input.is_empty() {
            return Ok(());
        }
        
        let source = self.input.clone();
        self.input.clear();
        self.status = format!("Adding skill from {}...", source);
        
        // Parse and clone
        let git_source = GitSource::parse(&source)?;
        let cloned = ClonedRepo::clone(&git_source)?;
        
        // Discover skills
        let skills = discover_skills(&cloned.path, git_source.subpath.as_deref()).await?;
        
        if skills.is_empty() {
            self.status = "No skills found".to_string();
            return Ok(());
        }
        
        // Add first skill (TODO: selection UI if multiple)
        let skill = &skills[0];
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
        
        // Check if exists
        if !self.config.skills.iter().any(|s| s.name == spec.name) {
            self.config.skills.push(spec.clone());
        }
        
        self.config.save(&self.cwd).await?;
        self.status = format!("Added '{}' - run install to download", spec.name);
        
        Ok(())
    }
    
    pub async fn install_skills(&mut self) -> Result<()> {
        self.status = "Installing skills...".to_string();
        
        // Run install logic
        crate::cli::install::run().await?;
        
        // Reload lock file
        self.lock = SkillsLock::load(&self.cwd).await?;
        self.status = "Installation complete".to_string();
        
        Ok(())
    }
    
    pub async fn update_skills(&mut self) -> Result<()> {
        self.status = "Updating skills...".to_string();
        
        crate::cli::update::run(None).await?;
        
        self.lock = SkillsLock::load(&self.cwd).await?;
        self.status = "Update complete".to_string();
        
        Ok(())
    }
    
    // Marketplace navigation
    pub fn next_marketplace(&mut self) {
        let len = self.config.marketplaces.len();
        if len > 0 {
            self.selected_marketplace = (self.selected_marketplace + 1) % len;
        }
    }
    
    pub fn previous_marketplace(&mut self) {
        let len = self.config.marketplaces.len();
        if len > 0 {
            self.selected_marketplace = self.selected_marketplace.checked_sub(1).unwrap_or(len - 1);
        }
    }
    
    pub fn enter_marketplace(&mut self) {
        if let Some(marketplace) = self.config.marketplaces.get(self.selected_marketplace) {
            self.current_marketplace = Some(marketplace.name.clone());
            self.state = AppState::MarketplaceSkills;
            self.selected_marketplace_skill = 0;
            // TODO: Load available skills from marketplace
            self.marketplace_available_skills = marketplace.enabled.clone();
        }
    }
    
    pub async fn add_marketplace_from_input(&mut self) -> Result<()> {
        if self.input.is_empty() {
            return Ok(());
        }
        
        let source = self.input.clone();
        self.input.clear();
        
        let git_source = GitSource::parse(&source)?;
        let name = git_source.repo.clone()
            .unwrap_or_else(|| "marketplace".to_string())
            .to_lowercase()
            .replace('-', "_");
        
        // Check if exists
        if self.config.marketplaces.iter().any(|m| m.name == name) {
            self.status = format!("Marketplace '{}' already exists", name);
            return Ok(());
        }
        
        let marketplace = Marketplace {
            name: name.clone(),
            source: git_source.canonical(),
            ref_: git_source.ref_.clone(),
            enabled: Vec::new(),
        };
        
        self.config.marketplaces.push(marketplace);
        self.config.save(&self.cwd).await?;
        self.status = format!("Added marketplace '{}'", name);
        
        Ok(())
    }
    
    pub async fn remove_selected_marketplace(&mut self) -> Result<()> {
        if let Some(marketplace) = self.config.marketplaces.get(self.selected_marketplace) {
            let name = marketplace.name.clone();
            
            // Remove associated skills from lock
            for skill_name in &marketplace.enabled {
                self.lock.skills.remove(skill_name);
            }
            
            self.config.marketplaces.remove(self.selected_marketplace);
            
            self.config.save(&self.cwd).await?;
            self.lock.save(&self.cwd).await?;
            
            self.status = format!("Removed marketplace '{}'", name);
            
            let new_len = self.config.marketplaces.len();
            if self.selected_marketplace >= new_len && new_len > 0 {
                self.selected_marketplace = new_len - 1;
            }
        }
        Ok(())
    }
    
    // Marketplace skills navigation
    pub fn next_marketplace_skill(&mut self) {
        let len = self.marketplace_available_skills.len();
        if len > 0 {
            self.selected_marketplace_skill = (self.selected_marketplace_skill + 1) % len;
        }
    }
    
    pub fn previous_marketplace_skill(&mut self) {
        let len = self.marketplace_available_skills.len();
        if len > 0 {
            self.selected_marketplace_skill = self.selected_marketplace_skill.checked_sub(1).unwrap_or(len - 1);
        }
    }
    
    pub async fn toggle_marketplace_skill(&mut self) -> Result<()> {
        if let Some(marketplace_name) = &self.current_marketplace.clone() {
            if let Some(skill_name) = self.marketplace_available_skills.get(self.selected_marketplace_skill) {
                let skill_name = skill_name.clone();
                
                if let Some(marketplace) = self.config.marketplaces.iter_mut()
                    .find(|m| &m.name == marketplace_name) 
                {
                    if marketplace.enabled.contains(&skill_name) {
                        marketplace.enabled.retain(|n| n != &skill_name);
                        self.status = format!("Disabled '{}'", skill_name);
                    } else {
                        marketplace.enabled.push(skill_name.clone());
                        self.status = format!("Enabled '{}'", skill_name);
                    }
                    
                    self.config.save(&self.cwd).await?;
                }
            }
        }
        Ok(())
    }
}
