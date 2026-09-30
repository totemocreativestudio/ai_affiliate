# PR75E — Social Experience + Customer 360 Overlay + Campaign Banner

## 1. Prompt teknis siap tempel ke Cursor / GitHub Copilot

Implement the next Lumaway user/multi-user UX upgrade.

### A. LUMAWAY SOCIAL Community
Redesign Community using a premium social-dashboard layout inspired by the provided reference while preserving Lumaway branding and the existing no-comment product rule.

Desktop:
- left rail: Community Home, My Profile, Following, Discover, Saved, Drafts
- center: active profile header, post composer, post feed/grid
- right rail: recent activity, suggested profiles, popular creators/posts
- user's own new post must appear immediately in the center feed after publish
- clicking another user's avatar/name opens that user's profile/post stack over the center content
- stacked profile/post cards must be closable with X, Escape, or backdrop
- opening post detail must not navigate away from the community page
- profile interactions: Follow/Following, Like, Save, Share
- do not add comments; existing product requirement remains no-comments

Mobile:
- single-column center feed
- left/right rails become sheet/drawer
- profile/post stack becomes full-height overlay

### B. Creator Samples
Combine the information hierarchy of Social Community and Listings:
- visual creator card/list
- creator identity, platform, product sample, sample status, sent date, tracking
- right-side detail panel on desktop
- timeline: sample prepared → shipped → received → content pending → content done / returned
- quick actions: Edit, Follow Up, Open Shipping, Open Customer 360
- preserve Product Master HPP linkage and Creator autocomplete

### C. Ratecard Master
Provide Table / Card / Profile views:
- creator identity and platform
- active ratecard
- effective dates
- status
- notes
- profile view should visually group creator identity + ratecard history
- detail drawer should not replace the page
- preserve Creator autocomplete and existing workspace-scoped CRUD

### D. Customer 360
Customer 360 must never render inline below the current viewport.

Required behavior:
- fixed right-side drawer
- internal scrolling
- page body scroll locked while open
- stacked/layered visual treatment behind the active drawer
- X, Escape, and backdrop close
- minimize support
- expand support
- mobile becomes full-screen overlay
- keep all current Customer 360 tabs, metrics, target management, and saved profile logic

### E. Campaign Tracker banner
Campaign form must support 1–3 campaign banners:
- JPG / PNG / WEBP
- max 5 MB per image
- existing banners can be removed in edit mode
- selected campaign renders banner carousel
- auto-advance exactly every 10 seconds
- manual previous/next controls
- dot navigation
- reset to first banner when campaign changes
- reduced-motion support
- first banner may be used as visual thumbnail in the campaign list
- storage must be workspace-scoped
- never accept more than 3 banners

### Acceptance
- TypeScript passes
- production build passes
- RLS remains workspace-scoped
- Customer 360 is fixed to viewport and never requires scrolling the page to find it
- Campaign banner upload works for member users in their own workspace only
- carousel changes every 10 seconds when 2–3 banners exist
- one banner does not show unnecessary carousel controls
- no AI-looking decorative icons

---

## 2. Wireframe layout detail

### Community desktop

