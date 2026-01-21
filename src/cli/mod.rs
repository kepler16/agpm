pub mod add;
pub mod install;
pub mod list;
pub mod remove;
pub mod update;

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "skills")]
#[command(about = "Agent skills manager with lock file support", long_about = None)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Commands>,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Add a skill from a git repository to skills.json
    Add {
        /// Git repo (owner/repo, full URL, or local path)
        source: String,
        /// Specific skill name to add (optional, prompts if multiple found)
        #[arg(short, long)]
        skill: Option<String>,
    },
    /// Install skills from skills-lock.json (or resolve from skills.json)
    Install,
    /// Update skills to latest versions (updates lock file)
    Update {
        /// Specific skill to update (updates all if not specified)
        skill: Option<String>,
    },
    /// List installed skills
    List,
    /// Remove a skill
    Remove {
        /// Skill name to remove
        skill: String,
    },
}
