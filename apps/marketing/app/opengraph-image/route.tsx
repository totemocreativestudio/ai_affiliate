import {ImageResponse} from 'next/og';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
export const runtime='nodejs';
export async function GET(){const font=await readFile(join(process.cwd(),'node_modules/@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff'));return new ImageResponse(<div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',padding:'70px 85px',background:'#0f1728',color:'white',fontFamily:'DM Sans'}}><div style={{fontSize:28,letterSpacing:2}}>LUMAWAY</div><div style={{fontSize:68,lineHeight:1.15,marginTop:65,letterSpacing:-3,maxWidth:960}}>Data berlimpah. Saatnya punya arah yang jelas.</div><div style={{height:5,width:500,background:'linear-gradient(90deg,#f5c876,#ee8aae,#9681ed,#65cede)',marginTop:40}}/><div style={{fontSize:24,marginTop:40,color:'#adb8ce'}}>Light Up Your Potential.</div></div>,{width:1200,height:630,fonts:[{name:'DM Sans',data:font,weight:700}]})}
