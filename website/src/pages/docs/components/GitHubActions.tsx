import { CodeBlock } from '@/components/CodeBlock'

export function GitHubActionsComponent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">GitHub Actions</h1>
        <p className="text-lg text-muted-foreground mt-2">
          CI/CD workflow for automated Vercel deployments.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Installation
        </h2>
        <CodeBlock code={`nod add github-actions`} language="bash" />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Generated Files
        </h2>
        
        <h3 className="font-semibold mt-4">Deploy Workflow (.github/workflows/deploy.yml)</h3>
        <CodeBlock
          code={`name: Deploy to Vercel

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  check-deploy:
    runs-on: ubuntu-latest
    outputs:
      should_deploy: \${{ steps.check.outputs.deploy }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - name: Check for deploy flag
        id: check
        run: |
          COMMIT_MSG=$(git log -1 --pretty=%B)
          if [[ "$COMMIT_MSG" == *"--deploy"* ]]; then
            echo "deploy=true" >> $GITHUB_OUTPUT
          else
            echo "deploy=false" >> $GITHUB_OUTPUT
          fi

  deploy:
    needs: check-deploy
    if: needs.check-deploy.outputs.should_deploy == 'true'
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Vercel Deploy
        run: |
          curl -X POST \\
            -H "Authorization: Bearer \${{ secrets.VERCEL_TOKEN }}" \\
            -H "Content-Type: application/json" \\
            -d '{"name":"my-api","gitSource":{"type":"github","ref":"main","repoId":"'"\${{ github.repository_id }}"'"}}' \\
            "https://api.vercel.com/v13/deployments"

      - name: Notify on success
        if: success()
        run: echo "Deployment triggered successfully!"

      - name: Notify on failure
        if: failure()
        run: echo "Deployment failed!"`}
          language="yaml"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Setup
        </h2>
        <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
          <li>Go to your repository Settings → Secrets and variables → Actions</li>
          <li>Add a new repository secret named <code className="bg-muted px-1 rounded">VERCEL_TOKEN</code></li>
          <li>Get your Vercel token from <a href="https://vercel.com/account/tokens" className="text-primary underline" target="_blank" rel="noopener noreferrer">vercel.com/account/tokens</a></li>
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Usage
        </h2>
        <p>Trigger a deployment by including <code className="bg-muted px-1 rounded">--deploy</code> in your commit message:</p>
        <CodeBlock
          code={`# This will NOT trigger deployment
git commit -m "fix: update user validation"

# This WILL trigger deployment
git commit -m "feat: add new API endpoint --deploy"

# Manual trigger from GitHub Actions tab
# Go to Actions → Deploy to Vercel → Run workflow`}
          language="bash"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Alternative: Full CI/CD Workflow
        </h2>
        <p>For a more complete workflow with testing and linting:</p>
        <CodeBlock
          code={`name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm run lint
      - run: pnpm run build
      - run: pnpm test

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: \${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: \${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: \${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'`}
          language="yaml"
        />
      </section>
    </div>
  )
}
