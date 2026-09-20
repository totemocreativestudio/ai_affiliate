"use client";

type LoadingProps={label?:string;detail?:string;compact?:boolean};
type ErrorProps={code?:number|string;title?:string;message?:string;detail?:string;onRetry?:()=>void;compact?:boolean};

export function LumaLoadingMotion({label="Lumaway sedang memproses",detail="Mohon tunggu, sistem sedang menyiapkan hasil.",compact=false}:LoadingProps){
  return <div className={`luma-motion-state loading ${compact?"compact":""}`} role="status" aria-live="polite">
    <div className="luma-motion-loader" aria-hidden="true">
      <span className="loader-orbit orbit-a"/><span className="loader-orbit orbit-b"/><span className="loader-core"><img src="/luma-mark.png" alt=""/></span>
    </div>
    <div><strong>{label}</strong><p>{detail}</p></div>
  </div>;
}

export function LumaErrorMotion({code=500,title,message,detail,onRetry,compact=false}:ErrorProps){
  const numeric=Number(code)||500;
  const resolvedTitle=title||(
    numeric===404?"Halaman tidak ditemukan":
    numeric===403?"Akses tidak diizinkan":
    numeric===503?"Layanan sedang tidak tersedia":
    "Terjadi kendala pada Lumaway"
  );
  const resolvedMessage=message||(
    numeric===404?"Alamat atau menu yang Anda buka tidak tersedia. Periksa kembali halaman yang dituju.":
    numeric===403?"Akun Anda tidak memiliki akses ke halaman atau proses ini. Hubungi admin bila akses seharusnya tersedia.":
    numeric===503?"Lumaway sedang maintenance atau salah satu layanan utama sedang dipulihkan. Data Anda tetap aman.":
    "Sistem tidak dapat menyelesaikan permintaan. Silakan coba kembali."
  );
  return <section className={`luma-motion-state error ${compact?"compact":""}`} role="alert">
    <div className="luma-error-visual" aria-hidden="true">
      <div className="error-ring ring-one"/><div className="error-ring ring-two"/>
      <div className="error-code">{numeric}</div>
      <span className="error-dot dot-one"/><span className="error-dot dot-two"/><span className="error-dot dot-three"/>
    </div>
    <div className="luma-error-copy"><span className="eyebrow">LUMAWAY SYSTEM STATUS</span><h2>{resolvedTitle}</h2><p>{resolvedMessage}</p>{detail&&<small>{detail}</small>}{onRetry&&<button className="primary" type="button" onClick={onRetry}>Coba Lagi</button>}</div>
  </section>;
}
