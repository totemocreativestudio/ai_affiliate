import type {MetadataRoute} from 'next';
import {site} from '@/lib/config';
export default function robots():MetadataRoute.Robots{return {rules:site.indexable?{userAgent:'*',allow:'/',disallow:['/api/']}:{userAgent:'*',disallow:'/'},...(site.indexable?{sitemap:`${site.url}/sitemap.xml`}:{})}}
