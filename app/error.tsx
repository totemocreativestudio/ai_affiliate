"use client";
import {LumaErrorMotion} from "./components/LumaMotionState";
export default function ErrorPage({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
  const message=String(error?.message||"");
  const code=/403/.test(message)?403:/404/.test(message)?404:/503|maintenance|unavailable/i.test(message)?503:500;
  return <main className="runtime-error-page"><LumaErrorMotion code={code} detail={error?.digest?`Reference: ${error.digest}`:undefined} onRetry={reset}/></main>;
}
