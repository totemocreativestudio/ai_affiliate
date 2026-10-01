"use client";

import LumaIcon,{type IconName} from "./LumaIcon";

export default function SmartEmptyState({
 eyebrow="NEXT STEP",
 title,
 description,
 primaryLabel,
 onPrimary,
 secondaryLabel,
 onSecondary,
 icon="dashboard",
 checklist=[],
 hint,
 compact=false,
}:{
 eyebrow?:string;
 title:string;
 description:string;
 primaryLabel:string;
 onPrimary:()=>void;
 secondaryLabel?:string;
 onSecondary?:()=>void;
 icon?:IconName;
 checklist?:string[];
 hint?:string;
 compact?:boolean;
}){
 return <section className={"smart-empty-state"+(compact?" compact":"")}>
   <div className="smart-empty-visual"><LumaIcon name={icon}/></div>
   <div className="smart-empty-copy">
    <span>{eyebrow}</span>
    <h3>{title}</h3>
    <p>{description}</p>
    {!!checklist.length&&<ul>{checklist.map(item=><li key={item}>{item}</li>)}</ul>}
    {hint&&<small>{hint}</small>}
   </div>
   <div className="smart-empty-actions">
    <button className="primary" type="button" onClick={onPrimary}>{primaryLabel}</button>
    {secondaryLabel&&onSecondary&&<button type="button" onClick={onSecondary}>{secondaryLabel}</button>}
   </div>
 </section>
}
