import Link from 'next/link';
import {Brand} from './ui';
import {appLinks} from '@/lib/config';
export function Footer(){return <footer className="footer"><div className="container footer-grid"><div className="footer-brand"><Brand/><p>Light Up Your Potential.</p><span>Terangi data. Temukan peluang.<br/>Arahkan keputusan.</span></div>{[
 ['Produk',[['Affiliate Intelligence','/affiliate-intelligence'],['AI Insights','/ai-insights'],['Decision Workspace','/decision-workspace'],['Semua kemampuan','/product']]],
 ['Solusi',[['Brand owner','/solutions/brand-owner'],['Tim marketing','/solutions/marketing-team'],['Produk & R&D','/solutions/product-rnd'],['Semua solusi','/solutions']]],
 ['Jelajahi',[['Wawasan','/insights'],['Panduan','/resources'],['Harga','/pricing'],['Arah pengembangan','/roadmap']]],
 ['Perusahaan',[['Tentang Lumaway','/about'],['Hubungi tim','/contact'],['Keamanan','/security'],['Masuk ke aplikasi',appLinks.login]]]
].map(([title,links])=><div key={title as string}><h3>{title as string}</h3>{(links as string[][]).map(([label,href])=><Link key={href} href={href}>{label}</Link>)}</div>)}</div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Lumaway · PT Totemo Creative Studio</span><div><Link href="/privacy">Privasi</Link><Link href="/terms">Ketentuan</Link><Link href="/cookies">Cookie</Link></div><span>Dirancang untuk langkah berikutnya.</span></div></footer>}
