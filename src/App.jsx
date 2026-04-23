import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import * as Tone from "tone";
import { supabase } from "./supabaseClient";

const PAGES = { HABITS: "habits", TIMER: "timer", TASKS: "tasks", GOALS: "goals", ANALYSIS: "analysis", CALENDAR: "calendar", REFLECTION: "reflection", SLEEP: "sleep" };

// ═══════════════════════════════════════════
// ─── THEME SYSTEM (persists in localStorage) ───
// ═══════════════════════════════════════════
const ThemeContext = createContext();
const L = {
  bg:"#fff", bg2:"#f6f6f6", bg3:"#f8f8f8", bgH:"#f0f0f0",
  tx:"#000", tx2:"#666", tx3:"#999", tx4:"#ccc",
  bd:"#eee", bd2:"#ddd", bd3:"#000",
  nav:"#fff", navSh:"0 2px 12px rgba(0,0,0,0.06)",
  side:"#fff", sideSh:"4px 0 24px rgba(0,0,0,0.12)",
  over:"rgba(0,0,0,0.35)",
  rG:"rgba(42,157,143,0.08)", rR:"rgba(230,57,70,0.06)",
  rGB:"rgba(42,157,143,0.2)", rRB:"rgba(230,57,70,0.15)",
  calBd:"#333", calE:"#fafafa", calH:"#f0f0f0", calF:"#fff", calFC:"#ccc",
  btn:"#000", btnT:"#fff", sel:"#fff", miss:"#fff0f0",
  ftBg:"#E8F4FD", ftC:"#4A5568",
};
const D = {
  bg:"#000", bg2:"#111", bg3:"#1a1a1a", bgH:"#222",
  tx:"#fafafa", tx2:"#aaa", tx3:"#777", tx4:"#444",
  bd:"#222", bd2:"#333", bd3:"#fff",
  nav:"#000", navSh:"0 2px 12px rgba(0,0,0,0.4)",
  side:"#111", sideSh:"4px 0 24px rgba(0,0,0,0.5)",
  over:"rgba(0,0,0,0.6)",
  rG:"rgba(42,157,143,0.15)", rR:"rgba(230,57,70,0.12)",
  rGB:"rgba(42,157,143,0.3)", rRB:"rgba(230,57,70,0.25)",
  calBd:"#444", calE:"#0a0a0a", calH:"#1a1a1a", calF:"#111", calFC:"#444",
  btn:"#fff", btnT:"#000", sel:"#111", miss:"#2a1215",
  ftBg:"#111", ftC:"#888",
};
function useT() { return useContext(ThemeContext); }

function useWindowWidth() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => { const h = () => setW(window.innerWidth); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  return w;
}

const QUOTES = ["Develop the quality of being unstoppable","Don't let your Mind and Body Betray you!"];

let bellReady=false, bellSynth=null;
function initBell(){if(bellReady)return;bellSynth=new Tone.PolySynth(Tone.Synth,{oscillator:{type:"sine"},envelope:{attack:0.005,decay:0.8,sustain:0.01,release:1.2},volume:-6}).toDestination();bellReady=true;}
function playBell(){try{if(!bellReady)initBell();Tone.start();const n=Tone.now();bellSynth.triggerAttackRelease("C6","8n",n);bellSynth.triggerAttackRelease("E6","8n",n+0.15);bellSynth.triggerAttackRelease("G6","8n",n+0.3);bellSynth.triggerAttackRelease("C7","4n",n+0.5);}catch(e){}}
function playStartPop(){try{Tone.start();const s=new Tone.Synth({oscillator:{type:"triangle"},envelope:{attack:0.005,decay:0.15,sustain:0,release:0.1},volume:-8}).toDestination();s.triggerAttackRelease("G5","16n");setTimeout(()=>s.dispose(),500);}catch(e){}}
function playStopPop(){try{Tone.start();const s=new Tone.Synth({oscillator:{type:"triangle"},envelope:{attack:0.005,decay:0.2,sustain:0,release:0.15},volume:-8}).toDestination();s.triggerAttackRelease("D5","16n");setTimeout(()=>s.dispose(),500);}catch(e){}}

// ─── Supabase helpers ───
async function loadSessions(){const{data,error}=await supabase.from("sessions").select("*").order("ts",{ascending:true});if(error)return[];return data.map(r=>({id:r.id,tag:r.tag,duration:r.duration,date:r.date,ts:Number(r.ts)}));}
async function insertSession(session){const{data:{user}}=await supabase.auth.getUser();if(!user)return null;const{data,error}=await supabase.from("sessions").insert({user_id:user.id,tag:session.tag,duration:session.duration,date:session.date,ts:session.ts}).select().single();if(error)return null;return data;}
async function deleteSession(id){await supabase.from("sessions").delete().eq("id",id);}
async function updateSessionTag(id,newTag){await supabase.from("sessions").update({tag:newTag}).eq("id",id);}
async function loadReflections(){const{data,error}=await supabase.from("reflections").select("*");if(error)return{};const m={};data.forEach(r=>{m[r.date]={note:r.note||"",hrsOverride:r.hrs_override};});return m;}
async function upsertReflection(date,note,hrsOverride){const{data:{user}}=await supabase.auth.getUser();if(!user)return;await supabase.from("reflections").upsert({user_id:user.id,date,note,hrs_override:hrsOverride},{onConflict:"user_id,date"});}
async function loadTasks(){const{data,error}=await supabase.from("tasks").select("*").order("created_at",{ascending:true});if(error)return[];return data;}
async function insertTask(title,date,timeSlot){const{data:{user}}=await supabase.auth.getUser();if(!user)return null;const{data,error}=await supabase.from("tasks").insert({user_id:user.id,title,date,time_slot:timeSlot||null}).select().single();if(error)return null;return data;}
async function updateTaskCompleted(taskId,completedDate){await supabase.from("tasks").update({completed_date:completedDate}).eq("id",taskId);}
async function deleteTask(taskId){await supabase.from("tasks").delete().eq("id",taskId);}
async function loadSleepLogs(){const{data,error}=await supabase.from("sleep_logs").select("*").order("date",{ascending:false});if(error)return[];return data;}
async function upsertSleepLog(date,sleepStart,wakeUp,totalMins){const{data:{user}}=await supabase.auth.getUser();if(!user)return null;const{data,error}=await supabase.from("sleep_logs").upsert({user_id:user.id,date,sleep_start:sleepStart,wake_up:wakeUp,total_mins:totalMins},{onConflict:"user_id,date"}).select().single();if(error)return null;return data;}
async function loadGoals(){const{data,error}=await supabase.from("goals").select("*").order("created_at",{ascending:true});if(error)return[];return data.map(r=>({id:r.id,name:r.name,tag:r.tag,targetHours:Number(r.target_hours),startDate:r.start_date,targetDate:r.target_date}));}
async function insertGoal(name,tag,targetHours,startDate,targetDate){const{data:{user}}=await supabase.auth.getUser();if(!user)return null;const{data,error}=await supabase.from("goals").insert({user_id:user.id,name,tag,target_hours:targetHours,start_date:startDate,target_date:targetDate}).select().single();if(error)return null;return{id:data.id,name:data.name,tag:data.tag,targetHours:Number(data.target_hours),startDate:data.start_date,targetDate:data.target_date};}
async function deleteGoalDB(id){await supabase.from("goals").delete().eq("id",id);}
async function loadHabits(){const{data,error}=await supabase.from("habits").select("*").order("created_at",{ascending:true});if(error)return[];return data;}
async function insertHabit(name,icon,targetDays,startDate){const{data:{user}}=await supabase.auth.getUser();if(!user)return null;const{data,error}=await supabase.from("habits").insert({user_id:user.id,name,icon,target_days:targetDays,start_date:startDate}).select().single();if(error)return null;return data;}
async function deleteHabitDB(id){await supabase.from("habits").delete().eq("id",id);}
async function loadHabitLogs(){const{data,error}=await supabase.from("habit_logs").select("*");if(error)return[];return data;}
async function toggleHabitLog(habitId,date,exists){const{data:{user}}=await supabase.auth.getUser();if(!user)return null;if(exists){await supabase.from("habit_logs").delete().eq("habit_id",habitId).eq("date",date);return null;}const{data,error}=await supabase.from("habit_logs").insert({user_id:user.id,habit_id:habitId,date}).select().single();if(error)return null;return data;}

