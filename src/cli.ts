#!/usr/bin/env node
import { Command } from "commander";
import { initProject } from "./commands/init.js";
import { addComponent } from "./commands/add.js";
import { validateCommand } from "./commands/validate.js";
import { transformProject } from "./commands/transform.js";
import { presetCommand } from "./commands/preset.js";
import { mcpCommand } from "./commands/mcp.js";

const program = new Command();

program
  .name("nod-cli")
  .description("Backend scaffolding CLI with best practices built-in")
  .version("0.4.5");

// Define the init command with all options
const initCommand = program
  .command("init [name]")
  .description("Initialize a new project")
  .option("--framework <framework>", "Framework: express or hono")
  .option("--ts", "Use TypeScript (default: true)")
  .option("--no-ts", "Use JavaScript")
  .option(
    "--db <database>",
    "Database: pg, mysql, supabase, drizzle, or none",
  )
  .option("--auth <auth>", "Auth: jwt, jwks, supabase, cookie-session, or none")
  .option("--queue <queue>", "Queue: bull or none")
  .option(
    "--preset <preset>",
    "Preset: minimal, api, full, ai, production-api, 1, or custom preset name",
  )
  .option("--security <mode>", "Security mode: basic or strict")
  .option("--deploy-target <target>", "Deploy target: node or lambda-sam")
  .option("-y, --yes", "Skip prompts and use defaults/provided options")
  .action(initProject);

program
  .command("add <component>")
  .description(
    "Add a component: route, middleware, service, controller, cron, pm2, rag, chat, vercel-cron, github-actions, supabase, drizzle, langfuse",
  )
  .option(
    "-n, --name <name>",
    "Component name (for route/middleware/service/controller)",
  )
  .option("-y, --yes", "Run non-interactively with defaults/provided options")
  .option(
    "--lock-backend <backend>",
    "Cron lock backend: pg, mysql, redis, supabase, or file",
  )
  .option(
    "--embedding-provider <provider>",
    "RAG embedding provider: openai, gemini, or cohere",
  )
  .option(
    "--vector-store <store>",
    "RAG vector store: supabase, pinecone, chroma, or weaviate",
  )
  .option(
    "--llm-provider <provider>",
    "Chat LLM provider: openai, anthropic, or gemini",
  )
  .option("--chat-database <database>", "Chat DB: supabase, pg, or mysql")
  .option(
    "--langfuse <boolean>",
    "Enable langfuse for chat feature (true|false)",
  )
  .option(
    "--generate-routes <boolean>",
    "Generate routes/controllers where applicable (true|false)",
  )
  .option(
    "--supabase-auth <boolean>",
    "Include Supabase JWT auth middleware (true|false)",
  )
  .option(
    "--auth-mode <mode>",
    "Auth mode: both, email-password, or oauth-only",
  )
  .option(
    "--supabase-admin <boolean>",
    "Include Supabase admin auth (true|false)",
  )
  .option("--custom-jwt <boolean>", "Include custom JWT signing (true|false)")
  .option("--jwks <boolean>", "Include JWKS generation (true|false)")
  .option(
    "--forgot-password <boolean>",
    "Include forgot password flow (true|false)",
  )
  .option("--google-oauth <boolean>", "Include Google OAuth flow (true|false)")
  .option(
    "--email-service <boolean>",
    "Include email service for auth flows (true|false)",
  )
  .option(
    "--method <method>",
    "Route method for `add route`: get, post, put, delete, or patch",
  )
  .option("--path <path>", "Route path for `add route`")
  .option(
    "--create-controller <boolean>",
    "Create controller for `add route` (true|false)",
  )
  .option(
    "--create-service <boolean>",
    "Create service for `add route` (true|false)",
  )
  .option("--middleware <list>", "Comma-separated middleware for `add route`")
  .action(addComponent);

program
  .command("transform")
  .description("Transform existing project with nod features")
  .option(
    "-f, --features <features>",
    "Comma-separated feature list (e.g. drizzle,github,migrateRoutes)",
  )
  .option("--all", "Enable all available transform features")
  .option("-y, --yes", "Run non-interactively with defaults/provided options")
  .option(
    "--rag-embedding <provider>",
    "RAG embedding provider: openai, gemini, or cohere",
  )
  .option(
    "--rag-vector-store <store>",
    "RAG vector store: supabase, pinecone, chroma, or weaviate",
  )
  .option(
    "--rag-generate-routes <boolean>",
    "Generate RAG routes/controller (true|false)",
  )
  .option(
    "--chat-llm-provider <provider>",
    "Chat LLM provider: openai, anthropic, or gemini",
  )
  .option("--chat-database <database>", "Chat DB: supabase, pg, or mysql")
  .option(
    "--chat-langfuse <boolean>",
    "Enable chat langfuse integration (true|false)",
  )
  .option(
    "--chat-generate-routes <boolean>",
    "Generate Chat routes/controller (true|false)",
  )
  .action(transformProject);

program
  .command("validate")
  .description("Validate project structure and dependencies")
  .action(validateCommand);

program
  .command("preset [action] [name]")
  .description("Manage presets: list, create, delete, default, show")
  .action(presetCommand);

program
  .command("mcp")
  .description("Run built-in MCP server over stdio")
  .option("--name <name>", "Server name shown to MCP clients", "nod-cli")
  .action(mcpCommand);

// Handle shorthand: `nod myproject` -> `nod init myproject`
// Check if the first argument is not a known command
const knownCommands = [
  "init",
  "add",
  "transform",
  "validate",
  "preset",
  "mcp",
  "help",
  "-h",
  "--help",
  "-V",
  "--version",
];
const args = process.argv.slice(2);

if (
  args.length > 0 &&
  !knownCommands.includes(args[0]) &&
  !args[0].startsWith("-")
) {
  // Insert 'init' as the first argument
  process.argv.splice(2, 0, "init");
}

program.parse();
