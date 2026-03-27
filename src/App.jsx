import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";
import { supabase } from "./supabaseClient";

// ─── Constants ─────────────────────────────────────────────────────────────
const PAGES = { TIMER: "timer", TASKS: "tasks", ANALYSIS: "analysis", CALENDAR: "calendar", REFLECTION: "reflection", SLEEP: "sleep" };
const QUOTES = ["Develop the quality of being unstoppable.", "Don't let your Mind and Body Betray you.", "Discipline is the bridge between goals and accomplishment."];
const TAG_COLORS = ["#6366f1","#f43f5e","#10b981","#f59e0b","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#f97316","#84cc16"];

// ─── Global CSS ─────────────────────────────────────────────────────────────
const G = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { width: 100%; min-height: 100vh; }
  body { font-family: 'DM Sans', sans-serif; background: #f0eeea; color: #111; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
  input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
  .r:hover { background: rgba(255,255,255,0.05) !important; }
  .rc:hover { background: rgba(0,0,0,0.03) !important; }
  .pop:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(0,0,0,0.15) !important; }
  .pop { transition: transform 0.2s, box-shadow 0.2s; }
  .fade { animation: f 0.3s ease both; }
  @keyframes f { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  .s1{animation-delay:0.04s;opacity:0} .s2{animation-delay:0.08s;opacity:0} .s3{animation-delay:0.12s;opacity:0} .s4{animation-delay:0.16s;opacity:0}
`;

// ─── Sound ───────────────────────────────────────────────────────────────────
let bellReady = false; let bellSynth = null;
function initBell() { if (bellReady) return; bellSynth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sine" }, envelope: { attack: 0.005, decay: 0.8, sustain: 0.01, release: 1.2 }, volume: -6 }).toDestination(); bellReady = true; }
function playBell() { try { if (!bellReady) initBell(); Tone.start(); const n = Tone.now(); bellSynth.triggerAttackRelease("C6","8n",n); bellSynth.triggerAttackRelease("E6","8n",n+0.15); bellSynth.triggerAttackRelease("G6","8n",n+0.3); bellSynth.triggerAttackRelease("C7","4n",n+0.5); } catch(e){} }
function playPop(note) { try { Tone.start(); const s = new Tone.Synth({oscillator:{type:"triangle"},envelope:{attack:0.005,decay:0.15,sustain:0,release:0.1},volume:-8}).toDestination(); s.triggerAttackRelease(note,"16n"); setTimeout(()=>s.dispose(),500); } catch(e){} }

// ─── Supabase ─────────────────────────────────────────────────────────────────
async function loadSessions() { const {data,error}=await supabase.from("sessions").select("*").order("ts",{ascending:true}); if(error) return []; return data.map(r=>({id:r.id,tag:r.tag,duration:r.duration,date:r.date,ts:Number(r.ts)})); }
async function insertSession(s) { const {data:{user}}=await supabase.auth.getUser(); if(!user) return null; const {data,error}=await supabase.from("sessions").insert({user_id:user.id,...s}).select().single(); if(error) return null; return data; }
async function loadReflections() { const {data,error}=await supabase.from("reflections").select("*"); if(error) return {}; const m={}; data.forEach(r=>{m[r.date]={note:r.note||"",hrsOverride:r.hrs_override};}); return m; }
async function upsertReflection(date,note,hrsOverride) { const {data:{user}}=await supabase.auth.getUser(); if(!user) return; await supabase.from("reflections").upsert({user_id:user.id,date,note,hrs_override:hrsOverride},{onConflict:"user_id,date"}); }
async function loadTasks() { const {data,error}=await supabase.from("tasks").select("*").order("created_at",{ascending:true}); if(error) return []; return data; }
async function insertTask(title,date,timeSlot) { const {data:{user}}=await supabase.auth.getUser(); if(!user) return null; const {data,error}=await supabase.from("tasks").insert({user_id:user.id,title,date,time_slot:timeSlot||null}).select().single(); if(error) return null; return data; }
async function updateTaskCompleted(id,val) { await supabase.from("tasks").update({completed_date:val}).eq("id",id); }
async function deleteTask(id) { await supabase.from("tasks").delete().eq("id",id); }
async function loadSleepLogs() { const {data,error}=await supabase.from("sleep_logs").select("*").order("date",{ascending:false}); if(error) return []; return data; }
async function upsertSleepLog(date,sleepStart,wakeUp,totalMins) { const {data:{user}}=await supabase.auth.getUser(); if(!user) return null; const {data,error}=await supabase.from("sleep_logs").upsert({user_id:user.id,date,sleep_start:sleepStart,wake_up:wakeUp,total_mins:totalMins},{onConflict:"user_id,date"}).select().single(); if(error) return null; return data; }

// ─── Utils ────────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0,10);
const fmtTime = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
function fmtHM(m) { const h=Math.floor(m/60),r=m%60; if(h===0)return`${r}m`; if(r===0)return`${h}h`; return`${h}h ${r}m`; }
function calcStreak(sessions) { const dt={}; sessions.forEach(s=>{dt[s.date]=(dt[s.date]||0)+s.duration;}); let streak=0; const d=new Date(); if((dt[todayStr()]||0)>=120){streak=1;d.setDate(d.getDate()-1);}else d.setDate(d.getDate()-1); while(true){const k=d.toISOString().slice(0,10);if((dt[k]||0)>=120){streak++;d.setDate(d.getDate()-1);}else break;} return streak; }
function getFireDays(sessions) { const dt={}; sessions.forEach(s=>{dt[s.date]=(dt[s.date]||0)+s.duration;}); return new Set(Object.entries(dt).filter(([,m])=>m>=120).map(([d])=>d)); }
function getDayTotals(sessions) { const t={}; sessions.forEach(s=>{t[s.date]=(t[s.date]||0)+s.duration;}); return t; }
function isPast(d) { return d < todayStr(); }
function tc(tag, all) { return TAG_COLORS[all.indexOf(tag)%TAG_COLORS.length]; }
function getWeekRange(ds) { const d=new Date(ds+"T12:00:00"); const m=new Date(d); m.setDate(d.getDate()-((d.getDay()+6)%7)); return Array.from({length:7},(_,i)=>{const dd=new Date(m);dd.setDate(m.getDate()+i);return dd.toISOString().slice(0,10);}); }
function getMonthDates(y,mo) { return Array.from({length:new Date(y,mo+1,0).getDate()},(_,i)=>`${y}-${String(mo+1).padStart(2,"0")}-${String(i+1).padStart(2,"0")}`); }

// ─── Design tokens ────────────────────────────────────────────────────────────
const SIDEBAR_W = 220;
const DARK = "#0f0f0f";
const ACCENT = "#6366f1"; // indigo
const S = "'Syne', sans-serif";
const D = "'DM Sans', sans-serif";

// ─── Primitives ───────────────────────────────────────────────────────────────
function Chip({children, color="#6366f1", style={}}) {
  return <span style={{fontFamily:D,fontSize:11,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",padding:"3px 10px",borderRadius:20,background:color+"22",color,display:"inline-block",...style}}>{children}</span>;
}

function Btn({children,onClick,variant="primary",size="md",disabled,full,style={}}) {
  const sz = size==="sm" ? {padding:"7px 16px",fontSize:11} : size==="lg" ? {padding:"14px 36px",fontSize:13} : {padding:"9px 22px",fontSize:12};
  const vs = {
    primary: {background:ACCENT,color:"#fff",border:"none"},
    dark: {background:DARK,color:"#fff",border:"none"},
    ghost: {background:"transparent",color:DARK,border:"1.5px solid rgba(0,0,0,0.15)"},
    white: {background:"white",color:DARK,border:"none"},
    danger: {background:"#f43f5e",color:"#fff",border:"none"},
  };
  return <button onClick={onClick} disabled={disabled} style={{...sz,fontFamily:D,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase",cursor:disabled?"default":"pointer",borderRadius:10,transition:"all 0.15s",outline:"none",opacity:disabled?0.4:1,width:full?"100%":undefined,...vs[variant],...style}}>{children}</button>;
}

function TIn({value,onChange,placeholder,type="text",onKeyDown,style={},autoFocus,multiline}) {
  const base = {fontFamily:D,fontSize:14,fontWeight:400,color:DARK,background:"white",border:"1.5px solid #e8e8e8",borderRadius:10,padding:"11px 14px",outline:"none",width:"100%",transition:"border-color 0.15s,box-shadow 0.15s",...style};
  if(multiline) return <textarea value={value} onChange={onChange} placeholder={placeholder} style={{...base,resize:"none"}} onFocus={e=>{e.target.style.borderColor=ACCENT;e.target.style.boxShadow=`0 0 0 3px ${ACCENT}18`;}} onBlur={e=>{e.target.style.borderColor="#e8e8e8";e.target.style.boxShadow="none";}} />;
  return <input value={value} onChange={onChange} placeholder={placeholder} type={type} onKeyDown={onKeyDown} autoFocus={autoFocus} style={base} onFocus={e=>{e.target.style.borderColor=ACCENT;e.target.style.boxShadow=`0 0 0 3px ${ACCENT}18`;}} onBlur={e=>{e.target.style.borderColor="#e8e8e8";e.target.style.boxShadow="none";}} />;
}

function Panel({children,style={}}) {
  return <div className="pop" style={{background:"white",borderRadius:16,border:"1px solid rgba(0,0,0,0.06)",overflow:"hidden",...style}}>{children}</div>;
}

function PH({children,style={}}) { return <div style={{padding:"22px 24px",...style}}>{children}</div>; }

function Lbl({children,style={}}) {
  return <div style={{fontFamily:S,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.18em",color:"#999",marginBottom:12,...style}}>{children}</div>;
}

function SectionTitle({children,right}) {
  return <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
    <h2 style={{fontFamily:S,fontSize:22,fontWeight:700,color:DARK,letterSpacing:"-0.01em"}}>{children}</h2>
    {right&&<div>{right}</div>}
  </div>;
}

// ─── Auth Page ─────────────────────────────────────────────────────────────────
function AuthPage() {
  const [isLogin,setIsLogin]=useState(true);
  const [email,setEmail]=useState(""); const [pw,setPw]=useState("");
  const [err,setErr]=useState(""); const [loading,setLoading]=useState(false);
  const [sent,setSent]=useState(false);

  const submit = async () => {
    setErr(""); if(!email.trim()||!pw.trim()){setErr("Fill all fields");return;} if(pw.length<6){setErr("Password min 6 chars");return;}
    setLoading(true);
    try { if(isLogin){const{error:e}=await supabase.auth.signInWithPassword({email,password:pw});if(e)throw e;} else{const{error:e}=await supabase.auth.signUp({email,password:pw});if(e)throw e;setSent(true);setLoading(false);return;} } catch(e){setErr(e.message||"Something went wrong");}
    setLoading(false);
  };
  const forgotPw = async () => { setErr(""); if(!email.trim()){setErr("Enter email first");return;} setLoading(true); try{const{error:e}=await supabase.auth.resetPasswordForEmail(email);if(e)throw e;setSent(true);}catch(e){setErr(e.message);} setLoading(false); };

  if(sent) return (
    <div style={{minHeight:"100vh",width:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"#0f0f0f"}}>
      <style>{G}</style>
      <div className="fade" style={{textAlign:"center",color:"white",padding:"0 24px",maxWidth:400}}>
        <div style={{fontSize:56,marginBottom:20}}>✉️</div>
        <h2 style={{fontFamily:S,fontSize:36,fontWeight:700,marginBottom:12}}>Check your inbox</h2>
        <p style={{fontFamily:D,color:"rgba(255,255,255,0.5)",fontSize:15,lineHeight:1.7,marginBottom:32}}>We sent a link to <strong style={{color:"white"}}>{email}</strong></p>
        <Btn variant="white" size="lg" onClick={()=>{setSent(false);setIsLogin(true);}}>Back to Login</Btn>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",width:"100%",display:"flex"}}>
      <style>{G}</style>
      {/* Left dark panel */}
      <div style={{width:"45%",background:DARK,display:"flex",flexDirection:"column",padding:"60px 56px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-100,right:-100,width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(99,102,241,0.12) 0%,transparent 70%)"}} />
        <div style={{position:"absolute",bottom:-80,left:-80,width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,rgba(99,102,241,0.08) 0%,transparent 70%)"}} />
        <div style={{position:"relative",zIndex:1}}>
          <div style={{fontFamily:S,fontSize:13,fontWeight:700,letterSpacing:"0.2em",textTransform:"uppercase",color:"rgba(255,255,255,0.4)",marginBottom:48}}>Focus Maxing</div>
          <h1 style={{fontFamily:S,fontSize:52,fontWeight:800,color:"white",lineHeight:1.1,marginBottom:20}}>Track.<br />Grow.<br /><span style={{color:ACCENT}}>Win.</span></h1>
          <p style={{fontFamily:D,fontSize:15,color:"rgba(255,255,255,0.4)",lineHeight:1.8,marginBottom:52}}>Your personal upskilling dashboard. Hit 2h daily, build your streak, and become unstoppable.</p>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {["⏱  Pomodoro timer with auto-logging","📊  Deep analysis & personal bests","🔥  Streak tracking & fire days","😴  Sleep optimization"].map((t,i)=>(
              <div key={i} style={{fontFamily:D,fontSize:14,color:"rgba(255,255,255,0.5)",display:"flex",alignItems:"center",gap:12}}>{t}</div>
            ))}
          </div>
        </div>
        <div style={{position:"relative",zIndex:1,marginTop:"auto",fontFamily:D,fontSize:12,color:"rgba(255,255,255,0.2)"}}>Vibe coded by Nithin Chowdary ❤️</div>
      </div>

      {/* Right form panel */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:"#f8f7f4",padding:"60px 56px"}}>
        <div className="fade" style={{width:"100%",maxWidth:380}}>
          <h2 style={{fontFamily:S,fontSize:30,fontWeight:700,marginBottom:6}}>{isLogin?"Welcome back":"Create account"}</h2>
          <p style={{fontFamily:D,fontSize:14,color:"#888",marginBottom:32}}>{isLogin?"Sign in to your dashboard":"Start your upskilling journey"}</p>

          <div style={{display:"flex",gap:0,marginBottom:28,background:"white",borderRadius:10,padding:3,border:"1.5px solid #e8e8e8"}}>
            {["Login","Sign Up"].map((lbl,i)=>{const a=i===0?isLogin:!isLogin; return <button key={lbl} onClick={()=>{setIsLogin(i===0);setErr("");}} style={{flex:1,padding:"9px 0",border:"none",cursor:"pointer",background:a?DARK:"transparent",color:a?"#fff":"#aaa",fontSize:12,fontFamily:D,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",borderRadius:8,transition:"all 0.2s"}}>{lbl}</button>; })}
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:20}}>
            <TIn value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" type="email" onKeyDown={e=>e.key==="Enter"&&submit()} />
            <TIn value={pw} onChange={e=>setPw(e.target.value)} placeholder="Password" type="password" onKeyDown={e=>e.key==="Enter"&&submit()} />
          </div>

          {isLogin&&<div style={{textAlign:"right",marginBottom:16}}><button onClick={forgotPw} style={{border:"none",background:"none",cursor:"pointer",fontSize:12,fontFamily:D,color:"#aaa",textDecoration:"underline",textUnderlineOffset:3}}>Forgot password?</button></div>}
          {err&&<div style={{fontFamily:D,fontSize:13,color:"#f43f5e",marginBottom:12,padding:"10px 14px",background:"#fff5f7",borderRadius:8,fontWeight:500}}>{err}</div>}

          <Btn variant="dark" size="lg" onClick={submit} disabled={loading} full>{loading?"...":isLogin?"Sign In →":"Create Account →"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({page,setPage,streak,todayMins,email,onLogout}) {
  const hit = todayMins>=120;
  const nav = [
    {key:PAGES.TIMER, icon:"⏱", label:"Timer"},
    {key:PAGES.TASKS, icon:"✓", label:"Tasks"},
    {key:PAGES.ANALYSIS, icon:"◈", label:"Analysis"},
    {key:PAGES.CALENDAR, icon:"◻", label:"Calendar"},
    {key:PAGES.REFLECTION, icon:"✦", label:"Reflect"},
    {key:PAGES.SLEEP, icon:"◑", label:"Sleep"},
  ];
  return (
    <div style={{width:SIDEBAR_W,minHeight:"100vh",background:DARK,display:"flex",flexDirection:"column",position:"fixed",top:0,left:0,bottom:0,zIndex:100}}>
      {/* Brand */}
      <div style={{padding:"28px 24px 20px"}}>
        <div style={{fontFamily:S,fontSize:15,fontWeight:800,color:"white",letterSpacing:"0.08em",textTransform:"uppercase"}}>Focus</div>
        <div style={{fontFamily:S,fontSize:15,fontWeight:800,color:ACCENT,letterSpacing:"0.08em",textTransform:"uppercase"}}>Maxing</div>
      </div>

      {/* Today summary card */}
      <div style={{margin:"0 16px 24px",background:hit?"rgba(99,102,241,0.15)":"rgba(244,63,94,0.1)",borderRadius:12,padding:"14px 16px",border:`1px solid ${hit?"rgba(99,102,241,0.3)":"rgba(244,63,94,0.2)"}`}}>
        <div style={{fontFamily:S,fontSize:9,fontWeight:700,letterSpacing:"0.18em",textTransform:"uppercase",color:"rgba(255,255,255,0.4)",marginBottom:6}}>Today</div>
        <div style={{fontFamily:S,fontSize:28,fontWeight:700,color:hit?"#a5b4fc":"#fca5a5",lineHeight:1}}>{fmtHM(todayMins)}</div>
        <div style={{fontFamily:D,fontSize:12,color:"rgba(255,255,255,0.35)",marginTop:4}}>{hit?"🔥 Target hit!":"Goal: 2 hours"}</div>
      </div>

      {/* Streak */}
      <div style={{margin:"0 16px 24px",display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"rgba(255,255,255,0.04)",borderRadius:10}}>
        <span style={{fontSize:20}}>{streak>0?"🔥":"○"}</span>
        <div><div style={{fontFamily:S,fontSize:16,fontWeight:700,color:"white",lineHeight:1}}>{streak}</div><div style={{fontFamily:D,fontSize:11,color:"rgba(255,255,255,0.35)"}}>day streak</div></div>
      </div>

      {/* Nav */}
      <div style={{flex:1,padding:"0 12px",display:"flex",flexDirection:"column",gap:2}}>
        {nav.map(item=>{
          const active=page===item.key;
          return (
            <button key={item.key} className={active?"":"r"} onClick={()=>setPage(item.key)} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",border:"none",background:active?"rgba(99,102,241,0.2)":"transparent",borderRadius:10,cursor:"pointer",transition:"background 0.15s",textAlign:"left",width:"100%"}}>
              <span style={{fontSize:14,opacity:active?1:0.5,color:active?ACCENT:"white",minWidth:18,textAlign:"center"}}>{item.icon}</span>
              <span style={{fontFamily:D,fontSize:13,fontWeight:active?600:400,color:active?"white":"rgba(255,255,255,0.5)",letterSpacing:"0.01em"}}>{item.label}</span>
              {active&&<div style={{marginLeft:"auto",width:4,height:4,borderRadius:"50%",background:ACCENT}} />}
            </button>
          );
        })}
      </div>

      {/* User */}
      <div style={{padding:"16px 20px",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
        <div style={{fontFamily:D,fontSize:12,color:"rgba(255,255,255,0.3)",marginBottom:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{email||"user"}</div>
        <button onClick={onLogout} style={{fontFamily:D,fontSize:11,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",color:"rgba(255,255,255,0.3)",background:"none",border:"1px solid rgba(255,255,255,0.1)",padding:"7px 14px",borderRadius:8,cursor:"pointer",width:"100%",transition:"all 0.15s"}} onMouseEnter={e=>{e.target.style.color="white";e.target.style.borderColor="rgba(255,255,255,0.3)";}} onMouseLeave={e=>{e.target.style.color="rgba(255,255,255,0.3)";e.target.style.borderColor="rgba(255,255,255,0.1)";}}>Logout</button>
      </div>
    </div>
  );
}

// ─── Top Header Bar ───────────────────────────────────────────────────────────
function TopBar({sessions, page}) {
  const [qi,setQi]=useState(0);
  const titles={timer:"Timer",tasks:"Tasks",analysis:"Analysis",calendar:"Calendar",reflection:"Reflect",sleep:"Sleep"};
  useEffect(()=>{const t=setInterval(()=>setQi(p=>(p+1)%QUOTES.length),12000);return()=>clearInterval(t);},[]);
  const dt=getDayTotals(sessions);
  const weekDays=getWeekRange(todayStr());
  const todayKey=todayStr();
  const DLABELS=["M","T","W","T","F","S","S"];

  return (
    <div style={{height:60,background:"rgba(240,238,234,0.9)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderBottom:"1px solid rgba(0,0,0,0.06)",display:"flex",alignItems:"center",padding:"0 32px",gap:0,position:"sticky",top:0,zIndex:50}}>
      {/* Page title */}
      <h1 style={{fontFamily:S,fontSize:17,fontWeight:700,color:DARK,letterSpacing:"0.02em",marginRight:"auto"}}>{titles[page]}</h1>

      {/* Week streak dots */}
      <div style={{display:"flex",gap:6,alignItems:"center",marginRight:28}}>
        {weekDays.map((d,i)=>{
          const m=dt[d]||0; const fire=m>=120; const missed=isPast(d)&&!fire; const today=d===todayKey;
          return <div key={d} title={d} style={{width:fire?28:24,height:fire?28:24,borderRadius:"50%",background:fire?"#6366f1":missed?"#fee2e2":today?"rgba(0,0,0,0.08)":"rgba(0,0,0,0.04)",border:today&&!fire?"2px solid #6366f1":"2px solid transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s"}}>
            <span style={{fontSize:fire?12:9,color:fire?"white":missed?"#f87171":"#bbb",fontWeight:700}}>{fire?"🔥":missed?"✕":DLABELS[i]}</span>
          </div>;
        })}
      </div>

      {/* Quote */}
      <div style={{fontFamily:D,fontSize:12,fontStyle:"italic",color:"#aaa",maxWidth:280,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>"{QUOTES[qi]}"</div>
    </div>
  );
}

// ─── Content wrapper ──────────────────────────────────────────────────────────
function Content({children}) {
  return <div className="fade" style={{padding:"32px 32px 80px"}}>{children}</div>;
}

// ─── TIMER PAGE ───────────────────────────────────────────────────────────────
function TimerPage({sessions, setSessions}) {
  const [tag,setTag]=useState(()=>sessionStorage.getItem("sl_tag")||"");
  const [running,setRunning]=useState(()=>sessionStorage.getItem("sl_running")==="true");
  const [elapsed,setElapsed]=useState(()=>{const st=sessionStorage.getItem("sl_startTs");if(sessionStorage.getItem("sl_running")==="true"&&st)return Math.floor((Date.now()-Number(st))/1000);const sv=sessionStorage.getItem("sl_elapsed");return sv?Number(sv):0;});
  const [mode,setMode]=useState(()=>sessionStorage.getItem("sl_mode")||"focus");
  const [focusMins,setFocusMins]=useState(()=>Number(sessionStorage.getItem("sl_focusMins"))||60);
  const [breakMins,setBreakMins]=useState(()=>Number(sessionStorage.getItem("sl_breakMins"))||5);
  const [editing,setEditing]=useState(false); const [tf,setTf]=useState("60"); const [tb,setTb]=useState("5");
  const iRef=useRef(null); const stRef=useRef(null);

  useEffect(()=>{sessionStorage.setItem("sl_tag",tag);},[tag]);
  useEffect(()=>{sessionStorage.setItem("sl_mode",mode);},[mode]);
  useEffect(()=>{sessionStorage.setItem("sl_focusMins",String(focusMins));},[focusMins]);
  useEffect(()=>{sessionStorage.setItem("sl_breakMins",String(breakMins));},[breakMins]);
  useEffect(()=>{sessionStorage.setItem("sl_running",String(running));if(running)sessionStorage.setItem("sl_startTs",String(Date.now()-elapsed*1000));else{sessionStorage.setItem("sl_elapsed",String(elapsed));sessionStorage.removeItem("sl_startTs");}},[ running]);

  const fD=focusMins*60; const bD=breakMins*60;
  const remaining=mode==="focus"?Math.max(fD-elapsed,0):Math.max(bD-elapsed,0);
  const progress=1-remaining/(mode==="focus"?fD:bD);

  useEffect(()=>{if(running){stRef.current=Date.now()-elapsed*1000;iRef.current=setInterval(()=>setElapsed(Math.floor((Date.now()-stRef.current)/1000)),200);}else clearInterval(iRef.current);return()=>clearInterval(iRef.current);},[running]);
  useEffect(()=>{const h=()=>{if(document.visibilityState==="visible"){const st=sessionStorage.getItem("sl_startTs");if(sessionStorage.getItem("sl_running")==="true"&&st){setElapsed(Math.floor((Date.now()-Number(st))/1000));stRef.current=Number(st);}}};document.addEventListener("visibilitychange",h);return()=>document.removeEventListener("visibilitychange",h);},[]);

  const addS=useCallback(async(s)=>{setSessions(p=>[...p,s]);const sv=await insertSession(s);if(sv)setSessions(p=>p.map(x=>x.ts===s.ts&&x.tag===s.tag?{id:sv.id,tag:sv.tag,duration:sv.duration,date:sv.date,ts:Number(sv.ts)}:x));},[setSessions]);

  useEffect(()=>{if(remaining<=0&&running){setRunning(false);playBell();if(mode==="focus"){addS({id:Date.now(),tag:tag||"Untitled",duration:Math.round(fD/60),date:todayStr(),ts:Date.now()});setMode("break");setElapsed(0);}else{setMode("focus");setElapsed(0);}}},[remaining,running]);

  const toggle=()=>{if(!running){initBell();playPop("G5");}else playPop("D5");setRunning(!running);};
  const reset=()=>{setRunning(false);setElapsed(0);};
  const skip=()=>{setRunning(false);if(mode==="focus"){if(elapsed>30)addS({id:Date.now(),tag:tag||"Untitled",duration:Math.max(1,Math.round(elapsed/60)),date:todayStr(),ts:Date.now()});setMode("break");}else setMode("focus");setElapsed(0);};

  const [mTag,setMTag]=useState(""); const [mMin,setMMin]=useState("");
  const logM=()=>{const m=parseInt(mMin);if(!mTag.trim()||isNaN(m)||m<=0)return;addS({id:Date.now(),tag:mTag.trim(),duration:m,date:todayStr(),ts:Date.now()});setMTag("");setMMin("");};

  const todaySess=sessions.filter(s=>s.date===todayStr());
  const todayTotal=todaySess.reduce((a,s)=>a+s.duration,0);
  const R=100; const C=2*Math.PI*R;
  const allTags=[...new Set(sessions.map(s=>s.tag))];

  return (
    <Content>
      <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:24}}>
        {/* Timer Panel */}
        <div style={{display:"flex",flexDirection:"column",gap:20}}>
          {/* Study input */}
          <Panel>
            <PH>
              <input value={tag} onChange={e=>setTag(e.target.value)} placeholder="What are you studying right now?"
                style={{fontFamily:S,fontSize:20,fontWeight:600,color:DARK,background:"transparent",border:"none",outline:"none",width:"100%"}}
                onFocus={e=>e.target.style.opacity="1"} onBlur={e=>e.target.style.opacity="1"} />
            </PH>
          </Panel>

          {/* Circle Timer */}
          <Panel style={{textAlign:"center"}}>
            <PH style={{paddingTop:32,paddingBottom:32}}>
              {/* Mode toggle */}
              <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:32}}>
                {["focus","break"].map(m=>(
                  <button key={m} onClick={()=>{setMode(m);setElapsed(0);setRunning(false);}} style={{fontFamily:D,fontSize:11,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",padding:"5px 16px",borderRadius:20,border:"none",cursor:"pointer",background:mode===m?DARK:"rgba(0,0,0,0.05)",color:mode===m?"white":"#aaa",transition:"all 0.15s"}}>{m}</button>
                ))}
              </div>

              {/* SVG ring */}
              <div style={{position:"relative",width:240,height:240,margin:"0 auto 32px"}}>
                <svg width={240} height={240} style={{transform:"rotate(-90deg)"}}>
                  <circle cx={120} cy={120} r={R} fill="none" stroke="#f0f0f0" strokeWidth={8} />
                  <circle cx={120} cy={120} r={R} fill="none" stroke={mode==="focus"?ACCENT:"#10b981"} strokeWidth={8} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C*(1-progress)} style={{transition:"stroke-dashoffset 0.3s ease,stroke 0.4s"}} />
                </svg>
                <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                  <div style={{fontFamily:S,fontSize:48,fontWeight:700,color:DARK,letterSpacing:"-0.04em",lineHeight:1}}>{fmtTime(remaining)}</div>
                  <div style={{fontFamily:D,fontSize:12,color:"#bbb",marginTop:4,textTransform:"uppercase",letterSpacing:"0.1em"}}>{mode==="focus"?`${focusMins}m focus`:`${breakMins}m break`}</div>
                </div>
              </div>

              <div style={{display:"flex",justifyContent:"center",gap:10}}>
                <Btn variant={running?"ghost":"dark"} size="lg" onClick={toggle}>{running?"⏸ Pause":"▶ Start"}</Btn>
                <Btn variant="ghost" onClick={reset}>Reset</Btn>
                <Btn variant="ghost" onClick={skip}>Skip →</Btn>
              </div>

              {/* Config */}
              <div style={{marginTop:20}}>
                {editing?(
                  <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                    <span style={{fontFamily:D,fontSize:12,color:"#aaa"}}>Focus</span>
                    <input value={tf} onChange={e=>setTf(e.target.value)} type="number" style={{width:52,border:"1.5px solid #e8e8e8",borderRadius:8,padding:"6px 8px",fontSize:13,fontFamily:D,textAlign:"center",outline:"none"}} />
                    <span style={{fontFamily:D,fontSize:12,color:"#aaa"}}>Break</span>
                    <input value={tb} onChange={e=>setTb(e.target.value)} type="number" style={{width:52,border:"1.5px solid #e8e8e8",borderRadius:8,padding:"6px 8px",fontSize:13,fontFamily:D,textAlign:"center",outline:"none"}} />
                    <span style={{fontFamily:D,fontSize:12,color:"#aaa"}}>min</span>
                    <Btn size="sm" onClick={()=>{const f=parseInt(tf),b=parseInt(tb);if(f>0)setFocusMins(f);if(b>0)setBreakMins(b);setElapsed(0);setRunning(false);setEditing(false);}}>Set</Btn>
                    <Btn size="sm" variant="ghost" onClick={()=>setEditing(false)}>✕</Btn>
                  </div>
                ):(
                  <button onClick={()=>{setTf(String(focusMins));setTb(String(breakMins));setEditing(true);}} style={{border:"none",background:"none",cursor:"pointer",fontFamily:D,fontSize:12,color:"#ccc",textDecoration:"underline",textUnderlineOffset:3}}>⚙ Configure timer</button>
                )}
              </div>
            </PH>
          </Panel>

          {/* Quick Log */}
          <Panel>
            <PH>
              <Lbl>Quick Log</Lbl>
              <div style={{display:"flex",gap:8}}>
                <TIn value={mTag} onChange={e=>setMTag(e.target.value)} placeholder="Topic / tag" style={{flex:1}} />
                <TIn value={mMin} onChange={e=>setMMin(e.target.value)} placeholder="mins" type="number" style={{width:80}} />
                <Btn onClick={logM}>+ Log</Btn>
              </div>
            </PH>
          </Panel>
        </div>

        {/* Right: Today's log */}
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {/* Today header */}
          <Panel>
            <PH style={{textAlign:"center",paddingTop:28,paddingBottom:28}}>
              <div style={{fontFamily:S,fontSize:10,fontWeight:700,letterSpacing:"0.18em",textTransform:"uppercase",color:"#aaa",marginBottom:8}}>Today's Total</div>
              <div style={{fontFamily:S,fontSize:52,fontWeight:800,color:todayTotal>=120?"#6366f1":DARK,lineHeight:1}}>{fmtHM(todayTotal)}</div>
              {todayTotal>=120&&<div style={{marginTop:8}}><Chip color="#6366f1">Target Hit 🔥</Chip></div>}
              {todayTotal>0&&todayTotal<120&&<div style={{marginTop:10,height:4,background:"#f0f0f0",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",background:ACCENT,width:`${(todayTotal/120)*100}%`,transition:"width 0.3s",borderRadius:2}} /></div>}
            </PH>
          </Panel>

          {/* Session list */}
          <Panel style={{flex:1}}>
            <PH style={{paddingBottom:0}}>
              <Lbl>Sessions</Lbl>
            </PH>
            {todaySess.length===0?(
              <div style={{padding:"24px",textAlign:"center",fontFamily:D,fontSize:13,color:"#ccc"}}>No sessions yet</div>
            ):todaySess.map(s=>{
              const color=tc(s.tag,allTags);
              return <div key={s.id} className="rc" style={{display:"flex",alignItems:"center",gap:12,padding:"12px 24px",borderBottom:"1px solid #f5f5f5",transition:"background 0.1s"}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:color,flexShrink:0}} />
                <span style={{flex:1,fontFamily:D,fontSize:13,fontWeight:500}}>{s.tag}</span>
                <span style={{fontFamily:S,fontSize:14,fontWeight:600,color:"#888"}}>{fmtHM(s.duration)}</span>
              </div>;
            })}
          </Panel>
        </div>
      </div>
    </Content>
  );
}

// ─── TASKS PAGE ───────────────────────────────────────────────────────────────
function TasksPage({tasks,setTasks}) {
  const [selDate,setSelDate]=useState(todayStr());
  const [newTask,setNewTask]=useState("");
  const shift=dir=>{const d=new Date(selDate+"T12:00:00");d.setDate(d.getDate()+dir);setSelDate(d.toISOString().slice(0,10));};
  const isToday=selDate===todayStr();
  const dl=isToday?"Today":new Date(selDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
  const dayTasks=tasks.filter(t=>t.date===selDate&&!t.time_slot);
  const plannerTasks=tasks.filter(t=>t.date===selDate&&t.time_slot);
  const add=async()=>{if(!newTask.trim())return;const s=await insertTask(newTask.trim(),selDate,null);if(s)setTasks(p=>[...p,s]);setNewTask("");};
  const toggle=async t=>{const nv=t.completed_date?null:todayStr();await updateTaskCompleted(t.id,nv);setTasks(p=>p.map(x=>x.id===t.id?{...x,completed_date:nv}:x));};
  const remove=async id=>{await deleteTask(id);setTasks(p=>p.filter(t=>t.id!==id));};
  const addPlanner=async(slotKey,title)=>{if(!title.trim()||plannerTasks.find(t=>t.time_slot===slotKey))return;const s=await insertTask(title.trim(),selDate,slotKey);if(s)setTasks(p=>[...p,s]);};
  const slots=[];for(let h=4;h<=23;h++){const f=hr=>hr===0?"12 AM":hr<12?`${hr} AM`:hr===12?"12 PM":`${hr-12} PM`;slots.push({label:`${f(h)}`,key:`${h}-${h+1}`});}
  const navB={border:"1px solid rgba(0,0,0,0.1)",background:"white",width:36,height:36,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:10};
  const done=dayTasks.filter(t=>t.completed_date).length;

  return (
    <Content>
      {/* Date nav */}
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:24}}>
        <button style={navB} onClick={()=>shift(-1)}>←</button>
        <h2 style={{fontFamily:S,fontSize:26,fontWeight:700,flex:1}}>{dl}</h2>
        <button style={navB} onClick={()=>shift(1)}>→</button>
        {isToday&&<Chip color="#6366f1">{new Date().toLocaleDateString("en-US",{weekday:"long"})}</Chip>}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 380px",gap:20}}>
        {/* Tasks */}
        <div>
          <Panel style={{marginBottom:16}}>
            <PH style={{paddingBottom:16}}>
              <div style={{display:"flex",gap:8}}>
                <TIn value={newTask} onChange={e=>setNewTask(e.target.value)} placeholder="Add a task..." onKeyDown={e=>e.key==="Enter"&&add()} style={{flex:1}} />
                <Btn onClick={add} variant="dark">Add</Btn>
              </div>
            </PH>
          </Panel>
          <Panel>
            <PH style={{paddingBottom:0}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                <Lbl style={{marginBottom:0}}>Tasks</Lbl>
                <span style={{fontFamily:D,fontSize:12,color:"#aaa"}}>{done}/{dayTasks.length} done</span>
              </div>
              {done>0&&<div style={{height:3,background:"#f0f0f0",borderRadius:2,marginBottom:16,overflow:"hidden"}}><div style={{height:"100%",background:ACCENT,width:`${(done/dayTasks.length)*100}%`,borderRadius:2,transition:"width 0.3s"}} /></div>}
            </PH>
            {dayTasks.length===0?(
              <div style={{padding:"32px",textAlign:"center",fontFamily:D,fontSize:13,color:"#ccc"}}>No tasks — add one above</div>
            ):dayTasks.map(t=>{
              const d=!!t.completed_date;
              return <div key={t.id} className="rc" style={{display:"flex",alignItems:"center",gap:14,padding:"14px 24px",borderBottom:"1px solid #f5f5f5",transition:"background 0.1s"}}>
                <button onClick={()=>toggle(t)} style={{width:22,height:22,borderRadius:6,border:d?"none":"1.5px solid #ddd",background:d?ACCENT:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:12,flexShrink:0,transition:"all 0.15s"}}>{d&&"✓"}</button>
                <span style={{flex:1,fontFamily:D,fontWeight:500,fontSize:14,textDecoration:d?"line-through":"none",color:d?"#ccc":DARK}}>{t.title}</span>
                <button onClick={()=>remove(t.id)} style={{border:"none",background:"none",cursor:"pointer",color:"#ddd",fontSize:15,opacity:0.5}} onMouseEnter={e=>e.target.style.opacity="1"} onMouseLeave={e=>e.target.style.opacity="0.5"}>✕</button>
              </div>;
            })}
            {dayTasks.length>0&&<div style={{height:4}} />}
          </Panel>
        </div>

        {/* Day Planner */}
        <div>
          <Panel>
            <PH style={{paddingBottom:0}}>
              <Lbl>Hour Planner</Lbl>
            </PH>
            <div style={{maxHeight:520,overflowY:"auto"}}>
              {slots.map((sl,i)=>{
                const st=plannerTasks.find(t=>t.time_slot===sl.key); const d=st&&!!st.completed_date;
                return <div key={sl.key} style={{display:"flex",borderBottom:i<slots.length-1?"1px solid #f8f8f8":"none",minHeight:42}}>
                  <div style={{width:68,padding:"11px 12px",background:"#fafafa",flexShrink:0,display:"flex",alignItems:"center",fontFamily:D,fontSize:11,fontWeight:500,color:"#ccc",borderRight:"1px solid #f0f0f0"}}>{sl.label}</div>
                  <div style={{flex:1,padding:"9px 14px",display:"flex",alignItems:"center",gap:10}}>
                    {st?<>
                      <button onClick={()=>toggle(st)} style={{width:18,height:18,borderRadius:4,border:d?"none":"1.5px solid #ddd",background:d?ACCENT:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:10,flexShrink:0}}>{d&&"✓"}</button>
                      <span style={{flex:1,fontFamily:D,fontSize:12,fontWeight:500,textDecoration:d?"line-through":"none",color:d?"#ccc":DARK}}>{st.title}</span>
                      <button onClick={()=>remove(st.id)} style={{border:"none",background:"none",cursor:"pointer",color:"#ddd",fontSize:13}}>✕</button>
                    </>:<SlotInput onAdd={t=>addPlanner(sl.key,t)} />}
                  </div>
                </div>;
              })}
            </div>
          </Panel>
        </div>
      </div>
    </Content>
  );
}

function SlotInput({onAdd}) {
  const [v,setV]=useState("");
  return <input value={v} onChange={e=>setV(e.target.value)} onKeyDown={e=>e.key==="Enter"&&v.trim()&&(onAdd(v.trim()),setV(""))} placeholder="+ task" style={{border:"none",background:"transparent",fontSize:12,fontFamily:D,outline:"none",color:"#ccc",width:"100%"}} />;
}

// ─── ANALYSIS ─────────────────────────────────────────────────────────────────
async function exportXLSX(sessions) {
  const X=await import("xlsx");
  const dm={}; sessions.forEach(s=>{dm[s.date]=(dm[s.date]||0)+s.duration;});
  const dd=Object.entries(dm).sort((a,b)=>a[0].localeCompare(b[0])).map(([d,m])=>({Date:d,Day:new Date(d+"T12:00:00").toLocaleDateString("en-US",{weekday:"long"}),"Hours":+(m/60).toFixed(2),"Status":m>=120?"🔥":"❌"}));
  const wm={}; Object.entries(dm).forEach(([d,m])=>{const dt=new Date(d+"T12:00:00");const mn=new Date(dt);mn.setDate(dt.getDate()-((dt.getDay()+6)%7));const sn=new Date(mn);sn.setDate(mn.getDate()+6);const l=`${mn.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${sn.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;wm[l]=(wm[l]||0)+m;});
  const mm={}; Object.entries(dm).forEach(([d,m])=>{const k=d.slice(0,7);mm[k]=(mm[k]||0)+m;});
  const tm={}; const tf={}; sessions.forEach(s=>{tm[s.tag]=(tm[s.tag]||0)+s.duration;if(!tf[s.tag]||s.date<tf[s.tag])tf[s.tag]=s.date;});
  const wb=X.utils.book_new();
  const add=(data,name,cols)=>{const ws=X.utils.json_to_sheet(data);ws["!cols"]=cols;X.utils.book_append_sheet(wb,ws,name);};
  add(dd,"Day-wise",[{wch:12},{wch:12},{wch:8},{wch:6}]);
  add(Object.entries(wm).map(([w,m])=>({Week:w,"Hours":+(m/60).toFixed(2)})),"Week-wise",[{wch:30},{wch:10}]);
  add(Object.entries(mm).sort((a,b)=>a[0].localeCompare(b[0])).map(([k,m])=>{const[y,mo]=k.split("-");return{Month:new Date(+y,+mo-1).toLocaleDateString("en-US",{month:"long",year:"numeric"}),"Hours":+(m/60).toFixed(2)};}),"Month-wise",[{wch:20},{wch:10}]);
  add(Object.entries(tm).sort((a,b)=>b[1]-a[1]).map(([tag,m])=>({Topic:tag,"Hours":+(m/60).toFixed(2),"Started":tf[tag]||""})),"Topic-wise",[{wch:20},{wch:10},{wch:12}]);
  X.writeFile(wb,`FocusMaxing_${todayStr()}.xlsx`);
}

