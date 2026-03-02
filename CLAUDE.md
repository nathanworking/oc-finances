# Project Name

<!-- Replace with project description -->

## Tech Stack

<!-- Fill in per project -->

## Commands

```bash
# Adjust for your package manager
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm test         # Run tests
pnpm lint         # ESLint
```

## Git Workflow

This repo uses **Graphite** for stacked PRs and a **develop → staging → production** promotion model.

### Branches
- **`develop`** — trunk. All feature work lands here via Graphite stacked PRs.
- **`staging`** — deployment branch. Updated only via promotion PR from develop.
- **`production`** — deployment branch. Updated only via promotion PR from staging.

### Rules
1. **All feature/fix work** goes through Graphite stacks targeting `develop`. Use `gt create`, `gt submit`, `gt merge`.
2. **Never push directly** to `staging` or `production`. Always use promotion PRs.
3. **Never merge feature branches** into staging or production. Features go to develop first.
4. **Hotfixes** are the only exception: branch from `production`, PR into `production`, then immediately back-merge to staging and develop.
5. **Always back-merge hotfixes** into both staging and develop after merging to production.
6. **Greptile auto-reviews every PR.** Check its comments before requesting human review. Address any error-level findings.
7. **Run `/code-review` before merging** significant changes for additional Claude-specific feedback.

### Promotion
- **develop → staging**: Create PR, get 1 approval, merge.
- **staging → production**: Create PR, verify QA on staging, get approval, merge.

### Hotfix
```bash
git checkout production && git pull
git checkout -b hotfix/description
# fix, commit, push
gh pr create --base production
# after merge:
gh pr create --base staging --head production
gh pr create --base develop --head production
```

### Local checks (lefthook)
- **pre-commit**: lint staged files
- **pre-push**: typecheck + build

### Graphite commands
```bash
gt create -m "feat: description"  # New branch in stack
gt submit                          # Push stack, create/update PRs
gt sync                            # Rebase stack on latest develop
gt merge                           # Merge stack bottom-up
gt log                             # View stack structure
gt trunk                           # Switch to develop
```
