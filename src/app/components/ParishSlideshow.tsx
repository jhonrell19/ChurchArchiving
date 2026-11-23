'use client'
import Image from 'next/image'
import {useEffect,useMemo,useRef,useState} from 'react'

type Media={id:string;type:'image'|'video';url:string;displaySeconds:number;durationSeconds:number|null}
type Notice={id:number;title:string;media:Media[]}
type Slide={key:string;src:string;type:'image'|'video';title:string;seconds:number}

export default function ParishSlideshow({photos}:{photos:string[]}){
  const [announcements,setAnnouncements]=useState<Notice[]>([])
  const [current,setCurrent]=useState(0)
  const [playing,setPlaying]=useState(true)
  const videoRef=useRef<HTMLVideoElement|null>(null)
  useEffect(()=>{
    const controller=new AbortController()
    fetch('/api/public-notices',{cache:'no-store',signal:controller.signal})
      .then(r=>r.ok?r.json():{notices:[]})
      .then(data=>{if(!controller.signal.aborted)setAnnouncements(Array.isArray(data.notices)?data.notices:[])})
      .catch(()=>undefined)
    return ()=>controller.abort()
  },[])
  const slides=useMemo<Slide[]>(()=>{
    const parish=photos.map((src,i)=>({key:'parish-'+i,src,type:'image' as const,
      title:'Our parish community',seconds:7}))
    const posted=announcements.flatMap(n=>n.media.slice(0,5).map(m=>({
      key:'notice-'+m.id,src:m.url,type:m.type,title:n.title,
      seconds:m.type==='video'?Math.min(30,Math.ceil(m.durationSeconds||30)):Math.max(5,Math.min(30,m.displaySeconds||8)),
    })))
    // Announcement visuals are deliberately first so visitors see fresh notices.
    return [...posted,...parish]
  },[announcements,photos])
  const index=current%Math.max(1,slides.length)
  const slide=slides[index]
  const advance=()=>setCurrent(v=>(v+1)%slides.length)
  useEffect(()=>{
    if(!playing||!slides.length)return
    const timer=window.setTimeout(advance,(slide.seconds+(slide.type==='video'?1:0))*1000)
    return ()=>window.clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[index,playing,slides.length,slide?.seconds,slide?.type])
  useEffect(()=>{
    const video=videoRef.current
    if(!video)return
    if(playing)void video.play().catch(()=>undefined)
    else video.pause()
  },[index,playing])
  if(!slide)return null
  return <section aria-label="Parish and announcement slideshow" className="portal-slideshow">
    <div className="portal-slide-photo">
      {slide.type==='video'
        ? <video key={slide.key} ref={videoRef} src={slide.src}
            className="absolute inset-0 h-full w-full object-cover" autoPlay={playing}
            muted playsInline controls preload="metadata" onEnded={advance}
            aria-label={'Parish announcement: '+slide.title}/>
        : <Image key={slide.key} src={slide.src} alt={slide.title} fill
            unoptimized={slide.src.startsWith('/api/')} priority={index===0}
            sizes="(max-width: 900px) 100vw, 60vw" className="object-cover"/>}
      <div className="portal-slide-caption">
        <span>{slide.key.startsWith('notice-')?'Parish announcement':'Parish photo'}</span>
        <strong>{slide.key.startsWith('notice-')?slide.title:'Iglesia Filipina Independiente · Maragondon'}</strong>
      </div>
    </div>
    <div className="portal-slide-controls">
      <button type="button" aria-label="Previous slide" onClick={()=>setCurrent(v=>(v-1+slides.length)%slides.length)}>‹</button>
      <span className="portal-slide-count" aria-live="polite">Slide {index+1} of {slides.length}</span>
      <button type="button" aria-label="Next slide" onClick={advance}>›</button>
      <button type="button" className="portal-slide-toggle" aria-pressed={!playing} onClick={()=>setPlaying(v=>!v)}>
        {playing?'Pause':'Play'}
      </button>
    </div>
  </section>
}
