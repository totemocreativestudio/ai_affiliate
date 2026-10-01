# PR #81F — RPC Security Classification

Goal: turn SECURITY DEFINER warnings into an auditable inventory instead of blindly changing function security mode.

Classification:
- public_read
- authenticated_workspace
- authenticated_admin
- service_only
- internal_helper
- review

The owner inventory records:
- anon/authenticated/service-role execute exposure
- search_path presence
- SECURITY DEFINER status
- explicit review status
- intentional exception status
- rationale

Important: this PR does not mass-convert workspace RPCs to SECURITY INVOKER. Such conversion must be regression-tested against RLS because several RPCs intentionally aggregate across workspace tables after performing explicit workspace authorization checks.
