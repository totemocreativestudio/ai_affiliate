'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <section className="container section"><h1 style={{fontSize:40}}>Halaman belum dapat ditampilkan.</h1><p style={{margin:'20px 0'}}>Coba muat kembali untuk melanjutkan.</p><button className="button" onClick={reset}>Coba lagi</button></section>}
