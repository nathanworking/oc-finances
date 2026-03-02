# GoodCraft Git & PR Workflow

## Branch Structure

```
develop (default, trunk)        ← All feature work lands here via Graphite
  │
  ├── feature stacks            ← Graphite-managed stacked PRs
  │
staging (deployment branch)     ← Promotion PR from develop
  │
production (deployment branch)  ← Promotion PR from staging
```

**`develop`** = where you work. Graphite stacks target here.
**`staging`** = what's on the staging server. Only updated via promotion PR.
**`production`** = what's live. Only updated via promotion PR from staging.

## Daily Workflow

### 1. Start a feature (Graphite stack)

```bash
# Make sure you're on develop and up to date
gt trunk                          # Switch to develop
git pull                          # Get latest

# Create your first branch in the stack
gt create -m "feat: add widget"   # Creates branch, stages changes

# Stack more on top
gt create -m "feat: add widget tests"

# Push the whole stack
gt submit                         # Pushes all branches, creates/updates PRs
```

### 2. Get reviews, iterate

```bash
# After review feedback, make changes on any branch in the stack
gt checkout feat/add-widget       # Jump to a branch in the stack
# ... make changes ...
git add -A && git commit -m "address review feedback"
gt submit                         # Updates PRs, rebases dependents
```

### 3. Merge the stack

```bash
# Merge from Graphite dashboard or CLI
gt merge                          # Merges bottom-up into develop
```

### 4. Promote to staging

```bash
# On GitHub: create PR from develop → staging
# Title: "Promote to staging: [brief description]"
# This PR needs:
#   - 1 approval
#   - Passing local checks (lint, typecheck, build)
# Merging triggers staging deployment
```

### 5. Promote to production

```bash
# On GitHub: create PR from staging → production
# Title: "Release: [brief description]"
# This PR needs:
#   - 2 approvals (or at minimum a thorough review)
#   - QA verified on staging
#   - No "do-not-ship" labels
# Merging triggers production deployment
```

### 6. Hotfix production (while staging has WIP)

```
production ─── hotfix/critical-bug ──→ PR against production
                                          │
                                          ▼
                                    merge to production
                                          │
                                    ┌─────┴─────┐
                                    ▼           ▼
                              back-merge    back-merge
                              to staging    to develop
```

```bash
# Branch from production
git checkout production
git pull
git checkout -b hotfix/describe-the-fix

# Fix, commit, push
git add -A && git commit -m "fix: critical bug description"
git push -u origin hotfix/describe-the-fix

# Create PR against production (NOT through Graphite)
gh pr create --base production --title "Hotfix: description"

# After merge to production, back-merge immediately:
# PR: production → staging
gh pr create --base staging --head production --title "Back-merge: hotfix into staging"
# PR: production → develop
gh pr create --base develop --head production --title "Back-merge: hotfix into develop"
```

**Resolve conflicts in the back-merge PRs.** Staging's WIP stays intact — the hotfix gets layered in.

## Checks & Quality Gates

### Layer 1: Local (lefthook — runs automatically)

| Hook | What runs | When |
|------|-----------|------|
| pre-commit | lint staged files | Every commit |
| pre-push | typecheck + build | Every push |

These catch issues before code leaves your machine.

### Layer 2: AI Review (Greptile — runs on every PR)

Greptile automatically reviews every PR within ~2 minutes of creation/update:

- **Line-by-line comments** with severity (error, warning, suggestion)
- **PR summary** — auto-generated description of what changed and why
- **Security checks** — flags secrets, credentials, .env files in diffs
- **Promotion safety** — extra checks on PRs targeting staging/production
- **Context-aware** — reads CLAUDE.md, ARCHITECTURE.md, and WORKFLOW.md for project knowledge

Greptile reviews are the **first pass**. Human review comes after, informed by AI findings.

You can interact with Greptile in PR comments:
- `@greptileai` — trigger a review or ask questions about the code

### Layer 3: Human Review (required for merge)

| Branch | Required approvals | Direct push |
|--------|-------------------|-------------|
| develop | 1 | Blocked |
| staging | 1 | Blocked |
| production | 1+ | Blocked |

### Promotion checklist

**develop → staging:**
- [ ] All stacked PRs merged to develop
- [ ] Greptile review has no unresolved errors
- [ ] Local build passes
- [ ] Human review approved

**staging → production:**
- [ ] QA verified on staging environment
- [ ] Greptile promotion safety check passes (no TODOs, console.logs, WIP markers)
- [ ] Human review approved
- [ ] No known blockers or "do-not-ship" labels
- [ ] Back-merge plan ready if hotfix was applied

## Graphite Configuration

```bash
# One-time setup per repo
gt repo init --trunk develop
```

Graphite trunk is `develop`. All stacks build from here.

## Rules

1. **Never push directly to staging or production.** Always use promotion PRs.
2. **Never merge feature branches into staging or production.** Features go to develop first.
3. **Hotfixes are the only exception** — they branch from and PR into production, then back-merge.
4. **Always back-merge hotfixes** into both staging and develop immediately.
5. **Use Graphite for all feature work.** `gt create`, `gt submit`, `gt merge`.
6. **Review before promote.** Staging and production promotions require explicit PR approval.
