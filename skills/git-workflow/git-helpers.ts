// Git Helper Functions
export interface GitStatus {
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export const GIT_COMMANDS = {
  // Branch operations
  createBranch: (name: string) => `git checkout -b ${name}`,
  switchBranch: (name: string) => `git checkout ${name}`,
  deleteBranch: (name: string, force = false) => `git branch ${force ? "-D" : "-d"} ${name}`,
  listBranches: () => "git branch -a",

  // Commit operations
  addAll: () => "git add .",
  addFiles: (files: string[]) => `git add ${files.join(" ")}`,
  commit: (message: string) => `git commit -m "${message}"`,
  amend: () => "git commit --amend --no-edit",
  undoLastCommit: () => "git reset --soft HEAD~1",

  // Push/Pull
  push: (branch?: string) => branch ? `git push origin ${branch}` : "git push",
  pushForce: (branch: string) => `git push origin ${branch} --force-with-lease`,
  pull: () => "git pull",

  // Status & Log
  status: () => "git status",
  log: (count = 20) => `git log --oneline -${count}`,
  logGraph: (count = 20) => `git log --oneline --graph --all -${count}`,

  // Sync with remote
  fetch: () => "git fetch --all --prune",
  rebase: (branch = "main") => `git rebase ${branch}`,
};

export function getConventionalCommitMessage(
  type: string,
  scope: string,
  message: string,
  breaking = false,
  body?: string,
  footer?: string
): string {
  let commit = `${type}(${scope}): ${message}`;
  if (breaking) commit += "!";
  if (body) commit += `\n\n${body}`;
  if (footer) commit += `\n\n${footer}`;
  return commit;
}

export function getGitAliases(): Record<string, string> {
  return {
    co: "checkout",
    cob: "checkout -b",
    st: "status",
    cm: "commit -m",
    ps: "push",
    pl: "pull",
    lg: "log --oneline --graph --all -20",
    undo: "reset --soft HEAD~1",
    amend: "commit --amend --no-edit",
  };
}