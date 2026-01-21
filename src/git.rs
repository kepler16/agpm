//! Git operations for cloning repos and resolving SHAs

use anyhow::{Result, Context};
use git2::{FetchOptions, RemoteCallbacks, Cred};
use std::path::PathBuf;
use tempfile::TempDir;
use regex::Regex;

/// Parsed git source information
#[derive(Debug, Clone)]
pub struct GitSource {
    /// Full git URL
    pub url: String,
    /// Owner (for GitHub/GitLab shorthand)
    pub owner: Option<String>,
    /// Repo name
    pub repo: Option<String>,
    /// Branch or tag ref
    pub ref_: Option<String>,
    /// Subpath within repo
    pub subpath: Option<String>,
}

impl GitSource {
    /// Parse a source string into GitSource
    /// Supports:
    /// - owner/repo
    /// - owner/repo/subpath
    /// - https://github.com/owner/repo
    /// - https://github.com/owner/repo/tree/branch/subpath
    /// - git@github.com:owner/repo.git
    pub fn parse(input: &str) -> Result<Self> {
        // GitHub tree URL with path: github.com/owner/repo/tree/ref/path
        let github_tree_path = Regex::new(
            r"github\.com/([^/]+)/([^/]+)/tree/([^/]+)/(.+)"
        ).unwrap();
        if let Some(caps) = github_tree_path.captures(input) {
            return Ok(Self {
                url: format!("https://github.com/{}/{}.git", &caps[1], &caps[2]),
                owner: Some(caps[1].to_string()),
                repo: Some(caps[2].to_string()),
                ref_: Some(caps[3].to_string()),
                subpath: Some(caps[4].to_string()),
            });
        }

        // GitHub tree URL without path: github.com/owner/repo/tree/ref
        let github_tree = Regex::new(
            r"github\.com/([^/]+)/([^/]+)/tree/([^/]+)$"
        ).unwrap();
        if let Some(caps) = github_tree.captures(input) {
            return Ok(Self {
                url: format!("https://github.com/{}/{}.git", &caps[1], &caps[2]),
                owner: Some(caps[1].to_string()),
                repo: Some(caps[2].to_string()),
                ref_: Some(caps[3].to_string()),
                subpath: None,
            });
        }

        // GitHub repo URL: github.com/owner/repo
        let github_repo = Regex::new(
            r"github\.com/([^/]+)/([^/]+?)(?:\.git)?$"
        ).unwrap();
        if let Some(caps) = github_repo.captures(input) {
            return Ok(Self {
                url: format!("https://github.com/{}/{}.git", &caps[1], &caps[2]),
                owner: Some(caps[1].to_string()),
                repo: Some(caps[2].to_string()),
                ref_: None,
                subpath: None,
            });
        }

        // GitLab tree URL with path
        let gitlab_tree_path = Regex::new(
            r"gitlab\.com/([^/]+)/([^/]+)/-/tree/([^/]+)/(.+)"
        ).unwrap();
        if let Some(caps) = gitlab_tree_path.captures(input) {
            return Ok(Self {
                url: format!("https://gitlab.com/{}/{}.git", &caps[1], &caps[2]),
                owner: Some(caps[1].to_string()),
                repo: Some(caps[2].to_string()),
                ref_: Some(caps[3].to_string()),
                subpath: Some(caps[4].to_string()),
            });
        }

        // SSH URL: git@github.com:owner/repo.git
        let ssh_url = Regex::new(
            r"git@([^:]+):([^/]+)/([^/]+?)(?:\.git)?$"
        ).unwrap();
        if let Some(caps) = ssh_url.captures(input) {
            let host = &caps[1];
            return Ok(Self {
                url: format!("git@{}:{}/{}.git", host, &caps[2], &caps[3]),
                owner: Some(caps[2].to_string()),
                repo: Some(caps[3].to_string()),
                ref_: None,
                subpath: None,
            });
        }

        // Shorthand: owner/repo or owner/repo/subpath
        let shorthand = Regex::new(
            r"^([^/]+)/([^/]+)(?:/(.+))?$"
        ).unwrap();
        if let Some(caps) = shorthand.captures(input) {
            if !input.contains(':') && !input.starts_with('.') && !input.starts_with('/') {
                return Ok(Self {
                    url: format!("https://github.com/{}/{}.git", &caps[1], &caps[2]),
                    owner: Some(caps[1].to_string()),
                    repo: Some(caps[2].to_string()),
                    ref_: None,
                    subpath: caps.get(3).map(|m| m.as_str().to_string()),
                });
            }
        }

        // Assume it's a full git URL
        Ok(Self {
            url: input.to_string(),
            owner: None,
            repo: None,
            ref_: None,
            subpath: None,
        })
    }

