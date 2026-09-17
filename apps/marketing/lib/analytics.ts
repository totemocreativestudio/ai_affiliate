export type EventName = 'page_view'|'hero_cta_click'|'start_free_click'|'register_click'|'demo_request_open'|'demo_request_submit'|'pricing_view'|'pricing_plan_click'|'feature_view'|'product_demo_click'|'login_click'|'article_view'|'newsletter_submit'|'contact_sales_submit'|'waitlist_submit'|'resource_download_submit';
declare global {interface Window {dataLayer?:Record<string,unknown>[];gtag?:(...args:unknown[])=>void;fbq?:(...args:unknown[])=>void;va?:(...args:unknown[])=>void}}
export function hasConsent(){try{return localStorage.getItem('lumaway-consent-v1')==='accepted'}catch{return false}}
export function track(event:EventName,properties:Record<string,string|number|boolean>={}) {
 if(typeof window==='undefined'||!hasConsent())return;
 // No email, name, form values, query strings, or raw referrers in analytics.
 const safe = Object.fromEntries(Object.entries(properties).filter(([k])=>['module','path','destination','plan'].includes(k)));
 const payload={event,...safe};
 if(process.env.NEXT_PUBLIC_GTM_ID){(window.dataLayer ||= []).push(payload)}else window.gtag?.('event',event,{...safe,page_location:location.origin+location.pathname});
 window.fbq?.('trackCustom',event,safe);
 window.va?.('event',{name:event,data:safe});
}
