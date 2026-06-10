import fs from 'fs-extra';
import * as path from 'path';
import { ProjectConfig } from '../types/index.js';

interface TransformGuideContext {
  framework: 'express' | 'hono';
  ext: 'ts' | 'js';
  selectedFeatures: string[];
}

interface AgentsGuideContext {
  mode: 'init' | 'transform';
  config?: ProjectConfig;
  transform?: TransformGuideContext;
}

function getProjectTablePrefix(projectName: string): string {
  const [firstSegment] = projectName.split('-');
  return firstSegment || projectName;
}

const KNOWN_DIRS: Array<{ path: string; purpose: string }> = [
  { path: 'src/routes', purpose: 'HTTP routes and endpoint wiring' },
  { path: 'src/controllers', purpose: 'Request orchestration and response shaping' },
  { path: 'src/services', purpose: 'Business logic and external integrations' },
  { path: 'src/middleware', purpose: 'Cross-cutting request/response middleware' },
  { path: 'src/helpers', purpose: 'Reusable helper functions and response wrappers' },
  { path: 'src/config', purpose: 'App and runtime configuration' },
  { path: 'src/db', purpose: 'Database clients and schema files' },
  { path: 'src/auth', purpose: 'Authentication services and providers' },
  { path: 'src/cron', purpose: 'Scheduled jobs and cron bootstrap' },
  { path: 'src/environments', purpose: 'Environment-specific config presets' },
  { path: 'src/utils', purpose: 'Utility modules (logger, constants, mappers)' },
  { path: 'docs', purpose: 'Project documentation and runbooks' },
  { path: 'temp', purpose: 'Temporary outputs (ignored by git)' }
];

async function detectExistingDirs(projectPath: string): Promise<Array<{ path: string; purpose: string }>> {
  const detected: Array<{ path: string; purpose: string }> = [];

  for (const entry of KNOWN_DIRS) {
    if (await fs.pathExists(path.join(projectPath, entry.path))) {
      detected.push(entry);
    }
  }

  return detected;
}

function buildAgentRules(context: AgentsGuideContext): string {
  if (context.mode === 'init' && context.config) {
    const cfg = context.config;
    return `- Keep controllers lean; move domain logic to \`src/services\`.
- Prefer adding new endpoints in \`src/routes\` and matching handler in \`src/controllers\`.
- Add any shared helpers to \`src/helpers\` instead of duplicating code.
- Respect generated stack defaults (framework: \`${cfg.framework}\`, language: \`${cfg.typescript ? 'ts' : 'js'}\`).
- Use Prettier with 4-space indentation (\`.prettierrc.json\` with \`tabWidth: 4\`, \`useTabs: false\`).
- Run \`pnpm lint\` and \`pnpm build\` after code changes.
- Run \`pnpm db:generate\` when schema or Drizzle config changes.
- Keep Drizzle migrations in \`drizzle/\` tracked in git; do not add \`drizzle/\` to \`.gitignore\`.
- Drizzle should only manage project tables prefixed with \`${getProjectTablePrefix(cfg.name)}_\`.
- \`npm test\` may not be configured; check scripts before assuming tests exist.`;
  }

  const transform = context.transform!;
  return `- Preserve current project conventions while applying transformed features.
- If declarative routing is enabled, keep route definitions in \`METHODS.*\` format.
- Prefer incremental changes: patch existing files before introducing parallel patterns.
- Respect detected stack (framework: \`${transform.framework}\`, language: \`${transform.ext}\`).`;
}

export async function generateAgentsGuide(projectPath: string, context: AgentsGuideContext) {
  const dirs = await detectExistingDirs(projectPath);

  const dirLines = dirs.length > 0
    ? dirs.map((entry) => `- \`${entry.path}\`: ${entry.purpose}`)
    : ['- No standard source folders detected yet.'];

  const content = `# AGENTS.md

This file helps human and AI contributors make consistent changes in this project.

## Source Map

${dirLines.join('\n')}

## Working Rules For Agents

${buildAgentRules(context)}

## Non-Interactive CLI Usage

- Initialize project without prompts: \`nod init <name> --preset <preset> --framework <express|hono> --ts --yes\`
- Transform existing project without prompts: \`nod transform --features environments,drizzle,github --yes\`
- Add component directly: \`nod add <route|middleware|service> --name <name>\`

## Notes

- Keep this file updated whenever generated project structure or conventions change.
`;

  await fs.outputFile(path.join(projectPath, 'AGENTS.md'), content);
}
