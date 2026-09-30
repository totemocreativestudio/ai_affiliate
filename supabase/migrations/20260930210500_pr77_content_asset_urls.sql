-- PR77D corrective asset URL for main marketing site
update public.luma_blog_posts
set cover_image_url='https://app.lumaway.online'||cover_image_url,
    updated_at=now()
where status='published'
  and cover_image_url like '/insights/%'
  and slug in (
    'cara-upload-data-affiliate-tanpa-bikin-dashboard-kacau',
    'apa-itu-business-intelligence-operating-workspace',
    'kpi-affiliate-yang-perlu-dipantau',
    'cara-mengelola-database-creator',
    'customer-360-untuk-tim-affiliate',
    'product-master-sku-induk',
    'campaign-tracker-affiliate',
    'cara-membaca-tren-performa',
    'data-health-sebelum-analisis',
    'shipping-sample-creator',
    'cara-menilai-ratecard-creator',
    'promo-yang-sehat-untuk-saas',
    'workflow-follow-up-creator',
    'dashboard-untuk-owner',
    'creator-economy-database-sebagai-aset',
    'ai-analytics-tetap-butuh-validasi',
    'cara-membuat-kanban-marketing',
    'refund-dalam-analisis-ecommerce',
    'social-profile-creator-di-listings',
    'dari-upload-ke-keputusan'
  );