function MiniBar({data,maxVal,height=120,isWeekly}) {
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:isWeekly?10:3,height:height+40,paddingTop:20,position:"relative"}}>
      {data.map((d,i)=>{
        const h=maxVal>0?(d.mins/maxVal)*height:0;
        const isPeak=d.mins===Math.max(...data.map(x=>x.mins))&&d.mins>0;
        const fire=d.mins>=120; const dl=isWeekly?new Date(d.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short"}):String(new Date(d.date+"T12:00:00").getDate());
        return <div key={d.date} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:height+40}}>
          {isWeekly&&d.mins>0&&<span style={{fontFamily:D,fontSize:9,fontWeight:600,marginBottom:3,color:isPeak?ACCENT:"#aaa"}}>{fmtHM(d.mins)}</span>}
          <div style={{width:"100%",height:h,background:fire?ACCENT:isPeak?"#f59e0b":"#e5e7eb",borderRadius:"3px 3px 0 0",transition:"height 0.4s ease",minHeight:d.mins>0?3:1}} />
          <span style={{fontFamily:D,fontSize:isWeekly?10:8,marginTop:4,color:isPeak?ACCENT:"#ccc",fontWeight:isPeak?700:400}}>{dl}</span>
        </div>;
      })}
    </div>
  );
}

