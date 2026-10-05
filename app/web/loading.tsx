export default function PublicWebLoading(){
  return <main className="lumaway-public-loading" aria-busy="true"><img src="/luma-mark.png" alt="" width={44} height={44} decoding="async"/><div className="lumaway-public-loader" aria-hidden="true"/><strong role="status">Memuat Lumaway…</strong></main>;
}
