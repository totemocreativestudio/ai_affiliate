import type {Metadata} from 'next';
import localFont from 'next/font/local';
import './globals.css';
import {Navigation} from '@/components/navigation';
import {Footer} from '@/components/footer';
import {Analytics} from '@/components/analytics';
import {site} from '@/lib/config';
const dmSans=localFont({src:[{path:'../node_modules/@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2',weight:'400',style:'normal'},{path:'../node_modules/@fontsource/dm-sans/files/dm-sans-latin-500-normal.woff2',weight:'500',style:'normal'},{path:'../node_modules/@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff2',weight:'700',style:'normal'}],display:'swap',variable:'--font-dm-sans'});
export const metadata:Metadata={metadataBase:new URL(`${site.url}/`),title:{default:'Lumaway — Light Up Your Potential.',template:'%s | Lumaway'},description:'Ruang kerja intelligence untuk memahami data, menemukan peluang, dan mengarahkan keputusan bisnis.',robots:site.indexable?{index:true,follow:true}:{index:false,follow:false},icons:{icon:`${site.url}/brand/luma-mark.png`}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="id" className={dmSans.variable}><body><a href="#main" className="skip-link">Langsung ke konten</a><Navigation/><main id="main">{children}</main><Footer/><Analytics/></body></html>}