\`\`\`
┌────────────────────────────────────────────────────────────────────────────┐
│ LUMAWAY SOCIAL / Community                                                │
├───────────────┬────────────────────────────────────┬───────────────────────┤
│ LEFT RAIL     │ CENTER                             │ RIGHT RAIL            │
│               │                                    │                       │
│ Community     │ Profile header                     │ Activity              │
│ My Profile    │ ┌────────────────────────────────┐ │ Suggested profile     │
│ Following     │ │ avatar  profile stats   action │ │ Popular this week     │
│ Discover      │ └────────────────────────────────┘ │ Saved / recent         │
│ Saved         │                                    │                       │
│ Drafts        │ Create Post                        │                       │
│               │ ┌────────────────────────────────┐ │                       │
│               │ │ composer / media / publish     │ │                       │
│               │ └────────────────────────────────┘ │                       │
│               │                                    │                       │
│               │ Feed / post grid                   │                       │
│               │ ┌────────┐ ┌────────┐ ┌────────┐   │                       │
│               │ │ post   │ │ post   │ │ post   │   │                       │
│               │ └────────┘ └────────┘ └────────┘   │                       │
└───────────────┴────────────────────────────────────┴───────────────────────┘
\`\`\`

Click another user:

\`\`\`
CENTER CONTENT
┌───────────────────────────────────────────────┐
│ background post/profile stack #1              │
│   ┌────────────────────────────────────────┐  │
│   │ background post/profile stack #2       │  │
│   │   ┌─────────────────────────────────┐  │  │
│   │   │ ACTIVE PROFILE / POST       [X] │  │  │
│   │   │ avatar · identity · Follow      │  │  │
│   │   │ media / carousel                │  │  │
│   │   │ caption · like · save · share   │  │  │
│   │   └─────────────────────────────────┘  │  │
│   └────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
\`\`\`

### Creator Samples

\`\`\`
┌ Creator Samples                                  + Tambah Sample ┐
│ Search │ Status │ Platform │ Date                               │
├──────────────────────────────┬──────────────────────────────────┤
│ Creator/sample list          │ Selected sample detail           │
│ avatar creator               │ Creator identity                 │
│ product / SKU                │ Product / HPP                    │
│ status                       │ Shipping / tracking              │
│ date                         │ Activity timeline                │
│ ...                          │ Quick actions                    │
└──────────────────────────────┴──────────────────────────────────┘
\`\`\`

### Ratecard Master

\`\`\`
┌ Ratecard Master                               + Tambah Ratecard ┐
│ Search │ Platform │ Status             [Table][Card][Profile]   │
├─────────────────────────────────────────────────────────────────┤
│ Table: Creator | Platform | Ratecard | Effective | Status       │
│ or                                                              │
│ Card grid: profile + rate + period + status                     │
│ or                                                              │
│ Profile detail: identity + current rate + rate history          │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

### Customer 360 fixed stacked drawer

\`\`\`
PAGE
┌──────────────────────────────────────────────────────────────────────────┐
│ original page remains visible, body scroll locked                       │
│                                  ▒▒▒ previous layer                      │
│                                    ▒▒▒ previous layer                    │
│                         ┌──────────────────────────────────────────────┐  │
│                         │ Customer 360                         [_][X] │  │
│                         │ creator + period                           │  │
│                         ├──────────────────────────────────────────────┤  │
│                         │ Overview | Sales | Product | Support | ...  │  │
│                         │                                              │  │
│                         │ internal-scroll content                      │  │
│                         │                                              │  │
│                         └──────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
\`\`\`

### Campaign detail with banners

\`\`\`
┌ Campaign Detail                                           Edit | Delete ┐
│ Campaign type · platform                                                │
│ Campaign name                                                           │
├──────────────────────────────────────────────────────────────────────────┤
│ BANNER 1 / BANNER 2 / BANNER 3                                          │
│ [‹]         image 16:6 + campaign overlay                          [›]   │
│                    ● ───── ○ ○                                           │
│                Auto change every 10 seconds                              │
├────────────┬────────────┬────────────┬───────────────────────────────────┤
│ GMV        │ Orders     │ Creator    │ Commission                        │
├──────────────────────────────────────────────────────────────────────────┤
│ Deliverable Progress                                                    │
├──────────────────────────────────────────────────────────────────────────┤
│ Creator & Deliverables table                                            │
└──────────────────────────────────────────────────────────────────────────┘
\`\`\`

---

## 3. Customer 360 implementation notes

Production implementation uses the existing React component plus Lumaway CSS rather than introducing a second Tailwind styling layer.

Core behavior equivalent to a Tailwind fixed drawer:

\`\`\`tsx
<div className="fixed inset-0 z-[2147482500] bg-slate-950/30 backdrop-blur-sm">
  <aside className="absolute right-0 top-0 h-dvh w-[min(760px,92vw)] overflow-hidden rounded-l-2xl bg-white shadow-2xl">
    <header className="h-16 border-b">...</header>
    <div className="h-[calc(100dvh-4rem)] overflow-y-auto">...</div>
  </aside>
</div>
\`\`\`

The repository implementation additionally:
- locks \`document.body.style.overflow\`
- closes on Escape
- keeps minimize and expand behavior
- renders two passive background layers behind the active drawer
- becomes full-screen on mobile.
