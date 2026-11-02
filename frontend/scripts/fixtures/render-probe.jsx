// Browser-only test fixture, never imported by the application or production build.
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import StarForceProbabilityChart from '../../src/components/StarForceProbabilityChart'
import FlameDistributionChart from '../../src/components/FlameDistributionChart'
import WorkshopEquipmentGrid from '../../src/components/WorkshopEquipmentGrid'

export function measureRetainedRenders() {
  const results = []
  for (const [name, Component, makeProps] of [
    ['Star Force chart (4097 points)', StarForceProbabilityChart, read => {
      const probabilities=Array.from({length:4097},(_,i)=>i/4096)
      return {distribution:{get probabilities() {read(); return probabilities},step_mesos:1000}}
    }],
    ['Flame chart (40 bins)', FlameDistributionChart, read => ({bins: new Proxy(Array.from({length:40},(_,i)=>({lower:i,upper:i+1,probability:.025})), {
      get(target,key) { if(key==='map') read(); return Reflect.get(target,key) },
    }), target:20})],
    ['Equipment slots', WorkshopEquipmentGrid, read => ({equipment:new Proxy({}, {get() {read(); return undefined}}), activeSlot:null, onActivate:()=>{}})],
  ]) {
    const row = {name}
    for (const memoized of [false,true]) {
      const host=document.createElement('div')
      host.hidden=true
      document.body.append(host)
      const root=createRoot(host)
      let reads=0
      const props=makeProps(()=>reads++)
      const type=memoized?Component:Component.type
      const render=index=>flushSync(()=>root.render(createElement('div',{'data-pass':index},createElement(type,props))))
      render(-1)
      reads=0
      const start=performance.now()
      for(let i=0;i<20;i++) render(i)
      row[memoized?'memoized':'unmemoized']={reads,ms:performance.now()-start}
      if(memoized) {
        reads=0
        flushSync(()=>root.render(createElement('div',{'data-pass':20},createElement(type,makeProps(()=>reads++)))))
        row.updatedReads=reads
      }
      flushSync(()=>root.unmount())
      host.remove()
    }
    results.push(row)
  }
  return results
}

export async function measureChartEntranceFrames() {
  const host=document.createElement('div')
  host.className='mw-theme'
  host.style.cssText='position:fixed;top:80px;left:24px;width:320px;z-index:1000;background:var(--surface)'
  document.body.append(host)
  const root=createRoot(host)
  const times=[]
  // Actual Framer Motion chart entrance, with CPU throttling controlled by CDP.
  flushSync(()=>root.render(createElement(StarForceProbabilityChart,{distribution:{
    probabilities:Array.from({length:4097},(_,i)=>i/4096),step_mesos:1000,
  }})))
  await new Promise(resolve=>{
    const start=performance.now()
    function frame(time) {
      times.push(time)
      if(performance.now()-start<600) requestAnimationFrame(frame)
      else resolve()
    }
    requestAnimationFrame(frame)
  })
  flushSync(()=>root.unmount())
  host.remove()
  const intervals=times.slice(1).map((value,i)=>value-times[i]).sort((a,b)=>a-b)
  return {frames:times.length,medianFrameMs:intervals[Math.floor(intervals.length/2)],p95FrameMs:intervals[Math.floor(intervals.length*.95)]}
}
