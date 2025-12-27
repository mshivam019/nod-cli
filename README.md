# nod-cli

Backend scaffolding CLI for Node.js with best practices built-in. Generate production-ready Express or Hono projects with TypeScript, authentication, database connections, and more.

## Installation

```bash
npm install -g nod-cli
```

## Quick Start

```bash
# Create a new project
nod my-api

# Follow the interactive prompts to configure:
# - Framework (Express/Hono)
# - TypeScript
# - Database (PostgreSQL/MySQL/None)
# - Authentication (JWT/JWKS/None)
# - Cron jobs
# - Docker & PM2 configuration
```

## Commands

### Create Project

```bash
nod <project-name>
```

Interactive prompts will guide you through configuration options.

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
│   ├── middlewares/     # Custom middleware
│   ├── config/          # App configuration
│   ├── helpers/         # Utilities
│   ├── db/              # Database connection
│   └── cron/            # Cron jobs (if enabled)
├── .env.example
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
└── ecosystem.config.js
```

## Configuration Options

| Option | Choices | Description |
|--------|---------|-------------|
| Framework | Express, Hono | Web framework |
| TypeScript | Yes, No | Type safety |
| Database | PostgreSQL, MySQL, None | Database driver |
| Auth | JWT, JWKS, None | Authentication method |
| Cron | Yes, No | Scheduled jobs support |
| Docker | Yes, No | Container configuration |
| PM2 | Yes, No | Process manager config |

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

## Features

- **Declarative Routes** - Clean, configuration-based route definitions
- **Type Safety** - Full TypeScript support
- **PM2 Cluster Mode** - Thread-safe cron jobs with distributed locking
- **Flexible Database** - Use any DB or external services like Supabase
- **Docker Ready** - Dockerfile and docker-compose included
- **Zod Validation** - Runtime config validation

## License

MIT
