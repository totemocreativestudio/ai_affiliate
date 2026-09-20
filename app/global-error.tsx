"use client";
import {LumaErrorMotion} from "./components/LumaMotionState";
export default function GlobalError({reset}:{error:Error&{digest?:string};reset:()=>void}){
 return <html lang="id"><body><main className="runtime-error-page"><LumaErrorMotion code={500} title="Lumaway mengalami kendala sistem" message="Aplikasi tidak dapat memuat antarmuka utama. Data Anda tidak terhapus; muat ulang setelah sistem pulih." onRetry={reset}/></main></body></html>;
}
