"use client";

import {useEffect} from "react";

function numericValue(input:string){
  let s=String(input||"").trim().replace(/\u00a0/g,"").replace(/Rp|IDR|USD/gi,"").replace(/%/g,"").replace(/\s+/g,"").replace(/[^0-9,().+\-]/g,"");
  if(!s)return null;
  const negative=/^\(.*\)$/.test(s);s=s.replace(/[()]/g,"");
  const comma=s.lastIndexOf(","),dot=s.lastIndexOf(".");
  if(comma>=0&&dot>=0){if(comma>dot)s=s.replace(/\./g,"").replace(",",".");else s=s.replace(/,/g,"")}
  else if(comma>=0){const p=s.split(",");if(p.length>2&&p.slice(1).every(x=>x.length===3))s=p.join("");else if(p.length===2){const [a,b]=p;if(b.length===3&&a.replace(/^[+\-]/,"").length<=3)s=a+b;else if(b.length<=2)s=a+"."+b;else s=a+b}else s=s.replace(/,/g,"")}
  else if(dot>=0){const p=s.split(".");if(p.length>2&&p.slice(1).every(x=>x.length===3))s=p.join("");else if(p.length===2&&p[1].length===3&&p[0].replace(/^[+\-]/,"").length<=3)s=p[0]+p[1]}
  const n=Number(s);return Number.isFinite(n)?(negative?-n:n):null;
}

function compareText(a:string,b:string){
  const an=numericValue(a),bn=numericValue(b);
  if(an!==null&&bn!==null)return an-bn;
  const ad=/^\d{4}-\d{2}-\d{2}/.test(a)?Date.parse(a):NaN,bd=/^\d{4}-\d{2}-\d{2}/.test(b)?Date.parse(b):NaN;
  if(Number.isFinite(ad)&&Number.isFinite(bd))return ad-bd;
  return a.localeCompare(b,"id",{numeric:true,sensitivity:"base"});
}

export default function TableSortEnhancer(){
  useEffect(()=>{
    const scan=()=>{
      document.querySelectorAll<HTMLTableCellElement>(".content table thead th").forEach(th=>{
        if(th.querySelector(".table-sort")||th.querySelector("input,select,textarea")||!String(th.textContent||"").trim())return;
        th.classList.add("global-sortable-th");th.title="Klik untuk urutkan naik / turun";
      });
    };
    const click=(event:MouseEvent)=>{
      const target=event.target as HTMLElement|null;
      if(!target||target.closest(".table-sort")||target.closest("button,a,input,select,textarea"))return;
      const th=target.closest("th.global-sortable-th") as HTMLTableCellElement|null;if(!th)return;
      const table=th.closest("table"),headerRow=th.parentElement as HTMLTableRowElement|null,tbody=table?.tBodies?.[0];if(!table||!headerRow||!tbody)return;
      const index=Array.from(headerRow.cells).indexOf(th);if(index<0)return;
      const rows=Array.from(tbody.rows);if(rows.length<2)return;
      const asc=th.dataset.sortDir!=="asc";
      headerRow.querySelectorAll<HTMLTableCellElement>("th.global-sortable-th").forEach(cell=>{if(cell!==th)delete cell.dataset.sortDir});
      th.dataset.sortDir=asc?"asc":"desc";
      rows.sort((ra,rb)=>compareText(String(ra.cells[index]?.textContent||"").trim(),String(rb.cells[index]?.textContent||"").trim())*(asc?1:-1));
      rows.forEach(row=>tbody.appendChild(row));
    };
    scan();const observer=new MutationObserver(()=>scan());observer.observe(document.body,{childList:true,subtree:true});document.addEventListener("click",click);
    return()=>{observer.disconnect();document.removeEventListener("click",click)};
  },[]);
  return null;
}