// ─── Utilities (IST-aware) ───
function toIST(d){return new Date(d.toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));}
function dateToStr(d){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function todayStr(){return dateToStr(toIST(new Date()));}
function nowIST(){return toIST(new Date());}
function formatTime(s){const m=Math.floor(s/60);const sec=s%60;return`${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;}
function formatHM(mins){const h=Math.floor(mins/60);const m=mins%60;if(h===0)return`${m}m`;if(m===0)return`${h}h`;return`${h}h ${m}m`;}
function calcStreak(sessions){const dt={};sessions.forEach(s=>{dt[s.date]=(dt[s.date]||0)+s.duration;});let streak=0;const d=nowIST();const tk=todayStr();if((dt[tk]||0)>=120){streak=1;d.setDate(d.getDate()-1);}else{d.setDate(d.getDate()-1);}while(true){const k=dateToStr(d);if((dt[k]||0)>=120){streak++;d.setDate(d.getDate()-1);}else break;}return streak;}
function getDayTotals(sessions){const t={};sessions.forEach(s=>{t[s.date]=(t[s.date]||0)+s.duration;});return t;}
function isPastDate(ds){return ds<todayStr();}
function getGreenForMins(mins){if(mins<120)return"#E63946";const hrs=mins/60;const t=Math.min((hrs-2)/4,1);return`rgb(${Math.round(42-t*30)},${Math.round(157+t*40)},${Math.round(143-t*80)})`;}
function getBarGradient(mins){if(mins<120)return"linear-gradient(180deg,#E63946,#FF6B6B)";const c=getGreenForMins(mins);return`linear-gradient(180deg,${c},${c}88)`;}
const F="'Nunito', sans-serif";

// ─── Theme Toggle ───
function ThemeToggle({isDark,onToggle}){
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 4px",fontFamily:F}}>
      <span style={{fontSize:12,fontWeight:600,color:isDark?"#aaa":"#666"}}>{isDark?"🌙 Dark":"☀️ Light"}</span>
      <button onClick={onToggle} style={{width:44,height:24,borderRadius:12,border:"none",background:isDark?"#fff":"#000",position:"relative",cursor:"pointer",transition:"background 0.3s ease"}}>
        <div style={{width:18,height:18,borderRadius:"50%",background:isDark?"#000":"#fff",position:"absolute",top:3,left:isDark?22:4,transition:"left 0.3s ease",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════
// ─── TOP NAVBAR ───
// ═══════════════════════════════════════════
function TopNavBar({sessions,streak,todayMins,onMenuClick}){
  const T=useT();const[visible,setVisible]=useState(true);const lastY=useRef(0);const w=useWindowWidth();const mob=w<480;
  useEffect(()=>{const h=()=>{const y=window.scrollY;if(y>lastY.current&&y>60)setVisible(false);else setVisible(true);lastY.current=y;};window.addEventListener("scroll",h,{passive:true});return()=>window.removeEventListener("scroll",h);},[]);
  const[qi,setQi]=useState(()=>Math.floor(Math.random()*QUOTES.length));
  useEffect(()=>{const t=setInterval(()=>setQi(p=>(p+1)%QUOTES.length),180000);return()=>clearInterval(t);},[]);
  const dt=getDayTotals(sessions);const mx=Object.values(dt).length>0?Math.max(...Object.values(dt)):0;const hit=todayMins>=120;
  return(
    <div style={{position:"fixed",top:0,left:0,right:0,zIndex:1000,background:T.nav,borderBottom:`1px solid ${T.bd}`,transform:visible?"translateY(0)":"translateY(-100%)",transition:"transform 0.35s ease",padding:mob?"8px 10px":"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",fontFamily:F,boxShadow:visible?T.navSh:"none"}}>
      <div style={{display:"flex",alignItems:"center",gap:mob?6:10}}>
        <button onClick={onMenuClick} style={{border:"none",background:"none",cursor:"pointer",padding:4,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.tx} strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <span style={{fontSize:mob?11:13,fontWeight:700,display:"flex",alignItems:"center",gap:4,color:T.tx}}>
          <span>⚡</span><span>{formatHM(mx)}</span>
          <span style={{fontWeight:400,fontSize:mob?8:10,color:T.tx3}}>max</span>
        </span>
      </div>
      {!mob&&(<div style={{flex:1,textAlign:"center",fontSize:13,fontWeight:700,color:T.tx2,fontStyle:"italic",padding:"0 12px",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>"{QUOTES[qi]}"</div>)}
      <div style={{display:"flex",alignItems:"center",gap:5,background:hit?(streak>0?T.btn:T.bg3):"#E63946",color:hit?(streak>0?T.btnT:T.tx3):"#fff",padding:mob?"5px 10px":"6px 14px",borderRadius:30,fontSize:mob?12:13,fontWeight:700}}>
        <span style={{fontSize:mob?14:16}}>{hit?(streak>0?"🔥":"○"):"⚠️"}</span>
        <span>{streak}</span>
        <span style={{fontWeight:400,fontSize:mob?8:10,opacity:0.8}}>{hit?(streak===1?"day":"days"):"do 2h+"}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// ─── WEEK STRIP ───
// ═══════════════════════════════════════════
function WeekStrip({sessions}){
  const T=useT();const w=useWindowWidth();const mob=w<480;
  const dt=getDayTotals(sessions);const now=nowIST();const tk=todayStr();
  const dow=now.getDay();const mon=new Date(now);mon.setDate(now.getDate()-((dow+6)%7));
  const wd=[];for(let i=0;i<7;i++){const dd=new Date(mon);dd.setDate(mon.getDate()+i);wd.push(dateToStr(dd));}
  const dl=["M","T","W","TH","F","SA","SU"];
  const wt=wd.reduce((a,d)=>a+(dt[d]||0),0);
  const tm=sessions.filter(s=>s.date===tk).reduce((a,s)=>a+s.duration,0);
  const tc=tm>=240?"#2A9D8F":tm>=120?"#F4A261":"#E63946";
  const hr=now.getHours();const ml=(24-hr-1)*60+(60-now.getMinutes());const hl=Math.floor(ml/60);const mL=ml%60;
  let mc;if(hr<12)mc="#2A9D8F";else if(hr<15)mc="#F4A261";else if(hr<18)mc="#E76F51";else if(hr<21)mc="#E63946";else mc="#C1121F";
  const[td,setTd]=useState(()=>localStorage.getItem("sl_targetDate")||"");
  const[et,setEt]=useState(false);const[tt,setTt]=useState("");
  const saveT=()=>{localStorage.setItem("sl_targetDate",tt);setTd(tt);setEt(false);};
  let tTxt="";if(td){const diff=Math.ceil((new Date(td+"T00:00:00")-new Date(tk+"T00:00:00"))/86400000);if(diff>0)tTxt=`${diff}d left`;else if(diff===0)tTxt="Today!";else tTxt=`${Math.abs(diff)}d ago`;}
  const sz=mob?36:32;
  return(
    <div style={{background:T.bg2,borderRadius:10,padding:mob?"10px 10px":"12px 14px",marginBottom:20,fontFamily:F}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:mob?4:3,flex:1}}>
          {wd.map((dk,i)=>{const mins=dt[dk]||0;const fire=mins>=120;const isT=dk===tk;const has=mins>0;const miss=isPastDate(dk)&&!fire&&dk>=wd[0];
            return(<div key={dk} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,flex:1}}>
              <span style={{fontSize:mob?9:8,fontWeight:600,letterSpacing:"0.05em",color:isT?T.tx:T.tx4,textTransform:"uppercase"}}>{dl[i]}</span>
              <div style={{width:sz,height:sz,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",
                background:fire?T.btn:miss?T.miss:isT?T.bg3:"transparent",
                border:fire?"none":miss?"2px solid #E63946":has?`2px solid ${T.bd2}`:isT?`2px solid ${T.tx4}`:`2px solid ${T.bd}`,
                color:fire?T.btnT:miss?"#E63946":T.tx3,
                fontSize:fire?(mob?16:14):miss?(mob?14:12):(mob?10:9),fontWeight:700,transition:"all 0.2s ease",
                boxShadow:fire?"0 1px 6px rgba(0,0,0,0.15)":"none"}}>
                {fire?"🔥":miss?"❌":has?formatHM(mins):"·"}
              </div>
            </div>);
          })}
        </div>
        <span style={{fontSize:mob?12:13,fontWeight:700,marginLeft:6,whiteSpace:"nowrap",color:T.tx}}>{formatHM(wt)}</span>
      </div>
      <div style={{borderTop:`1px solid ${T.bd2}`,marginTop:2,paddingTop:10}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:mob?11:12,fontWeight:700,flexWrap:"wrap",gap:6}}>
        <span style={{color:tc}}>📖 {formatHM(tm)} today</span>
        <span style={{color:mc}}>⏳ {hl}h {mL}m left</span>
        {et?(<span style={{display:"flex",alignItems:"center",gap:4}}>
          <input type="date" value={tt} onChange={e=>setTt(e.target.value)} style={{border:`1px solid ${T.bd2}`,padding:"3px 5px",fontSize:10,fontFamily:F,outline:"none",background:T.bg,color:T.tx}}/>
          <button onClick={saveT} style={{border:"none",background:T.btn,color:T.btnT,padding:"3px 7px",fontSize:9,fontFamily:F,fontWeight:700,cursor:"pointer",borderRadius:4}}>Set</button>
        </span>):(<span onDoubleClick={()=>{setTt(td||tk);setEt(true);}} style={{color:"#6A4C93",cursor:"pointer"}} title="Double-click to set target date">{td?`🎯 ${tTxt}`:"🎯 Set goal"}</span>)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// ─── SIDEBAR ───
// ═══════════════════════════════════════════
function Sidebar({open,onClose,page,setPage,sessions,onLogout,isDark,onToggleTheme}){
  const T=useT();
  const items=[{key:PAGES.HABITS,label:"Habits",icon:"🔥"},{key:PAGES.TIMER,label:"Timer",icon:"⏱"},{key:PAGES.TASKS,label:"Tasks",icon:"✅"},{key:PAGES.GOALS,label:"Goals",icon:"🎯"},{key:PAGES.ANALYSIS,label:"Analysis",icon:"📊"},{key:PAGES.CALENDAR,label:"Calendar",icon:"📅"},{key:PAGES.REFLECTION,label:"Reflect",icon:"💭"},{key:PAGES.SLEEP,label:"Sleep",icon:"🌙"}];
  const now=nowIST();const ys=String(now.getFullYear());const mn=now.toLocaleDateString("en-US",{month:"short"});
  const yMins=sessions.filter(s=>s.date.startsWith(ys)).reduce((a,s)=>a+s.duration,0);
  const mp=`${ys}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const mMins=sessions.filter(s=>s.date.startsWith(mp)).reduce((a,s)=>a+s.duration,0);
  return(<>
    <div onClick={onClose} style={{position:"fixed",inset:0,background:T.over,zIndex:2000,opacity:open?1:0,pointerEvents:open?"auto":"none",transition:"opacity 0.3s ease"}}/>
    <div style={{position:"fixed",top:0,left:0,bottom:0,width:260,zIndex:2001,background:T.side,boxShadow:T.sideSh,transform:open?"translateX(0)":"translateX(-100%)",transition:"transform 0.3s ease",display:"flex",flexDirection:"column",fontFamily:F}}>
      <div style={{padding:"24px 20px 16px",borderBottom:`1px solid ${T.bd}`}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <span style={{fontSize:18,fontWeight:800,letterSpacing:"-0.02em",color:T.tx}}>Focus Maxing</span>
          <button onClick={onClose} style={{border:"none",background:"none",cursor:"pointer",fontSize:20,color:T.tx3,padding:0}}>✕</button>
        </div>
        <div style={{display:"flex",gap:16,fontSize:12}}>
          <div><div style={{fontSize:16,fontWeight:700,color:T.tx}}>{formatHM(mMins)}</div><div style={{color:T.tx3,fontSize:10,textTransform:"uppercase",letterSpacing:"0.08em"}}>{mn}</div></div>
          <div><div style={{fontSize:16,fontWeight:700,color:T.tx}}>{formatHM(yMins)}</div><div style={{color:T.tx3,fontSize:10,textTransform:"uppercase",letterSpacing:"0.08em"}}>{ys}</div></div>
        </div>
      </div>
      <div style={{flex:1,padding:"12px 0",overflowY:"auto"}}>
        {items.map(i=>{const a=page===i.key;return(
          <button key={i.key} onClick={()=>{setPage(i.key);onClose();}} style={{display:"flex",alignItems:"center",gap:12,width:"100%",padding:"14px 24px",border:"none",cursor:"pointer",background:a?T.bgH:"transparent",color:T.tx,fontSize:14,fontWeight:a?700:500,fontFamily:F,textAlign:"left",transition:"background 0.15s ease",borderLeft:a?`3px solid ${T.tx}`:"3px solid transparent"}}>
            <span style={{fontSize:18}}>{i.icon}</span><span>{i.label}</span>
          </button>);})}
      </div>
      <div style={{padding:"16px 20px",borderTop:`1px solid ${T.bd}`,display:"flex",flexDirection:"column",gap:12}}>
        <ThemeToggle isDark={isDark} onToggle={onToggleTheme}/>
        <button onClick={onLogout} style={{width:"100%",padding:"10px 0",border:`1px solid ${T.bd2}`,background:"transparent",cursor:"pointer",fontSize:11,fontFamily:F,fontWeight:700,color:T.tx3,letterSpacing:"0.06em",textTransform:"uppercase",borderRadius:6}}>Logout</button>
      </div>
    </div>
  </>);
}

// ═══════════════════════════════════════════
// ─── AUTH ───
// ═══════════════════════════════════════════
function AuthPage({onAuth}){
  const T=useT();const[isLogin,setIsLogin]=useState(true);const[email,setEmail]=useState("");const[pw,setPw]=useState("");const[error,setError]=useState("");const[loading,setLoading]=useState(false);const[confirmSent,setConfirmSent]=useState(false);const[resetSent,setResetSent]=useState(false);
  const submit=async()=>{setError("");if(!email.trim()||!pw.trim()){setError("Email and password required");return;}if(pw.length<6){setError("Password must be at least 6 characters");return;}setLoading(true);try{if(isLogin){const{error:e}=await supabase.auth.signInWithPassword({email,password:pw});if(e)throw e;}else{const{error:e}=await supabase.auth.signUp({email,password:pw});if(e)throw e;setConfirmSent(true);setLoading(false);return;}}catch(e){setError(e.message||"Something went wrong");}setLoading(false);};
  const forgot=async()=>{setError("");if(!email.trim()){setError("Enter your email first");return;}setLoading(true);try{const{error:e}=await supabase.auth.resetPasswordForEmail(email);if(e)throw e;setResetSent(true);}catch(e){setError(e.message);}setLoading(false);};
  const msgScreen=(icon,title,msg,btnText,onClick)=>(
    <div style={{maxWidth:400,margin:"0 auto",padding:"120px 24px",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:F,background:T.bg}}>
      <div style={{fontSize:48,marginBottom:16}}>{icon}</div>
      <div style={{fontSize:18,fontWeight:700,marginBottom:8,textAlign:"center",color:T.tx}}>{title}</div>
      <div style={{fontSize:13,color:T.tx2,textAlign:"center",lineHeight:1.6,marginBottom:24}}>{msg} <strong>{email}</strong>.</div>
      <button onClick={onClick} style={{border:`2px solid ${T.bd3}`,background:T.btn,color:T.btnT,padding:"12px 32px",fontSize:13,fontFamily:F,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",cursor:"pointer"}}>{btnText}</button>
    </div>
  );
  if(resetSent)return msgScreen("🔑","Reset link sent","We sent a password reset link to","Back to Login",()=>{setResetSent(false);setIsLogin(true);});
  if(confirmSent)return msgScreen("✉️","Check your email","We sent a confirmation link to","Back to Login",()=>{setConfirmSent(false);setIsLogin(true);});
  const iStyle={width:"100%",border:`2px solid ${T.bd3}`,padding:"14px 16px",fontSize:14,fontFamily:F,background:"transparent",outline:"none",fontWeight:600,boxSizing:"border-box",color:T.tx};
  return(
    <div style={{maxWidth:400,margin:"0 auto",padding:"80px 24px",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:F,background:T.bg}}>
      <div style={{marginBottom:40,textAlign:"center"}}>
        <div style={{fontSize:32,fontWeight:800,letterSpacing:"-0.02em",marginBottom:4,color:T.tx}}>Focus Maxing</div>
        <div style={{fontSize:12,color:T.tx3,textTransform:"uppercase",letterSpacing:"0.15em",fontWeight:600}}>Track your upskilling</div>
      </div>
      <div style={{width:"100%",maxWidth:320}}>
        <div style={{display:"flex",marginBottom:32,borderBottom:`2px solid ${T.bd3}`}}>
          {["Login","Sign Up"].map((l,i)=>{const a=i===0?isLogin:!isLogin;return(<button key={l} onClick={()=>{setIsLogin(i===0);setError("");}} style={{flex:1,padding:"12px 0",border:"none",cursor:"pointer",background:a?T.btn:"transparent",color:a?T.btnT:T.tx,fontSize:12,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",fontFamily:F,transition:"all 0.2s ease"}}>{l}</button>);})}
        </div>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email" autoComplete="email" name="email" onKeyDown={e=>e.key==="Enter"&&submit()} style={{...iStyle,marginBottom:12}}/>
        <input value={pw} onChange={e=>setPw(e.target.value)} placeholder="Password" type="password" autoComplete={isLogin?"current-password":"new-password"} name="password" onKeyDown={e=>e.key==="Enter"&&submit()} style={{...iStyle,marginBottom:8}}/>
        {isLogin&&(<div style={{textAlign:"right",marginBottom:4}}><button onClick={forgot} style={{border:"none",background:"none",cursor:"pointer",fontSize:11,fontFamily:F,fontWeight:600,color:T.tx3,textDecoration:"underline",textUnderlineOffset:3,padding:0}}>Forgot Password?</button></div>)}
        {error&&(<div style={{fontSize:12,color:"#E63946",fontFamily:F,fontWeight:600,padding:"8px 0",textAlign:"center"}}>{error}</div>)}
        <button onClick={submit} disabled={loading} style={{width:"100%",padding:"14px 0",border:`2px solid ${T.bd3}`,background:T.btn,color:T.btnT,fontSize:13,fontFamily:F,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",cursor:loading?"default":"pointer",marginTop:16,opacity:loading?0.5:1}}>{loading?"...":isLogin?"Login":"Create Account"}</button>
      </div>
      <div style={{marginTop:60,fontSize:12,color:T.tx4,fontFamily:F,textAlign:"center"}}>Vibe coded by Nithin Chowdary ❤️</div>
    </div>
  );
}

// ═══════════════════════════════════════════
// ─── HABITS PAGE ───
// ═══════════════════════════════════════════
const HABIT_ICONS = ["🎯","📚","💪","🏃","🧘","💧","🥗","😴","☕","🧠","✍️","🎨","🎵","💻","🌱","⚡","🔥","🌟","📖","🏋️","🚴","🧗","🏊","🧹","📝","🎧","🌞","🙏","💰","📅"];

function HabitsPage({habits,setHabits,habitLogs,setHabitLogs}){
  const T=useT();const w=useWindowWidth();const mob=w<480;
  const[showAdd,setShowAdd]=useState(false);
  const[nName,setNName]=useState("");const[nIcon,setNIcon]=useState("🎯");const[nDays,setNDays]=useState("");const[nStart,setNStart]=useState(todayStr());

  const addHabit=async()=>{
    const days=parseInt(nDays);
    if(!nName.trim()||isNaN(days)||days<=0||!nStart)return;
    const sv=await insertHabit(nName.trim(),nIcon,days,nStart);
    if(sv){setHabits(p=>[...p,sv]);setShowAdd(false);setNName("");setNIcon("🎯");setNDays("");setNStart(todayStr());}
  };

  const delHabit=async(id)=>{
    if(!window.confirm("Delete this habit? All check-ins will be lost."))return;
    await deleteHabitDB(id);
    setHabits(p=>p.filter(h=>h.id!==id));
    setHabitLogs(p=>p.filter(l=>l.habit_id!==id));
  };

  const toggleToday=async(habitId)=>{
    const today=todayStr();
    const existing=habitLogs.find(l=>l.habit_id===habitId&&l.date===today);
    const result=await toggleHabitLog(habitId,today,!!existing);
    if(existing){setHabitLogs(p=>p.filter(l=>!(l.habit_id===habitId&&l.date===today)));}
    else if(result){setHabitLogs(p=>[...p,result]);}
  };

  const getHabitStats=(habit)=>{
    const logs=habitLogs.filter(l=>l.habit_id===habit.id);
    const logDates=new Set(logs.map(l=>l.date));
    const today=todayStr();
    const start=new Date(habit.start_date+"T12:00:00");
    const todayDate=new Date(today+"T12:00:00");
    const dayNum=Math.max(1,Math.floor((todayDate-start)/86400000)+1);
    const doneToday=logDates.has(today);

    let streak=0;
    const d=new Date(todayDate);
    if(doneToday){streak=1;d.setDate(d.getDate()-1);}
    else{d.setDate(d.getDate()-1);}
    while(d>=start){
      if(logDates.has(dateToStr(d))){streak++;d.setDate(d.getDate()-1);}
      else break;
    }

    let best=0,cur=0;
    const allDates=[...logDates].sort();
    for(let i=0;i<allDates.length;i++){
      if(i===0){cur=1;}
      else{
        const prev=new Date(allDates[i-1]+"T12:00:00");
        const curD=new Date(allDates[i]+"T12:00:00");
        if((curD-prev)===86400000)cur++;
        else cur=1;
      }
      if(cur>best)best=cur;
    }

    return{dayNum,totalDone:logs.length,streak,best,doneToday,logDates};
  };

  const renderHeatmap=(habit,logDates)=>{
    const now=nowIST();const y=now.getFullYear();const m=now.getMonth();
    const dim=new Date(y,m+1,0).getDate();
    const firstDow=(new Date(y,m,1).getDay()+6)%7;
    const cells=[];
    for(let i=0;i<firstDow;i++)cells.push(null);
    for(let d=1;d<=dim;d++)cells.push(d);
    while(cells.length%7!==0)cells.push(null);
    const tk=todayStr();
    const start=habit.start_date;
    return(
      <div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7, 1fr)",gap:4,marginBottom:4}}>
          {["M","T","W","T","F","S","S"].map((d,i)=>(<div key={i} style={{textAlign:"center",fontSize:9,fontWeight:700,color:T.tx3,letterSpacing:"0.05em"}}>{d}</div>))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7, 1fr)",gap:4}}>
          {cells.map((day,i)=>{
            if(day===null)return<div key={`e${i}`} style={{aspectRatio:"1"}}/>;
            const k=`${y}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const done=logDates.has(k);
            const isFuture=k>tk;
            const beforeStart=k<start;
            const isToday=k===tk;
            let bg=T.bg3,color=T.tx3;
            if(beforeStart){bg="transparent";color=T.tx4;}
            else if(done){bg="#2A9D8F";color="#fff";}
            else if(isFuture){bg=T.bg3;color=T.tx4;}
            else{bg=T.rR;color="#E63946";}
            return(
              <div key={i} style={{aspectRatio:"1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:mob?11:12,fontWeight:isToday?800:600,background:bg,color,borderRadius:4,border:isToday?`2px solid ${T.bd3}`:"none"}}>{day}</div>
            );
          })}
        </div>
      </div>
    );
  };

  const iStyle={border:`2px solid ${T.bd3}`,padding:"10px 14px",fontSize:14,fontFamily:F,background:"transparent",outline:"none",boxSizing:"border-box",color:T.tx};
  const monthLabel=nowIST().toLocaleDateString("en-US",{month:"long",year:"numeric"});

  return(
    <div style={{fontFamily:F}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,gap:10,flexWrap:"wrap"}}>
        <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,fontWeight:600}}>🔥 Habit Streaks</div>
        <button onClick={()=>setShowAdd(!showAdd)} style={{padding:"10px 18px",border:`2px solid ${T.bd3}`,background:showAdd?"transparent":T.btn,color:showAdd?T.tx:T.btnT,fontSize:12,fontFamily:F,fontWeight:700,cursor:"pointer"}}>{showAdd?"✕":"+ New Habit"}</button>
      </div>

      {showAdd&&(
        <div style={{background:T.bg2,borderRadius:10,padding:mob?16:20,marginBottom:24,border:`1px solid ${T.bd}`}}>
          <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:"0.12em",color:T.tx3,fontWeight:600,marginBottom:14}}>Create New Habit</div>
          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
            <div style={{width:56,height:56,border:`2px solid ${T.bd3}`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}>{nIcon}</div>
            <input value={nName} onChange={e=>setNName(e.target.value)} placeholder="Habit name (e.g. Study 3h/day)" style={{...iStyle,flex:1,minWidth:180}}/>
          </div>
          <div style={{fontSize:10,color:T.tx3,fontWeight:600,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.1em"}}>Icon</div>
          <div style={{display:"grid",gridTemplateColumns:mob?"repeat(8, 1fr)":"repeat(15, 1fr)",gap:4,marginBottom:14}}>
            {HABIT_ICONS.map(ic=>(<button key={ic} onClick={()=>setNIcon(ic)} style={{aspectRatio:"1",border:`2px solid ${nIcon===ic?T.bd3:T.bd}`,background:nIcon===ic?T.bg3:"transparent",cursor:"pointer",fontSize:18,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>{ic}</button>))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:10,marginBottom:14}}>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <label style={{fontSize:10,color:T.tx3,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em"}}>Target Days</label>
              <input value={nDays} onChange={e=>setNDays(e.target.value)} placeholder="e.g. 220" type="number" style={iStyle}/>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <label style={{fontSize:10,color:T.tx3,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em"}}>Start Date</label>
              <input value={nStart} onChange={e=>setNStart(e.target.value)} type="date" style={iStyle}/>
            </div>
          </div>
          <button onClick={addHabit} style={{padding:"10px 28px",border:`2px solid ${T.bd3}`,background:T.btn,color:T.btnT,fontSize:12,fontFamily:F,fontWeight:700,cursor:"pointer",letterSpacing:"0.06em",textTransform:"uppercase"}}>Create Habit</button>
        </div>
      )}

      {habits.length===0&&!showAdd&&(
        <div style={{textAlign:"center",padding:"60px 20px",color:T.tx4,fontSize:14}}>
          <div style={{fontSize:48,marginBottom:16}}>🔥</div>
          <div style={{fontWeight:700,color:T.tx3,marginBottom:8}}>No habits yet</div>
          <div>Build consistency — create your first habit</div>
        </div>
      )}

      {habits.map(habit=>{
        const s=getHabitStats(habit);
        const progressPct=Math.min((s.totalDone/habit.target_days)*100,100);
        return(
          <div key={habit.id} style={{background:T.bg2,borderRadius:12,padding:mob?16:20,marginBottom:16,border:`1px solid ${T.bd}`}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
              <div style={{width:48,height:48,borderRadius:10,background:T.bg3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>{habit.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:mob?15:16,fontWeight:800,color:T.tx,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{habit.name}</div>
                <div style={{fontSize:11,color:T.tx3,fontWeight:600}}>Day {s.dayNum} of {habit.target_days} · {s.totalDone} done</div>
              </div>
              <button onClick={()=>delHabit(habit.id)} style={{border:"none",background:"none",cursor:"pointer",color:T.tx4,fontSize:18,padding:4,flexShrink:0}} title="Delete">✕</button>
            </div>

            <div style={{height:6,background:T.bg3,borderRadius:3,overflow:"hidden",marginBottom:14}}>
              <div style={{height:"100%",width:`${progressPct}%`,background:"#2A9D8F",transition:"width 0.4s ease"}}/>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
              <div style={{textAlign:"center",padding:"8px",background:T.bg3,borderRadius:6}}>
                <div style={{fontSize:20,fontWeight:800,color:s.streak>0?"#E63946":T.tx4}}>{s.streak>0?"🔥":""}{s.streak}</div>
                <div style={{fontSize:9,color:T.tx3,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>Streak</div>
              </div>
              <div style={{textAlign:"center",padding:"8px",background:T.bg3,borderRadius:6}}>
                <div style={{fontSize:20,fontWeight:800,color:T.tx}}>{s.best}</div>
                <div style={{fontSize:9,color:T.tx3,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>Best</div>
              </div>
              <div style={{textAlign:"center",padding:"8px",background:T.bg3,borderRadius:6}}>
                <div style={{fontSize:20,fontWeight:800,color:"#2A9D8F"}}>{Math.round(progressPct)}%</div>
                <div style={{fontSize:9,color:T.tx3,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>Complete</div>
              </div>
            </div>

            <button onClick={()=>toggleToday(habit.id)} style={{width:"100%",padding:"12px",border:`2px solid ${s.doneToday?"#2A9D8F":T.bd3}`,background:s.doneToday?"#2A9D8F":T.btn,color:s.doneToday?"#fff":T.btnT,fontSize:13,fontFamily:F,fontWeight:700,cursor:"pointer",letterSpacing:"0.06em",textTransform:"uppercase",borderRadius:8,marginBottom:16,transition:"all 0.2s ease"}}>
              {s.doneToday?"✓ Done Today":"Mark Today Done"}
            </button>

            <div style={{fontSize:10,color:T.tx3,fontWeight:600,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.1em"}}>{monthLabel}</div>
            {renderHeatmap(habit,s.logDates)}
          </div>
        );
      })}
    </div>
  );
}

// ─── Timer Page ───
function TimerPage({sessions,setSessions}){
  const T=useT();const w=useWindowWidth();const mob=w<480;
  const[tag,setTag]=useState(()=>sessionStorage.getItem("sl_tag")||"");
  const[running,setRunning]=useState(()=>sessionStorage.getItem("sl_running")==="true");
  const[elapsed,setElapsed]=useState(()=>{const st=sessionStorage.getItem("sl_startTs");const wr=sessionStorage.getItem("sl_running")==="true";if(wr&&st)return Math.floor((Date.now()-Number(st))/1000);const sv=sessionStorage.getItem("sl_elapsed");return sv?Number(sv):0;});
  const[mode,setMode]=useState(()=>sessionStorage.getItem("sl_mode")||"focus");
  const[focusMins,setFocusMins]=useState(()=>Number(sessionStorage.getItem("sl_focusMins"))||60);
  const[breakMins,setBreakMins]=useState(()=>Number(sessionStorage.getItem("sl_breakMins"))||5);
  const[editing,setEditing]=useState(false);const[tempFocus,setTempFocus]=useState("25");const[tempBreak,setTempBreak]=useState("5");
  const focusDur=focusMins*60;const breakDur=breakMins*60;const intervalRef=useRef(null);const startTimeRef=useRef(null);const loggedRef=useRef(false);
  const[editSessId,setEditSessId]=useState(null);const[editSessTag,setEditSessTag]=useState("");
  useEffect(()=>{sessionStorage.setItem("sl_tag",tag);},[tag]);
  useEffect(()=>{sessionStorage.setItem("sl_mode",mode);},[mode]);
  useEffect(()=>{sessionStorage.setItem("sl_focusMins",String(focusMins));},[focusMins]);
  useEffect(()=>{sessionStorage.setItem("sl_breakMins",String(breakMins));},[breakMins]);
  useEffect(()=>{sessionStorage.setItem("sl_running",String(running));if(running){sessionStorage.setItem("sl_startTs",String(Date.now()-elapsed*1000));}else{sessionStorage.setItem("sl_elapsed",String(elapsed));sessionStorage.removeItem("sl_startTs");}},[running,elapsed]);
  const openEdit=()=>{setTempFocus(String(focusMins));setTempBreak(String(breakMins));setEditing(true);};
  const saveEdit=()=>{const f=parseInt(tempFocus);const b=parseInt(tempBreak);if(f>0)setFocusMins(f);if(b>0)setBreakMins(b);setElapsed(0);setRunning(false);loggedRef.current=false;setEditing(false);};
  const remaining=mode==="focus"?Math.max(focusDur-elapsed,0):Math.max(breakDur-elapsed,0);
  const total=mode==="focus"?focusDur:breakDur;const progress=1-remaining/total;
  useEffect(()=>{if(running){startTimeRef.current=Date.now()-elapsed*1000;intervalRef.current=setInterval(()=>{setElapsed(Math.floor((Date.now()-startTimeRef.current)/1000));},200);}else{clearInterval(intervalRef.current);}return()=>clearInterval(intervalRef.current);},[running]);
  useEffect(()=>{const h=()=>{if(document.visibilityState==="visible"){const st=sessionStorage.getItem("sl_startTs");const wr=sessionStorage.getItem("sl_running")==="true";if(wr&&st){setElapsed(Math.floor((Date.now()-Number(st))/1000));startTimeRef.current=Number(st);}}};document.addEventListener("visibilitychange",h);return()=>document.removeEventListener("visibilitychange",h);},[]);
  const addSession=useCallback(async(ns)=>{setSessions(p=>[...p,ns]);const sv=await insertSession(ns);if(sv){setSessions(p=>p.map(s=>s.ts===ns.ts&&s.tag===ns.tag?{id:sv.id,tag:sv.tag,duration:sv.duration,date:sv.date,ts:Number(sv.ts)}:s));}},[setSessions]);
  useEffect(()=>{if(remaining<=0&&running){setRunning(false);playBell();loggedRef.current=true;if("Notification"in window&&Notification.permission==="granted"){try{new Notification("Focus Maxing",{body:mode==="focus"?`${tag||"Focus"} session complete!`:"Break over!",icon:"🔥"});}catch(e){}}if(mode==="focus"){addSession({id:Date.now(),tag:tag||"Untitled",duration:Math.round(focusDur/60),date:todayStr(),ts:Date.now()});setMode("break");setElapsed(0);}else{setMode("focus");setElapsed(0);}}},[remaining,running]);
  const toggle=()=>{if(!running){initBell();playStartPop();loggedRef.current=false;if("Notification"in window&&Notification.permission==="default")Notification.requestPermission();}else playStopPop();setRunning(!running);};
  const reset=()=>{clearInterval(intervalRef.current);setRunning(false);if(!loggedRef.current&&mode==="focus"&&elapsed>=60){const mins=Math.max(1,Math.round(elapsed/60));addSession({id:Date.now(),tag:tag||"Untitled",duration:mins,date:todayStr(),ts:Date.now()});loggedRef.current=true;}setElapsed(0);sessionStorage.setItem("sl_elapsed","0");sessionStorage.removeItem("sl_startTs");};
  const skip=()=>{clearInterval(intervalRef.current);setRunning(false);if(!loggedRef.current&&mode==="focus"){const mins=Math.max(1,Math.round(elapsed/60));if(elapsed>30){addSession({id:Date.now(),tag:tag||"Untitled",duration:mins,date:todayStr(),ts:Date.now()});loggedRef.current=true;}setMode("break");}else setMode("focus");setElapsed(0);sessionStorage.setItem("sl_elapsed","0");sessionStorage.removeItem("sl_startTs");};
  const[mTag,setMTag]=useState("");const[mMins,setMMins]=useState("");
  const logManual=()=>{const mins=parseInt(mMins);if(!mTag.trim()||isNaN(mins)||mins<=0)return;addSession({id:Date.now(),tag:mTag.trim(),duration:mins,date:todayStr(),ts:Date.now()});setMTag("");setMMins("");};
  const tSess=sessions.filter(s=>s.date===todayStr());const tTotal=tSess.reduce((a,s)=>a+s.duration,0);
  const cSz=mob?200:220;const cR=mob?80:90;const cC=2*Math.PI*cR;
  const iStyle={border:`2px solid ${T.bd3}`,padding:"10px 14px",fontSize:14,fontFamily:F,background:"transparent",outline:"none",boxSizing:"border-box",color:T.tx};
  const renameSession=async(s,newTag)=>{if(!newTag.trim()||newTag.trim()===s.tag){setEditSessId(null);return;}await updateSessionTag(s.id,newTag.trim());setSessions(p=>p.map(x=>x.id===s.id?{...x,tag:newTag.trim()}:x));setEditSessId(null);};
  return(
    <div>
      <div style={{textAlign:"center",marginBottom:30}}>
        <input value={tag} onChange={e=>setTag(e.target.value)} placeholder="What are you studying?" style={{border:"none",borderBottom:`2px solid ${T.bd3}`,background:"transparent",fontSize:mob?16:18,fontFamily:F,textAlign:"center",padding:"8px 16px",width:"80%",maxWidth:340,outline:"none",fontWeight:600,color:T.tx}}/>
      </div>
      {editing?(
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:24,fontFamily:F,flexWrap:"wrap"}}>
          <label style={{fontSize:12,color:T.tx2}}>Focus</label>
          <input value={tempFocus} onChange={e=>setTempFocus(e.target.value)} type="number" style={{width:56,border:`2px solid ${T.bd3}`,padding:"6px 8px",fontSize:14,fontFamily:"inherit",textAlign:"center",background:"transparent",outline:"none",color:T.tx}}/>
          <label style={{fontSize:12,color:T.tx2}}>Break</label>
          <input value={tempBreak} onChange={e=>setTempBreak(e.target.value)} type="number" style={{width:56,border:`2px solid ${T.bd3}`,padding:"6px 8px",fontSize:14,fontFamily:"inherit",textAlign:"center",background:"transparent",outline:"none",color:T.tx}}/>
          <span style={{fontSize:11,color:T.tx3}}>min</span>
          <button onClick={saveEdit} style={{border:`2px solid ${T.bd3}`,background:T.btn,color:T.btnT,padding:"6px 14px",fontSize:12,fontFamily:"inherit",fontWeight:700,cursor:"pointer"}}>Set</button>
          <button onClick={()=>setEditing(false)} style={{border:`2px solid ${T.bd2}`,background:"transparent",color:T.tx3,padding:"6px 10px",fontSize:12,fontFamily:"inherit",cursor:"pointer"}}>✕</button>
        </div>
      ):(
        <div style={{textAlign:"center",marginBottom:20}}>
          <button onClick={openEdit} style={{border:"none",background:"none",cursor:"pointer",fontFamily:F,fontSize:12,color:T.tx3,textDecoration:"underline",textUnderlineOffset:3}}>⚙ {focusMins}m focus / {breakMins}m break</button>
        </div>
      )}
      <div style={{display:"flex",justifyContent:"center",marginBottom:24}}>
        <div style={{position:"relative",width:cSz,height:cSz}}>
          <svg width={cSz} height={cSz} style={{transform:"rotate(-90deg)"}}>
            <circle cx={cSz/2} cy={cSz/2} r={cR} fill="none" stroke={T.bd} strokeWidth={6}/>
            <circle cx={cSz/2} cy={cSz/2} r={cR} fill="none" stroke={mode==="focus"?T.bd3:T.tx3} strokeWidth={6} strokeLinecap="round" strokeDasharray={cC} strokeDashoffset={cC*(1-progress)} style={{transition:"stroke-dashoffset 0.3s ease"}}/>
          </svg>
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
            <div style={{fontSize:11,fontFamily:F,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,marginBottom:4,fontWeight:600}}>{mode==="focus"?"Focus":"Break"}</div>
            <div style={{fontSize:mob?36:42,fontFamily:F,fontWeight:700,letterSpacing:"-0.02em",color:T.tx}}>{formatTime(remaining)}</div>
          </div>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"center",gap:mob?8:12,marginBottom:40,flexWrap:"wrap"}}>
        <button onClick={toggle} style={{padding:mob?"10px 28px":"12px 36px",border:`2px solid ${T.bd3}`,cursor:"pointer",background:running?"transparent":T.btn,color:running?T.tx:T.btnT,fontSize:13,fontFamily:F,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",transition:"all 0.2s"}}>{running?"Pause":"Start"}</button>
        <button onClick={reset} style={{padding:mob?"10px 16px":"12px 20px",border:`2px solid ${T.bd2}`,cursor:"pointer",background:"transparent",color:T.tx3,fontSize:13,fontFamily:F,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase"}}>Reset</button>
        <button onClick={skip} style={{padding:mob?"10px 16px":"12px 20px",border:`2px solid ${T.bd2}`,cursor:"pointer",background:"transparent",color:T.tx3,fontSize:13,fontFamily:F,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase"}}>Skip</button>
      </div>
      <div style={{borderTop:`1px solid ${T.bd}`,margin:"0 0 30px"}}/>
      <div style={{marginBottom:36}}>
        <div style={{fontSize:11,fontFamily:F,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,marginBottom:12,fontWeight:600}}>Quick Log</div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <input value={mTag} onChange={e=>setMTag(e.target.value)} placeholder="Tag" style={{...iStyle,flex:1,minWidth:100}}/>
          <input value={mMins} onChange={e=>setMMins(e.target.value)} placeholder="mins" type="number" style={{...iStyle,width:80}}/>
          <button onClick={logManual} style={{padding:"10px 20px",border:`2px solid ${T.bd3}`,background:T.btn,color:T.btnT,fontSize:13,fontFamily:F,fontWeight:700,cursor:"pointer"}}>+</button>
        </div>
      </div>
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:14}}>
          <span style={{fontSize:11,fontFamily:F,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,fontWeight:600}}>Today's Sessions</span>
          <span style={{fontSize:14,fontFamily:F,fontWeight:700,color:T.tx}}>{formatHM(tTotal)} {tTotal>=120&&"🔥"}</span>
        </div>
        {tSess.length===0&&(<div style={{color:T.tx4,fontFamily:F,fontSize:13,padding:"20px 0",textAlign:"center"}}>No sessions yet. Start studying!</div>)}
        {tSess.map(s=>(<div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${T.bd}`,fontFamily:F,fontSize:14}}>
          {editSessId===s.id?(
            <input autoFocus value={editSessTag} onChange={e=>setEditSessTag(e.target.value)} onBlur={()=>renameSession(s,editSessTag)} onKeyDown={e=>{if(e.key==="Enter")renameSession(s,editSessTag);if(e.key==="Escape")setEditSessId(null);}} style={{border:"none",borderBottom:`2px solid ${T.bd3}`,background:"transparent",fontSize:14,fontFamily:F,fontWeight:600,outline:"none",color:T.tx,padding:"2px 0",flex:1,marginRight:8}}/>
          ):(
            <span onClick={()=>{setEditSessId(s.id);setEditSessTag(s.tag);}} style={{fontWeight:600,color:T.tx,cursor:"pointer"}} title="Click to rename">{s.tag}</span>
          )}
          <span style={{color:T.tx3}}>{formatHM(s.duration)}</span>
        </div>))}
      </div>
      <div style={{marginTop:48,padding:"14px 20px",borderRadius:12,background:T.ftBg,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontSize:13,fontWeight:600,color:T.ftC,letterSpacing:"0.01em"}}>Vibe coded by Nithin Chowdary <span style={{color:"#E53E3E",fontSize:15}}>❤️</span></span>
      </div>
    </div>
  );
}

// ─── Tasks Page ───
function TasksPage({tasks,setTasks}){
  const T=useT();const[selectedDate,setSelectedDate]=useState(todayStr());const[newTask,setNewTask]=useState("");const w=useWindowWidth();const mob=w<480;
  const isToday=selectedDate===todayStr();const shiftDate=(dir)=>{const d=new Date(selectedDate+"T12:00:00");d.setDate(d.getDate()+dir);setSelectedDate(dateToStr(d));};
  const dateLabel=isToday?"Today":new Date(selectedDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
  const dayTasks=tasks.filter(t=>t.date===selectedDate&&!t.time_slot);const dayPlannerTasks=tasks.filter(t=>t.date===selectedDate&&t.time_slot);
  const addTask=async()=>{if(!newTask.trim())return;const sv=await insertTask(newTask.trim(),selectedDate,null);if(sv)setTasks(p=>[...p,sv]);setNewTask("");};
  const toggleComplete=async(task)=>{const nv=task.completed_date?null:todayStr();await updateTaskCompleted(task.id,nv);setTasks(p=>p.map(t=>t.id===task.id?{...t,completed_date:nv}:t));};
  const removeTask=async(taskId)=>{await deleteTask(taskId);setTasks(p=>p.filter(t=>t.id!==taskId));};
  const slots=[];for(let h=4;h<=23;h++){const fmt=(hr)=>{if(hr===0)return"12 AM";if(hr<12)return`${hr} AM`;if(hr===12)return"12 PM";return`${hr-12} PM`;};slots.push({label:`${fmt(h)} – ${fmt(h+1>23?0:h+1)}`,key:`${h}-${h+1}`});}
  const addPlannerTask=async(slotKey,title)=>{if(!title.trim())return;if(dayPlannerTasks.find(t=>t.time_slot===slotKey))return;const sv=await insertTask(title.trim(),selectedDate,slotKey);if(sv)setTasks(p=>[...p,sv]);};
  const nb={border:"none",background:"none",fontSize:20,cursor:"pointer",color:T.tx};
  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:24,marginBottom:24,fontFamily:F}}>
        <button onClick={()=>shiftDate(-1)} style={nb}>←</button>
        <span style={{fontSize:16,fontWeight:700,minWidth:140,textAlign:"center",color:T.tx}}>{dateLabel}</span>
        <button onClick={()=>shiftDate(1)} style={nb}>→</button>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:24}}>
        <input value={newTask} onChange={e=>setNewTask(e.target.value)} placeholder="Add a task..." onKeyDown={e=>e.key==="Enter"&&addTask()} style={{flex:1,border:`2px solid ${T.bd3}`,padding:"12px 16px",fontSize:15,fontFamily:F,background:"transparent",outline:"none",fontWeight:600,boxSizing:"border-box",color:T.tx}}/>
        <button onClick={addTask} style={{padding:"12px 22px",border:`2px solid ${T.bd3}`,background:T.btn,color:T.btnT,fontSize:14,fontFamily:F,fontWeight:700,cursor:"pointer"}}>+</button>
      </div>
      <div style={{fontSize:11,fontFamily:F,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,marginBottom:10,fontWeight:600}}>Tasks ({dayTasks.filter(t=>t.completed_date).length}/{dayTasks.length})</div>
      {dayTasks.length===0&&(<div style={{color:T.tx4,fontFamily:F,fontSize:14,padding:"20px 0",textAlign:"center"}}>No tasks for this day</div>)}
      {dayTasks.map(t=>{const done=!!t.completed_date;return(
        <div key={t.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:`1px solid ${T.bd}`,fontFamily:F,fontSize:15}}>
          <button onClick={()=>toggleComplete(t)} style={{width:26,height:26,border:done?"none":`2px solid ${T.bd2}`,background:done?"#2A9D8F":"transparent",borderRadius:6,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:15,flexShrink:0}}>{done&&"✓"}</button>
          <span style={{flex:1,fontWeight:600,textDecoration:done?"line-through":"none",color:done?T.tx3:T.tx}}>{t.title}</span>
          <button onClick={()=>removeTask(t.id)} style={{border:"none",background:"none",cursor:"pointer",color:T.tx4,fontSize:18,padding:"0 4px"}}>✕</button>
        </div>);})}
      <div style={{marginTop:36}}>
        <div style={{fontSize:11,fontFamily:F,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,marginBottom:12,fontWeight:600}}>Day Planner</div>
        <div style={{border:`2px solid ${T.bd}`,borderRadius:6,overflow:"hidden"}}>
          {slots.map(slot=>{const st=dayPlannerTasks.find(t=>t.time_slot===slot.key);const done=st&&!!st.completed_date;const[slotStart]=slot.key.split("-").map(Number);const curHr=nowIST().getHours();const isCurSlot=(selectedDate===todayStr())&&curHr>=slotStart&&curHr<slotStart+1;return(
            <div key={slot.key} style={{display:"flex",borderBottom:`1px solid ${T.bd}`,fontFamily:F,minHeight:42,background:isCurSlot?"rgba(42,157,143,0.08)":"transparent"}}>
              <div style={{width:mob?90:120,padding:mob?"10px 8px":"10px 12px",background:T.bg3,fontWeight:600,color:T.tx2,flexShrink:0,display:"flex",alignItems:"center",fontSize:mob?11:13}}>{slot.label}</div>
              <div style={{flex:1,padding:"8px 12px",display:"flex",alignItems:"center",gap:10,minWidth:0}}>
                {st?(<>
                  <button onClick={()=>toggleComplete(st)} style={{width:22,height:22,border:done?"none":`2px solid ${T.bd2}`,background:done?"#2A9D8F":"transparent",borderRadius:5,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:13,flexShrink:0}}>{done&&"✓"}</button>
                  <span style={{flex:1,fontSize:14,fontWeight:600,textDecoration:done?"line-through":"none",color:done?T.tx3:T.tx,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{st.title}</span>
                  <button onClick={()=>removeTask(st.id)} style={{border:"none",background:"none",cursor:"pointer",color:T.tx4,fontSize:16,flexShrink:0}}>✕</button>
                </>):(<PlannerSlotInput slotKey={slot.key} onAdd={(title)=>addPlannerTask(slot.key,title)}/>)}
              </div>
            </div>);})}
        </div>
      </div>
    </div>
  );
}
function PlannerSlotInput({slotKey,onAdd}){const T=useT();const[v,setV]=useState("");return(<input value={v} onChange={e=>setV(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&v.trim()){onAdd(v.trim());setV("");}}} placeholder="+ add task" style={{border:"none",background:"transparent",fontSize:13,fontFamily:F,fontWeight:600,outline:"none",color:T.tx4,padding:"4px 0",width:"100%"}}/>);}

// ─── Chart components ───
const TAG_COLORS=["#E63946","#457B9D","#2A9D8F","#E9C46A","#F4A261","#6A4C93","#1982C4","#8AC926","#FF595E","#6D6875","#264653","#F77F00","#D62828","#023E8A","#606C38"];
function getTagColor(tag,allTags){return TAG_COLORS[allTags.indexOf(tag)%TAG_COLORS.length];}
function getWeekRange(ds){const d=new Date(ds+"T12:00:00");const m=new Date(d);m.setDate(d.getDate()-((d.getDay()+6)%7));const days=[];for(let i=0;i<7;i++){const dd=new Date(m);dd.setDate(m.getDate()+i);days.push(dateToStr(dd));}return days;}
function getMonthDates(y,m){const n=new Date(y,m+1,0).getDate();const dates=[];for(let d=1;d<=n;d++)dates.push(`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`);return dates;}
function SectionHeader({children}){const T=useT();return(<div style={{fontSize:11,fontFamily:F,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,marginBottom:14,fontWeight:600,marginTop:40}}>{children}</div>);}
function TagBarChart({sorted,allTags}){if(sorted.length===0)return null;const mx=sorted[0][1];const bH=160;return(<div style={{overflowX:"auto",paddingBottom:8}}><div style={{display:"flex",alignItems:"flex-end",gap:6,minWidth:sorted.length*50,height:bH+40,paddingTop:20}}>{sorted.map(([tag,mins])=>{const h=mx>0?(mins/mx)*bH:0;const c=getTagColor(tag,allTags);return(<div key={tag} style={{flex:1,minWidth:36,maxWidth:60,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:bH+40}}><span style={{fontSize:10,fontFamily:F,fontWeight:700,marginBottom:4,color:c}}>{formatHM(mins)}</span><div style={{width:"60%",height:h,background:c,borderRadius:"4px 4px 0 0",transition:"height 0.4s ease",minHeight:mins>0?6:0}}/><span style={{fontSize:9,fontFamily:F,marginTop:6,textAlign:"center",color:"#888",maxWidth:60,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%"}}>{tag}</span></div>);})}</div></div>);}
function PeriodBarChart({dates,sessions}){const T=useT();const dt=getDayTotals(sessions);const data=dates.map(d=>({date:d,mins:dt[d]||0}));const mx=Math.max(...data.map(d=>d.mins),1);const pk=Math.max(...data.map(d=>d.mins));const bH=140;const tot=data.reduce((a,d)=>a+d.mins,0);const act=data.filter(d=>d.mins>0).length;const avg=act>0?Math.round(tot/act):0;const isW=dates.length<=7;return(<div><div style={{display:"flex",gap:24,marginBottom:16,fontFamily:F,flexWrap:"wrap"}}>{[["Total",tot],["Peak",pk],["Avg/day",avg]].map(([l,v])=>(<div key={l}><div style={{fontSize:22,fontWeight:700,color:T.tx}}>{formatHM(v)}</div><div style={{fontSize:10,color:T.tx3,textTransform:"uppercase",letterSpacing:"0.1em"}}>{l}</div></div>))}</div><div style={{position:"relative",overflowX:"auto",paddingBottom:8}}><div style={{display:"flex",alignItems:"flex-end",gap:isW?8:2,minWidth:isW?dates.length*52:dates.length*16,height:bH+50,paddingTop:24,position:"relative"}}>{pk>0&&(<div style={{position:"absolute",top:24,left:0,right:0,height:bH,pointerEvents:"none"}}><div style={{position:"absolute",bottom:`${(pk/mx)*bH}px`,left:0,right:0,borderTop:"2px dashed #E63946",opacity:0.6}}/><span style={{position:"absolute",bottom:`${(pk/mx)*bH+4}px`,right:0,fontSize:9,color:"#E63946",fontFamily:F,fontWeight:700}}>PEAK {formatHM(pk)}</span></div>)}{data.map((d)=>{const h=mx>0?(d.mins/mx)*bH:0;const isP=d.mins===pk&&d.mins>0;const dl=isW?new Date(d.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short"}):String(new Date(d.date+"T12:00:00").getDate());return(<div key={d.date} style={{flex:1,minWidth:isW?40:10,maxWidth:isW?60:24,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:bH+50}}>{isW&&d.mins>0&&(<span style={{fontSize:10,fontFamily:F,fontWeight:600,marginBottom:3,color:isP?"#E63946":T.tx2}}>{formatHM(d.mins)}</span>)}<div style={{width:"60%",height:h,background:isP?"linear-gradient(180deg,#E63946,#FF6B6B)":getBarGradient(d.mins),borderRadius:"3px 3px 0 0",transition:"height 0.4s ease",minHeight:d.mins>0?4:2,position:"relative"}}>{isP&&(<div style={{position:"absolute",top:-16,left:"50%",transform:"translateX(-50%)",fontSize:12}}>⭐</div>)}</div><span style={{fontSize:isW?10:8,fontFamily:F,marginTop:4,color:isP?"#E63946":T.tx3,fontWeight:isP?700:400}}>{dl}</span></div>);})}</div></div><div style={{display:"flex",gap:16,marginTop:12,fontFamily:F,fontSize:10,color:T.tx3,flexWrap:"wrap"}}><span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,background:"#E63946",borderRadius:2,display:"inline-block"}}/> Peak / &lt;2h</span><span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,background:"#2A9D8F",borderRadius:2,display:"inline-block"}}/> 2h+</span><span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,background:"#0B6E4F",borderRadius:2,display:"inline-block"}}/> 4h+</span></div></div>);}

// ─── Excel Export ───
async function exportToExcel(sessions){const XLSX=await import("xlsx");const dm={};sessions.forEach(s=>{dm[s.date]=(dm[s.date]||0)+s.duration;});const dd=Object.entries(dm).sort((a,b)=>a[0].localeCompare(b[0])).map(([date,mins])=>({Date:date,Day:new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long"}),Hours:+(mins/60).toFixed(2),Status:mins>=120?"🔥":"❌"}));const wm={};Object.entries(dm).forEach(([date,mins])=>{const d=new Date(date+"T12:00:00");const m=new Date(d);m.setDate(d.getDate()-((d.getDay()+6)%7));const s=new Date(m);s.setDate(m.getDate()+6);const l=`${m.toLocaleDateString("en-US",{month:"short",day:"numeric"})} - ${s.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;wm[l]=(wm[l]||0)+mins;});const wd=Object.entries(wm).map(([w,m])=>({Week:w,Hours:+(m/60).toFixed(2)}));const mm={};Object.entries(dm).forEach(([date,mins])=>{const k=date.slice(0,7);mm[k]=(mm[k]||0)+mins;});const md=Object.entries(mm).sort((a,b)=>a[0].localeCompare(b[0])).map(([k,m])=>{const[y,mo]=k.split("-");return{Month:new Date(parseInt(y),parseInt(mo)-1).toLocaleDateString("en-US",{month:"long",year:"numeric"}),Hours:+(m/60).toFixed(2)};});const tm={};const tf={};sessions.forEach(s=>{tm[s.tag]=(tm[s.tag]||0)+s.duration;if(!tf[s.tag]||s.date<tf[s.tag])tf[s.tag]=s.date;});const td=Object.entries(tm).sort((a,b)=>b[1]-a[1]).map(([t,m])=>({Topic:t,Hours:+(m/60).toFixed(2),Started:tf[t]||""}));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(dd),"Day-wise");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(wd),"Week-wise");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(md),"Month-wise");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(td),"Topic-wise");XLSX.writeFile(wb,`FocusMaxing_Export_${todayStr()}.xlsx`);}

// ─── Goals Page ───
function GoalsPage({sessions,goals,setGoals}){
  const T=useT();const w=useWindowWidth();const mob=w<480;
  const[selId,setSelId]=useState(()=>localStorage.getItem("fm_selectedGoal")||"");
  const[showAdd,setShowAdd]=useState(false);
  const[nName,setNName]=useState("");const[nTag,setNTag]=useState("");const[nHrs,setNHrs]=useState("");const[nStartDate,setNStartDate]=useState(todayStr());const[nDate,setNDate]=useState("");
  const[projMins,setProjMins]=useState({});
  const[weekAnchor,setWeekAnchor]=useState(todayStr());
  useEffect(()=>{if(selId)localStorage.setItem("fm_selectedGoal",selId);},[selId]);
  useEffect(()=>{if(goals.length>0&&!goals.find(g=>g.id===selId)){setSelId(goals[0].id);}},[goals]);
  const allTags=[...new Set(sessions.map(s=>s.tag))].sort();
  const goal=goals.find(g=>g.id===selId);
  const addGoal=async()=>{if(!nName.trim()||!nTag||!nHrs||!nStartDate||!nDate)return;const sv=await insertGoal(nName.trim(),nTag,parseFloat(nHrs),nStartDate,nDate);if(sv){setGoals(p=>[...p,sv]);setSelId(sv.id);}setShowAdd(false);setNName("");setNTag("");setNHrs("");setNStartDate(todayStr());setNDate("");};
  const delGoal=async(id)=>{await deleteGoalDB(id);setGoals(p=>p.filter(g=>g.id!==id));if(selId===id){const rem=goals.filter(g=>g.id!==id);setSelId(rem.length>0?rem[0].id:"");}};

  let S=null;
  if(goal){
    const ts=sessions.filter(s=>s.tag===goal.tag);
    const totalMins=ts.reduce((a,s)=>a+s.duration,0);const totalH=totalMins/60;
    const startD=goal.startDate;
    const created=new Date(startD+"T12:00:00");const target=new Date(goal.targetDate+"T12:00:00");const today=new Date(todayStr()+"T12:00:00");
    const dTotal=Math.max(1,Math.ceil((target-created)/86400000)+1);
    const dElapsed=Math.max(1,Math.ceil((today-created)/86400000)+1);
    const dRemain=Math.max(0,Math.ceil((target-today)/86400000)+1);
    const hRemain=Math.max(0,goal.targetHours-totalH);
    const avgOrig=goal.targetHours/dTotal;
    const avgNow=dRemain>0?hRemain/dRemain:(hRemain>0?99:0);
    const avgActual=totalH/dElapsed;
    const expected=avgOrig*dElapsed;
    const ratio=expected>0?totalH/expected:(totalH>0?2:0);
    const todayLoggedMins=ts.filter(s=>s.date===todayStr()).reduce((a,s)=>a+s.duration,0);
    const todayLoggedH=todayLoggedMins/60;
    const previousExpected=avgOrig*(dElapsed-1);
    const previousLogged=totalH-todayLoggedH;
    const previousLag=Math.max(0,previousExpected-previousLogged);
    const todayRemaining=Math.max(0,avgOrig-todayLoggedH);
    const lagH=previousLag+todayRemaining;
    const leadH=Math.max(0,totalH-expected);
    let status,sColor,sLabel,sEmoji;
    if(totalH>=goal.targetHours){status="done";sColor="#2A9D8F";sLabel="Goal Complete!";sEmoji="🏆";}
    else if(ratio>=1.0){status="green";sColor="#2A9D8F";sLabel="On Track";sEmoji="🟢";}
    else if(ratio>=0.8){status="orange";sColor="#F4A261";sLabel="Slightly Behind";sEmoji="🟠";}
    else{status="red";sColor="#E63946";sLabel="Behind Schedule";sEmoji="🔴";}
    const progress=Math.min(totalH/goal.targetHours,1);
    const isExpired=dRemain<=0&&status!=="done";
    if(isExpired){sColor="#E63946";sLabel="Deadline Passed";sEmoji="⏰";}
    // Week data based on anchor
    const anchorD=new Date(weekAnchor+"T12:00:00");const dow=anchorD.getDay();const mon=new Date(anchorD);mon.setDate(anchorD.getDate()-((dow+6)%7));
    const wDays=[];for(let i=0;i<7;i++){const dd=new Date(mon);dd.setDate(mon.getDate()+i);wDays.push(dateToStr(dd));}
    const dLabels=["M","T","W","TH","F","SA","SU"];
    const tagDT={};ts.forEach(s=>{tagDT[s.date]=(tagDT[s.date]||0)+s.duration;});
    const wData=wDays.map(d=>({date:d,mins:tagDT[d]||0}));
    const wTotal=wData.reduce((a,d)=>a+d.mins,0);
    const last7=wData.filter(d=>d.date<=todayStr());
    const l7Avg=last7.length>0?last7.reduce((a,d)=>a+d.mins,0)/last7.length/60:0;
    const activeDays=new Set(ts.map(s=>s.date)).size;
    const comfortPace=activeDays>0?totalH/activeDays:avgOrig;
    const comfortPaceMins=Math.round(comfortPace*60);
    const _weeklyNeedMins=Math.round(avgNow*60*7);
    const _wRemainMins=Math.max(0,_weeklyNeedMins-wTotal);
    const _todayIdx=wDays.findIndex(d=>d===todayStr());
    const _remainAfterToday=Math.max(1,_todayIdx>=0?7-_todayIdx-1:7);
    const todayForComfort=Math.max(0,_wRemainMins-(comfortPaceMins*_remainAfterToday));
    S={totalH,hRemain,dTotal,dElapsed,dRemain,avgOrig,avgNow,avgActual,ratio,status,sColor,sLabel,sEmoji,progress,isExpired,wDays,dLabels,wData,wTotal,tagDT,l7Avg,expected,lagH,leadH,comfortPace,comfortPaceMins,todayForComfort,_remainAfterToday,_weeklyNeedMins};
  }

  const iStyle={border:`2px solid ${T.bd3}`,padding:"10px 14px",fontSize:14,fontFamily:F,background:"transparent",outline:"none",boxSizing:"border-box",color:T.tx};
  const selStyle={border:`2px solid ${T.bd3}`,padding:"10px 14px",fontSize:14,fontFamily:F,fontWeight:700,background:T.sel,color:T.tx,outline:"none",cursor:"pointer",borderRadius:4,boxSizing:"border-box"};

  return(
    <div style={{fontFamily:F}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,gap:10,flexWrap:"wrap"}}>
        <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,fontWeight:600}}>🎯 Goals</div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {goals.length>0&&(<select value={selId} onChange={e=>{setSelId(e.target.value);setProjMins({});}} style={{...selStyle,maxWidth:mob?180:260}}>{goals.map(g=>(<option key={g.id} value={g.id}>{g.name}</option>))}</select>)}
          <button onClick={()=>setShowAdd(!showAdd)} style={{padding:"10px 18px",border:`2px solid ${T.bd3}`,background:showAdd?"transparent":T.btn,color:showAdd?T.tx:T.btnT,fontSize:12,fontFamily:F,fontWeight:700,cursor:"pointer"}}>{showAdd?"✕":"+ New"}</button>
        </div>
      </div>

      {showAdd&&(<div style={{background:T.bg2,borderRadius:10,padding:mob?16:20,marginBottom:24,border:`1px solid ${T.bd}`}}>
        <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:"0.12em",color:T.tx3,fontWeight:600,marginBottom:14}}>Create New Goal</div>
        <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:10,marginBottom:12}}>
          <input value={nName} onChange={e=>setNName(e.target.value)} placeholder="Goal name (e.g. CAT Exam Prep)" style={iStyle}/>
          <select value={nTag} onChange={e=>setNTag(e.target.value)} style={selStyle}><option value="">Select tag...</option>{allTags.map(t=>(<option key={t} value={t}>{t}</option>))}</select>
          <input value={nHrs} onChange={e=>setNHrs(e.target.value)} placeholder="Target hours (e.g. 1000)" type="number" style={iStyle}/>
          <div style={{display:"flex",gap:8}}>
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:4}}>
              <label style={{fontSize:10,fontFamily:F,color:T.tx3,fontWeight:600}}>START DATE</label>
              <input value={nStartDate} onChange={e=>setNStartDate(e.target.value)} type="date" style={iStyle}/>
            </div>
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:4}}>
              <label style={{fontSize:10,fontFamily:F,color:T.tx3,fontWeight:600}}>END DATE</label>
              <input value={nDate} onChange={e=>setNDate(e.target.value)} type="date" style={iStyle}/>
            </div>
          </div>
        </div>
        <button onClick={addGoal} style={{padding:"10px 28px",border:`2px solid ${T.bd3}`,background:T.btn,color:T.btnT,fontSize:12,fontFamily:F,fontWeight:700,cursor:"pointer",letterSpacing:"0.06em",textTransform:"uppercase"}}>Create Goal</button>
      </div>)}

      {goals.length===0&&!showAdd&&(<div style={{textAlign:"center",padding:"60px 20px",color:T.tx4,fontSize:14}}>
        <div style={{fontSize:48,marginBottom:16}}>🎯</div>
        <div style={{fontWeight:700,color:T.tx3,marginBottom:8}}>No goals yet</div>
        <div>Create your first goal to start tracking progress</div>
      </div>)}

      {goal&&S&&(<div>
        <div style={{background:S.sColor+"18",border:`2px solid ${S.sColor}40`,borderRadius:12,padding:mob?"16px":"20px 24px",marginBottom:24,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontSize:mob?18:22,fontWeight:800,color:T.tx,marginBottom:4}}>{goal.name}</div>
            {S.status!=="done"&&!S.isExpired&&(()=>{const projPct=Math.round((S.avgActual*S.dTotal)/goal.targetHours*100);const pColor=projPct>=90?"#2A9D8F":projPct>=70?"#F4A261":"#E63946";return(<div style={{fontSize:12,fontWeight:600,color:pColor,marginTop:2}}>{projPct>=100?`📈 Current pace → ${projPct}% of goal`:`⚠ Current pace → only ${projPct}% of goal`}</div>);})()}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontSize:24}}>{S.sEmoji}</span>
            <span style={{fontSize:14,fontWeight:700,color:S.sColor}}>{S.sLabel}</span>
            {S.status!=="done"&&(S.status==="green"?(
              <span style={{fontSize:11,fontWeight:700,color:"#2A9D8F",background:"#2A9D8F18",padding:"3px 8px",borderRadius:4}}>{S.leadH>0?`leading by ${S.leadH.toFixed(1)}h`:"on track"}</span>
            ):S.lagH>0?(
              <span style={{fontSize:11,fontWeight:700,color:"#E63946",background:"#E6394618",padding:"3px 8px",borderRadius:4}}>lagging by {S.lagH.toFixed(1)}h</span>
            ):null)}
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"auto 1fr",gap:mob?20:32,marginBottom:28,alignItems:"center"}}>
          <div style={{display:"flex",justifyContent:"center"}}>
            <div style={{position:"relative",width:160,height:160}}>
              <svg width={160} height={160} style={{transform:"rotate(-90deg)"}}>
                <circle cx={80} cy={80} r={66} fill="none" stroke={T.bd} strokeWidth={10}/>
                <circle cx={80} cy={80} r={66} fill="none" stroke={S.sColor} strokeWidth={10} strokeLinecap="round" strokeDasharray={2*Math.PI*66} strokeDashoffset={2*Math.PI*66*(1-S.progress)} style={{transition:"stroke-dashoffset 0.6s ease"}}/>
              </svg>
              <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                <div style={{fontSize:28,fontWeight:800,color:T.tx}}>{Math.round(S.progress*100)}%</div>
                <div style={{fontSize:10,color:T.tx3,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600}}>Complete</div>
              </div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[
              {label:"Logged",value:`${S.totalH.toFixed(1)}h`,sub:`of ${goal.targetHours}h`,color:"#2A9D8F"},
              {label:"Remaining",value:`${S.hRemain.toFixed(1)}h`,sub:`${S.dRemain}d left`,color:"#E63946"},
              {label:"Your Pace",value:`${S.avgActual.toFixed(1)}h/d`,sub:`need ${S.avgNow>20?"—":S.avgNow.toFixed(1)}h/d`,color:S.avgActual>=S.avgNow?"#2A9D8F":"#F4A261"},
              {label:"Required Now",value:S.avgNow>20?"—":`${S.avgNow.toFixed(1)}h/d`,sub:S.status==="done"?"Done!":S.status==="green"?(S.leadH>0?`leading by ${S.leadH.toFixed(1)}h`:"on track"):S.lagH>0?`behind by ${S.lagH.toFixed(1)}h`:"on track",color:S.avgNow>S.avgOrig*1.5?"#E63946":S.avgNow>S.avgOrig?"#F4A261":"#2A9D8F"},
            ].map(s=>(<div key={s.label} style={{background:T.bg3,borderRadius:8,padding:mob?"12px":"14px 16px"}}>
              <div style={{fontSize:10,color:T.tx3,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600,marginBottom:4}}>{s.label}</div>
              <div style={{fontSize:mob?18:22,fontWeight:800,color:s.color}}>{s.value}</div>
              <div style={{fontSize:10,color:T.tx2,marginTop:2}}>{s.sub}</div>
            </div>))}
          </div>
        </div>

        {(()=>{
          const weeklyNeedMins=Math.round(S.avgNow*60*7);
          const todayIdx=S.wDays.findIndex(d=>d===todayStr());
          const projTotal=S.wDays.reduce((a,d)=>a+(projMins[d]||0),0);
          const simTotal=S.wTotal+projTotal;
          const wRemainMins=Math.max(0,weeklyNeedMins-simTotal);
          const remainDays=Math.max(1,todayIdx>=0?7-todayIdx-1:7);
          const dynamicDaily=remainDays>0?Math.round(wRemainMins/remainDays):0;
          const allMins=S.wData.map(d=>d.mins+(projMins[d.date]||0));
          const scaleMax=Math.max(dynamicDaily*1.5,Math.max(...allMins),1);
          return(<>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
          <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,fontWeight:600}}>Weekly — {goal.tag}</div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={()=>{const d=new Date(weekAnchor+"T12:00:00");d.setDate(d.getDate()-7);setWeekAnchor(dateToStr(d));setProjMins({});}} style={{border:"none",background:"none",fontSize:16,cursor:"pointer",color:T.tx}}>←</button>
            <span style={{fontSize:12,fontWeight:700,color:T.tx}}>{new Date(S.wDays[0]+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})} – {new Date(S.wDays[6]+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
            <button onClick={()=>{const d=new Date(weekAnchor+"T12:00:00");d.setDate(d.getDate()+7);setWeekAnchor(dateToStr(d));setProjMins({});}} style={{border:"none",background:"none",fontSize:16,cursor:"pointer",color:T.tx,opacity:S.wDays[6]>=todayStr()?0.2:1,pointerEvents:S.wDays[6]>=todayStr()?"none":"auto"}}>→</button>
          </div>
        </div>
        <div style={{position:"relative"}}>
          <div style={{display:"flex",alignItems:"flex-end",gap:mob?6:10,height:140,paddingTop:16,marginBottom:8}}>
            {S.wData.map((d,i)=>{
              const isFut=d.date>todayStr();const isT=d.date===todayStr();
              const proj=projMins[d.date]||0;
              const actualH=d.mins>0?Math.max((d.mins/scaleMax)*100,8):isFut?0:4;
              const projH=proj>0?Math.max((proj/scaleMax)*100,4):0;
              const totalMins=d.mins+proj;
              let bColor;
              if(isFut&&!proj)bColor=T.bd;
              else if(totalMins>=dynamicDaily)bColor="#2A9D8F";
              else if(totalMins>=dynamicDaily*0.8)bColor="#F4A261";
              else bColor=totalMins>0?"#E63946":T.bd2;
              return(<div key={d.date} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:140,maxWidth:60}}>
                {totalMins>0&&<span style={{fontSize:9,fontWeight:700,color:bColor,marginBottom:2}}>{formatHM(totalMins)}</span>}
                {proj>0&&<div style={{width:"65%",height:projH,background:bColor,borderRadius:"3px 3px 0 0",opacity:0.4,minHeight:4}}/>}
                <div style={{width:"65%",height:actualH,background:isFut&&!d.mins?T.bd:bColor,borderRadius:proj>0?"0":"3px 3px 0 0",minHeight:d.mins>0?6:isFut?0:2,transition:"height 0.3s ease"}}/>
                <span style={{fontSize:10,fontWeight:600,color:isT?T.tx:T.tx3,marginTop:4}}>{S.dLabels[i]}</span>
              </div>);})}
          </div>
          {dynamicDaily>0&&(()=>{const linePos=Math.min((dynamicDaily/scaleMax)*100,100);return linePos>0&&linePos<=100?(<div style={{position:"absolute",left:0,right:0,bottom:`${8+28+linePos*0.92}px`,borderTop:"2px dashed #E63946",opacity:0.5,pointerEvents:"none"}}><span style={{position:"absolute",right:0,top:-14,fontSize:8,color:"#E63946",fontWeight:700,fontFamily:F}}>{formatHM(dynamicDaily)}/day to hit weekly</span></div>):null;})()}
        </div>
        <div style={{display:"flex",gap:mob?6:10,marginBottom:12}}>
          {S.wData.map((d,i)=>{
            const isEditable=d.date>=todayStr();
            return(<div key={d.date} style={{flex:1,maxWidth:60,display:"flex",justifyContent:"center"}}>
              {isEditable?(<input value={projMins[d.date]?String(Math.round(projMins[d.date]/60*10)/10):""} onChange={e=>{const v=parseFloat(e.target.value);setProjMins(p=>({...p,[d.date]:isNaN(v)||v<=0?0:Math.round(v*60)}));}} placeholder="h" type="number" step="0.5" style={{width:"100%",maxWidth:48,border:`1px solid ${T.bd2}`,borderRadius:4,padding:"4px 2px",fontSize:10,fontFamily:F,fontWeight:600,textAlign:"center",background:T.bg3,color:T.tx,outline:"none",boxSizing:"border-box"}}/>):(<span style={{fontSize:9,color:T.tx4}}>—</span>)}
            </div>);
          })}
        </div>
        <div style={{display:"flex",gap:12,fontSize:10,color:T.tx3,marginBottom:8,flexWrap:"wrap"}}>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,background:"#2A9D8F",borderRadius:2,display:"inline-block"}}/> On target</span>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,background:"#F4A261",borderRadius:2,display:"inline-block"}}/> Within 20%</span>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,background:"#E63946",borderRadius:2,display:"inline-block"}}/> Behind</span>
          {projTotal>0&&<span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,background:T.tx3,borderRadius:2,display:"inline-block",opacity:0.4}}/> Projected</span>}
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:12,height:0,borderTop:"2px dashed #E63946",display:"inline-block"}}/> {formatHM(dynamicDaily)}/day ({remainDays}d left)</span>
        </div>
        <div style={{background:T.bg3,borderRadius:8,padding:"12px 16px",marginBottom:24}}>
          <span style={{fontSize:12,fontWeight:600,color:T.tx}}>Week total: {formatHM(S.wTotal)}{projTotal>0&&<span style={{color:"#457B9D"}}> + {formatHM(projTotal)} planned = {formatHM(simTotal)}</span>}</span>
          <span style={{fontSize:12,color:T.tx3,marginLeft:8}}>· Need {formatHM(weeklyNeedMins)}/week</span>
          {simTotal>=weeklyNeedMins?<span style={{marginLeft:8}}>🔥</span>:<span style={{marginLeft:8,color:"#E63946",fontSize:11,fontWeight:600}}> — {formatHM(wRemainMins)} left in {remainDays}d</span>}
        </div>
          </>);})()}

        <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,fontWeight:600,marginBottom:14}}>Timeline</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:28}}>
          {[
            {label:"Started",value:new Date((goal.startDate)+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}),sub:`Day ${S.dElapsed} of ${S.dTotal}`},
            {label:"Today",value:new Date(todayStr()+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}),sub:`${Math.round(S.dElapsed/S.dTotal*100)}% time elapsed`},
            {label:"Deadline",value:new Date(goal.targetDate+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}),sub:`${S.dRemain} days left`},
          ].map(t=>(<div key={t.label} style={{background:T.bg3,borderRadius:8,padding:"12px",textAlign:"center"}}>
            <div style={{fontSize:10,color:T.tx3,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600,marginBottom:4}}>{t.label}</div>
            <div style={{fontSize:15,fontWeight:700,color:T.tx}}>{t.value}</div>
            <div style={{fontSize:10,color:T.tx2,marginTop:2}}>{t.sub}</div>
          </div>))}
        </div>

        <div style={{textAlign:"center",marginTop:20,marginBottom:20}}>
          <button onClick={()=>{if(window.confirm(`Delete "${goal.name}"?`))delGoal(goal.id);}} style={{border:`1px solid ${T.bd2}`,background:"transparent",color:T.tx4,padding:"8px 20px",fontSize:11,fontFamily:F,fontWeight:600,cursor:"pointer",borderRadius:4}}>Delete Goal</button>
        </div>
      </div>)}
    </div>
  );
}

