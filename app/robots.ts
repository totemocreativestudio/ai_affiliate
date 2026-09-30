import type {MetadataRoute} from "next";
import {PUBLIC_SITE_ORIGIN} from "../lib/public-insights";

export default function robots():MetadataRoute.Robots{
  return {
    rules:[
      {userAgent:"*",allow:["/insights","/insights/"],disallow:["/administration/","/api/","/dashboard","/upload","/database"]},
    ],
    sitemap:`${PUBLIC_SITE_ORIGIN}/sitemap.xml`,
    host:PUBLIC_SITE_ORIGIN,
  };
}