    /// Get the canonical source identifier (owner/repo if available)
    pub fn canonical(&self) -> String {
        if let (Some(owner), Some(repo)) = (&self.owner, &self.repo) {
            format!("{}/{}", owner, repo)
        } else {
            self.url.clone()
        }
    }
}

/// A cloned repository with its temp directory
pub struct ClonedRepo {
    pub path: PathBuf,
    pub sha: String,
    _temp_dir: TempDir,
}

impl ClonedRepo {
    /// Clone a repository and return the cloned repo info
    pub fn clone(source: &GitSource) -> Result<Self> {
        let temp_dir = TempDir::new()
            .context("Failed to create temp directory")?;
        
        let mut callbacks = RemoteCallbacks::new();
        callbacks.credentials(|_url, username_from_url, _allowed_types| {
            // Try SSH agent first
            Cred::ssh_key_from_agent(username_from_url.unwrap_or("git"))
        });

        let mut fetch_opts = FetchOptions::new();
        fetch_opts.remote_callbacks(callbacks);
        fetch_opts.depth(1);

        let mut builder = git2::build::RepoBuilder::new();
        builder.fetch_options(fetch_opts);

        if let Some(ref_) = &source.ref_ {
            builder.branch(ref_);
        }

        let repo = builder.clone(&source.url, temp_dir.path())
            .context(format!("Failed to clone {}", source.url))?;

        let head = repo.head()
            .context("Failed to get HEAD")?;
        let sha = head.peel_to_commit()
            .context("Failed to get commit")?
            .id()
            .to_string();

        Ok(Self {
            path: temp_dir.path().to_path_buf(),
            sha,
            _temp_dir: temp_dir,
        })
    }

    /// Get path to a subpath within the repo
    #[allow(dead_code)]
    pub fn subpath(&self, subpath: Option<&str>) -> PathBuf {
        match subpath {
            Some(p) => self.path.join(p),
            None => self.path.clone(),
        }
    }
}

/// Resolve the latest SHA for a git source without cloning
pub async fn resolve_sha(source: &GitSource) -> Result<String> {
    // Use GitHub API for GitHub repos (faster than cloning)
    if let (Some(owner), Some(repo)) = (&source.owner, &source.repo) {
        if source.url.contains("github.com") {
            let ref_ = source.ref_.as_deref().unwrap_or("HEAD");
            let url = format!(
                "https://api.github.com/repos/{}/{}/commits/{}",
                owner, repo, ref_
            );
            
            let client = reqwest::Client::new();
            let resp = client.get(&url)
                .header("User-Agent", "skills-cli")
                .header("Accept", "application/vnd.github.v3+json")
                .send()
                .await
                .context("Failed to fetch commit info from GitHub")?;

            if resp.status().is_success() {
                let data: serde_json::Value = resp.json().await?;
                if let Some(sha) = data["sha"].as_str() {
                    return Ok(sha.to_string());
                }
            }
        }
    }

    // Fall back to cloning
    let cloned = ClonedRepo::clone(source)?;
    Ok(cloned.sha)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_shorthand() {
        let source = GitSource::parse("anthropics/skills").unwrap();
        assert_eq!(source.owner, Some("anthropics".to_string()));
        assert_eq!(source.repo, Some("skills".to_string()));
        assert_eq!(source.url, "https://github.com/anthropics/skills.git");
    }

    #[test]
    fn test_parse_shorthand_with_subpath() {
        let source = GitSource::parse("vercel-labs/agent-skills/skills/pdf").unwrap();
        assert_eq!(source.owner, Some("vercel-labs".to_string()));
        assert_eq!(source.repo, Some("agent-skills".to_string()));
        assert_eq!(source.subpath, Some("skills/pdf".to_string()));
    }

    #[test]
    fn test_parse_github_url() {
        let source = GitSource::parse("https://github.com/anthropics/skills").unwrap();
        assert_eq!(source.owner, Some("anthropics".to_string()));
        assert_eq!(source.repo, Some("skills".to_string()));
    }

    #[test]
    fn test_parse_github_tree_url() {
        let source = GitSource::parse(
            "https://github.com/vercel-labs/agent-skills/tree/main/skills/pdf"
        ).unwrap();
        assert_eq!(source.owner, Some("vercel-labs".to_string()));
        assert_eq!(source.repo, Some("agent-skills".to_string()));
        assert_eq!(source.ref_, Some("main".to_string()));
        assert_eq!(source.subpath, Some("skills/pdf".to_string()));
    }
}
