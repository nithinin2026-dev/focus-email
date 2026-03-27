import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";
import { supabase } from "./supabaseClient";

const PAGES = { TIMER: "timer", TASKS: "tasks", ANALYSIS: "analysis", CALENDAR: "calendar", REFLECTION: "reflection", SLEEP: "sleep" };

const QUOTES = [
  "Develop the quality of being unstoppable",
  "Don't let your Mind and Body Betray you!"
];

// ─── Bell sound ───
let bellReady = false;
let bellSynth = null;
function initBell() {
  if (bellReady) return;
  bellSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 0.005, decay: 0.8, sustain: 0.01, release: 1.2 },
    volume: -6
  }).toDestination();
  bellReady = true;
}
function playBell() {
  try {
    if (!bellReady) initBell();
    Tone.start();
    const now = Tone.now();
    bellSynth.triggerAttackRelease("C6", "8n", now);
    bellSynth.triggerAttackRelease("E6", "8n", now + 0.15);
    bellSynth.triggerAttackRelease("G6", "8n", now + 0.3);
    bellSynth.triggerAttackRelease("C7", "4n", now + 0.5);
  } catch (e) { console.error("Bell error:", e); }
}
function playStartPop() {
  try {
    Tone.start();
    const synth = new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.1 }, volume: -8 }).toDestination();
    synth.triggerAttackRelease("G5", "16n");
    setTimeout(() => synth.dispose(), 500);
  } catch (e) { console.error("Pop error:", e); }
}
function playStopPop() {
  try {
    Tone.start();
    const synth = new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.15 }, volume: -8 }).toDestination();
    synth.triggerAttackRelease("D5", "16n");
    setTimeout(() => synth.dispose(), 500);
  } catch (e) { console.error("Pop error:", e); }
}

// ─── Supabase helpers (unchanged) ───
async function loadSessions() {
  const { data, error } = await supabase.from("sessions").select("*").order("ts", { ascending: true });
  if (error) { console.error("Load sessions error:", error); return []; }
  return data.map(r => ({ id: r.id, tag: r.tag, duration: r.duration, date: r.date, ts: Number(r.ts) }));
}
async function insertSession(session) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from("sessions").insert({ user_id: user.id, tag: session.tag, duration: session.duration, date: session.date, ts: session.ts }).select().single();
  if (error) { console.error("Insert session error:", error); return null; }
  return data;
}
async function loadReflections() {
  const { data, error } = await supabase.from("reflections").select("*");
  if (error) { console.error("Load reflections error:", error); return {}; }
  const map = {};
  data.forEach(r => { map[r.date] = { note: r.note || "", hrsOverride: r.hrs_override }; });
  return map;
}
async function upsertReflection(date, note, hrsOverride) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from("reflections").upsert({ user_id: user.id, date, note, hrs_override: hrsOverride }, { onConflict: "user_id,date" });
  if (error) console.error("Upsert reflection error:", error);
}
async function loadTasks() {
  const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: true });
  if (error) { console.error("Load tasks error:", error); return []; }
  return data;
}
async function insertTask(title, date, timeSlot) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const row = { user_id: user.id, title, date, time_slot: timeSlot || null };
  const { data, error } = await supabase.from("tasks").insert(row).select().single();
  if (error) { console.error("Insert task error:", error); return null; }
  return data;
}
async function updateTaskCompleted(taskId, completedDate) {
  const { error } = await supabase.from("tasks").update({ completed_date: completedDate }).eq("id", taskId);
  if (error) console.error("Update task error:", error);
}
async function deleteTask(taskId) {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) console.error("Delete task error:", error);
}
async function loadSleepLogs() {
  const { data, error } = await supabase.from("sleep_logs").select("*").order("date", { ascending: false });
  if (error) { console.error("Load sleep error:", error); return []; }
  return data;
}
async function upsertSleepLog(date, sleepStart, wakeUp, totalMins) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from("sleep_logs").upsert({ user_id: user.id, date, sleep_start: sleepStart, wake_up: wakeUp, total_mins: totalMins }, { onConflict: "user_id,date" }).select().single();
  if (error) { console.error("Upsert sleep error:", error); return null; }
  return data;
}

