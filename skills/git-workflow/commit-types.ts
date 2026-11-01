// Conventional Commit Types
export enum CommitType {
  FEAT = "feat",
  FIX = "fix",
  DOCS = "docs",
  STYLE = "style",
  REFACTOR = "refactor",
  PERF = "perf",
  TEST = "test",
  CHORE = "chore",
  REVERT = "revert",
  BUILD = "build",
  CI = "ci",
}

export const COMMIT_TYPES: Record<CommitType, string> = {
  [CommitType.FEAT]: "✨ Fitur baru",
  [CommitType.FIX]: "🐛 Bug fix",
  [CommitType.DOCS]: "📚 Dokumentasi",
  [CommitType.STYLE]: "💄 Style/formatting",
  [CommitType.REFACTOR]: "♻️ Refactoring",
  [CommitType.PERF]: "⚡ Performance",
  [CommitType.TEST]: "✅ Tests",
  [CommitType.CHORE]: "🔧 Chore/tooling",
  [CommitType.REVERT]: "⏪ Revert",
  [CommitType.BUILD]: "📦 Build system",
  [CommitType.CI]: "🔧 CI/CD",
};

export function formatCommitMessage(type: CommitType, scope: string, message: string): string {
  return `${type}(${scope}): ${message}`;
}

export function parseCommitMessage(message: string): { type?: CommitType; scope?: string; message: string } | null {
  const match = message.match(/^(\w+)(?:\((.+)\))?: (.+)$/);
  if (!match) return null;
  const [, type, scope, msg] = match;
  return { type: type as CommitType, scope, message: msg };
}