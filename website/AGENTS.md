# AGPM Website

Next.js 15 website for AGPM (Agent Package Manager) at https://agpm.dev.

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **UI**: shadcn/ui + Tailwind CSS 4
- **Content**: MDX for documentation
- **Optimization**: React Compiler enabled

## Development

```bash
cd website
pnpm dev
```

## Structure

```
website/
├── app/
│   ├── page.tsx              # Landing page
│   ├── layout.tsx            # Root layout with theme provider
│   ├── docs/                 # Documentation pages (MDX)
│   │   ├── getting-started/
│   │   ├── commands/
│   │   ├── configuration/
│   │   └── concepts/
│   └── schemas/              # API routes serving JSON schemas
│       ├── agpm.json/
│       └── agpm-lock.json/
├── components/
│   ├── ui/                   # shadcn/ui components
│   ├── layout/               # Header, Footer, ThemeToggle
│   ├── landing/              # Hero, Features, QuickStart, etc.
│   └── docs/                 # Sidebar, MDX components
└── mdx-components.tsx        # Custom MDX component styling
```

## Key Features

- **Landing Page**: Hero, features, quick start guide, how it works
- **Documentation**: MDX-based docs with sidebar navigation
- **Schema Hosting**: JSON schemas served at `/schemas/agpm.json` and `/schemas/agpm-lock.json`
- **Dark Mode**: System preference with manual toggle
- **Responsive**: Mobile-friendly with collapsible navigation

## Adding Documentation

Add new MDX files in `app/docs/`:

```mdx
# Page Title

Content here...
```

Update the sidebar navigation in `components/docs/sidebar.tsx` to include new pages.
