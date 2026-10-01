# PR #84H — Live Product Intelligence & Affiliate Separation

Produk fisik boleh menggunakan SKU dan nama produk yang sama, tetapi fakta performa tetap dipisahkan per domain.

## Shared reference
product_master hanya sebagai referensi:
- SKU
- nama produk
- kategori
- HPP / cost_price
- selling price
- image

## Domain rule
Live Streaming metrics tetap hanya berasal dari live_product_performance dan tabel Live lain.
Affiliate metrics tetap berasal dari domain Affiliate.
Tidak boleh ada cross-counting atau penjumlahan lintas domain.

## Live-only metrics
- Live GMV Created
- Live GMV Ready to Ship
- Live Qty Created
- Live Qty Ready
- Live Product Clicks
- Live Add to Cart
- Product Order Attribution
- Live HPP
- Live Contribution Margin

Shopee product order rows tidak boleh diberi label Total Orders.

## Mapping
Tambahkan:
- mapped_sku
- mapped_product_name
- mapping_method
- mapping_confidence
- mapped_at

Prioritas:
1. exact SKU bila source menyediakan SKU
2. exact normalized product name
3. strong normalized product-name match
4. manual mapping

Live import tidak boleh membuat atau mengubah Product Master otomatis.

## Contribution
Jika mapping tersedia:
HPP Live = qty_created × product_master.cost_price
Contribution Margin awal = gmv_created - HPP Live

Jangan memasukkan affiliate commission atau affiliate creator cost.

## UI
Live Streaming > Product Intelligence:
- filter platform/periode
- search produk/SKU
- mapping status
- Live GMV
- Ready GMV
- Qty
- Product Clicks
- Add to Cart
- HPP
- Contribution Margin
- mapping confidence
- manual Map Product

Tampilkan badge LIVE DATA ONLY.

## Acceptance
- SKU sama boleh ada di Affiliate dan Live tanpa cross-counting.
- Product Master hanya reference layer.
- Live Product Intelligence tidak membaca public.sales.
- Dashboard tetap berjalan jika belum mapped.
- Mapping ulang tidak mengubah raw metrics.
