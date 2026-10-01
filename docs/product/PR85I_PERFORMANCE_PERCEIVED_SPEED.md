# PR #85I — Performance & Perceived Speed

## Goal
Make Lumaway feel responsive even when large datasets, charts, or background tasks are still loading.

## Priorities
1. Immediate route feedback
2. Reduce unnecessary main-thread work
3. Reduce noisy polling
4. Progressive/lazy media decoding
5. Keep long tables scrollable without blocking interaction
6. Measure real perceived performance

## Implementation
- Add a lightweight route progress indicator driven by lumaway-routechange.
- Add a client performance observer for navigation, LCP, long tasks, and route transition timing.
- Mark non-critical images loading=lazy and decoding=async through a safe DOM enhancer.
- Increase Notification polling from 15s to 30s; visibility/focus refresh remains.
- Add content-visibility/containment to large cards/tables where safe.
- Respect prefers-reduced-motion.
- Do not block navigation while data refreshes.
- Existing skeleton loaders remain visible while asynchronous modules load.

## Performance budget
Target user experience:
- route feedback <100ms
- no blank screen while route data loads
- LCP target <=2.5s on typical broadband/modern mobile
- interaction response <=200ms where local action does not require network
- avoid long main-thread task >200ms caused by purely visual rendering

## Telemetry
Store only anonymous frontend performance metrics; no business row content or personal data.
Metrics may be emitted as browser events for existing observability collectors.

## Acceptance
- route transition indicator appears immediately and clears automatically
- images outside critical auth/logo surfaces lazy-decode
- no infinite loaders
- reduced-motion users do not receive unnecessary animation
- notification polling load is reduced