// ─── Analysis Page ───
function AnalysisPage({sessions,setSessions}){
  const T=useT();const[selectedDate,setSelectedDate]=useState(todayStr());const[weekAnchor,setWeekAnchor]=useState(todayStr());const[showR,setShowR]=useState(false);const[showA,setShowA]=useState(false);const rRef=useRef(null);const aRef=useRef(null);const[vm,setVm]=useState(()=>{const d=nowIST();return{year:d.getFullYear(),month:d.getMonth()};});const w=useWindowWidth();const mob=w<480;
  const[qlTag,setQlTag]=useState("");const[qlMins,setQlMins]=useState("");
  const[editSessId,setEditSessId]=useState(null);const[editSessTag,setEditSessTag]=useState("");
  const addSession=useCallback(async(ns)=>{setSessions(p=>[...p,ns]);const sv=await insertSession(ns);if(sv){setSessions(p=>p.map(s=>s.ts===ns.ts&&s.tag===ns.tag?{id:sv.id,tag:sv.tag,duration:sv.duration,date:sv.date,ts:Number(sv.ts)}:s));}},[setSessions]);
  const logQuick=()=>{const mins=parseInt(qlMins);if(!qlTag.trim()||isNaN(mins)||mins<=0)return;addSession({id:Date.now(),tag:qlTag.trim(),duration:mins,date:selectedDate,ts:Date.now()});setQlTag("");setQlMins("");};
  const renameSession=async(s,newTag)=>{if(!newTag.trim()||newTag.trim()===s.tag){setEditSessId(null);return;}await updateSessionTag(s.id,newTag.trim());setSessions(p=>p.map(x=>x.id===s.id?{...x,tag:newTag.trim()}:x));setEditSessId(null);};

  const ds=sessions.filter(s=>s.date===selectedDate);const tt={};ds.forEach(s=>{tt[s.tag]=(tt[s.tag]||0)+s.duration;});const tot=ds.reduce((a,s)=>a+s.duration,0);const sorted=Object.entries(tt).sort((a,b)=>b[1]-a[1]);const allTags=[...new Set(sessions.map(s=>s.tag))];
  const shiftDate=(dir)=>{const d=new Date(selectedDate+"T12:00:00");d.setDate(d.getDate()+dir);setSelectedDate(dateToStr(d));};
  const isToday=selectedDate===todayStr();const dateLabel=isToday?"Today":new Date(selectedDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
  const wDates=getWeekRange(weekAnchor);const wLabel=`${new Date(wDates[0]+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${new Date(wDates[6]+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}`;
  const shiftWeek=(dir)=>{const d=new Date(weekAnchor+"T12:00:00");d.setDate(d.getDate()+dir*7);setWeekAnchor(dateToStr(d));};
  const mDates=getMonthDates(vm.year,vm.month);const mLabel=new Date(vm.year,vm.month).toLocaleDateString("en-US",{month:"long",year:"numeric"});
  const shiftMonth=(dir)=>{setVm(p=>{let m=p.month+dir,y=p.year;if(m<0){m=11;y--;}if(m>11){m=0;y++;}return{year:y,month:m};});};
  const dtAll=getDayTotals(sessions);const tdtAll={};sessions.forEach(s=>{if(!tdtAll[s.tag])tdtAll[s.tag]={};tdtAll[s.tag][s.date]=(tdtAll[s.tag][s.date]||0)+s.duration;});
  const pBests=Object.entries(tdtAll).map(([tag,days])=>{const best=Object.entries(days).sort((a,b)=>b[1]-a[1])[0];return{tag,mins:best?best[1]:0,date:best?best[0]:""};}).sort((a,b)=>b.mins-a.mins);
  const buckets=[{label:"0–1h",min:0,max:60},{label:"1–2h",min:60,max:120},{label:"2–3h",min:120,max:180},{label:"3–4h",min:180,max:240},{label:"4–5h",min:240,max:300},{label:"5–6h",min:300,max:360},{label:"6–7h",min:360,max:420}];
  const bCounts=buckets.map(b=>({...b,count:Object.values(dtAll).filter(m=>m>=b.min&&m<b.max).length}));const maxB=Math.max(...bCounts.map(b=>b.count),1);const dCols=["#E63946","#F4A261","#2A9D8F","#2A9D8F","#457B9D","#457B9D","#1982C4"];
  const dowSets=[new Set(),new Set(),new Set(),new Set(),new Set(),new Set(),new Set()];Object.keys(dtAll).forEach(d=>{dowSets[new Date(d+"T12:00:00").getDay()].add(d);});const dowN=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];const dowC=dowSets.map((s,i)=>({dow:i,count:s.size}));const bestDow=[...dowC].sort((a,b)=>b.count-a.count)[0];
  const winSets={};sessions.forEach(s=>{if(!s.ts)return;const hr=new Date(s.ts).getHours();const st=Math.floor(hr/2)*2;const en=st+2;const fmt=(h)=>{if(h===0)return"12 AM";if(h<12)return`${h} AM`;if(h===12)return"12 PM";return`${h-12} PM`;};const l=`${fmt(st)} – ${fmt(en>23?0:en)}`;if(!winSets[l])winSets[l]=new Set();winSets[l].add(s.date);});const winData=Object.entries(winSets).map(([l,s])=>({label:l,count:s.size})).sort((a,b)=>b.count-a.count);const bestWin=winData[0];
  const zones=[{label:"< 1 hr",min:0,max:60},{label:"1–2 hrs",min:60,max:120},{label:"2–3 hrs",min:120,max:180},{label:"3–4 hrs",min:180,max:240},{label:"4+ hrs",min:240,max:99999}];const bestZone=zones.map(z=>({...z,count:Object.values(dtAll).filter(m=>m>=z.min&&m<z.max).length})).sort((a,b)=>b.count-a.count)[0];
  const nb={border:"none",background:"none",fontSize:20,cursor:"pointer",color:T.tx};const tH={fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",fontFamily:F,color:T.tx3};const tR={display:"grid",padding:"9px 0",borderBottom:`1px solid ${T.bd}`,fontFamily:F,fontSize:mob?12:13,alignItems:"center"};const gc=mob?"1fr 80px 60px":"1fr 100px 80px";
  const togBtn=(active)=>({border:`2px solid ${T.bd3}`,background:active?T.btn:"transparent",color:active?T.btnT:T.tx,padding:"10px 24px",fontSize:12,fontFamily:F,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:8});
  const iStyle={border:`2px solid ${T.bd3}`,padding:"10px 14px",fontSize:14,fontFamily:F,background:"transparent",outline:"none",boxSizing:"border-box",color:T.tx};
  return(
    <div>
      <SectionHeader>Daily Report</SectionHeader>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:24,marginBottom:20,fontFamily:F}}>
        <button onClick={()=>shiftDate(-1)} style={nb}>←</button><span style={{fontSize:16,fontWeight:700,minWidth:140,textAlign:"center",color:T.tx}}>{dateLabel}</span><button onClick={()=>shiftDate(1)} style={{...nb,opacity:isToday?0.2:1,pointerEvents:isToday?"none":"auto"}}>→</button>
      </div>
      <div style={{textAlign:"center",marginBottom:24}}><div style={{fontSize:42,fontFamily:F,fontWeight:700,color:T.tx}}>{formatHM(tot)}</div><div style={{fontSize:11,fontFamily:F,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,marginTop:4,fontWeight:600}}>Total Upskilling {tot>=120&&"🔥"}</div></div>
      {sorted.length===0?(<div style={{textAlign:"center",color:T.tx4,fontFamily:F,fontSize:13,padding:"30px 0"}}>No sessions recorded</div>):(<TagBarChart sorted={sorted} allTags={allTags}/>)}
      {ds.length>0&&(<div style={{marginTop:24}}><div style={{fontSize:10,fontFamily:F,textTransform:"uppercase",letterSpacing:"0.12em",color:T.tx4,marginBottom:8,fontWeight:600}}>Session Log</div>{ds.map(s=>(<div key={s.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${T.bd}`,fontFamily:F,fontSize:13}}>
        <span style={{display:"flex",alignItems:"center",gap:8,minWidth:0,flex:1}}>
          <span style={{width:8,height:8,borderRadius:2,background:getTagColor(s.tag,allTags),display:"inline-block",flexShrink:0}}/>
          {editSessId===s.id?(
            <input autoFocus value={editSessTag} onChange={e=>setEditSessTag(e.target.value)} onBlur={()=>renameSession(s,editSessTag)} onKeyDown={e=>{if(e.key==="Enter")renameSession(s,editSessTag);if(e.key==="Escape")setEditSessId(null);}} style={{border:"none",borderBottom:`2px solid ${T.bd3}`,background:"transparent",fontSize:13,fontFamily:F,fontWeight:600,outline:"none",color:T.tx,padding:"2px 0",flex:1,marginRight:8}}/>
          ):(
            <span onClick={()=>{setEditSessId(s.id);setEditSessTag(s.tag);}} style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:T.tx,cursor:"pointer"}} title="Click to rename">{s.tag}</span>
          )}
        </span>
        <span style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}><span style={{color:T.tx3}}>{formatHM(s.duration)}</span><button onClick={async()=>{await deleteSession(s.id);setSessions(p=>p.filter(x=>x.id!==s.id));}} style={{border:"none",background:"none",cursor:"pointer",color:T.tx4,fontSize:16,padding:"0 2px",lineHeight:1}} title="Delete">✕</button></span>
      </div>))}</div>)}
      <div style={{marginTop:28,marginBottom:8}}>
        <div style={{fontSize:11,fontFamily:F,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,marginBottom:12,fontWeight:600}}>Quick Log — {dateLabel}</div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <input value={qlTag} onChange={e=>setQlTag(e.target.value)} placeholder="Tag" onKeyDown={e=>e.key==="Enter"&&logQuick()} style={{...iStyle,flex:1,minWidth:100}}/>
          <input value={qlMins} onChange={e=>setQlMins(e.target.value)} placeholder="mins" type="number" onKeyDown={e=>e.key==="Enter"&&logQuick()} style={{...iStyle,width:80}}/>
          <button onClick={logQuick} style={{padding:"10px 20px",border:`2px solid ${T.bd3}`,background:T.btn,color:T.btnT,fontSize:13,fontFamily:F,fontWeight:700,cursor:"pointer"}}>+</button>
        </div>
      </div>
      <div style={{marginTop:32,textAlign:"center"}}><button onClick={()=>setShowR(!showR)} style={togBtn(showR)}><span style={{display:"inline-block",transition:"transform 0.3s ease",transform:showR?"rotate(180deg)":"rotate(0deg)",fontSize:10}}>▼</span>{showR?"Hide Reports":"Weekly & Monthly Reports"}</button></div>
      <div style={{maxHeight:showR?(rRef.current?rRef.current.scrollHeight+"px":"2000px"):"0px",overflow:"hidden",transition:"max-height 0.5s ease, opacity 0.4s ease",opacity:showR?1:0}}><div ref={rRef}>
        <div style={{marginTop:40,marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <div style={{fontSize:11,fontFamily:F,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,fontWeight:600}}>Weekly Report</div>
          <div style={{display:"flex",alignItems:"center",gap:12,fontFamily:F}}>
            <button onClick={()=>shiftWeek(-1)} style={{...nb,fontSize:16}}>←</button>
            <span style={{fontSize:13,fontWeight:700,color:T.tx}}>{wLabel}</span>
            <button onClick={()=>shiftWeek(1)} style={{...nb,fontSize:16,opacity:wDates[6]>=todayStr()?0.2:1,pointerEvents:wDates[6]>=todayStr()?"none":"auto"}}>→</button>
          </div>
        </div>
        <PeriodBarChart dates={wDates} sessions={sessions}/>
        <div style={{marginTop:40,marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}><div style={{fontSize:11,fontFamily:F,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,fontWeight:600}}>Monthly Report</div><div style={{display:"flex",alignItems:"center",gap:12,fontFamily:F}}><button onClick={()=>shiftMonth(-1)} style={{...nb,fontSize:16}}>←</button><span style={{fontSize:13,fontWeight:700,color:T.tx}}>{mLabel}</span><button onClick={()=>shiftMonth(1)} style={{...nb,fontSize:16}}>→</button></div></div>
        <PeriodBarChart dates={mDates} sessions={sessions}/>
      </div></div>
      {pBests.length>0&&(<><SectionHeader>🏆 Personal Bests</SectionHeader><div style={{...tR,borderBottom:`2px solid ${T.bd3}`,padding:"0 0 6px",gridTemplateColumns:gc}}><span style={tH}>Category</span><span style={{...tH,textAlign:"right"}}>Best</span><span style={{...tH,textAlign:"right"}}>Date</span></div>{pBests.map((b,i)=>(<div key={b.tag} style={{...tR,gridTemplateColumns:gc}}><span style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}><span style={{width:8,height:8,borderRadius:2,background:getTagColor(b.tag,allTags),display:"inline-block",flexShrink:0}}/><span style={{fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:T.tx}}>{b.tag}</span>{i===0&&<span style={{fontSize:11,flexShrink:0}}>👑</span>}</span><span style={{textAlign:"right",fontWeight:700,color:"#2A9D8F"}}>{formatHM(b.mins)}</span><span style={{textAlign:"right",color:T.tx3,fontSize:11}}>{b.date?new Date(b.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}):"—"}</span></div>))}</>)}
      <div style={{marginTop:32,textAlign:"center"}}><button onClick={()=>setShowA(!showA)} style={togBtn(showA)}><span style={{display:"inline-block",transition:"transform 0.3s ease",transform:showA?"rotate(180deg)":"rotate(0deg)",fontSize:10}}>▼</span>{showA?"Hide Advanced":"Advanced Analysis"}</button></div>
      <div style={{maxHeight:showA?(aRef.current?aRef.current.scrollHeight+"px":"3000px"):"0px",overflow:"hidden",transition:"max-height 0.5s ease, opacity 0.4s ease",opacity:showA?1:0}}><div ref={aRef}>
        <SectionHeader>Distribution — Hours vs Days</SectionHeader>
        <div style={{overflowX:"auto",paddingBottom:8}}><div style={{display:"flex",alignItems:"flex-end",gap:6,minWidth:bCounts.length*56,height:160,paddingTop:16}}>{bCounts.map((c,i)=>{const h=maxB>0?(c.count/maxB)*120:0;return(<div key={c.label} style={{flex:1,minWidth:44,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:160}}><span style={{fontSize:11,fontFamily:F,fontWeight:700,marginBottom:4,color:dCols[i]}}>{c.count>0?c.count:""}</span><div style={{width:"60%",height:h,background:dCols[i],borderRadius:"4px 4px 0 0",transition:"height 0.4s ease",minHeight:c.count>0?6:2,opacity:0.8}}/><span style={{fontSize:9,fontFamily:F,marginTop:6,color:T.tx3}}>{c.label}</span></div>);})}</div></div>
        <SectionHeader>Focus Insights</SectionHeader>
        {sessions.length>0&&(<><div style={{...tR,borderBottom:`2px solid ${T.bd3}`,padding:"0 0 6px",gridTemplateColumns:gc}}><span style={tH}>Insight</span><span style={{...tH,textAlign:"right"}}>Value</span><span style={{...tH,textAlign:"right"}}>Count</span></div><div style={{...tR,gridTemplateColumns:gc}}><div><div style={{fontWeight:600,color:T.tx}}>Comfort Zone</div><div style={{fontSize:10,color:T.tx3,marginTop:2}}>Most consistent range</div></div><span style={{textAlign:"right",fontWeight:700,color:"#6A4C93"}}>{bestZone&&bestZone.count>0?bestZone.label:"—"}</span><span style={{textAlign:"right",color:T.tx2}}>{bestZone&&bestZone.count>0?`${bestZone.count}d`:"—"}</span></div><div style={{...tR,gridTemplateColumns:gc}}><div><div style={{fontWeight:600,color:T.tx}}>Best Focus Day</div><div style={{fontSize:10,color:T.tx3,marginTop:2}}>Day you study most</div></div><span style={{textAlign:"right",fontWeight:700,color:"#2A9D8F"}}>{bestDow&&bestDow.count>0?(mob?dowN[bestDow.dow].slice(0,3):dowN[bestDow.dow]):"—"}</span><span style={{textAlign:"right",color:T.tx2}}>{bestDow&&bestDow.count>0?`${bestDow.count}d`:"—"}</span></div><div style={{...tR,gridTemplateColumns:gc}}><div><div style={{fontWeight:600,color:T.tx}}>Peak Window</div><div style={{fontSize:10,color:T.tx3,marginTop:2}}>When you focus most</div></div><span style={{textAlign:"right",fontWeight:700,color:"#457B9D",fontSize:mob?11:13}}>{bestWin?bestWin.label:"—"}</span><span style={{textAlign:"right",color:T.tx2}}>{bestWin?`${bestWin.count}d`:"—"}</span></div></>)}
      </div></div>
      <div style={{display:"flex",justifyContent:"center",marginTop:40,marginBottom:20}}><button onClick={()=>exportToExcel(sessions)} disabled={sessions.length===0} style={{padding:"10px 24px",border:`2px solid ${T.bd3}`,background:T.btn,color:T.btnT,fontSize:11,fontFamily:F,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",cursor:sessions.length>0?"pointer":"default",opacity:sessions.length>0?1:0.3,display:"flex",alignItems:"center",gap:6}}>↓ Export Excel</button></div>
    </div>
  );
}

// ─── Calendar Page ───
function CalendarPage({sessions}){
  const T=useT();const currentYear=nowIST().getFullYear();const[selYear,setSelYear]=useState(currentYear);const[selTag,setSelTag]=useState("__all__");const w=useWindowWidth();const allTags=[...new Set(sessions.map(s=>s.tag))].sort();const tk=todayStr();
  const fireDays=new Set();const dayMinsMap={};
  if(selTag==="__all__"){sessions.forEach(s=>{if(s.date.startsWith(String(selYear))){dayMinsMap[s.date]=(dayMinsMap[s.date]||0)+s.duration;}});Object.entries(dayMinsMap).forEach(([d,m])=>{if(m>=120)fireDays.add(d);});}else{sessions.forEach(s=>{if(s.date.startsWith(String(selYear))&&s.tag===selTag){fireDays.add(s.date);dayMinsMap[s.date]=(dayMinsMap[s.date]||0)+s.duration;}});}
  const isAll=selTag==="__all__";const dH=["M","T","W","T","F","S","S"];const yOpts=[];for(let y=2025;y<=2027;y++)yOpts.push(y);const totalFire=fireDays.size;const colCount=w<480?1:w<768?2:3;
  function MonthBlock({year,month}){
    const mNames=["January","February","March","April","May","June","July","August","September","October","November","December"];
    const dim=new Date(year,month+1,0).getDate();const fdRaw=new Date(year,month,1).getDay();const fdMon=(fdRaw+6)%7;const cells=[];for(let i=0;i<fdMon;i++)cells.push(null);for(let d=1;d<=dim;d++)cells.push(d);while(cells.length%7!==0)cells.push(null);
    let mTotal=0;for(let d=1;d<=dim;d++){const k=`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;mTotal+=(dayMinsMap[k]||0);}const avg=Math.round(mTotal/dim);
    let mFire=0;for(let d=1;d<=dim;d++){const k=`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;if(fireDays.has(k))mFire++;}
    const now=nowIST();const isCur=year===now.getFullYear()&&month===now.getMonth();const cfs=colCount===1?14:colCount===2?12:11;const hfs=colCount===1?10:9;
    return(<div style={{fontFamily:F}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8,padding:"0 2px"}}><span style={{fontSize:colCount===1?16:13,fontWeight:800,color:T.tx}}>{mNames[month]}</span><span style={{fontSize:colCount===1?13:11,fontWeight:700,color:avg>0?"#2A9D8F":T.tx4}}>Avg {formatHM(avg)}</span></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7, 1fr)",gap:0}}>{dH.map((d,i)=>(<div key={i} style={{height:colCount===1?28:22,display:"flex",alignItems:"center",justifyContent:"center",fontSize:hfs,fontWeight:700,color:T.tx2,border:`1px solid ${T.calBd}`,borderBottom:`2px solid ${T.calBd}`,background:T.calH}}>{d}</div>))}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7, 1fr)",gap:0}}>{cells.map((day,i)=>{
        if(day===null)return<div key={`e${i}`} style={{aspectRatio:"1",border:`0.5px solid ${T.bd}`,background:T.calE}}/>;
        const k=`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;const fire=fireDays.has(k);const fut=k>tk;const isT=isCur&&day===now.getDate();const miss=!fut&&!fire&&k<=tk;
        let bg=T.calF,color=T.tx;if(fire){bg="#2A9D8F";color="#fff";}else if(miss){bg="#E63946";color="#fff";}else if(fut){bg=T.calF;color=T.calFC;}
        return(<div key={i} title={`${k}${dayMinsMap[k]?" — "+formatHM(dayMinsMap[k]):""}`} style={{aspectRatio:"1",border:isT?`2.5px solid ${T.bd3}`:`1px solid ${T.calBd}`,background:bg,color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:cfs,fontWeight:isT?900:600,cursor:"default",position:"relative",zIndex:isT?2:1}}>{day}</div>);
      })}</div>
      <div style={{fontSize:colCount===1?12:10,color:T.tx2,marginTop:6,textAlign:"center",fontWeight:600}}>{mFire} 🔥</div>
    </div>);
  }
  const allM=[0,1,2,3,4,5,6,7,8,9,10,11];const rows=[];for(let i=0;i<12;i+=colCount)rows.push(allM.slice(i,i+colCount));
  return(
    <div style={{paddingTop:16,fontFamily:F}}>
      <div style={{display:"flex",justifyContent:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <select value={selYear} onChange={e=>setSelYear(Number(e.target.value))} style={{border:`2px solid ${T.bd3}`,padding:"8px 14px",fontSize:13,fontFamily:F,fontWeight:700,background:T.sel,color:T.tx,outline:"none",cursor:"pointer",borderRadius:4}}>{yOpts.map(y=>(<option key={y} value={y}>{y}</option>))}</select>
        <select value={selTag} onChange={e=>setSelTag(e.target.value)} style={{border:`2px solid ${T.bd3}`,padding:"8px 14px",fontSize:13,fontFamily:F,fontWeight:700,background:T.sel,color:T.tx,outline:"none",cursor:"pointer",borderRadius:4,maxWidth:w<480?200:"none"}}><option value="__all__">All — 2h+ goal</option>{allTags.map(t=>(<option key={t} value={t}>{t}</option>))}</select>
      </div>
      <div style={{textAlign:"center",marginBottom:24}}><span style={{fontSize:26,fontWeight:800,color:T.tx}}>{totalFire}</span><span style={{fontSize:13,color:T.tx3,marginLeft:8,fontWeight:600}}>{isAll?"fire days":`${selTag} days`} in {selYear}</span></div>
      {rows.map((mg,ri)=>(<div key={ri} style={{display:"grid",gridTemplateColumns:`repeat(${colCount}, 1fr)`,gap:colCount===1?20:12,marginBottom:colCount===1?12:24}}>{mg.map(m=>(<MonthBlock key={m} year={selYear} month={m}/>))}</div>))}
      <div style={{display:"flex",justifyContent:"center",gap:20,fontSize:11,color:T.tx2,marginTop:4,fontWeight:600,flexWrap:"wrap"}}>
        <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:14,height:14,background:"#2A9D8F",border:`1px solid ${T.calBd}`,display:"inline-block"}}/> {isAll?"2h+":"Studied"}</span>
        <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:14,height:14,background:"#E63946",border:`1px solid ${T.calBd}`,display:"inline-block"}}/> Missed</span>
        <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:14,height:14,background:T.calF,border:`1px solid ${T.calBd}`,display:"inline-block"}}/> Future</span>
      </div>
    </div>
  );
}

