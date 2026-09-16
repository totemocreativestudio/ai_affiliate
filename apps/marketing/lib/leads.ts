import {z} from 'zod';
export const leadKinds=['demo','sales','newsletter','waitlist','resource'] as const;
export type LeadKind=typeof leadKinds[number];
export const leadSchema=z.object({
 kind:z.enum(leadKinds), email:z.email().max(254).transform(s=>s.toLowerCase()),
 name:z.string().trim().max(100).default(''),company:z.string().trim().max(150).default(''),
 role:z.string().trim().max(100).default(''),companySize:z.enum(['','1–10','11–50','51–200','200+']).default(''),
 channel:z.enum(['','Shopee','TikTok Shop','Tokopedia','Lazada','Multichannel','Lainnya']).default(''),
 challenge:z.string().trim().max(2000).default(''),module:z.string().trim().max(100).default(''),
 consent:z.literal(true),marketingConsent:z.boolean().default(false),website:z.string().max(200).default(''),
 requestId:z.uuid(),attribution:z.object({utm_source:z.string().max(150).optional(),utm_medium:z.string().max(150).optional(),utm_campaign:z.string().max(200).optional(),utm_content:z.string().max(200).optional(),utm_term:z.string().max(200).optional(),landing_page:z.string().max(500).optional(),referrer:z.string().max(300).optional()}).default({})
}).superRefine((data,ctx)=>{if(['demo','sales'].includes(data.kind)){if(!data.name)ctx.addIssue({code:'custom',path:['name'],message:'Nama wajib diisi.'});if(!data.company)ctx.addIssue({code:'custom',path:['company'],message:'Nama bisnis wajib diisi.'})}if(data.kind==='newsletter'&&!data.marketingConsent)ctx.addIssue({code:'custom',path:['marketingConsent'],message:'Persetujuan newsletter diperlukan.'});});
export type Lead=z.infer<typeof leadSchema>;
export function sanitizedAttribution(input:Lead['attribution']):Lead['attribution']{const clean={...input};for(const key of ['landing_page','referrer'] as const){const value=clean[key];if(!value)continue;try{const url=new URL(value,'https://lumaway.online');clean[key]=key==='referrer'?url.origin:url.pathname}catch{delete clean[key]}}return clean;}
