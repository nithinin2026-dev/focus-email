import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import * as Tone from "tone";
import { supabase } from "./supabaseClient";

const PAGES = { GOALS: "goals", HABITS: "habits", GYM: "gym", SPENDING: "spending", REFLECTION: "reflection", SLEEP: "sleep" };

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
  btn:"#fff", btnT:"#000", sel:"#111", miss:"#2a1215",
  ftBg:"#111", ftC:"#888",
};
function useT(){return useContext(ThemeContext);}
function useWindowWidth(){const[w,setW]=useState(window.innerWidth);useEffect(()=>{const h=()=>setW(window.innerWidth);window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);},[]);return w;}

const QUOTES=["Flow State is Fragile"];
let bellReady=false,bellSynth=null;
function initBell(){if(bellReady)return;bellSynth=new Tone.PolySynth(Tone.Synth,{oscillator:{type:"sine"},envelope:{attack:0.005,decay:0.8,sustain:0.01,release:1.2},volume:-6}).toDestination();bellReady=true;}
function playBell(){try{if(!bellReady)initBell();Tone.start();const n=Tone.now();bellSynth.triggerAttackRelease("C6","8n",n);bellSynth.triggerAttackRelease("E6","8n",n+0.15);bellSynth.triggerAttackRelease("G6","8n",n+0.3);bellSynth.triggerAttackRelease("C7","4n",n+0.5);}catch(e){}}
function playStartPop(){try{Tone.start();const s=new Tone.Synth({oscillator:{type:"triangle"},envelope:{attack:0.005,decay:0.15,sustain:0,release:0.1},volume:-8}).toDestination();s.triggerAttackRelease("G5","16n");setTimeout(()=>s.dispose(),500);}catch(e){}}
function playStopPop(){try{Tone.start();const s=new Tone.Synth({oscillator:{type:"triangle"},envelope:{attack:0.005,decay:0.2,sustain:0,release:0.15},volume:-8}).toDestination();s.triggerAttackRelease("D5","16n");setTimeout(()=>s.dispose(),500);}catch(e){}}

async function loadSessions(){const{data,error}=await supabase.from("sessions").select("*").order("ts",{ascending:true});if(error)return[];return data.map(r=>({id:r.id,tag:r.tag,duration:r.duration,date:r.date,ts:Number(r.ts)}));}
async function insertSession(session){const{data:{user}}=await supabase.auth.getUser();if(!user)return null;const{data,error}=await supabase.from("sessions").insert({user_id:user.id,tag:session.tag,duration:session.duration,date:session.date,ts:session.ts}).select().single();if(error)return null;return data;}
async function deleteSession(id){await supabase.from("sessions").delete().eq("id",id);}
async function updateSessionTag(id,newTag){await supabase.from("sessions").update({tag:newTag}).eq("id",id);}
async function loadReflections(){const{data,error}=await supabase.from("reflections").select("*");if(error)return{};const m={};data.forEach(r=>{m[r.date]={note:r.note||"",hrsOverride:r.hrs_override};});return m;}
async function upsertReflection(date,note,hrsOverride){const{data:{user}}=await supabase.auth.getUser();if(!user)return;await supabase.from("reflections").upsert({user_id:user.id,date,note,hrs_override:hrsOverride},{onConflict:"user_id,date"});}
async function loadGoals(){const{data,error}=await supabase.from("goals").select("*").order("created_at",{ascending:true});if(error)return[];return data.map(r=>({id:r.id,name:r.name,tag:r.tag,targetHours:Number(r.target_hours),startDate:r.start_date,targetDate:r.target_date}));}
async function insertGoal(name,tag,targetHours,startDate,targetDate){const{data:{user}}=await supabase.auth.getUser();if(!user)return null;const{data,error}=await supabase.from("goals").insert({user_id:user.id,name,tag,target_hours:targetHours,start_date:startDate,target_date:targetDate}).select().single();if(error)return null;return{id:data.id,name:data.name,tag:data.tag,targetHours:Number(data.target_hours),startDate:data.start_date,targetDate:data.target_date};}
async function deleteGoalDB(id){await supabase.from("goals").delete().eq("id",id);}
async function loadHabits(){const{data,error}=await supabase.from("habits").select("*").order("created_at",{ascending:true});if(error)return[];return data;}
async function insertHabit(name,icon,startDate){const{data:{user}}=await supabase.auth.getUser();if(!user)return null;const{data,error}=await supabase.from("habits").insert({user_id:user.id,name,icon,start_date:startDate}).select().single();if(error)return null;return data;}
async function deleteHabitDB(id){await supabase.from("habits").delete().eq("id",id);}
async function loadHabitLogs(){const{data,error}=await supabase.from("habit_logs").select("*");if(error)return[];return data;}
async function toggleHabitLog(habitId,date,exists){const{data:{user}}=await supabase.auth.getUser();if(!user)return null;if(exists){await supabase.from("habit_logs").delete().eq("habit_id",habitId).eq("date",date);return null;}const{data,error}=await supabase.from("habit_logs").insert({user_id:user.id,habit_id:habitId,date}).select().single();if(error)return null;return data;}
async function loadSleepLogs(){const{data,error}=await supabase.from("sleep_logs").select("*").order("date",{ascending:false});if(error)return[];return data;}
async function upsertSleepLog(date,sleepStart,wakeUp,totalMins){const{data:{user}}=await supabase.auth.getUser();if(!user)return null;const{data,error}=await supabase.from("sleep_logs").upsert({user_id:user.id,date,sleep_start:sleepStart,wake_up:wakeUp,total_mins:totalMins},{onConflict:"user_id,date"}).select().single();if(error)return null;return data;}
async function loadSpending(){const{data,error}=await supabase.from("spending").select("*").order("date",{ascending:false});if(error)return[];return data;}
async function insertSpending(date,amount,label,category){const{data:{user}}=await supabase.auth.getUser();if(!user)return null;const{data,error}=await supabase.from("spending").insert({user_id:user.id,date,amount,label,category}).select().single();if(error)return null;return data;}
async function loadTrackerLogs(){const{data,error}=await supabase.from("daily_tracker").select("*");if(error)return[];return data;}
async function toggleTrackerHabit(userId,date,tab,habitId,currentDone){const newDone=!currentDone;await supabase.from("daily_tracker").upsert({user_id:userId,date,tab,habit_id:habitId,done:newDone},{onConflict:"user_id,date,tab,habit_id"});return newDone;}
async function loadGymLogs(){const{data,error}=await supabase.from("gym_logs").select("*").order("date",{ascending:false});if(error)return[];return data.map(r=>({...r,exercises:JSON.parse(r.exercises||"[]")}));}
async function insertGymLog(date,exercises,note){const{data:{user}}=await supabase.auth.getUser();if(!user)return null;const{data,error}=await supabase.from("gym_logs").insert({user_id:user.id,date,exercises:JSON.stringify(exercises),note}).select().single();if(error)return null;return{...data,exercises:JSON.parse(data.exercises||"[]")};}
async function updateGymLog(id,exercises,note){const{data,error}=await supabase.from("gym_logs").update({exercises:JSON.stringify(exercises),note}).eq("id",id).select().single();if(error)return null;return{...data,exercises:JSON.parse(data.exercises||"[]")};}

