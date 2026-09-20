export const marketingBasePath = '/web';
export function marketingPath(path = '') {
 const normalized = path ? (path.startsWith('/') ? path : `/${path}`) : '';
 return `${marketingBasePath}${normalized}`;
}
const rawSiteUrl=(process.env.NEXT_PUBLIC_SITE_URL||'https://www.lumaway.online').replace(/\/$/,'');
const publicSiteUrl=rawSiteUrl==='https://lumaway.online'?'https://www.lumaway.online':rawSiteUrl;
const configuredSiteUrl = new URL(publicSiteUrl);
const marketingUrl = `${configuredSiteUrl.origin}${marketingBasePath}`;
const configuredAppUrl=(process.env.NEXT_PUBLIC_APP_URL||'').replace(/\/$/,'');
const appUrl=!configuredAppUrl||configuredAppUrl==='https://app.lumaway.online'
 ? 'https://www.lumaway.online/app.lumaway'
 : configuredAppUrl;
export const site = {
 name: 'Lumaway', tagline: 'Light Up Your Potential.',
 url: marketingUrl,
 homeUrl: `${marketingUrl}/home`,
 appUrl,
 indexable: process.env.MARKETING_INDEXABLE === 'true' && process.env.VERCEL_ENV !== 'preview',
 contactEmail: process.env.MARKETING_CONTACT_EMAIL || '',
};
export const appLinks = { login: `${site.appUrl}/login`, register: `${site.appUrl}/register` };
export const publishedProof: {name: string;quote: string;company: string}[] = [];
// Prices and quotas must come from an approved commercial source. Empty = consultative pricing.
export const plans: {name:string;audience:string;price:number|null;features:string[];approved:boolean}[] = [];
export const brand = { primary:'#635bff', navy:'#0f1728', background:'#f6f7fb', text:'#101828' };
