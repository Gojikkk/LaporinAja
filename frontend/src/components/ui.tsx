import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Bell, Building2, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, Clock3, Copy, Droplets, FileCheck2, FilePlus2, Filter, ImagePlus, Info, Lamp, LayoutDashboard, Link2, ListFilter, LockKeyhole, LogIn, MapPin, Menu, MessageSquareText, MoreHorizontal, Route, Search, Shapes, ShieldCheck, SlidersHorizontal, Sparkles, Trash2, Users, X } from 'lucide-react'
import { statusInfo, type Report, type Status } from '../shared/report-data'

const categoryIcons = { 'Jalan rusak': Route, 'Lampu jalan': Lamp, Sampah: Trash2, 'Saluran air': Droplets, 'Fasilitas umum': Building2, Lainnya: Shapes }

export function CategoryIcon({ category, size=22 }: { category:string; size?:number }) { const Icon = categoryIcons[category as keyof typeof categoryIcons] ?? Shapes; return <Icon size={size} strokeWidth={1.8} aria-hidden="true"/> }
export function StatusBadge({ status }: { status: Status }) { const s=statusInfo[status], Icon=s.icon; return <span className={`badge ${s.cls}`}><Icon size={14} strokeWidth={2.2} aria-hidden="true"/><span>{s.text}</span></span> }

export function PrimaryReportCard({ report, primary }: { report:Report; primary?:Report }) {
  const [copied,setCopied]=useState(false)
  useEffect(()=>{ if(!copied) return; const t=setTimeout(()=>setCopied(false),2400); return ()=>clearTimeout(t) },[copied])
  function copyLink(){
    if(!primary||!navigator.clipboard){ setCopied(false); return }
    navigator.clipboard.writeText(`${window.location.origin}/laporan/${primary.code}`).then(()=>setCopied(true)).catch(()=>setCopied(false))
  }
  return <section className="primary-card" aria-labelledby="primary-report-heading">
    <div className="primary-card-head">
      <span className="primary-card-icon"><Link2 size={17} aria-hidden="true"/></span>
      <div>
        <h2 id="primary-report-heading">Laporan ini tercatat sebagai laporan serupa</h2>
        <p>{primary ? <>Laporan <b>{report.code}</b> digabungkan ke laporan utama di bawah ini.</> : <>Laporan <b>{report.code}</b> merujuk pada laporan utama yang sedang tidak tersedia untuk publik.</>}</p>
      </div>
    </div>
    {primary ? <>
      <div className="primary-card-body">
        <div>
          <span className="primary-card-code">{primary.code}</span>
          <Link className="primary-card-title" to={`/laporan/${primary.code}`}>{primary.title}</Link>
          <span className="primary-card-meta">{primary.category} · {primary.village}, {primary.district}</span>
        </div>
        <StatusBadge status={primary.status}/>
      </div>
      <div className="primary-card-actions">
        <Link className="button outline" to={`/laporan/${primary.code}`}>Buka laporan utama <ArrowRight size={16} aria-hidden="true"/></Link>
        <button type="button" className="primary-card-copy" onClick={copyLink}>
          {copied?<Check size={15} aria-hidden="true"/>:<Copy size={15} aria-hidden="true"/>}
          {copied?'Tautan tersalin':'Salin tautan'}
        </button>
      </div>
    </> : <p className="primary-card-note">Laporan utama belum dapat ditampilkan. Hubungi administrator platform bila tautan ini perlu diperiksa.</p>}
  </section>
}

export function Button({ children, to, variant='primary', icon, type='button', onClick, disabled, className='' }: { children:ReactNode; to?:string; variant?:'primary'|'outline'|'quiet'|'danger'; icon?:ReactNode; type?:'button'|'submit'; onClick?:()=>void; disabled?:boolean; className?:string }) { const cls=`button ${variant} ${className}`; return to?<Link className={cls} to={to}>{icon}{children}</Link>:<button className={cls} type={type} onClick={onClick} disabled={disabled}>{icon}{children}</button> }

export function Toast({ message, onClose }: { message:string; onClose:()=>void }) { useEffect(()=>{const t=setTimeout(onClose,4200);return()=>clearTimeout(t)},[onClose]); return <div className="toast" role="status"><CheckCircle2 size={19}/><span>{message}</span><button aria-label="Tutup notifikasi" onClick={onClose}><X size={16}/></button></div> }

