import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";
import { supabase } from "./supabaseClient";

const PAGES = { TIMER: "timer", ANALYSIS: "analysis", CALENDAR: "calendar", REFLECTION: "reflection" };

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

// ─── Pop sounds (start/stop) ───
function playStartPop() {
  try {
    Tone.start();
    const synth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.1 },
      volume: -8
    }).toDestination();
    synth.triggerAttackRelease("G5", "16n");
    setTimeout(() => synth.dispose(), 500);
  } catch (e) { console.error("Pop error:", e); }
}

function playStopPop() {
  try {
    Tone.start();
    const synth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.15 },
      volume: -8
    }).toDestination();
    synth.triggerAttackRelease("D5", "16n");
    setTimeout(() => synth.dispose(), 500);
  } catch (e) { console.error("Pop error:", e); }
}

// ─── Supabase Storage helpers ───
async function loadSessions() {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .order("ts", { ascending: true });
  if (error) { console.error("Load sessions error:", error); return []; }
  return data.map(r => ({
    id: r.id,
    tag: r.tag,
    duration: r.duration,
    date: r.date,
    ts: Number(r.ts)
  }));
}

async function insertSession(session) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from("sessions").insert({
    user_id: user.id,
    tag: session.tag,
    duration: session.duration,
    date: session.date,
    ts: session.ts
  }).select().single();
  if (error) { console.error("Insert session error:", error); return null; }
  return data;
}

async function loadReflections() {
  const { data, error } = await supabase
    .from("reflections")
    .select("*");
  if (error) { console.error("Load reflections error:", error); return {}; }
  const map = {};
  data.forEach(r => {
    map[r.date] = { note: r.note || "", hrsOverride: r.hrs_override };
  });
  return map;
}

