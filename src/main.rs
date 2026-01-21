mod cli;
mod config;
mod git;
mod skill;
mod tui;

use anyhow::Result;
use clap::Parser;
use cli::{Cli, Commands};

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Some(Commands::Add { source, skill }) => {
            cli::add::run(&source, skill.as_deref()).await?;
        }
        Some(Commands::Install) => {
            cli::install::run().await?;
        }
        Some(Commands::Update { skill }) => {
            cli::update::run(skill.as_deref()).await?;
        }
        Some(Commands::List) => {
            cli::list::run().await?;
        }
        Some(Commands::Remove { skill }) => {
            cli::remove::run(&skill).await?;
        }
        None => {
            // Interactive TUI mode
            tui::run().await?;
        }
    }

    Ok(())
}
