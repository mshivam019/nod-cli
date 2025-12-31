# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2025-12-31

### Added
- Documentation website deployed to GitHub Pages
- Individual component documentation pages (Route, Middleware, Service, Supabase, Drizzle, RAG, Chat, Langfuse, PM2, Vercel Cron, GitHub Actions, Cron)
- JS/TS code toggle in documentation code blocks

### Changed
- Migrated package manager from npm to pnpm for faster CI builds
- Updated repository URLs to mshivam019/nod-cli

## [0.3.0] - 2025-12-30

### Added
- Custom presets support with `nod preset` commands
- Preset management: create, delete, list, show, default
- Custom presets stored in `~/.nod-cli/presets.json`
- Non-interactive mode with `--yes` flag for CI/CD pipelines
- CI environment detection (auto non-interactive when `CI=true`)

### Changed
- Improved preset system with built-in presets: minimal, api, full, ai, 1

## [0.2.0] - 2025-12-25

### Added
- Hono framework support alongside Express
- JavaScript project generation with `--no-ts` flag
- Drizzle ORM integration
- Supabase authentication with JWKS
- RAG service with OpenAI embeddings
- Chat service with LangChain
- Langfuse observability integration
- Vercel cron configuration
- GitHub Actions workflow generation
- PM2 cluster mode with distributed locking
- Docker and docker-compose configuration
- `docs/` folder for project documentation
- `temp/` folder (git-ignored) for generated files

### Changed
- Improved project structure with helpers and utils separation
- Enhanced route builder with declarative configuration

## [0.1.0] - 2025-12-20

### Added
- Initial release
- `nod init` command for project scaffolding
- `nod add` command for adding components
- `nod transform` command for existing projects
- `nod validate` command for project validation
- Express framework support
- TypeScript support
- PostgreSQL and MySQL database drivers
- JWT authentication
- Basic middleware generation
- Route and service generators
