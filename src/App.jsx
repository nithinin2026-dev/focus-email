import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";
import { supabase } from "./supabaseClient";

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const PAGES = { TIMER:"timer", TASKS:"tasks", ANALYSIS:"analysis", CALENDAR:"calendar", REFLECTION:"reflection", SLEEP:"sleep" };
const QUOTES = [
  "Develop the quality of being unstoppable",
  "Don't let your Mind and Body Betray you!"
];

// ─────────────────────────────────────────────────────────────
// DESIGN SYSTEM
// ─────────────────────────────────────────────────────────────
const D = {
  bg: '#08090B',
  surface: 'rgba(255,255,255,0.04)',
  surfaceHover: 'rgba(255,255,255,0.065)',
  surfaceElevated: 'rgba(255,255,255,0.08)',
  border: 'rgba(255,255,255,0.08)',
  borderMid: 'rgba(255,255,255,0.14)',
  accent: '#F59E0B',
  accentHover: '#FBBF24',
  accentDim: 'rgba(245,158,11,0.12)',
  accentGlow: '0 0 24px rgba(245,158,11,0.3)',
  success: '#10B981',
  successDim: 'rgba(16,185,129,0.1)',
  error: '#EF4444',
  errorDim: 'rgba(239,68,68,0.1)',
  warning: '#F97316',
  blue: '#3B82F6',
  purple: '#A78BFA',
  t1: '#F4F4F5',
  t2: '#A1A1AA',
  t3: '#52525B',
  fb: "'Bricolage Grotesque', sans-serif",
  fm: "'Manrope', sans-serif",
  fn: "'JetBrains Mono', monospace",
  r: '12px', rSm: '8px', rLg: '20px', rFull: '9999px',
  shadow: '0 4px 32px rgba(0,0,0,0.5)',
  transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
};

const TAG_COLORS = ["#F59E0B","#3B82F6","#10B981","#A78BFA","#EF4444","#EC4899","#06B6D4","#84CC16","#F97316","#8B5CF6","#14B8A6","#FB923C","#E879F9","#38BDF8","#4ADE80"];

// ─────────────────────────────────────────────────────────────
// GLOBAL CSS INJECTION
// ─────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..60,400;12..60,500;12..60,600;12..60,700;12..60,800&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

