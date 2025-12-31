# Contributing to nod-cli

Thank you for your interest in contributing to nod-cli! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions. We're all here to build something useful together.

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm (recommended) or npm

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/nod-cli.git
   cd nod-cli
   ```
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Build the CLI:
   ```bash
   pnpm run build
   ```
5. Link for local development:
   ```bash
   npm link
   ```

Now you can use `nod` commands with your local changes.

## Development Workflow

### Project Structure

```
nod-cli/
├── src/
│   ├── commands/        # CLI commands (init, add, transform, etc.)
│   ├── generators/      # Code generators for each feature
│   │   └── frameworks/  # Framework-specific generators
│   ├── helpers/         # Utility helpers
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   ├── validators/      # Project validators
│   └── cli.ts           # CLI entry point
├── website/             # Documentation website
└── scripts/             # Build and test scripts
```

### Making Changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Test your changes:
   ```bash
   # Build the CLI
   pnpm run build
   
   # Test by creating a new project
   nod init test-project --preset api --yes
   
   # Run the e2e tests
   node scripts/e2e-test.js
   ```

4. Commit your changes:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:
```
feat: add Redis cache support
fix: resolve TypeScript compilation error in route generator
docs: update installation instructions
refactor: simplify middleware generator logic
```

## Adding New Features

### Adding a New Generator

1. Create a new file in `src/generators/`:
   ```typescript
   // src/generators/your-feature.ts
   import type { ProjectOptions } from '../types/index.js'
   
   export function generateYourFeature(options: ProjectOptions): void {
     // Implementation
   }
   ```

2. Export from the generators index if needed

3. Integrate with the `add` command in `src/commands/add.ts`

4. Add documentation in `website/src/pages/docs/components/`

### Adding Framework Support

1. Create framework-specific generator in `src/generators/frameworks/`
2. Update the project generator to handle the new framework
3. Add appropriate templates and configurations

## Documentation

The documentation website is in the `website/` folder.

### Running the Docs Locally

```bash
cd website
pnpm install
pnpm run dev
```

### Adding Documentation Pages

1. Create a new page in `website/src/pages/docs/`
2. Add the route in `website/src/App.tsx`
3. Add the sidebar link in `website/src/components/DocsLayout.tsx`

## Submitting a Pull Request

1. Push your branch to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. Open a Pull Request against the `main` branch

3. Fill out the PR template with:
   - Description of changes
   - Related issues (if any)
   - Screenshots (for UI changes)
   - Testing done

4. Wait for review and address any feedback

## Reporting Issues

When reporting issues, please include:

- Node.js version (`node --version`)
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Error messages (if any)

## Questions?

Feel free to open an issue for questions or reach out via GitHub Discussions.

---

Thank you for contributing to nod-cli!
