# PR #81J — Production Release Gate

Create an owner-only release gate that summarizes the production readiness signals already built.

Inputs:
- latest Production QA run
- open critical incidents
- open critical operational alerts
- performance-budget failures
- backup checkpoint freshness
- RPC security inventory review backlog

Output:
- READY
- REVIEW
- BLOCKED

Rules:
- critical QA failure => BLOCKED
- open critical incident => BLOCKED
- open critical operational alert => BLOCKED
- performance budget failure => REVIEW
- stale/missing backup checkpoint => REVIEW
- unresolved RPC security review backlog => REVIEW
- pending manual QA => REVIEW

The gate is advisory and must explain every blocker/review item. Owner may create a release snapshot with notes.