*,*::before,*::after{box-sizing:border-box}
html,body{background:#08090B!important;margin:0;color:#F4F4F5;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px}
::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.15)}
::selection{background:rgba(245,158,11,0.25);color:#fff}
input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
input[type=time]::-webkit-calendar-picker-indicator,input[type=date]::-webkit-calendar-picker-indicator{filter:invert(1)opacity(0.45);cursor:pointer}

@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes scaleIn{from{opacity:0;transform:scale(0.97)}to{opacity:1;transform:scale(1)}}
@keyframes ringPulse{0%,100%{filter:drop-shadow(0 0 8px rgba(245,158,11,0.4))}50%{filter:drop-shadow(0 0 26px rgba(245,158,11,0.85))}}
@keyframes breakPulse{0%,100%{filter:drop-shadow(0 0 8px rgba(16,185,129,0.4))}50%{filter:drop-shadow(0 0 26px rgba(16,185,129,0.85))}}
@keyframes streakGlow{0%,100%{box-shadow:0 0 12px rgba(245,158,11,0.2)}50%{box-shadow:0 0 24px rgba(245,158,11,0.5)}}

.fm-input{
  background:rgba(255,255,255,0.05);
  border:1px solid rgba(255,255,255,0.09);
  border-radius:10px;
  color:#F4F4F5;
  font-family:'Manrope',sans-serif;
  font-weight:500;
  outline:none;
  transition:border-color 0.2s ease,background 0.2s ease,box-shadow 0.2s ease;
}
.fm-input:focus{
  border-color:rgba(245,158,11,0.5);
  background:rgba(255,255,255,0.07);
  box-shadow:0 0 0 3px rgba(245,158,11,0.08);
}
.fm-input::placeholder{color:#52525B}

.fm-card{
  background:rgba(255,255,255,0.04);
  border:1px solid rgba(255,255,255,0.08);
  border-radius:12px;
  transition:background 0.2s ease,border-color 0.2s ease;
}
.fm-card:hover{
  background:rgba(255,255,255,0.06);
  border-color:rgba(255,255,255,0.13);
}

.nav-tab{
  transition:color 0.2s ease;
  position:relative;
  border:none;
  cursor:pointer;
  background:transparent;
}
.nav-tab::after{
  content:'';
  position:absolute;
  bottom:-1px;left:12px;right:12px;
  height:2px;
  background:linear-gradient(90deg,#F59E0B,#EF4444);
  border-radius:1px;
  opacity:0;
  transition:opacity 0.25s ease;
}
.nav-tab.active::after{opacity:1}

.task-item{transition:background 0.15s ease;border-radius:8px}
.task-item:hover{background:rgba(255,255,255,0.03)}
.session-item{transition:all 0.15s ease;border-radius:8px;padding:10px 12px;margin:0 -12px}
.session-item:hover{background:rgba(245,158,11,0.05)}
.stat-pill{transition:transform 0.2s ease,box-shadow 0.2s ease}
.stat-pill:hover{transform:translateY(-2px);box-shadow:0 4px 16px rgba(0,0,0,0.4)}
.reflect-row{transition:background 0.15s ease;border-radius:8px;cursor:pointer}
.reflect-row:hover{background:rgba(255,255,255,0.025)}
.planner-row{transition:background 0.15s ease}
.planner-row:hover{background:rgba(255,255,255,0.025)}
.day-cell{transition:all 0.2s ease}
.btn-primary{
  background:#F59E0B;color:#000;border:none;border-radius:9999px;
  font-family:'Manrope',sans-serif;font-weight:700;cursor:pointer;
  transition:background 0.2s ease,box-shadow 0.2s ease,transform 0.1s ease;
}
.btn-primary:hover{background:#FBBF24;box-shadow:0 0 20px rgba(245,158,11,0.3)}
.btn-primary:active{transform:scale(0.98)}
.btn-ghost{
  background:rgba(255,255,255,0.05);
  border:1px solid rgba(255,255,255,0.1);
  border-radius:9999px;
  color:#A1A1AA;
  font-family:'Manrope',sans-serif;font-weight:600;cursor:pointer;
  transition:all 0.2s ease;
}
.btn-ghost:hover{background:rgba(255,255,255,0.08);color:#F4F4F5;border-color:rgba(255,255,255,0.18)}
`;

function useGlobalStyles() {
  useEffect(() => {
    const id = 'fm-global-css';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = GLOBAL_CSS;
    document.head.appendChild(style);
  }, []);
}

// ─────────────────────────────────────────────────────────────
// BELL / SOUND
// ─────────────────────────────────────────────────────────────
let bellReady = false, bellSynth = null;
function initBell() {
  if (bellReady) return;
  bellSynth = new Tone.PolySynth(Tone.Synth, { oscillator:{type:"sine"}, envelope:{attack:0.005,decay:0.8,sustain:0.01,release:1.2}, volume:-6 }).toDestination();
  bellReady = true;
}
function playBell() {
  try { if (!bellReady) initBell(); Tone.start(); const now=Tone.now(); bellSynth.triggerAttackRelease("C6","8n",now); bellSynth.triggerAttackRelease("E6","8n",now+0.15); bellSynth.triggerAttackRelease("G6","8n",now+0.3); bellSynth.triggerAttackRelease("C7","4n",now+0.5); } catch(e){}
}
function playStartPop() { try { Tone.start(); const s=new Tone.Synth({oscillator:{type:"triangle"},envelope:{attack:0.005,decay:0.15,sustain:0,release:0.1},volume:-8}).toDestination(); s.triggerAttackRelease("G5","16n"); setTimeout(()=>s.dispose(),500); } catch(e){} }
function playStopPop() { try { Tone.start(); const s=new Tone.Synth({oscillator:{type:"triangle"},envelope:{attack:0.005,decay:0.2,sustain:0,release:0.15},volume:-8}).toDestination(); s.triggerAttackRelease("D5","16n"); setTimeout(()=>s.dispose(),500); } catch(e){} }

// ─────────────────────────────────────────────────────────────
// SUPABASE HELPERS (unchanged)
// ─────────────────────────────────────────────────────────────
async function loadSessions() {
  const { data, error } = await supabase.from("sessions").select("*").order("ts",{ascending:true});
  if (error) { console.error(error); return []; }
  return data.map(r=>({id:r.id,tag:r.tag,duration:r.duration,date:r.date,ts:Number(r.ts)}));
}
async function insertSession(session) {
  const { data:{user} } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from("sessions").insert({user_id:user.id,...session}).select().single();
  if (error) { console.error(error); return null; }
  return data;
}
async function loadReflections() {
  const { data, error } = await supabase.from("reflections").select("*");
  if (error) { console.error(error); return {}; }
  const map = {}; data.forEach(r=>{map[r.date]={note:r.note||"",hrsOverride:r.hrs_override};}); return map;
}
async function upsertReflection(date,note,hrsOverride) {
  const { data:{user} } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("reflections").upsert({user_id:user.id,date,note,hrs_override:hrsOverride},{onConflict:"user_id,date"});
}
async function loadTasks() {
  const { data, error } = await supabase.from("tasks").select("*").order("created_at",{ascending:true});
  if (error) { console.error(error); return []; }
  return data;
}
async function insertTask(title,date,timeSlot) {
  const { data:{user} } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from("tasks").insert({user_id:user.id,title,date,time_slot:timeSlot||null}).select().single();
  if (error) { console.error(error); return null; }
  return data;
}
async function updateTaskCompleted(taskId,completedDate) { await supabase.from("tasks").update({completed_date:completedDate}).eq("id",taskId); }
async function deleteTask(taskId) { await supabase.from("tasks").delete().eq("id",taskId); }
async function loadSleepLogs() {
  const { data, error } = await supabase.from("sleep_logs").select("*").order("date",{ascending:false});
  if (error) { console.error(error); return []; }
  return data;
}
async function upsertSleepLog(date,sleepStart,wakeUp,totalMins) {
  const { data:{user} } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from("sleep_logs").upsert({user_id:user.id,date,sleep_start:sleepStart,wake_up:wakeUp,total_mins:totalMins},{onConflict:"user_id,date"}).select().single();
  if (error) { console.error(error); return null; }
  return data;
}

// ─────────────────────────────────────────────────────────────
// UTILITIES (unchanged logic, updated colors)
// ─────────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().slice(0,10); }
function formatTime(s) { const m=Math.floor(s/60),sec=s%60; return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`; }
function formatHM(mins) { const h=Math.floor(mins/60),m=mins%60; if(h===0)return `${m}m`; if(m===0)return `${h}h`; return `${h}h ${m}m`; }
function calcStreak(sessions) {
  const dayTotals={}; sessions.forEach(s=>{dayTotals[s.date]=(dayTotals[s.date]||0)+s.duration;});
  let streak=0; const d=new Date(); const todayKey=todayStr();
  if((dayTotals[todayKey]||0)>=120){streak=1;d.setDate(d.getDate()-1);}else{d.setDate(d.getDate()-1);}
  while(true){const key=d.toISOString().slice(0,10);if((dayTotals[key]||0)>=120){streak++;d.setDate(d.getDate()-1);}else break;}
  return streak;
}
function getFireDays(sessions) {
  const dayTotals={}; sessions.forEach(s=>{dayTotals[s.date]=(dayTotals[s.date]||0)+s.duration;});
  const fireDays=new Set(); Object.entries(dayTotals).forEach(([date,mins])=>{if(mins>=120)fireDays.add(date);}); return fireDays;
}
function getDayTotals(sessions) { const t={}; sessions.forEach(s=>{t[s.date]=(t[s.date]||0)+s.duration;}); return t; }
function isPastDate(dateStr) { return dateStr<todayStr(); }
function getTagColor(tag,allTags) { return TAG_COLORS[allTags.indexOf(tag)%TAG_COLORS.length]; }
function getWeekRange(dateStr) {
  const d=new Date(dateStr+"T12:00:00"); const mon=new Date(d); mon.setDate(d.getDate()-((d.getDay()+6)%7));
  const days=[]; for(let i=0;i<7;i++){const dd=new Date(mon);dd.setDate(mon.getDate()+i);days.push(dd.toISOString().slice(0,10));} return days;
}
function getMonthDates(year,month) {
  const n=new Date(year,month+1,0).getDate(); const dates=[];
  for(let d=1;d<=n;d++)dates.push(`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`); return dates;
}

// ─────────────────────────────────────────────────────────────
// COUNTDOWN BANNER
// ─────────────────────────────────────────────────────────────
function CountdownBanner({ sessions }) {
  const [now, setNow] = useState(new Date());
  const [targetDate, setTargetDate] = useState(() => localStorage.getItem("sl_targetDate")||"");
  const [editingTarget, setEditingTarget] = useState(false);
  const [tempTarget, setTempTarget] = useState("");
  useEffect(() => { const t=setInterval(()=>setNow(new Date()),60000); return ()=>clearInterval(t); },[]);

  const todayMins = sessions.filter(s=>s.date===todayStr()).reduce((a,s)=>a+s.duration,0);
  const todayColor = todayMins>=240 ? D.success : todayMins>=120 ? D.accent : D.error;
  const hr = now.getHours();
  const minsLeft = (24-hr-1)*60+(60-now.getMinutes());
  const midColor = hr<12 ? D.success : hr<18 ? D.accent : D.error;

  const saveTarget = () => { localStorage.setItem("sl_targetDate",tempTarget); setTargetDate(tempTarget); setEditingTarget(false); };
  let targetText = "";
  if (targetDate) {
    const diff = Math.ceil((new Date(targetDate+"T00:00:00")-new Date(todayStr()+"T00:00:00"))/86400000);
    if (diff>0) targetText=`${diff}d left`; else if(diff===0) targetText="Today!"; else targetText=`${Math.abs(diff)}d ago`;
  }

  const Chip = ({ icon, value, color, sub }) => (
    <div className="stat-pill" style={{ display:'flex',alignItems:'center',gap:6,background:D.surface,border:`1px solid ${D.border}`,borderRadius:D.rFull,padding:'6px 12px',flexShrink:0 }}>
      <span style={{fontSize:13}}>{icon}</span>
      <span style={{fontFamily:D.fn,fontSize:12,fontWeight:600,color}}>{value}</span>
      {sub && <span style={{fontFamily:D.fm,fontSize:10,color:D.t3,fontWeight:500}}>{sub}</span>}
    </div>
  );

  return (
    <div style={{ display:'flex',gap:8,flexWrap:'wrap',marginBottom:16,alignItems:'center' }}>
      <Chip icon="📖" value={formatHM(todayMins)} color={todayColor} sub="today" />
      <Chip icon="⏳" value={`${Math.floor(minsLeft/60)}h ${minsLeft%60}m`} color={midColor} sub="left" />
      {editingTarget ? (
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <input type="date" value={tempTarget} onChange={e=>setTempTarget(e.target.value)} className="fm-input" style={{width:140,padding:'6px 10px',fontSize:12}} />
          <button onClick={saveTarget} className="btn-primary" style={{padding:'6px 14px',fontSize:11,letterSpacing:'0.03em'}}>Set</button>
          <button onClick={()=>setEditingTarget(false)} className="btn-ghost" style={{padding:'6px 10px',fontSize:11}}>✕</button>
        </div>
      ) : (
        <div className="stat-pill" onDoubleClick={()=>{setTempTarget(targetDate||todayStr());setEditingTarget(true);}} style={{display:'flex',alignItems:'center',gap:6,background:D.surface,border:`1px solid ${D.border}`,borderRadius:D.rFull,padding:'6px 12px',cursor:'pointer'}}>
          <span style={{fontSize:13}}>🎯</span>
          <span style={{fontFamily:D.fn,fontSize:12,fontWeight:600,color:D.purple}}>{targetDate ? targetText : 'Set goal'}</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// QUOTES BANNER
// ─────────────────────────────────────────────────────────────
function QuotesBanner() {
  const [idx, setIdx] = useState(()=>Math.floor(Math.random()*QUOTES.length));
  useEffect(() => { const t=setInterval(()=>setIdx(p=>(p+1)%QUOTES.length),180000); return ()=>clearInterval(t); },[]);
  return (
    <div style={{ padding:'12px 16px',marginBottom:16,background:D.accentDim,border:`1px solid rgba(245,158,11,0.2)`,borderLeft:`3px solid ${D.accent}`,borderRadius:D.r,fontFamily:D.fm,fontSize:12,fontWeight:500,color:D.t2,fontStyle:'italic',lineHeight:1.6,animation:'fadeIn 0.5s ease' }}>
      "{QUOTES[idx]}"
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AUTH PAGE
// ─────────────────────────────────────────────────────────────
function AuthPage({ onAuth }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  useGlobalStyles();

  const handleSubmit = async () => {
    setError("");
    if (!email.trim()||!password.trim()){setError("Email and password required");return;}
    if (password.length<6){setError("Password must be at least 6 characters");return;}
    setLoading(true);
    try {
      if (isLogin){const{error:err}=await supabase.auth.signInWithPassword({email,password});if(err)throw err;}
      else{const{error:err}=await supabase.auth.signUp({email,password});if(err)throw err;setConfirmSent(true);setLoading(false);return;}
    } catch(err){setError(err.message||"Something went wrong");}
    setLoading(false);
  };
  const handleForgotPassword = async () => {
    setError("");
    if (!email.trim()){setError("Enter your email first");return;}
    setLoading(true);
    try{const{error:err}=await supabase.auth.resetPasswordForEmail(email);if(err)throw err;setResetSent(true);}
    catch(err){setError(err.message||"Something went wrong");}
    setLoading(false);
  };

  const bgStyle = { minHeight:'100vh',background:'radial-gradient(ellipse at 20% 40%, rgba(245,158,11,0.07) 0%, transparent 55%), radial-gradient(ellipse at 80% 70%, rgba(239,68,68,0.05) 0%, transparent 50%), #08090B',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 20px' };

  if (resetSent||confirmSent) return (
    <div style={bgStyle}>
      <div style={{background:D.surfaceElevated,border:`1px solid ${D.border}`,borderRadius:D.rLg,padding:'48px 40px',maxWidth:380,width:'100%',textAlign:'center',animation:'scaleIn 0.35s ease',boxShadow:D.shadow}}>
        <div style={{fontSize:52,marginBottom:20}}>{resetSent?'🔑':'✉️'}</div>
        <div style={{fontSize:20,fontFamily:D.fb,fontWeight:700,color:D.t1,marginBottom:8}}>{resetSent?'Reset link sent':'Check your email'}</div>
        <div style={{fontSize:13,fontFamily:D.fm,color:D.t2,lineHeight:1.7,marginBottom:28}}>We sent a link to <span style={{color:D.t1,fontWeight:600}}>{email}</span></div>
        <button onClick={()=>{setResetSent(false);setConfirmSent(false);setIsLogin(true);}} className="btn-primary" style={{width:'100%',padding:'13px',fontSize:13,letterSpacing:'0.04em'}}>Back to Login</button>
      </div>
    </div>
  );

  return (
    <div style={bgStyle}>
      <div style={{animation:'fadeUp 0.5s ease',width:'100%',maxWidth:400}}>
        <div style={{textAlign:'center',marginBottom:36}}>
          <div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:60,height:60,borderRadius:18,marginBottom:16,background:'linear-gradient(135deg,#F59E0B,#EF4444)',fontSize:26,boxShadow:'0 0 32px rgba(245,158,11,0.3)'}}>🔥</div>
          <div style={{fontSize:30,fontFamily:D.fb,fontWeight:800,color:D.t1,letterSpacing:'-0.02em'}}>Focus Maxing</div>
          <div style={{fontSize:11,fontFamily:D.fm,color:D.t3,marginTop:4,letterSpacing:'0.14em',textTransform:'uppercase',fontWeight:600}}>Track your upskilling</div>
        </div>
        <div style={{background:D.surface,border:`1px solid ${D.border}`,borderRadius:D.rLg,padding:'28px',boxShadow:'0 8px 48px rgba(0,0,0,0.5)'}}>
          <div style={{display:'flex',background:'rgba(0,0,0,0.25)',borderRadius:D.r,padding:4,marginBottom:24,gap:4}}>
            {["Login","Sign Up"].map((label,i)=>{
              const active=i===0?isLogin:!isLogin;
              return <button key={label} onClick={()=>{setIsLogin(i===0);setError("");}} style={{flex:1,padding:'9px',border:'none',cursor:'pointer',borderRadius:D.rSm,background:active?D.surfaceElevated:'transparent',color:active?D.t1:D.t3,fontSize:12,fontWeight:600,fontFamily:D.fm,transition:D.transition,boxShadow:active?'0 1px 4px rgba(0,0,0,0.35)':'none'}}>{label}</button>;
            })}
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email" onKeyDown={e=>e.key==="Enter"&&handleSubmit()} className="fm-input" style={{padding:'12px 16px',fontSize:14,width:'100%'}} />
            <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password" onKeyDown={e=>e.key==="Enter"&&handleSubmit()} className="fm-input" style={{padding:'12px 16px',fontSize:14,width:'100%'}} />
          </div>
          {isLogin && <div style={{textAlign:'right',marginTop:8}}><button onClick={handleForgotPassword} style={{background:'none',border:'none',cursor:'pointer',fontSize:11,fontFamily:D.fm,color:D.t3,fontWeight:500}}>Forgot password?</button></div>}
          {error && <div style={{marginTop:12,padding:'10px 14px',background:D.errorDim,border:`1px solid rgba(239,68,68,0.2)`,borderRadius:D.rSm,fontSize:12,fontFamily:D.fm,color:D.error,fontWeight:500}}>{error}</div>}
          <button onClick={handleSubmit} disabled={loading} className="btn-primary" style={{width:'100%',marginTop:18,padding:'13px',fontSize:13,letterSpacing:'0.04em',opacity:loading?0.6:1}}>
            {loading?'···':isLogin?'Sign In':'Create Account'}
          </button>
        </div>
        <div style={{textAlign:'center',marginTop:24,fontSize:11,fontFamily:D.fm,color:D.t3}}>Vibe coded by Nithin Chowdary ❤️</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STREAK BADGE
// ─────────────────────────────────────────────────────────────
function StreakBadge({ streak, todayMins }) {
  const hit = todayMins>=120; const active = hit&&streak>0;
  return (
    <div style={{ position:'fixed',top:14,right:14,zIndex:999,display:'flex',alignItems:'center',gap:6,background:active?'rgba(245,158,11,0.13)':hit?D.surface:D.errorDim,border:`1px solid ${active?'rgba(245,158,11,0.4)':hit?D.border:'rgba(239,68,68,0.3)'}`,backdropFilter:'blur(8px)',color:active?D.accent:hit?D.t2:D.error,padding:'7px 14px',borderRadius:D.rFull,fontFamily:D.fm,fontSize:12,fontWeight:700,animation:active?'streakGlow 2.5s ease-in-out infinite':'none',transition:D.transition }}>
      <span style={{fontSize:15}}>{hit?(streak>0?'🔥':'○'):'⚠️'}</span>
      <span style={{fontFamily:D.fn,fontSize:13}}>{streak}</span>
      <span style={{fontWeight:400,fontSize:10,opacity:0.75}}>{hit?(streak===1?'day':'days'):'do 2h+'}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// NAV
// ─────────────────────────────────────────────────────────────
function Nav({ page, setPage }) {
  const items = [
    {key:PAGES.TIMER,label:"Timer"},{key:PAGES.TASKS,label:"Tasks"},
    {key:PAGES.ANALYSIS,label:"Analysis"},{key:PAGES.CALENDAR,label:"Calendar"},
    {key:PAGES.REFLECTION,label:"Reflect"},{key:PAGES.SLEEP,label:"Sleep"},
  ];
  return (
    <nav style={{display:'flex',borderBottom:`1px solid ${D.border}`,marginBottom:28,overflowX:'auto',scrollbarWidth:'none',msOverflowStyle:'none'}}>
      {items.map(i=>(
        <button key={i.key} onClick={()=>setPage(i.key)} className={`nav-tab${page===i.key?' active':''}`} style={{flex:'1 0 auto',padding:'11px 12px',color:page===i.key?D.t1:D.t3,fontSize:11,fontWeight:600,letterSpacing:'0.05em',textTransform:'uppercase',fontFamily:D.fm,whiteSpace:'nowrap'}}>
          {i.label}
        </button>
      ))}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────
// TOP BAR
// ─────────────────────────────────────────────────────────────
function TopBar({ sessions }) {
  const dayTotals = getDayTotals(sessions);
  const maxMins = Object.values(dayTotals).length>0 ? Math.max(...Object.values(dayTotals)) : 0;
  const now = new Date(); const yearStr = String(now.getFullYear());
  const monthName = now.toLocaleDateString("en-US",{month:"short"});
  const yearMins = sessions.filter(s=>s.date.startsWith(yearStr)).reduce((a,s)=>a+s.duration,0);
  const monthPrefix = `${yearStr}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const monthMins = sessions.filter(s=>s.date.startsWith(monthPrefix)).reduce((a,s)=>a+s.duration,0);
  const today = new Date(); const todayKey = todayStr();
  const dayOfWeek = today.getDay();
  const mon = new Date(today); mon.setDate(today.getDate()-((dayOfWeek+6)%7));
  const weekDays = []; for(let i=0;i<7;i++){const dd=new Date(mon);dd.setDate(mon.getDate()+i);weekDays.push(dd.toISOString().slice(0,10));}
  const dayLabels = ["M","T","W","Th","F","Sa","Su"];
  const weekTotal = weekDays.reduce((a,d)=>a+(dayTotals[d]||0),0);

  return (
    <div style={{marginBottom:20}}>
      <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:4,marginBottom:12,scrollbarWidth:'none'}}>
        {[['⚡',formatHM(maxMins),'peak'],['📊',formatHM(monthMins),monthName],['📅',formatHM(yearMins),yearStr],['🗓',formatHM(weekTotal),'week']].map(([icon,val,label])=>(
          <div key={label} className="stat-pill" style={{display:'flex',alignItems:'center',gap:6,background:D.surface,border:`1px solid ${D.border}`,borderRadius:D.rFull,padding:'6px 12px',flexShrink:0}}>
            <span style={{fontSize:13}}>{icon}</span>
            <span style={{fontFamily:D.fn,fontSize:12,fontWeight:600,color:D.t1}}>{val}</span>
            <span style={{fontFamily:D.fm,fontSize:10,color:D.t3,fontWeight:500}}>{label}</span>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:4}}>
        {weekDays.map((dateKey,i)=>{
          const mins = dayTotals[dateKey]||0;
          const isFire = mins>=120; const isToday = dateKey===todayKey;
          const isMissed = isPastDate(dateKey)&&!isFire;
          return (
            <div key={dateKey} className="day-cell" style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
              <span style={{fontSize:9,fontFamily:D.fm,fontWeight:700,color:isToday?D.t1:D.t3,letterSpacing:'0.06em',textTransform:'uppercase'}}>{dayLabels[i]}</span>
              <div style={{width:'100%',aspectRatio:'1',borderRadius:D.rSm,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:isFire?D.accentDim:isMissed?D.errorDim:isToday?D.surface:'transparent',border:`1px solid ${isFire?'rgba(245,158,11,0.3)':isMissed?'rgba(239,68,68,0.2)':isToday?D.borderMid:D.border}`,boxShadow:isFire?'0 0 10px rgba(245,158,11,0.12)':'none'}}>
                <span style={{fontSize:isFire?15:11,lineHeight:1}}>{isFire?'🔥':isMissed?'✗':mins>0?'✓':'·'}</span>
                {!isFire&&mins>0&&<span style={{fontSize:7,fontFamily:D.fn,color:D.t3,marginTop:1,lineHeight:1}}>{formatHM(mins)}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TIMER PAGE
// ─────────────────────────────────────────────────────────────
function TimerPage({ sessions, setSessions }) {
  const [tag, setTag] = useState(()=>sessionStorage.getItem("sl_tag")||"");
  const [running, setRunning] = useState(()=>sessionStorage.getItem("sl_running")==="true");
  const [elapsed, setElapsed] = useState(()=>{
    const startTs=sessionStorage.getItem("sl_startTs"); const wasRunning=sessionStorage.getItem("sl_running")==="true";
    if(wasRunning&&startTs)return Math.floor((Date.now()-Number(startTs))/1000);
    const saved=sessionStorage.getItem("sl_elapsed"); return saved?Number(saved):0;
  });
  const [mode, setMode] = useState(()=>sessionStorage.getItem("sl_mode")||"focus");
  const [focusMins, setFocusMins] = useState(()=>Number(sessionStorage.getItem("sl_focusMins"))||60);
  const [breakMins, setBreakMins] = useState(()=>Number(sessionStorage.getItem("sl_breakMins"))||5);
  const [editing, setEditing] = useState(false);
  const [tempFocus, setTempFocus] = useState("25"); const [tempBreak, setTempBreak] = useState("5");
  const focusDur=focusMins*60; const breakDur=breakMins*60;
  const intervalRef=useRef(null); const startTimeRef=useRef(null);
  const [manualTag, setManualTag] = useState(""); const [manualMins, setManualMins] = useState("");

  useEffect(()=>{sessionStorage.setItem("sl_tag",tag);},[tag]);
  useEffect(()=>{sessionStorage.setItem("sl_mode",mode);},[mode]);
  useEffect(()=>{sessionStorage.setItem("sl_focusMins",String(focusMins));},[focusMins]);
  useEffect(()=>{sessionStorage.setItem("sl_breakMins",String(breakMins));},[breakMins]);
  useEffect(()=>{
    sessionStorage.setItem("sl_running",String(running));
    if(running){sessionStorage.setItem("sl_startTs",String(Date.now()-elapsed*1000));}
    else{sessionStorage.setItem("sl_elapsed",String(elapsed));sessionStorage.removeItem("sl_startTs");}
  },[running]);

  const openEdit = ()=>{setTempFocus(String(focusMins));setTempBreak(String(breakMins));setEditing(true);};
  const saveEdit = ()=>{const f=parseInt(tempFocus),b=parseInt(tempBreak);if(f>0)setFocusMins(f);if(b>0)setBreakMins(b);setElapsed(0);setRunning(false);setEditing(false);};
  const remaining = mode==="focus"?Math.max(focusDur-elapsed,0):Math.max(breakDur-elapsed,0);
  const total = mode==="focus"?focusDur:breakDur;
  const progress = 1-remaining/total;

  useEffect(()=>{
    if(running){startTimeRef.current=Date.now()-elapsed*1000;intervalRef.current=setInterval(()=>{setElapsed(Math.floor((Date.now()-startTimeRef.current)/1000));},200);}
    else{clearInterval(intervalRef.current);}
    return()=>clearInterval(intervalRef.current);
  },[running]);

  useEffect(()=>{
    const h=()=>{if(document.visibilityState==="visible"){const startTs=sessionStorage.getItem("sl_startTs"),wasRunning=sessionStorage.getItem("sl_running")==="true";if(wasRunning&&startTs){setElapsed(Math.floor((Date.now()-Number(startTs))/1000));startTimeRef.current=Number(startTs);}}};
    document.addEventListener("visibilitychange",h); return()=>document.removeEventListener("visibilitychange",h);
  },[]);

  const addSession = useCallback(async(newSession)=>{
    setSessions(prev=>[...prev,newSession]);
    const saved=await insertSession(newSession);
    if(saved){setSessions(prev=>prev.map(s=>s.ts===newSession.ts&&s.tag===newSession.tag?{id:saved.id,tag:saved.tag,duration:saved.duration,date:saved.date,ts:Number(saved.ts)}:s));}
  },[setSessions]);

  useEffect(()=>{
    if(remaining<=0&&running){
      setRunning(false);playBell();
      if(mode==="focus"){const mins=Math.round(focusDur/60);addSession({id:Date.now(),tag:tag||"Untitled",duration:mins,date:todayStr(),ts:Date.now()});setMode("break");setElapsed(0);}
      else{setMode("focus");setElapsed(0);}
    }
  },[remaining,running]);

  const toggle = ()=>{if(!running){initBell();playStartPop();}else{playStopPop();}setRunning(!running);};
  const reset = ()=>{setRunning(false);setElapsed(0);};
  const skip = ()=>{
    setRunning(false);
    if(mode==="focus"){const mins=Math.max(1,Math.round(elapsed/60));if(elapsed>30)addSession({id:Date.now(),tag:tag||"Untitled",duration:mins,date:todayStr(),ts:Date.now()});setMode("break");}
    else{setMode("focus");}
    setElapsed(0);
  };
  const logManual = ()=>{const mins=parseInt(manualMins);if(!manualTag.trim()||isNaN(mins)||mins<=0)return;addSession({id:Date.now(),tag:manualTag.trim(),duration:mins,date:todayStr(),ts:Date.now()});setManualTag("");setManualMins("");};

  const todaySessions = sessions.filter(s=>s.date===todayStr());
  const todayTotal = todaySessions.reduce((a,s)=>a+s.duration,0);
  const allTags = [...new Set(sessions.map(s=>s.tag))];
  const circleR=96; const circleC=2*Math.PI*circleR;
  const isFocus = mode==="focus";
  const accentColor = isFocus ? D.accent : D.success;
  const accentDimColor = isFocus ? D.accentDim : D.successDim;

  return (
    <div style={{animation:'fadeUp 0.35s ease'}}>
      {/* Tag input */}
      <div style={{marginBottom:20}}>
        <input value={tag} onChange={e=>setTag(e.target.value)} placeholder="What are you studying?" className="fm-input" style={{width:'100%',padding:'14px 18px',fontSize:15,textAlign:'center',fontWeight:600}} />
      </div>

      {/* Duration editor */}
      {editing ? (
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginBottom:18,fontFamily:D.fm,flexWrap:'wrap'}}>
          <label style={{fontSize:12,color:D.t2,fontWeight:500}}>Focus</label>
          <input value={tempFocus} onChange={e=>setTempFocus(e.target.value)} type="number" className="fm-input" style={{width:64,padding:'8px 10px',fontSize:14,textAlign:'center'}} />
          <label style={{fontSize:12,color:D.t2,fontWeight:500}}>Break</label>
          <input value={tempBreak} onChange={e=>setTempBreak(e.target.value)} type="number" className="fm-input" style={{width:64,padding:'8px 10px',fontSize:14,textAlign:'center'}} />
          <span style={{fontSize:11,color:D.t3}}>min</span>
          <button onClick={saveEdit} className="btn-primary" style={{padding:'8px 18px',fontSize:12,letterSpacing:'0.03em'}}>Set</button>
          <button onClick={()=>setEditing(false)} className="btn-ghost" style={{padding:'8px 12px',fontSize:12}}>✕</button>
        </div>
      ) : (
        <div style={{textAlign:'center',marginBottom:18}}>
          <button onClick={openEdit} style={{background:'none',border:'none',cursor:'pointer',fontFamily:D.fm,fontSize:12,color:D.t3,fontWeight:500,textDecoration:'underline',textUnderlineOffset:3}}>
            ⚙ {focusMins}m focus / {breakMins}m break
          </button>
        </div>
      )}

      {/* Timer ring */}
      <div style={{display:'flex',justifyContent:'center',marginBottom:24}}>
        <div style={{position:'relative',width:240,height:240}}>
          <svg width={240} height={240} style={{transform:'rotate(-90deg)',animation:running?(isFocus?'ringPulse 2s ease-in-out infinite':'breakPulse 2s ease-in-out infinite'):'none'}}>
            <defs>
              <linearGradient id="focusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F59E0B"/>
                <stop offset="100%" stopColor="#EF4444"/>
              </linearGradient>
              <linearGradient id="breakGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10B981"/>
                <stop offset="100%" stopColor="#06B6D4"/>
              </linearGradient>
            </defs>
            <circle cx={120} cy={120} r={circleR} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8}/>
            <circle cx={120} cy={120} r={circleR} fill="none" stroke={`url(#${isFocus?'focusGrad':'breakGrad'})`} strokeWidth={8} strokeLinecap="round" strokeDasharray={circleC} strokeDashoffset={circleC*(1-progress)} style={{transition:'stroke-dashoffset 0.3s ease'}}/>
          </svg>
          <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
            <div style={{fontSize:10,fontFamily:D.fm,textTransform:'uppercase',letterSpacing:'0.2em',color:accentColor,marginBottom:6,fontWeight:700,padding:'3px 10px',borderRadius:D.rFull,background:accentDimColor}}>{isFocus?'Focus':'Break'}</div>
            <div style={{fontSize:46,fontFamily:D.fn,fontWeight:700,color:D.t1,letterSpacing:'-0.02em',lineHeight:1}}>{formatTime(remaining)}</div>
            <div style={{fontSize:10,fontFamily:D.fm,color:D.t3,marginTop:6,fontWeight:500}}>{Math.round(progress*100)}% complete</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{display:'flex',justifyContent:'center',gap:10,marginBottom:32}}>
        <button onClick={toggle} className={running?'btn-ghost':'btn-primary'} style={{padding:'12px 36px',fontSize:13,letterSpacing:'0.04em',boxShadow:!running?D.accentGlow:'none'}}>
          {running?'Pause':'Start'}
        </button>
        <button onClick={reset} className="btn-ghost" style={{padding:'12px 22px',fontSize:13}}>Reset</button>
        <button onClick={skip} className="btn-ghost" style={{padding:'12px 22px',fontSize:13}}>Skip</button>
      </div>

      <div style={{height:1,background:D.border,marginBottom:24}}/>

      {/* Quick log */}
      <div className="fm-card" style={{padding:'16px',marginBottom:24}}>
        <div style={{fontSize:10,fontFamily:D.fm,textTransform:'uppercase',letterSpacing:'0.14em',color:D.t3,marginBottom:12,fontWeight:700}}>Quick Log</div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <input value={manualTag} onChange={e=>setManualTag(e.target.value)} placeholder="Topic" className="fm-input" style={{flex:1,minWidth:120,padding:'10px 14px',fontSize:13}} />
          <input value={manualMins} onChange={e=>setManualMins(e.target.value)} placeholder="mins" type="number" className="fm-input" style={{width:80,padding:'10px 12px',fontSize:13,textAlign:'center'}} />
          <button onClick={logManual} className="btn-primary" style={{padding:'10px 22px',fontSize:13,borderRadius:D.r}}>+</button>
        </div>
      </div>

      {/* Today sessions */}
      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:14}}>
          <span style={{fontSize:10,fontFamily:D.fm,textTransform:'uppercase',letterSpacing:'0.14em',color:D.t3,fontWeight:700}}>Today's Sessions</span>
          <span style={{fontFamily:D.fn,fontSize:14,fontWeight:700,color:todayTotal>=120?D.accent:D.t1}}>{formatHM(todayTotal)} {todayTotal>=120&&'🔥'}</span>
        </div>
        {todaySessions.length===0 ? (
          <div style={{textAlign:'center',padding:'32px 0',color:D.t3,fontFamily:D.fm,fontSize:13}}>No sessions yet — start studying! 🚀</div>
        ) : todaySessions.map(s=>(
          <div key={s.id} className="session-item" style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:`1px solid ${D.border}`}}>
            <span style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{width:7,height:7,borderRadius:2,background:getTagColor(s.tag,allTags),display:'inline-block',flexShrink:0}}/>
              <span style={{fontFamily:D.fm,fontWeight:600,color:D.t1,fontSize:14}}>{s.tag}</span>
            </span>
            <span style={{fontFamily:D.fn,color:D.t2,fontSize:12,fontWeight:500}}>{formatHM(s.duration)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TASKS PAGE
// ─────────────────────────────────────────────────────────────
function TasksPage({ tasks, setTasks }) {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [newTask, setNewTask] = useState("");
  const isToday = selectedDate===todayStr();

  const shiftDate = (dir)=>{const d=new Date(selectedDate+"T12:00:00");d.setDate(d.getDate()+dir);setSelectedDate(d.toISOString().slice(0,10));};
  const dateLabel = isToday?"Today":new Date(selectedDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
  const dayTasks = tasks.filter(t=>t.date===selectedDate&&!t.time_slot);
  const dayPlannerTasks = tasks.filter(t=>t.date===selectedDate&&t.time_slot);

  const addTask = async()=>{if(!newTask.trim())return;const saved=await insertTask(newTask.trim(),selectedDate,null);if(saved)setTasks(prev=>[...prev,saved]);setNewTask("");};
  const toggleComplete = async(task)=>{const v=task.completed_date?null:todayStr();await updateTaskCompleted(task.id,v);setTasks(prev=>prev.map(t=>t.id===task.id?{...t,completed_date:v}:t));};
  const removeTask = async(taskId)=>{await deleteTask(taskId);setTasks(prev=>prev.filter(t=>t.id!==taskId));};

  const slots = []; for(let h=4;h<=23;h++){const fmt=(hr)=>{if(hr===0)return"12 AM";if(hr<12)return`${hr} AM`;if(hr===12)return"12 PM";return`${hr-12} PM`;};slots.push({label:`${fmt(h)} – ${fmt(h+1>23?0:h+1)}`,key:`${h}-${h+1}`});}
  const addPlannerTask = async(slotKey,title)=>{if(!title.trim())return;if(dayPlannerTasks.find(t=>t.time_slot===slotKey))return;const saved=await insertTask(title.trim(),selectedDate,slotKey);if(saved)setTasks(prev=>[...prev,saved]);};

  const completedCount = dayTasks.filter(t=>t.completed_date).length;

  return (
    <div style={{animation:'fadeUp 0.35s ease'}}>
      {/* Date nav */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:24,marginBottom:20}}>
        <button onClick={()=>shiftDate(-1)} style={{background:'none',border:'none',fontSize:18,cursor:'pointer',color:D.t2,fontFamily:D.fm,fontWeight:600,padding:'4px 8px',borderRadius:D.rSm,transition:D.transition}}>←</button>
        <span style={{fontSize:15,fontWeight:700,fontFamily:D.fb,minWidth:150,textAlign:'center',color:D.t1}}>{dateLabel}</span>
        <button onClick={()=>shiftDate(1)} style={{background:'none',border:'none',fontSize:18,cursor:'pointer',color:D.t2,fontFamily:D.fm,fontWeight:600,padding:'4px 8px',borderRadius:D.rSm,transition:D.transition}}>→</button>
      </div>

      {/* Add task */}
      <div style={{display:'flex',gap:8,marginBottom:20}}>
        <input value={newTask} onChange={e=>setNewTask(e.target.value)} placeholder="Add a task..." onKeyDown={e=>e.key==="Enter"&&addTask()} className="fm-input" style={{flex:1,padding:'12px 16px',fontSize:14}} />
        <button onClick={addTask} className="btn-primary" style={{padding:'12px 22px',fontSize:14,borderRadius:D.r}}>+</button>
      </div>

      {/* Task progress */}
      {dayTasks.length>0 && (
        <div style={{marginBottom:12,display:'flex',alignItems:'center',gap:12}}>
          <div style={{flex:1,height:4,background:D.surface,borderRadius:D.rFull,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${dayTasks.length>0?Math.round(completedCount/dayTasks.length*100):0}%`,background:`linear-gradient(90deg, ${D.accent}, ${D.success})`,borderRadius:D.rFull,transition:'width 0.4s ease'}}/>
          </div>
          <span style={{fontSize:11,fontFamily:D.fn,color:D.t3,fontWeight:600,flexShrink:0}}>{completedCount}/{dayTasks.length}</span>
        </div>
      )}

      {/* Task list */}
      <div style={{fontSize:10,fontFamily:D.fm,textTransform:'uppercase',letterSpacing:'0.14em',color:D.t3,marginBottom:10,fontWeight:700}}>Tasks</div>
      {dayTasks.length===0&&<div style={{color:D.t3,fontFamily:D.fm,fontSize:13,padding:'20px 0',textAlign:'center'}}>No tasks for this day</div>}
      {dayTasks.map(t=>{
        const done=!!t.completed_date;
        return (
          <div key={t.id} className="task-item" style={{display:'flex',alignItems:'center',gap:12,padding:'10px 8px',borderBottom:`1px solid ${D.border}`}}>
            <button onClick={()=>toggleComplete(t)} style={{width:22,height:22,border:done?'none':`1px solid ${D.border}`,background:done?D.success:'transparent',borderRadius:6,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#000',fontSize:13,flexShrink:0,transition:D.transition}}>{done&&'✓'}</button>
            <span style={{flex:1,fontFamily:D.fm,fontWeight:600,textDecoration:done?'line-through':'none',color:done?D.t3:D.t1,fontSize:14}}>{t.title}</span>
            <button onClick={()=>removeTask(t.id)} style={{border:'none',background:'none',cursor:'pointer',color:D.t3,fontSize:16,padding:'0 4px',transition:D.transition,lineHeight:1}}>✕</button>
          </div>
        );
      })}

      {/* Day planner */}
      <div style={{marginTop:32}}>
        <div style={{fontSize:10,fontFamily:D.fm,textTransform:'uppercase',letterSpacing:'0.14em',color:D.t3,marginBottom:12,fontWeight:700}}>Day Planner</div>
        <div className="fm-card" style={{overflow:'hidden',padding:0}}>
          {slots.map((slot,si)=>{
            const slotTask=dayPlannerTasks.find(t=>t.time_slot===slot.key);
            const done=slotTask&&!!slotTask.completed_date;
            return (
              <div key={slot.key} className="planner-row" style={{display:'flex',borderBottom:si<slots.length-1?`1px solid ${D.border}`:'none',minHeight:44}}>
                <div style={{width:110,padding:'10px 12px',background:'rgba(0,0,0,0.2)',fontFamily:D.fn,fontWeight:500,color:D.t3,flexShrink:0,display:'flex',alignItems:'center',fontSize:11,letterSpacing:'0.02em',borderRight:`1px solid ${D.border}`}}>{slot.label}</div>
                <div style={{flex:1,padding:'8px 12px',display:'flex',alignItems:'center',gap:10}}>
                  {slotTask ? (
                    <>
                      <button onClick={()=>toggleComplete(slotTask)} style={{width:20,height:20,border:done?'none':`1px solid ${D.border}`,background:done?D.success:'transparent',borderRadius:5,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#000',fontSize:11,flexShrink:0,transition:D.transition}}>{done&&'✓'}</button>
                      <span style={{flex:1,fontSize:13,fontFamily:D.fm,fontWeight:600,textDecoration:done?'line-through':'none',color:done?D.t3:D.t1}}>{slotTask.title}</span>
                      <button onClick={()=>removeTask(slotTask.id)} style={{border:'none',background:'none',cursor:'pointer',color:D.t3,fontSize:14}}>✕</button>
                    </>
                  ) : (
                    <PlannerSlotInput slotKey={slot.key} onAdd={(title)=>addPlannerTask(slot.key,title)}/>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PlannerSlotInput({ slotKey, onAdd }) {
  const [val, setVal] = useState("");
  const submit = ()=>{if(val.trim()){onAdd(val.trim());setVal("");}};
  return <input value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="+ add task" style={{border:'none',background:'transparent',fontSize:13,fontFamily:D.fm,fontWeight:500,outline:'none',color:D.t3,padding:'4px 0',width:'100%'}}/>;
}

// ─────────────────────────────────────────────────────────────
// SHARED CHART COMPONENTS
// ─────────────────────────────────────────────────────────────
function SectionLabel({ children, style={} }) {
  return <div style={{fontSize:10,fontFamily:D.fm,textTransform:'uppercase',letterSpacing:'0.14em',color:D.t3,marginBottom:14,fontWeight:700,marginTop:36,...style}}>{children}</div>;
}

function TagBarChart({ sorted, allTags }) {
  if (!sorted.length) return null;
  const maxVal=sorted[0][1]; const barH=140;
  return (
    <div style={{overflowX:'auto',paddingBottom:8}}>
      <div style={{display:'flex',alignItems:'flex-end',gap:6,minWidth:sorted.length*64,height:barH+40,paddingTop:20}}>
        {sorted.map(([tag,mins])=>{
          const h=maxVal>0?(mins/maxVal)*barH:0; const color=getTagColor(tag,allTags);
          return (
            <div key={tag} style={{flex:1,minWidth:48,maxWidth:80,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',height:barH+40}}>
              <span style={{fontSize:10,fontFamily:D.fn,fontWeight:600,marginBottom:4,color}}>{formatHM(mins)}</span>
              <div style={{width:'100%',height:h,background:`linear-gradient(180deg,${color},${color}66)`,borderRadius:'4px 4px 0 0',transition:'height 0.4s ease',minHeight:mins>0?6:0}}/>
              <span style={{fontSize:10,fontFamily:D.fm,marginTop:6,textAlign:'center',color:D.t3,maxWidth:80,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',width:'100%',fontWeight:500}}>{tag}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PeriodBarChart({ dates, sessions }) {
  const dayTotals=getDayTotals(sessions);
  const data=dates.map(d=>({date:d,mins:dayTotals[d]||0}));
  const maxVal=Math.max(...data.map(d=>d.mins),1);
  const peakVal=Math.max(...data.map(d=>d.mins));
  const barH=130;
  const totalMins=data.reduce((a,d)=>a+d.mins,0);
  const activeDays=data.filter(d=>d.mins>0).length;
  const avgMins=activeDays>0?Math.round(totalMins/activeDays):0;
  const isWeekly=dates.length<=7;

  const getBarColor=(mins)=>{
    if(mins<120)return `linear-gradient(180deg,${D.error},${D.error}88)`;
    const hrs=mins/60; const t=Math.min((hrs-2)/4,1);
    const r=Math.round(42-t*30); const g=Math.round(157+t*40); const b=Math.round(143-t*80);
    const c=`rgb(${r},${g},${b})`; return `linear-gradient(180deg,${c},${c}77)`;
  };

  return (
    <div>
      <div style={{display:'flex',gap:20,marginBottom:16}}>
        {[["Total",totalMins],["Peak",peakVal],["Avg/day",avgMins]].map(([label,val])=>(
          <div key={label} className="fm-card" style={{padding:'12px 16px',flex:1}}>
            <div style={{fontSize:20,fontFamily:D.fn,fontWeight:700,color:D.t1}}>{formatHM(val)}</div>
            <div style={{fontSize:9,color:D.t3,textTransform:'uppercase',letterSpacing:'0.12em',fontFamily:D.fm,fontWeight:600,marginTop:3}}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{position:'relative',overflowX:'auto',paddingBottom:8}}>
        <div style={{display:'flex',alignItems:'flex-end',gap:isWeekly?8:3,minWidth:isWeekly?dates.length*52:dates.length*18,height:barH+50,paddingTop:28,position:'relative'}}>
          {peakVal>0&&(
            <div style={{position:'absolute',top:28,left:0,right:0,height:barH,pointerEvents:'none'}}>
              <div style={{position:'absolute',bottom:`${(peakVal/maxVal)*barH}px`,left:0,right:0,borderTop:`1px dashed ${D.error}`,opacity:0.4}}/>
              <span style={{position:'absolute',bottom:`${(peakVal/maxVal)*barH+4}px`,right:0,fontSize:9,color:D.error,fontFamily:D.fn,fontWeight:600,opacity:0.7}}>PEAK {formatHM(peakVal)}</span>
            </div>
          )}
          {data.map((d)=>{
            const h=maxVal>0?(d.mins/maxVal)*barH:0;
            const isPeak=d.mins===peakVal&&d.mins>0;
            const dayLabel=isWeekly?new Date(d.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short"}):String(new Date(d.date+"T12:00:00").getDate());
            return (
              <div key={d.date} style={{flex:1,minWidth:isWeekly?40:12,maxWidth:isWeekly?60:28,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',height:barH+50}}>
                {isWeekly&&d.mins>0&&<span style={{fontSize:10,fontFamily:D.fn,fontWeight:600,marginBottom:3,color:isPeak?D.error:D.t3}}>{formatHM(d.mins)}</span>}
                <div style={{width:'100%',height:h,background:isPeak?`linear-gradient(180deg,${D.error},${D.error}88)`:getBarColor(d.mins),borderRadius:'4px 4px 0 0',transition:'height 0.4s ease',minHeight:d.mins>0?4:2,position:'relative'}}>
                  {isPeak&&<div style={{position:'absolute',top:-16,left:'50%',transform:'translateX(-50%)',fontSize:12}}>⭐</div>}
                </div>
                <span style={{fontSize:isWeekly?10:8,fontFamily:D.fn,marginTop:4,color:isPeak?D.error:D.t3,fontWeight:isPeak?700:400}}>{dayLabel}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{display:'flex',gap:14,marginTop:10,fontFamily:D.fm,fontSize:10,color:D.t3,flexWrap:'wrap'}}>
        <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:8,height:8,background:D.error,borderRadius:2,display:'inline-block'}}/> &lt;2h</span>
        <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:8,height:8,background:D.success,borderRadius:2,display:'inline-block'}}/> 2h+</span>
        <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:8,height:8,background:'#0B6E4F',borderRadius:2,display:'inline-block'}}/> 4h+</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EXCEL EXPORT (unchanged)
// ─────────────────────────────────────────────────────────────
async function exportToExcel(sessions) {
  const XLSX = await import("xlsx");
  const dayMap = {};
  sessions.forEach(s=>{dayMap[s.date]=(dayMap[s.date]||0)+s.duration;});
  const dailyData=Object.entries(dayMap).sort((a,b)=>a[0].localeCompare(b[0])).map(([date,mins])=>({Date:date,Day:new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long"}),"Hours":+(mins/60).toFixed(2),"Status":mins>=120?"🔥":"❌"}));
  const weekMap={}; Object.entries(dayMap).forEach(([date,mins])=>{const d=new Date(date+"T12:00:00");const mon=new Date(d);mon.setDate(d.getDate()-((d.getDay()+6)%7));const sun=new Date(mon);sun.setDate(mon.getDate()+6);const label=`${mon.toLocaleDateString("en-US",{month:"short",day:"numeric"})} - ${sun.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;weekMap[label]=(weekMap[label]||0)+mins;});
  const weeklyData=Object.entries(weekMap).map(([week,mins])=>({Week:week,"Hours":+(mins/60).toFixed(2)}));
  const monthMap={}; Object.entries(dayMap).forEach(([date,mins])=>{const key=date.slice(0,7);monthMap[key]=(monthMap[key]||0)+mins;});
  const monthlyData=Object.entries(monthMap).sort((a,b)=>a[0].localeCompare(b[0])).map(([key,mins])=>{const[y,m]=key.split("-");return{Month:new Date(parseInt(y),parseInt(m)-1).toLocaleDateString("en-US",{month:"long",year:"numeric"}),"Hours":+(mins/60).toFixed(2)};});
  const tagMap={},tagFirstDate={}; sessions.forEach(s=>{tagMap[s.tag]=(tagMap[s.tag]||0)+s.duration;if(!tagFirstDate[s.tag]||s.date<tagFirstDate[s.tag])tagFirstDate[s.tag]=s.date;});
  const topicData=Object.entries(tagMap).sort((a,b)=>b[1]-a[1]).map(([tag,mins])=>({Topic:tag,"Hours":+(mins/60).toFixed(2),"Started":tagFirstDate[tag]||""}));
  const wb=XLSX.utils.book_new();
  const ws1=XLSX.utils.json_to_sheet(dailyData);ws1["!cols"]=[{wch:12},{wch:12},{wch:8},{wch:6}];
  const ws2=XLSX.utils.json_to_sheet(weeklyData);ws2["!cols"]=[{wch:30},{wch:10}];
  const ws3=XLSX.utils.json_to_sheet(monthlyData);ws3["!cols"]=[{wch:20},{wch:10}];
  const ws4=XLSX.utils.json_to_sheet(topicData);ws4["!cols"]=[{wch:20},{wch:10},{wch:12}];
  XLSX.utils.book_append_sheet(wb,ws1,"Day-wise"); XLSX.utils.book_append_sheet(wb,ws2,"Week-wise"); XLSX.utils.book_append_sheet(wb,ws3,"Month-wise"); XLSX.utils.book_append_sheet(wb,ws4,"Topic-wise");
  XLSX.writeFile(wb,`FocusMaxing_Export_${todayStr()}.xlsx`);
}

// ─────────────────────────────────────────────────────────────
// ANALYSIS PAGE
// ─────────────────────────────────────────────────────────────
function AnalysisPage({ sessions }) {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [showReports, setShowReports] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const reportsRef=useRef(null); const advancedRef=useRef(null);
  const [viewMonth, setViewMonth] = useState(()=>{const d=new Date();return{year:d.getFullYear(),month:d.getMonth()};});
  const daySessions=sessions.filter(s=>s.date===selectedDate);
  const tagTotals={}; daySessions.forEach(s=>{tagTotals[s.tag]=(tagTotals[s.tag]||0)+s.duration;});
  const totalMins=daySessions.reduce((a,s)=>a+s.duration,0);
  const sorted=Object.entries(tagTotals).sort((a,b)=>b[1]-a[1]);
  const allTags=[...new Set(sessions.map(s=>s.tag))];
  const shiftDate=(dir)=>{const d=new Date(selectedDate+"T12:00:00");d.setDate(d.getDate()+dir);setSelectedDate(d.toISOString().slice(0,10));};
  const isToday=selectedDate===todayStr();
  const dateLabel=isToday?"Today":new Date(selectedDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
  const weekDates=getWeekRange(selectedDate);
  const weekLabel=`${new Date(weekDates[0]+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${new Date(weekDates[6]+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}`;
  const monthDates=getMonthDates(viewMonth.year,viewMonth.month);
  const monthLabel=new Date(viewMonth.year,viewMonth.month).toLocaleDateString("en-US",{month:"long",year:"numeric"});
  const shiftMonth=(dir)=>{setViewMonth(prev=>{let m=prev.month+dir,y=prev.year;if(m<0){m=11;y--;}if(m>11){m=0;y++;}return{year:y,month:m};});};
  const dayTotalsAll=getDayTotals(sessions);
  const tagDayTotals={}; sessions.forEach(s=>{if(!tagDayTotals[s.tag])tagDayTotals[s.tag]={};tagDayTotals[s.tag][s.date]=(tagDayTotals[s.tag][s.date]||0)+s.duration;});
  const personalBests=Object.entries(tagDayTotals).map(([tag,days])=>{const best=Object.entries(days).sort((a,b)=>b[1]-a[1])[0];return{tag,mins:best?best[1]:0,date:best?best[0]:""};}).sort((a,b)=>b.mins-a.mins);
  const buckets=[{label:"0–30m",min:0,max:30},{label:"30m–1h",min:30,max:60},{label:"1–2h",min:60,max:120},{label:"2–3h",min:120,max:180},{label:"3–4h",min:180,max:240},{label:"4h+",min:240,max:99999}];
  const bucketCounts=buckets.map(b=>({...b,count:Object.values(dayTotalsAll).filter(m=>m>=b.min&&m<b.max).length}));
  const maxBucket=Math.max(...bucketCounts.map(b=>b.count),1);
  const distColors=[D.error,D.error,D.warning,D.success,D.success,D.blue];
  const dowDaySets=[new Set(),new Set(),new Set(),new Set(),new Set(),new Set(),new Set()];
  Object.keys(dayTotalsAll).forEach(date=>{dowDaySets[new Date(date+"T12:00:00").getDay()].add(date);});
  const dowNames=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const dowCounts=dowDaySets.map((s,i)=>({dow:i,count:s.size}));
  const bestDow=[...dowCounts].sort((a,b)=>b.count-a.count)[0];
  const windowDaySets={}; sessions.forEach(s=>{if(!s.ts)return;const hr=new Date(s.ts).getHours();const start=Math.floor(hr/2)*2;const end=start+2;const fmt=(h)=>{if(h===0)return"12 AM";if(h<12)return`${h} AM`;if(h===12)return"12 PM";return`${h-12} PM`;};const label=`${fmt(start)} – ${fmt(end>23?0:end)}`;if(!windowDaySets[label])windowDaySets[label]=new Set();windowDaySets[label].add(s.date);});
  const windowData=Object.entries(windowDaySets).map(([label,set])=>({label,count:set.size})).sort((a,b)=>b.count-a.count);
  const bestWindow=windowData[0];
  const zones=[{label:"< 1 hr",min:0,max:60},{label:"1–2 hrs",min:60,max:120},{label:"2–3 hrs",min:120,max:180},{label:"3–4 hrs",min:180,max:240},{label:"4+ hrs",min:240,max:99999}];
  const bestZone=zones.map(z=>({...z,count:Object.values(dayTotalsAll).filter(m=>m>=z.min&&m<z.max).length})).sort((a,b)=>b.count-a.count)[0];

  const navBtn = {background:'none',border:'none',fontSize:18,cursor:'pointer',color:D.t2,fontFamily:D.fm,fontWeight:600,padding:'4px 8px',borderRadius:D.rSm,transition:D.transition};
  const tH = {fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em',fontFamily:D.fm,color:D.t3};
  const tR = {display:'grid',padding:'10px 0',borderBottom:`1px solid ${D.border}`,fontFamily:D.fm,fontSize:13,alignItems:'center'};

  const CollapseBtn = ({show,onToggle,label})=>(
    <div style={{marginTop:24,textAlign:'center'}}>
      <button onClick={onToggle} className="btn-ghost" style={{padding:'10px 24px',fontSize:11,letterSpacing:'0.06em',textTransform:'uppercase',borderRadius:D.r,display:'inline-flex',alignItems:'center',gap:8}}>
        <span style={{display:'inline-block',transition:'transform 0.3s ease',transform:show?'rotate(180deg)':'rotate(0deg)',fontSize:10}}>▼</span>
        {show?`Hide ${label}`:label}
      </button>
    </div>
  );

  return (
    <div style={{animation:'fadeUp 0.35s ease'}}>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
        <button onClick={()=>exportToExcel(sessions)} disabled={sessions.length===0} className="btn-ghost" style={{padding:'8px 16px',fontSize:10,letterSpacing:'0.06em',textTransform:'uppercase',display:'flex',alignItems:'center',gap:6,borderRadius:D.rSm,opacity:sessions.length>0?1:0.3}}>↓ Export Excel</button>
      </div>

      <SectionLabel style={{marginTop:0}}>Daily Report</SectionLabel>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:24,marginBottom:20}}>
        <button onClick={()=>shiftDate(-1)} style={navBtn}>←</button>
        <span style={{fontSize:15,fontWeight:700,fontFamily:D.fb,minWidth:140,textAlign:'center',color:D.t1}}>{dateLabel}</span>
        <button onClick={()=>shiftDate(1)} style={{...navBtn,opacity:isToday?0.2:1,pointerEvents:isToday?'none':'auto'}}>→</button>
      </div>

      <div className="fm-card" style={{padding:'20px',textAlign:'center',marginBottom:20}}>
        <div style={{fontSize:46,fontFamily:D.fn,fontWeight:700,color:D.t1,letterSpacing:'-0.02em'}}>{formatHM(totalMins)}</div>
        <div style={{fontSize:10,fontFamily:D.fm,textTransform:'uppercase',letterSpacing:'0.14em',color:D.t3,marginTop:6,fontWeight:700}}>Total Upskilling {totalMins>=120&&'🔥'}</div>
      </div>

      {sorted.length===0 ? <div style={{textAlign:'center',color:D.t3,fontFamily:D.fm,fontSize:13,padding:'30px 0'}}>No sessions recorded</div> : <TagBarChart sorted={sorted} allTags={allTags}/>}

      {daySessions.length>0&&(
        <div style={{marginTop:20}}>
          <div style={{fontSize:9,fontFamily:D.fm,textTransform:'uppercase',letterSpacing:'0.12em',color:D.t3,marginBottom:8,fontWeight:700}}>Session Log</div>
          {daySessions.map(s=>(<div key={s.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:`1px solid ${D.border}`,fontFamily:D.fm,fontSize:13}}><span style={{display:'flex',alignItems:'center',gap:8}}><span style={{width:7,height:7,borderRadius:2,background:getTagColor(s.tag,allTags),display:'inline-block'}}/>{s.tag}</span><span style={{color:D.t3,fontFamily:D.fn,fontSize:12}}>{formatHM(s.duration)}</span></div>))}
        </div>
      )}

      <CollapseBtn show={showReports} onToggle={()=>setShowReports(!showReports)} label="Weekly & Monthly Reports"/>
      <div style={{maxHeight:showReports?(reportsRef.current?reportsRef.current.scrollHeight+"px":"2000px"):"0px",overflow:'hidden',transition:'max-height 0.5s ease, opacity 0.4s ease',opacity:showReports?1:0}}>
        <div ref={reportsRef}>
          <SectionLabel>Weekly Report — {weekLabel}</SectionLabel>
          <PeriodBarChart dates={weekDates} sessions={sessions}/>
          <div style={{marginTop:36,marginBottom:14,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{fontSize:10,fontFamily:D.fm,textTransform:'uppercase',letterSpacing:'0.14em',color:D.t3,fontWeight:700}}>Monthly Report</div>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <button onClick={()=>shiftMonth(-1)} style={{...navBtn,fontSize:15}}>←</button>
              <span style={{fontSize:13,fontWeight:700,fontFamily:D.fb,color:D.t1}}>{monthLabel}</span>
              <button onClick={()=>shiftMonth(1)} style={{...navBtn,fontSize:15}}>→</button>
            </div>
          </div>
          <PeriodBarChart dates={monthDates} sessions={sessions}/>
        </div>
      </div>

      {personalBests.length>0&&(
        <>
          <SectionLabel>🏆 Personal Bests</SectionLabel>
          <div style={{...tR,borderBottom:`1px solid ${D.borderMid}`,padding:'0 0 8px',gridTemplateColumns:'1fr 100px 80px'}}><span style={tH}>Category</span><span style={{...tH,textAlign:'right'}}>Best</span><span style={{...tH,textAlign:'right'}}>Date</span></div>
          {personalBests.map((b,i)=>(<div key={b.tag} style={{...tR,gridTemplateColumns:'1fr 100px 80px'}}><span style={{display:'flex',alignItems:'center',gap:8}}><span style={{width:7,height:7,borderRadius:2,background:getTagColor(b.tag,allTags),display:'inline-block'}}/><span style={{fontWeight:600,color:D.t1}}>{b.tag}</span>{i===0&&<span style={{fontSize:11}}>👑</span>}</span><span style={{textAlign:'right',fontWeight:700,color:D.success,fontFamily:D.fn,fontSize:13}}>{formatHM(b.mins)}</span><span style={{textAlign:'right',color:D.t3,fontSize:11,fontFamily:D.fn}}>{b.date?new Date(b.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}):"—"}</span></div>))}
        </>
      )}

      <CollapseBtn show={showAdvanced} onToggle={()=>setShowAdvanced(!showAdvanced)} label="Advanced Analysis"/>
      <div style={{maxHeight:showAdvanced?(advancedRef.current?advancedRef.current.scrollHeight+"px":"3000px"):"0px",overflow:'hidden',transition:'max-height 0.5s ease, opacity 0.4s ease',opacity:showAdvanced?1:0}}>
        <div ref={advancedRef}>
          <SectionLabel>Distribution — Hours vs Days</SectionLabel>
          <div style={{overflowX:'auto',paddingBottom:8}}>
            <div style={{display:'flex',alignItems:'flex-end',gap:6,minWidth:bucketCounts.length*56,height:160,paddingTop:16}}>
              {bucketCounts.map((c,i)=>{const h=maxBucket>0?(c.count/maxBucket)*120:0;return(
                <div key={c.label} style={{flex:1,minWidth:44,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',height:160}}>
                  <span style={{fontSize:11,fontFamily:D.fn,fontWeight:600,marginBottom:4,color:distColors[i]}}>{c.count>0?c.count:""}</span>
                  <div style={{width:'100%',height:h,background:distColors[i],borderRadius:'4px 4px 0 0',transition:'height 0.4s ease',minHeight:c.count>0?6:2,opacity:0.85}}/>
                  <span style={{fontSize:9,fontFamily:D.fm,marginTop:6,color:D.t3,fontWeight:500}}>{c.label}</span>
                </div>
              );})}
            </div>
          </div>
          <SectionLabel>Focus Insights</SectionLabel>
          {sessions.length>0&&(
            <>
              <div style={{...tR,borderBottom:`1px solid ${D.borderMid}`,padding:'0 0 8px',gridTemplateColumns:'1fr 130px 70px'}}><span style={tH}>Insight</span><span style={{...tH,textAlign:'right'}}>Value</span><span style={{...tH,textAlign:'right'}}>Count</span></div>
              {[
                {label:'Comfort Zone',sub:'Most consistent range',val:bestZone&&bestZone.count>0?bestZone.label:'—',cnt:bestZone&&bestZone.count>0?`${bestZone.count} days`:'—',color:D.purple},
                {label:'Best Focus Day',sub:'Day you study most',val:bestDow&&bestDow.count>0?dowNames[bestDow.dow]:'—',cnt:bestDow&&bestDow.count>0?`${bestDow.count} days`:'—',color:D.success},
                {label:'Peak Time Window',sub:'When you focus most',val:bestWindow?bestWindow.label:'—',cnt:bestWindow?`${bestWindow.count} days`:'—',color:D.blue},
              ].map(row=>(
                <div key={row.label} style={{...tR,gridTemplateColumns:'1fr 130px 70px'}}>
                  <div><div style={{fontWeight:600,color:D.t1}}>{row.label}</div><div style={{fontSize:10,color:D.t3,marginTop:2,fontWeight:500}}>{row.sub}</div></div>
                  <span style={{textAlign:'right',fontWeight:700,color:row.color,fontFamily:D.fn,fontSize:12}}>{row.val}</span>
                  <span style={{textAlign:'right',color:D.t3,fontSize:11,fontFamily:D.fn}}>{row.cnt}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CALENDAR PAGE
// ─────────────────────────────────────────────────────────────
function CalendarPage({ sessions }) {
  const [viewDate, setViewDate] = useState(new Date());
  const fireDays=getFireDays(sessions); const dayTotals=getDayTotals(sessions);
  const year=viewDate.getFullYear(); const month=viewDate.getMonth();
  const firstDay=new Date(year,month,1).getDay();
  const daysInMonth=new Date(year,month+1,0).getDate();
  const monthName=viewDate.toLocaleDateString("en-US",{month:"long",year:"numeric"});
  const cells=[]; for(let i=0;i<firstDay;i++)cells.push(null); for(let d=1;d<=daysInMonth;d++)cells.push(d);
  const shiftMonth=(dir)=>{const d=new Date(viewDate);d.setMonth(d.getMonth()+dir);setViewDate(d);};
  const today=new Date(); const isCurrentMonth=year===today.getFullYear()&&month===today.getMonth();
  let monthFireCount=0;
  for(let d=1;d<=daysInMonth;d++){const key=`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;if(fireDays.has(key))monthFireCount++;}

  return (
    <div style={{animation:'fadeUp 0.35s ease'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:24,marginBottom:6}}>
        <button onClick={()=>shiftMonth(-1)} style={{background:'none',border:'none',fontSize:18,cursor:'pointer',color:D.t2,fontFamily:D.fm,fontWeight:600,padding:'4px 8px'}}>←</button>
        <span style={{fontSize:16,fontWeight:700,fontFamily:D.fb,minWidth:220,textAlign:'center',color:D.t1}}>{monthName}</span>
        <button onClick={()=>shiftMonth(1)} style={{background:'none',border:'none',fontSize:18,cursor:'pointer',color:D.t2,fontFamily:D.fm,fontWeight:600,padding:'4px 8px'}}>→</button>
      </div>
      <div style={{textAlign:'center',fontFamily:D.fm,fontSize:12,color:D.t3,marginBottom:20,fontWeight:500}}>
        <span style={{color:D.accent,fontWeight:700}}>{monthFireCount}</span> fire {monthFireCount===1?'day':'days'} this month
      </div>

      {/* Calendar grid */}
      <div className="fm-card" style={{padding:'16px'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,marginBottom:8}}>
          {["S","M","T","W","T","F","S"].map((d,i)=>(
            <div key={i} style={{textAlign:'center',fontSize:10,color:D.t3,fontWeight:700,padding:'4px 0',letterSpacing:'0.08em',fontFamily:D.fm}}>{d}</div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4}}>
          {cells.map((day,i)=>{
            if(day===null)return<div key={`e${i}`}/>;
            const key=`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const isFire=fireDays.has(key);
            const isToday=isCurrentMonth&&day===today.getDate();
            const isMissed=isPastDate(key)&&!isFire;
            const mins=dayTotals[key]||0;
            return (
              <div key={i} className="day-cell" style={{aspectRatio:'1',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',borderRadius:D.rSm,background:isFire?D.accentDim:isMissed?D.errorDim:isToday?D.surface:'transparent',border:`1px solid ${isFire?'rgba(245,158,11,0.3)':isMissed?'rgba(239,68,68,0.2)':isToday?D.borderMid:D.border}`,boxShadow:isFire?'0 0 8px rgba(245,158,11,0.1)':'none',transition:D.transition}}>
                {isFire&&<span style={{fontSize:14,lineHeight:1}}>🔥</span>}
                {isMissed&&<span style={{fontSize:11,lineHeight:1,color:D.error}}>✗</span>}
                <span style={{fontSize:isFire||isMissed?9:13,lineHeight:1,marginTop:isFire||isMissed?2:0,color:isFire?D.accent:isMissed?D.error:isToday?D.t1:D.t2,fontWeight:isToday?800:500,fontFamily:isFire?D.fm:D.fn}}>{day}</span>
                {!isFire&&mins>0&&<span style={{fontSize:7,color:D.t3,fontFamily:D.fn,lineHeight:1,marginTop:1}}>{formatHM(mins)}</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{marginTop:20,display:'flex',justifyContent:'center',gap:20,fontFamily:D.fm,fontSize:11,color:D.t3}}>
        <span>🔥 = 2h+</span><span style={{color:D.error}}>✗ = missed</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// REFLECTION PAGE
// ─────────────────────────────────────────────────────────────
function ReflectionPage({ sessions }) {
  const [reflections, setReflections] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [editText, setEditText] = useState(""); const [editHrs, setEditHrs] = useState("");
  useEffect(()=>{loadReflections().then(data=>{setReflections(data);setLoaded(true);});},[]);
  const saveReflection=async(date,note,hrsOverride)=>{setReflections(prev=>({...prev,[date]:{note,hrsOverride}}));await upsertReflection(date,note,hrsOverride);};
  const dayTotals=getDayTotals(sessions);
  const allDates=[...new Set([...Object.keys(dayTotals),...Object.keys(reflections)])].sort((a,b)=>b.localeCompare(a));
  const today=todayStr(); if(!allDates.includes(today))allDates.unshift(today);
  const startEdit=(date)=>{const r=reflections[date]||{};setEditingKey(date);setEditText(r.note||"");setEditHrs(r.hrsOverride!=null?String(r.hrsOverride):"");};
  const saveRow=(date)=>{const hrsVal=editHrs.trim()!==""?parseFloat(editHrs):null;saveReflection(date,editText,hrsVal);setEditingKey(null);};
  const getHours=(date)=>{const r=reflections[date];if(r&&r.hrsOverride!=null)return r.hrsOverride;return(dayTotals[date]||0)/60;};
  const getMins=(date)=>{const r=reflections[date];if(r&&r.hrsOverride!=null)return Math.round(r.hrsOverride*60);return dayTotals[date]||0;};

  if(!loaded)return(<div style={{textAlign:'center',padding:'40px 0',fontFamily:D.fm,color:D.t3,fontSize:13}}>Loading...</div>);

  return (
    <div style={{animation:'fadeUp 0.35s ease'}}>
      <div style={{fontSize:10,fontFamily:D.fm,textTransform:'uppercase',letterSpacing:'0.14em',color:D.t3,marginBottom:16,fontWeight:700}}>Daily Reflection</div>
      <div style={{display:'grid',gridTemplateColumns:'90px 1fr 64px',gap:0,fontFamily:D.fm,borderBottom:`1px solid ${D.borderMid}`,paddingBottom:8,marginBottom:4}}>
        {['Date','Notes','Hours'].map(h=><span key={h} style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em',color:D.t3,textAlign:h==='Hours'?'right':'left'}}>{h}</span>)}
      </div>
      {allDates.map(date=>{
        const hrs=getHours(date); const mins=getMins(date); const isGreen=mins>=120; const r=reflections[date]||{};
        const isEditing=editingKey===date; const isToday=date===today;
        const dayLabel=new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short"});
        const dateLabel=new Date(date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
        return (
          <div key={date} className="reflect-row" onClick={()=>{if(!isEditing)startEdit(date);}} style={{display:'grid',gridTemplateColumns:'90px 1fr 64px',gap:0,padding:'10px 8px',borderBottom:`1px solid ${D.border}`,background:isEditing?D.surfaceHover:'transparent',marginLeft:-8,marginRight:-8,paddingLeft:8,paddingRight:8}}>
            <div style={{display:'flex',flexDirection:'column',justifyContent:'center'}}>
              <span style={{fontWeight:700,fontSize:12,fontFamily:D.fm,color:D.t1}}>{dayLabel}</span>
              <span style={{fontSize:10,color:D.t3,fontFamily:D.fm}}>{dateLabel}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',paddingRight:8}}>
              {isEditing ? (
                <div style={{display:'flex',gap:6,width:'100%',alignItems:'center'}}>
                  <input value={editText} onChange={e=>setEditText(e.target.value)} autoFocus placeholder="How was your study?" onKeyDown={e=>{if(e.key==="Enter")saveRow(date);if(e.key==="Escape")setEditingKey(null);}} className="fm-input" style={{flex:1,padding:'6px 10px',fontSize:12}}/>
                  <button onClick={e=>{e.stopPropagation();saveRow(date);}} className="btn-primary" style={{padding:'6px 12px',fontSize:10,borderRadius:D.rSm,letterSpacing:'0.03em'}}>Save</button>
                </div>
              ) : <span style={{color:r.note?D.t1:D.t3,fontSize:12,fontFamily:D.fm,fontWeight:r.note?500:400}}>{r.note||(isToday?'Click to add reflection...':'—')}</span>}
            </div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end'}}>
              {isEditing ? (
                <input value={editHrs} onChange={e=>setEditHrs(e.target.value)} placeholder={hrs.toFixed(1)} type="number" step="0.1" onKeyDown={e=>{if(e.key==="Enter")saveRow(date);}} className="fm-input" style={{width:52,padding:'6px 8px',fontSize:12,textAlign:'right'}}/>
              ) : <span style={{fontWeight:700,color:isGreen?D.success:D.error,fontSize:12,fontFamily:D.fn}}>{hrs.toFixed(1)}h</span>}
            </div>
          </div>
        );
      })}
      {allDates.length===0&&<div style={{textAlign:'center',color:D.t3,fontFamily:D.fm,fontSize:13,padding:'40px 0'}}>No data yet. Start logging sessions!</div>}
      <div style={{display:'flex',gap:16,marginTop:16,fontFamily:D.fm,fontSize:10,color:D.t3}}>
        <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:8,height:8,background:D.successDim,border:`1px solid rgba(16,185,129,0.3)`,display:'inline-block',borderRadius:2}}/> 2h+</span>
        <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:8,height:8,background:D.errorDim,border:`1px solid rgba(239,68,68,0.2)`,display:'inline-block',borderRadius:2}}/> &lt;2h</span>
        <span style={{fontWeight:500}}>Click row to edit</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SLEEP PAGE
// ─────────────────────────────────────────────────────────────
function SleepPage({ sleepLogs, setSleepLogs }) {
  const [sleepStart, setSleepStart] = useState("23:00");
  const [wakeUp, setWakeUp] = useState("06:30");
  const [logDate, setLogDate] = useState(todayStr());

  const calcSleepMins=(start,wake)=>{
    const[sh,sm]=start.split(":").map(Number),[wh,wm]=wake.split(":").map(Number);
    let s=sh*60+sm,w=wh*60+wm; if(w<=s)w+=1440; return w-s;
  };
  const logSleep=async()=>{
    const totalMins=calcSleepMins(sleepStart,wakeUp);
    const saved=await upsertSleepLog(logDate,sleepStart,wakeUp,totalMins);
    if(saved){setSleepLogs(prev=>{const f=prev.filter(l=>l.date!==logDate);return[saved,...f].sort((a,b)=>b.date.localeCompare(a.date));});}
  };
  const sleepColor=(mins)=>{if(mins<360)return D.warning;if(mins<=450)return D.success;return D.error;};

  const last14=[]; for(let i=13;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);last14.push(d.toISOString().slice(0,10));}
  const logMap={}; sleepLogs.forEach(l=>{logMap[l.date]=l;});
  const barData=last14.map(d=>({date:d,mins:logMap[d]?.total_mins||0}));
  const maxSleep=Math.max(...barData.map(d=>d.mins),1); const barH=110;
  const recent7=sleepLogs.slice(0,7);
  const avgSleep=recent7.length>0?Math.round(recent7.reduce((a,l)=>a+(l.total_mins||0),0)/recent7.length):0;
  const avgBed=recent7.length>0?recent7.map(l=>l.sleep_start||"23:00").sort()[Math.floor(recent7.length/2)]:"—";
  const avgWake=recent7.length>0?recent7.map(l=>l.wake_up||"07:00").sort()[Math.floor(recent7.length/2)]:"—";
  const thisMonth=todayStr().slice(0,7); const monthLogs=sleepLogs.filter(l=>l.date.startsWith(thisMonth));
  const monthAvg=monthLogs.length>0?Math.round(monthLogs.reduce((a,l)=>a+(l.total_mins||0),0)/monthLogs.length):0;

  return (
    <div style={{animation:'fadeUp 0.35s ease'}}>
      {/* Log sleep */}
      <div style={{fontSize:10,fontFamily:D.fm,textTransform:'uppercase',letterSpacing:'0.14em',color:D.t3,marginBottom:14,fontWeight:700}}>Log Sleep</div>
      <div className="fm-card" style={{padding:'16px',marginBottom:24}}>
        <div style={{display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap'}}>
          {[{label:'DATE',val:logDate,set:setLogDate,type:'date'},{label:'SLEEP',val:sleepStart,set:setSleepStart,type:'time'},{label:'WAKE UP',val:wakeUp,set:setWakeUp,type:'time'}].map(f=>(
            <div key={f.label} style={{display:'flex',flexDirection:'column',gap:5}}>
              <label style={{fontSize:9,fontFamily:D.fm,color:D.t3,fontWeight:700,letterSpacing:'0.12em'}}>{f.label}</label>
              <input type={f.type} value={f.val} onChange={e=>f.set(e.target.value)} className="fm-input" style={{padding:'9px 12px',fontSize:13,width:f.type==='date'?140:100}}/>
            </div>
          ))}
          <button onClick={logSleep} className="btn-primary" style={{padding:'10px 22px',fontSize:13,letterSpacing:'0.03em',borderRadius:D.r}}>Log</button>
        </div>
      </div>

      {/* Averages */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:24}}>
        <div className="fm-card" style={{padding:'16px'}}>
          <div style={{fontSize:9,color:D.t3,textTransform:'uppercase',letterSpacing:'0.12em',fontFamily:D.fm,fontWeight:700,marginBottom:8}}>Weekly (last 7)</div>
          <div style={{fontSize:24,fontWeight:700,fontFamily:D.fn,color:D.t1}}>{formatHM(avgSleep)}</div>
          <div style={{fontSize:11,color:D.t2,marginTop:6,fontFamily:D.fm}}>Bed: <span style={{fontFamily:D.fn,fontWeight:600,color:D.t1}}>{avgBed}</span></div>
          <div style={{fontSize:11,color:D.t2,fontFamily:D.fm}}>Wake: <span style={{fontFamily:D.fn,fontWeight:600,color:D.t1}}>{avgWake}</span></div>
        </div>
        <div className="fm-card" style={{padding:'16px'}}>
          <div style={{fontSize:9,color:D.t3,textTransform:'uppercase',letterSpacing:'0.12em',fontFamily:D.fm,fontWeight:700,marginBottom:8}}>Monthly</div>
          <div style={{fontSize:24,fontWeight:700,fontFamily:D.fn,color:D.t1}}>{formatHM(monthAvg)}</div>
          <div style={{fontSize:11,color:D.t2,marginTop:6,fontFamily:D.fm}}><span style={{fontFamily:D.fn,fontWeight:600,color:D.t1}}>{monthLogs.length}</span> nights logged</div>
        </div>
      </div>

      {/* Sleep bar chart */}
      <div style={{fontSize:10,fontFamily:D.fm,textTransform:'uppercase',letterSpacing:'0.14em',color:D.t3,marginBottom:12,fontWeight:700}}>Last 14 Days</div>
      <div className="fm-card" style={{padding:'16px',marginBottom:24}}>
        <div style={{overflowX:'auto',paddingBottom:4}}>
          <div style={{display:'flex',alignItems:'flex-end',gap:4,minWidth:14*32,height:barH+36,paddingTop:14}}>
            {barData.map(d=>{
              const h=d.mins>0?(d.mins/maxSleep)*barH:0;
              const color=d.mins>0?sleepColor(d.mins):'rgba(255,255,255,0.06)';
              const dayLabel=new Date(d.date+"T12:00:00").getDate();
              return (
                <div key={d.date} style={{flex:1,minWidth:20,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',height:barH+36}}>
                  {d.mins>0&&<span style={{fontSize:8,fontFamily:D.fn,fontWeight:600,marginBottom:2,color,lineHeight:1}}>{formatHM(d.mins)}</span>}
                  <div style={{width:'100%',height:Math.max(h,d.mins>0?4:2),background:color,borderRadius:'3px 3px 0 0'}}/>
                  <span style={{fontSize:8,fontFamily:D.fn,marginTop:3,color:D.t3,lineHeight:1}}>{dayLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{display:'flex',gap:14,marginTop:10,fontFamily:D.fm,fontSize:10,color:D.t3,flexWrap:'wrap'}}>
          <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:7,height:7,background:D.warning,borderRadius:2,display:'inline-block'}}/> &lt;6h</span>
          <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:7,height:7,background:D.success,borderRadius:2,display:'inline-block'}}/> 6–7.5h</span>
          <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:7,height:7,background:D.error,borderRadius:2,display:'inline-block'}}/> &gt;7.5h</span>
        </div>
      </div>

      {/* Sleep log table */}
      <div style={{fontSize:10,fontFamily:D.fm,textTransform:'uppercase',letterSpacing:'0.14em',color:D.t3,marginBottom:10,fontWeight:700}}>Sleep Log</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 70px 70px 60px',gap:0,fontFamily:D.fm,borderBottom:`1px solid ${D.borderMid}`,paddingBottom:6,marginBottom:4}}>
        {['Date','Sleep','Wake','Total'].map((h,i)=><span key={h} style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em',color:D.t3,textAlign:i===3?'right':'left'}}>{h}</span>)}
      </div>
      {sleepLogs.length===0&&<div style={{color:D.t3,fontFamily:D.fm,fontSize:13,padding:'20px 0',textAlign:'center'}}>No sleep logs yet</div>}
      {sleepLogs.map(l=>{
        const color=sleepColor(l.total_mins||0);
        const dayLabel=new Date(l.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
        return (
          <div key={l.id} style={{display:'grid',gridTemplateColumns:'1fr 70px 70px 60px',padding:'9px 0',borderBottom:`1px solid ${D.border}`,fontFamily:D.fm,fontSize:13}}>
            <span style={{fontWeight:600,fontSize:11,color:D.t1}}>{dayLabel}</span>
            <span style={{color:D.t2,fontFamily:D.fn,fontSize:12}}>{l.sleep_start||'—'}</span>
            <span style={{color:D.t2,fontFamily:D.fn,fontSize:12}}>{l.wake_up||'—'}</span>
            <span style={{textAlign:'right',fontWeight:700,color,fontFamily:D.fn,fontSize:12}}>{l.total_mins?formatHM(l.total_mins):'—'}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FOOTER
// ─────────────────────────────────────────────────────────────
function Footer({ onLogout }) {
  return (
    <div style={{marginTop:48,padding:'14px 0',borderTop:`1px solid ${D.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <span style={{fontSize:12,fontFamily:D.fm,fontWeight:500,color:D.t3}}>
        Vibe coded by <span style={{color:D.t2,fontWeight:600}}>Nithin Chowdary</span> <span style={{color:D.error}}>❤️</span>
      </span>
      <button onClick={onLogout} className="btn-ghost" style={{padding:'6px 14px',fontSize:10,letterSpacing:'0.06em',textTransform:'uppercase',borderRadius:D.rSm}}>Logout</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LOADING SCREEN
// ─────────────────────────────────────────────────────────────
function LoadingScreen({ text="Loading..." }) {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',background:D.bg,gap:16}}>
      <div style={{width:40,height:40,borderRadius:'50%',border:`3px solid ${D.border}`,borderTop:`3px solid ${D.accent}`,animation:'spin 0.8s linear infinite'}}/>
      <div style={{fontFamily:D.fm,fontSize:13,color:D.t3,fontWeight:500}}>{text}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
export default function App() {
  useGlobalStyles();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState(PAGES.TIMER);
  const [sessions, setSessions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [sleepLogs, setSleepLogs] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{setUser(session?.user??null);setAuthLoading(false);});
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{setUser(session?.user??null);});
    return()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(!user){setSessions([]);setTasks([]);setSleepLogs([]);setLoaded(false);return;}
    setLoaded(false);
    Promise.all([loadSessions(),loadTasks(),loadSleepLogs()]).then(([s,t,sl])=>{setSessions(s);setTasks(t);setSleepLogs(sl);setLoaded(true);});
  },[user]);

  const handleLogout=async()=>{await supabase.auth.signOut();setUser(null);setSessions([]);setTasks([]);setSleepLogs([]);setLoaded(false);};
  const streak=calcStreak(sessions);
  const todayMins=sessions.filter(s=>s.date===todayStr()).reduce((a,s)=>a+s.duration,0);

  if(authLoading)return<LoadingScreen text="Authenticating..."/>;
  if(!user)return<AuthPage onAuth={setUser}/>;
  if(!loaded)return<LoadingScreen text="Loading your data..."/>;

  return (
    <div style={{maxWidth:580,margin:'0 auto',padding:'72px 20px 60px',minHeight:'100vh',background:D.bg,color:D.t1,position:'relative'}}>
      {/* Subtle background glow */}
      <div style={{position:'fixed',top:0,left:'50%',transform:'translateX(-50%)',width:600,height:300,background:'radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.04) 0%, transparent 70%)',pointerEvents:'none',zIndex:0}}/>

      <StreakBadge streak={streak} todayMins={todayMins}/>
      <div style={{position:'relative',zIndex:1}}>
        <QuotesBanner/>
        <CountdownBanner sessions={sessions}/>
        <TopBar sessions={sessions} streak={streak}/>
        <Nav page={page} setPage={setPage}/>
        {page===PAGES.TIMER&&<TimerPage sessions={sessions} setSessions={setSessions}/>}
        {page===PAGES.TASKS&&<TasksPage tasks={tasks} setTasks={setTasks}/>}
        {page===PAGES.ANALYSIS&&<AnalysisPage sessions={sessions}/>}
        {page===PAGES.CALENDAR&&<CalendarPage sessions={sessions}/>}
        {page===PAGES.REFLECTION&&<ReflectionPage sessions={sessions}/>}
        {page===PAGES.SLEEP&&<SleepPage sleepLogs={sleepLogs} setSleepLogs={setSleepLogs}/>}
        <Footer onLogout={handleLogout}/>
      </div>
    </div>
  );
}