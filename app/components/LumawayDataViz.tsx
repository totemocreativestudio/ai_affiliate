"use client";

type TrendPoint={label:string;primary:number;secondary?:number};
type RankPoint={label:string;value:number;meta?:string};
type DonutPoint={label:string;value:number};

const compact=new Intl.NumberFormat("id-ID",{notation:"compact",maximumFractionDigits:1});
const numberFmt=new Intl.NumberFormat("id-ID",{maximumFractionDigits:0});

function safeMax(values:number[]){return Math.max(1,...values.map(v=>Number(v||0)))}
function linePath(points:Array<[number,number]>){return points.map(([x,y],i)=>`${i?"L":"M"} ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ")}

export function AreaTrendChart({
  data,
  primaryLabel="GMV",
  secondaryLabel="Orders",
  primaryFormatter=(value)=>compact.format(value),
  secondaryFormatter=(value)=>numberFmt.format(value)
}:{
  data:TrendPoint[];
  primaryLabel?:string;
  secondaryLabel?:string;
  primaryFormatter?:(value:number)=>string;
  secondaryFormatter?:(value:number)=>string;
}){
  if(!data.length)return <div className="viz-empty">Belum ada data tren untuk periode ini.</div>;
  const width=760,height=268,left=48,right=18,top=22,bottom=42;
  const plotW=width-left-right,plotH=height-top-bottom;
  const primaryMax=safeMax(data.map(x=>x.primary));
  const secondaryMax=safeMax(data.map(x=>x.secondary||0));
  const x=(index:number)=>left+(data.length===1?plotW/2:index*(plotW/(data.length-1)));
  const y1=(value:number)=>top+plotH-(Number(value||0)/primaryMax)*plotH;
  const y2=(value:number)=>top+plotH-(Number(value||0)/secondaryMax)*plotH;
  const p1=data.map((row,index)=>[x(index),y1(row.primary)] as [number,number]);
  const p2=data.map((row,index)=>[x(index),y2(row.secondary||0)] as [number,number]);
  const area=`${linePath(p1)} L ${x(data.length-1).toFixed(2)} ${(top+plotH).toFixed(2)} L ${x(0).toFixed(2)} ${(top+plotH).toFixed(2)} Z`;
  const labelIndexes=[0,Math.floor((data.length-1)/2),data.length-1].filter((v,i,a)=>a.indexOf(v)===i);
  const pointStep=Math.max(1,Math.ceil(data.length/8));
  return <div className="viz-chart-wrap">
    <div className="viz-legend"><span><i className="primary-dot"/>{primaryLabel}</span><span><i className="secondary-dot"/>{secondaryLabel}</span></div>
    <svg className="viz-area-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Grafik tren ${primaryLabel} dan ${secondaryLabel}`}>
      <defs>
        <linearGradient id="lumawayAreaGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#6658f4" stopOpacity=".26"/><stop offset="100%" stopColor="#6658f4" stopOpacity=".02"/></linearGradient>
        <filter id="lumawayGlow"><feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#6658f4" floodOpacity=".12"/></filter>
      </defs>
      {[0,.25,.5,.75,1].map((ratio)=><g key={ratio}>
        <line x1={left} x2={width-right} y1={top+plotH*ratio} y2={top+plotH*ratio} className="viz-grid-line"/>
        <text x={left-8} y={top+plotH*ratio+3} textAnchor="end" className="viz-axis-label">{primaryFormatter(primaryMax*(1-ratio))}</text>
      </g>)}
      <path d={area} fill="url(#lumawayAreaGradient)"/>
      <path d={linePath(p1)} className="viz-line viz-line-primary" filter="url(#lumawayGlow)"/>
      <path d={linePath(p2)} className="viz-line viz-line-secondary"/>
      {p1.map(([cx,cy],i)=>i%pointStep===0||i===p1.length-1?<circle key={i} cx={cx} cy={cy} r="3.2" className="viz-point viz-point-primary"><title>{data[i].label} · {primaryLabel}: {primaryFormatter(data[i].primary)} · {secondaryLabel}: {secondaryFormatter(data[i].secondary||0)}</title></circle>:null)}
      {labelIndexes.map(i=><text key={i} x={x(i)} y={height-12} textAnchor={i===0?"start":i===data.length-1?"end":"middle"} className="viz-axis-label viz-x-label">{data[i].label}</text>)}
    </svg>
  </div>;
}

export function RankingBars({data,valueFormatter=(value)=>compact.format(value),emptyText="Belum ada data."}:{data:RankPoint[];valueFormatter?:(value:number)=>string;emptyText?:string}){
  if(!data.length)return <div className="viz-empty">{emptyText}</div>;
  const max=safeMax(data.map(x=>x.value));
  return <div className="viz-ranking-bars">{data.map((row,index)=>{
    const pct=Math.max(3,(Number(row.value||0)/max)*100);
    return <div className="viz-rank-row" key={row.label+"-"+index}>
      <span className="viz-rank-index">{String(index+1).padStart(2,"0")}</span>
      <div className="viz-rank-copy"><div><strong title={row.label}>{row.label}</strong><b>{valueFormatter(row.value)}</b></div><div className="viz-rank-track"><i style={{width:`${pct}%`}}/></div>{row.meta&&<small>{row.meta}</small>}</div>
    </div>;
  })}</div>;
}

export function DonutBreakdown({data,valueFormatter=(value)=>compact.format(value),centerLabel="Total"}:{data:DonutPoint[];valueFormatter?:(value:number)=>string;centerLabel?:string}){
  const filtered=data.filter(x=>Number(x.value||0)>0);
  if(!filtered.length)return <div className="viz-empty">Belum ada komposisi data.</div>;
  const total=filtered.reduce((sum,row)=>sum+Number(row.value||0),0);
  const colors=["#4d7cff","#7459f5","#d84ee8","#21c9dc","#ff9f43","#9aa5b5","#20b878","#ff6b7d"];
  let cursor=0;
  const segments=filtered.map((row,index)=>{
    const start=cursor;
    const pct=(Number(row.value||0)/total)*100;
    cursor+=pct;
    return `${colors[index%colors.length]} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  }).join(",");
  return <div className="viz-donut-layout">
    <div className="viz-donut" style={{background:`conic-gradient(${segments})`}} aria-label="Komposisi data"><div><strong>{valueFormatter(total)}</strong><span>{centerLabel}</span></div></div>
    <div className="viz-donut-legend">{filtered.map((row,index)=>{
      const pct=total?Number(row.value||0)/total*100:0;
      return <div key={row.label}><span><i style={{background:colors[index%colors.length]}}/>{row.label}</span><b>{pct.toFixed(1)}%</b></div>;
    })}</div>
  </div>;
}

export function MiniDeltaBars({current,previous}:{current:number;previous:number}){
  const max=Math.max(1,Math.abs(current),Math.abs(previous));
  const currentPct=Math.max(8,Math.abs(current)/max*100);
  const previousPct=Math.max(8,Math.abs(previous)/max*100);
  return <span className="viz-mini-bars" aria-hidden="true"><i style={{height:`${previousPct}%`}}/><b style={{height:`${currentPct}%`}}/></span>;
}
