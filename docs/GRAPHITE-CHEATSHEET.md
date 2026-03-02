# Graphite Cheat Sheet

## Installation

```bash
brew install withgraphite/tap/graphite
# or
npm install -g @withgraphite/graphite-cli
```

Desktop app: https://graphite.dev/download

## Setup (once per repo)

```bash
cd your-repo
gt repo init --trunk develop    # Set trunk to develop
gt auth login                   # First time only
```

## The Mental Model

Graphite manages **stacks** of branches. Each branch = one PR.
They stack on top of each other, and Graphite keeps them rebased.

```
develop (trunk)
  │
  ├─ feat/api-endpoint          PR #1  ← base of the stack
  │   │
  │   └─ feat/api-tests         PR #2  ← stacked on #1
  │       │
  │       └─ feat/api-docs      PR #3  ← stacked on #2
  │
  └─ fix/login-bug              PR #4  ← separate stack (independent)
```

## Core Commands

### Creating branches

```bash
gt create -m "feat: description"    # Create branch + commit staged changes
gt create -a -m "feat: description" # Stage all + create (like git add -A)
```

### Navigating the stack

```bash
gt top          # Go to top of current stack
gt bottom       # Go to bottom of current stack
gt up           # Go up one branch
gt down         # Go down one branch
gt trunk        # Go back to develop
gt checkout <branch>  # Jump to specific branch
```

### Submitting (pushing + creating PRs)

```bash
gt submit       # Push current stack, create/update PRs
gt submit -n    # No edit — skip PR title/body prompts
```

### Syncing

```bash
gt sync         # Fetch trunk, rebase all stacks
                # Run this often — keeps stacks clean
```

### Merging

```bash
gt merge        # Merge the current stack's PRs bottom-up
                # (Usually do this from Graphite dashboard instead)
```

### Viewing

```bash
gt log          # Show your stack structure
gt log short    # Compact view
gt ls           # List all your branches
gt status       # Current branch info
```

### Modifying a stack

```bash
# Add more commits to current branch
git add -A && git commit -m "more changes"
gt submit       # Updates the PR

# Reorder branches in a stack
gt move -d      # Move current branch down in the stack
gt move -u      # Move current branch up in the stack

# Insert a new branch in the middle
gt checkout feat/api-endpoint
gt create -m "feat: api-validation"   # Inserts between endpoint and tests

# Remove a branch from the stack (fold into parent)
gt fold         # Squash current branch into its parent
```

### Fixing conflicts

```bash
gt sync         # If conflicts arise during sync:
# 1. Fix conflicts in your editor
# 2. git add the resolved files
# 3. gt continue
gt continue     # Resume after conflict resolution
```

## Desktop App (Graphite Dashboard)

```
┌─────────────────────────────────────────────────────────────────┐
│  Graphite Desktop                                               │
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                  │
│  STACKS      │  feat/api-endpoint                    PR #1     │
│              │  ┌─────────────────────────────────────────┐     │
│  ● My PRs    │  │  + src/app/api/widgets/route.ts        │     │
│              │  │  + src/lib/services/widgets.ts          │     │
│  feat/api-*  │  │  M src/lib/db/schema.ts                │     │
│  ├─ endpoint │  └─────────────────────────────────────────┘     │
│  ├─ tests    │                                                  │
│  └─ docs     │  Reviews: ✅ nathan  ⏳ waiting                  │
│              │  Checks:  ✅ lint  ✅ typecheck  ✅ build        │
│  fix/login   │  Stack:   1 of 3 (base)                         │
│  └─ (single) │                                                  │
│              │  [Merge Stack]  [Update]  [Close]               │
│              │                                                  │
├──────────────┴──────────────────────────────────────────────────┤
│  develop ← feat/api-endpoint ← feat/api-tests ← feat/api-docs │
└─────────────────────────────────────────────────────────────────┘
```

**Key dashboard features:**
- See all your stacks at a glance
- One-click merge entire stacks (bottom-up)
- See review status per PR
- See CI status per PR
- Reorder, edit, split PRs visually

## Common Scenarios

### "I need to make a quick fix unrelated to my current stack"

```bash
gt trunk                            # Go back to develop
gt create -m "fix: typo in readme"  # New independent stack
gt submit                           # Push + create PR
gt checkout feat/my-feature         # Go back to what you were doing
```

### "My stack has conflicts after someone merged to develop"

```bash
gt sync         # Fetches develop, rebases your stack
# If conflicts: fix them, git add, gt continue
gt submit       # Push updated stack
```

### "I want to split a big PR into smaller ones"

```bash
# You're on a branch with too many changes
gt split        # Interactive — choose which commits go where
# Or manually:
gt create -m "part 1: the model layer"   # Move some changes here
gt create -m "part 2: the API layer"     # And some here
```

### "PR #1 in my stack merged, now what?"

```bash
gt sync         # Graphite rebases remaining PRs onto develop
gt submit       # Update remaining PRs
# PR #2 now targets develop directly (it was rebased)
```

### "I need to add to a PR that's in the middle of my stack"

```bash
gt checkout feat/api-endpoint     # Go to that branch
# Make your changes
git add -A && git commit -m "address review feedback"
gt submit                         # Rebases everything above, pushes all
```

## Workflow Visualization

### Normal feature flow
```
You                    Graphite                GitHub
 │                        │                      │
 ├─ gt create ──────────► │                      │
 │  (local branch)        │                      │
 │                        │                      │
 ├─ gt submit ──────────► ├─ push + create PR ──►│
 │                        │                      │
 │                        │  ◄── review ─────────┤
 │                        │                      │
 ├─ fix + gt submit ────► ├─ force push ────────►│
 │                        │                      │
 │                        │  ◄── approved ───────┤
 │                        │                      │
 ├─ gt merge ───────────► ├─ merge bottom-up ───►│
 │                        │  rebase dependents   │
 │                        │                      │
 ├─ gt sync ────────────► ├─ fetch + rebase ────►│
 │  (stack updated)       │                      │
```

### Promotion flow (not Graphite — regular PRs)
```
develop ──── promotion PR ────► staging
                                  │
                            QA + approval
                                  │
staging ──── promotion PR ────► production
```

### Hotfix flow (not Graphite — regular PRs)
```
production ─── hotfix branch ──► PR to production
                                     │
                                   merge
                                     │
                              ┌──────┴──────┐
                              ▼              ▼
                         PR to staging  PR to develop
                         (back-merge)   (back-merge)
```

## Tips

1. **`gt sync` often.** Before starting work, after lunch, before submitting. Keeps conflicts small.
2. **Small PRs.** The whole point of stacking is small, reviewable PRs. If a PR has 10+ files, split it.
3. **Stack related work.** API + tests + docs for one feature = one stack. Unrelated fix = separate stack.
4. **Don't use Graphite for promotions or hotfixes.** Those are regular `gh pr create` PRs.
5. **Use the dashboard for merging.** It handles the bottom-up merge order automatically.