// ─── Reflection Page ───
function ReflectionPage({sessions}){
  const T=useT();const[reflections,setReflections]=useState({});const[loaded,setLoaded]=useState(false);const[editKey,setEditKey]=useState(null);const[editText,setEditText]=useState("");const[editHrs,setEditHrs]=useState("");const w=useWindowWidth();const mob=w<480;
  useEffect(()=>{loadReflections().then(d=>{setReflections(d);setLoaded(true);});},[]);
  const saveR=async(date,note,hrsOverride)=>{setReflections(p=>({...p,[date]:{note,hrsOverride}}));await upsertReflection(date,note,hrsOverride);};
  const dt=getDayTotals(sessions);const allDates=[...new Set([...Object.keys(dt),...Object.keys(reflections)])].sort((a,b)=>b.localeCompare(a));const today=todayStr();if(!allDates.includes(today))allDates.unshift(today);
  const startEdit=(date)=>{const r=reflections[date]||{};setEditKey(date);setEditText(r.note||"");setEditHrs(r.hrsOverride!=null?String(r.hrsOverride):"");};
  const saveRow=(date)=>{const hv=editHrs.trim()!==""?parseFloat(editHrs):null;saveR(date,editText,hv);setEditKey(null);};
  const getHrs=(date)=>{const r=reflections[date];if(r&&r.hrsOverride!=null)return r.hrsOverride;return(dt[date]||0)/60;};
  const getMins=(date)=>{const r=reflections[date];if(r&&r.hrsOverride!=null)return Math.round(r.hrsOverride*60);return dt[date]||0;};
  const gc=mob?"70px 1fr 55px":"90px 1fr 70px";
  if(!loaded)return(<div style={{textAlign:"center",padding:"40px 0",fontFamily:F,color:T.tx3,fontSize:13}}>Loading...</div>);
  return(
    <div>
      <div style={{fontSize:11,fontFamily:F,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,marginBottom:16,fontWeight:600}}>Daily Reflection</div>
      <div style={{display:"grid",gridTemplateColumns:gc,gap:0,fontFamily:F,borderBottom:`2px solid ${T.bd3}`,paddingBottom:8,marginBottom:4}}>
        <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:T.tx3}}>Date</span><span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:T.tx3}}>Notes</span><span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",textAlign:"right",color:T.tx3}}>Hours</span>
      </div>
      {allDates.map(date=>{
        const hrs=getHrs(date);const mins=getMins(date);const isGreen=mins>=120;const r=reflections[date]||{};const isE=editKey===date;const isT=date===today;
        const dl=new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short"});const dLabel=new Date(date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
        const rBg=isGreen?T.rG:T.rR;const rBd=isGreen?T.rGB:T.rRB;const hC=isGreen?"#2A9D8F":"#E63946";
        return(<div key={date} onClick={()=>{if(!isE)startEdit(date);}} style={{display:"grid",gridTemplateColumns:gc,gap:0,padding:"10px 0",borderBottom:`1px solid ${rBd}`,fontFamily:F,fontSize:13,background:rBg,cursor:isE?"default":"pointer",marginLeft:-8,marginRight:-8,paddingLeft:8,paddingRight:8,borderRadius:2}}>
          <div style={{display:"flex",flexDirection:"column",justifyContent:"center"}}><span style={{fontWeight:700,fontSize:12,color:T.tx}}>{dl}</span><span style={{fontSize:10,color:T.tx3}}>{dLabel}</span></div>
          <div style={{display:"flex",alignItems:"center",paddingRight:8,minWidth:0}}>
            {isE?(<div style={{display:"flex",gap:6,width:"100%",alignItems:"center"}}><input value={editText} onChange={e=>setEditText(e.target.value)} autoFocus placeholder="How was your study?" onKeyDown={e=>{if(e.key==="Enter")saveRow(date);if(e.key==="Escape")setEditKey(null);}} style={{flex:1,border:"none",borderBottom:`2px solid ${T.bd3}`,background:"transparent",fontSize:13,fontFamily:"inherit",padding:"4px 0",outline:"none",minWidth:0,color:T.tx}}/><button onClick={(e)=>{e.stopPropagation();saveRow(date);}} style={{border:`2px solid ${T.bd3}`,background:T.btn,color:T.btnT,padding:"4px 10px",fontSize:10,fontFamily:"inherit",fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>Save</button></div>
            ):(<span style={{color:r.note?T.tx:T.tx4,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.note||(isT?"Tap to add...":"—")}</span>)}
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end"}}>
            {isE?(<input value={editHrs} onChange={e=>setEditHrs(e.target.value)} placeholder={hrs.toFixed(1)} type="number" step="0.1" onKeyDown={e=>{if(e.key==="Enter")saveRow(date);}} style={{width:45,border:"none",borderBottom:`2px solid ${T.bd3}`,background:"transparent",fontSize:13,fontFamily:"inherit",textAlign:"right",padding:"4px 0",outline:"none",color:T.tx}}/>
            ):(<span style={{fontWeight:700,color:hC,fontSize:13}}>{hrs.toFixed(1)}h</span>)}
          </div>
        </div>);
      })}
      {allDates.length===0&&(<div style={{textAlign:"center",color:T.tx4,fontFamily:F,fontSize:13,padding:"40px 0"}}>No data yet. Start logging sessions!</div>)}
      <div style={{display:"flex",gap:16,marginTop:20,fontFamily:F,fontSize:10,color:T.tx3,flexWrap:"wrap"}}>
        <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:T.rG,border:`1px solid ${T.rGB}`,display:"inline-block",borderRadius:2}}/> 2h+</span>
        <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:T.rR,border:`1px solid ${T.rRB}`,display:"inline-block",borderRadius:2}}/> &lt;2h</span>
        <span>Tap row to edit</span>
      </div>
    </div>
  );
}

