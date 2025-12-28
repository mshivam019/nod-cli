import * as fs from 'fs-extra';
import * as path from 'path';

export interface GithubWorkflowConfig {
  branches?: string[];
  deployTrigger?: boolean;
  testOnPR?: boolean;
}

export async function generateGithubWorkflow(projectPath: string, config: GithubWorkflowConfig = {}) {
  const branches = config.branches || ['staging', 'main'];
  
  await fs.ensureDir(path.join(projectPath, '.github/workflows'));

  if (config.deployTrigger !== false) {
    const deployWorkflow = `name: Deploy Trigger

on:
  push:
    branches:
${branches.map(b => `      - ${b}`).join('\n')}

jobs:
  deploy-commit:
    if: contains(github.event.head_commit.message, '--deploy')
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          token: \${{ secrets.REPO_SECRET }}

      - name: Configure Git identity
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"

      - name: Append to dummy.txt
        run: |
          echo "." >> dummy.txt
          git add dummy.txt
          git commit -m "chore: dummy deploy commit [trigger cd]" || echo "No changes to commit"
          git push origin HEAD:\${GITHUB_REF##*/}
`;

    await fs.outputFile(
      path.join(projectPath, '.github/workflows/deploy.yml'),
      deployWorkflow
    );
  }

  if (config.testOnPR) {
    const testWorkflow = `name: Test

on:
  pull_request:
    branches:
${branches.map(b => `      - ${b}`).join('\n')}

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run tests
        run: npm test
`;

    await fs.outputFile(
      path.join(projectPath, '.github/workflows/test.yml'),
      testWorkflow
    );
  }

  // Create dummy.txt for deploy trigger
  await fs.outputFile(path.join(projectPath, 'dummy.txt'), '');
}
