import type {MetadataRoute} from 'next';
import {site} from '@/lib/config';
export default function robots():MetadataRoute.Robots{return {rules:site.indexable?{userAgent:'*',allow:'/web/',disallow:['/web/api/']}:{userAgent:'*',disallow:'/web/'},...(site.indexable?{sitemap:`${site.url}/sitemap.xml`}:{})}}
