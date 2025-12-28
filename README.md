# nod-cli

Backend scaffolding CLI for Node.js with best practices built-in. Generate production-ready Express or Hono projects with TypeScript, authentication, database connections, AI features, and more.

## Installation

```bash
npm install -g nod-cli
```

## Quick Start

```bash
# Create a new project (interactive)
nod init my-api

# Or use shorthand
nod my-api

# Non-interactive with preset
nod init my-api --preset 1 --framework express --yes

# Follow the interactive prompts to configure:
# - Preset (minimal, api, full, ai, 1, or custom presets)
# - Framework (Express/Hono)
# - TypeScript
# - Database (PostgreSQL/MySQL/Supabase/None)
# - ORM (Drizzle/Raw SQL)
# - Authentication (JWT/JWKS/Supabase/None)
# - AI features (RAG, Chat, Langfuse)
# - Deployment (Vercel cron, GitHub workflow)
# - Docker & PM2 configuration
```

## Presets

| Preset | Description |
|--------|-------------|
| `minimal` | Basic setup, no database or auth |
| `api` | Standard REST API with JWT auth |
| `full` | All features including Supabase, Drizzle, Vercel cron |
| `ai` | Full preset + RAG, Chat, Langfuse |
| `1` | Your stack - Supabase + Drizzle + Langfuse + API Audit + GitHub Actions |
| `custom` | Choose your own features |

### Custom Presets

Create and manage your own presets:

```bash
# List all presets
nod preset list

# Create a custom preset
nod preset create mystack

# Set default preset
nod preset default mystack

# Show preset details
nod preset show mystack

# Delete a custom preset
nod preset delete mystack
```

Custom presets are stored in `~/.nod-cli/presets.json` and can be used like built-in presets:

```bash
nod init my-api --preset mystack --yes
```

## Commands

### Initialize Project

```bash
nod init <project-name>
# or shorthand
nod <project-name>

# Options:
#   --framework <framework>  express or hono (default: express)
#   --ts                     Use TypeScript (default: true)
#   --no-ts                  Use JavaScript
#   --preset <preset>        Preset name
#   -y, --yes                Skip prompts, use defaults
```

### Add Components

Navigate to your project directory first:

```bash
cd my-api
```

Then add components:

```bash
# Add route with controller and service
nod add route users

# Add middleware
nod add middleware rateLimit

# Add service
nod add service email

# Add cron job support
nod add cron

# Add PM2 configuration
nod add pm2

# Add Vercel cron setup
nod add vercel-cron

# Add GitHub Actions workflow for Vercel deployment
nod add github-actions

# Add RAG service
nod add rag

# Add Chat service
nod add chat

# Add Supabase helper
nod add supabase

# Add Drizzle ORM
nod add drizzle

# Add Langfuse
nod add langfuse
```

### Transform Existing Project

Add nod features to an existing project:

```bash
nod transform
```

Select features to add:
- Environment Config (staging/production)
- Supabase Helper
- Drizzle ORM Setup
- Supabase JWT Auth Middleware
- Vercel Cron Setup
- GitHub Workflow
- RAG Service
- Chat Service
- Langfuse Integration
- Model/Source Selection Middleware
- Error Handler
- Winston Logger
- Response Formatter

### Manage Presets

```bash
nod preset list              # List all presets
nod preset create [name]     # Create a new preset
nod preset delete [name]     # Delete a custom preset
nod preset default [name]    # Set default preset
nod preset show <name>       # Show preset details
```

### Validate Project

```bash
nod validate
```

## Project Structure

Generated projects follow this structure:

```
my-api/
├── src/
│   ├── routes/          # Route definitions
│   ├── controllers/     # Request handlers
│   ├── services/        # Business logic
│   ├── middleware/      # Custom middleware
│   ├── config/          # App configuration
│   ├── helpers/         # Utilities
│   ├── utils/           # Utility modules
│   ├── db/              # Database connection & schema
│   ├── environments/    # Staging/production configs
│   └── cron/            # Cron jobs
├── sql/                 # SQL schema files
├── .env.example
├── package.json
├── tsconfig.json
├── drizzle.config.ts    # If using Drizzle
├── vercel.json          # If using Vercel cron
├── Dockerfile
├── docker-compose.yml
└── ecosystem.config.js
```

## Configuration Options

| Option | Choices | Description |
|--------|---------|-------------|
| Framework | Express, Hono | Web framework |
| TypeScript | Yes, No | Type safety |
| Database | PostgreSQL, MySQL, Supabase, None | Database driver |
| ORM | Drizzle, Raw SQL, None | ORM choice |
| Auth | JWT, JWKS, Supabase, None | Authentication method |
| Cron | Yes, No | Scheduled jobs support |
| Environments | Yes, No | Staging/production config |
| RAG | Yes, No | Vector search & retrieval |
| Chat | Yes, No | Conversation management |
| Langfuse | Yes, No | LLM observability |
| Vercel Cron | Yes, No | Vercel cron configuration |
| GitHub Workflow | Yes, No | CI/CD workflow |
| Docker | Yes, No | Container configuration |
| PM2 | Yes, No | Process manager config |

## Features

### Core
- **Declarative Routes** - Clean, configuration-based route definitions
- **Type Safety** - Full TypeScript support
- **PM2 Cluster Mode** - Thread-safe cron jobs with distributed locking
- **Docker Ready** - Dockerfile and docker-compose included
- **Zod Validation** - Runtime config validation

### Database
- **Supabase Integration** - Full Supabase client with storage helpers
- **Drizzle ORM** - Type-safe ORM with connection pooler support
- **Environment Config** - Separate staging/production configurations

### Authentication
- **Supabase JWT Auth** - JWKS-based JWT verification using jose library
- **Permission Middleware** - Role-based access control from JWT payload

### AI Features
- **RAG Service** - Vector similarity search with OpenAI embeddings
- **Chat Service** - Conversation management with LangChain
- **Langfuse** - LLM observability and tracing

### Deployment
- **Vercel Cron** - Cron job configuration with auth middleware
- **GitHub Workflow** - Deploy trigger workflow
- **Source Selection** - Domain-based routing

## Running Your Project

```bash
cd my-api
npm install
cp .env.example .env
# Edit .env with your settings
npm run dev
```

### Production

```bash
npm run build
pm2 start ecosystem.config.js
```

### Drizzle Commands

```bash
npm run db:generate  # Generate migrations
npm run db:push      # Push to database
npm run db:studio    # Open Drizzle Studio
```

## Changelog

### v0.3.0
- Added custom preset management (`nod preset` commands)
- Added default preset support
- Added `nod init` command (with `nod <name>` shorthand)
- Fixed Langchain dependency conflicts
- Fixed TypeScript compilation issues
- Improved non-interactive mode with `--yes` flag
- Added API audit logging feature
- Updated AI dependencies to compatible versions

### v0.2.0
- Initial release with Express/Hono support
- Supabase, Drizzle, Langfuse integrations
- Transform command for existing projects

## License

MIT
