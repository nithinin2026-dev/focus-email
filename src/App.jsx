import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";
import { supabase } from "./supabaseClient";

const PAGES = { TIMER: "timer", TASKS: "tasks", ANALYSIS: "analysis", CALENDAR: "calendar", REFLECTION: "reflection", SLEEP: "sleep" };

const QUOTES = [
  "Develop the quality of being unstoppable",
  "Don't let your Mind and Body Betray you!"
];

// ─── Design tokens ───
const F = "'DM Sans', sans-serif";
const C = {
  black: '#0a0a0a', white: '#ffffff',
  g50: '#fafafa', g100: '#f4f4f5', g200: '#e4e4e7',
  g300: '#d1d1d6', g400: '#a1a1aa', g600: '#52525b',
  red: '#e63946', green: '#2a9d8f', orange: '#f4a261', purple: '#6A4C93',
};

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
  } catch (e) { }
}
function playStopPop() {
  try {
    Tone.start();
    const synth = new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.15 }, volume: -8 }).toDestination();
    synth.triggerAttackRelease("D5", "16n");
    setTimeout(() => synth.dispose(), 500);
  } catch (e) { }
}

// ─── Supabase helpers ───
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
function isPastDate(dateStr) { return dateStr < todayStr(); }
function getGreenForMins(mins) {
  if (mins < 120) return "#E63946";
  const hrs = mins / 60;
  const t = Math.min((hrs - 2) / 4, 1);
  const r = Math.round(42 - t * 30); const g = Math.round(157 + t * 40); const b = Math.round(143 - t * 80);
  return `rgb(${r},${g},${b})`;
}
function getBarGradient(mins) {
  if (mins < 120) return "linear-gradient(180deg, #E63946, #FF6B6B)";
  const c = getGreenForMins(mins);
  return `linear-gradient(180deg, ${c}, ${c}88)`;
}

// ─── Label (reusable section label) ───
function Label({ children, style = {} }) {
  return (
    <div style={{ fontFamily: F, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.g400, marginBottom: 12, ...style }}>
      {children}
    </div>
  );
}

// ─── Btn ───
function Btn({ children, onClick, variant = 'primary', disabled, style = {}, size = 'md' }) {
  const pad = size === 'sm' ? '7px 14px' : size === 'lg' ? '14px 36px' : '10px 22px';
  const fs = size === 'sm' ? 11 : size === 'lg' ? 13 : 12;
  const base = {
    fontFamily: F, fontWeight: 700, fontSize: fs, letterSpacing: '0.06em',
    textTransform: 'uppercase', border: '1.5px solid ' + C.black, cursor: disabled ? 'default' : 'pointer',
    padding: pad, transition: 'all 0.15s ease', outline: 'none', ...style
  };
  const variants = {
    primary: { background: C.black, color: C.white },
    outline: { background: 'transparent', color: C.black },
    ghost: { background: 'transparent', color: C.g400, border: '1.5px solid ' + C.g200 },
    danger: { background: C.red, color: C.white, borderColor: C.red },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], opacity: disabled ? 0.35 : 1 }}>
      {children}
    </button>
  );
}

// ─── Input ───
function Input({ value, onChange, placeholder, type = 'text', onKeyDown, style = {}, autoFocus }) {
  return (
    <input
      value={value} onChange={onChange} placeholder={placeholder}
      type={type} onKeyDown={onKeyDown} autoFocus={autoFocus}
      style={{
        fontFamily: F, fontSize: 14, fontWeight: 500, color: C.black,
        background: 'transparent', border: 'none', borderBottom: `1.5px solid ${C.g200}`,
        padding: '10px 0', outline: 'none', width: '100%',
        transition: 'border-color 0.15s',
        ...style
      }}
      onFocus={e => e.target.style.borderBottomColor = C.black}
      onBlur={e => e.target.style.borderBottomColor = C.g200}
    />
  );
}

// ─── Divider ───
function Divider({ mt = 32, mb = 32 }) {
  return <div style={{ height: 1, background: C.g200, margin: `${mt}px 0 ${mb}px` }} />;
}

// ─── CountdownBanner ───
function CountdownBanner({ sessions }) {
  const [now, setNow] = useState(new Date());
  const [targetDate, setTargetDate] = useState(() => localStorage.getItem("sl_targetDate") || "");
  const [editingTarget, setEditingTarget] = useState(false);
  const [tempTarget, setTempTarget] = useState("");
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  const todayMins = sessions.filter(s => s.date === todayStr()).reduce((a, s) => a + s.duration, 0);
  const todayColor = todayMins >= 240 ? C.green : todayMins >= 120 ? C.orange : C.red;
  const hr = now.getHours();
  const minsLeft = (24 - hr - 1) * 60 + (60 - now.getMinutes());
  const hrsLeft = Math.floor(minsLeft / 60); const mLeft = minsLeft % 60;
  let midColor;
  if (hr < 12) midColor = C.green; else if (hr < 15) midColor = C.orange; else if (hr < 18) midColor = '#E76F51'; else midColor = C.red;
  const saveTarget = () => { localStorage.setItem("sl_targetDate", tempTarget); setTargetDate(tempTarget); setEditingTarget(false); };
  let targetText = "";
  if (targetDate) {
    const diff = Math.ceil((new Date(targetDate + "T00:00:00") - new Date(todayStr() + "T00:00:00")) / 86400000);
    if (diff > 0) targetText = `${diff}d left`; else if (diff === 0) targetText = "Today!"; else targetText = `${Math.abs(diff)}d ago`;
  }
  const stat = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1 };
  const val = (color) => ({ fontFamily: F, fontSize: 13, fontWeight: 700, color });
  const lbl = { fontFamily: F, fontSize: 9, fontWeight: 600, color: C.g400, textTransform: 'uppercase', letterSpacing: '0.1em' };
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, marginBottom: 20, border: `1px solid ${C.g200}`, borderRadius: 2 }}>
      <div style={stat} onClick={() => { }} >
        <div style={{ padding: '10px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={val(todayColor)}>📖 {formatHM(todayMins)}</span>
          <span style={lbl}>today</span>
        </div>
      </div>
      <div style={{ width: 1, background: C.g200 }} />
      <div style={stat}>
        <div style={{ padding: '10px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={val(midColor)}>⏳ {hrsLeft}h {mLeft}m</span>
          <span style={lbl}>left today</span>
        </div>
      </div>
      <div style={{ width: 1, background: C.g200 }} />
      <div style={stat}>
        {editingTarget ? (
          <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            <input type="date" value={tempTarget} onChange={e => setTempTarget(e.target.value)}
              style={{ border: `1px solid ${C.g300}`, padding: '4px 6px', fontSize: 11, fontFamily: F, outline: 'none', width: 120 }} />
            <Btn size="sm" onClick={saveTarget}>Set</Btn>
          </div>
        ) : (
          <div onDoubleClick={() => { setTempTarget(targetDate || todayStr()); setEditingTarget(true); }}
            style={{ padding: '10px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer', width: '100%' }}
            title="Double-click to set target date">
            <span style={val(C.purple)}>🎯 {targetDate ? targetText : "Set goal"}</span>
            <span style={lbl}>target</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── QuotesBanner ───
function QuotesBanner() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * QUOTES.length));
  useEffect(() => { const t = setInterval(() => setIdx(p => (p + 1) % QUOTES.length), 180000); return () => clearInterval(t); }, []);
  return (
    <div style={{
      fontFamily: F, fontSize: 12, fontWeight: 500, color: C.g600, fontStyle: 'italic',
      textAlign: 'center', padding: '12px 16px', marginBottom: 16,
      borderLeft: `3px solid ${C.black}`, background: C.g50, letterSpacing: '0.01em'
    }}>
      "{QUOTES[idx]}"
    </div>
  );
}

// ═══════════════════════════════════════════
// ─── AUTH ───
// ═══════════════════════════════════════════
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

  const centerWrap = {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: '40px 24px',
    fontFamily: F, background: C.white,
  };

  if (resetSent || confirmSent) {
    const icon = resetSent ? '🔑' : '✉️';
    const title = resetSent ? 'Reset link sent' : 'Check your email';
    const msg = resetSent
      ? `We sent a password reset link to ${email}.`
      : `We sent a confirmation link to ${email}.`;
    return (
      <div style={centerWrap}>
        <div style={{ fontSize: 40, marginBottom: 20 }}>{icon}</div>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: C.g600, textAlign: 'center', lineHeight: 1.7, marginBottom: 32, maxWidth: 280 }}>{msg}</div>
        <Btn size="lg" onClick={() => { setResetSent(false); setConfirmSent(false); setIsLogin(true); }}>Back to Login</Btn>
        <FooterCredit />
      </div>
    );
  }

  return (
    <div style={centerWrap}>
      <div style={{ marginBottom: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>Focus Maxing</div>
        <div style={{ fontSize: 10, color: C.g400, textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 600 }}>Track your upskilling</div>
      </div>

      <div style={{ width: '100%', maxWidth: 340 }}>
        {/* Tab toggle */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 36, borderBottom: `2px solid ${C.black}` }}>
          {['Login', 'Sign Up'].map((label, i) => {
            const active = i === 0 ? isLogin : !isLogin;
            return (
              <button key={label} onClick={() => { setIsLogin(i === 0); setError(''); }}
                style={{
                  flex: 1, padding: '11px 0', border: 'none', cursor: 'pointer', fontFamily: F,
                  background: active ? C.black : 'transparent', color: active ? C.white : C.g400,
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  transition: 'all 0.2s'
                }}>{label}</button>
            );
          })}
        </div>

        <div style={{ marginBottom: 20 }}>
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" type="email" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <Input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        </div>

        {isLogin && (
          <div style={{ textAlign: 'right', marginBottom: 4 }}>
            <button onClick={handleForgotPassword} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, fontFamily: F, fontWeight: 600, color: C.g400, textDecoration: 'underline', textUnderlineOffset: 3, padding: 0 }}>
              Forgot Password?
            </button>
          </div>
        )}

        {error && (
          <div style={{ fontFamily: F, fontSize: 12, color: C.red, fontWeight: 600, padding: '8px 0', textAlign: 'center' }}>{error}</div>
        )}

        <div style={{ marginTop: 24 }}>
          <Btn size="lg" onClick={handleSubmit} disabled={loading} style={{ width: '100%' }}>
            {loading ? '...' : isLogin ? 'Login' : 'Create Account'}
          </Btn>
        </div>
      </div>
      <FooterCredit />
    </div>
  );
}

