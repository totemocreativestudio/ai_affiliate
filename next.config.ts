import type {NextConfig} from 'next';

const marketingOrigin = (process.env.MARKETING_ORIGIN || 'https://lumaway-marketing.vercel.app').replace(/\/$/, '');

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