// ─── Sleep Page ───
function SleepPage({sleepLogs,setSleepLogs}){
  const T=useT();const[sleepStart,setSleepStart]=useState("23:00");const[wakeUp,setWakeUp]=useState("06:30");const[logDate,setLogDate]=useState(todayStr());const w=useWindowWidth();const mob=w<480;
  const[weekAnchor,setWeekAnchor]=useState(todayStr());
  const calcSleepMins=(start,wake)=>{const[sh,sm]=start.split(":").map(Number);const[wh,wm]=wake.split(":").map(Number);let sM=sh*60+sm;let wM=wh*60+wm;if(wM<=sM)wM+=1440;return wM-sM;};
  const logSleep=async()=>{const totalMins=calcSleepMins(sleepStart,wakeUp);const sv=await upsertSleepLog(logDate,sleepStart,wakeUp,totalMins);if(sv){setSleepLogs(p=>{const f=p.filter(l=>l.date!==logDate);return[sv,...f].sort((a,b)=>b.date.localeCompare(a.date));});}};
  const sleepColor=(mins)=>{if(mins<360)return"#F4A261";if(mins<=450)return"#2A9D8F";return"#E63946";};
  const anchorD=new Date(weekAnchor+"T12:00:00");const dow=anchorD.getDay();const mon=new Date(anchorD);mon.setDate(anchorD.getDate()-((dow+6)%7));
  const weekDays=[];for(let i=0;i<7;i++){const dd=new Date(mon);dd.setDate(mon.getDate()+i);weekDays.push(dateToStr(dd));}
  const shiftWeek=(dir)=>{const d=new Date(weekAnchor+"T12:00:00");d.setDate(d.getDate()+dir*7);setWeekAnchor(dateToStr(d));};
  const wLabel=`${new Date(weekDays[0]+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${new Date(weekDays[6]+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}`;
  const dayLabels=["M","T","W","TH","F","SA","SU"];
  const logMap={};sleepLogs.forEach(l=>{logMap[l.date]=l;});
  const barData=weekDays.map(d=>({date:d,mins:logMap[d]?.total_mins||0}));const maxSleep=Math.max(...barData.map(d=>d.mins),1);const bH=120;
  const avgTime=(times)=>{if(times.length===0)return"—";const mins=times.map(t=>{const[h,m]=t.split(":").map(Number);return h*60+m;});const isSleep=mins.some(m=>m>=720);const adjusted=isSleep?mins.map(m=>m<720?m+1440:m):mins;const avg=Math.round(adjusted.reduce((a,m)=>a+m,0)/adjusted.length)%1440;const hh=Math.floor(avg/60);const mm=avg%60;const ampm=hh>=12?"PM":"AM";const h12=hh===0?12:hh>12?hh-12:hh;return`${h12}:${String(mm).padStart(2,"0")} ${ampm}`;};
  const weekLogs=weekDays.map(d=>logMap[d]).filter(Boolean);
  const wAvgSleep=weekLogs.length>0?Math.round(weekLogs.reduce((a,l)=>a+(l.total_mins||0),0)/weekLogs.length):0;
  const wAvgBed=avgTime(weekLogs.map(l=>l.sleep_start).filter(Boolean));
  const wAvgWake=avgTime(weekLogs.map(l=>l.wake_up).filter(Boolean));
  const thisM=todayStr().slice(0,7);const mLogs=sleepLogs.filter(l=>l.date.startsWith(thisM));
  const mAvg=mLogs.length>0?Math.round(mLogs.reduce((a,l)=>a+(l.total_mins||0),0)/mLogs.length):0;
  const mAvgBed=avgTime(mLogs.map(l=>l.sleep_start).filter(Boolean));
  const mAvgWake=avgTime(mLogs.map(l=>l.wake_up).filter(Boolean));
  const iStyle={border:`2px solid ${T.bd3}`,padding:"8px 10px",fontSize:13,fontFamily:F,fontWeight:600,outline:"none",width:"100%",boxSizing:"border-box",background:"transparent",color:T.tx};
  return(
    <div>
      <div style={{fontSize:11,fontFamily:F,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,marginBottom:14,fontWeight:600}}>Log Sleep</div>
      <div style={{display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap",marginBottom:24}}>
        <div style={{display:"flex",flexDirection:"column",gap:4,flex:mob?"1 1 45%":"none"}}><label style={{fontSize:10,fontFamily:F,color:T.tx3,fontWeight:600}}>DATE</label><input type="date" value={logDate} onChange={e=>setLogDate(e.target.value)} style={iStyle}/></div>
        <div style={{display:"flex",flexDirection:"column",gap:4,flex:mob?"1 1 22%":"none"}}><label style={{fontSize:10,fontFamily:F,color:T.tx3,fontWeight:600}}>SLEEP</label><input type="time" value={sleepStart} onChange={e=>setSleepStart(e.target.value)} style={iStyle}/></div>
        <div style={{display:"flex",flexDirection:"column",gap:4,flex:mob?"1 1 22%":"none"}}><label style={{fontSize:10,fontFamily:F,color:T.tx3,fontWeight:600}}>WAKE</label><input type="time" value={wakeUp} onChange={e=>setWakeUp(e.target.value)} style={iStyle}/></div>
        <button onClick={logSleep} style={{padding:"10px 20px",border:`2px solid ${T.bd3}`,background:T.btn,color:T.btnT,fontSize:13,fontFamily:F,fontWeight:700,cursor:"pointer",flex:mob?"1 1 100%":"none"}}>Log</button>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:32,marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:11,fontFamily:F,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,fontWeight:600}}>Weekly Sleep</div>
        <div style={{display:"flex",alignItems:"center",gap:12,fontFamily:F}}>
          <button onClick={()=>shiftWeek(-1)} style={{border:"none",background:"none",fontSize:16,cursor:"pointer",color:T.tx}}>←</button>
          <span style={{fontSize:13,fontWeight:700,color:T.tx}}>{wLabel}</span>
          <button onClick={()=>shiftWeek(1)} style={{border:"none",background:"none",fontSize:16,cursor:"pointer",color:T.tx,opacity:weekDays[6]>=todayStr()?0.2:1,pointerEvents:weekDays[6]>=todayStr()?"none":"auto"}}>→</button>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"flex-end",gap:8,height:bH+50,paddingTop:16}}>{barData.map((d,i)=>{const h=d.mins>0?(d.mins/maxSleep)*bH:0;const c=d.mins>0?sleepColor(d.mins):T.bg3;const dateNum=new Date(d.date+"T12:00:00").getDate();return(<div key={d.date} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:bH+50,maxWidth:60}}>{d.mins>0&&<span style={{fontSize:9,fontFamily:F,fontWeight:700,marginBottom:2,color:sleepColor(d.mins)}}>{formatHM(d.mins)}</span>}<div style={{width:"70%",height:h,background:c,borderRadius:"3px 3px 0 0",minHeight:d.mins>0?4:2}}/><span style={{fontSize:10,fontFamily:F,marginTop:4,color:T.tx3,fontWeight:600}}>{dayLabels[i]}</span><span style={{fontSize:8,fontFamily:F,color:T.tx4}}>{dateNum}</span></div>);})}</div>
      <div style={{display:"flex",gap:16,marginTop:8,fontFamily:F,fontSize:10,color:T.tx3,flexWrap:"wrap"}}>
        <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,background:"#F4A261",borderRadius:2,display:"inline-block"}}/> &lt;6h</span>
        <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,background:"#2A9D8F",borderRadius:2,display:"inline-block"}}/> 6–7.5h</span>
        <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,background:"#E63946",borderRadius:2,display:"inline-block"}}/> 7.5h+</span>
      </div>
      <div style={{fontSize:11,fontFamily:F,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,marginBottom:14,fontWeight:600,marginTop:32}}>Averages</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:24}}>
        <div style={{background:T.bg3,padding:"16px",borderRadius:8,fontFamily:F}}><div style={{fontSize:10,color:T.tx3,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600,marginBottom:6}}>This Week</div><div style={{fontSize:22,fontWeight:700,color:T.tx}}>{formatHM(wAvgSleep)}</div><div style={{fontSize:11,color:T.tx2,marginTop:6}}>Bed: {wAvgBed}</div><div style={{fontSize:11,color:T.tx2}}>Wake: {wAvgWake}</div></div>
        <div style={{background:T.bg3,padding:"16px",borderRadius:8,fontFamily:F}}><div style={{fontSize:10,color:T.tx3,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600,marginBottom:6}}>This Month</div><div style={{fontSize:22,fontWeight:700,color:T.tx}}>{formatHM(mAvg)}</div><div style={{fontSize:11,color:T.tx2,marginTop:6}}>Bed: {mAvgBed}</div><div style={{fontSize:11,color:T.tx2}}>Wake: {mAvgWake}</div></div>
      </div>
      <div style={{fontSize:11,fontFamily:F,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,marginBottom:10,fontWeight:600}}>Sleep Log</div>
      <div style={{display:"grid",gridTemplateColumns:mob?"1fr 60px 60px 60px":"90px 70px 70px 70px",gap:0,fontFamily:F,borderBottom:`2px solid ${T.bd3}`,paddingBottom:6,marginBottom:4}}>
        <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:T.tx3}}>Date</span><span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:T.tx3}}>Sleep</span><span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:T.tx3}}>Wake</span><span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",textAlign:"right",color:T.tx3}}>Total</span>
      </div>
      {sleepLogs.length===0&&(<div style={{color:T.tx4,fontFamily:F,fontSize:13,padding:"20px 0",textAlign:"center"}}>No sleep logs yet</div>)}
      {sleepLogs.map(l=>{const c=sleepColor(l.total_mins||0);const dl=new Date(l.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});return(
        <div key={l.id} style={{display:"grid",gridTemplateColumns:mob?"1fr 60px 60px 60px":"90px 70px 70px 70px",padding:"8px 0",borderBottom:`1px solid ${T.bd}`,fontFamily:F,fontSize:mob?12:13}}>
          <span style={{fontWeight:600,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:T.tx}}>{dl}</span><span style={{color:T.tx2}}>{l.sleep_start||"—"}</span><span style={{color:T.tx2}}>{l.wake_up||"—"}</span><span style={{textAlign:"right",fontWeight:700,color:c}}>{l.total_mins?formatHM(l.total_mins):"—"}</span>
        </div>);})}
    </div>
  );
}

