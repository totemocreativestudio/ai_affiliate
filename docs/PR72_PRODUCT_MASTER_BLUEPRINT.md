# PR #72 — Product Master Visual Catalog Blueprint

## Technical prompt for Cursor / GitHub Copilot

```text
Rebuild Lumaway Product Master as a visual catalog while preserving existing SKU, marketplace mapping, HPP, and variation data.

Required views:
1. Table view: thumbnail + product identity + SKU + category + platform + variants + selling price + HPP + status + actions.
2. Grid view: visual product cards with large image, product name, SKU, category/platform chips, selling price, HPP, status, detail/edit actions.
3. Compact list view: thumbnail + identity + pricing + status + actions.

Persist the user's selected view in localStorage.

Toolbar:
- universal search
- category filter
- platform filter
- status filter
- sort
- Table / Grid / List switch

Summary:
- Total SKU Induk
- Produk Active
- Dengan Gambar
- Total Variasi

Images:
- primary image on product_master.image_url
- alt text on product_master.image_alt
- optional gallery in product_master.gallery_images
- variant image on product_variants.image_url
- marketplace-specific image on product_platform_items.image_url
- upload JPG/PNG/WebP <= 5MB to luma-products storage
- storage path starts with workspace UUID
- never expose another workspace's private write access

Editor:
- inline in the product context, never centered modal
- image upload + URL fallback
- keep SKU rename propagation to marketplace items, variants, HPP history, and sales
- include clear validation and error state

Product detail:
- expandable Variasi section
- expandable Mapping Marketplace section
- show image when variant/platform image exists
- no destructive bulk changes

Responsive:
- desktop full table/grid
- tablet 2-column grid
- mobile single-column grid/list; table remains horizontally scrollable
```

## Database field map

| Entity | Field | Purpose |
| --- | --- | --- |
| product_master | image_url | primary product image |
| product_master | image_alt | accessible image description |
| product_master | gallery_images | optional JSON array of additional images |
| product_variants | image_url | variation-specific image |
| product_platform_items | image_url | marketplace-specific image |
| storage bucket | luma-products | workspace-scoped product media |

Mapping remains:

```text
product_master (SKU Induk)
  ├─ product_variants (1..15+ variations)
  └─ product_platform_items
       ├─ Shopee product code
       ├─ TikTok product code
       └─ platform variant mapping
```

## Wireframe

```text
┌ Product Master                               [Import] [+ Tambah Produk] ┐
│ Total SKU │ Active │ Dengan Gambar │ Total Variasi                     │
├─────────────────────────────────────────────────────────────────────────┤
│ Search........ │ Kategori │ Platform │ Status │ Sort │ Table Grid List │
├─────────────────────────────────────────────────────────────────────────┤
│ TABLE VIEW                                                              │
│ [img] Product / subtitle | SKU | Category | Platform | Variant | Price  │
│       └ expanded: Variasi + Mapping Marketplace                          │
├─────────────────────────────────────────────────────────────────────────┤
│ GRID VIEW                                                               │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│ │  IMAGE   │ │  IMAGE   │ │  IMAGE   │ │  IMAGE   │                    │
│ │ name     │ │ name     │ │ name     │ │ name     │                    │
│ │ SKU/tags │ │ SKU/tags │ │ SKU/tags │ │ SKU/tags │                    │
│ │ price/HPP│ │ price/HPP│ │ price/HPP│ │ price/HPP│                    │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘                    │
├─────────────────────────────────────────────────────────────────────────┤
│ LIST VIEW                                                               │
│ [img] Product name · SKU · category/platform      Price  Status  Edit   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Tailwind reference

The production project currently uses its established CSS pipeline, so PR #72 ships with scoped `pm72-*` CSS rather than adding Tailwind as a new build dependency. If this module is later moved into a Tailwind package, the core card maps to:

```tsx
<article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
  <div className="relative aspect-[4/3] bg-slate-50">
    <img className="h-full w-full object-cover" src={product.image_url} alt={product.image_alt ?? product.product_name} />
    <span className="absolute right-3 top-3 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
      Active
    </span>
  </div>
  <div className="p-4">
    <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">{product.product_name}</h3>
    <code className="mt-2 inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">{product.sku}</code>
    <div className="mt-4 grid grid-cols-2 gap-3 border-y border-slate-100 py-3">
      <div><span className="text-xs text-slate-400">Selling Price</span><b className="block text-sm text-slate-800">{money(product.selling_price)}</b></div>
      <div><span className="text-xs text-slate-400">HPP</span><b className="block text-sm text-slate-800">{money(product.cost_price)}</b></div>
    </div>
  </div>
</article>
```