function toIST(d){return new Date(d.toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));}
function dateToStr(d){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function todayStr(){return dateToStr(toIST(new Date()));}
function nowIST(){return toIST(new Date());}
function formatTime(s){const m=Math.floor(s/60);const sec=s%60;return`${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;}
function formatHM(mins){const h=Math.floor(mins/60);const m=mins%60;if(h===0)return`${m}m`;if(m===0)return`${h}h`;return`${h}h ${m}m`;}
function calcStreak(sessions){const dt={};sessions.forEach(s=>{dt[s.date]=(dt[s.date]||0)+s.duration;});let streak=0;const d=nowIST();const tk=todayStr();if((dt[tk]||0)>=120){streak=1;d.setDate(d.getDate()-1);}else{d.setDate(d.getDate()-1);}while(true){const k=dateToStr(d);if((dt[k]||0)>=120){streak++;d.setDate(d.getDate()-1);}else break;}return streak;}
function getDayTotals(sessions){const t={};sessions.forEach(s=>{t[s.date]=(t[s.date]||0)+s.duration;});return t;}
const F="'Nunito', sans-serif";

const TRACKER_TABS={
  cat:[
    {id:"anki_flash",label:"10 puzzles + 15 mixed Reasoning",emoji:"🃏"},
    {id:"cat_quant_time",label:"Drill + 30 arithmetic + 30 Math",emoji:"🔢"},
    {id:"cat_rc_passage",label:"10 errors + 10 para + Vocabulary",emoji:"📖"},
    {id:"cat_lrdi_time",label:"Mock Test + analysis",emoji:"🧩"},
    {id:"bank_reasoning",label:"2500+ Hardwork",emoji:"🧠"},
  ],
  personal:{
    morning:[{id:"pills_am",label:"Pills (AM)",emoji:"💊"},{id:"cream_am",label:"Cream (AM)",emoji:"🧴"},{id:"kettle",label:"Kettle",emoji:"🫖"}],
    evening:[{id:"cream_pm",label:"Cream (PM)",emoji:"🧴"},{id:"pills_pm",label:"Pills (PM)",emoji:"💊"}],
  },
};
function getAllTrackerHabits(tab){const t=TRACKER_TABS[tab];if(!t)return[];return Array.isArray(t)?t:Object.values(t).flat();}

function useDailyStatus(sessions,habits,habitLogs,trackerLogs,reflections,sleepLogs,gymLogs){
  const today=todayStr();
  const todayMins=sessions.filter(s=>s.date===today).reduce((a,s)=>a+s.duration,0);
  const checklistHabits=getAllTrackerHabits("cat");
  const checklistDone=checklistHabits.every(h=>trackerLogs.some(l=>l.date===today&&l.tab==="cat"&&l.habit_id===h.id&&l.done));
  const goalsOk=checklistDone&&todayMins>=120;
  const habitsOk=habits.length>0&&habits.every(h=>habitLogs.some(l=>l.habit_id===h.id&&l.date===today));
  const gymOk=gymLogs.some(g=>g.date===today);
  const spendingOk=true;
  const reflectOk=!!(reflections[today]&&reflections[today].note&&reflections[today].note.trim());
  const sleepOk=sleepLogs.length>0;
  return{goalsOk,habitsOk,gymOk,spendingOk,reflectOk,sleepOk};
}

function ThemeToggle({isDark,onToggle}){
  return(<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 4px",fontFamily:F}}><span style={{fontSize:12,fontWeight:600,color:isDark?"#aaa":"#666"}}>{isDark?"🌙 Dark":"☀️ Light"}</span><button onClick={onToggle} style={{width:44,height:24,borderRadius:12,border:"none",background:isDark?"#fff":"#000",position:"relative",cursor:"pointer",transition:"background 0.3s ease"}}><div style={{width:18,height:18,borderRadius:"50%",background:isDark?"#000":"#fff",position:"absolute",top:3,left:isDark?22:4,transition:"left 0.3s ease",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/></button></div>);
}

function TopNavBar({sessions,streak,todayMins,onMenuClick}){
  const T=useT();const[visible,setVisible]=useState(true);const lastY=useRef(0);const w=useWindowWidth();const mob=w<480;
  useEffect(()=>{const h=()=>{const y=window.scrollY;if(y>lastY.current&&y>60)setVisible(false);else setVisible(true);lastY.current=y;};window.addEventListener("scroll",h,{passive:true});return()=>window.removeEventListener("scroll",h);},[]);
  const dt=getDayTotals(sessions);const mx=Object.values(dt).length>0?Math.max(...Object.values(dt)):0;const hit=todayMins>=120;
  return(
    <div style={{position:"fixed",top:0,left:0,right:0,zIndex:1000,background:T.nav,borderBottom:`1px solid ${T.bd}`,transform:visible?"translateY(0)":"translateY(-100%)",transition:"transform 0.35s ease",padding:mob?"8px 10px":"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",fontFamily:F,boxShadow:visible?T.navSh:"none"}}>
      <div style={{display:"flex",alignItems:"center",gap:mob?6:10}}>
        <button onClick={onMenuClick} style={{border:"none",background:"none",cursor:"pointer",padding:4,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.tx} strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <span style={{fontSize:mob?11:13,fontWeight:700,display:"flex",alignItems:"center",gap:4,color:T.tx}}><span>⚡</span><span>{formatHM(mx)}</span><span style={{fontWeight:400,fontSize:mob?8:10,color:T.tx3}}>max</span></span>
      </div>
      {!mob&&(<div style={{flex:1,textAlign:"center",fontSize:13,fontWeight:700,color:T.tx2,fontStyle:"italic",padding:"0 12px"}}>"Flow State is Fragile"</div>)}
      <div style={{display:"flex",alignItems:"center",gap:5,background:hit?(streak>0?T.btn:T.bg3):"#E63946",color:hit?(streak>0?T.btnT:T.tx3):"#fff",padding:mob?"5px 10px":"6px 14px",borderRadius:30,fontSize:mob?12:13,fontWeight:700}}>
        <span style={{fontSize:mob?14:16}}>{hit?(streak>0?"🔥":"○"):"⚠️"}</span>
        <span>{streak}</span>
        <span style={{fontWeight:400,fontSize:mob?8:10,opacity:0.8}}>{hit?(streak===1?"day":"days"):"do 2h+"}</span>
      </div>
    </div>
  );
}

function Sidebar({open,onClose,page,setPage,sessions,onLogout,isDark,onToggleTheme,dailyStatus}){
  const T=useT();
  const items=[
    {key:PAGES.GOALS,label:"Goals",icon:"🎯",ok:dailyStatus.goalsOk},
    {key:PAGES.HABITS,label:"Habits",icon:"🔥",ok:dailyStatus.habitsOk},
    {key:PAGES.GYM,label:"Gym",icon:"🏋️",ok:dailyStatus.gymOk},
    {key:PAGES.SPENDING,label:"Spending",icon:"💸",ok:dailyStatus.spendingOk},
    {key:PAGES.REFLECTION,label:"Reflect",icon:"💭",ok:dailyStatus.reflectOk},
    {key:PAGES.SLEEP,label:"Sleep",icon:"🌙",ok:dailyStatus.sleepOk},
  ];
  const now=nowIST();const ys=String(now.getFullYear());const mn=now.toLocaleDateString("en-US",{month:"short"});
  const yMins=sessions.filter(s=>s.date.startsWith(ys)).reduce((a,s)=>a+s.duration,0);
  const mp=`${ys}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const mMins=sessions.filter(s=>s.date.startsWith(mp)).reduce((a,s)=>a+s.duration,0);
  const doneCount=items.filter(i=>i.ok).length;
  return(<>
    <div onClick={onClose} style={{position:"fixed",inset:0,background:T.over,zIndex:2000,opacity:open?1:0,pointerEvents:open?"auto":"none",transition:"opacity 0.3s ease"}}/>
    <div style={{position:"fixed",top:0,left:0,bottom:0,width:260,zIndex:2001,background:T.side,boxShadow:T.sideSh,transform:open?"translateX(0)":"translateX(-100%)",transition:"transform 0.3s ease",display:"flex",flexDirection:"column",fontFamily:F}}>
      <div style={{padding:"24px 20px 16px",borderBottom:`1px solid ${T.bd}`}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <span style={{fontSize:18,fontWeight:800,letterSpacing:"-0.02em",color:T.tx}}>Focus Maxing</span>
          <button onClick={onClose} style={{border:"none",background:"none",cursor:"pointer",fontSize:20,color:T.tx3,padding:0}}>✕</button>
        </div>
        <div style={{display:"flex",gap:16,fontSize:12,marginBottom:10}}>
          <div><div style={{fontSize:16,fontWeight:700,color:T.tx}}>{formatHM(mMins)}</div><div style={{color:T.tx3,fontSize:10,textTransform:"uppercase",letterSpacing:"0.08em"}}>{mn}</div></div>
          <div><div style={{fontSize:16,fontWeight:700,color:T.tx}}>{formatHM(yMins)}</div><div style={{color:T.tx3,fontSize:10,textTransform:"uppercase",letterSpacing:"0.08em"}}>{ys}</div></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={{flex:1,height:4,background:T.bd2,borderRadius:2,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${Math.round((doneCount/items.length)*100)}%`,background:doneCount===items.length?"#2A9D8F":"#E63946",borderRadius:2,transition:"width 0.4s"}}/>
          </div>
          <span style={{fontSize:10,fontWeight:700,color:doneCount===items.length?"#2A9D8F":"#E63946"}}>{doneCount}/{items.length}</span>
        </div>
      </div>
      <div style={{flex:1,padding:"12px 0",overflowY:"auto"}}>
        {items.map(i=>{const a=page===i.key;return(
          <button key={i.key} onClick={()=>{setPage(i.key);onClose();}} style={{display:"flex",alignItems:"center",gap:12,width:"100%",padding:"14px 24px",border:"none",cursor:"pointer",background:a?T.bgH:"transparent",color:T.tx,fontSize:14,fontWeight:a?700:500,fontFamily:F,textAlign:"left",transition:"background 0.15s ease",borderLeft:a?`3px solid ${T.tx}`:"3px solid transparent"}}>
            <span style={{fontSize:18}}>{i.icon}</span>
            <span style={{flex:1}}>{i.label}</span>
            {i.ok&&<span style={{fontSize:14}}>✅</span>}
          </button>);})}
      </div>
      <div style={{padding:"16px 20px",borderTop:`1px solid ${T.bd}`,display:"flex",flexDirection:"column",gap:12}}>
        <ThemeToggle isDark={isDark} onToggle={onToggleTheme}/>
        <button onClick={onLogout} style={{width:"100%",padding:"10px 0",border:`1px solid ${T.bd2}`,background:"transparent",cursor:"pointer",fontSize:11,fontFamily:F,fontWeight:700,color:T.tx3,letterSpacing:"0.06em",textTransform:"uppercase",borderRadius:6}}>Logout</button>
      </div>
    </div>
  </>);
}

function AuthPage(){
  const T=useT();const[isLogin,setIsLogin]=useState(true);const[email,setEmail]=useState("");const[pw,setPw]=useState("");const[error,setError]=useState("");const[loading,setLoading]=useState(false);const[confirmSent,setConfirmSent]=useState(false);const[resetSent,setResetSent]=useState(false);
  const submit=async()=>{setError("");if(!email.trim()||!pw.trim()){setError("Email and password required");return;}if(pw.length<6){setError("Password must be at least 6 characters");return;}setLoading(true);try{if(isLogin){const{error:e}=await supabase.auth.signInWithPassword({email,password:pw});if(e)throw e;}else{const{error:e}=await supabase.auth.signUp({email,password:pw});if(e)throw e;setConfirmSent(true);setLoading(false);return;}}catch(e){setError(e.message||"Something went wrong");}setLoading(false);};
  const forgot=async()=>{setError("");if(!email.trim()){setError("Enter your email first");return;}setLoading(true);try{const{error:e}=await supabase.auth.resetPasswordForEmail(email);if(e)throw e;setResetSent(true);}catch(e){setError(e.message);}setLoading(false);};
  const msgScreen=(icon,title,msg,btnText,onClick)=>(<div style={{maxWidth:400,margin:"0 auto",padding:"120px 24px",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:F,background:T.bg}}><div style={{fontSize:48,marginBottom:16}}>{icon}</div><div style={{fontSize:18,fontWeight:700,marginBottom:8,textAlign:"center",color:T.tx}}>{title}</div><div style={{fontSize:13,color:T.tx2,textAlign:"center",lineHeight:1.6,marginBottom:24}}>{msg} <strong>{email}</strong>.</div><button onClick={onClick} style={{border:`2px solid ${T.bd3}`,background:T.btn,color:T.btnT,padding:"12px 32px",fontSize:13,fontFamily:F,fontWeight:700,cursor:"pointer"}}>{btnText}</button></div>);
  if(resetSent)return msgScreen("🔑","Reset link sent","We sent a password reset link to","Back to Login",()=>{setResetSent(false);setIsLogin(true);});
  if(confirmSent)return msgScreen("✉️","Check your email","We sent a confirmation link to","Back to Login",()=>{setConfirmSent(false);setIsLogin(true);});
  const iStyle={width:"100%",border:`2px solid ${T.bd3}`,padding:"14px 16px",fontSize:14,fontFamily:F,background:"transparent",outline:"none",fontWeight:600,boxSizing:"border-box",color:T.tx};
  return(<div style={{maxWidth:400,margin:"0 auto",padding:"80px 24px",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:F,background:T.bg}}><div style={{marginBottom:40,textAlign:"center"}}><div style={{fontSize:32,fontWeight:800,letterSpacing:"-0.02em",marginBottom:4,color:T.tx}}>Focus Maxing</div><div style={{fontSize:12,color:T.tx3,letterSpacing:"0.15em",fontWeight:600}}>Track your upskilling</div></div><div style={{width:"100%",maxWidth:320}}><div style={{display:"flex",marginBottom:32,borderBottom:`2px solid ${T.bd3}`}}>{["Login","Sign Up"].map((l,i)=>{const a=i===0?isLogin:!isLogin;return(<button key={l} onClick={()=>{setIsLogin(i===0);setError("");}} style={{flex:1,padding:"12px 0",border:"none",cursor:"pointer",background:a?T.btn:"transparent",color:a?T.btnT:T.tx,fontSize:12,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",fontFamily:F}}>{l}</button>);})}</div><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email" autoComplete="email" onKeyDown={e=>e.key==="Enter"&&submit()} style={{...iStyle,marginBottom:12}}/><input value={pw} onChange={e=>setPw(e.target.value)} placeholder="Password" type="password" autoComplete={isLogin?"current-password":"new-password"} onKeyDown={e=>e.key==="Enter"&&submit()} style={{...iStyle,marginBottom:8}}/>{isLogin&&(<div style={{textAlign:"right",marginBottom:4}}><button onClick={forgot} style={{border:"none",background:"none",cursor:"pointer",fontSize:11,fontFamily:F,fontWeight:600,color:T.tx3,textDecoration:"underline",padding:0}}>Forgot Password?</button></div>)}{error&&(<div style={{fontSize:12,color:"#E63946",fontFamily:F,fontWeight:600,padding:"8px 0",textAlign:"center"}}>{error}</div>)}<button onClick={submit} disabled={loading} style={{width:"100%",padding:"14px 0",border:`2px solid ${T.bd3}`,background:T.btn,color:T.btnT,fontSize:13,fontFamily:F,fontWeight:700,cursor:loading?"default":"pointer",marginTop:16,opacity:loading?0.5:1}}>{loading?"...":isLogin?"Login":"Create Account"}</button></div><div style={{marginTop:60,fontSize:12,color:T.tx4,fontFamily:F,textAlign:"center"}}>Vibe coded by Nithin Chowdary ❤️</div></div>);
}

function TrackerSection({trackerLogs,setTrackerLogs,sessions,setSessions,reflections}){
  const T=useT();const w=useWindowWidth();const mob=w<480;
  const[activeTab,setActiveTab]=useState("cat");
  const[userId,setUserId]=useState(null);
  const[mTag,setMTag]=useState("");const[mMins,setMMins]=useState("");
  useEffect(()=>{supabase.auth.getUser().then(({data:{user}})=>{if(user)setUserId(user.id);});},[]);
  const today=todayStr();
  const isDone=(tab,habitId)=>trackerLogs.some(l=>l.date===today&&l.tab===tab&&l.habit_id===habitId&&l.done);
  const toggle=async(tab,habitId)=>{if(!userId)return;const current=isDone(tab,habitId);const newDone=await toggleTrackerHabit(userId,today,tab,habitId,current);setTrackerLogs(prev=>{const filtered=prev.filter(l=>!(l.date===today&&l.tab===tab&&l.habit_id===habitId));return[...filtered,{user_id:userId,date:today,tab,habit_id:habitId,done:newDone}];});};
  const getStreak=(tab,habitId)=>{let s=0;const d=new Date(today+"T12:00:00");while(true){const key=dateToStr(d);const done=trackerLogs.some(l=>l.date===key&&l.tab===tab&&l.habit_id===habitId&&l.done);if(!done&&key===today){d.setDate(d.getDate()-1);continue;}if(!done)break;s++;d.setDate(d.getDate()-1);}return s;};
  const getTabStreak=(tab)=>{const habits=getAllTrackerHabits(tab);let s=0;const d=new Date(today+"T12:00:00");while(true){const key=dateToStr(d);const allDone=habits.every(h=>trackerLogs.some(l=>l.date===key&&l.tab===tab&&l.habit_id===h.id&&l.done));if(!allDone&&key===today){d.setDate(d.getDate()-1);continue;}if(!allDone)break;s++;d.setDate(d.getDate()-1);}return s;};
  const addSession=useCallback(async(ns)=>{setSessions(p=>[...p,ns]);const sv=await insertSession(ns);if(sv){setSessions(p=>p.map(s=>s.ts===ns.ts&&s.tag===ns.tag?{id:sv.id,tag:sv.tag,duration:sv.duration,date:sv.date,ts:Number(sv.ts)}:s));}},[setSessions]);
  const logManual=()=>{const mins=parseInt(mMins);if(!mTag.trim()||isNaN(mins)||mins<=0)return;addSession({id:Date.now(),tag:mTag.trim(),duration:mins,date:today,ts:Date.now()});setMTag("");setMMins("");};
  const todayMins=sessions.filter(s=>s.date===today).reduce((a,s)=>a+s.duration,0);
  const renderHabits=(tab,habits)=>(<div>{habits.map(h=>{const done=isDone(tab,h.id);const streak=getStreak(tab,h.id);return(<div key={h.id} onClick={()=>toggle(tab,h.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",marginBottom:5,borderRadius:8,background:done?"rgba(42,157,143,0.1)":T.bg3,border:`1px solid ${done?"#2A9D8F":T.bd}`,cursor:"pointer",userSelect:"none",fontFamily:F}}><div style={{width:18,height:18,borderRadius:"50%",border:`1.5px solid ${done?"#2A9D8F":T.tx4}`,background:done?"#2A9D8F":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",flexShrink:0,fontWeight:700}}>{done&&"✓"}</div><span style={{fontSize:14}}>{h.emoji}</span><span style={{flex:1,fontSize:12,color:done?"#2A9D8F":T.tx2,fontWeight:600,textDecoration:done?"line-through":"none"}}>{h.label}</span>{streak>0&&<span style={{fontSize:11,fontWeight:700,color:"#ff6b35"}}>🔥{streak}</span>}</div>);})}</div>);
  const tabs=["cat","personal"];const tabLabels={cat:"📚 LevelUp",personal:"🌿 Health"};
  const habits=getAllTrackerHabits(activeTab);const doneTodayCount=habits.filter(h=>isDone(activeTab,h.id)).length;const tabStreak=getTabStreak(activeTab);const pct=Math.round((doneTodayCount/habits.length)*100);
  const iStyle={border:`2px solid ${T.bd3}`,padding:"10px 14px",fontSize:14,fontFamily:F,background:"transparent",outline:"none",boxSizing:"border-box",color:T.tx};
  return(
    <div style={{background:T.bg2,borderRadius:10,padding:mob?14:18,border:`1px solid ${T.bd}`,fontFamily:F}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,fontWeight:600}}>Daily Checklist</div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:14,fontWeight:800,color:T.tx}}>{tabStreak>0?`${tabStreak} 🔥`:"0"}</span>
          <span style={{fontSize:10,color:T.tx3}}>streak</span>
          <span style={{fontSize:12,fontWeight:700,color:doneTodayCount===habits.length?"#2A9D8F":T.tx3}}>{doneTodayCount}/{habits.length}</span>
        </div>
      </div>
      <div style={{height:3,background:T.bg3,borderRadius:2,overflow:"hidden",marginBottom:12}}>
        <div style={{height:"100%",width:`${pct}%`,background:pct===100?"#2A9D8F":"#E63946",borderRadius:2,transition:"width 0.4s"}}/>
      </div>
      <div style={{display:"flex",background:T.bg3,borderRadius:6,overflow:"hidden",marginBottom:12,border:`1px solid ${T.bd}`}}>
        {tabs.map(tab=>(<button key={tab} onClick={()=>setActiveTab(tab)} style={{flex:1,padding:"8px 6px",border:"none",background:activeTab===tab?T.btn:"transparent",color:activeTab===tab?T.btnT:T.tx3,fontFamily:F,fontSize:11,fontWeight:700,cursor:"pointer"}}>{tabLabels[tab]}</button>))}
      </div>
      {activeTab==="cat"&&renderHabits("cat",TRACKER_TABS.cat)}
      {activeTab==="personal"&&(<><div style={{fontSize:9,color:T.tx3,letterSpacing:3,textTransform:"uppercase",marginBottom:6,fontWeight:600}}>☀️ Morning</div>{renderHabits("personal",TRACKER_TABS.personal.morning)}<div style={{fontSize:9,color:T.tx3,letterSpacing:3,textTransform:"uppercase",margin:"10px 0 6px",fontWeight:600}}>🌙 Evening</div>{renderHabits("personal",TRACKER_TABS.personal.evening)}</>)}
      <div style={{borderTop:`1px solid ${T.bd}`,marginTop:14,paddingTop:14}}>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <input value={mTag} onChange={e=>setMTag(e.target.value)} placeholder="Study tag" style={{...iStyle,flex:1,minWidth:100,padding:"8px 12px",fontSize:13}} onKeyDown={e=>e.key==="Enter"&&logManual()}/>
          <input value={mMins} onChange={e=>setMMins(e.target.value)} placeholder="mins" type="number" style={{...iStyle,width:72,padding:"8px 10px",fontSize:13}} onKeyDown={e=>e.key==="Enter"&&logManual()}/>
          <button onClick={logManual} style={{padding:"9px 18px",border:`2px solid ${T.bd3}`,background:T.btn,color:T.btnT,fontSize:13,fontFamily:F,fontWeight:700,cursor:"pointer"}}>+</button>
          {todayMins>0&&<span style={{fontSize:12,fontWeight:700,color:todayMins>=120?"#2A9D8F":"#E63946"}}>{formatHM(todayMins)} {todayMins>=120?"🔥":""}</span>}
        </div>
      </div>
    </div>
  );
}

async function exportToExcel(sessions,reflections){const XLSX=await import("xlsx");const dm={};sessions.forEach(s=>{dm[s.date]=(dm[s.date]||0)+s.duration;});const dd=Object.entries(dm).sort((a,b)=>a[0].localeCompare(b[0])).map(([date,mins])=>({Date:date,Day:new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long"}),Hours:+(mins/60).toFixed(2),Status:mins>=120?"🔥":"❌",Reflection:reflections[date]?.note||""}));const wm={};Object.entries(dm).forEach(([date,mins])=>{const d=new Date(date+"T12:00:00");const m=new Date(d);m.setDate(d.getDate()-((d.getDay()+6)%7));const s=new Date(m);s.setDate(m.getDate()+6);const l=`${m.toLocaleDateString("en-US",{month:"short",day:"numeric"})} - ${s.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;wm[l]=(wm[l]||0)+mins;});const wd=Object.entries(wm).map(([w,m])=>({Week:w,Hours:+(m/60).toFixed(2)}));const mm={};Object.entries(dm).forEach(([date,mins])=>{const k=date.slice(0,7);mm[k]=(mm[k]||0)+mins;});const md=Object.entries(mm).sort((a,b)=>a[0].localeCompare(b[0])).map(([k,m])=>{const[y,mo]=k.split("-");return{Month:new Date(parseInt(y),parseInt(mo)-1).toLocaleDateString("en-US",{month:"long",year:"numeric"}),Hours:+(m/60).toFixed(2)};});const tm={};const tf={};sessions.forEach(s=>{tm[s.tag]=(tm[s.tag]||0)+s.duration;if(!tf[s.tag]||s.date<tf[s.tag])tf[s.tag]=s.date;});const td=Object.entries(tm).sort((a,b)=>b[1]-a[1]).map(([t,m])=>({Topic:t,Hours:+(m/60).toFixed(2),Started:tf[t]||""}));const rd=Object.entries(reflections||{}).filter(([,r])=>r.note).sort((a,b)=>b[0].localeCompare(a[0])).map(([date,r])=>({Date:date,Day:new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long"}),Hours:r.hrsOverride!=null?+r.hrsOverride.toFixed(2):+((dm[date]||0)/60).toFixed(2),Reflection:r.note}));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(dd),"Day-wise");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(wd),"Week-wise");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(md),"Month-wise");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(td),"Topic-wise");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rd),"Reflections");XLSX.writeFile(wb,`FocusMaxing_Export_${todayStr()}.xlsx`);}

function GoalsPage({sessions,setSessions,goals,setGoals,trackerLogs,setTrackerLogs,reflections}){
  const T=useT();const w=useWindowWidth();const mob=w<480;
  const[selId,setSelId]=useState(()=>localStorage.getItem("fm_selectedGoal")||"");
  const[showAdd,setShowAdd]=useState(false);
  const[nName,setNName]=useState("");const[nTag,setNTag]=useState("");const[nHrs,setNHrs]=useState("");const[nStartDate,setNStartDate]=useState(todayStr());const[nDate,setNDate]=useState("");
  const[projMins,setProjMins]=useState({});const[weekAnchor,setWeekAnchor]=useState(todayStr());
  useEffect(()=>{if(selId)localStorage.setItem("fm_selectedGoal",selId);},[selId]);
  useEffect(()=>{if(goals.length>0&&!goals.find(g=>g.id===selId)){setSelId(goals[0].id);}},[goals]);
  const allTags=[...new Set(sessions.map(s=>s.tag))].sort();
  const goal=goals.find(g=>g.id===selId);
  const addGoal=async()=>{if(!nName.trim()||!nTag||!nHrs||!nStartDate||!nDate)return;const sv=await insertGoal(nName.trim(),nTag,parseFloat(nHrs),nStartDate,nDate);if(sv){setGoals(p=>[...p,sv]);setSelId(sv.id);}setShowAdd(false);setNName("");setNTag("");setNHrs("");setNStartDate(todayStr());setNDate("");};
  let S=null;
  if(goal){
    const ts=sessions.filter(s=>s.tag===goal.tag);const totalMins=ts.reduce((a,s)=>a+s.duration,0);const totalH=totalMins/60;
    const created=new Date(goal.startDate+"T12:00:00");const target=new Date(goal.targetDate+"T12:00:00");const today=new Date(todayStr()+"T12:00:00");
    const dTotal=Math.max(1,Math.ceil((target-created)/86400000)+1);const dElapsed=Math.max(1,Math.ceil((today-created)/86400000)+1);const dRemain=Math.max(0,Math.ceil((target-today)/86400000)+1);
    const hRemain=Math.max(0,goal.targetHours-totalH);const avgOrig=goal.targetHours/dTotal;const avgNow=dRemain>0?hRemain/dRemain:(hRemain>0?99:0);
    const avgActual=totalH/dElapsed;const expected=avgOrig*dElapsed;const ratio=expected>0?totalH/expected:(totalH>0?2:0);
    const todayLoggedH=ts.filter(s=>s.date===todayStr()).reduce((a,s)=>a+s.duration,0)/60;
    const previousLag=Math.max(0,avgOrig*(dElapsed-1)-(totalH-todayLoggedH));const lagH=previousLag+Math.max(0,avgOrig-todayLoggedH);const leadH=Math.max(0,totalH-expected);
    let status,sColor,sLabel,sEmoji;
    if(totalH>=goal.targetHours){status="done";sColor="#2A9D8F";sLabel="Goal Complete!";sEmoji="🏆";}
    else if(ratio>=1.0){status="green";sColor="#2A9D8F";sLabel="On Track";sEmoji="🟢";}
    else if(ratio>=0.8){status="orange";sColor="#E63946";sLabel="Slightly Behind";sEmoji="🔴";}
    else{status="red";sColor="#E63946";sLabel="Behind Schedule";sEmoji="🔴";}
    const progress=Math.min(totalH/goal.targetHours,1);const isExpired=dRemain<=0&&status!=="done";
    if(isExpired){sColor="#E63946";sLabel="Deadline Passed";sEmoji="⏰";}
    const anchorD=new Date(weekAnchor+"T12:00:00");const dow=anchorD.getDay();const mon=new Date(anchorD);mon.setDate(anchorD.getDate()-((dow+6)%7));
    const wDays=[];for(let i=0;i<7;i++){const dd=new Date(mon);dd.setDate(mon.getDate()+i);wDays.push(dateToStr(dd));}
    const dLabels=["M","T","W","TH","F","SA","SU"];const tagDT={};ts.forEach(s=>{tagDT[s.date]=(tagDT[s.date]||0)+s.duration;});
    const wData=wDays.map(d=>({date:d,mins:tagDT[d]||0}));const wTotal=wData.reduce((a,d)=>a+d.mins,0);
    S={totalH,hRemain,dTotal,dElapsed,dRemain,avgOrig,avgNow,avgActual,ratio,status,sColor,sLabel,sEmoji,progress,isExpired,wDays,dLabels,wData,wTotal,tagDT,expected,lagH,leadH};
  }
  const iStyle={border:`2px solid ${T.bd3}`,padding:"10px 14px",fontSize:14,fontFamily:F,background:"transparent",outline:"none",boxSizing:"border-box",color:T.tx};
  const selStyle={border:`2px solid ${T.bd3}`,padding:"10px 14px",fontSize:14,fontFamily:F,fontWeight:700,background:T.sel,color:T.tx,outline:"none",cursor:"pointer",borderRadius:4,boxSizing:"border-box"};
  return(
    <div style={{fontFamily:F}}>
      <TrackerSection trackerLogs={trackerLogs} setTrackerLogs={setTrackerLogs} sessions={sessions} setSessions={setSessions} reflections={reflections}/>
      <div style={{height:32}}/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,gap:10,flexWrap:"wrap"}}>
        <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,fontWeight:600}}>🎯 Goals</div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {goals.length>0&&(<select value={selId} onChange={e=>{setSelId(e.target.value);setProjMins({});}} style={{...selStyle,maxWidth:mob?180:260}}>{goals.map(g=>(<option key={g.id} value={g.id}>{g.name}</option>))}</select>)}
          <button onClick={()=>setShowAdd(!showAdd)} style={{padding:"10px 18px",border:`2px solid ${T.bd3}`,background:showAdd?"transparent":T.btn,color:showAdd?T.tx:T.btnT,fontSize:12,fontFamily:F,fontWeight:700,cursor:"pointer"}}>{showAdd?"✕":"+ New"}</button>
        </div>
      </div>
      {showAdd&&(<div style={{background:T.bg2,borderRadius:10,padding:mob?16:20,marginBottom:24,border:`1px solid ${T.bd}`}}><div style={{fontSize:11,textTransform:"uppercase",letterSpacing:"0.12em",color:T.tx3,fontWeight:600,marginBottom:14}}>Create New Goal</div><div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:10,marginBottom:12}}><input value={nName} onChange={e=>setNName(e.target.value)} placeholder="Goal name" style={iStyle}/><select value={nTag} onChange={e=>setNTag(e.target.value)} style={selStyle}><option value="">Select tag...</option>{allTags.map(t=>(<option key={t} value={t}>{t}</option>))}</select><input value={nHrs} onChange={e=>setNHrs(e.target.value)} placeholder="Target hours" type="number" style={iStyle}/><div style={{display:"flex",gap:8}}><div style={{flex:1,display:"flex",flexDirection:"column",gap:4}}><label style={{fontSize:10,color:T.tx3,fontWeight:600}}>START</label><input value={nStartDate} onChange={e=>setNStartDate(e.target.value)} type="date" style={iStyle}/></div><div style={{flex:1,display:"flex",flexDirection:"column",gap:4}}><label style={{fontSize:10,color:T.tx3,fontWeight:600}}>END</label><input value={nDate} onChange={e=>setNDate(e.target.value)} type="date" style={iStyle}/></div></div></div><button onClick={addGoal} style={{padding:"10px 28px",border:`2px solid ${T.bd3}`,background:T.btn,color:T.btnT,fontSize:12,fontFamily:F,fontWeight:700,cursor:"pointer",letterSpacing:"0.06em",textTransform:"uppercase"}}>Create Goal</button></div>)}
      {goals.length===0&&!showAdd&&(<div style={{textAlign:"center",padding:"40px 20px",color:T.tx4,fontSize:14}}><div style={{fontSize:48,marginBottom:16}}>🎯</div><div style={{fontWeight:700,color:T.tx3,marginBottom:8}}>No goals yet</div></div>)}
      {goal&&S&&(<div>
        <div style={{background:S.sColor+"18",border:`2px solid ${S.sColor}40`,borderRadius:12,padding:mob?"16px":"20px 24px",marginBottom:24,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <div><div style={{fontSize:mob?18:22,fontWeight:800,color:T.tx,marginBottom:4}}>{goal.name}</div>{S.status!=="done"&&!S.isExpired&&(()=>{const projPct=Math.round((S.avgActual*S.dTotal)/goal.targetHours*100);const pColor=projPct>=90?"#2A9D8F":"#E63946";return(<div style={{fontSize:12,fontWeight:600,color:pColor}}>⚠ Current pace → {projPct}% of goal</div>);})()}</div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><span style={{fontSize:24}}>{S.sEmoji}</span><span style={{fontSize:14,fontWeight:700,color:S.sColor}}>{S.sLabel}</span>{S.status!=="done"&&(S.status==="green"?(<span style={{fontSize:11,fontWeight:700,color:"#2A9D8F",background:"#2A9D8F18",padding:"3px 8px",borderRadius:4}}>{S.leadH>0?`leading by ${S.leadH.toFixed(1)}h`:"on track"}</span>):S.lagH>0?(<span style={{fontSize:11,fontWeight:700,color:"#E63946",background:"#E6394618",padding:"3px 8px",borderRadius:4}}>lagging by {S.lagH.toFixed(1)}h</span>):null)}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"auto 1fr",gap:mob?20:32,marginBottom:28,alignItems:"center"}}>
          <div style={{display:"flex",justifyContent:"center"}}><div style={{position:"relative",width:160,height:160}}><svg width={160} height={160} style={{transform:"rotate(-90deg)"}}><circle cx={80} cy={80} r={66} fill="none" stroke={T.bd} strokeWidth={10}/><circle cx={80} cy={80} r={66} fill="none" stroke={S.sColor} strokeWidth={10} strokeLinecap="round" strokeDasharray={2*Math.PI*66} strokeDashoffset={2*Math.PI*66*(1-S.progress)} style={{transition:"stroke-dashoffset 0.6s ease"}}/></svg><div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}><div style={{fontSize:28,fontWeight:800,color:T.tx}}>{Math.round(S.progress*100)}%</div><div style={{fontSize:10,color:T.tx3,letterSpacing:"0.1em",fontWeight:600}}>Complete</div></div></div></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[{label:"Logged",value:`${S.totalH.toFixed(1)}h`,sub:`of ${goal.targetHours}h`,color:"#2A9D8F"},{label:"Remaining",value:`${S.hRemain.toFixed(1)}h`,sub:`${S.dRemain}d left`,color:"#E63946"},{label:"Your Pace",value:`${S.avgActual.toFixed(1)}h/d`,sub:`need ${S.avgNow>20?"—":S.avgNow.toFixed(1)}h/d`,color:S.avgActual>=S.avgNow?"#2A9D8F":"#E63946"},{label:"Required",value:S.avgNow>20?"—":`${S.avgNow.toFixed(1)}h/d`,sub:S.status==="done"?"Done!":S.lagH>0?`behind ${S.lagH.toFixed(1)}h`:"on track",color:S.avgNow>S.avgOrig?"#E63946":"#2A9D8F"}].map(s=>(<div key={s.label} style={{background:T.bg3,borderRadius:8,padding:mob?"12px":"14px 16px"}}><div style={{fontSize:10,color:T.tx3,letterSpacing:"0.1em",fontWeight:600,marginBottom:4}}>{s.label}</div><div style={{fontSize:mob?18:22,fontWeight:800,color:s.color}}>{s.value}</div><div style={{fontSize:10,color:T.tx2,marginTop:2}}>{s.sub}</div></div>))}
          </div>
        </div>
        {(()=>{
          const weeklyNeedMins=Math.round(S.avgNow*60*7);const todayIdx=S.wDays.findIndex(d=>d===todayStr());const projTotal=S.wDays.reduce((a,d)=>a+(projMins[d]||0),0);const simTotal=S.wTotal+projTotal;const wRemainMins=Math.max(0,weeklyNeedMins-simTotal);const remainDays=Math.max(1,todayIdx>=0?7-todayIdx-1:7);const dynamicDaily=remainDays>0?Math.round(wRemainMins/remainDays):0;const allMins=S.wData.map(d=>d.mins+(projMins[d.date]||0));const scaleMax=Math.max(dynamicDaily*1.5,Math.max(...allMins),1);
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
                {S.wData.map((d,i)=>{const isFut=d.date>todayStr();const proj=projMins[d.date]||0;const actualH=d.mins>0?Math.max((d.mins/scaleMax)*100,8):isFut?0:4;const projH=proj>0?Math.max((proj/scaleMax)*100,4):0;const totalMins=d.mins+proj;let bColor=isFut&&!proj?T.bd:totalMins>=dynamicDaily?"#2A9D8F":totalMins>0?"#E63946":T.bd2;
                return(<div key={d.date} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:140,maxWidth:60}}>
                  {totalMins>0&&<span style={{fontSize:9,fontWeight:700,color:bColor,marginBottom:2}}>{formatHM(totalMins)}</span>}
                  {proj>0&&<div style={{width:"65%",height:projH,background:bColor,borderRadius:"3px 3px 0 0",opacity:0.4,minHeight:4}}/>}
                  <div style={{width:"65%",height:actualH,background:isFut&&!d.mins?T.bd:bColor,borderRadius:proj>0?"0":"3px 3px 0 0",minHeight:d.mins>0?6:isFut?0:2,transition:"height 0.3s ease"}}/>
                  <span style={{fontSize:10,fontWeight:600,color:d.date===todayStr()?T.tx:T.tx3,marginTop:4}}>{S.dLabels[i]}</span>
                </div>);})}
              </div>
              {dynamicDaily>0&&(()=>{const linePos=Math.min((dynamicDaily/scaleMax)*100,100);return linePos>0&&linePos<=100?(<div style={{position:"absolute",left:0,right:0,bottom:`${8+28+linePos*0.92}px`,borderTop:"2px dashed #E63946",opacity:0.5,pointerEvents:"none"}}><span style={{position:"absolute",right:0,top:-14,fontSize:8,color:"#E63946",fontWeight:700,fontFamily:F}}>{formatHM(dynamicDaily)}/day</span></div>):null;})()}
            </div>
            <div style={{display:"flex",gap:mob?6:10,marginBottom:12}}>
              {S.wData.map((d)=>{const isEditable=d.date>=todayStr();return(<div key={d.date} style={{flex:1,maxWidth:60,display:"flex",justifyContent:"center"}}>{isEditable?(<input value={projMins[d.date]?String(Math.round(projMins[d.date]/60*10)/10):""} onChange={e=>{const v=parseFloat(e.target.value);setProjMins(p=>({...p,[d.date]:isNaN(v)||v<=0?0:Math.round(v*60)}));}} placeholder="h" type="number" step="0.5" style={{width:"100%",maxWidth:48,border:`1px solid ${T.bd2}`,borderRadius:4,padding:"4px 2px",fontSize:10,fontFamily:F,fontWeight:600,textAlign:"center",background:T.bg3,color:T.tx,outline:"none",boxSizing:"border-box"}}/>):(<span style={{fontSize:9,color:T.tx4}}>—</span>)}</div>);})}
            </div>
            <div style={{background:T.bg3,borderRadius:8,padding:"12px 16px",marginBottom:24}}>
              <span style={{fontSize:12,fontWeight:600,color:T.tx}}>Week: {formatHM(S.wTotal)}{projTotal>0&&<span style={{color:"#457B9D"}}> + {formatHM(projTotal)} planned = {formatHM(simTotal)}</span>}</span>
              <span style={{fontSize:12,color:T.tx3,marginLeft:8}}>· Need {formatHM(weeklyNeedMins)}/wk</span>
              {simTotal>=weeklyNeedMins?<span style={{marginLeft:8}}>🔥</span>:<span style={{marginLeft:8,color:"#E63946",fontSize:11,fontWeight:600}}> — {formatHM(wRemainMins)} left in {remainDays}d</span>}
            </div>
          </>);})()}
        <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,fontWeight:600,marginBottom:14}}>Timeline</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:32}}>
          {[{label:"Started",value:new Date(goal.startDate+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}),sub:`Day ${S.dElapsed} of ${S.dTotal}`},{label:"Today",value:new Date(todayStr()+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}),sub:`${Math.round(S.dElapsed/S.dTotal*100)}% elapsed`},{label:"Deadline",value:new Date(goal.targetDate+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}),sub:`${S.dRemain} days left`}].map(t=>(<div key={t.label} style={{background:T.bg3,borderRadius:8,padding:"12px",textAlign:"center"}}><div style={{fontSize:10,color:T.tx3,letterSpacing:"0.1em",fontWeight:600,marginBottom:4}}>{t.label}</div><div style={{fontSize:15,fontWeight:700,color:T.tx}}>{t.value}</div><div style={{fontSize:10,color:T.tx2,marginTop:2}}>{t.sub}</div></div>))}
        </div>
      </div>)}
      <div style={{borderTop:`1px solid ${T.bd}`,paddingTop:32,display:"flex",justifyContent:"center",paddingBottom:8}}>
        <button onClick={()=>exportToExcel(sessions,reflections)} disabled={sessions.length===0} style={{padding:"10px 28px",border:`2px solid ${T.bd3}`,background:T.btn,color:T.btnT,fontSize:11,fontFamily:F,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",cursor:sessions.length>0?"pointer":"default",opacity:sessions.length>0?1:0.3}}>↓ Export Excel</button>
      </div>
      <div style={{marginTop:32,padding:"14px 20px",borderRadius:12,background:T.ftBg,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontSize:13,fontWeight:600,color:T.ftC}}>Vibe coded by Nithin Chowdary <span style={{color:"#E53E3E",fontSize:15}}>❤️</span></span>
      </div>
    </div>
  );
}

