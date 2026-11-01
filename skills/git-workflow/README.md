# Git Workflow Skill

Skill untuk mengelola workflow Git tim dengan standar konsisten.

## 🚀 Quick Start

```typescript
import { 
  COMMIT_TYPES, 
  validateBranchName, 
  generateBranchName,
  GIT_COMMANDS,
  PR_TEMPLATE 
} from "skills/git-workflow";
```

## 📋 Commit Convention

Gunakan **Conventional Commits**:

```bash
feat(auth): add OAuth2 login
fix(api): handle null response
docs(readme): update setup guide
refactor(db): optimize queries
```

## 🌿 Branch Naming

```bash
feat/JIRA-123-add-oauth-login
fix/JIRA-456-handle-null-response
hotfix/JIRA-789-critical-security-patch
```

## 🔄 Workflow

1. `git checkout main && git pull`
2. `git checkout -b feat/JIRA-123-add-feature`
3. Code → `git add . && git commit -m "feat(scope): message"`
3. `git push origin feat/JIRA-123-add-feature`
4. Create PR → Review → Approve → Merge (Squash)

## 🛠 Helpers

```typescript
import { GIT_COMMANDS, validateBranchName } from "skills/git-workflow";

validateBranchName("feat/JIRA-123-add-login"); // { valid: true }
GIT_COMMANDS.createBranch("feat/JIRA-123-add-login");
```