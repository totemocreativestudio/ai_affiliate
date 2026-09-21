import type {Metadata} from 'next';
import localFont from 'next/font/local';
import './globals.css';
import {Navigation} from '@/components/navigation';
import {Footer} from '@/components/footer';
import {Analytics} from '@/components/analytics';
import {site} from '@/lib/config';
const metaPixelBoot=`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','1283842006708051');fbq('track','PageView');`;
const dmSans=localFont({src:[{path:'../node_modules/@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2',weight:'400',style:'normal'},{path:'../node_modules/@fontsource/dm-sans/files/dm-sans-latin-500-normal.woff2',weight:'500',style:'normal'},{path:'../node_modules/@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff2',weight:'700',style:'normal'}],display:'swap',variable:'--font-dm-sans'});
export const metadata:Metadata={metadataBase:new URL(`${site.url}/`),title:{default:'Lumaway — Light Up Your Potential.',template:'%s | Lumaway'},description:'Ruang kerja intelligence untuk memahami data, menemukan peluang, dan mengarahkan keputusan bisnis.',robots:site.indexable?{index:true,follow:true}:{index:false,follow:false},icons:{icon:`${site.url}/brand/luma-mark.png`}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="id" className={dmSans.variable}><head><script dangerouslySetInnerHTML={{__html:metaPixelBoot}}/></head><body><noscript><img height="1" width="1" style={{display:'none'}} src="https://www.facebook.com/tr?id=1283842006708051&ev=PageView&noscript=1" alt=""/></noscript><a href="#main" className="skip-link">Langsung ke konten</a><Navigation/><main id="main">{children}</main><Footer/><Analytics/></body></html>}
