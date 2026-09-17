import type { Metadata } from 'next';
import {site} from './config';
export function metadata(title:string,description:string,path=''):Metadata {
 const normalizedPath = (path || '/home').replace(/^\/+/, '');
 const url = new URL(normalizedPath, `${site.url}/`).href;
 const image = `${site.url}/opengraph-image`;
 return {title,description,alternates:{canonical:url},openGraph:{title:`${title} | Lumaway`,description,url,siteName:'Lumaway',locale:'id_ID',type:'website',images:[{url:image,width:1200,height:630}]},twitter:{card:'summary_large_image',title,description,images:[image]}};
}
export function serializeSchema(data:unknown) {return JSON.stringify(data).replace(/</g,'\\u003c');}
