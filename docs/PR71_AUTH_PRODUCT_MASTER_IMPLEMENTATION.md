# Lumaway implementation brief — requested PR70 prompt, delivered in PR71

> PR #70 is already used by **Metric Trend Chart & Platform Contribution UI**. This specification is preserved here exactly as the requested next implementation brief and is implemented in PR #71.

## A. Full auth experience

Build a premium responsive authentication experience for Lumaway SaaS.

### Layout
- Desktop: two columns.
- Left: full-height image carousel with 3 slides.
- Right: clean authentication panel.
- Mobile: carousel stacked above form.
- Auto rotate every 5 seconds, fade transition, dot controls, reduced-motion support.
- Brand: white, slate, blue, violet, subtle cyan; modern professional typography.
- No AI-looking iconography.

### Required states
1. Login
2. Register / signup
3. Forgot password request
4. Reset password
5. Verify email
6. WhatsApp OTP request + verify
7. Google OAuth, disabled with helper copy if provider configuration is unavailable.

### Security/UX
- Google OAuth must use Supabase OAuth callback; never Google Identity JS origin-dependent flow.
- Auth errors must be user-friendly and must not expose provider secrets.
- Password minimum 8 characters.
- OTP is 6 digits, expires server-side, and must never be stored as plaintext.
- Accessible focus states, input autocomplete attributes, responsive layout.

## B. Dashboard KPI and creator safety

KPI cards:
- clean metric label
- large primary value
- positive/negative comparison pill
- previous-period comparison only when a valid baseline exists
- do not render fake +100% when previous period has no records.

Creator ranking:
- source only Affiliate Performance / sales
- left join creator master
- fallback creator_name / username from performance rows
- one secondary RPC failure must not clear the entire dashboard
- owner/admin/manager workspace users can read all rows in their own workspace
- creator-scoped users remain scoped
- cross-workspace reads must remain blocked.

Empty/warning state:
- isolated module warning, never blank the whole dashboard
- clear action copy and no mock data.

## C. Product Master Visual Catalog

### Views
- Table
- Grid / cards
- Compact list
- Persist preferred view locally.

### Data
Parent SKU:
- image_url
- image_alt
- gallery_images
- sku
- product_name
- category
- selling_price
- cost_price / HPP
- point_per_unit
- status

Marketplace listing:
- product_master_id
- platform
- product_code
- product_name
- variant_slot
- variant_name
- category
- image_url

Variant:
- product_master_id
- slot
- variant_name
- hpp
- selling_price
- image_url

### Search / filters
Search:
- SKU
- product name
- category
- Shopee/TikTok product code
- variant name

Filters:
- category
- platform
- status

### Table view
Columns:
- thumbnail + product
- parent SKU
- category
- platform badges
- number of variants
- selling price
- HPP
- status
- actions

Expandable row:
- marketplace listings
- variants
- HPP and selling price per variant.

### Grid view
- large image
- product name
- parent SKU
- badges
- selling price
- HPP
- status
- detail/edit action.

### Empty image fallback
Use first available image in this order:
1. product_master.image_url
2. product_platform_items.image_url
3. product_variants.image_url
4. neutral letter placeholder.

## D. SQL / schema guidance

Production currently supports the required fields:

```sql
-- Product parent
product_master.image_url text
product_master.image_alt text
product_master.gallery_images jsonb not null default '[]'

-- Marketplace listing
product_platform_items.image_url text

-- Variant
product_variants.image_url text
```

If deploying to another environment, use an idempotent migration:

```sql
alter table public.product_master
  add column if not exists image_url text,
  add column if not exists image_alt text,
  add column if not exists gallery_images jsonb not null default '[]'::jsonb;

alter table public.product_platform_items
  add column if not exists image_url text;

alter table public.product_variants
  add column if not exists image_url text;

create index if not exists idx_product_master_workspace_status
  on public.product_master(workspace_id,status);

create index if not exists idx_product_platform_items_master
  on public.product_platform_items(workspace_id,product_master_id,platform);

create index if not exists idx_product_variants_master
  on public.product_variants(workspace_id,product_master_id,slot);
```

RLS must remain workspace-scoped. Do not expose products from unrelated workspaces.

## E. Wireframe

Desktop:

```text
┌ Product Master                                         + Tambah Produk ┐
│ Visual catalog for parent SKU and marketplace mappings               │
├──────────┬──────────┬──────────┬──────────┤
│ SKU total│ Variants │ Active   │ Images   │
├───────────────────────────────────────────────────────────────────────┤
│ Search ... │ Category │ Platform │ Status │ [Table][Grid][List]      │
├───────────────────────────────────────────────────────────────────────┤
│ TABLE: thumbnail | product | SKU | category | platform | price ...   │
│   ↳ expanded: marketplace listings + variants                        │
└───────────────────────────────────────────────────────────────────────┘
```

Mobile:
- filters stack vertically
- 2-column stat cards
- grid view becomes one column
- list view prioritizes image, product, SKU and actions
- full table remains horizontally scrollable.

## Acceptance
- TypeScript passes.
- Production build passes.
- Existing SKU, marketplace mapping, variants and HPP remain intact.
- Product image is optional and never breaks a row.
- Login/register/reset/verify/OTP states are functional and responsive.
- No AI-style decorative iconography.
