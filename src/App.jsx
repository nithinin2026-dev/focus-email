import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";
import { supabase } from "./supabaseClient";

const PAGES = { TIMER: "timer", TASKS: "tasks", ANALYSIS: "analysis", CALENDAR: "calendar", REFLECTION: "reflection", SLEEP: "sleep" };
const QUOTES = ["Develop the quality of being unstoppable", "Don't let your Mind and Body Betray you!"];

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&family=Outfit:wght@300;400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { width: 100%; }
  body { font-family: 'Outfit', sans-serif; background: #f7f7f5; color: #0a0a0a; -webkit-font-smoothing: antialiased; width: 100%; min-height: 100vh; }
  #root { width: 100%; min-height: 100vh; }
  input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
  input[type=date]::-webkit-calendar-picker-indicator { opacity: 0.4; cursor: pointer; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-thumb { background: #d0d0d0; border-radius: 2px; }
  .hov-row:hover { background: rgba(0,0,0,0.025) !important; }
  .hov-card { transition: box-shadow 0.2s, transform 0.2s; }
  .hov-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.08) !important; transform: translateY(-1px); }
  .nav-tab { transition: color 0.15s, background 0.15s !important; }
  .nav-tab:hover { color: #0a0a0a !important; background: rgba(0,0,0,0.06) !important; }
  .btn-p:hover { background: #1a1a1a !important; }
  .btn-o:hover { background: #0a0a0a !important; color: #fff !important; }
  .btn-g:hover { background: rgba(0,0,0,0.07) !important; }
  .fade { animation: fu 0.35s ease both; }
  @keyframes fu { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
`;

let bellReady = false; let bellSynth = null;
function initBell() { if (bellReady) return; bellSynth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sine" }, envelope: { attack: 0.005, decay: 0.8, sustain: 0.01, release: 1.2 }, volume: -6 }).toDestination(); bellReady = true; }
function playBell() { try { if (!bellReady) initBell(); Tone.start(); const n = Tone.now(); bellSynth.triggerAttackRelease("C6","8n",n); bellSynth.triggerAttackRelease("E6","8n",n+0.15); bellSynth.triggerAttackRelease("G6","8n",n+0.3); bellSynth.triggerAttackRelease("C7","4n",n+0.5); } catch(e){} }
function playStartPop() { try { Tone.start(); const s=new Tone.Synth({oscillator:{type:"triangle"},envelope:{attack:0.005,decay:0.15,sustain:0,release:0.1},volume:-8}).toDestination(); s.triggerAttackRelease("G5","16n"); setTimeout(()=>s.dispose(),500); } catch(e){} }
function playStopPop() { try { Tone.start(); const s=new Tone.Synth({oscillator:{type:"triangle"},envelope:{attack:0.005,decay:0.2,sustain:0,release:0.15},volume:-8}).toDestination(); s.triggerAttackRelease("D5","16n"); setTimeout(()=>s.dispose(),500); } catch(e){} }

async function loadSessions() { const {data,error}=await supabase.from("sessions").select("*").order("ts",{ascending:true}); if(error) return []; return data.map(r=>({id:r.id,tag:r.tag,duration:r.duration,date:r.date,ts:Number(r.ts)})); }
async function insertSession(s) { const {data:{user}}=await supabase.auth.getUser(); if(!user) return null; const {data,error}=await supabase.from("sessions").insert({user_id:user.id,tag:s.tag,duration:s.duration,date:s.date,ts:s.ts}).select().single(); if(error) return null; return data; }
async function loadReflections() { const {data,error}=await supabase.from("reflections").select("*"); if(error) return {}; const m={}; data.forEach(r=>{m[r.date]={note:r.note||"",hrsOverride:r.hrs_override};}); return m; }
async function upsertReflection(date,note,hrsOverride) { const {data:{user}}=await supabase.auth.getUser(); if(!user) return; await supabase.from("reflections").upsert({user_id:user.id,date,note,hrs_override:hrsOverride},{onConflict:"user_id,date"}); }
async function loadTasks() { const {data,error}=await supabase.from("tasks").select("*").order("created_at",{ascending:true}); if(error) return []; return data; }
async function insertTask(title,date,timeSlot) { const {data:{user}}=await supabase.auth.getUser(); if(!user) return null; const {data,error}=await supabase.from("tasks").insert({user_id:user.id,title,date,time_slot:timeSlot||null}).select().single(); if(error) return null; return data; }
async function updateTaskCompleted(id,val) { await supabase.from("tasks").update({completed_date:val}).eq("id",id); }
async function deleteTask(id) { await supabase.from("tasks").delete().eq("id",id); }
async function loadSleepLogs() { const {data,error}=await supabase.from("sleep_logs").select("*").order("date",{ascending:false}); if(error) return []; return data; }
async function upsertSleepLog(date,sleepStart,wakeUp,totalMins) { const {data:{user}}=await supabase.auth.getUser(); if(!user) return null; const {data,error}=await supabase.from("sleep_logs").upsert({user_id:user.id,date,sleep_start:sleepStart,wake_up:wakeUp,total_mins:totalMins},{onConflict:"user_id,date"}).select().single(); if(error) return null; return data; }

function todayStr() { return new Date().toISOString().slice(0,10); }
function formatTime(s) { return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`; }
function formatHM(mins) { const h=Math.floor(mins/60),m=mins%60; if(h===0)return`${m}m`; if(m===0)return`${h}h`; return`${h}h ${m}m`; }
function calcStreak(sessions) { const dt={}; sessions.forEach(s=>{dt[s.date]=(dt[s.date]||0)+s.duration;}); let streak=0; const d=new Date(); if((dt[todayStr()]||0)>=120){streak=1;d.setDate(d.getDate()-1);}else d.setDate(d.getDate()-1); while(true){const k=d.toISOString().slice(0,10);if((dt[k]||0)>=120){streak++;d.setDate(d.getDate()-1);}else break;} return streak; }
function getFireDays(sessions) { const dt={}; sessions.forEach(s=>{dt[s.date]=(dt[s.date]||0)+s.duration;}); return new Set(Object.entries(dt).filter(([,m])=>m>=120).map(([d])=>d)); }
function getDayTotals(sessions) { const t={}; sessions.forEach(s=>{t[s.date]=(t[s.date]||0)+s.duration;}); return t; }
function isPastDate(d) { return d < todayStr(); }
function getBarGrad(mins) { if(mins<120)return"linear-gradient(180deg,#e63946,#ff6b6b)"; const t=Math.min((mins/60-2)/4,1); return`linear-gradient(180deg,rgb(${Math.round(42-t*30)},${Math.round(157+t*40)},${Math.round(143-t*80)}),rgba(${Math.round(42-t*30)},${Math.round(157+t*40)},${Math.round(143-t*80)},0.6))`; }
function getWeekRange(ds) { const d=new Date(ds+"T12:00:00"); const m=new Date(d); m.setDate(d.getDate()-((d.getDay()+6)%7)); return Array.from({length:7},(_,i)=>{const dd=new Date(m);dd.setDate(m.getDate()+i);return dd.toISOString().slice(0,10);}); }
function getMonthDates(y,mo) { return Array.from({length:new Date(y,mo+1,0).getDate()},(_,i)=>`${y}-${String(mo+1).padStart(2,"0")}-${String(i+1).padStart(2,"0")}`); }
const TAG_COLORS=["#e63946","#457b9d","#2a9d8f","#e9c46a","#f4a261","#6a4c93","#1982c4","#8ac926","#ff595e","#6d6875","#264653","#f77f00","#d62828","#023e8a","#606c38"];
function tc(tag,all) { return TAG_COLORS[all.indexOf(tag)%TAG_COLORS.length]; }

const F1="'Cormorant', serif";
const F2="'Outfit', sans-serif";

function Lbl({children,style={}}) { return <div style={{fontFamily:F2,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.14em",color:"#aaa",marginBottom:10,...style}}>{children}</div>; }

function Btn({children,onClick,variant="primary",size="md",disabled,full,style={}}) {
  const sz={sm:{padding:"7px 16px",fontSize:11},md:{padding:"10px 22px",fontSize:12},lg:{padding:"14px 36px",fontSize:14}};
  const vs={primary:{background:"#0a0a0a",color:"#fff",border:"none"},outline:{background:"transparent",color:"#0a0a0a",border:"1.5px solid #0a0a0a"},ghost:{background:"transparent",color:"#888",border:"1.5px solid rgba(0,0,0,0.12)"}};
  const cls=variant==="primary"?"btn-p":variant==="outline"?"btn-o":"btn-g";
  return <button className={cls} onClick={onClick} disabled={disabled} style={{...sz[size],fontFamily:F2,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase",cursor:disabled?"default":"pointer",borderRadius:8,transition:"all 0.15s",outline:"none",opacity:disabled?0.35:1,width:full?"100%":undefined,...vs[variant],...style}}>{children}</button>;
}

function FInput({value,onChange,placeholder,type="text",onKeyDown,style={},autoFocus}) {
  return <input value={value} onChange={onChange} placeholder={placeholder} type={type} onKeyDown={onKeyDown} autoFocus={autoFocus}
    style={{fontFamily:F2,fontSize:14,fontWeight:500,color:"#0a0a0a",background:"white",border:"1.5px solid #e5e5e5",borderRadius:8,padding:"11px 14px",outline:"none",width:"100%",transition:"border-color 0.2s",...style}}
    onFocus={e=>e.target.style.borderColor="#0a0a0a"} onBlur={e=>e.target.style.borderColor="#e5e5e5"} />;
}

function Card({children,style={}}) { return <div className="hov-card" style={{background:"white",borderRadius:16,border:"1px solid rgba(0,0,0,0.06)",overflow:"hidden",...style}}>{children}</div>; }
function CP({children,style={}}) { return <div style={{padding:"22px 24px",...style}}>{children}</div>; }

function AuthPage() {
  const [isLogin,setIsLogin]=useState(true);
  const [email,setEmail]=useState(""); const [pw,setPw]=useState("");
  const [err,setErr]=useState(""); const [loading,setLoading]=useState(false); const [sent,setSent]=useState(false);
  const submit=async()=>{
    setErr(""); if(!email.trim()||!pw.trim()){setErr("Email and password required");return;} if(pw.length<6){setErr("Password min 6 chars");return;}
    setLoading(true);
    try { if(isLogin){const{error:e}=await supabase.auth.signInWithPassword({email,password:pw});if(e)throw e;} else{const{error:e}=await supabase.auth.signUp({email,password:pw});if(e)throw e;setSent(true);setLoading(false);return;} } catch(e){setErr(e.message||"Something went wrong");}
    setLoading(false);
  };
  const forgotPw=async()=>{setErr(""); if(!email.trim()){setErr("Enter email first");return;} setLoading(true); try{const{error:e}=await supabase.auth.resetPasswordForEmail(email);if(e)throw e;setSent(true);}catch(e){setErr(e.message);} setLoading(false);};
  if(sent) return(<div style={{minHeight:"100vh",width:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"#f7f7f5"}}><div className="fade" style={{textAlign:"center",maxWidth:400,padding:"0 24px"}}><div style={{fontSize:48,marginBottom:24}}>✉️</div><h2 style={{fontFamily:F1,fontSize:40,fontWeight:600,marginBottom:12}}>Check your inbox</h2><p style={{fontFamily:F2,fontSize:15,color:"#888",lineHeight:1.7,marginBottom:36}}>We sent a link to <strong>{email}</strong>.</p><Btn size="lg" onClick={()=>{setSent(false);setIsLogin(true);}}>Back to Login</Btn></div></div>);
  const inp={width:"100%",background:"white",border:"1.5px solid #e5e5e5",padding:"14px 18px",fontSize:15,fontFamily:F2,fontWeight:500,outline:"none",borderRadius:8,transition:"border-color 0.2s",marginBottom:12};
  return(
    <div style={{minHeight:"100vh",width:"100%",display:"flex",background:"#f7f7f5"}}>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 48px"}}>
        <div className="fade" style={{width:"100%",maxWidth:400}}>
          <div style={{marginBottom:48}}><div style={{fontFamily:F1,fontSize:52,fontWeight:600,lineHeight:1,marginBottom:10}}>Focus<br /><em>Maxing</em></div><div style={{fontFamily:F2,fontSize:11,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.22em",fontWeight:500}}>Track your upskilling</div></div>
          <div style={{display:"flex",marginBottom:32,background:"white",borderRadius:8,padding:4,border:"1.5px solid #e5e5e5"}}>
            {["Login","Sign Up"].map((lbl,i)=>{const a=i===0?isLogin:!isLogin; return <button key={lbl} onClick={()=>{setIsLogin(i===0);setErr("");}} style={{flex:1,padding:"10px 0",border:"none",cursor:"pointer",background:a?"#0a0a0a":"transparent",color:a?"#fff":"#aaa",fontSize:12,fontFamily:F2,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",borderRadius:5,transition:"all 0.2s"}}>{lbl}</button>;})}
          </div>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" type="email" onKeyDown={e=>e.key==="Enter"&&submit()} style={inp} onFocus={e=>e.target.style.borderColor="#0a0a0a"} onBlur={e=>e.target.style.borderColor="#e5e5e5"} />
          <input value={pw} onChange={e=>setPw(e.target.value)} placeholder="Password" type="password" onKeyDown={e=>e.key==="Enter"&&submit()} style={{...inp,marginBottom:isLogin?6:16}} onFocus={e=>e.target.style.borderColor="#0a0a0a"} onBlur={e=>e.target.style.borderColor="#e5e5e5"} />
          {isLogin&&<div style={{textAlign:"right",marginBottom:16}}><button onClick={forgotPw} style={{border:"none",background:"none",cursor:"pointer",fontSize:12,fontFamily:F2,fontWeight:500,color:"#aaa",textDecoration:"underline",textUnderlineOffset:3}}>Forgot password?</button></div>}
          {err&&<div style={{fontFamily:F2,fontSize:13,color:"#e63946",fontWeight:500,marginBottom:12,padding:"10px 14px",background:"#fff5f5",borderRadius:6}}>{err}</div>}
          <Btn size="lg" onClick={submit} disabled={loading} full>{loading?"...":isLogin?"Sign In":"Create Account"}</Btn>
          <div style={{marginTop:48,fontFamily:F2,fontSize:11,color:"#ccc",textAlign:"center"}}>Vibe coded by Nithin Chowdary ❤️</div>
        </div>
      </div>
      <div style={{width:"40%",background:"#0a0a0a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:48,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle at 30% 50%,rgba(255,255,255,0.04) 0%,transparent 60%)"}} />
        <div style={{position:"relative",zIndex:1,color:"white",textAlign:"center"}}>
          <div style={{fontFamily:F1,fontSize:80,fontWeight:300,lineHeight:1,marginBottom:20,opacity:0.9}}>2h+</div>
          <div style={{fontFamily:F2,fontSize:11,color:"rgba(255,255,255,0.3)",letterSpacing:"0.22em",textTransform:"uppercase",fontWeight:500,marginBottom:48}}>Daily Goal</div>
          {["Track every session","Build your streak","Analyze your growth","Optimize your sleep"].map((t,i)=><div key={i} style={{fontFamily:F2,fontSize:14,color:"rgba(255,255,255,0.4)",marginBottom:14,display:"flex",alignItems:"center",gap:12}}><div style={{width:4,height:4,borderRadius:"50%",background:"rgba(255,255,255,0.25)",flexShrink:0}} />{t}</div>)}
        </div>
      </div>
    </div>
  );
}

function Navbar({streak,todayMins,page,setPage,onLogout}) {
  const hit=todayMins>=120;
  const items=[{key:PAGES.TIMER,label:"Timer"},{key:PAGES.TASKS,label:"Tasks"},{key:PAGES.ANALYSIS,label:"Analysis"},{key:PAGES.CALENDAR,label:"Calendar"},{key:PAGES.REFLECTION,label:"Reflect"},{key:PAGES.SLEEP,label:"Sleep"}];
  return(
    <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:1000,background:"rgba(247,247,245,0.9)",backdropFilter:"blur(24px) saturate(180%)",WebkitBackdropFilter:"blur(24px) saturate(180%)",borderBottom:"1px solid rgba(0,0,0,0.07)",height:54}}>
      <div style={{width:"100%",maxWidth:1400,margin:"0 auto",height:"100%",display:"flex",alignItems:"center",padding:"0 28px"}}>
        <div style={{fontFamily:F1,fontSize:21,fontWeight:600,color:"#0a0a0a",whiteSpace:"nowrap",marginRight:32}}>Focus <em>Maxing</em></div>
        <div style={{display:"flex",flex:1,justifyContent:"center",gap:2}}>
          {items.map(item=><button key={item.key} className="nav-tab" onClick={()=>setPage(item.key)} style={{border:"none",background:page===item.key?"rgba(0,0,0,0.07)":"transparent",color:page===item.key?"#0a0a0a":"#999",fontFamily:F2,fontSize:13,fontWeight:page===item.key?600:400,padding:"6px 14px",cursor:"pointer",borderRadius:20,transition:"all 0.15s",whiteSpace:"nowrap"}}>{item.label}</button>)}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:24}}>
          <div style={{display:"flex",alignItems:"center",gap:6,background:hit?"#0a0a0a":"#e63946",color:"#fff",padding:"6px 14px",borderRadius:20,fontFamily:F2,fontSize:13,fontWeight:600,whiteSpace:"nowrap"}}><span>{hit?(streak>0?"🔥":"○"):"⚠️"}</span><span>{streak} {hit?(streak===1?"day":"days"):"do 2h+"}</span></div>
          <button className="btn-g" onClick={onLogout} style={{border:"1px solid rgba(0,0,0,0.1)",background:"transparent",padding:"6px 14px",borderRadius:20,fontFamily:F2,fontSize:12,fontWeight:500,cursor:"pointer",color:"#aaa",transition:"all 0.15s",whiteSpace:"nowrap"}}>Logout</button>
        </div>
      </div>
    </nav>
  );
}

function StatsHero({sessions}) {
  const [now,setNow]=useState(new Date());
  const [targetDate,setTargetDate]=useState(()=>localStorage.getItem("sl_targetDate")||"");
  const [editingTarget,setEditingTarget]=useState(false); const [tempTarget,setTempTarget]=useState("");
  const [quoteIdx,setQuoteIdx]=useState(()=>Math.floor(Math.random()*QUOTES.length));
  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(t);},[]);
  useEffect(()=>{const t=setInterval(()=>setQuoteIdx(p=>(p+1)%QUOTES.length),180000);return()=>clearInterval(t);},[]);
  const dt=getDayTotals(sessions);
  const yr=String(now.getFullYear());
  const mp=`${yr}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const monthMins=sessions.filter(s=>s.date.startsWith(mp)).reduce((a,s)=>a+s.duration,0);
  const maxMins=Object.values(dt).length>0?Math.max(...Object.values(dt)):0;
  const hr=now.getHours(); const minsLeft=(24-hr-1)*60+(60-now.getMinutes());
  const todayMins=sessions.filter(s=>s.date===todayStr()).reduce((a,s)=>a+s.duration,0);
  const saveTarget=()=>{localStorage.setItem("sl_targetDate",tempTarget);setTargetDate(tempTarget);setEditingTarget(false);};
  let targetText="Set goal date";
  if(targetDate){const diff=Math.ceil((new Date(targetDate+"T00:00:00")-new Date(todayStr()+"T00:00:00"))/86400000);if(diff>0)targetText=`${diff}d to goal`;else if(diff===0)targetText="Goal day! 🎉";else targetText=`${Math.abs(diff)}d past`;}
  const today=new Date(); const dow=today.getDay();
  const mon=new Date(today); mon.setDate(today.getDate()-((dow+6)%7));
  const weekDays=[]; for(let i=0;i<7;i++){const dd=new Date(mon);dd.setDate(mon.getDate()+i);weekDays.push(dd.toISOString().slice(0,10));}
  const dayLabels=["M","T","W","TH","F","SA","SU"];
  const weekTotal=weekDays.reduce((a,d)=>a+(dt[d]||0),0);
  const todayKey=todayStr();
  const SC=({val,label,sub,color="#0a0a0a"})=>(<div className="hov-card" style={{background:"white",borderRadius:12,padding:"18px 20px",border:"1px solid rgba(0,0,0,0.06)",flex:"1 1 110px",minWidth:0}}><div style={{fontFamily:F1,fontSize:28,fontWeight:600,color,lineHeight:1,marginBottom:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{val}</div><div style={{fontFamily:F2,fontSize:10,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:600}}>{label}</div>{sub&&<div style={{fontFamily:F2,fontSize:11,color:"#ccc",marginTop:3}}>{sub}</div>}</div>);
  return(
    <div style={{background:"#f7f7f5",paddingTop:54,borderBottom:"1px solid rgba(0,0,0,0.06)",width:"100%"}}>
      <div style={{width:"100%",maxWidth:1400,margin:"0 auto",padding:"20px 28px 0"}}>
        <div style={{fontFamily:F1,fontSize:16,fontStyle:"italic",color:"#999",marginBottom:14}}>"{QUOTES[quoteIdx]}"</div>
        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          <SC val={formatHM(todayMins)} label="Today" sub={todayMins>=120?"🔥 Target hit":"Goal: 2h"} color={todayMins>=120?"#2a9d8f":"#e63946"} />
          <SC val={formatHM(weekTotal)} label="This week" sub={`${weekDays.filter(d=>(dt[d]||0)>=120).length}/7 fire days`} />
          <SC val={formatHM(monthMins)} label={now.toLocaleDateString("en-US",{month:"long"})} sub={yr} />
          <SC val={formatHM(maxMins)} label="Personal best" sub="Single day" />
          <SC val={`${Math.floor(minsLeft/60)}h ${minsLeft%60}m`} label="Until midnight" sub={hr>=20?"⚡ Crunch time":"Left today"} />
          <div className="hov-card" style={{background:"white",borderRadius:12,padding:"18px 20px",border:"1px solid rgba(0,0,0,0.06)",flex:"1 1 110px",minWidth:0,cursor:"pointer"}} onClick={()=>{setTempTarget(targetDate||todayStr());setEditingTarget(!editingTarget);}}>
            {editingTarget?(<div onClick={e=>e.stopPropagation()}><input type="date" value={tempTarget} onChange={e=>setTempTarget(e.target.value)} style={{width:"100%",border:"1.5px solid #0a0a0a",padding:"6px 8px",fontSize:12,fontFamily:F2,outline:"none",marginBottom:6,borderRadius:4}} /><button onClick={saveTarget} style={{border:"none",background:"#0a0a0a",color:"#fff",padding:"5px 12px",fontSize:11,fontFamily:F2,fontWeight:600,cursor:"pointer",borderRadius:4,width:"100%"}}>Set Goal</button></div>):(<><div style={{fontFamily:F1,fontSize:28,fontWeight:600,color:"#6a4c93",lineHeight:1,marginBottom:4}}>🎯</div><div style={{fontFamily:F2,fontSize:10,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:600}}>Goal date</div><div style={{fontFamily:F2,fontSize:11,color:"#ccc",marginTop:3}}>{targetText}</div></>)}
          </div>
        </div>
        <div style={{display:"flex",gap:6,paddingBottom:14,alignItems:"center"}}>
          <div style={{display:"flex",gap:6,flex:1}}>
            {weekDays.map((dateKey,i)=>{
              const mins=dt[dateKey]||0; const isFire=mins>=120; const isToday=dateKey===todayKey; const isMissed=isPastDate(dateKey)&&!isFire;
              return(<div key={dateKey} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <span style={{fontFamily:F2,fontSize:9,fontWeight:700,letterSpacing:"0.08em",color:isToday?"#0a0a0a":"#d0d0d0",textTransform:"uppercase"}}>{dayLabels[i]}</span>
                <div style={{width:36,height:36,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:isFire?"#0a0a0a":isMissed?"#fff5f5":isToday?"#f0f0f0":"white",border:isFire?"none":isMissed?"1.5px solid #e63946":isToday?"2px solid #0a0a0a":"1.5px solid #ebebeb",fontSize:isFire?14:isMissed?11:9,color:isFire?"white":isMissed?"#e63946":"#bbb",fontWeight:700,transition:"all 0.2s"}}>{isFire?"🔥":isMissed?"✕":mins>0?"":"·"}</div>
                {mins>0&&!isFire&&<span style={{fontFamily:F2,fontSize:8,color:"#ccc"}}>{formatHM(mins)}</span>}
              </div>);
            })}
          </div>
          <div style={{marginLeft:8,background:"#0a0a0a",color:"white",padding:"8px 16px",borderRadius:20,fontFamily:F2,fontSize:13,fontWeight:600,whiteSpace:"nowrap"}}>{formatHM(weekTotal)} wk</div>
        </div>
      </div>
    </div>
  );
}

function Wrap({children}) { return <div className="fade" style={{width:"100%",maxWidth:1400,margin:"0 auto",padding:"36px 28px 80px"}}>{children}</div>; }
function SH({children,action}) { return <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:20}}><h1 style={{fontFamily:F1,fontSize:38,fontWeight:600,letterSpacing:"-0.02em"}}>{children}</h1>{action&&<div>{action}</div>}</div>; }

function TimerPage({sessions,setSessions}) {
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
  const toggle=()=>{if(!running){initBell();playStartPop();}else playStopPop();setRunning(!running);};
  const reset=()=>{setRunning(false);setElapsed(0);};
  const skip=()=>{setRunning(false);if(mode==="focus"){if(elapsed>30)addS({id:Date.now(),tag:tag||"Untitled",duration:Math.max(1,Math.round(elapsed/60)),date:todayStr(),ts:Date.now()});setMode("break");}else setMode("focus");setElapsed(0);};
  const [mTag,setMTag]=useState(""); const [mMin,setMMin]=useState("");
  const logM=()=>{const m=parseInt(mMin);if(!mTag.trim()||isNaN(m)||m<=0)return;addS({id:Date.now(),tag:mTag.trim(),duration:m,date:todayStr(),ts:Date.now()});setMTag("");setMMin("");};
  const todaySess=sessions.filter(s=>s.date===todayStr());
  const todayTotal=todaySess.reduce((a,s)=>a+s.duration,0);
  const R=100; const C=2*Math.PI*R;
  return(
    <Wrap>
      <div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:28,alignItems:"start"}}>
        <div>
          <input value={tag} onChange={e=>setTag(e.target.value)} placeholder="What are you studying today?"
            style={{fontFamily:F1,fontSize:32,fontWeight:500,fontStyle:tag?"normal":"italic",color:"#0a0a0a",background:"transparent",border:"none",borderBottom:"2px solid #eee",padding:"6px 0",width:"100%",outline:"none",marginBottom:24,transition:"border-color 0.2s"}}
            onFocus={e=>e.target.style.borderBottomColor="#0a0a0a"} onBlur={e=>e.target.style.borderBottomColor="#eee"} />
          {editing?(<div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}><Lbl style={{margin:0}}>Focus</Lbl><input value={tf} onChange={e=>setTf(e.target.value)} type="number" style={{width:56,border:"1.5px solid #0a0a0a",padding:"6px 8px",fontSize:14,fontFamily:F2,textAlign:"center",background:"transparent",outline:"none",borderRadius:6}} /><Lbl style={{margin:0}}>Break</Lbl><input value={tb} onChange={e=>setTb(e.target.value)} type="number" style={{width:56,border:"1.5px solid #0a0a0a",padding:"6px 8px",fontSize:14,fontFamily:F2,textAlign:"center",background:"transparent",outline:"none",borderRadius:6}} /><Lbl style={{margin:0}}>min</Lbl><Btn size="sm" onClick={()=>{const f=parseInt(tf),b=parseInt(tb);if(f>0)setFocusMins(f);if(b>0)setBreakMins(b);setElapsed(0);setRunning(false);setEditing(false);}}>Set</Btn><Btn size="sm" variant="ghost" onClick={()=>setEditing(false)}>✕</Btn></div>):(<button onClick={()=>{setTf(String(focusMins));setTb(String(breakMins));setEditing(true);}} style={{border:"none",background:"none",cursor:"pointer",fontFamily:F2,fontSize:12,color:"#bbb",fontWeight:500,marginBottom:20,textDecoration:"underline",textUnderlineOffset:3}}>⚙ {focusMins}m focus / {breakMins}m break</button>)}
          <div style={{display:"flex",justifyContent:"center",marginBottom:28}}>
            <div style={{position:"relative",width:260,height:260}}>
              <svg width={260} height={260} style={{transform:"rotate(-90deg)"}}><circle cx={130} cy={130} r={R} fill="none" stroke="#f0f0f0" strokeWidth={7} /><circle cx={130} cy={130} r={R} fill="none" stroke={mode==="focus"?"#0a0a0a":"#aaa"} strokeWidth={7} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C*(1-progress)} style={{transition:"stroke-dashoffset 0.3s ease"}} /></svg>
              <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}><div style={{fontFamily:F2,fontSize:10,textTransform:"uppercase",letterSpacing:"0.2em",color:"#ccc",marginBottom:6,fontWeight:700}}>{mode==="focus"?"Focus":"Break"}</div><div style={{fontFamily:F1,fontSize:54,fontWeight:500,letterSpacing:"-0.03em",lineHeight:1}}>{formatTime(remaining)}</div></div>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"center",gap:10,marginBottom:36}}>
            <Btn size="lg" variant={running?"outline":"primary"} onClick={toggle}>{running?"Pause":"Start"}</Btn>
            <Btn size="lg" variant="ghost" onClick={reset}>Reset</Btn>
            <Btn size="lg" variant="ghost" onClick={skip}>Skip →</Btn>
          </div>
          <Card><CP><Lbl>Quick Log</Lbl><div style={{display:"flex",gap:8}}><FInput value={mTag} onChange={e=>setMTag(e.target.value)} placeholder="Tag / topic" style={{flex:1}} /><FInput value={mMin} onChange={e=>setMMin(e.target.value)} placeholder="mins" type="number" style={{width:88}} /><Btn onClick={logM}>+ Log</Btn></div></CP></Card>
        </div>
        <div style={{position:"sticky",top:68}}>
          <Card>
            <div style={{padding:"18px 24px",borderBottom:"1px solid #f5f5f5",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontFamily:F2,fontSize:11,fontWeight:700,color:"#0a0a0a",textTransform:"uppercase",letterSpacing:"0.1em"}}>Today</span><span style={{fontFamily:F1,fontSize:28,fontWeight:600,color:todayTotal>=120?"#2a9d8f":"#0a0a0a"}}>{formatHM(todayTotal)} {todayTotal>=120&&"🔥"}</span></div>
            {todaySess.length===0?(<div style={{padding:"40px 24px",textAlign:"center",fontFamily:F2,fontSize:13,color:"#ccc"}}>No sessions yet. Start studying!</div>):todaySess.map(s=>(<div key={s.id} className="hov-row" style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 24px",borderBottom:"1px solid #f8f8f8",transition:"background 0.1s"}}><span style={{fontFamily:F2,fontSize:14,fontWeight:500}}>{s.tag}</span><span style={{fontFamily:F2,fontSize:13,color:"#bbb"}}>{formatHM(s.duration)}</span></div>))}
          </Card>
        </div>
      </div>
    </Wrap>
  );
}

function TasksPage({tasks,setTasks}) {
  const [selDate,setSelDate]=useState(todayStr()); const [newTask,setNewTask]=useState("");
  const isToday=selDate===todayStr();
  const shift=dir=>{const d=new Date(selDate+"T12:00:00");d.setDate(d.getDate()+dir);setSelDate(d.toISOString().slice(0,10));};
  const dl=isToday?"Today":new Date(selDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
  const dayTasks=tasks.filter(t=>t.date===selDate&&!t.time_slot);
  const plannerTasks=tasks.filter(t=>t.date===selDate&&t.time_slot);
  const add=async()=>{if(!newTask.trim())return;const s=await insertTask(newTask.trim(),selDate,null);if(s)setTasks(p=>[...p,s]);setNewTask("");};
  const toggle=async t=>{const nv=t.completed_date?null:todayStr();await updateTaskCompleted(t.id,nv);setTasks(p=>p.map(x=>x.id===t.id?{...x,completed_date:nv}:x));};
  const remove=async id=>{await deleteTask(id);setTasks(p=>p.filter(t=>t.id!==id));};
  const addPlanner=async(slotKey,title)=>{if(!title.trim()||plannerTasks.find(t=>t.time_slot===slotKey))return;const s=await insertTask(title.trim(),selDate,slotKey);if(s)setTasks(p=>[...p,s]);};
  const slots=[];for(let h=4;h<=23;h++){const f=hr=>hr===0?"12 AM":hr<12?`${hr} AM`:hr===12?"12 PM":`${hr-12} PM`;slots.push({label:`${f(h)} – ${f(h+1>23?0:h+1)}`,key:`${h}-${h+1}`});}
  const navB={border:"1px solid rgba(0,0,0,0.1)",background:"white",width:36,height:36,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:8};
  return(
    <Wrap>
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:28}}><button style={navB} onClick={()=>shift(-1)}>←</button><h1 style={{fontFamily:F1,fontSize:36,fontWeight:600,letterSpacing:"-0.02em",flex:1}}>{dl}</h1><button style={navB} onClick={()=>shift(1)}>→</button></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 400px",gap:24,alignItems:"start"}}>
        <div>
          <div style={{display:"flex",gap:8,marginBottom:20}}><FInput value={newTask} onChange={e=>setNewTask(e.target.value)} placeholder="Add a task..." onKeyDown={e=>e.key==="Enter"&&add()} style={{flex:1}} /><Btn onClick={add}>Add</Btn></div>
          <Lbl>Tasks ({dayTasks.filter(t=>t.completed_date).length}/{dayTasks.length})</Lbl>
          <Card>
            {dayTasks.length===0?<div style={{padding:"32px",textAlign:"center",fontFamily:F2,fontSize:13,color:"#ccc"}}>No tasks for this day</div>
              :dayTasks.map(t=>{const done=!!t.completed_date; return(<div key={t.id} className="hov-row" style={{display:"flex",alignItems:"center",gap:14,padding:"14px 20px",borderBottom:"1px solid #f5f5f5",transition:"background 0.1s"}}><button onClick={()=>toggle(t)} style={{width:22,height:22,borderRadius:6,border:done?"none":"1.5px solid #ddd",background:done?"#0a0a0a":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:12,flexShrink:0,transition:"all 0.15s"}}>{done&&"✓"}</button><span style={{flex:1,fontFamily:F2,fontWeight:500,fontSize:14,textDecoration:done?"line-through":"none",color:done?"#ccc":"#0a0a0a"}}>{t.title}</span><button onClick={()=>remove(t.id)} style={{border:"none",background:"none",cursor:"pointer",color:"#ddd",fontSize:15}}>✕</button></div>);})}
          </Card>
        </div>
        <div>
          <Lbl>Day Planner</Lbl>
          <Card><div style={{maxHeight:540,overflowY:"auto"}}>
            {slots.map((sl,i)=>{const st=plannerTasks.find(t=>t.time_slot===sl.key); const done=st&&!!st.completed_date; return(<div key={sl.key} style={{display:"flex",borderBottom:i<slots.length-1?"1px solid #f5f5f5":"none",minHeight:44}}><div style={{width:96,padding:"12px 12px",background:"#fafafa",flexShrink:0,display:"flex",alignItems:"center",fontFamily:F2,fontSize:11,fontWeight:500,color:"#bbb",borderRight:"1px solid #f0f0f0"}}>{sl.label}</div><div style={{flex:1,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>{st?<><button onClick={()=>toggle(st)} style={{width:20,height:20,borderRadius:5,border:done?"none":"1.5px solid #ddd",background:done?"#0a0a0a":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:11,flexShrink:0}}>{done&&"✓"}</button><span style={{flex:1,fontSize:13,fontFamily:F2,fontWeight:500,textDecoration:done?"line-through":"none",color:done?"#ccc":"#0a0a0a"}}>{st.title}</span><button onClick={()=>remove(st.id)} style={{border:"none",background:"none",cursor:"pointer",color:"#ddd",fontSize:14}}>✕</button></>:<PlannerInput onAdd={t=>addPlanner(sl.key,t)} />}</div></div>);})}
          </div></Card>
        </div>
      </div>
    </Wrap>
  );
}

function PlannerInput({onAdd}) { const [v,setV]=useState(""); return <input value={v} onChange={e=>setV(e.target.value)} onKeyDown={e=>e.key==="Enter"&&v.trim()&&(onAdd(v.trim()),setV(""))} placeholder="+ add task" style={{border:"none",background:"transparent",fontSize:12,fontFamily:F2,outline:"none",color:"#ccc",width:"100%"}} />; }

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

function TagBarChart({sorted,allTags}) {
  if(!sorted.length) return null;
  const mv=sorted[0][1]; const bH=150;
  return(<div style={{overflowX:"auto"}}><div style={{display:"flex",alignItems:"flex-end",gap:8,minWidth:sorted.length*68,height:bH+44,paddingTop:20}}>{sorted.map(([tag,mins])=>{const h=mv>0?(mins/mv)*bH:0;const color=tc(tag,allTags);return<div key={tag} style={{flex:1,minWidth:56,maxWidth:90,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:bH+44}}><span style={{fontSize:10,fontFamily:F2,fontWeight:700,marginBottom:4,color}}>{formatHM(mins)}</span><div style={{width:"100%",height:h,background:color,borderRadius:"4px 4px 0 0",transition:"height 0.4s ease",minHeight:mins>0?6:0}} /><span style={{fontSize:10,fontFamily:F2,marginTop:6,textAlign:"center",color:"#888",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%"}}>{tag}</span></div>;}}</div></div>);
}

function PeriodChart({dates,sessions}) {
  const dt=getDayTotals(sessions); const data=dates.map(d=>({date:d,mins:dt[d]||0}));
  const maxVal=Math.max(...data.map(d=>d.mins),1); const peakVal=Math.max(...data.map(d=>d.mins));
  const bH=130; const total=data.reduce((a,d)=>a+d.mins,0); const active=data.filter(d=>d.mins>0).length; const avg=active>0?Math.round(total/active):0;
  const isW=dates.length<=7;
  return(<div><div style={{display:"flex",gap:28,marginBottom:16}}>{[["Total",total],["Peak",peakVal],["Avg/day",avg]].map(([l,v])=><div key={l}><div style={{fontFamily:F1,fontSize:32,fontWeight:600,letterSpacing:"-0.02em"}}>{formatHM(v)}</div><div style={{fontFamily:F2,fontSize:9,color:"#bbb",textTransform:"uppercase",letterSpacing:"0.15em",fontWeight:600}}>{l}</div></div>)}</div><div style={{position:"relative",overflowX:"auto"}}><div style={{display:"flex",alignItems:"flex-end",gap:isW?10:2,minWidth:isW?dates.length*56:dates.length*12,height:bH+48,paddingTop:24,position:"relative"}}>{peakVal>0&&<div style={{position:"absolute",top:24,left:0,right:0,height:bH,pointerEvents:"none"}}><div style={{position:"absolute",bottom:`${(peakVal/maxVal)*bH}px`,left:0,right:0,borderTop:"1.5px dashed #e63946",opacity:0.35}} /></div>}{data.map(d=>{const h=maxVal>0?(d.mins/maxVal)*bH:0;const isPeak=d.mins===peakVal&&d.mins>0;const dl=isW?new Date(d.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short"}):String(new Date(d.date+"T12:00:00").getDate());return<div key={d.date} style={{flex:1,minWidth:isW?40:8,maxWidth:isW?68:20,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:bH+48}}>{isW&&d.mins>0&&<span style={{fontSize:10,fontFamily:F2,fontWeight:600,marginBottom:3,color:isPeak?"#e63946":"#aaa"}}>{formatHM(d.mins)}</span>}<div style={{width:"100%",height:h,background:isPeak?"linear-gradient(180deg,#e63946,#ff6b6b)":getBarGrad(d.mins),borderRadius:"3px 3px 0 0",transition:"height 0.4s ease",minHeight:d.mins>0?4:1}} /><span style={{fontSize:isW?10:8,fontFamily:F2,marginTop:4,color:isPeak?"#e63946":"#ccc",fontWeight:isPeak?700:400}}>{dl}</span></div>;}}</div></div></div>);
}

function AnalysisPage({sessions}) {
  const [selDate,setSelDate]=useState(todayStr()); const [showReports,setShowReports]=useState(false); const [showAdv,setShowAdv]=useState(false);
  const [viewMonth,setViewMonth]=useState(()=>{const d=new Date();return{year:d.getFullYear(),month:d.getMonth()};});
  const daySess=sessions.filter(s=>s.date===selDate); const tt={}; daySess.forEach(s=>{tt[s.tag]=(tt[s.tag]||0)+s.duration;});
  const totalMins=daySess.reduce((a,s)=>a+s.duration,0); const sorted=Object.entries(tt).sort((a,b)=>b[1]-a[1]);
  const allTags=[...new Set(sessions.map(s=>s.tag))];
  const shiftD=dir=>{const d=new Date(selDate+"T12:00:00");d.setDate(d.getDate()+dir);setSelDate(d.toISOString().slice(0,10));};
  const isToday=selDate===todayStr();
  const dl=isToday?"Today":new Date(selDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
  const dtAll=getDayTotals(sessions); const weekDates=getWeekRange(selDate); const monthDates=getMonthDates(viewMonth.year,viewMonth.month);
  const monthLabel=new Date(viewMonth.year,viewMonth.month).toLocaleDateString("en-US",{month:"long",year:"numeric"});
  const shiftM=dir=>setViewMonth(p=>{let m=p.month+dir,y=p.year;if(m<0){m=11;y--;}if(m>11){m=0;y++;}return{year:y,month:m};});
  const tagDT={}; sessions.forEach(s=>{if(!tagDT[s.tag])tagDT[s.tag]={};tagDT[s.tag][s.date]=(tagDT[s.tag][s.date]||0)+s.duration;});
  const pBests=Object.entries(tagDT).map(([tag,days])=>{const b=Object.entries(days).sort((a,b)=>b[1]-a[1])[0];return{tag,mins:b?b[1]:0,date:b?b[0]:""};}).sort((a,b)=>b.mins-a.mins);
  const navB={border:"1px solid rgba(0,0,0,0.1)",background:"white",width:34,height:34,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:8};
  const bCounts=[{l:"0–30m",min:0,max:30},{l:"30–1h",min:30,max:60},{l:"1–2h",min:60,max:120},{l:"2–3h",min:120,max:180},{l:"3–4h",min:180,max:240},{l:"4h+",min:240,max:99999}].map(b=>({...b,count:Object.values(dtAll).filter(m=>m>=b.min&&m<b.max).length}));
  const maxB=Math.max(...bCounts.map(b=>b.count),1);
  const dowSets=[0,1,2,3,4,5,6].map(()=>new Set()); Object.keys(dtAll).forEach(d=>{dowSets[new Date(d+"T12:00:00").getDay()].add(d);});
  const dowNames=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const bestDow=[...dowSets.map((s,i)=>({dow:i,count:s.size}))].sort((a,b)=>b.count-a.count)[0];
  const winSets={}; sessions.forEach(s=>{if(!s.ts)return;const hr=new Date(s.ts).getHours();const st2=Math.floor(hr/2)*2;const en=st2+2;const f=h=>h===0?"12 AM":h<12?`${h} AM`:h===12?"12 PM":`${h-12} PM`;const l=`${f(st2)}–${f(en>23?0:en)}`;if(!winSets[l])winSets[l]=new Set();winSets[l].add(s.date);});
  const winData=Object.entries(winSets).map(([l,s])=>({label:l,count:s.size})).sort((a,b)=>b.count-a.count); const bestWin=winData[0];
  const zones=[{l:"< 1 hr",min:0,max:60},{l:"1–2 hrs",min:60,max:120},{l:"2–3 hrs",min:120,max:180},{l:"3–4 hrs",min:180,max:240},{l:"4+ hrs",min:240,max:99999}];
  const bestZone=zones.map(z=>({...z,count:Object.values(dtAll).filter(m=>m>=z.min&&m<z.max).length})).sort((a,b)=>b.count-a.count)[0];
  return(
    <Wrap>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}><div style={{display:"flex",alignItems:"center",gap:12}}><button style={navB} onClick={()=>shiftD(-1)}>←</button><h1 style={{fontFamily:F1,fontSize:32,fontWeight:600,letterSpacing:"-0.02em"}}>{dl}</h1><button style={{...navB,opacity:isToday?0.2:1,pointerEvents:isToday?"none":"auto"}} onClick={()=>shiftD(1)}>→</button></div><Btn variant="outline" size="sm" onClick={()=>exportXLSX(sessions)} disabled={!sessions.length}>↓ Export</Btn></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <Card><CP><div style={{fontFamily:F1,fontSize:56,fontWeight:500,letterSpacing:"-0.03em",lineHeight:1,marginBottom:8}}>{formatHM(totalMins)}</div><div style={{fontFamily:F2,fontSize:10,color:"#bbb",textTransform:"uppercase",letterSpacing:"0.15em",fontWeight:600}}>Total today {totalMins>=120&&"🔥"}</div>{sorted.length>0&&<div style={{marginTop:20}}><TagBarChart sorted={sorted} allTags={allTags} /></div>}</CP></Card>
        <Card><CP><Lbl>Session Log</Lbl>{daySess.length===0?<div style={{color:"#ccc",fontFamily:F2,fontSize:13,textAlign:"center",paddingTop:16}}>No sessions recorded</div>:daySess.map(s=><div key={s.id} className="hov-row" style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #f8f8f8",fontFamily:F2,fontSize:13,transition:"background 0.1s"}}><span style={{display:"flex",alignItems:"center",gap:8}}><span style={{width:8,height:8,borderRadius:2,background:tc(s.tag,allTags),display:"inline-block"}} /><span style={{fontWeight:500}}>{s.tag}</span></span><span style={{color:"#bbb"}}>{formatHM(s.duration)}</span></div>)}</CP></Card>
      </div>
      <div style={{textAlign:"center",marginBottom:12}}><Btn variant={showReports?"primary":"outline"} onClick={()=>setShowReports(!showReports)}>{showReports?"▲ Hide Reports":"▼ Weekly & Monthly Reports"}</Btn></div>
      <div style={{maxHeight:showReports?"2000px":"0",overflow:"hidden",transition:"max-height 0.5s ease,opacity 0.4s",opacity:showReports?1:0}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
          <Card><CP><h3 style={{fontFamily:F1,fontSize:24,fontWeight:600,marginBottom:16}}>Weekly Report</h3><PeriodChart dates={weekDates} sessions={sessions} /></CP></Card>
          <Card><CP><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h3 style={{fontFamily:F1,fontSize:24,fontWeight:600}}>Monthly — {monthLabel}</h3><div style={{display:"flex",gap:8}}><button style={navB} onClick={()=>shiftM(-1)}>←</button><button style={navB} onClick={()=>shiftM(1)}>→</button></div></div><PeriodChart dates={monthDates} sessions={sessions} /></CP></Card>
        </div>
      </div>
      {pBests.length>0&&<Card style={{marginBottom:12}}><CP><h3 style={{fontFamily:F1,fontSize:24,fontWeight:600,marginBottom:16}}>🏆 Personal Bests</h3>{pBests.map((b,i)=><div key={b.tag} className="hov-row" style={{display:"grid",gridTemplateColumns:"1fr 100px 80px",padding:"12px 0",borderBottom:"1px solid #f8f8f8",alignItems:"center",transition:"background 0.1s"}}><span style={{display:"flex",alignItems:"center",gap:8,fontFamily:F2,fontSize:14,fontWeight:500}}><span style={{width:8,height:8,borderRadius:2,background:tc(b.tag,allTags),display:"inline-block"}} />{b.tag}{i===0&&" 👑"}</span><span style={{textAlign:"right",fontFamily:F2,fontWeight:700,color:"#2a9d8f",fontSize:14}}>{formatHM(b.mins)}</span><span style={{textAlign:"right",fontFamily:F2,fontSize:11,color:"#ccc"}}>{b.date?new Date(b.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}):"—"}</span></div>)}</CP></Card>}
      <div style={{textAlign:"center",marginBottom:12}}><Btn variant={showAdv?"primary":"outline"} onClick={()=>setShowAdv(!showAdv)}>{showAdv?"▲ Hide Advanced":"▼ Advanced Analysis"}</Btn></div>
      <div style={{maxHeight:showAdv?"3000px":"0",overflow:"hidden",transition:"max-height 0.5s ease,opacity 0.4s",opacity:showAdv?1:0}}>
        <Card style={{marginBottom:12}}><CP><h3 style={{fontFamily:F1,fontSize:24,fontWeight:600,marginBottom:16}}>Distribution</h3><div style={{display:"flex",alignItems:"flex-end",gap:8,height:160,paddingTop:16}}>{bCounts.map((c,i)=>{const h=maxB>0?(c.count/maxB)*120:0;const cols=["#e63946","#e63946","#f4a261","#2a9d8f","#2a9d8f","#457b9d"];return<div key={c.l} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:160}}><span style={{fontSize:11,fontFamily:F2,fontWeight:700,marginBottom:4,color:cols[i]}}>{c.count>0?c.count:""}</span><div style={{width:"100%",height:h,background:cols[i],borderRadius:"4px 4px 0 0",opacity:0.8,minHeight:c.count>0?6:2}} /><span style={{fontSize:9,fontFamily:F2,marginTop:5,color:"#ccc"}}>{c.l}</span></div>;}}</div></CP></Card>
        {sessions.length>0&&<Card><CP><h3 style={{fontFamily:F1,fontSize:24,fontWeight:600,marginBottom:16}}>Focus Insights</h3>{[{l:"Comfort Zone",s:"Most consistent range",v:bestZone?.count>0?bestZone.l:"—",c:bestZone?.count>0?`${bestZone.count} days`:"—",col:"#6a4c93"},{l:"Best Focus Day",s:"Day you study most",v:bestDow?.count>0?dowNames[bestDow.dow]:"—",c:bestDow?.count>0?`${bestDow.count} days`:"—",col:"#2a9d8f"},{l:"Peak Time Window",s:"When you focus most",v:bestWin?bestWin.label:"—",c:bestWin?`${bestWin.count} days`:"—",col:"#457b9d"}].map(row=><div key={row.l} className="hov-row" style={{display:"grid",gridTemplateColumns:"1fr 140px 80px",padding:"14px 0",borderBottom:"1px solid #f8f8f8",alignItems:"center",transition:"background 0.1s"}}><div><div style={{fontFamily:F2,fontWeight:600,fontSize:14}}>{row.l}</div><div style={{fontFamily:F2,fontSize:11,color:"#bbb",marginTop:2}}>{row.s}</div></div><span style={{textAlign:"right",fontFamily:F2,fontWeight:700,color:row.col,fontSize:14}}>{row.v}</span><span style={{textAlign:"right",fontFamily:F2,fontSize:12,color:"#888"}}>{row.c}</span></div>)}</CP></Card>}
      </div>
    </Wrap>
  );
}

function CalendarPage({sessions}) {
  const [vd,setVd]=useState(new Date()); const fire=getFireDays(sessions);
  const year=vd.getFullYear(); const month=vd.getMonth();
  const firstDay=new Date(year,month,1).getDay(); const dim=new Date(year,month+1,0).getDate();
  const mName=vd.toLocaleDateString("en-US",{month:"long",year:"numeric"});
  const cells=[]; for(let i=0;i<firstDay;i++) cells.push(null); for(let d=1;d<=dim;d++) cells.push(d);
  const shift=dir=>{const d=new Date(vd);d.setMonth(d.getMonth()+dir);setVd(d);};
  const tod=new Date(); const isCur=year===tod.getFullYear()&&month===tod.getMonth();
  const mfc=[...Array(dim)].filter((_,i)=>fire.has(`${year}-${String(month+1).padStart(2,"0")}-${String(i+1).padStart(2,"0")}`)).length;
  const navB={border:"1px solid rgba(0,0,0,0.1)",background:"white",width:38,height:38,cursor:"pointer",fontSize:17,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:10};
  return(
    <Wrap>
      <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:6}}><button style={navB} onClick={()=>shift(-1)}>←</button><h1 style={{fontFamily:F1,fontSize:42,fontWeight:600,letterSpacing:"-0.02em",flex:1}}>{mName}</h1><button style={navB} onClick={()=>shift(1)}>→</button></div>
      <div style={{fontFamily:F2,fontSize:13,color:"#bbb",marginBottom:20}}>{mfc} fire {mfc===1?"day":"days"} this month · 🔥 = 2h+ hit · ✕ = missed</div>
      <Card><div style={{padding:"24px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:8}}>{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d,i)=><div key={i} style={{textAlign:"center",fontFamily:F2,fontSize:10,fontWeight:600,color:"#ccc",padding:"4px 0",letterSpacing:"0.06em"}}>{d}</div>)}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
          {cells.map((day,i)=>{if(!day) return <div key={`e${i}`} />; const k=`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`; const isFire=fire.has(k); const isToday=isCur&&day===tod.getDate(); const missed=isPastDate(k)&&!isFire; return<div key={i} style={{aspectRatio:"1",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:isFire?"#0a0a0a":missed?"#fff5f5":isToday?"#f5f5f5":"transparent",color:isFire?"white":missed?"#e63946":"#0a0a0a",border:isToday&&!isFire?"2px solid #0a0a0a":"2px solid transparent",borderRadius:8,transition:"all 0.15s"}}>{isFire&&<span style={{fontSize:15,lineHeight:1}}>🔥</span>}{missed&&<span style={{fontSize:11,lineHeight:1}}>✕</span>}<span style={{fontFamily:F2,fontSize:isFire||missed?10:13,fontWeight:isToday?800:400,lineHeight:1,marginTop:isFire||missed?1:0}}>{day}</span></div>;})}
        </div>
      </div></Card>
    </Wrap>
  );
}

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
  if(!loaded) return <Wrap><div style={{textAlign:"center",padding:"60px 0",fontFamily:F2,color:"#bbb"}}>Loading...</div></Wrap>;
  return(
    <Wrap>
      <SH>Daily Reflection</SH>
      <Card>
        <div style={{display:"grid",gridTemplateColumns:"100px 1fr 80px",padding:"10px 24px",borderBottom:"2px solid #0a0a0a"}}>{["Date","Reflection","Hours"].map((h,i)=><span key={h} style={{fontFamily:F2,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.14em",color:"#bbb",textAlign:i===2?"right":"left"}}>{h}</span>)}</div>
        {allDates.map(d=>{
          const hrs=getH(d); const mins=getM(d); const green=mins>=120; const r=refs[d]||{}; const isE=editKey===d; const isTd=d===today;
          const dl=new Date(d+"T12:00:00").toLocaleDateString("en-US",{weekday:"short"}); const dLabel=new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
          return<div key={d} className="hov-row" onClick={()=>{if(!isE)startEdit(d);}} style={{display:"grid",gridTemplateColumns:"100px 1fr 80px",padding:"14px 24px",borderBottom:"1px solid #f5f5f5",background:green?"rgba(42,157,143,0.04)":"white",cursor:isE?"default":"pointer",transition:"background 0.1s"}}>
            <div><div style={{fontFamily:F2,fontWeight:600,fontSize:13}}>{dl}</div><div style={{fontFamily:F2,fontSize:11,color:"#ccc"}}>{dLabel}</div></div>
            <div style={{display:"flex",alignItems:"center",paddingRight:12}}>{isE?<div style={{display:"flex",gap:8,width:"100%",alignItems:"center"}}><input value={editText} onChange={e=>setEditText(e.target.value)} autoFocus placeholder="How was your study session?" onKeyDown={e=>{if(e.key==="Enter")saveRow(d);if(e.key==="Escape")setEditKey(null);}} style={{flex:1,border:"none",borderBottom:"2px solid #0a0a0a",background:"transparent",fontSize:13,fontFamily:F2,padding:"4px 0",outline:"none"}} /><Btn size="sm" onClick={e=>{e.stopPropagation();saveRow(d);}}>Save</Btn></div>:<span style={{color:r.note?"#0a0a0a":"#ccc",fontSize:13,fontWeight:r.note?400:300}}>{r.note||(isTd?"Click to add today's reflection...":"—")}</span>}</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end"}}>{isE?<input value={editHrs} onChange={e=>setEditHrs(e.target.value)} placeholder={hrs.toFixed(1)} type="number" step="0.1" onKeyDown={e=>e.key==="Enter"&&saveRow(d)} style={{width:52,border:"none",borderBottom:"1.5px solid #0a0a0a",background:"transparent",fontSize:13,fontFamily:F2,textAlign:"right",padding:"4px 0",outline:"none"}} />:<div style={{fontFamily:F1,fontWeight:600,fontSize:22,color:green?"#2a9d8f":"#e63946"}}>{hrs.toFixed(1)}h</div>}</div>
          </div>;
        })}
      </Card>
      <div style={{display:"flex",gap:16,marginTop:12,fontFamily:F2,fontSize:11,color:"#ccc"}}><span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:"rgba(42,157,143,0.15)",border:"1px solid rgba(42,157,143,0.3)",display:"inline-block",borderRadius:2}} /> 2h+ goal</span><span>Click any row to edit</span></div>
    </Wrap>
  );
}

function SleepPage({sleepLogs,setSleepLogs}) {
  const [ss,setSS]=useState("23:00"); const [wu,setWU]=useState("06:30"); const [ld,setLD]=useState(todayStr());
  const calcM=(a,b)=>{const[sh,sm]=a.split(":").map(Number);const[wh,wm]=b.split(":").map(Number);let s=sh*60+sm,w=wh*60+wm;if(w<=s)w+=1440;return w-s;};
  const log=async()=>{const m=calcM(ss,wu);const s=await upsertSleepLog(ld,ss,wu,m);if(s)setSleepLogs(p=>[s,...p.filter(l=>l.date!==ld)].sort((a,b)=>b.date.localeCompare(a.date)));};
  const sc=m=>m<360?"#f4a261":m<=450?"#2a9d8f":"#e63946";
  const last14=[]; for(let i=13;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);last14.push(d.toISOString().slice(0,10));}
  const lm={}; sleepLogs.forEach(l=>{lm[l.date]=l;}); const bd=last14.map(d=>({date:d,mins:lm[d]?.total_mins||0})); const maxS=Math.max(...bd.map(d=>d.mins),1); const BH=110;
  const r7=sleepLogs.slice(0,7); const avgS=r7.length>0?Math.round(r7.reduce((a,l)=>a+(l.total_mins||0),0)/r7.length):0;
  const avgBed=r7.length>0?r7.map(l=>l.sleep_start||"23:00").sort()[Math.floor(r7.length/2)]:"—"; const avgWk=r7.length>0?r7.map(l=>l.wake_up||"07:00").sort()[Math.floor(r7.length/2)]:"—";
  const tm=todayStr().slice(0,7); const mLogs=sleepLogs.filter(l=>l.date.startsWith(tm)); const mAvg=mLogs.length>0?Math.round(mLogs.reduce((a,l)=>a+(l.total_mins||0),0)/mLogs.length):0;
  const tIS={border:"none",borderBottom:"1.5px solid #eee",padding:"10px 0",fontSize:14,fontFamily:F2,fontWeight:500,outline:"none",background:"transparent",color:"#0a0a0a",transition:"border-color 0.15s",width:"100%"};
  return(
    <Wrap>
      <SH>Sleep Tracker</SH>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,alignItems:"start"}}>
        <div>
          <Card style={{marginBottom:16}}><CP><Lbl>Log Sleep</Lbl><div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:20}}><div style={{flex:1,minWidth:100}}><Lbl style={{marginBottom:4,fontSize:9}}>Date</Lbl><input type="date" value={ld} onChange={e=>setLD(e.target.value)} style={tIS} onFocus={e=>e.target.style.borderBottomColor="#0a0a0a"} onBlur={e=>e.target.style.borderBottomColor="#eee"} /></div><div style={{flex:1,minWidth:80}}><Lbl style={{marginBottom:4,fontSize:9}}>Slept at</Lbl><input type="time" value={ss} onChange={e=>setSS(e.target.value)} style={tIS} onFocus={e=>e.target.style.borderBottomColor="#0a0a0a"} onBlur={e=>e.target.style.borderBottomColor="#eee"} /></div><div style={{flex:1,minWidth:80}}><Lbl style={{marginBottom:4,fontSize:9}}>Woke up</Lbl><input type="time" value={wu} onChange={e=>setWU(e.target.value)} style={tIS} onFocus={e=>e.target.style.borderBottomColor="#0a0a0a"} onBlur={e=>e.target.style.borderBottomColor="#eee"} /></div></div><Btn full size="lg" onClick={log}>Log Sleep</Btn></CP></Card>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{[{t:"Weekly avg",v:formatHM(avgS),lines:[`Bed: ${avgBed}`,`Wake: ${avgWk}`]},{t:"Monthly avg",v:formatHM(mAvg),lines:[`${mLogs.length} nights logged`]}].map(c=>(<Card key={c.t}><CP><Lbl style={{marginBottom:6}}>{c.t}</Lbl><div style={{fontFamily:F1,fontSize:32,fontWeight:600,marginBottom:8}}>{c.v}</div>{c.lines.map(l=><div key={l} style={{fontFamily:F2,fontSize:12,color:"#bbb"}}>{l}</div>)}</CP></Card>))}</div>
        </div>
        <div>
          <Card style={{marginBottom:16}}><CP><Lbl>Last 14 Days</Lbl><div style={{overflowX:"auto"}}><div style={{display:"flex",alignItems:"flex-end",gap:4,minWidth:14*32,height:BH+40,paddingTop:16}}>{bd.map(d=>{const h=d.mins>0?(d.mins/maxS)*BH:0;const c=d.mins>0?sc(d.mins):"#f0f0f0";const dl=new Date(d.date+"T12:00:00").getDate();return<div key={d.date} style={{flex:1,minWidth:20,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:BH+40}}>{d.mins>0&&<span style={{fontSize:8,fontFamily:F2,fontWeight:700,marginBottom:2,color:c}}>{formatHM(d.mins)}</span>}<div style={{width:"100%",height:h,background:c,borderRadius:"3px 3px 0 0",minHeight:d.mins>0?4:1}} /><span style={{fontSize:8,fontFamily:F2,marginTop:3,color:"#ccc"}}>{dl}</span></div>;}}</div></div><div style={{display:"flex",gap:12,marginTop:10,fontFamily:F2,fontSize:10,color:"#bbb"}}>{[{c:"#f4a261",l:"<6h"},{c:"#2a9d8f",l:"6–7.5h ✓"},{c:"#e63946",l:"7.5h+"}].map(x=><span key={x.l} style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,background:x.c,borderRadius:2,display:"inline-block"}} />{x.l}</span>)}</div></CP></Card>
          <Card><div style={{display:"grid",gridTemplateColumns:"1fr 60px 60px 64px",padding:"10px 20px",borderBottom:"2px solid #0a0a0a"}}>{["Date","Sleep","Wake","Total"].map((h,i)=><span key={h} style={{fontFamily:F2,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.14em",color:"#bbb",textAlign:i===3?"right":"left"}}>{h}</span>)}</div>{sleepLogs.length===0?<div style={{padding:"28px",textAlign:"center",fontFamily:F2,fontSize:13,color:"#ccc"}}>No sleep logs yet</div>:sleepLogs.map(l=>{const c=sc(l.total_mins||0);const dl=new Date(l.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});return<div key={l.id} className="hov-row" style={{display:"grid",gridTemplateColumns:"1fr 60px 60px 64px",padding:"12px 20px",borderBottom:"1px solid #f5f5f5",fontFamily:F2,fontSize:12,transition:"background 0.1s"}}><span style={{fontWeight:500}}>{dl}</span><span style={{color:"#bbb"}}>{l.sleep_start||"—"}</span><span style={{color:"#bbb"}}>{l.wake_up||"—"}</span><span style={{textAlign:"right",fontWeight:700,color:c}}>{l.total_mins?formatHM(l.total_mins):"—"}</span></div>;})}
          </Card>
        </div>
      </div>
    </Wrap>
  );
}

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
  const ls=msg=><div style={{minHeight:"100vh",width:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"#f7f7f5",fontFamily:F2,fontSize:14,color:"#bbb"}}><style>{GLOBAL_CSS}</style>{msg}</div>;
  if(authLoading) return ls("Loading...");
  if(!user) return <><style>{GLOBAL_CSS}</style><AuthPage /></>;
  if(!loaded) return ls("Loading your data...");
  return(
    <div style={{minHeight:"100vh",width:"100%",background:"#f7f7f5"}}>
      <style>{GLOBAL_CSS}</style>
      <Navbar streak={streak} todayMins={todayMins} page={page} setPage={setPage} onLogout={logout} />
      <StatsHero sessions={sessions} />
      <div className="fade" key={page}>
        {page===PAGES.TIMER&&<TimerPage sessions={sessions} setSessions={setSessions} />}
        {page===PAGES.TASKS&&<TasksPage tasks={tasks} setTasks={setTasks} />}
        {page===PAGES.ANALYSIS&&<AnalysisPage sessions={sessions} />}
        {page===PAGES.CALENDAR&&<CalendarPage sessions={sessions} />}
        {page===PAGES.REFLECTION&&<ReflectionPage sessions={sessions} />}
        {page===PAGES.SLEEP&&<SleepPage sleepLogs={sleepLogs} setSleepLogs={setSleepLogs} />}
      </div>
      <div style={{textAlign:"center",padding:"28px 0 48px",fontFamily:F2,fontSize:11,color:"#ddd"}}>Vibe coded by Nithin Chowdary ❤️</div>
    </div>
  );
}