function FooterCredit() {
  return <div style={{ marginTop: 64, fontFamily: F, fontSize: 11, color: C.g300, textAlign: 'center' }}>Vibe coded by Nithin Chowdary ❤️</div>;
}

// ─── AppHeader (sticky — replaces StreakBadge + TopBar + Nav) ───
function AppHeader({ sessions, streak, todayMins, page, setPage }) {
  const hitTarget = todayMins >= 120;
  const dayTotals = getDayTotals(sessions);
  const maxMins = Object.values(dayTotals).length > 0 ? Math.max(...Object.values(dayTotals)) : 0;
  const now = new Date();
  const yearStr = String(now.getFullYear());
  const monthName = now.toLocaleDateString("en-US", { month: "short" });
  const yearMins = sessions.filter(s => s.date.startsWith(yearStr)).reduce((a, s) => a + s.duration, 0);
  const monthPrefix = `${yearStr}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthMins = sessions.filter(s => s.date.startsWith(monthPrefix)).reduce((a, s) => a + s.duration, 0);
  const today = new Date();
  const todayKey = todayStr();
  const dayOfWeek = today.getDay();
  const mon = new Date(today); mon.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
  const weekDays = [];
  for (let i = 0; i < 7; i++) { const dd = new Date(mon); dd.setDate(mon.getDate() + i); weekDays.push(dd.toISOString().slice(0, 10)); }
  const dayLabels = ["M", "T", "W", "TH", "F", "SA", "SU"];
  const weekTotal = weekDays.reduce((a, d) => a + (dayTotals[d] || 0), 0);

  const navItems = [
    { key: PAGES.TIMER, label: "Timer" },
    { key: PAGES.TASKS, label: "Tasks" },
    { key: PAGES.ANALYSIS, label: "Analysis" },
    { key: PAGES.CALENDAR, label: "Calendar" },
    { key: PAGES.REFLECTION, label: "Reflect" },
    { key: PAGES.SLEEP, label: "Sleep" },
  ];

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 100, background: C.white,
      borderBottom: `1px solid ${C.g200}`,
    }}>
      {/* Row 1: Brand + Streak */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px 10px' }}>
        <div style={{ fontFamily: F, fontWeight: 800, fontSize: 16, letterSpacing: '-0.03em', color: C.black }}>
          Focus Maxing
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: hitTarget ? C.black : C.red, color: C.white,
          padding: '6px 14px', borderRadius: 40,
          fontFamily: F, fontSize: 13, fontWeight: 700,
        }}>
          <span style={{ fontSize: 16 }}>{hitTarget ? (streak > 0 ? '🔥' : '○') : '⚠️'}</span>
          <span>{streak}</span>
          <span style={{ fontWeight: 500, fontSize: 11, opacity: 0.8 }}>
            {hitTarget ? (streak === 1 ? 'day' : 'days') : 'do 2h+'}
          </span>
        </div>
      </div>

      {/* Row 2: Stat chips */}
      <div style={{ display: 'flex', gap: 6, padding: '0 20px 10px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {[
          { icon: '⚡', val: formatHM(maxMins), lbl: 'max' },
          { icon: '📊', val: formatHM(monthMins), lbl: monthName },
          { icon: '📅', val: formatHM(yearMins), lbl: yearStr },
        ].map(s => (
          <div key={s.lbl} style={{
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
            border: `1px solid ${C.g200}`, padding: '5px 12px', borderRadius: 40,
            fontFamily: F, fontSize: 12, fontWeight: 700, color: C.black,
          }}>
            <span style={{ fontSize: 12 }}>{s.icon}</span>
            <span>{s.val}</span>
            <span style={{ fontWeight: 500, color: C.g400, fontSize: 11 }}>{s.lbl}</span>
          </div>
        ))}
        <div style={{ flexGrow: 1 }} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
          background: C.g100, padding: '5px 12px', borderRadius: 40,
          fontFamily: F, fontSize: 12, fontWeight: 700, color: C.g600,
        }}>
          <span>📆</span>
          <span>{formatHM(weekTotal)}</span>
          <span style={{ fontWeight: 500, fontSize: 11, color: C.g400 }}>this wk</span>
        </div>
      </div>

      {/* Row 3: Week day circles */}
      <div style={{ display: 'flex', padding: '0 20px 12px', gap: 4 }}>
        {weekDays.map((dateKey, i) => {
          const mins = dayTotals[dateKey] || 0;
          const isFire = mins >= 120;
          const isToday = dateKey === todayKey;
          const isMissed = isPastDate(dateKey) && !isFire;
          const hasData = mins > 0;
          return (
            <div key={dateKey} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontFamily: F, fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', color: isToday ? C.black : C.g300, textTransform: 'uppercase' }}>
                {dayLabels[i]}
              </span>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isFire ? C.black : isMissed ? '#fff5f5' : isToday ? C.g100 : 'transparent',
                border: isFire ? 'none' : isMissed ? `1.5px solid ${C.red}` : isToday ? `2px solid ${C.black}` : hasData ? `1.5px solid ${C.g300}` : `1px solid ${C.g200}`,
                fontSize: isFire ? 15 : isMissed ? 13 : 9, fontWeight: 700,
                color: isFire ? C.white : isMissed ? C.red : C.g400,
                transition: 'all 0.2s',
              }}>
                {isFire ? '🔥' : isMissed ? '✕' : hasData ? '' : '·'}
              </div>
              {hasData && !isFire && (
                <span style={{ fontFamily: F, fontSize: 8, fontWeight: 600, color: C.g400 }}>{formatHM(mins)}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Row 4: Nav tabs */}
      <div style={{ display: 'flex', borderTop: `1px solid ${C.g200}` }}>
        {navItems.map(item => (
          <button key={item.key} onClick={() => setPage(item.key)} style={{
            flex: 1, padding: '11px 0', border: 'none', cursor: 'pointer', fontFamily: F,
            background: 'transparent',
            color: page === item.key ? C.black : C.g400,
            fontSize: 10, fontWeight: page === item.key ? 700 : 500,
            letterSpacing: '0.04em', textTransform: 'uppercase',
            borderBottom: page === item.key ? `2px solid ${C.black}` : '2px solid transparent',
            transition: 'all 0.15s', marginBottom: -1,
          }}>{item.label}</button>
        ))}
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
  const circleR = 88; const circleC = 2 * Math.PI * circleR;

  return (
    <div>
      {/* Tag input */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <input value={tag} onChange={e => setTag(e.target.value)} placeholder="What are you studying?"
          style={{
            border: 'none', borderBottom: `2px solid ${C.black}`, background: 'transparent',
            fontSize: 17, fontFamily: F, textAlign: 'center', padding: '8px 0',
            width: '80%', maxWidth: 360, outline: 'none', fontWeight: 600, color: C.black,
          }} />
      </div>

      {/* Timer config */}
      {editing ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20, fontFamily: F }}>
          <span style={{ fontSize: 11, color: C.g400, fontWeight: 600 }}>FOCUS</span>
          <input value={tempFocus} onChange={e => setTempFocus(e.target.value)} type="number"
            style={{ width: 52, border: `1.5px solid ${C.black}`, padding: '6px 8px', fontSize: 14, fontFamily: F, textAlign: 'center', background: 'transparent', outline: 'none' }} />
          <span style={{ fontSize: 11, color: C.g400, fontWeight: 600 }}>BREAK</span>
          <input value={tempBreak} onChange={e => setTempBreak(e.target.value)} type="number"
            style={{ width: 52, border: `1.5px solid ${C.black}`, padding: '6px 8px', fontSize: 14, fontFamily: F, textAlign: 'center', background: 'transparent', outline: 'none' }} />
          <span style={{ fontSize: 10, color: C.g400 }}>min</span>
          <Btn size="sm" onClick={saveEdit}>Set</Btn>
          <Btn size="sm" variant="ghost" onClick={() => setEditing(false)}>✕</Btn>
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <button onClick={openEdit} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: F, fontSize: 11, color: C.g400, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3, letterSpacing: '0.05em' }}>
            ⚙ {focusMins}m focus / {breakMins}m break
          </button>
        </div>
      )}

      {/* Circle timer */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
        <div style={{ position: 'relative', width: 216, height: 216 }}>
          <svg width={216} height={216} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={108} cy={108} r={circleR} fill="none" stroke={C.g200} strokeWidth={5} />
            <circle cx={108} cy={108} r={circleR} fill="none"
              stroke={mode === 'focus' ? C.black : C.g400} strokeWidth={5}
              strokeLinecap="round" strokeDasharray={circleC}
              strokeDashoffset={circleC * (1 - progress)}
              style={{ transition: 'stroke-dashoffset 0.3s ease' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontFamily: F, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.18em', color: C.g400, marginBottom: 4, fontWeight: 700 }}>
              {mode === 'focus' ? 'Focus' : 'Break'}
            </div>
            <div style={{ fontSize: 44, fontFamily: F, fontWeight: 800, letterSpacing: '-0.03em', color: C.black }}>
              {formatTime(remaining)}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 40 }}>
        <Btn size="lg" variant={running ? 'outline' : 'primary'} onClick={toggle}>
          {running ? 'Pause' : 'Start'}
        </Btn>
        <Btn size="lg" variant="ghost" onClick={reset}>Reset</Btn>
        <Btn size="lg" variant="ghost" onClick={skip}>Skip →</Btn>
      </div>

      <Divider mt={0} mb={28} />

      {/* Quick Log */}
      <div style={{ marginBottom: 36 }}>
        <Label>Quick Log</Label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 120 }}>
            <Input value={manualTag} onChange={e => setManualTag(e.target.value)} placeholder="Tag / topic" />
          </div>
          <div style={{ width: 80 }}>
            <Input value={manualMins} onChange={e => setManualMins(e.target.value)} placeholder="mins" type="number" />
          </div>
          <Btn onClick={logManual} style={{ marginBottom: 2 }}>+ Log</Btn>
        </div>
      </div>

      {/* Today sessions */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <Label style={{ marginBottom: 0 }}>Today's Sessions</Label>
          <span style={{ fontFamily: F, fontSize: 14, fontWeight: 800, color: todayTotal >= 120 ? C.green : C.black }}>
            {formatHM(todayTotal)} {todayTotal >= 120 && '🔥'}
          </span>
        </div>
        {todaySessions.length === 0 ? (
          <div style={{ fontFamily: F, color: C.g300, fontSize: 13, padding: '24px 0', textAlign: 'center' }}>No sessions yet — start studying!</div>
        ) : todaySessions.map(s => (
          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: `1px solid ${C.g100}`, fontFamily: F }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{s.tag}</span>
            <span style={{ fontSize: 13, color: C.g400, fontWeight: 500 }}>{formatHM(s.duration)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tasks Page ───
function TasksPage({ tasks, setTasks }) {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [newTask, setNewTask] = useState("");
  const isToday = selectedDate === todayStr();

  const shiftDate = (dir) => {
    const d = new Date(selectedDate + "T12:00:00"); d.setDate(d.getDate() + dir);
    setSelectedDate(d.toISOString().slice(0, 10));
  };
  const dateLabel = isToday ? "Today" : new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  const dayTasks = tasks.filter(t => t.date === selectedDate && !t.time_slot);
  const dayPlannerTasks = tasks.filter(t => t.date === selectedDate && t.time_slot);

  const addTask = async () => {
    if (!newTask.trim()) return;
    const saved = await insertTask(newTask.trim(), selectedDate, null);
    if (saved) setTasks(prev => [...prev, saved]);
    setNewTask("");
  };

  const toggleComplete = async (task) => {
    const newVal = task.completed_date ? null : todayStr();
    await updateTaskCompleted(task.id, newVal);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed_date: newVal } : t));
  };

  const removeTask = async (taskId) => {
    await deleteTask(taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const slots = [];
  for (let h = 4; h <= 23; h++) {
    const fmt = (hr) => { if (hr === 0) return "12 AM"; if (hr < 12) return `${hr} AM`; if (hr === 12) return "12 PM"; return `${hr - 12} PM`; };
    slots.push({ label: `${fmt(h)} – ${fmt(h + 1 > 23 ? 0 : h + 1)}`, key: `${h}-${h + 1}` });
  }

  const addPlannerTask = async (slotKey, title) => {
    if (!title.trim()) return;
    const existing = dayPlannerTasks.find(t => t.time_slot === slotKey);
    if (existing) return;
    const saved = await insertTask(title.trim(), selectedDate, slotKey);
    if (saved) setTasks(prev => [...prev, saved]);
  };

  return (
    <div>
      {/* Date nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <button onClick={() => shiftDate(-1)} style={{ border: `1.5px solid ${C.g200}`, background: 'transparent', width: 36, height: 36, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2 }}>←</button>
        <span style={{ fontFamily: F, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>{dateLabel}</span>
        <button onClick={() => shiftDate(1)} style={{ border: `1.5px solid ${C.g200}`, background: 'transparent', width: 36, height: 36, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2 }}>→</button>
      </div>

      {/* Add task */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <Input value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="Add a task..." onKeyDown={e => e.key === 'Enter' && addTask()} />
        </div>
        <Btn onClick={addTask} style={{ marginBottom: 2 }}>+</Btn>
      </div>

      {/* Task list */}
      <Label>{`Tasks (${dayTasks.filter(t => t.completed_date).length}/${dayTasks.length})`}</Label>
      {dayTasks.length === 0 ? (
        <div style={{ fontFamily: F, color: C.g300, fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No tasks for this day</div>
      ) : dayTasks.map(t => {
        const done = !!t.completed_date;
        return (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${C.g100}`, fontFamily: F }}>
            <button onClick={() => toggleComplete(t)} style={{
              width: 22, height: 22, borderRadius: 4,
              border: done ? 'none' : `1.5px solid ${C.g300}`,
              background: done ? C.black : 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.white, fontSize: 12, flexShrink: 0, transition: 'all 0.15s'
            }}>
              {done && '✓'}
            </button>
            <span style={{ flex: 1, fontWeight: 600, fontSize: 14, textDecoration: done ? 'line-through' : 'none', color: done ? C.g400 : C.black }}>{t.title}</span>
            <button onClick={() => removeTask(t.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g300, fontSize: 16, padding: '0 4px' }}>✕</button>
          </div>
        );
      })}

      {/* Day Planner */}
      <div style={{ marginTop: 36 }}>
        <Label>Day Planner</Label>
        <div style={{ border: `1px solid ${C.g200}`, overflow: 'hidden' }}>
          {slots.map((slot, i) => {
            const slotTask = dayPlannerTasks.find(t => t.time_slot === slot.key);
            const done = slotTask && !!slotTask.completed_date;
            return (
              <div key={slot.key} style={{ display: 'flex', borderBottom: i < slots.length - 1 ? `1px solid ${C.g100}` : 'none', minHeight: 40 }}>
                <div style={{ width: 104, padding: '10px 12px', background: C.g50, flexShrink: 0, display: 'flex', alignItems: 'center', fontFamily: F, fontSize: 11, fontWeight: 600, color: C.g600, borderRight: `1px solid ${C.g200}` }}>
                  {slot.label}
                </div>
                <div style={{ flex: 1, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  {slotTask ? (
                    <>
                      <button onClick={() => toggleComplete(slotTask)} style={{ width: 20, height: 20, borderRadius: 3, border: done ? 'none' : `1.5px solid ${C.g300}`, background: done ? C.black : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.white, fontSize: 11, flexShrink: 0 }}>{done && '✓'}</button>
                      <span style={{ flex: 1, fontSize: 13, fontFamily: F, fontWeight: 600, textDecoration: done ? 'line-through' : 'none', color: done ? C.g400 : C.black }}>{slotTask.title}</span>
                      <button onClick={() => removeTask(slotTask.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g300, fontSize: 14 }}>✕</button>
                    </>
                  ) : (
                    <PlannerSlotInput slotKey={slot.key} onAdd={(title) => addPlannerTask(slot.key, title)} />
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
  const submit = () => { if (val.trim()) { onAdd(val.trim()); setVal(""); } };
  return (
    <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
      placeholder="+ add task" style={{ border: 'none', background: 'transparent', fontSize: 12, fontFamily: F, fontWeight: 500, outline: 'none', color: C.g400, padding: '3px 0', width: '100%' }} />
  );
}

// ─── Shared chart components ───
const TAG_COLORS = ["#E63946","#457B9D","#2A9D8F","#E9C46A","#F4A261","#6A4C93","#1982C4","#8AC926","#FF595E","#6D6875","#264653","#F77F00","#D62828","#023E8A","#606C38"];
function getTagColor(tag, allTags) { return TAG_COLORS[allTags.indexOf(tag) % TAG_COLORS.length]; }
function getWeekRange(dateStr) {
  const d = new Date(dateStr + "T12:00:00"); const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const days = []; for (let i = 0; i < 7; i++) { const dd = new Date(mon); dd.setDate(mon.getDate() + i); days.push(dd.toISOString().slice(0, 10)); } return days;
}
function getMonthDates(year, month) {
  const n = new Date(year, month + 1, 0).getDate(); const dates = [];
  for (let d = 1; d <= n; d++) dates.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`); return dates;
}

function SectionHeader({ children }) {
  return <Label style={{ marginTop: 40 }}>{children}</Label>;
}

function TagBarChart({ sorted, allTags }) {
  if (sorted.length === 0) return null;
  const maxVal = sorted[0][1]; const barH = 160;
  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, minWidth: sorted.length * 64, height: barH + 40, paddingTop: 20 }}>
        {sorted.map(([tag, mins]) => {
          const h = maxVal > 0 ? (mins / maxVal) * barH : 0;
          const color = getTagColor(tag, allTags);
          return (
            <div key={tag} style={{ flex: 1, minWidth: 48, maxWidth: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: barH + 40 }}>
              <span style={{ fontSize: 11, fontFamily: F, fontWeight: 700, marginBottom: 4, color }}>{formatHM(mins)}</span>
              <div style={{ width: '100%', height: h, background: color, borderRadius: '3px 3px 0 0', transition: 'height 0.4s ease', minHeight: mins > 0 ? 6 : 0 }} />
              <span style={{ fontSize: 10, fontFamily: F, marginTop: 6, textAlign: 'center', color: C.g600, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{tag}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PeriodBarChart({ dates, sessions }) {
  const dayTotals = getDayTotals(sessions);
  const data = dates.map(d => ({ date: d, mins: dayTotals[d] || 0 }));
  const maxVal = Math.max(...data.map(d => d.mins), 1);
  const peakVal = Math.max(...data.map(d => d.mins));
  const barH = 140;
  const totalMins = data.reduce((a, d) => a + d.mins, 0);
  const activeDays = data.filter(d => d.mins > 0).length;
  const avgMins = activeDays > 0 ? Math.round(totalMins / activeDays) : 0;
  const isWeekly = dates.length <= 7;
  return (
    <div>
      <div style={{ display: 'flex', gap: 24, marginBottom: 16, fontFamily: F }}>
        {[["Total", totalMins], ["Peak", peakVal], ["Avg/day", avgMins]].map(([label, val]) => (
          <div key={label}>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.black, letterSpacing: '-0.02em' }}>{formatHM(val)}</div>
            <div style={{ fontSize: 9, color: C.g400, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ position: 'relative', overflowX: 'auto', paddingBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: isWeekly ? 8 : 2, minWidth: isWeekly ? dates.length * 52 : dates.length * 16, height: barH + 50, paddingTop: 24, position: 'relative' }}>
          {peakVal > 0 && (
            <div style={{ position: 'absolute', top: 24, left: 0, right: 0, height: barH, pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', bottom: `${(peakVal / maxVal) * barH}px`, left: 0, right: 0, borderTop: `1.5px dashed ${C.red}`, opacity: 0.5 }} />
              <span style={{ position: 'absolute', bottom: `${(peakVal / maxVal) * barH + 4}px`, right: 0, fontSize: 9, color: C.red, fontFamily: F, fontWeight: 700 }}>PEAK {formatHM(peakVal)}</span>
            </div>
          )}
          {data.map((d) => {
            const h = maxVal > 0 ? (d.mins / maxVal) * barH : 0;
            const isPeak = d.mins === peakVal && d.mins > 0;
            const dayLabel = isWeekly ? new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }) : String(new Date(d.date + "T12:00:00").getDate());
            return (
              <div key={d.date} style={{ flex: 1, minWidth: isWeekly ? 40 : 10, maxWidth: isWeekly ? 60 : 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: barH + 50 }}>
                {isWeekly && d.mins > 0 && (<span style={{ fontSize: 10, fontFamily: F, fontWeight: 600, marginBottom: 3, color: isPeak ? C.red : C.g600 }}>{formatHM(d.mins)}</span>)}
                <div style={{ width: '100%', height: h, background: isPeak ? `linear-gradient(180deg, ${C.red}, #FF6B6B)` : getBarGradient(d.mins), borderRadius: '2px 2px 0 0', transition: 'height 0.4s ease', minHeight: d.mins > 0 ? 4 : 2, position: 'relative' }}>
                  {isPeak && (<div style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', fontSize: 11 }}>⭐</div>)}
                </div>
                <span style={{ fontSize: isWeekly ? 10 : 8, fontFamily: F, marginTop: 4, color: isPeak ? C.red : C.g400, fontWeight: isPeak ? 700 : 400 }}>{dayLabel}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12, fontFamily: F, fontSize: 10, color: C.g400 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, background: C.red, borderRadius: 2, display: 'inline-block' }} /> Peak / &lt;2h</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, background: C.green, borderRadius: 2, display: 'inline-block' }} /> 2h+</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, background: '#0B6E4F', borderRadius: 2, display: 'inline-block' }} /> 4h+</span>
      </div>
    </div>
  );
}

// ─── Excel Export ───
async function exportToExcel(sessions) {
  const XLSX = await import("xlsx");
  const dayMap = {};
  sessions.forEach(s => { dayMap[s.date] = (dayMap[s.date] || 0) + s.duration; });
  const dailyData = Object.entries(dayMap).sort((a, b) => a[0].localeCompare(b[0])).map(([date, mins]) => ({ Date: date, Day: new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" }), "Hours": +(mins / 60).toFixed(2), "Status": mins >= 120 ? "🔥" : "❌" }));
  const weekMap = {};
  Object.entries(dayMap).forEach(([date, mins]) => {
    const d = new Date(date + "T12:00:00"); const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const label = `${mon.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${sun.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    weekMap[label] = (weekMap[label] || 0) + mins;
  });
  const weeklyData = Object.entries(weekMap).map(([week, mins]) => ({ Week: week, "Hours": +(mins / 60).toFixed(2) }));
  const monthMap = {};
  Object.entries(dayMap).forEach(([date, mins]) => { const key = date.slice(0, 7); monthMap[key] = (monthMap[key] || 0) + mins; });
  const monthlyData = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0])).map(([key, mins]) => { const [y, m] = key.split("-"); return { Month: new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }), "Hours": +(mins / 60).toFixed(2) }; });
  const tagMap = {}; const tagFirstDate = {};
  sessions.forEach(s => { tagMap[s.tag] = (tagMap[s.tag] || 0) + s.duration; if (!tagFirstDate[s.tag] || s.date < tagFirstDate[s.tag]) tagFirstDate[s.tag] = s.date; });
  const topicData = Object.entries(tagMap).sort((a, b) => b[1] - a[1]).map(([tag, mins]) => ({ Topic: tag, "Hours": +(mins / 60).toFixed(2), "Started": tagFirstDate[tag] || "" }));
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(dailyData); ws1["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 6 }];
  const ws2 = XLSX.utils.json_to_sheet(weeklyData); ws2["!cols"] = [{ wch: 30 }, { wch: 10 }];
  const ws3 = XLSX.utils.json_to_sheet(monthlyData); ws3["!cols"] = [{ wch: 20 }, { wch: 10 }];
  const ws4 = XLSX.utils.json_to_sheet(topicData); ws4["!cols"] = [{ wch: 20 }, { wch: 10 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Day-wise"); XLSX.utils.book_append_sheet(wb, ws2, "Week-wise");
  XLSX.utils.book_append_sheet(wb, ws3, "Month-wise"); XLSX.utils.book_append_sheet(wb, ws4, "Topic-wise");
  XLSX.writeFile(wb, `FocusMaxing_Export_${todayStr()}.xlsx`);
}

// ─── Analysis Page ───
function AnalysisPage({ sessions }) {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [showReports, setShowReports] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const reportsRef = useRef(null); const advancedRef = useRef(null);
  const [viewMonth, setViewMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const daySessions = sessions.filter(s => s.date === selectedDate);
  const tagTotals = {}; daySessions.forEach(s => { tagTotals[s.tag] = (tagTotals[s.tag] || 0) + s.duration; });
  const totalMins = daySessions.reduce((a, s) => a + s.duration, 0);
  const sorted = Object.entries(tagTotals).sort((a, b) => b[1] - a[1]);
  const allTags = [...new Set(sessions.map(s => s.tag))];
  const shiftDate = (dir) => { const d = new Date(selectedDate + "T12:00:00"); d.setDate(d.getDate() + dir); setSelectedDate(d.toISOString().slice(0, 10)); };
  const isToday = selectedDate === todayStr();
  const dateLabel = isToday ? "Today" : new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const weekDates = getWeekRange(selectedDate);
  const weekLabel = `${new Date(weekDates[0] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(weekDates[6] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  const monthDates = getMonthDates(viewMonth.year, viewMonth.month);
  const monthLabel = new Date(viewMonth.year, viewMonth.month).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const shiftMonth = (dir) => { setViewMonth(prev => { let m = prev.month + dir, y = prev.year; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } return { year: y, month: m }; }); };
  const dayTotalsAll = getDayTotals(sessions);
  const tagDayTotals = {}; sessions.forEach(s => { if (!tagDayTotals[s.tag]) tagDayTotals[s.tag] = {}; tagDayTotals[s.tag][s.date] = (tagDayTotals[s.tag][s.date] || 0) + s.duration; });
  const personalBests = Object.entries(tagDayTotals).map(([tag, days]) => { const best = Object.entries(days).sort((a, b) => b[1] - a[1])[0]; return { tag, mins: best ? best[1] : 0, date: best ? best[0] : "" }; }).sort((a, b) => b.mins - a.mins);
  const buckets = [{ label: "0–30m", min: 0, max: 30 }, { label: "30–1h", min: 30, max: 60 }, { label: "1–2h", min: 60, max: 120 }, { label: "2–3h", min: 120, max: 180 }, { label: "3–4h", min: 180, max: 240 }, { label: "4h+", min: 240, max: 99999 }];
  const bucketCounts = buckets.map(b => ({ ...b, count: Object.values(dayTotalsAll).filter(m => m >= b.min && m < b.max).length }));
  const maxBucket = Math.max(...bucketCounts.map(b => b.count), 1);
  const distColors = [C.red, C.red, C.orange, C.green, C.green, "#457B9D"];
  const dowDaySets = [new Set(), new Set(), new Set(), new Set(), new Set(), new Set(), new Set()];
  Object.keys(dayTotalsAll).forEach(date => { dowDaySets[new Date(date + "T12:00:00").getDay()].add(date); });
  const dowNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dowCounts = dowDaySets.map((s, i) => ({ dow: i, count: s.size }));
  const bestDow = [...dowCounts].sort((a, b) => b.count - a.count)[0];
  const windowDaySets = {};
  sessions.forEach(s => {
    if (!s.ts) return; const hr = new Date(s.ts).getHours(); const start = Math.floor(hr / 2) * 2; const end = start + 2;
    const fmt = (h) => { if (h === 0) return "12 AM"; if (h < 12) return `${h} AM`; if (h === 12) return "12 PM"; return `${h - 12} PM`; };
    const label = `${fmt(start)} – ${fmt(end > 23 ? 0 : end)}`; if (!windowDaySets[label]) windowDaySets[label] = new Set(); windowDaySets[label].add(s.date);
  });
  const windowData = Object.entries(windowDaySets).map(([label, set]) => ({ label, count: set.size })).sort((a, b) => b.count - a.count);
  const bestWindow = windowData[0];
  const zones = [{ label: "< 1 hr", min: 0, max: 60 }, { label: "1–2 hrs", min: 60, max: 120 }, { label: "2–3 hrs", min: 120, max: 180 }, { label: "3–4 hrs", min: 180, max: 240 }, { label: "4+ hrs", min: 240, max: 99999 }];
  const bestZone = zones.map(z => ({ ...z, count: Object.values(dayTotalsAll).filter(m => m >= z.min && m < z.max).length })).sort((a, b) => b.count - a.count)[0];

  const tH = { fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: F, color: C.g400 };
  const tR = { display: 'grid', padding: '11px 0', borderBottom: `1px solid ${C.g100}`, fontFamily: F, fontSize: 13, alignItems: 'center' };
  const navBtn = { border: `1px solid ${C.g200}`, background: 'transparent', width: 32, height: 32, cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2, fontFamily: F };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Btn variant="outline" size="sm" onClick={() => exportToExcel(sessions)} disabled={sessions.length === 0}>↓ Export Excel</Btn>
      </div>

      <SectionHeader>Daily Report</SectionHeader>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button onClick={() => shiftDate(-1)} style={navBtn}>←</button>
        <span style={{ fontFamily: F, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>{dateLabel}</span>
        <button onClick={() => shiftDate(1)} style={{ ...navBtn, opacity: isToday ? 0.25 : 1, pointerEvents: isToday ? 'none' : 'auto' }}>→</button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 44, fontFamily: F, fontWeight: 800, letterSpacing: '-0.04em', color: C.black }}>{formatHM(totalMins)}</div>
        <div style={{ fontFamily: F, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: C.g400, marginTop: 4, fontWeight: 600 }}>Total Upskilling {totalMins >= 120 && '🔥'}</div>
      </div>

      {sorted.length === 0 ? (
        <div style={{ textAlign: 'center', color: C.g300, fontFamily: F, fontSize: 13, padding: '30px 0' }}>No sessions recorded</div>
      ) : <TagBarChart sorted={sorted} allTags={allTags} />}

      {daySessions.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <Label>Session Log</Label>
          {daySessions.map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${C.g100}`, fontFamily: F, fontSize: 13 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: getTagColor(s.tag, allTags), display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>{s.tag}</span>
              </span>
              <span style={{ color: C.g400, fontWeight: 500 }}>{formatHM(s.duration)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Reports toggle */}
      <div style={{ marginTop: 36, textAlign: 'center' }}>
        <Btn variant={showReports ? 'primary' : 'outline'} onClick={() => setShowReports(!showReports)}>
          {showReports ? '▲ Hide Reports' : '▼ Weekly & Monthly Reports'}
        </Btn>
      </div>

      <div style={{ maxHeight: showReports ? (reportsRef.current ? reportsRef.current.scrollHeight + 'px' : '2000px') : '0px', overflow: 'hidden', transition: 'max-height 0.5s ease, opacity 0.4s ease', opacity: showReports ? 1 : 0 }}>
        <div ref={reportsRef}>
          <SectionHeader>Weekly Report — {weekLabel}</SectionHeader>
          <PeriodBarChart dates={weekDates} sessions={sessions} />
          <div style={{ marginTop: 40, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Label style={{ margin: 0 }}>Monthly Report</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => shiftMonth(-1)} style={navBtn}>←</button>
              <span style={{ fontFamily: F, fontSize: 13, fontWeight: 700 }}>{monthLabel}</span>
              <button onClick={() => shiftMonth(1)} style={navBtn}>→</button>
            </div>
          </div>
          <PeriodBarChart dates={monthDates} sessions={sessions} />
        </div>
      </div>

      {/* Personal bests */}
      {personalBests.length > 0 && (
        <>
          <SectionHeader>🏆 Personal Bests</SectionHeader>
          <div style={{ ...tR, borderBottom: `2px solid ${C.black}`, padding: '0 0 8px', gridTemplateColumns: '1fr 90px 70px' }}>
            <span style={tH}>Category</span>
            <span style={{ ...tH, textAlign: 'right' }}>Best</span>
            <span style={{ ...tH, textAlign: 'right' }}>Date</span>
          </div>
          {personalBests.map((b, i) => (
            <div key={b.tag} style={{ ...tR, gridTemplateColumns: '1fr 90px 70px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: getTagColor(b.tag, allTags), display: 'inline-block' }} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>{b.tag}</span>
                {i === 0 && <span style={{ fontSize: 11 }}>👑</span>}
              </span>
              <span style={{ textAlign: 'right', fontWeight: 700, color: C.green, fontSize: 13 }}>{formatHM(b.mins)}</span>
              <span style={{ textAlign: 'right', color: C.g400, fontSize: 11 }}>{b.date ? new Date(b.date + "T12:00:00").toLocaleDateString("en-US", { month: 'short', day: 'numeric' }) : '—'}</span>
            </div>
          ))}
        </>
      )}

      {/* Advanced toggle */}
      <div style={{ marginTop: 36, textAlign: 'center' }}>
        <Btn variant={showAdvanced ? 'primary' : 'outline'} onClick={() => setShowAdvanced(!showAdvanced)}>
          {showAdvanced ? '▲ Hide Advanced' : '▼ Advanced Analysis'}
        </Btn>
      </div>

      <div style={{ maxHeight: showAdvanced ? (advancedRef.current ? advancedRef.current.scrollHeight + 'px' : '3000px') : '0px', overflow: 'hidden', transition: 'max-height 0.5s ease, opacity 0.4s ease', opacity: showAdvanced ? 1 : 0 }}>
        <div ref={advancedRef}>
          <SectionHeader>Distribution — Hours vs Days</SectionHeader>
          <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, minWidth: bucketCounts.length * 56, height: 160, paddingTop: 16 }}>
              {bucketCounts.map((c, i) => {
                const h = maxBucket > 0 ? (c.count / maxBucket) * 120 : 0;
                return (
                  <div key={c.label} style={{ flex: 1, minWidth: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: 160 }}>
                    <span style={{ fontSize: 11, fontFamily: F, fontWeight: 700, marginBottom: 4, color: distColors[i] }}>{c.count > 0 ? c.count : ''}</span>
                    <div style={{ width: '100%', height: h, background: distColors[i], borderRadius: '3px 3px 0 0', transition: 'height 0.4s ease', minHeight: c.count > 0 ? 6 : 2, opacity: 0.85 }} />
                    <span style={{ fontSize: 9, fontFamily: F, marginTop: 5, color: C.g400, fontWeight: 500 }}>{c.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <SectionHeader>Focus Insights</SectionHeader>
          {sessions.length > 0 && (
            <>
              <div style={{ ...tR, borderBottom: `2px solid ${C.black}`, padding: '0 0 8px', gridTemplateColumns: '1fr 130px 70px' }}>
                <span style={tH}>Insight</span>
                <span style={{ ...tH, textAlign: 'right' }}>Value</span>
                <span style={{ ...tH, textAlign: 'right' }}>Count</span>
              </div>
              {[
                { label: 'Comfort Zone', sub: 'Most consistent range', val: bestZone?.count > 0 ? bestZone.label : '—', count: bestZone?.count > 0 ? `${bestZone.count} days` : '—', color: C.purple },
                { label: 'Best Focus Day', sub: 'Day you study most often', val: bestDow?.count > 0 ? dowNames[bestDow.dow] : '—', count: bestDow?.count > 0 ? `${bestDow.count} days` : '—', color: C.green },
                { label: 'Peak Time Window', sub: 'When you focus most', val: bestWindow ? bestWindow.label : '—', count: bestWindow ? `${bestWindow.count} days` : '—', color: '#457B9D' },
              ].map(row => (
                <div key={row.label} style={{ ...tR, gridTemplateColumns: '1fr 130px 70px' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{row.label}</div>
                    <div style={{ fontSize: 10, color: C.g400, marginTop: 2 }}>{row.sub}</div>
                  </div>
                  <span style={{ textAlign: 'right', fontWeight: 700, color: row.color, fontSize: 13 }}>{row.val}</span>
                  <span style={{ textAlign: 'right', color: C.g600, fontSize: 12 }}>{row.count}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Calendar Page ───
function CalendarPage({ sessions }) {
  const [viewDate, setViewDate] = useState(new Date());
  const fireDays = getFireDays(sessions);
  const dayTotals = getDayTotals(sessions);
  const year = viewDate.getFullYear(); const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const cells = []; for (let i = 0; i < firstDay; i++) cells.push(null); for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const shiftMonth = (dir) => { const d = new Date(viewDate); d.setMonth(d.getMonth() + dir); setViewDate(d); };
  const today = new Date(); const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  let monthFireCount = 0;
  for (let d = 1; d <= daysInMonth; d++) { const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; if (fireDays.has(key)) monthFireCount++; }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <button onClick={() => shiftMonth(-1)} style={{ border: `1px solid ${C.g200}`, background: 'transparent', width: 36, height: 36, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2 }}>←</button>
        <span style={{ fontFamily: F, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>{monthName}</span>
        <button onClick={() => shiftMonth(1)} style={{ border: `1px solid ${C.g200}`, background: 'transparent', width: 36, height: 36, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2 }}>→</button>
      </div>

      <div style={{ textAlign: 'center', fontFamily: F, fontSize: 11, color: C.g400, marginBottom: 20, fontWeight: 600 }}>
        {monthFireCount} fire {monthFireCount === 1 ? 'day' : 'days'} this month
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontFamily: F, fontSize: 9, fontWeight: 700, color: C.g300, padding: '4px 0', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isFire = fireDays.has(key);
          const isToday = isCurrentMonth && day === today.getDate();
          const isMissed = isPastDate(key) && !isFire;
          const mins = dayTotals[key] || 0;
          return (
            <div key={i} style={{
              aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: isFire ? C.black : isMissed ? '#fff5f5' : isToday ? C.g100 : 'transparent',
              color: isFire ? C.white : isMissed ? C.red : C.black,
              border: isToday && !isFire ? `2px solid ${C.black}` : isMissed ? `1px solid #fce4e6` : '1px solid transparent',
              transition: 'all 0.15s', borderRadius: 2, cursor: 'default',
            }}>
              {isFire && <span style={{ fontSize: 14, lineHeight: 1 }}>🔥</span>}
              {isMissed && <span style={{ fontSize: 10, lineHeight: 1 }}>✕</span>}
              <span style={{ fontFamily: F, fontSize: isFire || isMissed ? 9 : 13, fontWeight: isToday ? 800 : 500, lineHeight: 1, marginTop: isFire || isMissed ? 1 : 0 }}>{day}</span>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 24, fontFamily: F, fontSize: 11, color: C.g400 }}>
        <span>🔥 = 2h+</span>
        <span>✕ = missed</span>
      </div>
    </div>
  );
}

// ─── Reflection Page ───
function ReflectionPage({ sessions }) {
  const [reflections, setReflections] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [editText, setEditText] = useState(""); const [editHrs, setEditHrs] = useState("");
  useEffect(() => { loadReflections().then(data => { setReflections(data); setLoaded(true); }); }, []);
  const saveReflection = async (date, note, hrsOverride) => { setReflections(prev => ({ ...prev, [date]: { note, hrsOverride } })); await upsertReflection(date, note, hrsOverride); };
  const dayTotals = getDayTotals(sessions);
  const allDates = [...new Set([...Object.keys(dayTotals), ...Object.keys(reflections)])].sort((a, b) => b.localeCompare(a));
  const today = todayStr(); if (!allDates.includes(today)) allDates.unshift(today);
  const startEdit = (date) => { const r = reflections[date] || {}; setEditingKey(date); setEditText(r.note || ""); setEditHrs(r.hrsOverride != null ? String(r.hrsOverride) : ""); };
  const saveRow = (date) => { const hrsVal = editHrs.trim() !== "" ? parseFloat(editHrs) : null; saveReflection(date, editText, hrsVal); setEditingKey(null); };
  const getHours = (date) => { const r = reflections[date]; if (r && r.hrsOverride != null) return r.hrsOverride; return (dayTotals[date] || 0) / 60; };
  const getMins = (date) => { const r = reflections[date]; if (r && r.hrsOverride != null) return Math.round(r.hrsOverride * 60); return dayTotals[date] || 0; };

  if (!loaded) return <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: F, color: C.g400, fontSize: 13 }}>Loading...</div>;

  return (
    <div>
      <Label>Daily Reflection</Label>

      {/* Table header */}
      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 64px', gap: 0, fontFamily: F, borderBottom: `2px solid ${C.black}`, paddingBottom: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.g400 }}>Date</span>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.g400 }}>Notes</span>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.g400, textAlign: 'right' }}>Hours</span>
      </div>

      {allDates.map(date => {
        const hrs = getHours(date); const mins = getMins(date);
        const isGreen = mins >= 120; const r = reflections[date] || {};
        const isEditing = editingKey === date; const isToday = date === today;
        const dayLabel = new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
        const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const rowBg = isGreen ? 'rgba(42,157,143,0.06)' : isToday ? `${C.g50}` : 'transparent';
        const hrsColor = isGreen ? C.green : C.red;
        return (
          <div key={date}
            onClick={() => { if (!isEditing) startEdit(date); }}
            style={{
              display: 'grid', gridTemplateColumns: '80px 1fr 64px', gap: 0,
              padding: '11px 8px', borderBottom: `1px solid ${C.g100}`,
              fontFamily: F, fontSize: 13, background: rowBg,
              cursor: isEditing ? 'default' : 'pointer',
              marginLeft: -8, marginRight: -8, borderRadius: 2,
              transition: 'background 0.15s',
            }}>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 12, color: C.black }}>{dayLabel}</span>
              <span style={{ fontSize: 10, color: C.g400, fontWeight: 500 }}>{dateLabel}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', paddingRight: 8 }}>
              {isEditing ? (
                <div style={{ display: 'flex', gap: 6, width: '100%', alignItems: 'center' }}>
                  <input value={editText} onChange={e => setEditText(e.target.value)} autoFocus
                    placeholder="How was your study?" onKeyDown={e => { if (e.key === 'Enter') saveRow(date); if (e.key === 'Escape') setEditingKey(null); }}
                    style={{ flex: 1, border: 'none', borderBottom: `2px solid ${C.black}`, background: 'transparent', fontSize: 13, fontFamily: F, padding: '3px 0', outline: 'none' }} />
                  <Btn size="sm" onClick={(e) => { e.stopPropagation(); saveRow(date); }}>Save</Btn>
                </div>
              ) : (
                <span style={{ color: r.note ? C.black : C.g300, fontSize: 13, fontWeight: r.note ? 500 : 400 }}>
                  {r.note || (isToday ? 'Click to add today's reflection...' : '—')}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              {isEditing ? (
                <input value={editHrs} onChange={e => setEditHrs(e.target.value)} placeholder={hrs.toFixed(1)} type="number" step="0.1"
                  onKeyDown={e => { if (e.key === 'Enter') saveRow(date); }}
                  style={{ width: 48, border: 'none', borderBottom: `1.5px solid ${C.black}`, background: 'transparent', fontSize: 13, fontFamily: F, textAlign: 'right', padding: '3px 0', outline: 'none' }} />
              ) : (
                <span style={{ fontWeight: 700, color: hrsColor, fontSize: 13 }}>{hrs.toFixed(1)}h</span>
              )}
            </div>
          </div>
        );
      })}

      {allDates.length === 0 && (
        <div style={{ textAlign: 'center', color: C.g300, fontFamily: F, fontSize: 13, padding: '40px 0' }}>No data yet — start logging sessions!</div>
      )}

      <div style={{ display: 'flex', gap: 16, marginTop: 20, fontFamily: F, fontSize: 10, color: C.g400 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, background: 'rgba(42,157,143,0.12)', border: `1px solid rgba(42,157,143,0.3)`, display: 'inline-block', borderRadius: 2 }} /> 2h+
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, background: C.g50, border: `1px solid ${C.g200}`, display: 'inline-block', borderRadius: 2 }} /> &lt;2h
        </span>
        <span>Click row to edit</span>
      </div>
    </div>
  );
}

// ─── Sleep Page ───
function SleepPage({ sleepLogs, setSleepLogs }) {
  const [sleepStart, setSleepStart] = useState("23:00");
  const [wakeUp, setWakeUp] = useState("06:30");
  const [logDate, setLogDate] = useState(todayStr());

  const calcSleepMins = (start, wake) => {
    const [sh, sm] = start.split(":").map(Number); const [wh, wm] = wake.split(":").map(Number);
    let startMin = sh * 60 + sm; let wakeMin = wh * 60 + wm;
    if (wakeMin <= startMin) wakeMin += 1440; return wakeMin - startMin;
  };

  const logSleep = async () => {
    const totalMins = calcSleepMins(sleepStart, wakeUp);
    const saved = await upsertSleepLog(logDate, sleepStart, wakeUp, totalMins);
    if (saved) { setSleepLogs(prev => { const filtered = prev.filter(l => l.date !== logDate); return [saved, ...filtered].sort((a, b) => b.date.localeCompare(a.date)); }); }
  };

  const sleepColor = (mins) => {
    if (mins < 360) return C.orange; if (mins <= 450) return C.green; return C.red;
  };

  const last14 = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); last14.push(d.toISOString().slice(0, 10)); }
  const logMap = {}; sleepLogs.forEach(l => { logMap[l.date] = l; });
  const barData = last14.map(d => ({ date: d, mins: logMap[d]?.total_mins || 0 }));
  const maxSleep = Math.max(...barData.map(d => d.mins), 1);
  const barH = 120;

  const recent7 = sleepLogs.slice(0, 7);
  const avgSleep = recent7.length > 0 ? Math.round(recent7.reduce((a, l) => a + (l.total_mins || 0), 0) / recent7.length) : 0;
  const avgBed = recent7.length > 0 ? recent7.map(l => l.sleep_start || "23:00").sort()[Math.floor(recent7.length / 2)] : "—";
  const avgWake = recent7.length > 0 ? recent7.map(l => l.wake_up || "07:00").sort()[Math.floor(recent7.length / 2)] : "—";
  const thisMonth = todayStr().slice(0, 7);
  const monthLogs = sleepLogs.filter(l => l.date.startsWith(thisMonth));
  const monthAvg = monthLogs.length > 0 ? Math.round(monthLogs.reduce((a, l) => a + (l.total_mins || 0), 0) / monthLogs.length) : 0;

  const inputWrap = { display: 'flex', flexDirection: 'column', gap: 4 };
  const inputLbl = { fontFamily: F, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.g400 };
  const timeInput = {
    border: 'none', borderBottom: `1.5px solid ${C.g200}`, padding: '8px 0', fontSize: 14,
    fontFamily: F, fontWeight: 600, outline: 'none', background: 'transparent', color: C.black,
    width: '100%', transition: 'border-color 0.15s',
  };

  return (
    <div>
      <Label>Log Sleep</Label>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 32 }}>
        <div style={{ ...inputWrap, flex: 1, minWidth: 100 }}>
          <label style={inputLbl}>Date</label>
          <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} style={timeInput} onFocus={e => e.target.style.borderBottomColor = C.black} onBlur={e => e.target.style.borderBottomColor = C.g200} />
        </div>
        <div style={{ ...inputWrap, flex: 1, minWidth: 80 }}>
          <label style={inputLbl}>Sleep</label>
          <input type="time" value={sleepStart} onChange={e => setSleepStart(e.target.value)} style={timeInput} onFocus={e => e.target.style.borderBottomColor = C.black} onBlur={e => e.target.style.borderBottomColor = C.g200} />
        </div>
        <div style={{ ...inputWrap, flex: 1, minWidth: 80 }}>
          <label style={inputLbl}>Wake up</label>
          <input type="time" value={wakeUp} onChange={e => setWakeUp(e.target.value)} style={timeInput} onFocus={e => e.target.style.borderBottomColor = C.black} onBlur={e => e.target.style.borderBottomColor = C.g200} />
        </div>
        <Btn onClick={logSleep} style={{ marginBottom: 2 }}>Log</Btn>
      </div>

      {/* Sleep bar chart */}
      <Label>Last 14 Days</Label>
      <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, minWidth: 14 * 36, height: barH + 40, paddingTop: 16 }}>
          {barData.map(d => {
            const h = d.mins > 0 ? (d.mins / maxSleep) * barH : 0;
            const color = d.mins > 0 ? sleepColor(d.mins) : C.g100;
            const dayLabel = new Date(d.date + "T12:00:00").getDate();
            return (
              <div key={d.date} style={{ flex: 1, minWidth: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: barH + 40 }}>
                {d.mins > 0 && <span style={{ fontSize: 9, fontFamily: F, fontWeight: 700, marginBottom: 2, color }}>{formatHM(d.mins)}</span>}
                <div style={{ width: '100%', height: h, background: color, borderRadius: '2px 2px 0 0', minHeight: d.mins > 0 ? 4 : 2 }} />
                <span style={{ fontSize: 8, fontFamily: F, marginTop: 3, color: C.g400 }}>{dayLabel}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8, fontFamily: F, fontSize: 10, color: C.g400 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, background: C.orange, borderRadius: 2, display: 'inline-block' }} /> &lt;6h</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, background: C.green, borderRadius: 2, display: 'inline-block' }} /> 6–7.5h</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, background: C.red, borderRadius: 2, display: 'inline-block' }} /> 7.5h+</span>
      </div>

      {/* Averages */}
      <Label style={{ marginTop: 32 }}>Averages</Label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 28 }}>
        {[
          { title: 'Weekly (last 7)', val: formatHM(avgSleep), sub1: `Bed: ${avgBed}`, sub2: `Wake: ${avgWake}` },
          { title: 'This Month', val: formatHM(monthAvg), sub1: `${monthLogs.length} nights logged`, sub2: '' },
        ].map(card => (
          <div key={card.title} style={{ border: `1px solid ${C.g200}`, padding: '16px', borderRadius: 2 }}>
            <div style={{ fontFamily: F, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.g400, marginBottom: 8 }}>{card.title}</div>
            <div style={{ fontFamily: F, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8, color: C.black }}>{card.val}</div>
            <div style={{ fontFamily: F, fontSize: 11, color: C.g600 }}>{card.sub1}</div>
            {card.sub2 && <div style={{ fontFamily: F, fontSize: 11, color: C.g600 }}>{card.sub2}</div>}
          </div>
        ))}
      </div>

      {/* Sleep log table */}
      <Label>Sleep Log</Label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 60px', gap: 0, fontFamily: F, borderBottom: `2px solid ${C.black}`, paddingBottom: 8, marginBottom: 4 }}>
        {['Date', 'Sleep', 'Wake', 'Total'].map((h, i) => (
          <span key={h} style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.g400, textAlign: i === 3 ? 'right' : 'left' }}>{h}</span>
        ))}
      </div>
      {sleepLogs.length === 0 && <div style={{ color: C.g300, fontFamily: F, fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No sleep logs yet</div>}
      {sleepLogs.map(l => {
        const color = sleepColor(l.total_mins || 0);
        const dayLabel = new Date(l.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        return (
          <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 60px', padding: '9px 0', borderBottom: `1px solid ${C.g100}`, fontFamily: F, fontSize: 12 }}>
            <span style={{ fontWeight: 600, color: C.black }}>{dayLabel}</span>
            <span style={{ color: C.g600 }}>{l.sleep_start || '—'}</span>
            <span style={{ color: C.g600 }}>{l.wake_up || '—'}</span>
            <span style={{ textAlign: 'right', fontWeight: 700, color }}>{l.total_mins ? formatHM(l.total_mins) : '—'}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Footer ───
function Footer({ onLogout }) {
  return (
    <div style={{ marginTop: 56, paddingTop: 20, borderTop: `1px solid ${C.g200}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: F }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: C.g400 }}>
        Vibe coded by Nithin Chowdary <span style={{ color: C.red }}>❤️</span>
      </span>
      <Btn variant="ghost" size="sm" onClick={onLogout}>Logout</Btn>
    </div>
  );
}

// ═══════════════════════════════════════════
// ─── Main App ───
// ═══════════════════════════════════════════
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

  const fontLink = <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap" rel="stylesheet" />;

  const loadingScreen = (msg) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: F, fontSize: 13, color: C.g400, background: C.white }}>
      {fontLink}{msg}
    </div>
  );

  if (authLoading) return loadingScreen("Loading...");
  if (!user) return <>{fontLink}<AuthPage onAuth={setUser} /></>;
  if (!loaded) return loadingScreen("Loading your data...");

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', background: C.white, minHeight: '100vh', color: C.black }}>
      {fontLink}
      <AppHeader sessions={sessions} streak={streak} todayMins={todayMins} page={page} setPage={setPage} />
      <div style={{ padding: '20px 20px 60px' }}>
        <QuotesBanner />
        <CountdownBanner sessions={sessions} />
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