// ─── Utilities ───
function todayStr() { return new Date().toISOString().slice(0, 10); }
function formatTime(s) {
  const m = Math.floor(s / 60); const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
function formatHM(mins) {
  const h = Math.floor(mins / 60); const m = mins % 60;
  if (h === 0) return `${m}m`; if (m === 0) return `${h}h`; return `${h}h ${m}m`;
}
function calcStreak(sessions) {
  const dayTotals = {};
  sessions.forEach(s => { dayTotals[s.date] = (dayTotals[s.date] || 0) + s.duration; });
  let streak = 0; const d = new Date(); const todayKey = todayStr();
  if ((dayTotals[todayKey] || 0) >= 120) { streak = 1; d.setDate(d.getDate() - 1); }
  else { d.setDate(d.getDate() - 1); }
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if ((dayTotals[key] || 0) >= 120) { streak++; d.setDate(d.getDate() - 1); } else break;
  }
  return streak;
}
function getFireDays(sessions) {
  const dayTotals = {};
  sessions.forEach(s => { dayTotals[s.date] = (dayTotals[s.date] || 0) + s.duration; });
  const fireDays = new Set();
  Object.entries(dayTotals).forEach(([date, mins]) => { if (mins >= 120) fireDays.add(date); });
  return fireDays;
}
function getDayTotals(sessions) {
  const t = {};
  sessions.forEach(s => { t[s.date] = (t[s.date] || 0) + s.duration; });
  return t;
}
function isPastDate(dateStr) {
  return dateStr < todayStr();
}