function AnalysisPage({sessions}) {
  const [selDate,setSelDate]=useState(todayStr());
  const [showReports,setShowReports]=useState(false); const [showAdv,setShowAdv]=useState(false);
  const [viewMonth,setViewMonth]=useState(()=>{const d=new Date();return{year:d.getFullYear(),month:d.getMonth()};});
  const daySess=sessions.filter(s=>s.date===selDate);
  const tt={}; daySess.forEach(s=>{tt[s.tag]=(tt[s.tag]||0)+s.duration;});
  const totalMins=daySess.reduce((a,s)=>a+s.duration,0);
  const sorted=Object.entries(tt).sort((a,b)=>b[1]-a[1]);
  const allTags=[...new Set(sessions.map(s=>s.tag))];
  const shiftD=dir=>{const d=new Date(selDate+"T12:00:00");d.setDate(d.getDate()+dir);setSelDate(d.toISOString().slice(0,10));};
  const isToday=selDate===todayStr();
  const dl=isToday?"Today":new Date(selDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
  const dtAll=getDayTotals(sessions);
  const weekDates=getWeekRange(selDate); const monthDates=getMonthDates(viewMonth.year,viewMonth.month);
  const monthLabel=new Date(viewMonth.year,viewMonth.month).toLocaleDateString("en-US",{month:"long",year:"numeric"});
  const shiftM=dir=>setViewMonth(p=>{let m=p.month+dir,y=p.year;if(m<0){m=11;y--;}if(m>11){m=0;y++;}return{year:y,month:m};});
  const tagDT={}; sessions.forEach(s=>{if(!tagDT[s.tag])tagDT[s.tag]={};tagDT[s.tag][s.date]=(tagDT[s.tag][s.date]||0)+s.duration;});
  const pBests=Object.entries(tagDT).map(([tag,days])=>{const b=Object.entries(days).sort((a,b)=>b[1]-a[1])[0];return{tag,mins:b?b[1]:0,date:b?b[0]:""};}).sort((a,b)=>b.mins-a.mins);
  const weekData=weekDates.map(d=>({date:d,mins:dtAll[d]||0}));
  const monthData=monthDates.map(d=>({date:d,mins:dtAll[d]||0}));
  const wMax=Math.max(...weekData.map(d=>d.mins),1); const mMax=Math.max(...monthData.map(d=>d.mins),1);
  const navB={border:"1px solid rgba(0,0,0,0.1)",background:"white",width:34,height:34,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:8};

  return (
    <Content>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <button style={navB} onClick={()=>shiftD(-1)}>←</button>
        <h2 style={{fontFamily:S,fontSize:22,fontWeight:700}}>{dl}</h2>
        <button style={{...navB,opacity:isToday?0.2:1,pointerEvents:isToday?"none":"auto"}} onClick={()=>shiftD(1)}>→</button>
        <div style={{marginLeft:"auto"}}><Btn variant="ghost" size="sm" onClick={()=>exportXLSX(sessions)} disabled={!sessions.length}>↓ Export</Btn></div>
      </div>

      {/* Top stats row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
        {[
          {val:fmtHM(totalMins),lbl:"Today",color:totalMins>=120?ACCENT:undefined},
          {val:fmtHM(weekData.reduce((a,d)=>a+d.mins,0)),lbl:"This week"},
          {val:fmtHM(Object.values(dtAll).length>0?Math.max(...Object.values(dtAll)):0),lbl:"Personal best"},
          {val:pBests[0]?pBests[0].tag:"—",lbl:"Top subject"},
        ].map((s,i)=>(
          <div key={i} className="pop" style={{background:"white",borderRadius:14,padding:"18px 20px",border:"1px solid rgba(0,0,0,0.06)"}}>
            <div style={{fontFamily:S,fontSize:24,fontWeight:700,color:s.color||DARK,marginBottom:4}}>{s.val}</div>
            <div style={{fontFamily:D,fontSize:11,color:"#aaa",fontWeight:500,textTransform:"uppercase",letterSpacing:"0.1em"}}>{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* Session detail + tag breakdown */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <Panel>
          <PH>
            <Lbl>Session Log — {dl}</Lbl>
            {daySess.length===0?<div style={{color:"#ccc",fontFamily:D,fontSize:13,textAlign:"center",padding:"16px 0"}}>No sessions</div>
              :daySess.map(s=><div key={s.id} className="rc" style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid #f5f5f5",transition:"background 0.1s"}}><div style={{width:8,height:8,borderRadius:"50%",background:tc(s.tag,allTags),flexShrink:0}} /><span style={{flex:1,fontFamily:D,fontWeight:500,fontSize:13}}>{s.tag}</span><span style={{fontFamily:S,fontSize:14,fontWeight:600,color:"#888"}}>{fmtHM(s.duration)}</span></div>)}
          </PH>
        </Panel>
        <Panel>
          <PH>
            <Lbl>Breakdown</Lbl>
            {sorted.length===0?<div style={{color:"#ccc",fontFamily:D,fontSize:13,textAlign:"center",padding:"16px 0"}}>No data</div>:sorted.map(([tag,mins])=>{
              const pct=totalMins>0?Math.round((mins/totalMins)*100):0;
              return <div key={tag} style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontFamily:D,fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:6}}><span style={{width:8,height:8,borderRadius:"50%",background:tc(tag,allTags),display:"inline-block"}} />{tag}</span>
                  <span style={{fontFamily:S,fontSize:12,fontWeight:600,color:"#888"}}>{pct}%</span>
                </div>
                <div style={{height:4,background:"#f5f5f5",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",background:tc(tag,allTags),width:`${pct}%`,borderRadius:2}} /></div>
              </div>;
            })}
          </PH>
        </Panel>
      </div>

      {/* Reports toggle */}
      <div style={{textAlign:"center",marginBottom:14}}>
        <Btn variant="ghost" onClick={()=>setShowReports(!showReports)}>{showReports?"▲ Hide Reports":"▼ Weekly & Monthly Reports"}</Btn>
      </div>
      <div style={{maxHeight:showReports?"2000px":"0",overflow:"hidden",transition:"max-height 0.5s ease,opacity 0.3s",opacity:showReports?1:0}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
          <Panel><PH>
            <Lbl>Weekly — {new Date(weekDates[0]+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})} – {new Date(weekDates[6]+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</Lbl>
            <div style={{fontFamily:S,fontSize:26,fontWeight:700,marginBottom:16}}>{fmtHM(weekData.reduce((a,d)=>a+d.mins,0))}</div>
            <MiniBar data={weekData} maxVal={wMax} isWeekly />
          </PH></Panel>
          <Panel><PH>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <Lbl style={{marginBottom:0,flex:1}}>{monthLabel}</Lbl>
              <button style={navB} onClick={()=>shiftM(-1)}>←</button>
              <button style={navB} onClick={()=>shiftM(1)}>→</button>
            </div>
            <div style={{fontFamily:S,fontSize:26,fontWeight:700,marginBottom:16}}>{fmtHM(monthData.reduce((a,d)=>a+d.mins,0))}</div>
            <MiniBar data={monthData} maxVal={mMax} />
          </PH></Panel>
        </div>
      </div>

      {/* Personal bests */}
      {pBests.length>0&&<Panel style={{marginBottom:14}}><PH>
        <Lbl>🏆 Personal Bests by Subject</Lbl>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10}}>
          {pBests.slice(0,6).map((b,i)=>(
            <div key={b.tag} style={{background:i===0?"#6366f110":"#fafafa",border:i===0?"1.5px solid #6366f130":"1px solid #f0f0f0",borderRadius:10,padding:"12px 14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><div style={{width:8,height:8,borderRadius:"50%",background:tc(b.tag,allTags)}} /><span style={{fontFamily:D,fontSize:11,fontWeight:600,color:"#888",textOverflow:"ellipsis",overflow:"hidden",whiteSpace:"nowrap"}}>{b.tag}{i===0?" 👑":""}</span></div>
              <div style={{fontFamily:S,fontSize:20,fontWeight:700,color:DARK}}>{fmtHM(b.mins)}</div>
              <div style={{fontFamily:D,fontSize:10,color:"#ccc"}}>{b.date?new Date(b.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}):""}</div>
            </div>
          ))}
        </div>
      </PH></Panel>}

      {/* Advanced toggle */}
      <div style={{textAlign:"center",marginBottom:14}}>
        <Btn variant="ghost" onClick={()=>setShowAdv(!showAdv)}>{showAdv?"▲ Hide Advanced":"▼ Advanced Insights"}</Btn>
      </div>
      <div style={{maxHeight:showAdv?"2000px":"0",overflow:"hidden",transition:"max-height 0.5s ease,opacity 0.3s",opacity:showAdv?1:0}}>
        <Panel><PH>
          <Lbl>Study Distribution</Lbl>
          <div style={{display:"flex",gap:10}}>
            {[{l:"0–30m",min:0,max:30,c:"#f43f5e"},{l:"30–1h",min:30,max:60,c:"#f97316"},{l:"1–2h",min:60,max:120,c:"#f59e0b"},{l:"2–3h",min:120,max:180,c:"#10b981"},{l:"3–4h",min:180,max:240,c:"#6366f1"},{l:"4h+",min:240,max:99999,c:"#8b5cf6"}].map(b=>{
              const cnt=Object.values(dtAll).filter(m=>m>=b.min&&m<b.max).length;
              return <div key={b.l} style={{flex:1,textAlign:"center",background:b.c+"12",border:`1px solid ${b.c}22`,borderRadius:10,padding:"16px 8px"}}>
                <div style={{fontFamily:S,fontSize:22,fontWeight:700,color:b.c}}>{cnt}</div>
                <div style={{fontFamily:D,fontSize:9,color:b.c,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",marginTop:2}}>{b.l}</div>
                <div style={{fontFamily:D,fontSize:9,color:"#bbb"}}>days</div>
              </div>;
            })}
          </div>
        </PH></Panel>
      </div>
    </Content>
  );
}

// ─── CALENDAR ─────────────────────────────────────────────────────────────────
function CalendarPage({sessions}) {
  const [vd,setVd]=useState(new Date());
  const fire=getFireDays(sessions);
  const year=vd.getFullYear(); const month=vd.getMonth();
  const firstDay=new Date(year,month,1).getDay(); const dim=new Date(year,month+1,0).getDate();
  const mName=vd.toLocaleDateString("en-US",{month:"long",year:"numeric"});
  const cells=[]; for(let i=0;i<firstDay;i++) cells.push(null); for(let d=1;d<=dim;d++) cells.push(d);
  const shift=dir=>{const d=new Date(vd);d.setMonth(d.getMonth()+dir);setVd(d);};
  const tod=new Date(); const isCur=year===tod.getFullYear()&&month===tod.getMonth();
  const mfc=[...Array(dim)].filter((_,i)=>fire.has(`${year}-${String(month+1).padStart(2,"0")}-${String(i+1).padStart(2,"0")}`)).length;
  const navB={border:"1px solid rgba(0,0,0,0.1)",background:"white",width:38,height:38,cursor:"pointer",fontSize:17,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:10};

  return (
    <Content>
      <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:8}}>
        <button style={navB} onClick={()=>shift(-1)}>←</button>
        <h2 style={{fontFamily:S,fontSize:28,fontWeight:700,flex:1}}>{mName}</h2>
        <button style={navB} onClick={()=>shift(1)}>→</button>
      </div>
      <div style={{display:"flex",gap:12,marginBottom:24,alignItems:"center"}}>
        <Chip color={ACCENT}>{mfc} fire days</Chip>
        <span style={{fontFamily:D,fontSize:12,color:"#aaa"}}>🔥 = 2h+ target hit · ✕ = missed</span>
      </div>
      <Panel>
        <div style={{padding:"24px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6,marginBottom:10}}>
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d,i)=><div key={i} style={{textAlign:"center",fontFamily:D,fontSize:11,fontWeight:600,color:"#ccc",padding:"4px 0",letterSpacing:"0.04em"}}>{d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6}}>
            {cells.map((day,i)=>{
              if(!day) return <div key={`e${i}`} />;
              const k=`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const isFire=fire.has(k); const isToday=isCur&&day===tod.getDate(); const missed=isPast(k)&&!isFire;
              return <div key={i} style={{aspectRatio:"1",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:isFire?ACCENT:missed?"#fff1f2":isToday?"#f5f5f5":"transparent",color:isFire?"white":missed?"#f43f5e":DARK,border:isToday&&!isFire?`2px solid ${ACCENT}`:"2px solid transparent",borderRadius:10,transition:"all 0.15s",cursor:"default"}}>
                {isFire&&<span style={{fontSize:14,lineHeight:1}}>🔥</span>}
                {missed&&<span style={{fontSize:11,lineHeight:1}}>✕</span>}
                <span style={{fontFamily:D,fontSize:isFire||missed?10:13,fontWeight:isToday?700:400,lineHeight:1,marginTop:isFire||missed?1:0}}>{day}</span>
              </div>;
            })}
          </div>
        </div>
      </Panel>
    </Content>
  );
}

// ─── REFLECTION ───────────────────────────────────────────────────────────────
function ReflectionPage({sessions}) {
  const [refs,setRefs]=useState({}); const [loaded,setLoaded]=useState(false);
  const [editKey,setEditKey]=useState(null); const [editText,setEditText]=useState(""); const [editHrs,setEditHrs]=useState("");
  useEffect(()=>{loadReflections().then(d=>{setRefs(d);setLoaded(true);});},[]);
  const save=async(date,note,hrsOverride)=>{setRefs(p=>({...p,[date]:{note,hrsOverride}}));await upsertReflection(date,note,hrsOverride);};
  const dt=getDayTotals(sessions);
  const allDates=[...new Set([...Object.keys(dt),...Object.keys(refs)])].sort((a,b)=>b.localeCompare(a));
  const today=todayStr(); if(!allDates.includes(today)) allDates.unshift(today);
  const startEdit=d=>{const r=refs[d]||{};setEditKey(d);setEditText(r.note||"");setEditHrs(r.hrsOverride!=null?String(r.hrsOverride):"");};
  const saveRow=d=>{const h=editHrs.trim()!==""?parseFloat(editHrs):null;save(d,editText,h);setEditKey(null);};
  const getH=d=>{const r=refs[d];if(r&&r.hrsOverride!=null)return r.hrsOverride;return(dt[d]||0)/60;};
  const getM=d=>{const r=refs[d];if(r&&r.hrsOverride!=null)return Math.round(r.hrsOverride*60);return dt[d]||0;};

  if(!loaded) return <Content><div style={{textAlign:"center",padding:"60px 0",fontFamily:D,color:"#bbb"}}>Loading...</div></Content>;

  return (
    <Content>
      <SectionTitle>Daily Reflection</SectionTitle>
      <Panel>
        <div style={{display:"grid",gridTemplateColumns:"108px 1fr 80px",padding:"10px 24px",borderBottom:"2px solid #111"}}>
          {["Date","Reflection","Hours"].map((h,i)=><span key={h} style={{fontFamily:D,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.14em",color:"#bbb",textAlign:i===2?"right":"left"}}>{h}</span>)}
        </div>
        {allDates.map(d=>{
          const hrs=getH(d); const mins=getM(d); const green=mins>=120; const r=refs[d]||{};
          const isE=editKey===d; const isTd=d===today;
          const dl=new Date(d+"T12:00:00").toLocaleDateString("en-US",{weekday:"short"});
          const dLabel=new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
          return <div key={d} className="rc" onClick={()=>{if(!isE)startEdit(d);}}
            style={{display:"grid",gridTemplateColumns:"108px 1fr 80px",padding:"14px 24px",borderBottom:"1px solid #f5f5f5",background:green?"rgba(99,102,241,0.03)":"white",cursor:isE?"default":"pointer",transition:"background 0.1s"}}>
            <div><div style={{fontFamily:D,fontWeight:600,fontSize:13}}>{dl}</div><div style={{fontFamily:D,fontSize:11,color:"#ccc"}}>{dLabel}</div></div>
            <div style={{display:"flex",alignItems:"center",paddingRight:12}}>
              {isE?<div style={{display:"flex",gap:8,width:"100%",alignItems:"center"}}>
                <input value={editText} onChange={e=>setEditText(e.target.value)} autoFocus placeholder="How was your study session?" onKeyDown={e=>{if(e.key==="Enter")saveRow(d);if(e.key==="Escape")setEditKey(null);}} style={{flex:1,border:"none",borderBottom:`2px solid ${ACCENT}`,background:"transparent",fontSize:13,fontFamily:D,padding:"4px 0",outline:"none"}} />
                <Btn size="sm" onClick={e=>{e.stopPropagation();saveRow(d);}}>Save</Btn>
              </div>:<span style={{color:r.note?DARK:"#ccc",fontSize:13,fontWeight:r.note?400:300}}>{r.note||(isTd?"Click to add today's reflection...":"—")}</span>}
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end"}}>
              {isE?<input value={editHrs} onChange={e=>setEditHrs(e.target.value)} placeholder={hrs.toFixed(1)} type="number" step="0.1" onKeyDown={e=>e.key==="Enter"&&saveRow(d)} style={{width:52,border:"none",borderBottom:`1.5px solid ${ACCENT}`,background:"transparent",fontSize:13,fontFamily:D,textAlign:"right",padding:"4px 0",outline:"none"}} />
                :<div style={{fontFamily:S,fontWeight:700,fontSize:18,color:green?ACCENT:"#f43f5e"}}>{hrs.toFixed(1)}h</div>}
            </div>
          </div>;
        })}
      </Panel>
      <div style={{marginTop:12,fontFamily:D,fontSize:11,color:"#bbb",display:"flex",gap:16}}>
        <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:ACCENT+"22",border:`1px solid ${ACCENT}44`,display:"inline-block",borderRadius:2}} /> 2h+ goal hit</span>
        <span>Click any row to edit</span>
      </div>
    </Content>
  );
}

// ─── SLEEP ────────────────────────────────────────────────────────────────────
function SleepPage({sleepLogs,setSleepLogs}) {
  const [sleepStart,setSS]=useState("23:00"); const [wakeUp,setWU]=useState("06:30"); const [ld,setLD]=useState(todayStr());
  const calcM=(a,b)=>{const[sh,sm]=a.split(":").map(Number);const[wh,wm]=b.split(":").map(Number);let s=sh*60+sm,w=wh*60+wm;if(w<=s)w+=1440;return w-s;};
  const log=async()=>{const m=calcM(sleepStart,wakeUp);const s=await upsertSleepLog(ld,sleepStart,wakeUp,m);if(s)setSleepLogs(p=>[s,...p.filter(l=>l.date!==ld)].sort((a,b)=>b.date.localeCompare(a.date)));};
  const sc=m=>m<360?"#f59e0b":m<=450?"#10b981":"#6366f1";
  const last14=[]; for(let i=13;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);last14.push(d.toISOString().slice(0,10));}
  const lm={}; sleepLogs.forEach(l=>{lm[l.date]=l;});
  const bd=last14.map(d=>({date:d,mins:lm[d]?.total_mins||0})); const maxS=Math.max(...bd.map(d=>d.mins),1); const BH=100;
  const r7=sleepLogs.slice(0,7);
  const avgS=r7.length>0?Math.round(r7.reduce((a,l)=>a+(l.total_mins||0),0)/r7.length):0;
  const avgBed=r7.length>0?r7.map(l=>l.sleep_start||"23:00").sort()[Math.floor(r7.length/2)]:"—";
  const avgWk=r7.length>0?r7.map(l=>l.wake_up||"07:00").sort()[Math.floor(r7.length/2)]:"—";
  const tm=todayStr().slice(0,7); const mLogs=sleepLogs.filter(l=>l.date.startsWith(tm));
  const mAvg=mLogs.length>0?Math.round(mLogs.reduce((a,l)=>a+(l.total_mins||0),0)/mLogs.length):0;
  const tIS={border:"none",borderBottom:"1.5px solid #e8e8e8",padding:"10px 0",fontSize:14,fontFamily:D,fontWeight:500,outline:"none",background:"transparent",color:DARK,transition:"border-color 0.15s",width:"100%"};

  return (
    <Content>
      <SectionTitle>Sleep Tracker</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:"380px 1fr",gap:20,alignItems:"start"}}>
        {/* Left */}
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Panel><PH>
            <Lbl>Log Sleep</Lbl>
            <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:20}}>
              <div><Lbl style={{marginBottom:4,fontSize:9}}>Date</Lbl><input type="date" value={ld} onChange={e=>setLD(e.target.value)} style={tIS} onFocus={e=>e.target.style.borderBottomColor=ACCENT} onBlur={e=>e.target.style.borderBottomColor="#e8e8e8"} /></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div><Lbl style={{marginBottom:4,fontSize:9}}>Slept at</Lbl><input type="time" value={sleepStart} onChange={e=>setSS(e.target.value)} style={tIS} onFocus={e=>e.target.style.borderBottomColor=ACCENT} onBlur={e=>e.target.style.borderBottomColor="#e8e8e8"} /></div>
                <div><Lbl style={{marginBottom:4,fontSize:9}}>Woke up</Lbl><input type="time" value={wakeUp} onChange={e=>setWU(e.target.value)} style={tIS} onFocus={e=>e.target.style.borderBottomColor=ACCENT} onBlur={e=>e.target.style.borderBottomColor="#e8e8e8"} /></div>
              </div>
            </div>
            <Btn variant="dark" full size="lg" onClick={log}>Log Sleep</Btn>
          </PH></Panel>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {[{t:"Weekly avg",v:fmtHM(avgS),lines:[`Bed: ${avgBed}`,`Wake: ${avgWk}`]},{t:"Monthly avg",v:fmtHM(mAvg),lines:[`${mLogs.length} nights logged`]}].map(c=>(
              <Panel key={c.t}><PH>
                <Lbl style={{marginBottom:6}}>{c.t}</Lbl>
                <div style={{fontFamily:S,fontSize:26,fontWeight:700,marginBottom:8}}>{c.v}</div>
                {c.lines.map(l=><div key={l} style={{fontFamily:D,fontSize:11,color:"#bbb"}}>{l}</div>)}
              </PH></Panel>
            ))}
          </div>
        </div>

        {/* Right */}
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Panel><PH>
            <Lbl>Last 14 Days</Lbl>
            <div style={{overflowX:"auto"}}>
              <div style={{display:"flex",alignItems:"flex-end",gap:4,minWidth:14*32,height:BH+40,paddingTop:16}}>
                {bd.map(d=>{const h=d.mins>0?(d.mins/maxS)*BH:0;const c=d.mins>0?sc(d.mins):"#f0f0f0";const dl=new Date(d.date+"T12:00:00").getDate();return<div key={d.date} style={{flex:1,minWidth:20,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:BH+40}}>{d.mins>0&&<span style={{fontSize:8,fontFamily:D,fontWeight:700,marginBottom:2,color:c}}>{fmtHM(d.mins)}</span>}<div style={{width:"100%",height:h,background:c,borderRadius:"3px 3px 0 0",minHeight:d.mins>0?4:1}} /><span style={{fontSize:8,fontFamily:D,marginTop:3,color:"#ccc"}}>{dl}</span></div>;})}
              </div>
            </div>
            <div style={{display:"flex",gap:14,marginTop:12,fontFamily:D,fontSize:10,color:"#bbb"}}>
              {[{c:"#f59e0b",l:"<6h"},{c:"#10b981",l:"6-7.5h ✓"},{c:"#6366f1",l:"7.5h+"}].map(x=><span key={x.l} style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,background:x.c,borderRadius:2,display:"inline-block"}} />{x.l}</span>)}
            </div>
          </PH></Panel>

          <Panel>
            <div style={{display:"grid",gridTemplateColumns:"1fr 60px 60px 64px",padding:"10px 20px",borderBottom:"2px solid #111"}}>
              {["Date","Sleep","Wake","Total"].map((h,i)=><span key={h} style={{fontFamily:D,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.12em",color:"#aaa",textAlign:i===3?"right":"left"}}>{h}</span>)}
            </div>
            {sleepLogs.length===0?<div style={{padding:"28px",textAlign:"center",fontFamily:D,fontSize:13,color:"#ccc"}}>No sleep logs yet</div>
              :sleepLogs.map(l=>{const c=sc(l.total_mins||0);const dl=new Date(l.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});return<div key={l.id} className="rc" style={{display:"grid",gridTemplateColumns:"1fr 60px 60px 64px",padding:"12px 20px",borderBottom:"1px solid #f5f5f5",fontFamily:D,fontSize:12,transition:"background 0.1s"}}><span style={{fontWeight:500}}>{dl}</span><span style={{color:"#bbb"}}>{l.sleep_start||"—"}</span><span style={{color:"#bbb"}}>{l.wake_up||"—"}</span><span style={{textAlign:"right",fontWeight:700,color:c}}>{l.total_mins?fmtHM(l.total_mins):"—"}</span></div>;})}
          </Panel>
        </div>
      </div>
    </Content>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [user,setUser]=useState(null); const [authLoading,setAuthLoading]=useState(true);
  const [page,setPage]=useState(PAGES.TIMER);
  const [sessions,setSessions]=useState([]); const [tasks,setTasks]=useState([]); const [sleepLogs,setSleepLogs]=useState([]);
  const [loaded,setLoaded]=useState(false);

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{setUser(session?.user??null);setAuthLoading(false);});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>{setUser(session?.user??null);});
    return()=>subscription.unsubscribe();
  },[]);
  useEffect(()=>{
    if(!user){setSessions([]);setTasks([]);setSleepLogs([]);setLoaded(false);return;}
    setLoaded(false);
    Promise.all([loadSessions(),loadTasks(),loadSleepLogs()]).then(([s,t,sl])=>{setSessions(s);setTasks(t);setSleepLogs(sl);setLoaded(true);});
  },[user]);

  const logout=async()=>{await supabase.auth.signOut();setUser(null);setSessions([]);setTasks([]);setSleepLogs([]);setLoaded(false);};
  const streak=calcStreak(sessions);
  const todayMins=sessions.filter(s=>s.date===todayStr()).reduce((a,s)=>a+s.duration,0);

  const ls=msg=><div style={{minHeight:"100vh",width:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"#f0eeea",fontFamily:D,fontSize:14,color:"#aaa"}}><style>{G}</style>{msg}</div>;

  if(authLoading) return ls("Loading...");
  if(!user) return <><style>{G}</style><AuthPage /></>;
  if(!loaded) return ls("Loading your data...");

  return (
    <div style={{display:"flex",minHeight:"100vh",width:"100%",background:"#f0eeea"}}>
      <style>{G}</style>
      {/* Sidebar */}
      <Sidebar page={page} setPage={setPage} streak={streak} todayMins={todayMins} email={user.email} onLogout={logout} />
      {/* Main */}
      <div style={{marginLeft:SIDEBAR_W,flex:1,minWidth:0,display:"flex",flexDirection:"column"}}>
        <TopBar sessions={sessions} page={page} />
        <div style={{flex:1}}>
          <div className="fade" key={page}>
            {page===PAGES.TIMER&&<TimerPage sessions={sessions} setSessions={setSessions} />}
            {page===PAGES.TASKS&&<TasksPage tasks={tasks} setTasks={setTasks} />}
            {page===PAGES.ANALYSIS&&<AnalysisPage sessions={sessions} />}
            {page===PAGES.CALENDAR&&<CalendarPage sessions={sessions} />}
            {page===PAGES.REFLECTION&&<ReflectionPage sessions={sessions} />}
            {page===PAGES.SLEEP&&<SleepPage sleepLogs={sleepLogs} setSleepLogs={setSleepLogs} />}
          </div>
        </div>
      </div>
    </div>
  );
}