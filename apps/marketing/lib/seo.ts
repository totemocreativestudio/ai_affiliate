import type { Metadata } from 'next';
import {site} from './config';
export function metadata(title:string,description:string,path=''):Metadata {
 const url = new URL(path || '/',site.url).href;
 return {title,description,alternates:{canonical:url},openGraph:{title:`${title} | Lumaway`,description,url,siteName:'Lumaway',locale:'id_ID',type:'website',images:[{url:'/opengraph-image',width:1200,height:630}]},twitter:{card:'summary_large_image',title,description,images:['/opengraph-image']}};
}
export function serializeSchema(data:unknown) {return JSON.stringify(data).replace(/</g,'\\u003c');}
