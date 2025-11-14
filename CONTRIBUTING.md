# Contributing to AppSheet TypeScript Library

Thank you for contributing! This document provides guidelines for contributing to this project.

## Table of Contents

- [Git-Flow Branch Strategy](#git-flow-branch-strategy)
- [Semantic Versioning](#semantic-versioning)
- [Development Workflow](#development-workflow)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)

## Git-Flow Branch Strategy

**KRITISCH:** Dieses Projekt folgt einer klassischen Git-Flow Strategie mit drei Branches:

```
develop  → CI only (keine Deployments)
staging  → Staging Deployment (Pre-Production)
main     → Production Deployment
```

### Branch → Environment Mapping

| Branch    | Environment     | Deployment | CI | Purpose |
|-----------|----------------|------------|-----|---------|
| `develop` | None (CI only) | ❌ Nein | ✅ Ja | Development branch für Feature-Integration |
| `staging` | Staging        | ✅ Auto | ✅ Ja | Pre-Production Testing & Validation |
| `main`    | Production     | ✅ Auto | ✅ Ja | Production-Ready Releases |

### Workflow

```
feature/xxx → develop → staging → main
   ↑            ↑          ↑        ↑
   │            │          │        │
Feature    Integration  Testing  Production
Branch       (CI)      (Deploy)  (Deploy)
```

### Branch Purposes

#### `develop` - Development Branch
- **Purpose**: Integration branch for all features
- **CI**: ✅ Runs tests, linting, and build
- **Deployment**: ❌ No automatic deployment
- **Protected**: Yes (requires PR and CI to pass)
- **Merges from**: `feature/*`, `bugfix/*`, `hotfix/*` branches
- **Merges to**: `staging`

**Usage:**
```bash
# Create feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/new-feature

# Work on feature, commit, push
git push origin feature/new-feature

# Create PR to develop
# After PR merge, feature is in develop
```

#### `staging` - Pre-Production Branch
- **Purpose**: Pre-production testing and validation
- **CI**: ✅ Runs tests, linting, and build
- **Deployment**: ✅ Auto-deploys to Staging environment
- **Protected**: Yes (requires PR from develop and CI to pass)
- **Merges from**: `develop` only
- **Merges to**: `main`

**Usage:**
```bash
# Promote develop to staging
git checkout staging
git pull origin staging
git merge develop
git push origin staging

# Or create PR: develop → staging
```

#### `main` - Production Branch
- **Purpose**: Production-ready releases
- **CI**: ✅ Runs tests, linting, and build
- **Deployment**: ✅ Auto-deploys to Production environment
- **Protected**: Yes (requires PR from staging and CI to pass)
- **Merges from**: `staging` only (or `hotfix/*` in emergencies)
- **Merges to**: None (or back to `develop` via hotfix)

**Usage:**
```bash
# Promote staging to production
git checkout main
git pull origin main
git merge staging
git push origin main

# Or create PR: staging → main
```

### Feature Development Workflow

```bash
# 1. Create feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/add-new-api

# 2. Develop feature
git add .
git commit -m "feat: add new API endpoint"

# 3. Push and create PR to develop
git push origin feature/add-new-api
# Create PR: feature/add-new-api → develop

# 4. After PR merge → develop
# Feature is now in develop (CI runs)

# 5. Promote to staging
git checkout staging
git merge develop
git push origin staging
# Or create PR: develop → staging
# Staging deployment runs automatically

# 6. Test in staging environment
# Validate features work correctly

# 7. Promote to production
git checkout main
git merge staging
git push origin main
# Or create PR: staging → main
# Production deployment runs automatically
```

### Hotfix Workflow

For critical production bugs:

```bash
# 1. Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug

# 2. Fix bug
git add .
git commit -m "fix: resolve critical production bug"

# 3. Push and create PR to main
git push origin hotfix/critical-bug
# Create PR: hotfix/critical-bug → main

# 4. After merge → main
# Production deployment runs

# 5. Merge back to develop
git checkout develop
git merge main
git push origin develop
```

### Branch Protection Rules

Configure these in GitHub repository settings:

#### `develop` Branch Protection
- ✅ Require pull request reviews (1 approver)
- ✅ Require status checks to pass (CI)
- ✅ Require branches to be up to date
- ✅ Include administrators
- ❌ No deployment (CI only)

#### `staging` Branch Protection
- ✅ Require pull request reviews (1 approver)
- ✅ Require status checks to pass (CI)
- ✅ Require branches to be up to date
- ✅ Only allow merges from `develop`
- ✅ Include administrators
- ✅ Auto-deploy to staging

#### `main` Branch Protection
- ✅ Require pull request reviews (2 approvers)
- ✅ Require status checks to pass (CI)
- ✅ Require branches to be up to date
- ✅ Only allow merges from `staging` or `hotfix/*`
- ✅ Include administrators
- ✅ Auto-deploy to production

### Common Scenarios

#### Scenario 1: New Feature Development
```bash
feature/new-feature → develop → staging → main
```

#### Scenario 2: Bug Fix in Development
```bash
bugfix/fix-issue → develop → staging → main
```

#### Scenario 3: Hotfix in Production
```bash
hotfix/critical-fix → main → develop
```

#### Scenario 4: Testing in Staging
```bash
# Multiple features in develop
feature/a → develop ─┐
feature/b → develop ─┼→ staging (test all together)
feature/c → develop ─┘
```

## Semantic Versioning

This project follows [Semantic Versioning 2.0.0](https://semver.org/).

Given a version number `MAJOR.MINOR.PATCH`, increment the:

- **MAJOR** version when you make incompatible API changes
- **MINOR** version when you add functionality in a backward compatible manner
- **PATCH** version when you make backward compatible bug fixes

### Version Format

```
MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
```

**Examples:**
- `1.0.0` - First stable release
- `1.1.0` - Added new features (backward compatible)
- `1.1.1` - Bug fix release
- `2.0.0` - Breaking changes
- `1.2.0-beta.1` - Pre-release version
- `1.2.0+20130313144700` - Build metadata

### Breaking Changes (MAJOR)

Changes that require users to modify their code:

- Removing or renaming public APIs
- Changing function signatures
- Changing return types
- Removing configuration options
- Changing required dependencies

**Example:**
```typescript
// Before (v1.x.x)
client.findAll('Users')

// After (v2.0.0) - Breaking change
client.find({ tableName: 'Users', selector: 'ALL' })
```

### New Features (MINOR)

Backward compatible additions:

- Adding new public methods
- Adding new optional parameters
- Adding new configuration options
- Adding new exports

**Example:**
```typescript
// v1.1.0 - Added new method (backward compatible)
client.findOne('Users', '[Email] = "john@example.com"')
```

### Bug Fixes (PATCH)

Backward compatible bug fixes:

- Fixing incorrect behavior
- Performance improvements
- Documentation updates
- Internal refactoring

**Example:**
```typescript
// v1.1.1 - Fixed selector parsing bug
```

## Development Workflow

### 1. Clone and Setup

```bash
git clone git@github.com:techdivision/appsheet.git
cd appsheet
npm install
```

### 2. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 3. Make Changes

- Write code
- Add tests
- Update documentation
- Run linter: `npm run lint:fix`
- Run tests: `npm test`
- Build: `npm run build`

### 4. Commit Changes

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: add new feature"
git commit -m "fix: resolve bug"
git commit -m "docs: update README"
git commit -m "chore: update dependencies"
```

## Commit Message Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) to automatically generate changelogs and determine version bumps.

### Format

```
<type>[(optional scope)]: <description>

[optional body]

[optional footer(s)]
```

### Types

- **feat**: A new feature (MINOR version bump)
- **fix**: A bug fix (PATCH version bump)
- **docs**: Documentation only changes
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code refactoring without changing functionality
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Build process or auxiliary tool changes
- **ci**: CI/CD configuration changes

### Breaking Changes

Add `BREAKING CHANGE:` in the footer or `!` after the type:

```bash
git commit -m "feat!: change API signature"
# or
git commit -m "feat: change API signature

BREAKING CHANGE: The findAll method now requires options object"
```

### Examples

```bash
# New feature (MINOR bump)
git commit -m "feat: add runAsUserEmail configuration"

# Bug fix (PATCH bump)
git commit -m "fix: correct selector parsing for date fields"

# Breaking change (MAJOR bump)
git commit -m "feat!: redesign client interface

BREAKING CHANGE: Client methods now return promises with typed responses"

# Documentation
git commit -m "docs: add JSDoc comments to AppSheetClient"

# Chore
git commit -m "chore: update TypeScript to v5.3"
```

## Pull Request Process

1. **Update documentation** if you changed APIs
2. **Add tests** for new features
3. **Update CHANGELOG.md** with your changes (if significant)
4. **Ensure CI passes** (lint, build, tests)
5. **Request review** from maintainers
6. **Squash commits** if requested

### PR Title Format

Use conventional commit format for PR titles:

```
feat: add new feature
fix: resolve bug
docs: update documentation
```

## Release Process

### Manual Release

For maintainers with publish rights:

```bash
# 1. Ensure clean working directory
git status

# 2. Run tests
npm test

# 3. Update version (npm will run build automatically via prepare script)
npm version patch    # For bug fixes (1.0.0 -> 1.0.1)
npm version minor    # For new features (1.0.0 -> 1.1.0)
npm version major    # For breaking changes (1.0.0 -> 2.0.0)

# 4. Push changes and tags
git push --follow-tags

# 5. Publish to npm (if configured)
npm publish --access public
```

### Pre-release Versions

For beta/alpha releases:

```bash
# Create pre-release
npm version prerelease --preid=beta  # 1.0.0 -> 1.0.1-beta.0
npm version prerelease --preid=alpha # 1.0.0 -> 1.0.1-alpha.0

# Publish pre-release to npm
npm publish --tag beta
```

### Automated Release (via GitHub Actions)

When a tag is pushed, GitHub Actions automatically:
1. Runs tests
2. Builds the package
3. Creates a GitHub Release
4. Publishes to npm (if configured)

```bash
# Create and push tag manually
git tag v1.0.0
git push origin v1.0.0

# Or use npm version (automatically creates tag)
npm version minor
git push --follow-tags
```

## Version History

### Pre-1.0.0 (Development Phase)

During the `0.x.x` phase:
- Breaking changes are allowed in MINOR versions
- API is not considered stable
- Use `0.x.x` for initial development

### 1.0.0 (Stable Release)

Once the API is stable and production-ready:
- Release `1.0.0`
- Follow strict semantic versioning
- Breaking changes require MAJOR version bump

## Questions?

If you have questions about versioning or contributions, please:
- Open an issue on GitHub
- Contact the maintainers

Thank you for contributing! 🚀
