import type {MetadataRoute} from 'next';
import {capabilities,audiences} from '@/content/products';
import {articles} from '@/content/articles';
import {site} from '@/lib/config';
export default function sitemap():MetadataRoute.Sitemap {if(!site.indexable)return [];const routes=['/home','/product','/solutions','/pricing','/insights','/resources','/contact','/about','/security','/privacy','/terms','/cookies','/roadmap','/integrations',...capabilities.map(c=>`/${c.slug}`),...audiences.map(a=>`/solutions/${a.slug}`),...articles.map(a=>`/insights/${a.slug}`)];return routes.map(path=>({url:`${site.url}${path}`,changeFrequency:path==='/home'?'weekly':'monthly',priority:path==='/home'?1:.7}))}
