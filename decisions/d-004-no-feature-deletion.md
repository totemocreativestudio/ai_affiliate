---
id: d-004-no-feature-deletion
title: No Feature Deletion Policy
type: decision
status: approved
version: 1.0.0
owner: @surya
created: 2026-11-01
updated: 2026-11-01
tags: [decision, policy, features, preservation]
relationships:
  - type: governs
    target: s-design-spec
    description: "Governs design spec (no deletion)"
  - type: governs
    target: s-progressive-disclosure-spec
    description: "Governs progressive disclosure (preservation)"
  - type: governs
    target: i-component-inventory
    description: "Governs component inventory (all preserved)"
governance:
  review-cycle: 365d
  last-reviewed: 2026-11-01
---

# ADR 004: No Feature Deletion Policy

## Context

Owner explicitly stated: **"saya tidak ingin menghapus sih, ini bukan tidak terpakai tapi belum terpakai"** (I don't want to delete — these aren't unused, just not yet used).

Lumaway has 28 workspace features, some with low current usage but strategic value:
- Live Streaming (specialist feature, growing)
- Automation Rules (power user, retention driver)
- Goal & Forecast (planning, retention)
- Scheduled Reports (enterprise readiness)
- Promo Studio (marketing enablement)
- Creator Samples (workflow completion)
- Ratecard Master (pricing control)
- Social Lumaway (community building)
- Luma Affiliate (viral growth)
- Tutorial Upload (onboarding completion)

## Decision

**Enforce "No Feature Deletion" as a hard policy across all work.**

### Policy Rules

1. **No route deletion** — All 28 workspace routes remain accessible
2. **No component deletion** — All 80+ components in `app/components/` preserved
3. **No CSS file deletion** — All 42 CSS files in `app/` preserved
4. **No database migration deletion** — All 149 migrations preserved
4. **No API route deletion** — All API routes preserved
5. **Feature hiding only via progressive disclosure** — See `d-002-progressive-disclosure`
4. **Code cleanup allowed** — Refactoring, deduplication, modernization allowed
5. **Dead code removal allowed** — Only if provably unreachable (no routes, no imports, no references)

### Enforcement

**Code Review Checklist:**
- [ ] No `rm` / `delete` on feature files
- [ ] No route removal from `lib/luma-navigation.ts`
- [ ] No component removal from `app/components/`
- [ ] No CSS file removal from `app/`
- [ ] Progressive disclosure used for hiding (not deletion)

**CI Gates:**
- `scripts/lumaway-route-check.mjs` validates all routes exist
- Component inventory audit (`i-component-inventory.md`) tracked
- CSS file count monitored (must stay ≥ 42)

### What "Not Yet Used" Means

| Feature | Current Usage | Strategic Value | Preservation Method |
|---------|---------------|-----------------|---------------------|
| Live Streaming | Specialist only | Growing market | Progressive disclosure (group closed) |
| Automation Rules | Power users | Retention driver | Progressive disclosure (group closed) |
| Goal & Forecast | Planners | Retention | Progressive disclosure (expandable card) |
| Scheduled Reports | Enterprise | Enterprise readiness | Progressive disclosure (slide-over) |
| Promo Studio | Marketing | Marketing enablement | Tab conversion |
| Creator Samples | Workflow completion | Creator workflow | Side drawer |
| Ratecard Master | Pricing control | Monetization | Modal from header |
| Social Lumaway | Community | Viral growth | Tab conversion |
| Luma Affiliate | Referral | Viral growth | Modal from avatar |
| Tutorial Upload | Onboarding | Activation | Modal from help |

### What CAN Be Removed (Dead Code)

- Unreachable code (no routes, no imports, no dynamic references)
- Duplicate utilities (consolidate to single source)
- Deprecated APIs (with migration path)
- Unused CSS rules (verified via purge/analysis)
- Console logs, debug code

### Exceptions Process

If a feature genuinely must be removed:
1. Document in `decisions/d-XXX-feature-removal.md`
2. Owner approval required
3. Migration path for any users/data
4. Deprecation period (90 days minimum)
5. Archive (not delete) — move to `archive/` folder

### Consequences

**Positive:**
- Strategic features preserved for future growth
- No regret deletions
- Progressive disclosure solves clutter without loss
- Clear policy prevents accidental deletions

**Negative:**
- Codebase larger (features not yet used)
- Must maintain progressive disclosure for hidden features
- Bundle size includes lazy-loaded unused features (mitigated by lazy loading)

### Alternatives Considered

1. **Delete low-usage features** — Rejected: Owner directive, strategic value
2. **Archive unused features** — Rejected: "Not unused, not yet used" — keep active
3. **Feature flags** — Rejected: Overkill, progressive disclosure is lighter

## Status

**Approved** — Hard policy enforced in all PRs and CI.

## Links

- Progressive disclosure: `d-002-progressive-disclosure.md`
- Component inventory: `i-component-inventory.md`
- Sidebar map: `m-sidebar-map.md` (all 28 features listed)
- Route check: `scripts/lumaway-route-check.mjs`