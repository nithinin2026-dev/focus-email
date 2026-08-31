import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import * as Tone from "tone";
import { supabase } from "./supabaseClient";
const PAGES = { HABITS: "habits", TIMER: "timer", GOALS: "goals", REFLECTION: "reflection", SLEEP: "sleep", TRACKER: "tracker", SPENDING: "spending" };
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
useEffect(() => { const h = () => setW(window.innerWidth); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h);
}, []);
return w;
}
const QUOTES = ["Flow State is Fragile"];
let bellReady=false, bellSynth=null;
function initBell(){if(bellReady)return;bellSynth=new
Tone.PolySynth(Tone.Synth,{oscillator:{type:"sine"},envelope:{attack:0.005,decay:0.8,sustain:0.01,release:1.2},volume:-6}).toDestination();bellReady=tr
ue;}
function playBell(){try{if(!bellReady)initBell();Tone.start();const
n=Tone.now();bellSynth.triggerAttackRelease("C6","8n",n);bellSynth.triggerAttackRelease("E6","8n",n+0.15);bellSynth.triggerAttackRelease("G6","8n",n+0.
3);bellSynth.triggerAttackRelease("C7","4n",n+0.5);}catch(e){}}
function playStartPop(){try{Tone.start();const s=new
Tone.Synth({oscillator:{type:"triangle"},envelope:{attack:0.005,decay:0.15,sustain:0,release:0.1},volume:-8}).toDestination();s.triggerAttackRelease("G5"
,"16n");setTimeout(()=>s.dispose(),500);}catch(e){}}
function playStopPop(){try{Tone.start();const s=new

Tone.Synth({oscillator:{type:"triangle"},envelope:{attack:0.005,decay:0.2,sustain:0,release:0.15},volume:-8}).toDestination();s.triggerAttackRelease("D5"
,"16n");setTimeout(()=>s.dispose(),500);}catch(e){}}
// ─── Supabase helpers ───
async function loadSessions(){const{data,error}=await supabase.from("sessions").select("*").order("ts",{ascending:true});if(error)return[];return
data.map(r=>({id:r.id,tag:r.tag,duration:r.duration,date:r.date,ts:Number(r.ts)}));}
async function insertSession(session){const{data:{user}}=await supabase.auth.getUser();if(!user)return null;const{data,error}=await
supabase.from("sessions").insert({user_id:user.id,tag:session.tag,duration:session.duration,date:session.date,ts:session.ts}).select().single();if(error)retu
rn null;return data;}
async function deleteSession(id){await supabase.from("sessions").delete().eq("id",id);}
async function updateSessionTag(id,newTag){await supabase.from("sessions").update({tag:newTag}).eq("id",id);}
async function loadReflections(){const{data,error}=await supabase.from("reflections").select("*");if(error)return{};const
m={};data.forEach(r=>{m[r.date]={note:r.note||"",hrsOverride:r.hrs_override};});return m;}
async function upsertReflection(date,note,hrsOverride){const{data:{user}}=await supabase.auth.getUser();if(!user)return;await
supabase.from("reflections").upsert({user_id:user.id,date,note,hrs_override:hrsOverride},{onConflict:"user_id,date"});}
async function loadTasks(){const{data,error}=await supabase.from("tasks").select("*").order("created_at",{ascending:true});if(error)return[];return
data;}
async function insertTask(title,date,timeSlot){const{data:{user}}=await supabase.auth.getUser();if(!user)return null;const{data,error}=await
supabase.from("tasks").insert({user_id:user.id,title,date,time_slot:timeSlot||null}).select().single();if(error)return null;return data;}
async function updateTaskCompleted(taskId,completedDate){await supabase.from("tasks").update({completed_date:completedDate}).eq("id",taskId);}
async function deleteTask(taskId){await supabase.from("tasks").delete().eq("id",taskId);}
async function loadSleepLogs(){const{data,error}=await supabase.from("sleep_logs").select("*").order("date",{ascending:false});if(error)return[];return
data;}
async function upsertSleepLog(date,sleepStart,wakeUp,totalMins){const{data:{user}}=await supabase.auth.getUser();if(!user)return
null;const{data,error}=await
supabase.from("sleep_logs").upsert({user_id:user.id,date,sleep_start:sleepStart,wake_up:wakeUp,total_mins:totalMins},{onConflict:"user_id,date"}).sele
ct().single();if(error)return null;return data;}
async function loadGoals(){const{data,error}=await supabase.from("goals").select("*").order("created_at",{ascending:true});if(error)return[];return
data.map(r=>({id:r.id,name:r.name,tag:r.tag,targetHours:Number(r.target_hours),startDate:r.start_date,targetDate:r.target_date}));}
async function insertGoal(name,tag,targetHours,startDate,targetDate){const{data:{user}}=await supabase.auth.getUser();if(!user)return
null;const{data,error}=await
supabase.from("goals").insert({user_id:user.id,name,tag,target_hours:targetHours,start_date:startDate,target_date:targetDate}).select().single();if(erro
r)return
null;return{id:data.id,name:data.name,tag:data.tag,targetHours:Number(data.target_hours),startDate:data.start_date,targetDate:data.target_date};}
async function deleteGoalDB(id){await supabase.from("goals").delete().eq("id",id);}
async function loadHabits(){const{data,error}=await supabase.from("habits").select("*").order("created_at",{ascending:true});if(error)return[];return
data;}
async function insertHabit(name,icon,targetDays,startDate){const{data:{user}}=await supabase.auth.getUser();if(!user)return
null;const{data,error}=await
supabase.from("habits").insert({user_id:user.id,name,icon,target_days:targetDays,start_date:startDate}).select().single();if(error)return null;return
data;}
async function deleteHabitDB(id){await supabase.from("habits").delete().eq("id",id);}
async function loadHabitLogs(){const{data,error}=await supabase.from("habit_logs").select("*");if(error)return[];return data;}
async function toggleHabitLog(habitId,date,exists){const{data:{user}}=await supabase.auth.getUser();if(!user)return null;if(exists){await
supabase.from("habit_logs").delete().eq("habit_id",habitId).eq("date",date);return null;}const{data,error}=await
supabase.from("habit_logs").insert({user_id:user.id,habit_id:habitId,date}).select().single();if(error)return null;return data;}
// ─── Spending DB helpers ───
async function loadSpending() {
const{data,error}=await supabase.from("spending").select("*").order("date",{ascending:false});
if(error)return[];
return data.map(r=>({id:r.id,date:r.date,amount:Number(r.amount),category:r.category,label:r.label,created_at:r.created_at}));
}
async function insertSpending(date,amount,category,label) {
const{data:{user}}=await supabase.auth.getUser();
if(!user)return null;
const{data,error}=await supabase.from("spending").insert({user_id:user.id,date,amount,category,label}).select().single();
if(error)return null;

return data;
}
async function deleteSpending(id) {
await supabase.from("spending").delete().eq("id",id);
}
async function loadSpendingCategories() {
const{data,error}=await supabase.from("spending_categories").select("*").order("name");
if(error)return [];
return data;
}
async function insertSpendingCategory(name,color) {
const{data:{user}}=await supabase.auth.getUser();
if(!user)return null;
const{data,error}=await supabase.from("spending_categories").insert({user_id:user.id,name,color}).select().single();
if(error)return null;
return data;
}
async function deleteSpendingCategory(id) {
await supabase.from("spending_categories").delete().eq("id",id);
}
// ─── Utilities (IST-aware) ───
function toIST(d){return new Date(d.toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));}
function dateToStr(d){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function todayStr(){return dateToStr(toIST(new Date()));}
function nowIST(){return toIST(new Date());}
function formatTime(s){const m=Math.floor(s/60);const sec=s%60;return`${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;}
function formatHM(mins){const h=Math.floor(mins/60);const m=mins%60;if(h===0)return`${m}m`;if(m===0)return`${h}h`;return`${h}h ${m}m`;}
function calcStreak(sessions){const dt={};sessions.forEach(s=>{dt[s.date]=(dt[s.date]||0)+s.duration;});let streak=0;const d=nowIST();const
tk=todayStr();if((dt[tk]||0)>=120){streak=1;d.setDate(d.getDate()-1);}else{d.setDate(d.getDate()-1);}while(true){const
k=dateToStr(d);if((dt[k]||0)>=120){streak++;d.setDate(d.getDate()-1);}else break;}return streak;}
function getDayTotals(sessions){const t={};sessions.forEach(s=>{t[s.date]=(t[s.date]||0)+s.duration;});return t;}
function isPastDate(ds){return ds<todayStr();}
function getGreenForMins(mins){if(mins<120)return"#E63946";const hrs=mins/60;const
t=Math.min((hrs-2)/4,1);return`rgb(${Math.round(42-t*30)},${Math.round(157+t*40)},${Math.round(143-t*80)})`;}
function getBarGradient(mins){if(mins<120)return"linear-gradient(180deg,#E63946,#FF6B6B)";const
c=getGreenForMins(mins);return`linear-gradient(180deg,${c},${c}88)`;}
const F="'Nunito', sans-serif";
// ─── Theme Toggle ───
function ThemeToggle({isDark,onToggle}){
return(
<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 4px",fontFamily:F}}>
<span style={{fontSize:12,fontWeight:600,color:isDark?"#aaa":"#666"}}>{isDark?"🌙 Dark":"☀️ Light"}</span>
<button onClick={onToggle}
style={{width:44,height:24,borderRadius:12,border:"none",background:isDark?"#fff":"#000",position:"relative",cursor:"pointer",transition:"background
0.3s ease"}}>
<div style={{width:18,height:18,borderRadius:"50%",background:isDark?"#000":"#fff",position:"absolute",top:3,left:isDark?22:4,transition:"left 0.3s
ease",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
</button>
</div>
);
}
// ═══════════════════════════════════════════
// ─── TOP NAVBAR ───
// ═══════════════════════════════════════════
function TopNavBar({sessions,streak,todayMins,onMenuClick}){

const T=useT();const[visible,setVisible]=useState(true);const lastY=useRef(0);const w=useWindowWidth();const mob=w<480;
useEffect(()=>{const h=()=>{const y=window.scrollY;if(y>lastY.current&&y>60)setVisible(false);else
setVisible(true);lastY.current=y;};window.addEventListener("scroll",h,{passive:true});return()=>window.removeEventListener("scroll",h);},[]);
const[qi,setQi]=useState(()=>Math.floor(Math.random()*QUOTES.length));
useEffect(()=>{const t=setInterval(()=>setQi(p=>(p+1)%QUOTES.length),180000);return()=>clearInterval(t);},[]);
const dt=getDayTotals(sessions);const mx=Object.values(dt).length>0?Math.max(...Object.values(dt)):0;const hit=todayMins>=120;
return(
<div style={{position:"fixed",top:0,left:0,right:0,zIndex:1000,background:T.nav,borderBottom:`1px solid
${T.bd}`,transform:visible?"translateY(0)":"translateY(-100%)",transition:"transform 0.35s ease",padding:mob?"8px 10px":"10px
16px",display:"flex",alignItems:"center",justifyContent:"space-between",fontFamily:F,boxShadow:visible?T.navSh:"none"}}>
<div style={{display:"flex",alignItems:"center",gap:mob?6:10}}>
<button onClick={onMenuClick}
style={{border:"none",background:"none",cursor:"pointer",padding:4,display:"flex",alignItems:"center",justifyContent:"center"}}>
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.tx} strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21"
y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
</button>
<span style={{fontSize:mob?11:13,fontWeight:700,display:"flex",alignItems:"center",gap:4,color:T.tx}}>
<span>⚡</span><span>{formatHM(mx)}</span>
<span style={{fontWeight:400,fontSize:mob?8:10,color:T.tx3}}>max</span>
</span>
</div>
{!mob&&(<div style={{flex:1,textAlign:"center",fontSize:13,fontWeight:700,color:T.tx2,fontStyle:"italic",padding:"0
12px",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>"{QUOTES[qi]}"</div>)}
<div
style={{display:"flex",alignItems:"center",gap:5,background:hit?(streak>0?T.btn:T.bg3):"#E63946",color:hit?(streak>0?T.btnT:T.tx3):"#fff",padding:mob?"5
px 10px":"6px 14px",borderRadius:30,fontSize:mob?12:13,fontWeight:700}}>
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
let tTxt="";if(td){const diff=Math.ceil((new Date(td+"T00:00:00")-new Date(tk+"T00:00:00"))/86400000);if(diff>0)tTxt=`${diff}d left`;else
if(diff===0)tTxt="Today!";else tTxt=`${Math.abs(diff)}d ago`;}
const sz=mob?36:32;
return(
<div style={{background:T.bg2,borderRadius:10,padding:mob?"10px 10px":"12px 14px",marginBottom:20,fontFamily:F}}>
<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>

<div style={{display:"flex",justifyContent:"space-between",gap:mob?4:3,flex:1}}>
{wd.map((dk,i)=>{const mins=dt[dk]||0;const fire=mins>=120;const isT=dk===tk;const has=mins>0;const
miss=isPastDate(dk)&&!fire&&dk>=wd[0];
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
<input type="date" value={tt} onChange={e=>setTt(e.target.value)} style={{border:`1px solid ${T.bd2}`,padding:"3px
5px",fontSize:10,fontFamily:F,outline:"none",background:T.bg,color:T.tx}}/>
<button onClick={saveT} style={{border:"none",background:T.btn,color:T.btnT,padding:"3px
7px",fontSize:9,fontFamily:F,fontWeight:700,cursor:"pointer",borderRadius:4}}>Set</button>
</span>):(<span onDoubleClick={()=>{setTt(td||tk);setEt(true);}} style={{color:"#6A4C93",cursor:"pointer"}} title="Double-click to set target
date">{td?`🎯 ${tTxt}`:"🎯 Set goal"}</span>)}
</div>
</div>
);
}

// ═══════════════════════════════════════════
// ─── SPENDING PAGE ───
// ═══════════════════════════════════════════
function SpendingPage() {
const T = useT();
const w = useWindowWidth();
const mob = w < 480;
const [spending, setSpending] = useState([]);
const [categories, setCategories] = useState([]);
const [loading, setLoading] = useState(true);
const [showAdd, setShowAdd] = useState(false);
const [newAmount, setNewAmount] = useState("");
const [newCategory, setNewCategory] = useState("");
const [newLabel, setNewLabel] = useState("");
const [newDate, setNewDate] = useState(todayStr());
const [expandedMonths, setExpandedMonths] = useState(new Set());
// New category form
const [showAddCategory, setShowAddCategory] = useState(false);
const [newCatName, setNewCatName] = useState("");
const [newCatColor, setNewCatColor] = useState("#3b82f6");
// Predefined colors for categories
const CAT_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#eab308", "#8b5cf6", "#ec4899", "#f97316", "#14b8a6", "#6366f1", "#84cc16"];
useEffect(() => {
Promise.all([loadSpending(), loadSpendingCategories()]).then(([s, c]) => {
setSpending(s);
setCategories(c);
setLoading(false);
});
}, []);
// When spending changes, update expanded months to include current month if not already
useEffect(() => {
if (spending.length > 0) {
const currentMonth = todayStr().slice(0, 7);
const months = new Set(spending.map(s => s.date.slice(0, 7)));
// Ensure current month is expanded by default
if (months.has(currentMonth) && !expandedMonths.has(currentMonth)) {
setExpandedMonths(prev => new Set(prev).add(currentMonth));
}
// If no months expanded, expand the most recent month
if (expandedMonths.size === 0 && months.size > 0) {
const sortedMonths = [...months].sort().reverse();
setExpandedMonths(new Set([sortedMonths[0]]));
}
}
}, [spending]);
const addSpending = async () => {
const amount = parseFloat(newAmount);
if (!newCategory || isNaN(amount) || amount <= 0 || !newDate) return;
const sv = await insertSpending(newDate, amount, newCategory, newLabel.trim() || null);
if (sv) {
setSpending(p => [sv, ...p]);
setShowAdd(false);
setNewAmount("");

setNewCategory("");
setNewLabel("");
setNewDate(todayStr());
}
};
const deleteSpendingEntry = async (id) => {
if (!window.confirm("Delete this expense entry?")) return;
await deleteSpending(id);
setSpending(p => p.filter(s => s.id !== id));
};
const addCategory = async () => {
if (!newCatName.trim()) return;
const sv = await insertSpendingCategory(newCatName.trim(), newCatColor);
if (sv) {
setCategories(p => [...p, sv]);
setShowAddCategory(false);
setNewCatName("");
setNewCatColor("#3b82f6");
}
};
const deleteCategory = async (id) => {
if (!window.confirm("Delete this category? All expenses with this category will be orphaned.")) return;
await deleteSpendingCategory(id);
setCategories(p => p.filter(c => c.id !== id));
// Also remove from spending items with this category
// (they'll show as "Unknown" category)
};
const toggleMonth = (monthKey) => {
setExpandedMonths(prev => {
const newSet = new Set(prev);
if (newSet.has(monthKey)) {
newSet.delete(monthKey);
} else {
newSet.add(monthKey);
}
return newSet;
});
};
const getColor = (catName) => {
const found = categories.find(c => c.name === catName);
return found?.color || "#888";
};
// Group spending by month
const grouped = {};
spending.forEach(s => {
const monthKey = s.date.slice(0, 7);
if (!grouped[monthKey]) grouped[monthKey] = [];
grouped[monthKey].push(s);
});
// Sort months descending (newest first)
const sortedMonths = Object.keys(grouped).sort().reverse();

// Calculate category totals for current month
const getCategoryTotals = (monthKey) => {
const items = grouped[monthKey] || [];
const totals = {};
items.forEach(s => {
totals[s.category] = (totals[s.category] || 0) + s.amount;
});
// Sort by amount descending
return Object.entries(totals).sort((a, b) => b[1] - a[1]);
};
const getMonthTotal = (monthKey) => {
return (grouped[monthKey] || []).reduce((sum, s) => sum + s.amount, 0);
};
const formatCurrency = (amount) => {
return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
};
const getCategoryColor = (cat) => {
const found = categories.find(c => c.name === cat);
return found?.color || "#888";
};
const iStyle = { border: `2px solid ${T.bd3}`, padding: "10px 14px", fontSize: 14, fontFamily: F, background: "transparent", outline: "none", boxSizing:
"border-box", color: T.tx };
const selStyle = { border: `2px solid ${T.bd3}`, padding: "10px 14px", fontSize: 14, fontFamily: F, fontWeight: 600, background: T.sel, color: T.tx, outline:
"none", cursor: "pointer", borderRadius: 4, boxSizing: "border-box" };
if (loading) return <div style={{ textAlign: "center", padding: "40px 0", fontFamily: F, color: T.tx3 }}>Loading...</div>;
return (
<div style={{ fontFamily: F }}>
<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 10, flexWrap: "wrap" }}>
<div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.15em", color: T.tx3, fontWeight: 600 }}>💰 Spending</div>
<button onClick={() => setShowAdd(!showAdd)} style={{ padding: "10px 18px", border: `2px solid ${T.bd3}`, background: showAdd ? "transparent" :
T.btn, color: showAdd ? T.tx : T.btnT, fontSize: 12, fontFamily: F, fontWeight: 700, cursor: "pointer" }}>
{showAdd ? "✕" : "+ New Entry"}
</button>
</div>
{showAdd && (
<div style={{ background: T.bg2, borderRadius: 10, padding: mob ? 16 : 20, marginBottom: 24, border: `1px solid ${T.bd}` }}>
<div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: T.tx3, fontWeight: 600, marginBottom: 14 }}>Add
Expense</div>
<div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 12 }}>
<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
<label style={{ fontSize: 10, color: T.tx3, fontWeight: 600 }}>DATE</label>
<input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={iStyle} />
</div>
<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
<label style={{ fontSize: 10, color: T.tx3, fontWeight: 600 }}>AMOUNT (₹)</label>
<input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="e.g. 1500" style={iStyle} />
</div>
<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
<label style={{ fontSize: 10, color: T.tx3, fontWeight: 600 }}>CATEGORY</label>
<div style={{ display: "flex", gap: 6, alignItems: "center" }}>
<select value={newCategory} onChange={e => setNewCategory(e.target.value)} style={{ ...selStyle, flex: 1 }}>
<option value="">Select...</option>

{categories.map(c => (
<option key={c.id} value={c.name} style={{ borderLeft: `4px solid ${c.color}` }}>{c.name}</option>
))}
</select>
<button onClick={() => setShowAddCategory(true)} style={{ padding: "10px 12px", border: `2px solid ${T.bd3}`, background: "transparent",
fontSize: 16, cursor: "pointer", borderRadius: 4, color: T.tx }} title="Add new category">+</button>
</div>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
<label style={{ fontSize: 10, color: T.tx3, fontWeight: 600 }}>LABEL</label>
<input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. Groceries, UPI..." style={iStyle} />
</div>
</div>
{newCategory && (
<div style={{ marginBottom: 12 }}>
<span style={{ fontSize: 11, fontWeight: 600, color: T.tx2 }}>Category color: </span>
<span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 4, background: getCategoryColor(newCategory), verticalAlign:
"middle" }} />
</div>
)}
<button onClick={addSpending} style={{ padding: "10px 28px", border: `2px solid ${T.bd3}`, background: T.btn, color: T.btnT, fontSize: 12,
fontFamily: F, fontWeight: 700, cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase" }}>
Add Entry
</button>
</div>
)}
{/* Category management modal */}
{showAddCategory && (
<div style={{ position: "fixed", inset: 0, background: T.over, zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
<div style={{ background: T.bg, borderRadius: 12, padding: mob ? 20 : 30, maxWidth: 420, width: "100%", border: `1px solid ${T.bd}` }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
<span style={{ fontSize: 18, fontWeight: 700, color: T.tx }}>Add Category</span>
<button onClick={() => setShowAddCategory(false)} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: T.tx3
}}>✕</button>
</div>
<input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Category name" style={{ ...iStyle, marginBottom:
12, width: "100%" }} />
<div style={{ marginBottom: 16 }}>
<label style={{ fontSize: 10, color: T.tx3, fontWeight: 600, display: "block", marginBottom: 4 }}>COLOR</label>
<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
{CAT_COLORS.map(c => (
<button key={c} onClick={() => setNewCatColor(c)} style={{ width: 32, height: 32, borderRadius: "50%", border: newCatColor === c ? `3px
solid ${T.tx}` : "2px solid transparent", background: c, cursor: "pointer" }} />
))}
</div>
</div>
<button onClick={addCategory} style={{ padding: "10px 28px", border: `2px solid ${T.bd3}`, background: T.btn, color: T.btnT, fontSize: 12,
fontFamily: F, fontWeight: 700, cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase", width: "100%" }}>
Add Category
</button>
</div>
</div>
)}
{Object.keys(grouped).length === 0 && (
<div style={{ textAlign: "center", padding: "60px 20px", color: T.tx4, fontSize: 14 }}>
<div style={{ fontSize: 48, marginBottom: 16 }}>💰</div>

<div style={{ fontWeight: 700, color: T.tx3, marginBottom: 8 }}>No spending records</div>
<div>Track your expenses to manage your finances</div>
</div>
)}
{/* Month-wise spending */}
{sortedMonths.map(monthKey => {
const isExpanded = expandedMonths.has(monthKey);
const monthTotal = getMonthTotal(monthKey);
const categoryTotals = getCategoryTotals(monthKey);
const monthDate = new Date(monthKey + "-01");
const monthLabel = monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
const isCurrentMonth = monthKey === todayStr().slice(0, 7);
return (
<div key={monthKey} style={{ marginBottom: 12, border: `1px solid ${T.bd}`, borderRadius: 10, overflow: "hidden", background: T.bg2 }}>
<div onClick={() => toggleMonth(monthKey)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: mob ? "12px
14px" : "14px 18px", cursor: "pointer", background: isCurrentMonth ? T.btn + "15" : "transparent", borderBottom: isExpanded ? `1px solid ${T.bd}` : "none"
}}>
<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
<span style={{ fontSize: isExpanded ? 16 : 14, transition: "transform 0.3s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", color: T.tx3
}}>▶</span>
<span style={{ fontSize: mob ? 14 : 16, fontWeight: 700, color: T.tx }}>
{monthLabel} {isCurrentMonth && <span style={{ fontSize: 10, fontWeight: 600, color: T.tx3, background: T.bg3, padding: "2px 8px",
borderRadius: 4, marginLeft: 6 }}>Current</span>}
</span>
</div>
<span style={{ fontSize: mob ? 14 : 16, fontWeight: 700, color: monthTotal > 0 ? T.tx : T.tx3 }}>{formatCurrency(monthTotal)}</span>
</div>
{isExpanded && (
<div style={{ padding: mob ? "8px 12px 12px" : "10px 16px 16px" }}>
{/* Category totals bar */}
<div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
{categoryTotals.map(([cat, total]) => (
<span key={cat} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: T.tx2, background: T.bg,
padding: "3px 10px 3px 6px", borderRadius: 12 }}>
<span style={{ width: 8, height: 8, borderRadius: 2, background: getCategoryColor(cat), display: "inline-block" }} />
{cat}: {formatCurrency(total)}
</span>
))}
</div>
{/* Entries */}
<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
{grouped[monthKey].map(s => (
<div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: mob ? "8px 10px" : "10px 14px", background: T.bg, borderRadius:
6, border: `1px solid ${T.bd}` }}>
<span style={{ width: 6, height: 6, borderRadius: 2, background: getCategoryColor(s.category), flexShrink: 0 }} />
<div style={{ flex: 1, minWidth: 0 }}>
<span style={{ fontSize: mob ? 12 : 13, fontWeight: 600, color: T.tx }}>{s.category}</span>
{s.label && <span style={{ fontSize: mob ? 10 : 11, color: T.tx3, marginLeft: 6, fontWeight: 400 }}>— {s.label}</span>}
<span style={{ fontSize: 9, color: T.tx4, marginLeft: 8, fontWeight: 400 }}>{new Date(s.date + "T12:00:00").toLocaleDateString("en-US", {
month: "short", day: "numeric" })}</span>
</div>
<span style={{ fontSize: mob ? 13 : 14, fontWeight: 700, color: "#E63946", flexShrink: 0 }}>{formatCurrency(s.amount)}</span>
<button onClick={() => deleteSpendingEntry(s.id)} style={{ border: "none", background: "none", cursor: "pointer", color: T.tx4, fontSize: 16,
padding: "0 4px", flexShrink: 0 }}>✕</button>

</div>
))}
</div>
</div>
)}
</div>
);
})}
</div>
);
}

// ═══════════════════════════════════════════
// ─── MAIN APP ───
// ═══════════════════════════════════════════
export default function App(){
const[user,setUser]=useState(null);const[authLoading,setAuthLoading]=useState(true);const[page,setPage]=useState(PAGES.TRACKER);const[sessi
ons,setSessions]=useState([]);const[sleepLogs,setSleepLogs]=useState([]);const[goals,setGoals]=useState([]);const[habits,setHabits]=useState([]);co
nst[habitLogs,setHabitLogs]=useState([]);const[reflections,setReflections]=useState({});const[loaded,setLoaded]=useState(false);const[sidebarOpen,
setSidebarOpen]=useState(false);
const[isDark,setIsDark]=useState(()=>localStorage.getItem("fm_theme")==="dark");
const toggleTheme=()=>{setIsDark(p=>{const n=!p;localStorage.setItem("fm_theme",n?"dark":"light");return n;});};
const theme=isDark?D:L;const w=useWindowWidth();
useEffect(()=>{document.body.style.background=theme.bg;document.documentElement.style.background=theme.bg;document.body.style.margin
="0";},[isDark]);
if(typeof
document!=="undefined"){document.body.style.background=(localStorage.getItem("fm_theme")==="dark"?"#000":"#fff");document.documentEleme
nt.style.background=(localStorage.getItem("fm_theme")==="dark"?"#000":"#fff");}
useEffect(()=>{supabase.auth.getSession().then(({data:{session}})=>{setUser(session?.user??null);setAuthLoading(false);});const{data:{subscription}}=
supabase.auth.onAuthStateChange((_e,session)=>{setUser(session?.user??null);});return()=>subscription.unsubscribe();},[]);
useEffect(()=>{if(!user){setSessions([]);setSleepLogs([]);setGoals([]);setHabits([]);setHabitLogs([]);setLoaded(false);return;}setLoaded(false);Promise.
all([loadSessions(),loadSleepLogs(),loadGoals(),loadHabits(),loadHabitLogs(),loadReflections()]).then(([s,sl,g,h,hl,ref])=>{setSessions(s);setSleepLogs(sl
);setGoals(g);setHabits(h);setHabitLogs(hl);setReflections(ref);setLoaded(true);});},[user]);
const handleLogout=async()=>{await
supabase.auth.signOut();setUser(null);setSessions([]);setSleepLogs([]);setGoals([]);setHabits([]);setHabitLogs([]);setLoaded(false);setSidebarOpen(fal
se);};
const streak=calcStreak(sessions);const todayMins=sessions.filter(s=>s.date===todayStr()).reduce((a,s)=>a+s.duration,0);
const getMaxWidth=()=>{if(page===PAGES.GOALS||page===PAGES.HABITS)return w<480?"100%":640;return w<480?"100%":540;};
const fontLink=<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>;
if(authLoading)return(<ThemeContext.Provider value={theme}><div
style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:F,fontSize:14,color:theme.tx3,background:theme.bg}}>{fontLi
nk}Loading...</div></ThemeContext.Provider>);
if(!user)return(<ThemeContext.Provider value={theme}>{fontLink}<AuthPage onAuth={setUser}/></ThemeContext.Provider>);
if(!loaded)return(<ThemeContext.Provider value={theme}><div
style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:F,fontSize:14,color:theme.tx3,background:theme.bg}}>{fontLi
nk}Loading your data...</div></ThemeContext.Provider>);
return(
<ThemeContext.Provider value={theme}>
<div style={{maxWidth:getMaxWidth(),margin:"0 auto",padding:w<480?"56px 12px 60px":"60px 20px
60px",minHeight:"100vh",background:theme.bg,color:theme.tx,transition:"background 0.3s ease, color 0.3s ease"}}>
{fontLink}
<TopNavBar sessions={sessions} streak={streak} todayMins={todayMins} onMenuClick={()=>setSidebarOpen(true)}/>
<Sidebar open={sidebarOpen} onClose={()=>setSidebarOpen(false)} page={page} setPage={setPage} sessions={sessions}
onLogout={handleLogout} isDark={isDark} onToggleTheme={toggleTheme}/>
{page===PAGES.HABITS&&<div style={{paddingTop:16}}><HabitsPage habits={habits} setHabits={setHabits} habitLogs={habitLogs}
setHabitLogs={setHabitLogs}/></div>}
{page===PAGES.TIMER&&<><WeekStrip sessions={sessions}/><TimerPage sessions={sessions} setSessions={setSessions}

reflections={reflections}/></>}
{page===PAGES.GOALS&&<div style={{paddingTop:16}}><GoalsPage sessions={sessions} goals={goals} setGoals={setGoals}/></div>}
{page===PAGES.REFLECTION&&<div style={{paddingTop:16}}><ReflectionPage sessions={sessions}/></div>}
{page===PAGES.SLEEP&&<div style={{paddingTop:16}}><SleepPage sleepLogs={sleepLogs} setSleepLogs={setSleepLogs}/></div>}
{page===PAGES.TRACKER&&<div style={{paddingTop:16}}><TrackerPage/></div>}
{page===PAGES.SPENDING&&<div style={{paddingTop:16}}><SpendingPage/></div>}
</div>
</ThemeContext.Provider>
);
}