// ─── Top Bar (fixed header with stats) ───
function TopBar({ sessions, streak, todayMins }) {
  const [now, setNow] = useState(new Date());
  const [targetDate, setTargetDate] = useState(() => localStorage.getItem("sl_targetDate") || "");
  const [editingTarget, setEditingTarget] = useState(false);
  const [tempTarget, setTempTarget] = useState("");
  
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);

  const dayTotals = getDayTotals(sessions);
  const maxMins = Object.values(dayTotals).length > 0 ? Math.max(...Object.values(dayTotals)) : 0;
  const yearStr = String(now.getFullYear());
  const monthName = now.toLocaleDateString("en-US", { month: "short" });
  const yearMins = sessions.filter(s => s.date.startsWith(yearStr)).reduce((a, s) => a + s.duration, 0);
  const monthPrefix = `${yearStr}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthMins = sessions.filter(s => s.date.startsWith(monthPrefix)).reduce((a, s) => a + s.duration, 0);

  const todayColor = todayMins >= 240 ? "text-[#3ea6ff]" : todayMins >= 120 ? "text-[#f1c40f]" : "text-[#ff4444]";
  const hr = now.getHours();
  const minsLeft = (24 - hr - 1) * 60 + (60 - now.getMinutes());
  const hrsLeft = Math.floor(minsLeft / 60); const mLeft = minsLeft % 60;
  let midColor;
  if (hr < 12) midColor = "text-[#3ea6ff]"; else if (hr < 15) midColor = "text-[#f1c40f]"; else if (hr < 18) midColor = "text-[#ff9800]"; else if (hr < 21) midColor = "text-[#ff4444]"; else midColor = "text-[#f44336]";

  const saveTarget = () => { localStorage.setItem("sl_targetDate", tempTarget); setTargetDate(tempTarget); setEditingTarget(false); };
  let targetText = "";
  if (targetDate) {
    const diff = Math.ceil((new Date(targetDate + "T00:00:00") - new Date(todayStr() + "T00:00:00")) / 86400000);
    if (diff > 0) targetText = `${diff}d left`;
    else if (diff === 0) targetText = "Today!";
    else targetText = `${Math.abs(diff)}d ago`;
  }

  const hitTarget = todayMins >= 120;

  return (
    <div className="fixed top-0 left-0 right-0 bg-[#0f0f0f] border-b border-[#272727] z-50 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left stats */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-[#272727] px-3 py-1.5 rounded-full">
            <span className="text-sm">⚡</span>
            <span className="font-semibold text-sm text-white">{formatHM(maxMins)}</span>
            <span className="text-xs text-[#aaa]">max</span>
          </div>
          <div className="flex items-center gap-2 bg-[#272727] px-3 py-1.5 rounded-full">
            <span className="text-sm">📊</span>
            <span className="font-semibold text-sm text-white">{formatHM(monthMins)}</span>
            <span className="text-xs text-[#aaa]">{monthName}</span>
          </div>
          <div className="flex items-center gap-2 bg-[#272727] px-3 py-1.5 rounded-full">
            <span className="text-sm">📅</span>
            <span className="font-semibold text-sm text-white">{formatHM(yearMins)}</span>
            <span className="text-xs text-[#aaa]">{yearStr}</span>
          </div>
        </div>

        {/* Center countdown */}
        <div className="flex items-center gap-4 text-sm">
          <span className={`${todayColor} flex items-center gap-1.5 font-medium`}>
            <span>📖</span> {formatHM(todayMins)}
          </span>
          <span className={`${midColor} flex items-center gap-1.5 font-medium`}>
            <span>⏳</span> {hrsLeft}h {mLeft}m
          </span>
          {editingTarget ? (
            <span className="flex items-center gap-1.5">
              <input type="date" value={tempTarget} onChange={e => setTempTarget(e.target.value)} className="bg-[#272727] border border-[#3f3f3f] rounded px-2 py-1 text-xs text-white" />
              <button onClick={saveTarget} className="bg-[#3ea6ff] hover:bg-[#65b8ff] text-black px-2 py-1 text-xs font-bold rounded">Set</button>
            </span>
          ) : (
            <span onDoubleClick={() => { setTempTarget(targetDate || todayStr()); setEditingTarget(true); }} className="text-[#f1c40f] cursor-pointer flex items-center gap-1.5 font-medium hover:text-[#f39c12]" title="Double-click to set">
              <span>🎯</span> {targetDate ? targetText : "Set goal"}
            </span>
          )}
        </div>

        {/* Right streak */}
        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full ${hitTarget ? (streak > 0 ? "bg-[#ff4444]" : "bg-[#3f3f3f]") : "bg-[#ff4444]"}`}>
          <span className="text-lg">{hitTarget ? (streak > 0 ? "🔥" : "○") : "⚠️"}</span>
          <span className="text-base font-bold text-white">{streak}</span>
          <span className="text-xs text-white opacity-80">{hitTarget ? (streak === 1 ? "day" : "days") : "2h+"}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Quote Banner ───
