// Branch Naming Conventions
export const BRANCH_PREFIXES = {
  FEATURE: "feat",
  FIX: "fix",
  HOTFIX: "hotfix",
  DOCS: "docs",
  REFACTOR: "refactor",
  TEST: "test",
  CHORE: "chore",
  RELEASE: "release",
} as const;

export type BranchPrefix = typeof BRANCH_PREFIXES[keyof typeof BRANCH_PREFIXES];

export function generateBranchName(prefix: BranchPrefix, ticketId: string, description: string): string {
  const slug = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);
  return `${prefix}/${ticketId}-${slug}`;
}

export function parseBranchName(branch: string): { prefix?: BranchPrefix; ticketId?: string; description?: string } | null {
  const match = branch.match(/^(\w+)\/(\w+-\d+)-(.+)$/);
  if (!match) return null;
  const [, prefix, ticketId, description] = match;
  return { prefix: prefix as BranchPrefix, ticketId, description };
}

export function validateBranchName(branch: string): { valid: boolean; error?: string } {
  const validPrefixes = Object.values(BRANCH_PREFIXES) as string[];
  const prefix = branch.split("/")[0];
  if (!validPrefixes.includes(prefix)) {
    return { valid: false, error: `Invalid prefix. Must be one of: ${validPrefixes.join(", ")}` };
  }
  if (!/^[\w-]+\/[\w-]+-.+$/.test(branch)) {
    return { valid: false, error: "Format: prefix/TICKET-ID-description" };
  }
  return { valid: true };
}