// ═══════════════════════════════════════════
// ─── MAIN APP ───
// ═══════════════════════════════════════════
export default function App(){
  const[user,setUser]=useState(null);const[authLoading,setAuthLoading]=useState(true);const[page,setPage]=useState(PAGES.HABITS);const[sessions,setSessions]=useState([]);const[tasks,setTasks]=useState([]);const[sleepLogs,setSleepLogs]=useState([]);const[goals,setGoals]=useState([]);const[habits,setHabits]=useState([]);const[habitLogs,setHabitLogs]=useState([]);const[loaded,setLoaded]=useState(false);const[sidebarOpen,setSidebarOpen]=useState(false);
  const[isDark,setIsDark]=useState(()=>localStorage.getItem("fm_theme")==="dark");
  const toggleTheme=()=>{setIsDark(p=>{const n=!p;localStorage.setItem("fm_theme",n?"dark":"light");return n;});};
  const theme=isDark?D:L;const w=useWindowWidth();
  useEffect(()=>{document.body.style.background=theme.bg;document.documentElement.style.background=theme.bg;document.body.style.margin="0";},[isDark]);
  if(typeof document!=="undefined"){document.body.style.background=(localStorage.getItem("fm_theme")==="dark"?"#000":"#fff");document.documentElement.style.background=(localStorage.getItem("fm_theme")==="dark"?"#000":"#fff");}
  useEffect(()=>{supabase.auth.getSession().then(({data:{session}})=>{setUser(session?.user??null);setAuthLoading(false);});const{data:{subscription}}=supabase.auth.onAuthStateChange((_e,session)=>{setUser(session?.user??null);});return()=>subscription.unsubscribe();},[]);
  useEffect(()=>{if(!user){setSessions([]);setTasks([]);setSleepLogs([]);setGoals([]);setHabits([]);setHabitLogs([]);setLoaded(false);return;}setLoaded(false);Promise.all([loadSessions(),loadTasks(),loadSleepLogs(),loadGoals(),loadHabits(),loadHabitLogs()]).then(([s,t,sl,g,h,hl])=>{setSessions(s);setTasks(t);setSleepLogs(sl);setGoals(g);setHabits(h);setHabitLogs(hl);setLoaded(true);});},[user]);
  const handleLogout=async()=>{await supabase.auth.signOut();setUser(null);setSessions([]);setTasks([]);setSleepLogs([]);setGoals([]);setHabits([]);setHabitLogs([]);setLoaded(false);setSidebarOpen(false);};
  const streak=calcStreak(sessions);const todayMins=sessions.filter(s=>s.date===todayStr()).reduce((a,s)=>a+s.duration,0);
  const getMaxWidth=()=>{if(page===PAGES.CALENDAR)return w<480?"100%":900;if(page===PAGES.GOALS||page===PAGES.HABITS)return w<480?"100%":640;return w<480?"100%":540;};
  const fontLink=<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>;
  if(authLoading)return(<ThemeContext.Provider value={theme}><div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:F,fontSize:14,color:theme.tx3,background:theme.bg}}>{fontLink}Loading...</div></ThemeContext.Provider>);
  if(!user)return(<ThemeContext.Provider value={theme}>{fontLink}<AuthPage onAuth={setUser}/></ThemeContext.Provider>);
  if(!loaded)return(<ThemeContext.Provider value={theme}><div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:F,fontSize:14,color:theme.tx3,background:theme.bg}}>{fontLink}Loading your data...</div></ThemeContext.Provider>);
  return(
    <ThemeContext.Provider value={theme}>
      <div style={{maxWidth:getMaxWidth(),margin:"0 auto",padding:w<480?"56px 12px 60px":"60px 20px 60px",minHeight:"100vh",background:theme.bg,color:theme.tx,transition:"background 0.3s ease, color 0.3s ease"}}>
        {fontLink}
        <TopNavBar sessions={sessions} streak={streak} todayMins={todayMins} onMenuClick={()=>setSidebarOpen(true)}/>
        <Sidebar open={sidebarOpen} onClose={()=>setSidebarOpen(false)} page={page} setPage={setPage} sessions={sessions} onLogout={handleLogout} isDark={isDark} onToggleTheme={toggleTheme}/>
        {page===PAGES.HABITS&&<div style={{paddingTop:16}}><HabitsPage habits={habits} setHabits={setHabits} habitLogs={habitLogs} setHabitLogs={setHabitLogs}/></div>}
        {page===PAGES.TIMER&&<><WeekStrip sessions={sessions}/><TimerPage sessions={sessions} setSessions={setSessions}/></>}
        {page===PAGES.TASKS&&<div style={{paddingTop:16}}><TasksPage tasks={tasks} setTasks={setTasks}/></div>}
        {page===PAGES.GOALS&&<div style={{paddingTop:16}}><GoalsPage sessions={sessions} goals={goals} setGoals={setGoals}/></div>}
        {page===PAGES.ANALYSIS&&<div style={{paddingTop:16}}><AnalysisPage sessions={sessions} setSessions={setSessions}/></div>}
        {page===PAGES.CALENDAR&&<CalendarPage sessions={sessions}/>}
        {page===PAGES.REFLECTION&&<div style={{paddingTop:16}}><ReflectionPage sessions={sessions}/></div>}
        {page===PAGES.SLEEP&&<div style={{paddingTop:16}}><SleepPage sleepLogs={sleepLogs} setSleepLogs={setSleepLogs}/></div>}
      </div>
    </ThemeContext.Provider>
  );
}