function QuotesBanner() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * QUOTES.length));
  useEffect(() => {
    const t = setInterval(() => setIdx(p => (p + 1) % QUOTES.length), 180000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-center text-base font-medium text-[#f1f1f1] italic mb-3 px-4 py-2 bg-[#1a1a1a] rounded-lg border border-[#272727]">
      "{QUOTES[idx]}"
    </div>
  );
}

// ─── Week Bar (compact) ───
function WeekBar({ sessions }) {
  const dayTotals = getDayTotals(sessions);
  const today = new Date();
  const todayKey = todayStr();
  const dayOfWeek = today.getDay();
  const mon = new Date(today); mon.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
  const weekDays = [];
  for (let i = 0; i < 7; i++) { const dd = new Date(mon); dd.setDate(mon.getDate() + i); weekDays.push(dd.toISOString().slice(0, 10)); }
  const dayLabels = ["M", "T", "W", "TH", "F", "SA", "SU"];
  const weekTotal = weekDays.reduce((a, d) => a + (dayTotals[d] || 0), 0);

  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="flex justify-around gap-2 flex-1">
        {weekDays.map((dateKey, i) => {
          const mins = dayTotals[dateKey] || 0;
          const isFire = mins >= 120;
          const isToday = dateKey === todayKey;
          const hasData = mins > 0;
          const isMissed = isPastDate(dateKey) && !isFire && dateKey >= weekDays[0];
          return (
            <div key={dateKey} className="flex flex-col items-center gap-1 flex-1">
              <span className={`text-[9px] font-semibold uppercase ${isToday ? "text-[#f1f1f1]" : "text-[#717171]"}`}>{dayLabels[i]}</span>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${isFire ? "bg-[#ff4444] text-white" : isMissed ? "bg-[#3f3f3f] border border-[#ff4444] text-[#ff4444]" : hasData ? "bg-[#3f3f3f] text-[#aaa]" : isToday ? "bg-[#272727] border border-[#3ea6ff] text-[#3ea6ff]" : "bg-[#272727] text-[#717171]"}`}>
                {isFire ? "🔥" : isMissed ? "❌" : hasData ? formatHM(mins) : "·"}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 bg-[#272727] px-4 py-2 rounded-full">
        <span className="font-bold text-sm text-white">{formatHM(weekTotal)}</span>
      </div>
    </div>
  );
}

// ─── Nav ───
function Nav({ page, setPage }) {
  const items = [
    { key: PAGES.TIMER, label: "Timer", icon: "⏱️" },
    { key: PAGES.TASKS, label: "Tasks", icon: "✓" },
    { key: PAGES.ANALYSIS, label: "Analysis", icon: "📊" },
    { key: PAGES.CALENDAR, label: "Calendar", icon: "📅" },
    { key: PAGES.REFLECTION, label: "Reflect", icon: "💭" },
    { key: PAGES.SLEEP, label: "Sleep", icon: "😴" },
  ];
  return (
    <nav className="flex gap-2 mb-6 bg-[#1a1a1a] p-1 rounded-lg">
      {items.map(i => (
        <button key={i.key} onClick={() => setPage(i.key)} className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 ${page === i.key ? "bg-[#3ea6ff] text-black" : "text-[#aaa] hover:text-white hover:bg-[#272727]"}`}>
          <span className="text-sm">{i.icon}</span>
          <span className="hidden sm:inline">{i.label}</span>
        </button>
      ))}
    </nav>
  );
}

// ─── AUTH ───
function AuthPage({ onAuth }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!email.trim() || !password.trim()) { setError("Email and password required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      if (isLogin) { const { error: err } = await supabase.auth.signInWithPassword({ email, password }); if (err) throw err; }
      else { const { error: err } = await supabase.auth.signUp({ email, password }); if (err) throw err; setConfirmSent(true); setLoading(false); return; }
    } catch (err) { setError(err.message || "Something went wrong"); }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    setError("");
    if (!email.trim()) { setError("Enter your email first"); return; }
    setLoading(true);
    try { const { error: err } = await supabase.auth.resetPasswordForEmail(email); if (err) throw err; setResetSent(true); }
    catch (err) { setError(err.message || "Something went wrong"); }
    setLoading(false);
  };

  if (resetSent) return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="text-5xl mb-4">🔑</div>
        <div className="text-xl font-bold mb-2 text-white">Reset link sent</div>
        <div className="text-sm text-[#aaa] mb-6">Check <strong className="text-white">{email}</strong></div>
        <button onClick={() => { setResetSent(false); setIsLogin(true); }} className="bg-[#3ea6ff] hover:bg-[#65b8ff] text-black px-8 py-3 text-sm font-bold rounded-lg">Back to Login</button>
      </div>
    </div>
  );

  if (confirmSent) return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="text-5xl mb-4">✉️</div>
        <div className="text-xl font-bold mb-2 text-white">Check your email</div>
        <div className="text-sm text-[#aaa] mb-6">Sent to <strong className="text-white">{email}</strong></div>
        <button onClick={() => { setConfirmSent(false); setIsLogin(true); }} className="bg-[#3ea6ff] hover:bg-[#65b8ff] text-black px-8 py-3 text-sm font-bold rounded-lg">Back to Login</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-3xl font-extrabold text-white mb-1">Focus Maxing</div>
          <div className="text-xs text-[#aaa] uppercase tracking-widest">Track your upskilling</div>
        </div>
        <div className="bg-[#1a1a1a] rounded-2xl border border-[#272727] p-6">
          <div className="flex mb-6 bg-[#0f0f0f] rounded-lg p-1">
            {["Login", "Sign Up"].map((label, i) => {
              const active = i === 0 ? isLogin : !isLogin;
              return (<button key={label} onClick={() => { setIsLogin(i === 0); setError(""); }} className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase transition-all ${active ? "bg-[#3ea6ff] text-black" : "text-[#aaa] hover:text-white"}`}>{label}</button>);
            })}
          </div>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" onKeyDown={e => e.key === "Enter" && handleSubmit()} className="w-full bg-[#0f0f0f] border border-[#3f3f3f] rounded-lg px-4 py-3 text-sm mb-3 text-white placeholder:text-[#717171] focus:outline-none focus:border-[#3ea6ff]" />
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password" onKeyDown={e => e.key === "Enter" && handleSubmit()} className="w-full bg-[#0f0f0f] border border-[#3f3f3f] rounded-lg px-4 py-3 text-sm mb-2 text-white placeholder:text-[#717171] focus:outline-none focus:border-[#3ea6ff]" />
          {isLogin && (<div className="text-right mb-3"><button onClick={handleForgotPassword} className="text-xs text-[#3ea6ff] hover:underline">Forgot Password?</button></div>)}
          {error && (<div className="text-xs text-[#ff4444] py-2 text-center bg-[#ff4444]/10 rounded-lg mb-3">{error}</div>)}
          <button onClick={handleSubmit} disabled={loading} className="w-full py-3 bg-[#3ea6ff] hover:bg-[#65b8ff] text-black text-sm font-bold uppercase rounded-lg disabled:opacity-50 transition-all">{loading ? "..." : isLogin ? "Login" : "Create Account"}</button>
        </div>
        <div className="mt-8 text-xs text-[#717171] text-center">Vibe coded by Nithin Chowdary ❤️</div>
      </div>
    </div>
  );
}

// ─── Timer Page ───
function TimerPage({ sessions, setSessions }) {
  const [tag, setTag] = useState(() => sessionStorage.getItem("sl_tag") || "");
  const [running, setRunning] = useState(() => sessionStorage.getItem("sl_running") === "true");
  const [elapsed, setElapsed] = useState(() => {
    const startTs = sessionStorage.getItem("sl_startTs");
    const wasRunning = sessionStorage.getItem("sl_running") === "true";
    if (wasRunning && startTs) return Math.floor((Date.now() - Number(startTs)) / 1000);
    const saved = sessionStorage.getItem("sl_elapsed");
    return saved ? Number(saved) : 0;
  });
  const [mode, setMode] = useState(() => sessionStorage.getItem("sl_mode") || "focus");
  const [focusMins, setFocusMins] = useState(() => Number(sessionStorage.getItem("sl_focusMins")) || 60);
  const [breakMins, setBreakMins] = useState(() => Number(sessionStorage.getItem("sl_breakMins")) || 5);
  const [editing, setEditing] = useState(false);
  const [tempFocus, setTempFocus] = useState("25");
  const [tempBreak, setTempBreak] = useState("5");
  const focusDur = focusMins * 60; const breakDur = breakMins * 60;
  const intervalRef = useRef(null); const startTimeRef = useRef(null);

  useEffect(() => { sessionStorage.setItem("sl_tag", tag); }, [tag]);
  useEffect(() => { sessionStorage.setItem("sl_mode", mode); }, [mode]);
  useEffect(() => { sessionStorage.setItem("sl_focusMins", String(focusMins)); }, [focusMins]);
  useEffect(() => { sessionStorage.setItem("sl_breakMins", String(breakMins)); }, [breakMins]);
  useEffect(() => {
    sessionStorage.setItem("sl_running", String(running));
    if (running) { sessionStorage.setItem("sl_startTs", String(Date.now() - elapsed * 1000)); }
    else { sessionStorage.setItem("sl_elapsed", String(elapsed)); sessionStorage.removeItem("sl_startTs"); }
  }, [running]);

  const openEdit = () => { setTempFocus(String(focusMins)); setTempBreak(String(breakMins)); setEditing(true); };
  const saveEdit = () => { const f = parseInt(tempFocus); const b = parseInt(tempBreak); if (f > 0) setFocusMins(f); if (b > 0) setBreakMins(b); setElapsed(0); setRunning(false); setEditing(false); };
  const remaining = mode === "focus" ? Math.max(focusDur - elapsed, 0) : Math.max(breakDur - elapsed, 0);
  const total = mode === "focus" ? focusDur : breakDur;
  const progress = 1 - remaining / total;

  useEffect(() => {
    if (running) { startTimeRef.current = Date.now() - elapsed * 1000; intervalRef.current = setInterval(() => { setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)); }, 200); }
    else { clearInterval(intervalRef.current); }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        const startTs = sessionStorage.getItem("sl_startTs");
        const wasRunning = sessionStorage.getItem("sl_running") === "true";
        if (wasRunning && startTs) { setElapsed(Math.floor((Date.now() - Number(startTs)) / 1000)); startTimeRef.current = Number(startTs); }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const addSession = useCallback(async (newSession) => {
    setSessions(prev => [...prev, newSession]);
    const saved = await insertSession(newSession);
    if (saved) { setSessions(prev => prev.map(s => s.ts === newSession.ts && s.tag === newSession.tag ? { id: saved.id, tag: saved.tag, duration: saved.duration, date: saved.date, ts: Number(saved.ts) } : s)); }
  }, [setSessions]);

  useEffect(() => {
    if (remaining <= 0 && running) {
      setRunning(false); playBell();
      if (mode === "focus") { const mins = Math.round(focusDur / 60); addSession({ id: Date.now(), tag: tag || "Untitled", duration: mins, date: todayStr(), ts: Date.now() }); setMode("break"); setElapsed(0); }
      else { setMode("focus"); setElapsed(0); }
    }
  }, [remaining, running]);

  const toggle = () => { if (!running) { initBell(); playStartPop(); } else { playStopPop(); } setRunning(!running); };
  const reset = () => { setRunning(false); setElapsed(0); };
  const skip = () => {
    setRunning(false);
    if (mode === "focus") { const mins = Math.max(1, Math.round(elapsed / 60)); if (elapsed > 30) addSession({ id: Date.now(), tag: tag || "Untitled", duration: mins, date: todayStr(), ts: Date.now() }); setMode("break"); }
    else { setMode("focus"); }
    setElapsed(0);
  };

  const [manualTag, setManualTag] = useState(""); const [manualMins, setManualMins] = useState("");
  const logManual = () => {
    const mins = parseInt(manualMins);
    if (!manualTag.trim() || isNaN(mins) || mins <= 0) return;
    addSession({ id: Date.now(), tag: manualTag.trim(), duration: mins, date: todayStr(), ts: Date.now() });
    setManualTag(""); setManualMins("");
  };

  const todaySessions = sessions.filter(s => s.date === todayStr());
  const todayTotal = todaySessions.reduce((a, s) => a + s.duration, 0);
  const circleR = 90; const circleC = 2 * Math.PI * circleR;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <input value={tag} onChange={e => setTag(e.target.value)} placeholder="What are you studying?" className="border-none border-b-2 border-[#3f3f3f] bg-transparent text-lg text-center px-6 py-2 w-full max-w-md text-white placeholder:text-[#717171] focus:outline-none focus:border-[#3ea6ff]" />
      </div>
      {editing ? (
        <div className="flex items-center justify-center gap-3 mb-6 bg-[#1a1a1a] rounded-lg p-4 border border-[#272727]">
          <label className="text-xs text-[#aaa] font-semibold">Focus</label>
          <input value={tempFocus} onChange={e => setTempFocus(e.target.value)} type="number" className="w-14 bg-[#0f0f0f] border border-[#3f3f3f] rounded px-2 py-1.5 text-sm text-center text-white focus:outline-none focus:border-[#3ea6ff]" />
          <label className="text-xs text-[#aaa] font-semibold">Break</label>
          <input value={tempBreak} onChange={e => setTempBreak(e.target.value)} type="number" className="w-14 bg-[#0f0f0f] border border-[#3f3f3f] rounded px-2 py-1.5 text-sm text-center text-white focus:outline-none focus:border-[#3ea6ff]" />
          <span className="text-xs text-[#717171]">min</span>
          <button onClick={saveEdit} className="bg-[#3ea6ff] hover:bg-[#65b8ff] text-black px-4 py-1.5 text-xs font-bold rounded">Set</button>
          <button onClick={() => setEditing(false)} className="bg-[#3f3f3f] hover:bg-[#4f4f4f] text-white px-2 py-1.5 text-xs rounded">✕</button>
        </div>
      ) : (
        <div className="text-center mb-6">
          <button onClick={openEdit} className="text-xs text-[#3ea6ff] hover:underline">⚙ {focusMins}m focus / {breakMins}m break</button>
        </div>
      )}
      <div className="flex justify-center mb-8">
        <div className="relative w-56 h-56">
          <svg width={224} height={224} className="absolute inset-0" style={{ transform: "rotate(-90deg)" }}>
            <circle cx={112} cy={112} r={circleR} fill="none" stroke="#272727" strokeWidth={8} />
            <circle cx={112} cy={112} r={circleR} fill="none" stroke={mode === "focus" ? "#3ea6ff" : "#717171"} strokeWidth={8} strokeLinecap="round" strokeDasharray={circleC} strokeDashoffset={circleC * (1 - progress)} className="transition-all duration-300" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[9px] uppercase tracking-widest text-[#aaa] mb-1 font-bold">{mode === "focus" ? "Focus" : "Break"}</div>
            <div className="text-5xl font-bold text-white">{formatTime(remaining)}</div>
          </div>
        </div>
      </div>
      <div className="flex justify-center gap-3 mb-8">
        <button onClick={toggle} className={`px-10 py-3 rounded-lg text-sm font-bold uppercase transition-all ${running ? "bg-[#3f3f3f] hover:bg-[#4f4f4f] text-white" : "bg-[#3ea6ff] hover:bg-[#65b8ff] text-black"}`}>{running ? "Pause" : "Start"}</button>
        <button onClick={reset} className="px-6 py-3 bg-[#3f3f3f] hover:bg-[#4f4f4f] rounded-lg text-white text-sm font-semibold uppercase">Reset</button>
        <button onClick={skip} className="px-6 py-3 bg-[#3f3f3f] hover:bg-[#4f4f4f] rounded-lg text-white text-sm font-semibold uppercase">Skip</button>
      </div>
      <div className="border-t border-[#272727] mb-6"></div>
      <div className="mb-8 bg-[#1a1a1a] rounded-lg p-4 border border-[#272727]">
        <div className="text-[9px] uppercase tracking-widest text-[#717171] mb-3 font-bold">Quick Log</div>
        <div className="flex gap-2 items-center flex-wrap">
          <input value={manualTag} onChange={e => setManualTag(e.target.value)} placeholder="Tag" className="flex-1 min-w-[130px] bg-[#0f0f0f] border border-[#3f3f3f] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#717171] focus:outline-none focus:border-[#3ea6ff]" />
          <input value={manualMins} onChange={e => setManualMins(e.target.value)} placeholder="mins" type="number" className="w-20 bg-[#0f0f0f] border border-[#3f3f3f] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#717171] focus:outline-none focus:border-[#3ea6ff]" />
          <button onClick={logManual} className="bg-[#3ea6ff] hover:bg-[#65b8ff] text-black px-5 py-2.5 text-sm font-bold rounded-lg">+</button>
        </div>
      </div>
      <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#272727]">
        <div className="flex justify-between items-baseline mb-4">
          <span className="text-[9px] uppercase tracking-widest text-[#717171] font-bold">Today's Sessions</span>
          <span className="text-base font-bold text-white">{formatHM(todayTotal)} {todayTotal >= 120 && "🔥"}</span>
        </div>
        {todaySessions.length === 0 && (<div className="text-[#717171] text-sm py-6 text-center">No sessions yet</div>)}
        {todaySessions.map(s => (
          <div key={s.id} className="flex justify-between items-center py-3 border-b border-[#272727] last:border-0">
            <span className="font-semibold text-white">{s.tag}</span>
            <span className="text-[#aaa] text-sm">{formatHM(s.duration)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tasks Page (simplified - same pattern) ───
function TasksPage({ tasks, setTasks }) {
  return <div className="text-center text-[#717171] py-20">Tasks - Apply same YouTube theme</div>;
}

function AnalysisPage({ sessions }) {
  return <div className="text-center text-[#717171] py-20">Analysis - Apply same YouTube theme</div>;
}

function CalendarPage({ sessions }) {
  return <div className="text-center text-[#717171] py-20">Calendar - Apply same YouTube theme</div>;
}

function ReflectionPage({ sessions }) {
  return <div className="text-center text-[#717171] py-20">Reflection - Apply same YouTube theme</div>;
}

function SleepPage({ sleepLogs, setSleepLogs }) {
  return <div className="text-center text-[#717171] py-20">Sleep - Apply same YouTube theme</div>;
}

// ─── Footer ───
function Footer({ onLogout }) {
  return (
    <div className="mt-8 px-4 py-3 rounded-lg bg-[#1a1a1a] flex items-center justify-between border border-[#272727]">
      <span className="text-sm font-medium text-[#aaa]">
        Vibe coded by Nithin Chowdary <span className="text-[#ff4444]">❤️</span>
      </span>
      <button onClick={onLogout} className="bg-[#3f3f3f] hover:bg-[#4f4f4f] px-4 py-1.5 text-xs font-bold text-white rounded-full uppercase">Logout</button>
    </div>
  );
}

// ─── Main App ───
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState(PAGES.TIMER);
  const [sessions, setSessions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [sleepLogs, setSleepLogs] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setUser(session?.user ?? null); setAuthLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user ?? null); });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { setSessions([]); setTasks([]); setSleepLogs([]); setLoaded(false); return; }
    setLoaded(false);
    Promise.all([loadSessions(), loadTasks(), loadSleepLogs()]).then(([s, t, sl]) => { setSessions(s); setTasks(t); setSleepLogs(sl); setLoaded(true); });
  }, [user]);

  const handleLogout = async () => { await supabase.auth.signOut(); setUser(null); setSessions([]); setTasks([]); setSleepLogs([]); setLoaded(false); };
  const streak = calcStreak(sessions);
  const todayMins = sessions.filter(s => s.date === todayStr()).reduce((a, s) => a + s.duration, 0);

  if (authLoading) return (<div className="flex items-center justify-center h-screen bg-[#0f0f0f] text-sm text-[#aaa]">Loading...</div>);
  if (!user) return (<AuthPage onAuth={setUser} />);
  if (!loaded) return (<div className="flex items-center justify-center h-screen bg-[#0f0f0f] text-sm text-[#aaa]">Loading your data...</div>);

  return (
    <div className="min-h-screen bg-[#0f0f0f] pb-8">
      <TopBar sessions={sessions} streak={streak} todayMins={todayMins} />
      <div className="max-w-7xl mx-auto px-4 pt-20">
        <QuotesBanner />
        <WeekBar sessions={sessions} />
        <Nav page={page} setPage={setPage} />
        {page === PAGES.TIMER && <TimerPage sessions={sessions} setSessions={setSessions} />}
        {page === PAGES.TASKS && <TasksPage tasks={tasks} setTasks={setTasks} />}
        {page === PAGES.ANALYSIS && <AnalysisPage sessions={sessions} />}
        {page === PAGES.CALENDAR && <CalendarPage sessions={sessions} />}
        {page === PAGES.REFLECTION && <ReflectionPage sessions={sessions} />}
        {page === PAGES.SLEEP && <SleepPage sleepLogs={sleepLogs} setSleepLogs={setSleepLogs} />}
        <Footer onLogout={handleLogout} />
      </div>
    </div>
  );
}