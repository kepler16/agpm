//! Interactive TUI for skills management

mod app;
mod ui;

use anyhow::Result;
use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode, KeyEventKind},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::prelude::*;
use std::io;

use app::{App, AppState};

pub async fn run() -> Result<()> {
    // Setup terminal
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // Create app state
    let mut app = App::new().await?;

    // Main loop
    let result = run_app(&mut terminal, &mut app).await;

    // Restore terminal
    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    result
}

async fn run_app<B: Backend>(terminal: &mut Terminal<B>, app: &mut App) -> Result<()> {
    loop {
        terminal.draw(|f| ui::draw(f, app))?;

        if let Event::Key(key) = event::read()? {
            if key.kind == KeyEventKind::Press {
                match app.state {
                    AppState::Main => match key.code {
                        KeyCode::Char('q') => return Ok(()),
                        KeyCode::Char('a') => app.state = AppState::AddSkill,
                        KeyCode::Char('m') => app.state = AppState::Marketplaces,
                        KeyCode::Char('i') => {
                            app.install_skills().await?;
                        }
                        KeyCode::Char('u') => {
                            app.update_skills().await?;
                        }
                        KeyCode::Up | KeyCode::Char('k') => app.previous_skill(),
                        KeyCode::Down | KeyCode::Char('j') => app.next_skill(),
                        KeyCode::Enter | KeyCode::Char(' ') => app.toggle_skill(),
                        KeyCode::Char('d') | KeyCode::Delete => app.remove_selected_skill().await?,
                        _ => {}
                    },
                    AppState::AddSkill => match key.code {
                        KeyCode::Esc => app.state = AppState::Main,
                        KeyCode::Enter => {
                            app.add_skill_from_input().await?;
                            app.state = AppState::Main;
                        }
                        KeyCode::Backspace => {
                            app.input.pop();
                        }
                        KeyCode::Char(c) => {
                            app.input.push(c);
                        }
                        _ => {}
                    },
                    AppState::Marketplaces => match key.code {
                        KeyCode::Esc => app.state = AppState::Main,
                        KeyCode::Char('a') => app.state = AppState::AddMarketplace,
                        KeyCode::Up | KeyCode::Char('k') => app.previous_marketplace(),
                        KeyCode::Down | KeyCode::Char('j') => app.next_marketplace(),
                        KeyCode::Enter => app.enter_marketplace(),
                        KeyCode::Char('d') | KeyCode::Delete => app.remove_selected_marketplace().await?,
                        _ => {}
                    },
                    AppState::AddMarketplace => match key.code {
                        KeyCode::Esc => app.state = AppState::Marketplaces,
                        KeyCode::Enter => {
                            app.add_marketplace_from_input().await?;
                            app.state = AppState::Marketplaces;
                        }
                        KeyCode::Backspace => {
                            app.input.pop();
                        }
                        KeyCode::Char(c) => {
                            app.input.push(c);
                        }
                        _ => {}
                    },
                    AppState::MarketplaceSkills => match key.code {
                        KeyCode::Esc => app.state = AppState::Marketplaces,
                        KeyCode::Up | KeyCode::Char('k') => app.previous_marketplace_skill(),
                        KeyCode::Down | KeyCode::Char('j') => app.next_marketplace_skill(),
                        KeyCode::Enter | KeyCode::Char(' ') => app.toggle_marketplace_skill().await?,
                        _ => {}
                    },
                }
            }
        }
    }
}
