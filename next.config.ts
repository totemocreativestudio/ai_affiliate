import type {NextConfig} from 'next';

// Production /web proxy intentionally targets the public project alias.
 // A stale MARKETING_ORIGIN value may point to a protected preview deployment,
 // so it must not override the public origin used by customer-facing routes.
const marketingOrigin = 'https://lumaway-marketing.vercel.app';

const config: NextConfig = {
 async rewrites() {
  if (!marketingOrigin) return [];
  return [
   {source: '/web', destination: `${marketingOrigin}/web`},
   {source: '/web/:path*', destination: `${marketingOrigin}/web/:path*`},
  ];
 },
};

export default config;