async function upsertReflection(date, note, hrsOverride) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from("reflections").upsert({
    user_id: user.id,
    date,
    note,
    hrs_override: hrsOverride
  }, { onConflict: "user_id,date" });
  if (error) console.error("Upsert reflection error:", error);
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function formatHM(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ─── Streak Calculator ───
function calcStreak(sessions) {
  const dayTotals = {};
  sessions.forEach(s => { dayTotals[s.date] = (dayTotals[s.date] || 0) + s.duration; });
  let streak = 0;
  const d = new Date();
  const todayKey = todayStr();
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

// ═══════════════════════════════════════════
// ─── AUTH: Login / Signup Page ───
// ═══════════════════════════════════════════
function AuthPage({ onAuth }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const font = "'Nunito', sans-serif";

  const handleSubmit = async () => {
    setError("");
    if (!email.trim() || !password.trim()) { setError("Email and password required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      if (isLogin) {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        setConfirmSent(true);
        setLoading(false);
        return;
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    setError("");
    if (!email.trim()) { setError("Enter your email first, then click Forgot Password"); return; }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email);
      if (err) throw err;
      setResetSent(true);
    } catch (err) {
      setError(err.message || "Something went wrong");
    }
    setLoading(false);
  };

  if (resetSent) {
    return (
      <div style={{
        maxWidth: 400, margin: "0 auto", padding: "120px 24px", minHeight: "100vh",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: font
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔑</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>Reset link sent</div>
        <div style={{ fontSize: 13, color: "#666", textAlign: "center", lineHeight: 1.6, marginBottom: 24 }}>
          We sent a password reset link to <strong>{email}</strong>. Check your inbox and follow the link to set a new password.
        </div>
        <button onClick={() => { setResetSent(false); setIsLogin(true); }} style={{
          border: "2px solid #000", background: "#000", color: "#fff",
          padding: "12px 32px", fontSize: 13, fontFamily: font, fontWeight: 700,
          letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer"
        }}>Back to Login</button>
      </div>
    );
  }

  if (confirmSent) {
    return (
      <div style={{
        maxWidth: 400, margin: "0 auto", padding: "120px 24px", minHeight: "100vh",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: font
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>Check your email</div>
        <div style={{ fontSize: 13, color: "#666", textAlign: "center", lineHeight: 1.6, marginBottom: 24 }}>
          We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then come back and log in.
        </div>
        <button onClick={() => { setConfirmSent(false); setIsLogin(true); }} style={{
          border: "2px solid #000", background: "#000", color: "#fff",
          padding: "12px 32px", fontSize: 13, fontFamily: font, fontWeight: 700,
          letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer"
        }}>Back to Login</button>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: 400, margin: "0 auto", padding: "80px 24px", minHeight: "100vh",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: font
    }}>
      <div style={{ marginBottom: 40, textAlign: "center" }}>
        <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>StudyLog</div>
        <div style={{ fontSize: 12, color: "#999", textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600 }}>
          Track your upskilling
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 320 }}>
        {/* Toggle */}
        <div style={{
          display: "flex", marginBottom: 32, borderBottom: "2px solid #000"
        }}>
          {["Login", "Sign Up"].map((label, i) => {
            const active = i === 0 ? isLogin : !isLogin;
            return (
              <button key={label} onClick={() => { setIsLogin(i === 0); setError(""); }} style={{
                flex: 1, padding: "12px 0", border: "none", cursor: "pointer",
                background: active ? "#000" : "transparent",
                color: active ? "#fff" : "#000",
                fontSize: 12, fontWeight: 700, letterSpacing: "0.08em",
                textTransform: "uppercase", fontFamily: font, transition: "all 0.2s ease"
              }}>{label}</button>
            );
          })}
        </div>

        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email"
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
          style={{
            width: "100%", border: "2px solid #000", padding: "14px 16px", fontSize: 14,
            fontFamily: font, marginBottom: 12, background: "transparent", outline: "none",
            fontWeight: 600
          }} />
        <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password"
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
          style={{
            width: "100%", border: "2px solid #000", padding: "14px 16px", fontSize: 14,
            fontFamily: font, marginBottom: 8, background: "transparent", outline: "none",
            fontWeight: 600
          }} />

        {isLogin && (
          <div style={{ textAlign: "right", marginBottom: 4 }}>
            <button onClick={handleForgotPassword} style={{
              border: "none", background: "none", cursor: "pointer",
              fontSize: 11, fontFamily: font, fontWeight: 600,
              color: "#999", textDecoration: "underline", textUnderlineOffset: 3,
              padding: 0
            }}>Forgot Password?</button>
          </div>
        )}

        {error && (
          <div style={{
            fontSize: 12, color: "#E63946", fontFamily: font, fontWeight: 600,
            padding: "8px 0", textAlign: "center"
          }}>{error}</div>
        )}

        <button onClick={handleSubmit} disabled={loading} style={{
          width: "100%", padding: "14px 0", border: "2px solid #000",
          background: "#000", color: "#fff", fontSize: 13, fontFamily: font,
          fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
          cursor: loading ? "default" : "pointer", marginTop: 16,
          opacity: loading ? 0.5 : 1, transition: "opacity 0.2s"
        }}>{loading ? "..." : isLogin ? "Login" : "Create Account"}</button>
      </div>

      <div style={{
        marginTop: 60, fontSize: 12, color: "#ccc", fontFamily: font, textAlign: "center"
      }}>
        Vibe coded by Nithin Chowdary ❤️
      </div>
    </div>
  );
}

// ─── Components ───

function Nav({ page, setPage, onLogout }) {
  const items = [
    { key: PAGES.TIMER, label: "Timer" },
    { key: PAGES.ANALYSIS, label: "Analysis" },
    { key: PAGES.CALENDAR, label: "Calendar" },
    { key: PAGES.REFLECTION, label: "Reflect" },
  ];
  return (
    <div style={{ marginBottom: 40, fontFamily: "'Nunito', sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button onClick={onLogout} title="Logout" style={{
          border: "1px solid #ddd", background: "#fff", cursor: "pointer",
          fontSize: 11, fontFamily: "'Nunito', sans-serif", fontWeight: 700,
          color: "#999", padding: "5px 14px", borderRadius: 20,
          letterSpacing: "0.04em", textTransform: "uppercase"
        }}>Logout</button>
      </div>
      <nav style={{ display: "flex", gap: 0, borderBottom: "2px solid #000" }}>
        {items.map(i => (
          <button key={i.key} onClick={() => setPage(i.key)} style={{
            flex: 1, padding: "14px 0", border: "none", cursor: "pointer",
            background: page === i.key ? "#000" : "transparent",
            color: page === i.key ? "#fff" : "#000",
            fontSize: 13, fontWeight: 600, letterSpacing: "0.08em",
            textTransform: "uppercase", fontFamily: "inherit",
            transition: "all 0.2s ease"
          }}>
            {i.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─── Top Stats Bar ───
function TopBar({ sessions, streak }) {
  const font = "'Nunito', sans-serif";
  const dayTotals = {};
  sessions.forEach(s => { dayTotals[s.date] = (dayTotals[s.date] || 0) + s.duration; });
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
  const mon = new Date(today);
  mon.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(mon);
    dd.setDate(mon.getDate() + i);
    weekDays.push(dd.toISOString().slice(0, 10));
  }
  const dayLabels = ["M", "T", "W", "TH", "F", "SA", "SU"];

  const pillStyle = {
    display: "inline-flex", alignItems: "center", gap: 7,
    background: "#000", color: "#fff",
    padding: "10px 18px", borderRadius: 40,
    fontFamily: font, fontSize: 15, fontWeight: 700,
    letterSpacing: "0.02em",
    boxShadow: "0 2px 12px rgba(0,0,0,0.18)"
  };
  const labelStyle = { fontWeight: 400, fontSize: 12, opacity: 0.6 };

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Top row: stat pills flush left, streak flush right */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={pillStyle}><span>⚡</span><span>{formatHM(maxMins)}</span><span style={labelStyle}>max</span></div>
          <div style={pillStyle}><span>📊</span><span>{formatHM(monthMins)}</span><span style={labelStyle}>{monthName}</span></div>
          <div style={pillStyle}><span>📅</span><span>{formatHM(yearMins)}</span><span style={labelStyle}>{yearStr}</span></div>
        </div>
        <div style={{
          ...pillStyle,
          background: streak > 0 ? "#000" : "#e0e0e0",
          color: streak > 0 ? "#fff" : "#999",
          boxShadow: streak > 0 ? "0 2px 12px rgba(0,0,0,0.18)" : "none"
        }}>
          <span style={{ fontSize: 20 }}>{streak > 0 ? "🔥" : "○"}</span>
          <span>{streak}</span>
          <span style={labelStyle}>{streak === 1 ? "day" : "days"}</span>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 4, fontFamily: font }}>
        {weekDays.map((dateKey, i) => {
          const mins = dayTotals[dateKey] || 0;
          const isFire = mins >= 120;
          const isToday = dateKey === todayKey;
          const hasData = mins > 0;
          const size = 36;
          return (
            <div key={dateKey} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.05em", color: isToday ? "#000" : "#bbb", textTransform: "uppercase" }}>{dayLabels[i]}</span>
              <div style={{
                width: size, height: size, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: isFire ? "#000" : isToday ? "#f0f0f0" : "transparent",
                border: hasData && !isFire ? "2px solid #ddd" : isToday && !isFire ? "2px solid #ccc" : isFire ? "none" : "2px solid #f0f0f0",
                color: isFire ? "#fff" : "#999",
                fontSize: isFire ? 16 : 10, fontWeight: 700,
                transition: "all 0.2s ease",
                boxShadow: isFire ? "0 2px 8px rgba(0,0,0,0.15)" : "none"
              }}>
                {isFire ? "🔥" : hasData ? formatHM(mins) : "·"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Timer Page ───
function TimerPage({ sessions, setSessions, onNewSession }) {
  // Restore timer state from sessionStorage on mount (survives tab switch / reload)
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
  const [focusMins, setFocusMins] = useState(() => Number(sessionStorage.getItem("sl_focusMins")) || 25);
  const [breakMins, setBreakMins] = useState(() => Number(sessionStorage.getItem("sl_breakMins")) || 5);
  const [editing, setEditing] = useState(false);
  const [tempFocus, setTempFocus] = useState("25");
  const [tempBreak, setTempBreak] = useState("5");
  const focusDur = focusMins * 60;
  const breakDur = breakMins * 60;
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);

  // Persist timer state to sessionStorage
  useEffect(() => { sessionStorage.setItem("sl_tag", tag); }, [tag]);
  useEffect(() => { sessionStorage.setItem("sl_mode", mode); }, [mode]);
  useEffect(() => { sessionStorage.setItem("sl_focusMins", String(focusMins)); }, [focusMins]);
  useEffect(() => { sessionStorage.setItem("sl_breakMins", String(breakMins)); }, [breakMins]);
  useEffect(() => {
    sessionStorage.setItem("sl_running", String(running));
    if (running) {
      const startTs = Date.now() - elapsed * 1000;
      sessionStorage.setItem("sl_startTs", String(startTs));
    } else {
      sessionStorage.setItem("sl_elapsed", String(elapsed));
      sessionStorage.removeItem("sl_startTs");
    }
  }, [running]);

  const openEdit = () => { setTempFocus(String(focusMins)); setTempBreak(String(breakMins)); setEditing(true); };
  const saveEdit = () => {
    const f = parseInt(tempFocus); const b = parseInt(tempBreak);
    if (f > 0) setFocusMins(f);
    if (b > 0) setBreakMins(b);
    setElapsed(0); setRunning(false); setEditing(false);
  };

  const remaining = mode === "focus" ? Math.max(focusDur - elapsed, 0) : Math.max(breakDur - elapsed, 0);
  const total = mode === "focus" ? focusDur : breakDur;
  const progress = 1 - remaining / total;

  useEffect(() => {
    if (running) {
      startTimeRef.current = Date.now() - elapsed * 1000;
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 200);
    } else { clearInterval(intervalRef.current); }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  // Recalculate elapsed when tab becomes visible again
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        const startTs = sessionStorage.getItem("sl_startTs");
        const wasRunning = sessionStorage.getItem("sl_running") === "true";
        if (wasRunning && startTs) {
          const newElapsed = Math.floor((Date.now() - Number(startTs)) / 1000);
          setElapsed(newElapsed);
          startTimeRef.current = Number(startTs);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const addSession = useCallback(async (newSession) => {
    // Optimistic: add to local state immediately
    setSessions(prev => [...prev, newSession]);
    // Then persist to Supabase
    const saved = await insertSession(newSession);
    if (saved) {
      // Replace optimistic entry with real DB row (has real id)
      setSessions(prev => prev.map(s => s.ts === newSession.ts && s.tag === newSession.tag ? {
        id: saved.id, tag: saved.tag, duration: saved.duration, date: saved.date, ts: Number(saved.ts)
      } : s));
    }
  }, [setSessions]);

  useEffect(() => {
    if (remaining <= 0 && running) {
      setRunning(false);
      playBell();
      if (mode === "focus") {
        const mins = Math.round(focusDur / 60);
        const newSession = { id: Date.now(), tag: tag || "Untitled", duration: mins, date: todayStr(), ts: Date.now() };
        addSession(newSession);
        setMode("break"); setElapsed(0);
      } else { setMode("focus"); setElapsed(0); }
    }
  }, [remaining, running]);

  const toggle = () => {
    if (!running) { initBell(); playStartPop(); }
    else { playStopPop(); }
    setRunning(!running);
  };
  const reset = () => { setRunning(false); setElapsed(0); };
  const skip = () => {
    setRunning(false);
    if (mode === "focus") {
      const mins = Math.max(1, Math.round(elapsed / 60));
      if (elapsed > 30) {
        const newSession = { id: Date.now(), tag: tag || "Untitled", duration: mins, date: todayStr(), ts: Date.now() };
        addSession(newSession);
      }
      setMode("break");
    } else { setMode("focus"); }
    setElapsed(0);
  };

  const [manualTag, setManualTag] = useState("");
  const [manualMins, setManualMins] = useState("");
  const logManual = () => {
    const mins = parseInt(manualMins);
    if (!manualTag.trim() || isNaN(mins) || mins <= 0) return;
    const newSession = { id: Date.now(), tag: manualTag.trim(), duration: mins, date: todayStr(), ts: Date.now() };
    addSession(newSession);
    setManualTag(""); setManualMins("");
  };

  const todaySessions = sessions.filter(s => s.date === todayStr());
  const todayTotal = todaySessions.reduce((a, s) => a + s.duration, 0);
  const circleR = 90;
  const circleC = 2 * Math.PI * circleR;

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 30 }}>
        <input value={tag} onChange={e => setTag(e.target.value)}
          placeholder="What are you studying?"
          style={{
            border: "none", borderBottom: "2px solid #000", background: "transparent",
            fontSize: 18, fontFamily: "'Nunito', sans-serif", textAlign: "center",
            padding: "8px 16px", width: "70%", maxWidth: 340, outline: "none", fontWeight: 600
          }}
        />
      </div>

      {editing ? (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          marginBottom: 24, fontFamily: "'Nunito', sans-serif"
        }}>
          <label style={{ fontSize: 12, color: "#666" }}>Focus</label>
          <input value={tempFocus} onChange={e => setTempFocus(e.target.value)} type="number"
            style={{ width: 56, border: "2px solid #000", padding: "6px 8px", fontSize: 14,
              fontFamily: "inherit", textAlign: "center", background: "transparent", outline: "none" }} />
          <label style={{ fontSize: 12, color: "#666" }}>Break</label>
          <input value={tempBreak} onChange={e => setTempBreak(e.target.value)} type="number"
            style={{ width: 56, border: "2px solid #000", padding: "6px 8px", fontSize: 14,
              fontFamily: "inherit", textAlign: "center", background: "transparent", outline: "none" }} />
          <span style={{ fontSize: 11, color: "#999" }}>min</span>
          <button onClick={saveEdit} style={{
            border: "2px solid #000", background: "#000", color: "#fff", padding: "6px 14px",
            fontSize: 12, fontFamily: "inherit", fontWeight: 700, cursor: "pointer"
          }}>Set</button>
          <button onClick={() => setEditing(false)} style={{
            border: "2px solid #ccc", background: "transparent", color: "#999", padding: "6px 10px",
            fontSize: 12, fontFamily: "inherit", cursor: "pointer"
          }}>✕</button>
        </div>
      ) : (
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <button onClick={openEdit} style={{
            border: "none", background: "none", cursor: "pointer",
            fontFamily: "'Nunito', sans-serif", fontSize: 12, color: "#999",
            textDecoration: "underline", textUnderlineOffset: 3
          }}>⚙ {focusMins}m focus / {breakMins}m break</button>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
        <div style={{ position: "relative", width: 220, height: 220 }}>
          <svg width={220} height={220} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={110} cy={110} r={circleR} fill="none" stroke="#eee" strokeWidth={6} />
            <circle cx={110} cy={110} r={circleR} fill="none"
              stroke={mode === "focus" ? "#000" : "#888"}
              strokeWidth={6} strokeLinecap="round"
              strokeDasharray={circleC}
              strokeDashoffset={circleC * (1 - progress)}
              style={{ transition: "stroke-dashoffset 0.3s ease" }}
            />
          </svg>
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center"
          }}>
            <div style={{
              fontSize: 11, fontFamily: "'Nunito', sans-serif", textTransform: "uppercase",
              letterSpacing: "0.15em", color: "#999", marginBottom: 4, fontWeight: 600
            }}>{mode === "focus" ? "Focus" : "Break"}</div>
            <div style={{
              fontSize: 42, fontFamily: "'Nunito', sans-serif", fontWeight: 700,
              letterSpacing: "-0.02em"
            }}>{formatTime(remaining)}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 40 }}>
        <button onClick={toggle} style={{
          padding: "12px 36px", border: "2px solid #000", cursor: "pointer",
          background: running ? "transparent" : "#000", color: running ? "#000" : "#fff",
          fontSize: 13, fontFamily: "'Nunito', sans-serif", fontWeight: 700,
          letterSpacing: "0.06em", textTransform: "uppercase", borderRadius: 0, transition: "all 0.2s"
        }}>{running ? "Pause" : "Start"}</button>
        <button onClick={reset} style={{
          padding: "12px 20px", border: "2px solid #ccc", cursor: "pointer",
          background: "transparent", color: "#999", fontSize: 13,
          fontFamily: "'Nunito', sans-serif", fontWeight: 600,
          letterSpacing: "0.06em", textTransform: "uppercase", borderRadius: 0
        }}>Reset</button>
        <button onClick={skip} style={{
          padding: "12px 20px", border: "2px solid #ccc", cursor: "pointer",
          background: "transparent", color: "#999", fontSize: 13,
          fontFamily: "'Nunito', sans-serif", fontWeight: 600,
          letterSpacing: "0.06em", textTransform: "uppercase", borderRadius: 0
        }}>Skip</button>
      </div>

      <div style={{ borderTop: "1px solid #eee", margin: "0 0 30px" }} />

      <div style={{ marginBottom: 36 }}>
        <div style={{
          fontSize: 11, fontFamily: "'Nunito', sans-serif", textTransform: "uppercase",
          letterSpacing: "0.15em", color: "#999", marginBottom: 12, fontWeight: 600
        }}>Quick Log</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input value={manualTag} onChange={e => setManualTag(e.target.value)}
            placeholder="Tag" style={{
              border: "2px solid #000", padding: "10px 14px", fontSize: 14,
              fontFamily: "'Nunito', sans-serif", flex: 1, minWidth: 120,
              background: "transparent", outline: "none"
            }} />
          <input value={manualMins} onChange={e => setManualMins(e.target.value)}
            placeholder="mins" type="number" style={{
              border: "2px solid #000", padding: "10px 14px", fontSize: 14,
              fontFamily: "'Nunito', sans-serif", width: 80,
              background: "transparent", outline: "none"
            }} />
          <button onClick={logManual} style={{
            padding: "10px 20px", border: "2px solid #000", background: "#000",
            color: "#fff", fontSize: 13, fontFamily: "'Nunito', sans-serif",
            fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em"
          }}>+</button>
        </div>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <span style={{
            fontSize: 11, fontFamily: "'Nunito', sans-serif", textTransform: "uppercase",
            letterSpacing: "0.15em", color: "#999", fontWeight: 600
          }}>Today's Sessions</span>
          <span style={{ fontSize: 14, fontFamily: "'Nunito', sans-serif", fontWeight: 700 }}>
            {formatHM(todayTotal)} {todayTotal >= 120 && "🔥"}
          </span>
        </div>
        {todaySessions.length === 0 && (
          <div style={{ color: "#ccc", fontFamily: "'Nunito', sans-serif", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
            No sessions yet. Start studying!
          </div>
        )}
        {todaySessions.map(s => (
          <div key={s.id} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 0", borderBottom: "1px solid #f0f0f0",
            fontFamily: "'Nunito', sans-serif", fontSize: 14
          }}>
            <span style={{ fontWeight: 600 }}>{s.tag}</span>
            <span style={{ color: "#999" }}>{formatHM(s.duration)}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 48, padding: "14px 20px", borderRadius: 12,
        background: "#E8F4FD", textAlign: "center",
        fontSize: 13, fontWeight: 600, color: "#4A5568", letterSpacing: "0.01em"
      }}>
        Vibe coded by Nithin Chowdary <span style={{ color: "#E53E3E", fontSize: 15 }}>❤️</span>
      </div>
    </div>
  );
}

// ─── Color palette for tags ───
const TAG_COLORS = [
  "#E63946", "#457B9D", "#2A9D8F", "#E9C46A", "#F4A261",
  "#6A4C93", "#1982C4", "#8AC926", "#FF595E", "#6D6875",
  "#264653", "#F77F00", "#D62828", "#023E8A", "#606C38"
];
function getTagColor(tag, allTags) {
  return TAG_COLORS[allTags.indexOf(tag) % TAG_COLORS.length];
}

function getWeekRange(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const days = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(mon); dd.setDate(mon.getDate() + i);
    days.push(dd.toISOString().slice(0, 10));
  }
  return days;
}

function getMonthDates(year, month) {
  const n = new Date(year, month + 1, 0).getDate();
  const dates = [];
  for (let d = 1; d <= n; d++)
    dates.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  return dates;
}

function SectionHeader({ children }) {
  return (
    <div style={{
      fontSize: 11, fontFamily: "'Nunito', sans-serif", textTransform: "uppercase",
      letterSpacing: "0.15em", color: "#999", marginBottom: 14, fontWeight: 600, marginTop: 40
    }}>{children}</div>
  );
}

function TagBarChart({ sorted, allTags }) {
  if (sorted.length === 0) return null;
  const maxVal = sorted[0][1];
  const barH = 160;
  return (
    <div style={{ overflowX: "auto", paddingBottom: 8 }}>
      <div style={{
        display: "flex", alignItems: "flex-end", gap: 6, minWidth: sorted.length * 64,
        height: barH + 40, paddingTop: 20
      }}>
        {sorted.map(([tag, mins]) => {
          const h = maxVal > 0 ? (mins / maxVal) * barH : 0;
          const color = getTagColor(tag, allTags);
          return (
            <div key={tag} style={{
              flex: 1, minWidth: 48, maxWidth: 80, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "flex-end", height: barH + 40
            }}>
              <span style={{
                fontSize: 11, fontFamily: "'Nunito', sans-serif", fontWeight: 700,
                marginBottom: 4, color
              }}>{formatHM(mins)}</span>
              <div style={{
                width: "100%", height: h, background: color, borderRadius: "4px 4px 0 0",
                transition: "height 0.4s ease", minHeight: mins > 0 ? 6 : 0
              }} />
              <span style={{
                fontSize: 10, fontFamily: "'Nunito', sans-serif", marginTop: 6,
                textAlign: "center", color: "#666", maxWidth: 80, overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%"
              }}>{tag}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PeriodBarChart({ dates, sessions }) {
  const dayTotals = {};
  sessions.forEach(s => { dayTotals[s.date] = (dayTotals[s.date] || 0) + s.duration; });
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
      <div style={{ display: "flex", gap: 24, marginBottom: 16, fontFamily: "'Nunito', sans-serif" }}>
        {[["Total", totalMins], ["Peak", peakVal], ["Avg/day", avgMins]].map(([label, val]) => (
          <div key={label}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{formatHM(val)}</div>
            <div style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ position: "relative", overflowX: "auto", paddingBottom: 8 }}>
        <div style={{
          display: "flex", alignItems: "flex-end", gap: isWeekly ? 8 : 2,
          minWidth: isWeekly ? dates.length * 52 : dates.length * 16,
          height: barH + 50, paddingTop: 24, position: "relative"
        }}>
          {peakVal > 0 && (
            <div style={{ position: "absolute", top: 24, left: 0, right: 0, height: barH, pointerEvents: "none" }}>
              <div style={{
                position: "absolute", bottom: `${(peakVal / maxVal) * barH}px`,
                left: 0, right: 0, borderTop: "2px dashed #E63946", opacity: 0.6
              }} />
              <span style={{
                position: "absolute", bottom: `${(peakVal / maxVal) * barH + 4}px`,
                right: 0, fontSize: 9, color: "#E63946",
                fontFamily: "'Nunito', sans-serif", fontWeight: 700
              }}>PEAK {formatHM(peakVal)}</span>
            </div>
          )}

          {data.map((d) => {
            const h = maxVal > 0 ? (d.mins / maxVal) * barH : 0;
            const isPeak = d.mins === peakVal && d.mins > 0;
            const dayLabel = isWeekly
              ? new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" })
              : String(new Date(d.date + "T12:00:00").getDate());
            return (
              <div key={d.date} style={{
                flex: 1, minWidth: isWeekly ? 40 : 10, maxWidth: isWeekly ? 60 : 24,
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "flex-end", height: barH + 50
              }}>
                {isWeekly && d.mins > 0 && (
                  <span style={{
                    fontSize: 10, fontFamily: "'Nunito', sans-serif", fontWeight: 600,
                    marginBottom: 3, color: isPeak ? "#E63946" : "#666"
                  }}>{formatHM(d.mins)}</span>
                )}
                <div style={{
                  width: "100%", height: h,
                  background: isPeak
                    ? "linear-gradient(180deg, #E63946, #FF6B6B)"
                    : d.mins >= 120
                      ? "linear-gradient(180deg, #2A9D8F, #52D3C8)"
                      : d.mins > 0
                        ? "linear-gradient(180deg, #457B9D, #7EB3D0)"
                        : "#f0f0f0",
                  borderRadius: "3px 3px 0 0", transition: "height 0.4s ease",
                  minHeight: d.mins > 0 ? 4 : 2, position: "relative"
                }}>
                  {isPeak && (
                    <div style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", fontSize: 12 }}>⭐</div>
                  )}
                </div>
                <span style={{
                  fontSize: isWeekly ? 10 : 8, fontFamily: "'Nunito', sans-serif",
                  marginTop: 4, color: isPeak ? "#E63946" : "#999", fontWeight: isPeak ? 700 : 400
                }}>{dayLabel}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 12, fontFamily: "'Nunito', sans-serif", fontSize: 10, color: "#999" }}>
        {[["#E63946", "Peak"], ["#2A9D8F", "2h+"], ["#457B9D", "<2h"]].map(([c, l]) => (
          <span key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, background: c, borderRadius: 2, display: "inline-block" }} /> {l}
          </span>
        ))}
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 12, height: 0, borderTop: "2px dashed #E63946", display: "inline-block" }} /> Peak line
        </span>
      </div>
    </div>
  );
}

async function exportToExcel(sessions) {
  const XLSX = await import("xlsx");
  const sessionsData = sessions.map(s => ({
    Date: s.date, Tag: s.tag, "Duration (mins)": s.duration, "Duration (hrs)": +(s.duration / 60).toFixed(2)
  }));
  const dayMap = {};
  sessions.forEach(s => { dayMap[s.date] = (dayMap[s.date] || 0) + s.duration; });
  const dailyData = Object.entries(dayMap).sort((a, b) => a[0].localeCompare(b[0])).map(([date, mins]) => ({
    Date: date, "Total (mins)": mins, "Total (hrs)": +(mins / 60).toFixed(2), "2h+ Day": mins >= 120 ? "🔥 Yes" : "No"
  }));
  const tagMap = {};
  sessions.forEach(s => { tagMap[s.tag] = (tagMap[s.tag] || 0) + s.duration; });
  const total = sessions.reduce((a, s) => a + s.duration, 0);
  const tagData = Object.entries(tagMap).sort((a, b) => b[1] - a[1]).map(([tag, mins]) => ({
    Tag: tag, "Total (mins)": mins, "Total (hrs)": +(mins / 60).toFixed(2),
    "% of Total": +((mins / total) * 100).toFixed(1) + "%"
  }));
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(sessionsData);
  const ws2 = XLSX.utils.json_to_sheet(dailyData);
  const ws3 = XLSX.utils.json_to_sheet(tagData);
  ws1["!cols"] = [{ wch: 12 }, { wch: 20 }, { wch: 16 }, { wch: 16 }];
  ws2["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];
  ws3["!cols"] = [{ wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws1, "All Sessions");
  XLSX.utils.book_append_sheet(wb, ws2, "Daily Summary");
  XLSX.utils.book_append_sheet(wb, ws3, "Tag Summary");
  XLSX.writeFile(wb, `StudyLog_Export_${todayStr()}.xlsx`);
}

function AnalysisPage({ sessions }) {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [showReports, setShowReports] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const reportsRef = useRef(null);
  const advancedRef = useRef(null);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() };
  });

  const font = "'Nunito', sans-serif";
  const daySessions = sessions.filter(s => s.date === selectedDate);
  const tagTotals = {};
  daySessions.forEach(s => { tagTotals[s.tag] = (tagTotals[s.tag] || 0) + s.duration; });
  const totalMins = daySessions.reduce((a, s) => a + s.duration, 0);
  const sorted = Object.entries(tagTotals).sort((a, b) => b[1] - a[1]);
  const allTags = [...new Set(sessions.map(s => s.tag))];

  const shiftDate = (dir) => {
    const d = new Date(selectedDate + "T12:00:00"); d.setDate(d.getDate() + dir);
    setSelectedDate(d.toISOString().slice(0, 10));
  };
  const isToday = selectedDate === todayStr();
  const dateLabel = isToday ? "Today" : new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const weekDates = getWeekRange(selectedDate);
  const weekLabel = `${new Date(weekDates[0] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(weekDates[6] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  const monthDates = getMonthDates(viewMonth.year, viewMonth.month);
  const monthLabel = new Date(viewMonth.year, viewMonth.month).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const shiftMonth = (dir) => {
    setViewMonth(prev => {
      let m = prev.month + dir, y = prev.year;
      if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
      return { year: y, month: m };
    });
  };

  const dayTotalsAll = {};
  sessions.forEach(s => { dayTotalsAll[s.date] = (dayTotalsAll[s.date] || 0) + s.duration; });

  const tagDayTotals = {};
  sessions.forEach(s => {
    if (!tagDayTotals[s.tag]) tagDayTotals[s.tag] = {};
    tagDayTotals[s.tag][s.date] = (tagDayTotals[s.tag][s.date] || 0) + s.duration;
  });
  const personalBests = Object.entries(tagDayTotals).map(([tag, days]) => {
    const best = Object.entries(days).sort((a, b) => b[1] - a[1])[0];
    return { tag, mins: best ? best[1] : 0, date: best ? best[0] : "" };
  }).sort((a, b) => b.mins - a.mins);

  const buckets = [
    { label: "0–30m", min: 0, max: 30 }, { label: "30m–1h", min: 30, max: 60 },
    { label: "1–2h", min: 60, max: 120 }, { label: "2–3h", min: 120, max: 180 },
    { label: "3–4h", min: 180, max: 240 }, { label: "4h+", min: 240, max: 99999 },
  ];
  const bucketCounts = buckets.map(b => ({
    ...b, count: Object.values(dayTotalsAll).filter(m => m >= b.min && m < b.max).length
  }));
  const maxBucket = Math.max(...bucketCounts.map(b => b.count), 1);
  const distColors = ["#E63946", "#E63946", "#F4A261", "#2A9D8F", "#2A9D8F", "#457B9D"];

  const dowDaySets = [new Set(), new Set(), new Set(), new Set(), new Set(), new Set(), new Set()];
  Object.keys(dayTotalsAll).forEach(date => {
    dowDaySets[new Date(date + "T12:00:00").getDay()].add(date);
  });
  const dowNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dowCounts = dowDaySets.map((s, i) => ({ dow: i, count: s.size }));
  const bestDow = [...dowCounts].sort((a, b) => b.count - a.count)[0];

  const windowDaySets = {};
  sessions.forEach(s => {
    if (!s.ts) return;
    const hr = new Date(s.ts).getHours();
    const start = Math.floor(hr / 2) * 2;
    const end = start + 2;
    const fmt = (h) => { if (h === 0) return "12 AM"; if (h < 12) return `${h} AM`; if (h === 12) return "12 PM"; return `${h - 12} PM`; };
    const label = `${fmt(start)} – ${fmt(end > 23 ? 0 : end)}`;
    if (!windowDaySets[label]) windowDaySets[label] = new Set();
    windowDaySets[label].add(s.date);
  });
  const windowData = Object.entries(windowDaySets).map(([label, set]) => ({ label, count: set.size })).sort((a, b) => b.count - a.count);
  const bestWindow = windowData[0];

  const zones = [
    { label: "< 1 hr", min: 0, max: 60 }, { label: "1–2 hrs", min: 60, max: 120 },
    { label: "2–3 hrs", min: 120, max: 180 }, { label: "3–4 hrs", min: 180, max: 240 },
    { label: "4+ hrs", min: 240, max: 99999 },
  ];
  const bestZone = zones.map(z => ({
    ...z, count: Object.values(dayTotalsAll).filter(m => m >= z.min && m < z.max).length
  })).sort((a, b) => b.count - a.count)[0];

  const navBtn = { border: "none", background: "none", fontSize: 20, cursor: "pointer" };
  const tH = { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: font };
  const tR = { display: "grid", padding: "9px 0", borderBottom: "1px solid #f0f0f0", fontFamily: font, fontSize: 13, alignItems: "center" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => exportToExcel(sessions)} disabled={sessions.length === 0} style={{
          padding: "8px 16px", border: "2px solid #000", background: "#000", color: "#fff",
          fontSize: 11, fontFamily: font, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
          cursor: sessions.length > 0 ? "pointer" : "default",
          opacity: sessions.length > 0 ? 1 : 0.3, display: "flex", alignItems: "center", gap: 6
        }}>↓ Export Excel</button>
      </div>

      <SectionHeader>Daily Report</SectionHeader>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, marginBottom: 20, fontFamily: font }}>
        <button onClick={() => shiftDate(-1)} style={navBtn}>←</button>
        <span style={{ fontSize: 16, fontWeight: 700, minWidth: 140, textAlign: "center" }}>{dateLabel}</span>
        <button onClick={() => shiftDate(1)} style={{ ...navBtn, opacity: isToday ? 0.2 : 1, pointerEvents: isToday ? "none" : "auto" }}>→</button>
      </div>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 42, fontFamily: font, fontWeight: 700 }}>{formatHM(totalMins)}</div>
        <div style={{ fontSize: 11, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.15em", color: "#999", marginTop: 4, fontWeight: 600 }}>
          Total Upskilling {totalMins >= 120 && "🔥"}
        </div>
      </div>
      {sorted.length === 0 ? (
        <div style={{ textAlign: "center", color: "#ccc", fontFamily: font, fontSize: 13, padding: "30px 0" }}>No sessions recorded</div>
      ) : (
        <TagBarChart sorted={sorted} allTags={allTags} />
      )}
      {daySessions.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 10, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.12em", color: "#bbb", marginBottom: 8, fontWeight: 600 }}>Session Log</div>
          {daySessions.map(s => (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f5f5f5", fontFamily: font, fontSize: 13 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: getTagColor(s.tag, allTags), display: "inline-block" }} />
                {s.tag}
              </span>
              <span style={{ color: "#999" }}>{formatHM(s.duration)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 32, textAlign: "center" }}>
        <button onClick={() => setShowReports(!showReports)} style={{
          border: "2px solid #000", background: showReports ? "#000" : "transparent", color: showReports ? "#fff" : "#000",
          padding: "10px 24px", fontSize: 12, fontFamily: font, fontWeight: 700, letterSpacing: "0.06em",
          textTransform: "uppercase", cursor: "pointer", borderRadius: 0, transition: "all 0.2s ease",
          display: "inline-flex", alignItems: "center", gap: 8
        }}>
          <span style={{ display: "inline-block", transition: "transform 0.3s ease", transform: showReports ? "rotate(180deg)" : "rotate(0deg)", fontSize: 10 }}>▼</span>
          {showReports ? "Hide Reports" : "Weekly & Monthly Reports"}
        </button>
      </div>
      <div style={{ maxHeight: showReports ? (reportsRef.current ? reportsRef.current.scrollHeight + "px" : "2000px") : "0px", overflow: "hidden", transition: "max-height 0.5s ease, opacity 0.4s ease", opacity: showReports ? 1 : 0 }}>
        <div ref={reportsRef}>
          <SectionHeader>Weekly Report — {weekLabel}</SectionHeader>
          <PeriodBarChart dates={weekDates} sessions={sessions} />
          <div style={{ marginTop: 40, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 11, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.15em", color: "#999", fontWeight: 600 }}>Monthly Report</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: font }}>
              <button onClick={() => shiftMonth(-1)} style={{ ...navBtn, fontSize: 16 }}>←</button>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{monthLabel}</span>
              <button onClick={() => shiftMonth(1)} style={{ ...navBtn, fontSize: 16 }}>→</button>
            </div>
          </div>
          <PeriodBarChart dates={monthDates} sessions={sessions} />
        </div>
      </div>

      {personalBests.length > 0 && (<>
        <SectionHeader>🏆 Personal Bests</SectionHeader>
        <div style={{ ...tR, borderBottom: "2px solid #000", padding: "0 0 6px", gridTemplateColumns: "1fr 100px 80px" }}>
          <span style={tH}>Category</span>
          <span style={{ ...tH, textAlign: "right" }}>Best</span>
          <span style={{ ...tH, textAlign: "right" }}>Date</span>
        </div>
        {personalBests.map((b, i) => (
          <div key={b.tag} style={{ ...tR, gridTemplateColumns: "1fr 100px 80px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: getTagColor(b.tag, allTags), display: "inline-block" }} />
              <span style={{ fontWeight: 600 }}>{b.tag}</span>
              {i === 0 && <span style={{ fontSize: 11 }}>👑</span>}
            </span>
            <span style={{ textAlign: "right", fontWeight: 700, color: "#2A9D8F" }}>{formatHM(b.mins)}</span>
            <span style={{ textAlign: "right", color: "#999", fontSize: 11 }}>
              {b.date ? new Date(b.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
            </span>
          </div>
        ))}
      </>)}

      <div style={{ marginTop: 32, textAlign: "center" }}>
        <button onClick={() => setShowAdvanced(!showAdvanced)} style={{
          border: "2px solid #000", background: showAdvanced ? "#000" : "transparent", color: showAdvanced ? "#fff" : "#000",
          padding: "10px 24px", fontSize: 12, fontFamily: font, fontWeight: 700, letterSpacing: "0.06em",
          textTransform: "uppercase", cursor: "pointer", borderRadius: 0, transition: "all 0.2s ease",
          display: "inline-flex", alignItems: "center", gap: 8
        }}>
          <span style={{ display: "inline-block", transition: "transform 0.3s ease", transform: showAdvanced ? "rotate(180deg)" : "rotate(0deg)", fontSize: 10 }}>▼</span>
          {showAdvanced ? "Hide Advanced" : "Advanced Analysis"}
        </button>
      </div>
      <div style={{ maxHeight: showAdvanced ? (advancedRef.current ? advancedRef.current.scrollHeight + "px" : "3000px") : "0px", overflow: "hidden", transition: "max-height 0.5s ease, opacity 0.4s ease", opacity: showAdvanced ? 1 : 0 }}>
        <div ref={advancedRef}>
          <SectionHeader>Distribution — Hours vs Days</SectionHeader>
          <div style={{ overflowX: "auto", paddingBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, minWidth: bucketCounts.length * 56, height: 160, paddingTop: 16 }}>
              {bucketCounts.map((c, i) => {
                const h = maxBucket > 0 ? (c.count / maxBucket) * 120 : 0;
                return (
                  <div key={c.label} style={{ flex: 1, minWidth: 44, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: 160 }}>
                    <span style={{ fontSize: 11, fontFamily: font, fontWeight: 700, marginBottom: 4, color: distColors[i] }}>{c.count > 0 ? c.count : ""}</span>
                    <div style={{ width: "100%", height: h, background: distColors[i], borderRadius: "4px 4px 0 0", transition: "height 0.4s ease", minHeight: c.count > 0 ? 6 : 2, opacity: 0.8 }} />
                    <span style={{ fontSize: 9, fontFamily: font, marginTop: 6, color: "#999" }}>{c.label}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ fontFamily: font, fontSize: 10, color: "#bbb", marginTop: 8, textAlign: "center" }}>Hours per day → Number of days</div>
          </div>

          <SectionHeader>Focus Insights</SectionHeader>
          {sessions.length > 0 && (<>
            <div style={{ ...tR, borderBottom: "2px solid #000", padding: "0 0 6px", gridTemplateColumns: "1fr 130px 70px" }}>
              <span style={tH}>Insight</span>
              <span style={{ ...tH, textAlign: "right" }}>Value</span>
              <span style={{ ...tH, textAlign: "right" }}>Count</span>
            </div>
            <div style={{ ...tR, gridTemplateColumns: "1fr 130px 70px" }}>
              <div><div style={{ fontWeight: 600 }}>Comfort Zone</div><div style={{ fontSize: 10, color: "#999", marginTop: 2 }}>Most consistent range</div></div>
              <span style={{ textAlign: "right", fontWeight: 700, color: "#6A4C93" }}>{bestZone && bestZone.count > 0 ? bestZone.label : "—"}</span>
              <span style={{ textAlign: "right", color: "#666" }}>{bestZone && bestZone.count > 0 ? `${bestZone.count} days` : "—"}</span>
            </div>
            <div style={{ ...tR, gridTemplateColumns: "1fr 130px 70px" }}>
              <div><div style={{ fontWeight: 600 }}>Best Focus Day</div><div style={{ fontSize: 10, color: "#999", marginTop: 2 }}>Day you study most often</div></div>
              <span style={{ textAlign: "right", fontWeight: 700, color: "#2A9D8F" }}>{bestDow && bestDow.count > 0 ? dowNames[bestDow.dow] : "—"}</span>
              <span style={{ textAlign: "right", color: "#666" }}>{bestDow && bestDow.count > 0 ? `${bestDow.count} days` : "—"}</span>
            </div>
            <div style={{ ...tR, gridTemplateColumns: "1fr 130px 70px" }}>
              <div><div style={{ fontWeight: 600 }}>Peak Time Window</div><div style={{ fontSize: 10, color: "#999", marginTop: 2 }}>When you focus most</div></div>
              <span style={{ textAlign: "right", fontWeight: 700, color: "#457B9D" }}>{bestWindow ? bestWindow.label : "—"}</span>
              <span style={{ textAlign: "right", color: "#666" }}>{bestWindow ? `${bestWindow.count} days` : "—"}</span>
            </div>
          </>)}
        </div>
      </div>
    </div>
  );
}

function CalendarPage({ sessions }) {
  const [viewDate, setViewDate] = useState(new Date());
  const fireDays = getFireDays(sessions);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const shiftMonth = (dir) => { const d = new Date(viewDate); d.setMonth(d.getMonth() + dir); setViewDate(d); };
  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  let monthFireCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (fireDays.has(key)) monthFireCount++;
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, marginBottom: 8, fontFamily: "'Nunito', sans-serif" }}>
        <button onClick={() => shiftMonth(-1)} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer" }}>←</button>
        <span style={{ fontSize: 16, fontWeight: 700, minWidth: 200, textAlign: "center" }}>{monthName}</span>
        <button onClick={() => shiftMonth(1)} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer" }}>→</button>
      </div>
      <div style={{ textAlign: "center", fontFamily: "'Nunito', sans-serif", fontSize: 12, color: "#999", marginBottom: 24 }}>
        {monthFireCount} fire {monthFireCount === 1 ? "day" : "days"} this month
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4, fontFamily: "'Nunito', sans-serif" }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 11, color: "#bbb", fontWeight: 600, padding: "4px 0", letterSpacing: "0.1em" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, fontFamily: "'Nunito', sans-serif" }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isFire = fireDays.has(key);
          const isToday = isCurrentMonth && day === today.getDate();
          return (
            <div key={i} style={{
              aspectRatio: "1", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              background: isFire ? "#000" : isToday ? "#f5f5f5" : "transparent",
              color: isFire ? "#fff" : "#000",
              fontSize: 14, fontWeight: isToday ? 800 : 500,
              borderRadius: 0, transition: "all 0.2s"
            }}>
              {isFire && <span style={{ fontSize: 16, lineHeight: 1 }}>🔥</span>}
              <span style={{ fontSize: isFire ? 10 : 14, lineHeight: 1, marginTop: isFire ? 1 : 0 }}>{day}</span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 32, display: "flex", justifyContent: "center", gap: 24, fontFamily: "'Nunito', sans-serif", fontSize: 12, color: "#999" }}>
        <span>🔥 = 2h+ study day</span>
      </div>
    </div>
  );
}

// ─── Reflection Page (Supabase) ───
function ReflectionPage({ sessions }) {
  const [reflections, setReflections] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [editText, setEditText] = useState("");
  const [editHrs, setEditHrs] = useState("");

  useEffect(() => { loadReflections().then(data => { setReflections(data); setLoaded(true); }); }, []);

  const saveReflection = async (date, note, hrsOverride) => {
    const updated = { ...reflections, [date]: { note, hrsOverride } };
    setReflections(updated);
    await upsertReflection(date, note, hrsOverride);
  };

  const dayTotals = {};
  sessions.forEach(s => { dayTotals[s.date] = (dayTotals[s.date] || 0) + s.duration; });

  const allDates = [...new Set([...Object.keys(dayTotals), ...Object.keys(reflections)])].sort((a, b) => b.localeCompare(a));
  const today = todayStr();
  if (!allDates.includes(today)) allDates.unshift(today);

  const startEdit = (date) => {
    const r = reflections[date] || {};
    setEditingKey(date);
    setEditText(r.note || "");
    setEditHrs(r.hrsOverride != null ? String(r.hrsOverride) : "");
  };

  const saveRow = (date) => {
    const hrsVal = editHrs.trim() !== "" ? parseFloat(editHrs) : null;
    saveReflection(date, editText, hrsVal);
    setEditingKey(null);
  };

  const getHours = (date) => {
    const r = reflections[date];
    if (r && r.hrsOverride != null) return r.hrsOverride;
    return (dayTotals[date] || 0) / 60;
  };

  const getMins = (date) => {
    const r = reflections[date];
    if (r && r.hrsOverride != null) return Math.round(r.hrsOverride * 60);
    return dayTotals[date] || 0;
  };

  if (!loaded) return (
    <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "'Nunito', sans-serif", color: "#999", fontSize: 13 }}>Loading...</div>
  );

  return (
    <div>
      <div style={{
        fontSize: 11, fontFamily: "'Nunito', sans-serif", textTransform: "uppercase",
        letterSpacing: "0.15em", color: "#999", marginBottom: 16, fontWeight: 600
      }}>Daily Reflection</div>

      <div style={{
        display: "grid", gridTemplateColumns: "90px 1fr 70px",
        gap: 0, fontFamily: "'Nunito', sans-serif",
        borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 4
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Date</span>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Notes</span>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", textAlign: "right" }}>Hours</span>
      </div>

      {allDates.map(date => {
        const hrs = getHours(date);
        const mins = getMins(date);
        const isGreen = mins >= 120;
        const r = reflections[date] || {};
        const isEditing = editingKey === date;
        const isToday = date === today;

        const dayLabel = new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
        const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

        const rowBg = isGreen ? "rgba(42,157,143,0.08)" : "rgba(230,57,70,0.06)";
        const rowBorder = isGreen ? "rgba(42,157,143,0.2)" : "rgba(230,57,70,0.15)";
        const hrsColor = isGreen ? "#2A9D8F" : "#E63946";

        return (
          <div key={date} onClick={() => { if (!isEditing) startEdit(date); }}
            style={{
              display: "grid", gridTemplateColumns: "90px 1fr 70px", gap: 0,
              padding: "10px 0", borderBottom: `1px solid ${rowBorder}`,
              fontFamily: "'Nunito', sans-serif", fontSize: 13,
              background: rowBg, cursor: isEditing ? "default" : "pointer",
              transition: "background 0.2s ease",
              marginLeft: -8, marginRight: -8, paddingLeft: 8, paddingRight: 8,
              borderRadius: 2
            }}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 12 }}>{dayLabel}</span>
              <span style={{ fontSize: 10, color: "#999" }}>{dateLabel}</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", paddingRight: 8 }}>
              {isEditing ? (
                <div style={{ display: "flex", gap: 6, width: "100%", alignItems: "center" }}>
                  <input value={editText} onChange={e => setEditText(e.target.value)}
                    autoFocus placeholder="How was your study?"
                    onKeyDown={e => { if (e.key === "Enter") saveRow(date); if (e.key === "Escape") setEditingKey(null); }}
                    style={{
                      flex: 1, border: "none", borderBottom: "2px solid #000", background: "transparent",
                      fontSize: 13, fontFamily: "inherit", padding: "4px 0", outline: "none"
                    }} />
                  <button onClick={(e) => { e.stopPropagation(); saveRow(date); }} style={{
                    border: "2px solid #000", background: "#000", color: "#fff",
                    padding: "4px 10px", fontSize: 10, fontFamily: "inherit",
                    fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap"
                  }}>Save</button>
                </div>
              ) : (
                <span style={{ color: r.note ? "#000" : "#ccc", fontSize: 13 }}>
                  {r.note || (isToday ? "Click to add today's reflection..." : "—")}
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              {isEditing ? (
                <input value={editHrs} onChange={e => setEditHrs(e.target.value)}
                  placeholder={hrs.toFixed(1)} type="number" step="0.1"
                  onKeyDown={e => { if (e.key === "Enter") saveRow(date); }}
                  style={{
                    width: 50, border: "none", borderBottom: "2px solid #000",
                    background: "transparent", fontSize: 13, fontFamily: "inherit",
                    textAlign: "right", padding: "4px 0", outline: "none"
                  }} />
              ) : (
                <span style={{ fontWeight: 700, color: hrsColor, fontSize: 13 }}>
                  {hrs.toFixed(1)}h
                </span>
              )}
            </div>
          </div>
        );
      })}

      {allDates.length === 0 && (
        <div style={{ textAlign: "center", color: "#ccc", fontFamily: "'Nunito', sans-serif", fontSize: 13, padding: "40px 0" }}>
          No data yet. Start logging sessions!
        </div>
      )}

      <div style={{
        display: "flex", gap: 20, marginTop: 20, fontFamily: "'Nunito', sans-serif", fontSize: 10, color: "#999"
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, background: "rgba(42,157,143,0.15)", border: "1px solid rgba(42,157,143,0.3)", display: "inline-block", borderRadius: 2 }} /> 2h+ (on track)
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, background: "rgba(230,57,70,0.1)", border: "1px solid rgba(230,57,70,0.2)", display: "inline-block", borderRadius: 2 }} /> &lt;2h (needs work)
        </span>
        <span>Click row to edit</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// ─── Main App with Auth Gate ───
// ═══════════════════════════════════════════
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState(PAGES.TIMER);
  const [sessions, setSessions] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Listen for auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load sessions from Supabase when user logs in
  useEffect(() => {
    if (!user) { setSessions([]); setLoaded(false); return; }
    setLoaded(false);
    loadSessions().then(data => { setSessions(data); setLoaded(true); });
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSessions([]);
    setLoaded(false);
  };

  const streak = calcStreak(sessions);

  if (authLoading) return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", height: "100vh",
      fontFamily: "'Nunito', sans-serif", fontSize: 14, color: "#999"
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      Loading...
    </div>
  );

  if (!user) return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <AuthPage onAuth={setUser} />
    </>
  );

  if (!loaded) return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", height: "100vh",
      fontFamily: "'Nunito', sans-serif", fontSize: 14, color: "#999"
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      Loading your data...
    </div>
  );

  return (
    <div style={{
      maxWidth: 540, margin: "0 auto", padding: "40px 20px 60px",
      minHeight: "100vh", background: "#fff", color: "#000"
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <TopBar sessions={sessions} streak={streak} />
      <Nav page={page} setPage={setPage} onLogout={handleLogout} />
      {page === PAGES.TIMER && <TimerPage sessions={sessions} setSessions={setSessions} onNewSession={() => {}} />}
      {page === PAGES.ANALYSIS && <AnalysisPage sessions={sessions} />}
      {page === PAGES.CALENDAR && <CalendarPage sessions={sessions} />}
      {page === PAGES.REFLECTION && <ReflectionPage sessions={sessions} />}
    </div>
  );
}