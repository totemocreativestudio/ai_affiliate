import {createHmac} from 'node:crypto';
import {leadSchema,sanitizedAttribution} from '@/lib/leads';
import {site} from '@/lib/config';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function json(body:unknown,status=200){return Response.json(body,{status,headers:{'Cache-Control':'no-store'}})}
export async function POST(request:Request){
 const origin=request.headers.get('origin');const allowedOrigins=new Set([new URL(request.url).origin,new URL(site.url).origin]);
 if(process.env.VERCEL){const host=request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();const protocol=request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()||'https';if(host)allowedOrigins.add(`${protocol}://${host}`)}
 if(!origin||!allowedOrigins.has(origin))return json({error:'Asal permintaan tidak diizinkan.'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Format permintaan tidak didukung.'},415);
 const reader=request.body?.getReader();if(!reader)return json({error:'Data diperlukan.'},400);
 let text='';let bytes=0;const decoder=new TextDecoder();
 try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>16384){await reader.cancel();return json({error:'Ukuran permintaan terlalu besar.'},413)}text+=decoder.decode(value,{stream:true})}text+=decoder.decode()}catch{return json({error:'Data tidak dapat dibaca.'},400)}
 let input:unknown;try{input=JSON.parse(text)}catch{return json({error:'Format data tidak valid.'},400)}
 const parsed=leadSchema.safeParse(input);if(!parsed.success)return json({error:'Periksa email, nama bisnis, dan persetujuan pada formulir.'},422);
 const data=parsed.data;if(data.website)return json({error:'Permintaan tidak dapat diproses.'},422);
 const url=process.env.MARKETING_SUPABASE_URL;const key=process.env.MARKETING_SUPABASE_SECRET_KEY;const salt=process.env.LEAD_RATE_LIMIT_SALT;
 if(!url||!key||!salt)return json({error:'Layanan formulir belum aktif. Data belum dikirim; silakan coba kembali nanti.'},503);
 // Trust only Vercel's platform-provided header in Vercel; never arbitrary client X-Forwarded-For.
 const ip=process.env.VERCEL?request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim():undefined;
 const fingerprint=createHmac('sha256',salt).update(ip||`email:${data.email}`).digest('hex');
 const payload={...data,attribution:sanitizedAttribution(data.attribution)};
 try{const headers:Record<string,string>={'Content-Type':'application/json',apikey:key};if(key.startsWith('eyJ'))headers.Authorization=`Bearer ${key}`;
 const result=await fetch(`${url.replace(/\/$/,'')}/rest/v1/rpc/marketing_capture_lead`,{method:'POST',headers,body:JSON.stringify({p_payload:payload,p_fingerprint:fingerprint}),cache:'no-store',signal:AbortSignal.timeout(10000)});
 const output=await result.json();if(!result.ok){if(output?.message==='marketing_rate_limit')return json({error:'Terlalu banyak permintaan. Silakan coba kembali dalam satu jam.'},429);return json({error:'Permintaan belum dapat disimpan. Silakan coba lagi.'},502)}
 if(typeof output!=='string'||!/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(output))return json({error:'Penyimpanan belum dapat dikonfirmasi. Silakan coba lagi.'},502);
 return json({id:output},201);
 }catch{return json({error:'Penyimpanan belum dapat dikonfirmasi. Coba lagi; permintaan yang sama tidak akan disimpan dua kali.'},502)}
}
