//! TUI rendering

use ratatui::{
    prelude::*,
    widgets::{Block, Borders, List, ListItem, Paragraph, Wrap},
};

use super::app::{App, AppState};

pub fn draw(frame: &mut Frame, app: &App) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),  // Title
            Constraint::Min(0),     // Main content
            Constraint::Length(3),  // Status/help
        ])
        .split(frame.area());

    // Title
    let title = Paragraph::new("Skills Manager")
        .style(Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD))
        .block(Block::default().borders(Borders::BOTTOM));
    frame.render_widget(title, chunks[0]);

    // Main content based on state
    match app.state {
        AppState::Main => draw_main(frame, app, chunks[1]),
        AppState::AddSkill => draw_add_skill(frame, app, chunks[1]),
        AppState::Marketplaces => draw_marketplaces(frame, app, chunks[1]),
        AppState::AddMarketplace => draw_add_marketplace(frame, app, chunks[1]),
        AppState::MarketplaceSkills => draw_marketplace_skills(frame, app, chunks[1]),
    }

    // Status/help bar
    let help_text = match app.state {
        AppState::Main => "q:quit  a:add skill  m:marketplaces  i:install  u:update  d:delete  j/k:navigate",
        AppState::AddSkill => "Enter:confirm  Esc:cancel",
        AppState::Marketplaces => "a:add  Enter:browse  d:delete  Esc:back  j/k:navigate",
        AppState::AddMarketplace => "Enter:confirm  Esc:cancel",
        AppState::MarketplaceSkills => "Space/Enter:toggle  Esc:back  j/k:navigate",
    };
    
    let status_text = if app.status.is_empty() {
        help_text.to_string()
    } else {
        format!("{} | {}", app.status, help_text)
    };
    
    let status = Paragraph::new(status_text)
        .style(Style::default().fg(Color::DarkGray))
        .block(Block::default().borders(Borders::TOP));
    frame.render_widget(status, chunks[2]);
}

fn draw_main(frame: &mut Frame, app: &App, area: Rect) {
    let skills = app.skills_list();
    
    if skills.is_empty() {
        let empty = Paragraph::new("No skills configured.\n\nPress 'a' to add a skill or 'm' to browse marketplaces.")
            .style(Style::default().fg(Color::DarkGray))
            .block(Block::default().title("Skills").borders(Borders::ALL));
        frame.render_widget(empty, area);
        return;
    }
    
    let items: Vec<ListItem> = skills
        .iter()
        .enumerate()
        .map(|(i, (name, installed, desc))| {
            let status_icon = if *installed { "●" } else { "○" };
            let desc_text = desc.unwrap_or("");
            let text = format!("{} {} - {}", status_icon, name, desc_text);
            
            let style = if i == app.selected_skill {
                Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)
            } else if *installed {
                Style::default().fg(Color::Green)
            } else {
                Style::default().fg(Color::White)
            };
            
            ListItem::new(text).style(style)
        })
        .collect();
    
    let list = List::new(items)
        .block(Block::default().title("Skills").borders(Borders::ALL))
        .highlight_style(Style::default().add_modifier(Modifier::REVERSED));
    
    frame.render_widget(list, area);
}

fn draw_add_skill(frame: &mut Frame, app: &App, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Min(0),
        ])
        .margin(2)
        .split(area);
    
    let input = Paragraph::new(app.input.as_str())
        .style(Style::default().fg(Color::Yellow))
        .block(Block::default()
            .title("Add Skill (owner/repo or URL)")
            .borders(Borders::ALL));
    frame.render_widget(input, chunks[0]);
    
    let help = Paragraph::new("Examples:\n  anthropics/skills\n  vercel-labs/agent-skills\n  https://github.com/owner/repo/tree/main/skills/my-skill")
        .style(Style::default().fg(Color::DarkGray))
        .wrap(Wrap { trim: false });
    frame.render_widget(help, chunks[1]);
    
    // Show cursor
    frame.set_cursor_position(Position::new(
        chunks[0].x + app.input.len() as u16 + 1,
        chunks[0].y + 1,
    ));
}

fn draw_marketplaces(frame: &mut Frame, app: &App, area: Rect) {
    if app.config.marketplaces.is_empty() {
        let empty = Paragraph::new("No marketplaces configured.\n\nPress 'a' to add a marketplace.")
            .style(Style::default().fg(Color::DarkGray))
            .block(Block::default().title("Marketplaces").borders(Borders::ALL));
        frame.render_widget(empty, area);
        return;
    }
    
    let items: Vec<ListItem> = app.config.marketplaces
        .iter()
        .enumerate()
        .map(|(i, m)| {
            let enabled_count = m.enabled.len();
            let text = format!("{} ({}) - {} skills enabled", m.name, m.source, enabled_count);
            
            let style = if i == app.selected_marketplace {
                Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(Color::White)
            };
            
            ListItem::new(text).style(style)
        })
        .collect();
    
    let list = List::new(items)
        .block(Block::default().title("Marketplaces").borders(Borders::ALL));
    
    frame.render_widget(list, area);
}

fn draw_add_marketplace(frame: &mut Frame, app: &App, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Min(0),
        ])
        .margin(2)
        .split(area);
    
    let input = Paragraph::new(app.input.as_str())
        .style(Style::default().fg(Color::Yellow))
        .block(Block::default()
            .title("Add Marketplace (owner/repo)")
            .borders(Borders::ALL));
    frame.render_widget(input, chunks[0]);
    
    let help = Paragraph::new("Examples:\n  anthropics/skills\n  vercel-labs/agent-skills")
        .style(Style::default().fg(Color::DarkGray));
    frame.render_widget(help, chunks[1]);
    
    frame.set_cursor_position(Position::new(
        chunks[0].x + app.input.len() as u16 + 1,
        chunks[0].y + 1,
    ));
}

fn draw_marketplace_skills(frame: &mut Frame, app: &App, area: Rect) {
    let marketplace_name = app.current_marketplace.as_deref().unwrap_or("Unknown");
    let marketplace = app.config.marketplaces.iter()
        .find(|m| Some(m.name.as_str()) == app.current_marketplace.as_deref());
    
    if app.marketplace_available_skills.is_empty() {
        let empty = Paragraph::new("No skills discovered yet.\n\nRun 'skills update' to fetch available skills.")
            .style(Style::default().fg(Color::DarkGray))
            .block(Block::default()
                .title(format!("Skills in {}", marketplace_name))
                .borders(Borders::ALL));
        frame.render_widget(empty, area);
        return;
    }
    
    let enabled: std::collections::HashSet<_> = marketplace
        .map(|m| m.enabled.iter().collect())
        .unwrap_or_default();
    
    let items: Vec<ListItem> = app.marketplace_available_skills
        .iter()
        .enumerate()
        .map(|(i, name)| {
            let is_enabled = enabled.contains(name);
            let checkbox = if is_enabled { "[x]" } else { "[ ]" };
            let text = format!("{} {}", checkbox, name);
            
            let style = if i == app.selected_marketplace_skill {
                Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)
            } else if is_enabled {
                Style::default().fg(Color::Green)
            } else {
                Style::default().fg(Color::White)
            };
            
            ListItem::new(text).style(style)
        })
        .collect();
    
    let list = List::new(items)
        .block(Block::default()
            .title(format!("Skills in {}", marketplace_name))
            .borders(Borders::ALL));
    
    frame.render_widget(list, area);
}
