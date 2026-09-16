'use client';
import {useState,useRef,useEffect} from 'react';
import Link from 'next/link';
import {ChevronDown,Menu,X,ArrowUpRight} from 'lucide-react';
import {Brand} from './ui';
import {appLinks} from '@/lib/config';
import {capabilities,audiences} from '@/content/products';
const menus=[
 {name:'Produk',items:capabilities.map(c=>({href:`/${c.slug}`,label:c.name,note:c.status==='beta'?'Beta':'Direncanakan'}))},
 {name:'Solusi',items:audiences.map(a=>({href:`/solutions/${a.slug}`,label:a.name,note:a.short}))},
 {name:'Wawasan',items:[{href:'/insights',label:'Lumaway Insights',note:'Perspektif untuk keputusan bisnis'},{href:'/resources',label:'Panduan & materi',note:'Mulai dari pertanyaan yang tepat'},{href:'/roadmap',label:'Arah pengembangan',note:'Lihat status kemampuan'},{href:'/about',label:'Tentang Lumaway',note:'Light Up Your Potential.'}]}
];
export function Navigation(){const [open,setOpen]=useState<string|null>(null);const [mobile,setMobile]=useState(false);const nav=useRef<HTMLElement>(null);const trigger=useRef<HTMLButtonElement|null>(null);
 useEffect(()=>{function outside(e:PointerEvent){if(nav.current&&!nav.current.contains(e.target as Node)){setOpen(null);setMobile(false)}}function key(e:KeyboardEvent){if(e.key==='Escape'){setOpen(null);setMobile(false);trigger.current?.focus()}}document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key)}},[]);
 const close=()=>{setOpen(null);setMobile(false)};
 return <header className="site-header"><nav className="container navbar" ref={nav} aria-label="Navigasi utama"><Brand/><button className="mobile-toggle" aria-label={mobile?'Tutup navigasi':'Buka navigasi'} aria-expanded={mobile} aria-controls="nav-items" onClick={e=>{trigger.current=e.currentTarget;setMobile(!mobile)}}>{mobile?<X/>:<Menu/>}</button><div id="nav-items" className={`nav-items ${mobile?'is-open':''}`}><div className="nav-links">{menus.map(menu=><div className="nav-group" key={menu.name}><button aria-expanded={open===menu.name} aria-controls={`menu-${menu.name}`} onClick={e=>{trigger.current=e.currentTarget;setOpen(open===menu.name?null:menu.name)}}>{menu.name}<ChevronDown size={14}/></button>{open===menu.name&&<div id={`menu-${menu.name}`} className="mega-menu"><div className="mega-heading">{menu.name==='Produk'?'Kenali ekosistem Lumaway':menu.name==='Solusi'?'Sesuai kebutuhan tim Anda':'Belajar & jelajahi'}</div><div className="mega-grid">{menu.items.map(item=><Link key={item.href} href={item.href} onClick={close}><strong>{item.label}</strong><span>{item.note}</span></Link>)}</div></div>}</div>)}<Link href="/pricing" onClick={close}>Harga</Link></div><div className="nav-actions"><a href={appLinks.login} data-event="login_click">Masuk</a><Link href="/contact?type=demo" className="button button-small" onClick={close} data-event="demo_request_open">Minta demo<ArrowUpRight size={16}/></Link></div></div></nav></header>;
}
