# Branch Protection Configuration

Configure these settings in **GitHub Repository Settings → Branches → Branch protection rules**.

## `develop` Branch Protection

1. Go to: Settings → Branches → Add rule
2. Branch name pattern: `develop`
3. Configure:

```
✅ Require a pull request before merging
   ✅ Require approvals: 1
   ✅ Dismiss stale pull request approvals when new commits are pushed
   ✅ Require approval of the most recent reviewable push

✅ Require status checks to pass before merging
   ✅ Require branches to be up to date before merging
   Status checks:
   - test (Node.js 18.x)
   - test (Node.js 20.x)
   - test (Node.js 22.x)
   - coverage

✅ Require conversation resolution before merging

✅ Include administrators

❌ Allow force pushes (disabled)
❌ Allow deletions (disabled)
```

**Deployment:** ❌ No automatic deployment (CI only)

---

## `staging` Branch Protection

1. Go to: Settings → Branches → Add rule
2. Branch name pattern: `staging`
3. Configure:

```
✅ Require a pull request before merging
   ✅ Require approvals: 1
   ✅ Dismiss stale pull request approvals when new commits are pushed
   ✅ Require approval of the most recent reviewable push

✅ Require status checks to pass before merging
   ✅ Require branches to be up to date before merging
   Status checks:
   - test (Node.js 18.x)
   - test (Node.js 20.x)
   - test (Node.js 22.x)
   - coverage

✅ Require conversation resolution before merging

✅ Restrict who can push to matching branches (optional)
   Allowed: develop branch only

✅ Include administrators

❌ Allow force pushes (disabled)
❌ Allow deletions (disabled)
```

**Deployment:** ✅ Auto-deploy to Staging environment

---

## `main` Branch Protection

1. Go to: Settings → Branches → Add rule
2. Branch name pattern: `main`
3. Configure:

```
✅ Require a pull request before merging
   ✅ Require approvals: 2 (WICHTIG: 2 Approver!)
   ✅ Dismiss stale pull request approvals when new commits are pushed
   ✅ Require approval of the most recent reviewable push
   ✅ Require review from Code Owners (optional)

✅ Require status checks to pass before merging
   ✅ Require branches to be up to date before merging
   Status checks:
   - test (Node.js 18.x)
   - test (Node.js 20.x)
   - test (Node.js 22.x)
   - coverage

✅ Require conversation resolution before merging

✅ Require deployments to succeed before merging
   Required deployment environments:
   - staging

✅ Restrict who can push to matching branches (optional)
   Allowed: staging branch, hotfix/* branches

✅ Include administrators

❌ Allow force pushes (disabled)
❌ Allow deletions (disabled)
```

**Deployment:** ✅ Auto-deploy to Production environment

---

## Environment Configuration

Configure these in **Settings → Environments**:

### Staging Environment

```
Name: staging
Protection rules:
  ✅ Required reviewers: 1
  ✅ Wait timer: 0 minutes

Environment secrets:
  - STAGING_TOKEN (if needed)
```

### Production Environment

```
Name: production
Protection rules:
  ✅ Required reviewers: 2
  ✅ Wait timer: 5 minutes (optional safety delay)

Environment secrets:
  - NPM_TOKEN (for npm publishing)
  - PRODUCTION_TOKEN (if needed)
```

---

## CODEOWNERS File (Optional)

Create `.github/CODEOWNERS` to automatically request reviews:

```
# Default owners for everything
*       @team-lead @senior-dev

# Specific files
/.github/       @devops-team
/docs/          @documentation-team
```

---

## Verification

After configuring, verify:

1. ✅ Try to push directly to `develop` (should fail)
2. ✅ Try to push directly to `staging` (should fail)
3. ✅ Try to push directly to `main` (should fail)
4. ✅ Create PR without CI passing (should be blocked)
5. ✅ Create PR without reviews (should be blocked)

---

## Quick Reference

| Branch    | Reviewers | Status Checks | Force Push | Deploy |
|-----------|-----------|---------------|------------|--------|
| `develop` | 1         | ✅            | ❌         | ❌     |
| `staging` | 1         | ✅            | ❌         | ✅     |
| `main`    | 2         | ✅            | ❌         | ✅     |