export function Modal({ title, children, onClose }: { title:string; children:ReactNode; onClose:()=>void }) { useEffect(()=>{const close=(e:KeyboardEvent)=>e.key==='Escape'&&onClose();window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[onClose]); return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="icon-button modal-close" aria-label="Tutup dialog" onClick={onClose}><X size={19}/></button><div className="modal-mark"><Info size={20}/></div><h2 id="modal-title">{title}</h2>{children}</section></div> }

export function Header({ mode='public' }: { mode?:'public'|'reporter'|'admin' }) {
  const [open,setOpen]=useState(false)
  const links=mode==='public'?[['/','Beranda'],['/laporan','Laporan'],['/statistik','Statistik'],['/tentang','Tentang']]:mode==='admin'?[['/admin','Ringkasan'],['/admin/laporan','Semua laporan'],['/admin/statistik','Statistik']]:[['/dashboard','Ringkasan'],['/dashboard','Laporan saya']]
  return <header className="topbar"><div className="nav-wrap"><Link to="/" className="brand" aria-label="LaporinAja, beranda"><span className="brand-mark"><MapPin size={18} fill="currentColor"/></span><span>Laporin<span>Aja</span></span></Link><button className="icon-button mobile-menu" aria-label={open?'Tutup navigasi':'Buka navigasi'} aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button><nav className={`main-nav ${open?'nav-open':''}`} aria-label="Navigasi utama">{links.map(([to,label])=><NavLink end={to==='/' || to==='/dashboard' || to==='/admin'} onClick={()=>setOpen(false)} key={label} to={to} className={({isActive})=>isActive?'nav-link active':'nav-link'}>{label}</NavLink>)}{mode==='admin'&&<span className="role-pill"><ShieldCheck size={14}/> Administrator</span>}{mode==='reporter'&&<span className="role-pill"><Users size={14}/> Pelapor</span>}<div className="nav-actions">{mode==='public'?<><Button to="/masuk" variant="quiet">Masuk</Button><Button to="/daftar" icon={<ArrowRight size={16}/>}>Lapor</Button></>:<><button className="icon-button notice-button" aria-label="Notifikasi"><Bell size={18}/><i/></button><button className="profile-button" aria-label="Menu akun"><span className="avatar">{mode==='admin'?'A':'R'}</span><span>{mode==='admin'?'Admin':'Rani'}</span><ChevronDown size={15}/></button></>}</div></nav></div></header>
}

export function Footer(){
  return <footer className="footer"><div className="footer-inner">
    <div className="footer-about">
      <Link className="brand footer-brand" to="/"><span className="brand-mark"><MapPin size={18} fill="currentColor"/></span><span>Laporin<span>Aja</span></span></Link>
      <p>Prototype kompetisi warga untuk mencatat temuan fasilitas publik. Bukan kanal resmi pemerintah dan tidak terhubung dengan instansi mana pun.</p>
    </div>
    <nav className="footer-links" aria-label="Tautan footer">
      <Link to="/laporan">Laporan warga</Link>
      <Link to="/statistik">Statistik</Link>
      <Link to="/tentang">Tentang</Link>
      <Link to="/kebijakan-privasi">Kebijakan privasi</Link>
    </nav>
    <div className="footer-bottom"><span>© 2026 LaporinAja</span><span>Dibuat bersama warga</span></div>
  </div></footer>
}

export function AppShell({children, mode='public', footer=true, pageClass=''}: {children:ReactNode;mode?:'public'|'reporter'|'admin';footer?:boolean;pageClass?:string}){return <div className={`app-theme app-${mode} ${pageClass}`.trim()}><Header mode={mode}/>{children}{footer&&<Footer/>}</div>}

export function PageIntro({title,description,action,eyebrow}:{title:string;description:string;action?:ReactNode;eyebrow?:string}){return <div className="page-intro"><div>{eyebrow&&<div className="eyebrow"><span aria-hidden="true"/>{eyebrow}</div>}<h1>{title}</h1><p>{description}</p></div>{action&&<div className="intro-action">{action}</div>}</div>}

export function ReportCard({report}: {report:Report}) { return <article className="report-card"><Link to={`/laporan/${report.code}`} className={`report-art ${report.tone}`} aria-label={`Lihat laporan: ${report.title}`}><span className="art-symbol"><CategoryIcon category={report.category} size={30}/></span><span className="art-code">{report.code}</span></Link><div className="report-card-body"><div className="card-meta"><span>{report.category}</span><span className="meta-dot"/><span>{report.date}</span></div><Link className="report-title" to={`/laporan/${report.code}`}>{report.title}</Link><div className="report-place"><MapPin size={14}/>{report.village}, {report.district}</div><div className="card-bottom"><StatusBadge status={report.status}/><Link className="round-link" to={`/laporan/${report.code}`} aria-label={`Buka laporan ${report.code}`}><ArrowUpRight size={17}/></Link></div></div></article> }

/** Varian kartu horizontal untuk daftar /laporan (desain 768 ke atas). */
export function ReportListCard({report}: {report:Report}) { return <article className="report-card report-card-row"><Link to={`/laporan/${report.code}`} className={`report-art ${report.tone}`} aria-label={`Lihat laporan: ${report.title}`}><span className="art-symbol"><CategoryIcon category={report.category} size={32}/></span><span className="art-code">{report.code}</span></Link><div className="report-card-body"><span className="report-category">{report.category}</span><Link className="report-title" to={`/laporan/${report.code}`}>{report.title}</Link><div className="report-place"><MapPin size={14}/>{report.village}, {report.district}</div><span className="report-date">{report.date}</span><div className="report-status"><StatusBadge status={report.status}/></div></div></article> }

export function StatCard({label,value,detail,icon}:{label:string;value:string;detail:string;icon:ReactNode}){return <article className="stat-card"><div className="stat-top"><span>{label}</span><i>{icon}</i></div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></article>}

export type TimelineEntry = { at:string; title:string; note:string }

export function Dropdown({label,value,options,onChange,icon,labelledBy}:{label:string;value:string;options:{value:string;label:string}[];onChange:(v:string)=>void;icon?:ReactNode;labelledBy?:string}){
  const [open,setOpen]=useState(false)
  const ref=useRef<HTMLDivElement>(null)
  useEffect(()=>{
    if(!open) return
    const close=(e:MouseEvent)=>{if(ref.current&&!(e.target as Node).contains(ref.current))setOpen(false)}
    document.addEventListener('mousedown',close)
    return()=>document.removeEventListener('mousedown',close)
  },[open])
  const selected=options.find(o=>o.value===value)?.label??value
  return <div className="select-field" ref={ref}>
    {icon}
    <button type="button" className="select-trigger" onClick={()=>setOpen(!open)} aria-label={labelledBy?undefined:label} aria-labelledby={labelledBy} aria-haspopup="listbox" aria-expanded={open}>
      <span>{selected}</span>
      <ChevronDown size={15} className={open?'select-chev open':'select-chev'}/>
    </button>
    {open&&<div className="select-menu" role="listbox" aria-labelledby={labelledBy}>
      {options.map(o=><button key={o.value} type="button" role="option" aria-selected={o.value===value} className={`select-option ${o.value===value?'selected':''}`} onClick={()=>{onChange(o.value);setOpen(false)}}>{o.label}</button>)}
    </div>}
  </div>
}

export function Timeline({report,history}:{report:Report;history?:TimelineEntry[]}){if(history?.length)return <div className="timeline">{history.map((entry,i)=><div className="timeline-item done" key={`${entry.at}-${i}`}><span className="timeline-dot"><Check size={13}/></span><div><div className="timeline-title">{entry.title}</div><p>{entry.note}</p><small>{entry.at}</small></div></div>)}</div>;return <div className="timeline"><div className="timeline-item done"><span className="timeline-dot"><Check size={13}/></span><div><div className="timeline-title">Laporan dicatat</div><p>Laporan diterima oleh sistem.</p><small>{report.date}</small></div></div></div>}

export function TextField({label,id,hint,type='text',required=true,placeholder}:{label:string;id:string;hint?:string;type?:string;required?:boolean;placeholder?:string}){return <div className="form-field"><label htmlFor={id}>{label}{required&&<span aria-hidden="true"> *</span>}</label><input id={id} name={id} type={type} required={required} placeholder={placeholder}/>{hint&&<small>{hint}</small>}</div>}