const HABIT_ICONS=["🎯","📚","💪","🏃","🧘","💧","🥗","😴","☕","🧠","✍️","🎨","🎵","💻","🌱","⚡","🔥","🌟","📖","🏋️","🚴","🧗","🏊","🧹","📝","🎧","🌞","🙏","💰","📅"];
function HabitsPage({habits,setHabits,habitLogs,setHabitLogs}){
  const T=useT();const w=useWindowWidth();const mob=w<480;
  const[showAdd,setShowAdd]=useState(false);
  const[nName,setNName]=useState("");const[nIcon,setNIcon]=useState("🎯");const[nStart,setNStart]=useState(todayStr());
  const[calHabit,setCalHabit]=useState("__all__");
  const[calMonth,setCalMonth]=useState(()=>{const d=nowIST();return{y:d.getFullYear(),m:d.getMonth()};});
  const addHabit=async()=>{if(!nName.trim()||!nStart)return;const sv=await insertHabit(nName.trim(),nIcon,nStart);if(sv){setHabits(p=>[...p,sv]);setShowAdd(false);setNName("");setNIcon("🎯");setNStart(todayStr());}};
  const toggleToday=async(habitId)=>{const today=todayStr();const existing=habitLogs.find(l=>l.habit_id===habitId&&l.date===today);const result=await toggleHabitLog(habitId,today,!!existing);if(existing){setHabitLogs(p=>p.filter(l=>!(l.habit_id===habitId&&l.date===today)));}else if(result){setHabitLogs(p=>[...p,result]);}};
  const getHabitStats=(habit)=>{const logs=habitLogs.filter(l=>l.habit_id===habit.id);const logDates=new Set(logs.map(l=>l.date));const today=todayStr();const start=new Date(habit.start_date+"T12:00:00");const todayDate=new Date(today+"T12:00:00");const doneToday=logDates.has(today);let streak=0;const d=new Date(todayDate);if(doneToday){streak=1;d.setDate(d.getDate()-1);}else{d.setDate(d.getDate()-1);}while(d>=start){if(logDates.has(dateToStr(d))){streak++;d.setDate(d.getDate()-1);}else break;}let best=0,cur=0;const allDates=[...logDates].sort();for(let i=0;i<allDates.length;i++){if(i===0){cur=1;}else{const prev=new Date(allDates[i-1]+"T12:00:00");const curD=new Date(allDates[i]+"T12:00:00");if((curD-prev)===86400000)cur++;else cur=1;}if(cur>best)best=cur;}return{totalDone:logs.length,streak,best,doneToday,logDates};};
  const dateHabitMap={};habitLogs.forEach(l=>{if(!dateHabitMap[l.date])dateHabitMap[l.date]=new Set();dateHabitMap[l.date].add(l.habit_id);});
  const habitsActiveOn=(dateStr)=>habits.filter(h=>h.start_date<=dateStr);
  const getAllHabitsStats=()=>{if(habits.length===0)return{streak:0,best:0,doneToday:false,completedDates:new Set()};const completed=new Set();const allDates=[...new Set(habitLogs.map(l=>l.date))].sort();allDates.forEach(d=>{const active=habitsActiveOn(d);if(active.length===0)return;const doneIds=dateHabitMap[d]||new Set();if(active.every(h=>doneIds.has(h.id)))completed.add(d);});const today=todayStr();const doneToday=completed.has(today);let streak=0;const d=new Date(today+"T12:00:00");if(doneToday){streak=1;d.setDate(d.getDate()-1);}else{d.setDate(d.getDate()-1);}const earliestStart=habits.reduce((a,h)=>h.start_date<a?h.start_date:a,habits[0].start_date);const earliestD=new Date(earliestStart+"T12:00:00");while(d>=earliestD){if(completed.has(dateToStr(d))){streak++;d.setDate(d.getDate()-1);}else break;}let best=0,cur=0;const sortedC=[...completed].sort();for(let i=0;i<sortedC.length;i++){if(i===0)cur=1;else{const prev=new Date(sortedC[i-1]+"T12:00:00");const curD=new Date(sortedC[i]+"T12:00:00");if((curD-prev)===86400000)cur++;else cur=1;}if(cur>best)best=cur;}return{streak,best,doneToday,completedDates:completed};};
  const renderCalendar=()=>{const{y,m}=calMonth;const dim=new Date(y,m+1,0).getDate();const firstDow=(new Date(y,m,1).getDay()+6)%7;const cells=[];for(let i=0;i<firstDow;i++)cells.push(null);for(let d=1;d<=dim;d++)cells.push(d);while(cells.length%7!==0)cells.push(null);const tk=todayStr();const isAll=calHabit==="__all__";const habit=isAll?null:habits.find(h=>h.id===calHabit);const allStats=isAll?getAllHabitsStats():null;const start=isAll?(habits.length>0?habits.reduce((a,h)=>h.start_date<a?h.start_date:a,habits[0].start_date):tk):habit.start_date;const logDates=isAll?allStats.completedDates:new Set(habitLogs.filter(l=>l.habit_id===habit.id).map(l=>l.date));const cellSize=mob?28:32;return(<div><div style={{display:"grid",gridTemplateColumns:"repeat(7, 1fr)",gap:3,marginBottom:3,maxWidth:cellSize*7+18,margin:"0 auto 3px"}}>{["M","T","W","T","F","S","S"].map((d,i)=>(<div key={i} style={{textAlign:"center",fontSize:9,fontWeight:700,color:T.tx3,height:18,lineHeight:"18px"}}>{d}</div>))}</div><div style={{display:"grid",gridTemplateColumns:"repeat(7, 1fr)",gap:3,maxWidth:cellSize*7+18,margin:"0 auto"}}>{cells.map((day,i)=>{if(day===null)return<div key={`e${i}`} style={{width:cellSize,height:cellSize}}/>;const k=`${y}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;const done=logDates.has(k);const isFuture=k>tk;const beforeStart=k<start;const isToday=k===tk;let partial=false;if(isAll&&!done&&!isFuture&&!beforeStart){const active=habitsActiveOn(k);const doneIds=dateHabitMap[k]||new Set();const doneCount=active.filter(h=>doneIds.has(h.id)).length;if(doneCount>0&&doneCount<active.length)partial=true;}let bg=T.bg3,color=T.tx3;if(beforeStart){bg="transparent";color=T.tx4;}else if(done){bg="#2A9D8F";color="#fff";}else if(isFuture){bg=T.bg3;color=T.tx4;}else if(partial){bg="#E63946";color="#fff";}else{bg=T.rR;color="#E63946";}return(<div key={i} style={{width:cellSize,height:cellSize,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:isToday?800:600,background:bg,color,borderRadius:4,border:isToday?`2px solid ${T.bd3}`:"none",boxSizing:"border-box"}}>{day}</div>);})}</div></div>);};
  const shiftMonth=(dir)=>{setCalMonth(p=>{let nm=p.m+dir,ny=p.y;if(nm<0){nm=11;ny--;}if(nm>11){nm=0;ny++;}return{y:ny,m:nm};});};
  const monthLabel=new Date(calMonth.y,calMonth.m).toLocaleDateString("en-US",{month:"long",year:"numeric"});
  const iStyle={border:`2px solid ${T.bd3}`,padding:"10px 14px",fontSize:14,fontFamily:F,background:"transparent",outline:"none",boxSizing:"border-box",color:T.tx};
  const calStats=(()=>{if(calHabit==="__all__"){const s=getAllHabitsStats();return{fireDays:s.completedDates.size,streak:s.streak,best:s.best};}const h=habits.find(hh=>hh.id===calHabit);if(!h)return{fireDays:0,streak:0,best:0};const s=getHabitStats(h);return{fireDays:s.totalDone,streak:s.streak,best:s.best};})();
  return(<div style={{fontFamily:F}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,gap:10,flexWrap:"wrap"}}><div style={{fontSize:11,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,fontWeight:600}}>🔥 Habit Streaks</div><button onClick={()=>setShowAdd(!showAdd)} style={{padding:"10px 18px",border:`2px solid ${T.bd3}`,background:showAdd?"transparent":T.btn,color:showAdd?T.tx:T.btnT,fontSize:12,fontFamily:F,fontWeight:700,cursor:"pointer"}}>{showAdd?"✕":"+ New Habit"}</button></div>{showAdd&&(<div style={{background:T.bg2,borderRadius:10,padding:mob?16:20,marginBottom:24,border:`1px solid ${T.bd}`}}><div style={{fontSize:11,textTransform:"uppercase",letterSpacing:"0.12em",color:T.tx3,fontWeight:600,marginBottom:14}}>Create New Habit</div><div style={{display:"flex",gap:10,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}><div style={{width:56,height:56,border:`2px solid ${T.bd3}`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}>{nIcon}</div><input value={nName} onChange={e=>setNName(e.target.value)} placeholder="Habit name" style={{...iStyle,flex:1,minWidth:180}}/></div><div style={{fontSize:10,color:T.tx3,fontWeight:600,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.1em"}}>Icon</div><div style={{display:"grid",gridTemplateColumns:mob?"repeat(8, 1fr)":"repeat(15, 1fr)",gap:4,marginBottom:14}}>{HABIT_ICONS.map(ic=>(<button key={ic} onClick={()=>setNIcon(ic)} style={{aspectRatio:"1",border:`2px solid ${nIcon===ic?T.bd3:T.bd}`,background:nIcon===ic?T.bg3:"transparent",cursor:"pointer",fontSize:18,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>{ic}</button>))}</div><div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:14}}><label style={{fontSize:10,color:T.tx3,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em"}}>Start Date</label><input value={nStart} onChange={e=>setNStart(e.target.value)} type="date" style={iStyle}/></div><button onClick={addHabit} style={{padding:"10px 28px",border:`2px solid ${T.bd3}`,background:T.btn,color:T.btnT,fontSize:12,fontFamily:F,fontWeight:700,cursor:"pointer",letterSpacing:"0.06em",textTransform:"uppercase"}}>Create Habit</button></div>)}{habits.length===0&&!showAdd&&(<div style={{textAlign:"center",padding:"60px 20px",color:T.tx4,fontSize:14}}><div style={{fontSize:48,marginBottom:16}}>🔥</div><div style={{fontWeight:700,color:T.tx3,marginBottom:8}}>No habits yet</div></div>)}{habits.length>0&&(<div style={{background:T.bg2,borderRadius:10,border:`1px solid ${T.bd}`,overflow:"hidden",marginBottom:24}}>{habits.map((habit,idx)=>{const s=getHabitStats(habit);return(<div key={habit.id} style={{display:"flex",alignItems:"center",gap:mob?8:12,padding:mob?"10px 12px":"12px 16px",borderBottom:idx<habits.length-1?`1px solid ${T.bd}`:"none"}}><div style={{fontSize:22,flexShrink:0,width:28,textAlign:"center"}}>{habit.icon}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:mob?13:14,fontWeight:700,color:T.tx,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{habit.name}</div><div style={{fontSize:10,color:T.tx3,fontWeight:600,marginTop:1}}>{s.totalDone} days logged · best {s.best}</div></div><div style={{display:"flex",alignItems:"center",gap:2,flexShrink:0,minWidth:mob?38:44}}><span style={{fontSize:mob?13:15}}>{s.streak>0?"🔥":""}</span><span style={{fontSize:mob?14:16,fontWeight:800,color:s.streak>0?"#E63946":T.tx4}}>{s.streak}</span></div><button onClick={()=>toggleToday(habit.id)} style={{width:28,height:28,border:s.doneToday?"none":`2px solid ${T.bd2}`,background:s.doneToday?"#2A9D8F":"transparent",borderRadius:6,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:16,fontWeight:800,flexShrink:0,padding:0}}>{s.doneToday&&"✓"}</button></div>);})}</div>)}{habits.length>0&&(<div style={{background:T.bg2,borderRadius:10,padding:mob?14:20,border:`1px solid ${T.bd}`}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}><select value={calHabit} onChange={e=>setCalHabit(e.target.value)} style={{border:`2px solid ${T.bd3}`,padding:"6px 10px",fontSize:12,fontFamily:F,fontWeight:700,background:T.sel,color:T.tx,outline:"none",cursor:"pointer",borderRadius:4,maxWidth:mob?160:240}}><option value="__all__">All Habits</option>{habits.map(h=>(<option key={h.id} value={h.id}>{h.icon} {h.name}</option>))}</select><div style={{display:"flex",alignItems:"center",gap:10}}><button onClick={()=>shiftMonth(-1)} style={{border:"none",background:"none",fontSize:16,cursor:"pointer",color:T.tx}}>←</button><span style={{fontSize:12,fontWeight:700,color:T.tx,minWidth:120,textAlign:"center"}}>{monthLabel}</span><button onClick={()=>shiftMonth(1)} style={{border:"none",background:"none",fontSize:16,cursor:"pointer",color:T.tx}}>→</button></div></div><div style={{display:"flex",gap:16,marginBottom:14,fontSize:11,fontWeight:700,flexWrap:"wrap"}}><span style={{color:"#2A9D8F"}}>🔥 {calStats.fireDays} days</span><span style={{color:"#E63946"}}>⚡ {calStats.streak} streak</span><span style={{color:"#457B9D"}}>🏆 {calStats.best} best</span></div>{renderCalendar()}<div style={{display:"flex",gap:12,marginTop:12,fontSize:10,color:T.tx3,flexWrap:"wrap"}}><span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:"#2A9D8F",borderRadius:2,display:"inline-block"}}/> Done</span><span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:T.rR,borderRadius:2,display:"inline-block"}}/> Missed</span></div></div>)}</div>);
}

function GymPage({gymLogs,setGymLogs}){
  const T=useT();const w=useWindowWidth();const mob=w<480;
  const[editKey,setEditKey]=useState(null);
  const[exercises,setExercises]=useState([]);
  const[note,setNote]=useState("");
  const[newEx,setNewEx]=useState("");
  const[saving,setSaving]=useState(false);
  const today=todayStr();
  const earliest="2026-05-24";
  const allDates=[];
  const d=new Date(today+"T12:00:00");const end=new Date(earliest+"T12:00:00");
  while(d>=end){const k=dateToStr(d);if(gymLogs.some(g=>g.date===k)||k===today)allDates.push(k);d.setDate(d.getDate()-1);}
  const getLog=(date)=>gymLogs.find(g=>g.date===date);
  const startEdit=(date)=>{const log=getLog(date);setEditKey(date);setExercises(log?[...log.exercises]:[]);setNote(log?.note||"");setNewEx("");};
  const addExercise=()=>{if(!newEx.trim())return;setExercises(p=>[...p,newEx.trim()]);setNewEx("");};
  const saveLog=async(date)=>{setSaving(true);const existing=getLog(date);let result;if(existing){result=await updateGymLog(existing.id,exercises,note);}else{result=await insertGymLog(date,exercises,note);}if(result){setGymLogs(p=>{const f=p.filter(g=>g.date!==date);return[result,...f].sort((a,b)=>b.date.localeCompare(a.date));});}setEditKey(null);setSaving(false);};
  const gymStreak=(()=>{let s=0;const d=new Date(today+"T12:00:00");while(true){const k=dateToStr(d);const has=gymLogs.some(g=>g.date===k);if(!has&&k===today){d.setDate(d.getDate()-1);continue;}if(!has)break;s++;d.setDate(d.getDate()-1);}return s;})();
  const gc=mob?"70px 1fr":"90px 1fr";
  return(
    <div style={{fontFamily:F}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,fontWeight:600}}>🏋️ Gym Log</div>
        {gymStreak>0&&<span style={{fontSize:13,fontWeight:800,color:"#E63946"}}>🔥 {gymStreak} day streak</span>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:gc,gap:0,borderBottom:`2px solid ${T.bd3}`,paddingBottom:8,marginBottom:4}}>
        <span style={{fontSize:10,fontWeight:700,color:T.tx3,textTransform:"uppercase",letterSpacing:"0.1em"}}>Date</span>
        <span style={{fontSize:10,fontWeight:700,color:T.tx3,textTransform:"uppercase",letterSpacing:"0.1em"}}>Workout</span>
      </div>
      {allDates.map(date=>{
        const log=getLog(date);const isE=editKey===date;const isT=date===today;
        const dl=new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short"});
        const dLabel=new Date(date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
        const hasLog=!!log;
        const rBg=hasLog?T.rG:isT?T.rR:"transparent";
        const rBd=hasLog?T.rGB:isT?T.rRB:T.bd;
        return(
          <div key={date} style={{marginLeft:-8,marginRight:-8,paddingLeft:8,paddingRight:8,borderRadius:2,background:rBg,borderBottom:`1px solid ${rBd}`}}>
            {isE?(
              <div style={{padding:"12px 0"}}>
                <div style={{display:"grid",gridTemplateColumns:gc,gap:0,alignItems:"start"}}>
                  <div style={{display:"flex",flexDirection:"column",paddingTop:2}}><span style={{fontWeight:700,fontSize:12,color:T.tx}}>{dl}</span><span style={{fontSize:10,color:T.tx3}}>{dLabel}</span></div>
                  <div>
                    {exercises.map((ex,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}><span style={{flex:1,fontSize:14,fontWeight:600,color:T.tx}}>{ex}</span><button onClick={()=>setExercises(p=>p.filter((_,j)=>j!==i))} style={{border:"none",background:"none",cursor:"pointer",color:T.tx4,fontSize:14,padding:0,flexShrink:0}}>✕</button></div>))}
                    <div style={{display:"flex",gap:6,marginTop:4,marginBottom:8}}>
                      <input value={newEx} onChange={e=>setNewEx(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addExercise()} placeholder="e.g. Bench 4×10 80kg" style={{flex:1,border:"none",borderBottom:`2px solid ${T.bd3}`,background:"transparent",fontSize:13,fontFamily:F,fontWeight:600,outline:"none",color:T.tx,padding:"3px 0"}}/>
                      <button onClick={addExercise} style={{border:`2px solid ${T.bd3}`,background:T.btn,color:T.btnT,padding:"3px 10px",fontSize:11,fontFamily:F,fontWeight:700,cursor:"pointer",flexShrink:0}}>+</button>
                    </div>
                    <input value={note} onChange={e=>setNote(e.target.value)} placeholder="How was it? Energy, PRs, notes..." onKeyDown={e=>e.key==="Enter"&&saveLog(date)} style={{width:"100%",border:"none",borderBottom:`1px solid ${T.bd2}`,background:"transparent",fontSize:13,fontFamily:F,outline:"none",color:T.tx,padding:"3px 0",boxSizing:"border-box",marginBottom:10}}/>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>saveLog(date)} disabled={saving} style={{border:`2px solid ${T.bd3}`,background:T.btn,color:T.btnT,padding:"6px 16px",fontSize:11,fontFamily:F,fontWeight:700,cursor:"pointer"}}>Save</button>
                      <button onClick={()=>setEditKey(null)} style={{border:`2px solid ${T.bd2}`,background:"transparent",color:T.tx3,padding:"6px 12px",fontSize:11,fontFamily:F,cursor:"pointer"}}>Cancel</button>
                    </div>
                  </div>
                </div>
              </div>
            ):(
              <div onClick={()=>startEdit(date)} style={{display:"grid",gridTemplateColumns:gc,gap:0,padding:"10px 0",cursor:"pointer",alignItems:"start"}}>
                <div style={{display:"flex",flexDirection:"column",paddingTop:2}}><span style={{fontWeight:700,fontSize:12,color:T.tx}}>{dl}</span><span style={{fontSize:10,color:T.tx3}}>{dLabel}</span></div>
                <div style={{paddingBottom:2}}>
                  {hasLog?(
                    <>
                      {log.exercises.map((ex,i)=>(<div key={i} style={{fontSize:13,fontWeight:600,color:T.tx,marginBottom:3}}>{ex}</div>))}
                      {log.note&&<div style={{fontSize:12,color:T.tx3,marginTop:4,fontStyle:"italic"}}>{log.note}</div>}
                    </>
                  ):(
                    <span style={{color:T.tx4,fontSize:13}}>{isT?"Tap to log today's workout":"—"}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {allDates.length===0&&(<div style={{textAlign:"center",padding:"60px 20px",color:T.tx4,fontSize:14}}><div style={{fontSize:48,marginBottom:16}}>🏋️</div><div style={{fontWeight:700,color:T.tx3,marginBottom:8}}>No gym logs yet</div></div>)}
      <div style={{display:"flex",gap:16,marginTop:20,fontSize:10,color:T.tx3}}><span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:T.rG,border:`1px solid ${T.rGB}`,display:"inline-block",borderRadius:2}}/> Logged</span><span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:T.rR,border:`1px solid ${T.rRB}`,display:"inline-block",borderRadius:2}}/> Today</span><span>Tap to edit</span></div>
    </div>
  );
}

function SpendingPage(){
  const T=useT();const w=useWindowWidth();const mob=w<480;
  const[entries,setEntries]=useState([]);const[loaded,setLoaded]=useState(false);
  const[editKey,setEditKey]=useState(null);
  const[tempAmount,setTempAmount]=useState("");const[tempLabel,setTempLabel]=useState("");const[tempCat,setTempCat]=useState("need");
  useEffect(()=>{loadSpending().then(d=>{setEntries(d);setLoaded(true);});},[]);

  const today=todayStr();
  const earliest="2026-05-24";
  const allDates=[];
  const d=new Date(today+"T12:00:00");const end=new Date(earliest+"T12:00:00");
  while(d>=end){
    const k=dateToStr(d);
    const hasEntries=entries.some(e=>e.date===k);
    if(hasEntries||k===today)allDates.push(k);
    d.setDate(d.getDate()-1);
  }

  const saveEntry=async()=>{
    const amt=parseFloat(tempAmount);if(isNaN(amt)||amt<=0||!tempLabel.trim())return;
    const sv=await insertSpending(today,amt,tempLabel.trim(),tempCat);
    if(sv){setEntries(p=>[sv,...p]);}
    setTempAmount("");setTempLabel("");setTempCat("need");setEditKey(null);
  };

  const catColor=(cat)=>({need:"#2A9D8F",waste:"#E63946"}[cat]||"#E63946");

  // Group by month for collapsed past months
  const monthMap={};
  entries.forEach(e=>{const mk=e.date.slice(0,7);if(!monthMap[mk])monthMap[mk]=[];monthMap[mk].push(e);});
  const currentMonth=today.slice(0,7);
  const[expandedMonths,setExpandedMonths]=useState({});
  const toggleMonth=(mk)=>setExpandedMonths(p=>({...p,[mk]:!p[mk]}));
  const monthLabel=(mk)=>{const[y,m]=mk.split("-");return new Date(parseInt(y),parseInt(m)-1).toLocaleDateString("en-US",{month:"long",year:"numeric"});};
  const monthTotal=(mk)=>monthMap[mk]?.reduce((a,e)=>a+Number(e.amount),0)||0;
  const monthCatTotals=(mk)=>{const t={need:0,waste:0};(monthMap[mk]||[]).forEach(e=>{const c=e.category==="want"?"waste":e.category;t[c]=(t[c]||0)+Number(e.amount);});return t;};

  // Today's entries + today empty row
  const todayEntries=entries.filter(e=>e.date===today);
  // Past months sorted desc
  const pastMonths=Object.keys(monthMap).filter(mk=>mk!==currentMonth).sort((a,b)=>b.localeCompare(a));

  const gc=mob?"70px 1fr 70px":"90px 1fr 80px";

  if(!loaded)return(<div style={{textAlign:"center",padding:"40px 0",fontFamily:F,color:T.tx3,fontSize:13}}>Loading...</div>);

  const renderTodaySection=()=>{
    const isEditing=editKey==="new";
    return(
      <div style={{marginBottom:20}}>
        <div style={{display:"grid",gridTemplateColumns:gc,gap:0,borderBottom:`2px solid ${T.bd3}`,paddingBottom:8,marginBottom:4,fontFamily:F}}>
          <span style={{fontSize:10,fontWeight:700,color:T.tx3,textTransform:"uppercase",letterSpacing:"0.1em"}}>Date</span>
          <span style={{fontSize:10,fontWeight:700,color:T.tx3,textTransform:"uppercase",letterSpacing:"0.1em"}}>Label</span>
          <span style={{fontSize:10,fontWeight:700,color:T.tx3,textTransform:"uppercase",letterSpacing:"0.1em",textAlign:"right"}}>Amount</span>
        </div>
        {/* Today's existing entries */}
        {todayEntries.map(e=>{
          const c=e.category==="want"?"waste":e.category;
          const dl=new Date(e.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short"});
          const dLabel=new Date(e.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
          return(<div key={e.id} style={{display:"grid",gridTemplateColumns:gc,gap:0,padding:"10px 0",borderBottom:`1px solid ${T.rGB}`,fontFamily:F,background:T.rG,marginLeft:-8,marginRight:-8,paddingLeft:8,paddingRight:8}}>
            <div style={{display:"flex",flexDirection:"column"}}><span style={{fontWeight:700,fontSize:12,color:T.tx}}>{dl}</span><span style={{fontSize:10,color:T.tx3}}>{dLabel}</span></div>
            <span style={{fontSize:14,fontWeight:600,color:T.tx,paddingRight:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",alignSelf:"center"}}>{e.label}</span>
            <span style={{fontSize:14,fontWeight:700,color:catColor(c),textAlign:"right",alignSelf:"center"}}>₹{Number(e.amount).toLocaleString("en-IN",{maximumFractionDigits:0})}</span>
          </div>);
        })}
        {/* Today empty entry row / edit row */}
        <div style={{marginLeft:-8,marginRight:-8,paddingLeft:8,paddingRight:8,background:T.rR,borderBottom:`1px solid ${T.rRB}`}}>
          {isEditing?(
            <div style={{padding:"10px 0",fontFamily:F}}>
              <div style={{display:"grid",gridTemplateColumns:gc,gap:0,alignItems:"center",marginBottom:8}}>
                <div style={{display:"flex",flexDirection:"column"}}><span style={{fontWeight:700,fontSize:12,color:T.tx}}>Today</span><span style={{fontSize:10,color:T.tx3}}>{new Date(today+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span></div>
                <input value={tempLabel} onChange={e=>setTempLabel(e.target.value)} autoFocus placeholder="What for?" onKeyDown={e=>e.key==="Enter"&&saveEntry()} style={{border:"none",borderBottom:`2px solid ${T.bd3}`,background:"transparent",fontSize:14,fontFamily:F,fontWeight:600,outline:"none",color:T.tx,padding:"3px 0",marginRight:8}}/>
                <input value={tempAmount} onChange={e=>setTempAmount(e.target.value)} placeholder="₹" type="number" onKeyDown={e=>e.key==="Enter"&&saveEntry()} style={{border:"none",borderBottom:`2px solid ${T.bd3}`,background:"transparent",fontSize:14,fontFamily:F,fontWeight:700,outline:"none",color:T.tx,padding:"3px 0",textAlign:"right",width:"100%"}}/>
              </div>
              <div style={{display:"flex",gap:6,marginBottom:8}}>
                {[{key:"need",label:"Need"},{key:"waste",label:"Waste"}].map(c=>(<button key={c.key} onClick={()=>setTempCat(c.key)} style={{padding:"5px 12px",border:`2px solid ${tempCat===c.key?catColor(c.key):T.bd2}`,background:tempCat===c.key?catColor(c.key)+"18":"transparent",color:tempCat===c.key?catColor(c.key):T.tx3,fontFamily:F,fontSize:12,fontWeight:700,cursor:"pointer",borderRadius:6}}>{c.label}</button>))}
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={saveEntry} style={{border:`2px solid ${T.bd3}`,background:T.btn,color:T.btnT,padding:"5px 14px",fontSize:11,fontFamily:F,fontWeight:700,cursor:"pointer"}}>Save</button>
                <button onClick={()=>setEditKey(null)} style={{border:`2px solid ${T.bd2}`,background:"transparent",color:T.tx3,padding:"5px 10px",fontSize:11,fontFamily:F,cursor:"pointer"}}>Cancel</button>
              </div>
            </div>
          ):(
            <div onClick={()=>setEditKey("new")} style={{display:"grid",gridTemplateColumns:gc,gap:0,padding:"10px 0",cursor:"pointer",alignItems:"center"}}>
              <div style={{display:"flex",flexDirection:"column"}}><span style={{fontWeight:700,fontSize:12,color:T.tx}}>Today</span><span style={{fontSize:10,color:T.tx3}}>{new Date(today+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span></div>
              <span style={{fontSize:13,color:T.tx4,fontStyle:"italic"}}>Tap to add entry...</span>
              <span/>
            </div>
          )}
        </div>
        {/* Today totals */}
        {todayEntries.length>0&&(()=>{
          const needT=todayEntries.filter(e=>e.category==="need").reduce((a,e)=>a+Number(e.amount),0);
          const wasteT=todayEntries.filter(e=>e.category!=="need").reduce((a,e)=>a+Number(e.amount),0);
          const tot=todayEntries.reduce((a,e)=>a+Number(e.amount),0);
          return(<div style={{display:"flex",gap:12,padding:"10px 0",fontFamily:F,fontSize:12,flexWrap:"wrap",alignItems:"center"}}>
            {needT>0&&<span style={{color:"#2A9D8F",fontWeight:600}}>₹{Math.round(needT).toLocaleString("en-IN")}</span>}
            {wasteT>0&&<span style={{color:"#E63946",fontWeight:600}}>₹{Math.round(wasteT).toLocaleString("en-IN")}</span>}
            <span style={{fontWeight:800,color:T.tx,fontSize:14}}>₹{Math.round(tot).toLocaleString("en-IN")}</span>
          </div>);
        })()}
      </div>
    );
  };

  const renderMonthSection=(mk)=>{
    const isExpanded=!!expandedMonths[mk];
    const total=monthTotal(mk);const cats=monthCatTotals(mk);
    const rows=[...monthMap[mk]].sort((a,b)=>b.date.localeCompare(a.date)||b.amount-a.amount);
    return(<div key={mk} style={{marginBottom:16}}>
      <div onClick={()=>toggleMonth(mk)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",background:T.bg2,borderRadius:isExpanded?"10px 10px 0 0":10,border:`1px solid ${T.bd}`,cursor:"pointer",userSelect:"none",fontFamily:F}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:12,color:T.tx3,display:"inline-block",transform:isExpanded?"rotate(90deg)":"rotate(0deg)",transition:"transform 0.2s"}}>▶</span>
          <span style={{fontSize:14,fontWeight:800,color:T.tx}}>{monthLabel(mk)}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",justifyContent:"flex-end"}}>
          {cats.need>0&&<span style={{fontSize:12,fontWeight:600,color:"#2A9D8F"}}>₹{Math.round(cats.need).toLocaleString("en-IN")}</span>}
          {cats.waste>0&&<span style={{fontSize:12,fontWeight:600,color:"#E63946"}}>₹{Math.round(cats.waste).toLocaleString("en-IN")}</span>}
          <span style={{fontSize:14,fontWeight:800,color:T.tx}}>₹{Math.round(total).toLocaleString("en-IN")}</span>
        </div>
      </div>
      {isExpanded&&(<div style={{border:`1px solid ${T.bd}`,borderTop:"none",borderRadius:"0 0 10px 10px",overflow:"hidden",fontFamily:F}}>
        {rows.map((e,idx)=>{
          const c=e.category==="want"?"waste":e.category;
          const dl=new Date(e.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
          const isLast=idx===rows.length-1;
          return(<div key={e.id} style={{display:"grid",gridTemplateColumns:gc,gap:0,padding:"10px 12px",borderBottom:isLast?"none":`1px solid ${T.bd}`,background:idx%2===0?T.bg:T.bg2,alignItems:"center"}}>
            <span style={{fontSize:12,fontWeight:600,color:T.tx3}}>{dl}</span>
            <span style={{fontSize:14,fontWeight:600,color:T.tx,paddingRight:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.label}</span>
            <span style={{fontSize:14,fontWeight:700,color:catColor(c),textAlign:"right"}}>₹{Number(e.amount).toLocaleString("en-IN",{maximumFractionDigits:0})}</span>
          </div>);
        })}
        {/* Month totals */}
        {(()=>{
          const needT=rows.filter(e=>e.category==="need").reduce((a,e)=>a+Number(e.amount),0);
          const wasteT=rows.filter(e=>e.category!=="need").reduce((a,e)=>a+Number(e.amount),0);
          const tot=rows.reduce((a,e)=>a+Number(e.amount),0);
          return(<div style={{display:"flex",gap:12,padding:"10px 12px",borderTop:`1px solid ${T.bd2}`,flexWrap:"wrap",alignItems:"center"}}>
            {needT>0&&<span style={{color:"#2A9D8F",fontWeight:600,fontSize:12}}>₹{Math.round(needT).toLocaleString("en-IN")}</span>}
            {wasteT>0&&<span style={{color:"#E63946",fontWeight:600,fontSize:12}}>₹{Math.round(wasteT).toLocaleString("en-IN")}</span>}
            <span style={{fontWeight:800,color:T.tx,fontSize:14}}>₹{Math.round(tot).toLocaleString("en-IN")}</span>
          </div>);
        })()}
      </div>)}
    </div>);
  };

  return(
    <div style={{fontFamily:F}}>
      <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,marginBottom:16,fontWeight:600}}>💸 Spending</div>
      {renderTodaySection()}
      
      {/* Show current month entries (excluding today) */}
      {monthMap[currentMonth] && monthMap[currentMonth].filter(e => e.date !== today).length > 0 && (
        renderMonthSection(currentMonth)
      )}
      
      {pastMonths.map(mk => renderMonthSection(mk))}
      {entries.length===0&&(<div style={{textAlign:"center",padding:"40px 20px",color:T.tx4,fontSize:14}}><div style={{fontSize:48,marginBottom:16}}>💸</div><div style={{fontWeight:700,color:T.tx3,marginBottom:8}}>No entries yet</div><div>Tap today's row to add your first entry</div></div>)}
    </div>
  );
}

function ReflectionPage({sessions}){
  const T=useT();const[reflections,setReflections]=useState({});const[loaded,setLoaded]=useState(false);const[editKey,setEditKey]=useState(null);const[editText,setEditText]=useState("");const[editHrs,setEditHrs]=useState("");const w=useWindowWidth();const mob=w<480;
  useEffect(()=>{loadReflections().then(d=>{setReflections(d);setLoaded(true);});},[]);
  const saveR=async(date,note,hrsOverride)=>{setReflections(p=>({...p,[date]:{note,hrsOverride}}));await upsertReflection(date,note,hrsOverride);};
  const dt=getDayTotals(sessions);
  const earliest="2026-05-24";const allDates=[];const d=new Date(todayStr()+"T12:00:00");const end=new Date(earliest+"T12:00:00");
  while(d>=end){allDates.push(dateToStr(d));d.setDate(d.getDate()-1);}
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
        <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:T.tx3}}>Date</span>
        <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:T.tx3}}>Notes</span>
        <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",textAlign:"right",color:T.tx3}}>Hours</span>
      </div>
      {allDates.map(date=>{
        const hrs=getHrs(date);const mins=getMins(date);const isGreen=mins>=120;const r=reflections[date]||{};const isE=editKey===date;const isT=date===todayStr();
        const dl=new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short"});const dLabel=new Date(date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
        const rBg=isGreen?T.rG:T.rR;const rBd=isGreen?T.rGB:T.rRB;const hC=isGreen?"#2A9D8F":"#E63946";
        return(<div key={date} onClick={()=>{if(!isE)startEdit(date);}} style={{display:"grid",gridTemplateColumns:gc,gap:0,padding:"10px 0",borderBottom:`1px solid ${rBd}`,fontFamily:F,fontSize:13,background:rBg,cursor:isE?"default":"pointer",marginLeft:-8,marginRight:-8,paddingLeft:8,paddingRight:8,borderRadius:2}}>
          <div style={{display:"flex",flexDirection:"column",justifyContent:"center"}}><span style={{fontWeight:700,fontSize:12,color:T.tx}}>{dl}</span><span style={{fontSize:10,color:T.tx3}}>{dLabel}</span></div>
          <div style={{display:"flex",alignItems:"center",paddingRight:8,minWidth:0}}>
            {isE?(<div style={{display:"flex",gap:6,width:"100%",alignItems:"center"}}><input value={editText} onChange={e=>setEditText(e.target.value)} autoFocus placeholder="How was your study?" onKeyDown={e=>{if(e.key==="Enter")saveRow(date);if(e.key==="Escape")setEditKey(null);}} style={{flex:1,border:"none",borderBottom:`2px solid ${T.bd3}`,background:"transparent",fontSize:13,fontFamily:"inherit",padding:"4px 0",outline:"none",minWidth:0,color:T.tx}}/><button onClick={(e)=>{e.stopPropagation();saveRow(date);}} style={{border:`2px solid ${T.bd3}`,background:T.btn,color:T.btnT,padding:"4px 10px",fontSize:10,fontFamily:"inherit",fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>Save</button></div>
            ):(<span style={{color:r.note?T.tx:T.tx4,fontSize:13,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{r.note||(isT?"Tap to add...":"—")}</span>)}
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end"}}>
            {isE?(<input value={editHrs} onChange={e=>setEditHrs(e.target.value)} placeholder={hrs.toFixed(1)} type="number" step="0.1" onKeyDown={e=>{if(e.key==="Enter")saveRow(date);}} style={{width:45,border:"none",borderBottom:`2px solid ${T.bd3}`,background:"transparent",fontSize:13,fontFamily:"inherit",textAlign:"right",padding:"4px 0",outline:"none",color:T.tx}}/>
            ):(<span style={{fontWeight:700,color:hC,fontSize:13}}>{hrs.toFixed(1)}h</span>)}
          </div>
        </div>);
      })}
      <div style={{display:"flex",gap:16,marginTop:20,fontFamily:F,fontSize:10,color:T.tx3,flexWrap:"wrap"}}>
        <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:T.rG,border:`1px solid ${T.rGB}`,display:"inline-block",borderRadius:2}}/> 2h+</span>
        <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:T.rR,border:`1px solid ${T.rRB}`,display:"inline-block",borderRadius:2}}/> &lt;2h</span>
        <span>Tap row to edit</span>
      </div>
    </div>
  );
}

function SleepPage({sleepLogs,setSleepLogs}){
  const T=useT();const[sleepStart,setSleepStart]=useState("23:00");const[wakeUp,setWakeUp]=useState("06:30");const[logDate,setLogDate]=useState(todayStr());const w=useWindowWidth();const mob=w<480;
  const[weekAnchor,setWeekAnchor]=useState(todayStr());
  const[expandedMonths,setExpandedMonths]=useState({});
  const calcSleepMins=(start,wake)=>{const[sh,sm]=start.split(":").map(Number);const[wh,wm]=wake.split(":").map(Number);let sM=sh*60+sm;let wM=wh*60+wm;if(wM<=sM)wM+=1440;return wM-sM;};
  const logSleep=async()=>{const totalMins=calcSleepMins(sleepStart,wakeUp);const sv=await upsertSleepLog(logDate,sleepStart,wakeUp,totalMins);if(sv){setSleepLogs(p=>{const f=p.filter(l=>l.date!==logDate);return[sv,...f].sort((a,b)=>b.date.localeCompare(a.date));});}};
  const sleepColor=(mins)=>{if(mins<360)return"#E63946";if(mins<=450)return"#2A9D8F";return"#E63946";};
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
  const wAvgBed=avgTime(weekLogs.map(l=>l.sleep_start).filter(Boolean));const wAvgWake=avgTime(weekLogs.map(l=>l.wake_up).filter(Boolean));

  // Month grouping
  const monthMap={};sleepLogs.forEach(l=>{const mk=l.date.slice(0,7);if(!monthMap[mk])monthMap[mk]=[];monthMap[mk].push(l);});
  const currentMonth=todayStr().slice(0,7);const sortedMonths=Object.keys(monthMap).sort((a,b)=>b.localeCompare(a));
  const toggleMonth=(mk)=>setExpandedMonths(p=>({...p,[mk]:!p[mk]}));
  const mLabel=(mk)=>{const[y,m]=mk.split("-");return new Date(parseInt(y),parseInt(m)-1).toLocaleDateString("en-US",{month:"long",year:"numeric"});};
  const mAvgSleep=(mk)=>{const logs=monthMap[mk]||[];return logs.length>0?Math.round(logs.reduce((a,l)=>a+(l.total_mins||0),0)/logs.length):0;};

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
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:11,fontFamily:F,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,fontWeight:600}}>Weekly</div>
        <div style={{display:"flex",alignItems:"center",gap:12}}><button onClick={()=>shiftWeek(-1)} style={{border:"none",background:"none",fontSize:16,cursor:"pointer",color:T.tx}}>←</button><span style={{fontSize:13,fontWeight:700,color:T.tx}}>{wLabel}</span><button onClick={()=>shiftWeek(1)} style={{border:"none",background:"none",fontSize:16,cursor:"pointer",color:T.tx,opacity:weekDays[6]>=todayStr()?0.2:1,pointerEvents:weekDays[6]>=todayStr()?"none":"auto"}}>→</button></div>
      </div>
      <div style={{display:"flex",alignItems:"flex-end",gap:8,height:bH+50,paddingTop:16,marginBottom:8}}>{barData.map((d,i)=>{const h=d.mins>0?(d.mins/maxSleep)*bH:0;const c=d.mins>0?sleepColor(d.mins):T.bg3;const dateNum=new Date(d.date+"T12:00:00").getDate();return(<div key={d.date} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:bH+50,maxWidth:60}}>{d.mins>0&&<span style={{fontSize:9,fontFamily:F,fontWeight:700,marginBottom:2,color:sleepColor(d.mins)}}>{formatHM(d.mins)}</span>}<div style={{width:"70%",height:h,background:c,borderRadius:"3px 3px 0 0",minHeight:d.mins>0?4:2}}/><span style={{fontSize:10,fontFamily:F,marginTop:4,color:T.tx3,fontWeight:600}}>{dayLabels[i]}</span><span style={{fontSize:8,fontFamily:F,color:T.tx4}}>{dateNum}</span></div>);})}</div>
      {wAvgSleep>0&&(<div style={{display:"flex",gap:16,marginBottom:24,fontFamily:F,fontSize:12,flexWrap:"wrap"}}>
        <span style={{color:T.tx2}}>Avg: <strong style={{color:sleepColor(wAvgSleep)}}>{formatHM(wAvgSleep)}</strong></span>
        <span style={{color:T.tx3}}>Bed: {wAvgBed}</span>
        <span style={{color:T.tx3}}>Wake: {wAvgWake}</span>
      </div>)}
      <div style={{display:"flex",gap:16,marginBottom:24,fontFamily:F,fontSize:10,color:T.tx3,flexWrap:"wrap"}}>
        <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,background:"#2A9D8F",borderRadius:2,display:"inline-block"}}/> 6–7.5h</span>
        <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,background:"#E63946",borderRadius:2,display:"inline-block"}}/> &lt;6h or 7.5h+</span>
      </div>
      <div style={{fontSize:11,fontFamily:F,textTransform:"uppercase",letterSpacing:"0.15em",color:T.tx3,marginBottom:14,fontWeight:600}}>History</div>
      {sortedMonths.map(mk=>{
        const isCurrent=mk===currentMonth;const isExpanded=isCurrent?true:!!expandedMonths[mk];const avg=mAvgSleep(mk);
        const rows=[...(monthMap[mk]||[])].sort((a,b)=>b.date.localeCompare(a.date));
        return(<div key={mk} style={{marginBottom:12}}>
          <div onClick={isCurrent?undefined:()=>toggleMonth(mk)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:T.bg2,borderRadius:isExpanded?"10px 10px 0 0":10,border:`1px solid ${T.bd}`,cursor:isCurrent?"default":"pointer",userSelect:"none",fontFamily:F}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              {!isCurrent&&<span style={{fontSize:12,color:T.tx3,display:"inline-block",transform:isExpanded?"rotate(90deg)":"rotate(0deg)",transition:"transform 0.2s"}}>▶</span>}
              <span style={{fontSize:14,fontWeight:800,color:T.tx}}>{mLabel(mk)}</span>
            </div>
            <span style={{fontSize:13,fontWeight:700,color:sleepColor(avg)}}>{avg>0?`avg ${formatHM(avg)}`:""}</span>
          </div>
          {isExpanded&&(<div style={{border:`1px solid ${T.bd}`,borderTop:"none",borderRadius:"0 0 10px 10px",overflow:"hidden",fontFamily:F}}>
            {rows.map((l,idx)=>{const c=sleepColor(l.total_mins||0);const dl=new Date(l.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});const isLast=idx===rows.length-1;return(<div key={l.id} style={{display:"grid",gridTemplateColumns:mob?"1fr 60px 60px 60px":"120px 70px 70px 70px",padding:"9px 14px",borderBottom:isLast?"none":`1px solid ${T.bd}`,background:idx%2===0?T.bg:T.bg2,fontSize:mob?12:13,fontFamily:F,alignItems:"center"}}><span style={{fontWeight:600,color:T.tx,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{dl}</span><span style={{color:T.tx3}}>{l.sleep_start||"—"}</span><span style={{color:T.tx3}}>{l.wake_up||"—"}</span><span style={{textAlign:"right",fontWeight:700,color:c}}>{l.total_mins?formatHM(l.total_mins):"—"}</span></div>);})}</div>)}
        </div>);
      })}
      {sleepLogs.length===0&&(<div style={{color:T.tx4,fontFamily:F,fontSize:13,padding:"20px 0",textAlign:"center"}}>No sleep logs yet</div>)}
    </div>
  );
}

export default function App(){
  const[user,setUser]=useState(null);const[authLoading,setAuthLoading]=useState(true);
  const[page,setPage]=useState(PAGES.GOALS);
  const[sessions,setSessions]=useState([]);const[sleepLogs,setSleepLogs]=useState([]);
  const[goals,setGoals]=useState([]);const[habits,setHabits]=useState([]);const[habitLogs,setHabitLogs]=useState([]);
  const[reflections,setReflections]=useState({});const[trackerLogs,setTrackerLogs]=useState([]);
  const[gymLogs,setGymLogs]=useState([]);
  const[loaded,setLoaded]=useState(false);const[sidebarOpen,setSidebarOpen]=useState(false);
  const[isDark,setIsDark]=useState(()=>localStorage.getItem("fm_theme")==="dark");
  const toggleTheme=()=>{setIsDark(p=>{const n=!p;localStorage.setItem("fm_theme",n?"dark":"light");return n;});};
  const theme=isDark?D:L;const w=useWindowWidth();
  useEffect(()=>{document.body.style.background=theme.bg;document.documentElement.style.background=theme.bg;document.body.style.margin="0";},[isDark]);
  if(typeof document!=="undefined"){document.body.style.background=(localStorage.getItem("fm_theme")==="dark"?"#000":"#fff");document.documentElement.style.background=(localStorage.getItem("fm_theme")==="dark"?"#000":"#fff");}
  useEffect(()=>{supabase.auth.getSession().then(({data:{session}})=>{setUser(session?.user??null);setAuthLoading(false);});const{data:{subscription}}=supabase.auth.onAuthStateChange((_e,session)=>{setUser(session?.user??null);});return()=>subscription.unsubscribe();},[]);
  useEffect(()=>{
    if(!user){setSessions([]);setSleepLogs([]);setGoals([]);setHabits([]);setHabitLogs([]);setTrackerLogs([]);setGymLogs([]);setLoaded(false);return;}
    setLoaded(false);
    Promise.all([loadSessions(),loadSleepLogs(),loadGoals(),loadHabits(),loadHabitLogs(),loadReflections(),loadTrackerLogs(),loadGymLogs()])
      .then(([s,sl,g,h,hl,ref,tl,gl])=>{setSessions(s);setSleepLogs(sl);setGoals(g);setHabits(h);setHabitLogs(hl);setReflections(ref);setTrackerLogs(tl);setGymLogs(gl);setLoaded(true);});
  },[user]);
  const handleLogout=async()=>{await supabase.auth.signOut();setUser(null);setSessions([]);setSleepLogs([]);setGoals([]);setHabits([]);setHabitLogs([]);setTrackerLogs([]);setGymLogs([]);setLoaded(false);setSidebarOpen(false);};
  const streak=calcStreak(sessions);
  const todayMins=sessions.filter(s=>s.date===todayStr()).reduce((a,s)=>a+s.duration,0);
  const dailyStatus=useDailyStatus(sessions,habits,habitLogs,trackerLogs,reflections,sleepLogs,gymLogs);
  const getMaxWidth=()=>{if(page===PAGES.GOALS||page===PAGES.HABITS)return w<480?"100%":640;return w<480?"100%":540;};
  const fontLink=<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>;
  if(authLoading)return(<ThemeContext.Provider value={theme}><div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:F,fontSize:14,color:theme.tx3,background:theme.bg}}>{fontLink}Loading...</div></ThemeContext.Provider>);
  if(!user)return(<ThemeContext.Provider value={theme}>{fontLink}<AuthPage/></ThemeContext.Provider>);
  if(!loaded)return(<ThemeContext.Provider value={theme}><div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:F,fontSize:14,color:theme.tx3,background:theme.bg}}>{fontLink}Loading your data...</div></ThemeContext.Provider>);
  return(
    <ThemeContext.Provider value={theme}>
      <div style={{maxWidth:getMaxWidth(),margin:"0 auto",padding:w<480?"56px 12px 60px":"60px 20px 60px",minHeight:"100vh",background:theme.bg,color:theme.tx,transition:"background 0.3s ease, color 0.3s ease"}}>
        {fontLink}
        <TopNavBar sessions={sessions} streak={streak} todayMins={todayMins} onMenuClick={()=>setSidebarOpen(true)}/>
        <Sidebar open={sidebarOpen} onClose={()=>setSidebarOpen(false)} page={page} setPage={setPage} sessions={sessions} onLogout={handleLogout} isDark={isDark} onToggleTheme={toggleTheme} dailyStatus={dailyStatus}/>
        {page===PAGES.GOALS&&<div style={{paddingTop:16}}><GoalsPage sessions={sessions} setSessions={setSessions} goals={goals} setGoals={setGoals} trackerLogs={trackerLogs} setTrackerLogs={setTrackerLogs} reflections={reflections}/></div>}
        {page===PAGES.HABITS&&<div style={{paddingTop:16}}><HabitsPage habits={habits} setHabits={setHabits} habitLogs={habitLogs} setHabitLogs={setHabitLogs}/></div>}
        {page===PAGES.GYM&&<div style={{paddingTop:16}}><GymPage gymLogs={gymLogs} setGymLogs={setGymLogs}/></div>}
        {page===PAGES.SPENDING&&<div style={{paddingTop:16}}><SpendingPage/></div>}
        {page===PAGES.REFLECTION&&<div style={{paddingTop:16}}><ReflectionPage sessions={sessions}/></div>}
        {page===PAGES.SLEEP&&<div style={{paddingTop:16}}><SleepPage sleepLogs={sleepLogs} setSleepLogs={setSleepLogs}/></div>}
      </div>
    </ThemeContext.Provider>
  );
}