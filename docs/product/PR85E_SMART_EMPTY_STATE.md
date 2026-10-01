# PR #85E — Smart Empty State System

## Goal
Replace dead-end "No data / Belum ada data" states with contextual next-step guidance.

## Principles
Every empty state should answer:
1. Apa yang belum tersedia?
2. Kenapa data ini penting?
3. Apa tindakan paling relevan berikutnya?
4. Apa hasil yang akan muncul setelah tindakan itu?

## Shared component
Create SmartEmptyState with:
- eyebrow
- title
- description
- primary CTA
- secondary CTA optional
- compact variant
- icon from existing non-AI icon package/system
- optional checklist
- contextual hint

## Initial adoption
Apply to:
- Live Streaming Upload history
- Live Product Intelligence
- Live Data Health issue list
- Tutorial Center when content is empty
- Dashboard Action Center already uses its own smart state and should visually align

## Examples
Live Product Intelligence:
"Belum ada performa produk Live"
CTA: Upload Data Live
Hint: Setelah upload Shopee/TikTok, GMV, Qty, Click, HPP, dan contribution margin akan muncul di sini.

Tutorial:
"Panduan belum tersedia untuk topik ini"
CTA: Kembali ke Semua Tutorial
Secondary: Buka Helpdesk

## UX
- no decorative AI sparkle icon
- responsive
- accessible buttons
- no overly long copy
- no generic lorem/no-data message
