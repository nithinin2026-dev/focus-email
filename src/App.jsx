import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import * as Tone from "tone";
import { supabase } from "./supabaseClient";

const PAGES = { TIMER: "timer", TASKS: "tasks", ANALYSIS: "analysis", CALENDAR: "calendar", REFLECTION: "reflection", SLEEP: "sleep" };


// ═══════════════════════════════════════════
// ─── THEME SYSTEM ───
// ═══════════════════════════════════════════
const ThemeContext = createContext();
const THEMES = {
  light: { bg:"#fff",bgSecondary:"#f6f6f6",bgTertiary:"#f8f8f8",bgHover:"#f0f0f0",text:"#000",textSecondary:"#666",textMuted:"#999",textFaint:"#ccc",border:"#eee",borderMedium:"#ddd",borderStrong:"#000",inputBg:"transparent",navBg:"#fff",navShadow:"0 2px 12px rgba(0,0,0,0.06)",sidebarBg:"#fff",sidebarShadow:"4px 0 24px rgba(0,0,0,0.12)",overlay:"rgba(0,0,0,0.35)",rowGreen:"rgba(42,157,143,0.08)",rowRed:"rgba(230,57,70,0.06)",rowGreenBorder:"rgba(42,157,143,0.2)",rowRedBorder:"rgba(230,57,70,0.15)",calCellBorder:"#333",calEmptyBg:"#fafafa",calHeaderBg:"#f0f0f0",calFutureBg:"#fff",calFutureColor:"#ccc",btnActive:"#000",btnActiveText:"#fff",footerBg:"#E8F4FD",footerColor:"#4A5568",selectBg:"#fff",missedBg:"#fff0f0" },
  dark: { bg:"#000",bgSecondary:"#111",bgTertiary:"#1a1a1a",bgHover:"#222",text:"#fff",textSecondary:"#aaa",textMuted:"#777",textFaint:"#444",border:"#222",borderMedium:"#333",borderStrong:"#fff",inputBg:"transparent",navBg:"#000",navShadow:"0 2px 12px rgba(0,0,0,0.4)",sidebarBg:"#111",sidebarShadow:"4px 0 24px rgba(0,0,0,0.5)",overlay:"rgba(0,0,0,0.6)",rowGreen:"rgba(42,157,143,0.12)",rowRed:"rgba(230,57,70,0.1)",rowGreenBorder:"rgba(42,157,143,0.3)",rowRedBorder:"rgba(230,57,70,0.25)",calCellBorder:"#444",calEmptyBg:"#0a0a0a",calHeaderBg:"#1a1a1a",calFutureBg:"#111",calFutureColor:"#444",btnActive:"#fff",btnActiveText:"#000",footerBg:"#111",footerColor:"#888",selectBg:"#111",missedBg:"#2a1215" }
};
function useTheme() { return useContext(ThemeContext); }

// ─── Theme Toggle ───
function ThemeToggle({ isDark, onToggle }) {
  return (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 4px",fontFamily:"'Nunito', sans-serif" }}>
      <span style={{ fontSize:12,fontWeight:600,color:isDark?"#aaa":"#666" }}>{isDark?"🌙 Dark":"☀️ Light"}</span>
      <button onClick={onToggle} style={{ width:44,height:24,borderRadius:12,border:"none",background:isDark?"#fff":"#000",position:"relative",cursor:"pointer",transition:"background 0.3s ease" }}>
        <div style={{ width:18,height:18,borderRadius:"50%",background:isDark?"#000":"#fff",position:"absolute",top:3,left:isDark?22:4,transition:"left 0.3s ease",boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }} />
      </button>
    </div>
    </ThemeContext.Provider>
  );
}

// ─── Responsive hook ───
function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return width;
}

// ─── Quotes ───
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

// ─── Supabase Storage helpers ───
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
async function deleteSession(sessionId) {
  const { error } = await supabase.from("sessions").delete().eq("id", sessionId);
  if (error) console.error("Delete session error:", error);
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
  const r = Math.round(42 - t * 30);
  const g = Math.round(157 + t * 40);
  const b = Math.round(143 - t * 80);
  return `rgb(${r},${g},${b})`;
}
function getBarGradient(mins) {
  if (mins < 120) return "linear-gradient(180deg, #E63946, #FF6B6B)";
  const c = getGreenForMins(mins);
  return `linear-gradient(180deg, ${c}, ${c}88)`;
}

// ═══════════════════════════════════════════
// ─── TOP NAVBAR ───
// ═══════════════════════════════════════════
function TopNavBar({ sessions, streak, todayMins, onMenuClick }) {
  const T = useTheme();
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);
  const font = "'Nunito', sans-serif";
  const w = useWindowWidth();
  const isMobile = w < 480;

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY > lastScrollY.current && currentY > 60) setVisible(false);
      else setVisible(true);
      lastScrollY.current = currentY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const [quoteIdx, setQuoteIdx] = useState(() => Math.floor(Math.random() * QUOTES.length));
  useEffect(() => {
    const t = setInterval(() => setQuoteIdx(p => (p + 1) % QUOTES.length), 180000);
    return () => clearInterval(t);
  }, []);

  const dayTotals = getDayTotals(sessions);
  const maxMins = Object.values(dayTotals).length > 0 ? Math.max(...Object.values(dayTotals)) : 0;
  const hitTarget = todayMins >= 120;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
      background: T.bg, borderBottom: `1px solid ${T.border}`,
      transform: visible ? "translateY(0)" : "translateY(-100%)",
      transition: "transform 0.35s ease",
      padding: isMobile ? "8px 10px" : "10px 16px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      fontFamily: font,
      boxShadow: visible ? T.navShadow : "none"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 10 }}>
        <button onClick={onMenuClick} style={{ border: "none", background: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <span style={{ fontSize: isMobile ? 11 : 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
          <span>⚡</span><span>{formatHM(maxMins)}</span>
          <span style={{ fontWeight: 400, fontSize: isMobile ? 8 : 10, color: "#999" }}>max</span>
        </span>
      </div>

      {!isMobile && (
        <div style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: 700, color: "#333", fontStyle: "italic", padding: "0 12px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
          "{QUOTES[quoteIdx]}"
        </div>
      )}

      <div style={{
        display: "flex", alignItems: "center", gap: 5,
        background: hitTarget ? (streak > 0 ? "#000" : "#e0e0e0") : "#E63946",
        color: hitTarget ? (streak > 0 ? "#fff" : "#999") : "#fff",
        padding: isMobile ? "5px 10px" : "6px 14px", borderRadius: 30,
        fontSize: isMobile ? 12 : 13, fontWeight: 700
      }}>
        <span style={{ fontSize: isMobile ? 14 : 16 }}>{hitTarget ? (streak > 0 ? "🔥" : "○") : "⚠️"}</span>
        <span>{streak}</span>
        <span style={{ fontWeight: 400, fontSize: isMobile ? 8 : 10, opacity: 0.8 }}>
          {hitTarget ? (streak === 1 ? "day" : "days") : "do 2h+"}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// ─── WEEK STRIP ───
// ═══════════════════════════════════════════
function WeekStrip({ sessions }) {
  const T = useTheme();
  const font = "'Nunito', sans-serif";
  const w = useWindowWidth();
  const isMobile = w < 480;
  const dayTotals = getDayTotals(sessions);
  const now = new Date();
  const todayKey = todayStr();
  const dayOfWeek = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  const weekDays = [];
  for (let i = 0; i < 7; i++) { const dd = new Date(mon); dd.setDate(mon.getDate() + i); weekDays.push(dd.toISOString().slice(0, 10)); }
  const dayLabels = ["M", "T", "W", "TH", "F", "SA", "SU"];
  const weekTotal = weekDays.reduce((a, d) => a + (dayTotals[d] || 0), 0);

  const todayMins = sessions.filter(s => s.date === todayKey).reduce((a, s) => a + s.duration, 0);
  const todayColor = todayMins >= 240 ? "#2A9D8F" : todayMins >= 120 ? "#F4A261" : "#E63946";

  const hr = now.getHours();
  const minsLeft = (24 - hr - 1) * 60 + (60 - now.getMinutes());
  const hrsLeft = Math.floor(minsLeft / 60); const mLeft = minsLeft % 60;
  let midColor;
  if (hr < 12) midColor = "#2A9D8F"; else if (hr < 15) midColor = "#F4A261"; else if (hr < 18) midColor = "#E76F51"; else if (hr < 21) midColor = "#E63946"; else midColor = "#C1121F";

  const [targetDate, setTargetDate] = useState(() => localStorage.getItem("sl_targetDate") || "");
  const [editingTarget, setEditingTarget] = useState(false);
  const [tempTarget, setTempTarget] = useState("");
  const saveTarget = () => { localStorage.setItem("sl_targetDate", tempTarget); setTargetDate(tempTarget); setEditingTarget(false); };
  let targetText = "";
  if (targetDate) {
    const diff = Math.ceil((new Date(targetDate + "T00:00:00") - new Date(todayStr() + "T00:00:00")) / 86400000);
    if (diff > 0) targetText = `${diff}d left`;
    else if (diff === 0) targetText = "Today!";
    else targetText = `${Math.abs(diff)}d ago`;
  }

  const size = isMobile ? 36 : 32;

  return (
    <div style={{ background: T.bgSecondary, borderRadius: 10, padding: isMobile ? "10px 10px" : "12px 14px", marginBottom: 20, fontFamily: font }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: isMobile ? 4 : 3, flex: 1 }}>
          {weekDays.map((dateKey, i) => {
            const mins = dayTotals[dateKey] || 0;
            const isFire = mins >= 120;
            const isToday = dateKey === todayKey;
            const hasData = mins > 0;
            const isMissed = isPastDate(dateKey) && !isFire && dateKey >= weekDays[0];
            return (
              <div key={dateKey} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flex: 1 }}>
                <span style={{ fontSize: isMobile ? 9 : 8, fontWeight: 600, letterSpacing: "0.05em", color: isToday ? "#000" : "#bbb", textTransform: "uppercase" }}>{dayLabels[i]}</span>
                <div style={{
                  width: size, height: size, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: isFire ? "#000" : isMissed ? "#fff0f0" : isToday ? "#e8e8e8" : "transparent",
                  border: isFire ? "none" : isMissed ? "2px solid #E63946" : hasData ? "2px solid #ddd" : isToday ? "2px solid #ccc" : "2px solid #eee",
                  color: isFire ? "#fff" : isMissed ? "#E63946" : "#999",
                  fontSize: isFire ? (isMobile ? 16 : 14) : isMissed ? (isMobile ? 14 : 12) : (isMobile ? 10 : 9), fontWeight: 700,
                  transition: "all 0.2s ease",
                  boxShadow: isFire ? "0 1px 6px rgba(0,0,0,0.15)" : "none"
                }}>
                  {isFire ? "🔥" : isMissed ? "❌" : hasData ? formatHM(mins) : "·"}
                </div>
              </div>
            );
          })}
        </div>
        <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: 700, marginLeft: 6, whiteSpace: "nowrap" }}>{formatHM(weekTotal)}</span>
      </div>

      <div style={{ borderTop: "1px solid #ddd", marginTop: 2, paddingTop: 10 }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: isMobile ? 11 : 12, fontWeight: 700, flexWrap: "wrap", gap: 6 }}>
        <span style={{ color: todayColor }}>📖 {formatHM(todayMins)} today</span>
        <span style={{ color: midColor }}>⏳ {hrsLeft}h {mLeft}m left</span>
        {editingTarget ? (
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input type="date" value={tempTarget} onChange={e => setTempTarget(e.target.value)} style={{ border: "1px solid #ccc", padding: "3px 5px", fontSize: 10, fontFamily: font, outline: "none" }} />
            <button onClick={saveTarget} style={{ border: "none", background: T.btnActive, color: T.btnActiveText, padding: "3px 7px", fontSize: 9, fontFamily: font, fontWeight: 700, cursor: "pointer", borderRadius: 4 }}>Set</button>
          </span>
        ) : (
          <span onDoubleClick={() => { setTempTarget(targetDate || todayStr()); setEditingTarget(true); }} style={{ color: "#6A4C93", cursor: "pointer" }} title="Double-click to set target date">
            {targetDate ? `🎯 ${targetText}` : "🎯 Set goal"}
          </span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// ─── SIDEBAR ───
// ═══════════════════════════════════════════
function Sidebar({ open, onClose, page, setPage, sessions, onLogout, isDark, onToggleTheme }) {
  const font = "'Nunito', sans-serif";
  const items = [
    { key: PAGES.TIMER, label: "Timer", icon: "⏱" },
    { key: PAGES.TASKS, label: "Tasks", icon: "✅" },
    { key: PAGES.ANALYSIS, label: "Analysis", icon: "📊" },
    { key: PAGES.CALENDAR, label: "Calendar", icon: "📅" },
    { key: PAGES.REFLECTION, label: "Reflect", icon: "💭" },
    { key: PAGES.SLEEP, label: "Sleep", icon: "🌙" },
  ];

  const now = new Date();
  const yearStr = String(now.getFullYear());
  const monthName = now.toLocaleDateString("en-US", { month: "short" });
  const yearMins = sessions.filter(s => s.date.startsWith(yearStr)).reduce((a, s) => a + s.duration, 0);
  const monthPrefix = `${yearStr}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthMins = sessions.filter(s => s.date.startsWith(monthPrefix)).reduce((a, s) => a + s.duration, 0);

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: T.overlay, zIndex: 2000,
        opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none",
        transition: "opacity 0.3s ease"
      }} />
      <div style={{
        position: "fixed", top: 0, left: 0, bottom: 0, width: 260, zIndex: 2001,
        background: T.sidebarBg, boxShadow: T.sidebarShadow,
        transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.3s ease",
        display: "flex", flexDirection: "column", fontFamily: font
      }}>
        <div style={{ padding: "24px 20px 16px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: T.text }}>Focus Maxing</span>
            <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 20, color: "#999", padding: 0 }}>✕</button>
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
            <div><div style={{ fontSize: 16, fontWeight: 700 }}>{formatHM(monthMins)}</div><div style={{ color: T.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>{monthName}</div></div>
            <div><div style={{ fontSize: 16, fontWeight: 700 }}>{formatHM(yearMins)}</div><div style={{ color: "#999", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>{yearStr}</div></div>
          </div>
        </div>
        <div style={{ flex: 1, padding: "12px 0", overflowY: "auto" }}>
          {items.map(i => {
            const active = page === i.key;
            return (
              <button key={i.key} onClick={() => { setPage(i.key); onClose(); }} style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%",
                padding: "14px 24px", border: "none", cursor: "pointer",
                background: active ? T.bgHover : "transparent",
                color: T.text, fontSize: 14, fontWeight: active ? 700 : 500,
                fontFamily: font, textAlign: "left", transition: "background 0.15s ease",
                borderLeft: active ? `3px solid ${T.text}` : "3px solid transparent"
              }}>
                <span style={{ fontSize: 18 }}>{i.icon}</span>
                <span>{i.label}</span>
              </button>
            );
          })}
        </div>
        <div style={{ padding: "16px 20px", borderTop: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: 12 }}>
          <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
          <button onClick={onLogout} style={{
            width: "100%", padding: "10px 0", border: `1px solid ${T.borderMedium}`,
            background: "transparent", cursor: "pointer", fontSize: 11,
            fontFamily: font, fontWeight: 700, color: T.textMuted,
            letterSpacing: "0.06em", textTransform: "uppercase", borderRadius: 6
          }}>Logout</button>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════
// ─── AUTH ───
// ═══════════════════════════════════════════
function AuthPage({ onAuth }) {
  const T = useTheme();
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
      if (isLogin) { const { error: err } = await supabase.auth.signInWithPassword({ email, password }); if (err) throw err; }
      else { const { error: err } = await supabase.auth.signUp({ email, password }); if (err) throw err; setConfirmSent(true); setLoading(false); return; }
    } catch (err) { setError(err.message || "Something went wrong"); }
    setLoading(false);
  };
  const handleForgotPassword = async () => {
    setError("");
    if (!email.trim()) { setError("Enter your email first, then click Forgot Password"); return; }
    setLoading(true);
    try { const { error: err } = await supabase.auth.resetPasswordForEmail(email); if (err) throw err; setResetSent(true); }
    catch (err) { setError(err.message || "Something went wrong"); }
    setLoading(false);
  };
  if (resetSent) return (
    <div style={{ maxWidth: 400, margin: "0 auto", padding: "120px 24px", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: font }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔑</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>Reset link sent</div>
      <div style={{ fontSize: 13, color: "#666", textAlign: "center", lineHeight: 1.6, marginBottom: 24 }}>We sent a password reset link to <strong>{email}</strong>.</div>
      <button onClick={() => { setResetSent(false); setIsLogin(true); }} style={{ border: `2px solid ${T.borderStrong}`, background: T.btnActive, color: T.btnActiveText, padding: "12px 32px", fontSize: 13, fontFamily: font, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer" }}>Back to Login</button>
    </div>
  );
  if (confirmSent) return (
    <div style={{ maxWidth: 400, margin: "0 auto", padding: "120px 24px", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: font }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>Check your email</div>
      <div style={{ fontSize: 13, color: "#666", textAlign: "center", lineHeight: 1.6, marginBottom: 24 }}>We sent a confirmation link to <strong>{email}</strong>.</div>
      <button onClick={() => { setConfirmSent(false); setIsLogin(true); }} style={{ border: `2px solid ${T.borderStrong}`, background: T.btnActive, color: T.btnActiveText, padding: "12px 32px", fontSize: 13, fontFamily: font, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer" }}>Back to Login</button>
    </div>
  );
  return (
    <div style={{ maxWidth: 400, margin: "0 auto", padding: "80px 24px", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: font }}>
      <div style={{ marginBottom: 40, textAlign: "center" }}>
        <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4, color: T.text }}>Focus Maxing</div>
        <div style={{ fontSize: 12, color: "#999", textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600 }}>Track your upskilling</div>
      </div>
      <div style={{ width: "100%", maxWidth: 320 }}>
        <div style={{ display: "flex", marginBottom: 32, borderBottom: `2px solid ${T.borderStrong}` }}>
          {["Login", "Sign Up"].map((label, i) => {
            const active = i === 0 ? isLogin : !isLogin;
            return (<button key={label} onClick={() => { setIsLogin(i === 0); setError(""); }} style={{ flex: 1, padding: "12px 0", border: "none", cursor: "pointer", background: active ? "#000" : "transparent", color: active ? "#fff" : "#000", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: font, transition: "all 0.2s ease" }}>{label}</button>);
          })}
        </div>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" onKeyDown={e => e.key === "Enter" && handleSubmit()} style={{ width: "100%", border: `2px solid ${T.borderStrong}`, padding: "14px 16px", fontSize: 14, fontFamily: font, marginBottom: 12, background: "transparent", outline: "none", fontWeight: 600, boxSizing: "border-box" }} />
        <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password" onKeyDown={e => e.key === "Enter" && handleSubmit()} style={{ width: "100%", border: `2px solid ${T.borderStrong}`, padding: "14px 16px", fontSize: 14, fontFamily: font, marginBottom: 8, background: "transparent", outline: "none", fontWeight: 600, boxSizing: "border-box" }} />
        {isLogin && (<div style={{ textAlign: "right", marginBottom: 4 }}><button onClick={handleForgotPassword} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 11, fontFamily: font, fontWeight: 600, color: "#999", textDecoration: "underline", textUnderlineOffset: 3, padding: 0 }}>Forgot Password?</button></div>)}
        {error && (<div style={{ fontSize: 12, color: "#E63946", fontFamily: font, fontWeight: 600, padding: "8px 0", textAlign: "center" }}>{error}</div>)}
        <button onClick={handleSubmit} disabled={loading} style={{ width: "100%", padding: "14px 0", border: `2px solid ${T.borderStrong}`, background: T.btnActive, color: T.btnActiveText, fontSize: 13, fontFamily: font, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: loading ? "default" : "pointer", marginTop: 16, opacity: loading ? 0.5 : 1 }}>{loading ? "..." : isLogin ? "Login" : "Create Account"}</button>
      </div>
      <div style={{ marginTop: 60, fontSize: 12, color: "#ccc", fontFamily: font, textAlign: "center" }}>Vibe coded by Nithin Chowdary ❤️</div>
    </div>
  );
}

// ─── Timer Page ───
function TimerPage({ sessions, setSessions }) {
  const T = useTheme();
  const w = useWindowWidth();
  const isMobile = w < 480;
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
      if ("Notification" in window && Notification.permission === "granted") {
        try { new Notification("Focus Maxing", { body: mode === "focus" ? `${tag || "Focus"} session complete! Time for a break.` : "Break over! Ready to focus again?", icon: "🔥" }); } catch(e) {}
      }
      if (mode === "focus") { const mins = Math.round(focusDur / 60); addSession({ id: Date.now(), tag: tag || "Untitled", duration: mins, date: todayStr(), ts: Date.now() }); setMode("break"); setElapsed(0); }
      else { setMode("focus"); setElapsed(0); }
    }
  }, [remaining, running]);

  const toggle = () => {
    if (!running) {
      initBell(); playStartPop();
      if ("Notification" in window && Notification.permission === "default") { Notification.requestPermission(); }
    } else { playStopPop(); }
    setRunning(!running);
  };
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
  const circleSize = isMobile ? 200 : 220;
  const circleR = isMobile ? 80 : 90;
  const circleC = 2 * Math.PI * circleR;

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 30 }}>
        <input value={tag} onChange={e => setTag(e.target.value)} placeholder="What are you studying?" style={{ border: "none", borderBottom: `2px solid ${T.borderStrong}`, background: "transparent", fontSize: isMobile ? 16 : 18, fontFamily: "'Nunito', sans-serif", textAlign: "center", padding: "8px 16px", width: "80%", maxWidth: 340, outline: "none", fontWeight: 600 }} />
      </div>
      {editing ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 24, fontFamily: "'Nunito', sans-serif", flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, color: "#666" }}>Focus</label>
          <input value={tempFocus} onChange={e => setTempFocus(e.target.value)} type="number" style={{ width: 56, border: `2px solid ${T.borderStrong}`, padding: "6px 8px", fontSize: 14, fontFamily: "inherit", textAlign: "center", background: "transparent", outline: "none" }} />
          <label style={{ fontSize: 12, color: "#666" }}>Break</label>
          <input value={tempBreak} onChange={e => setTempBreak(e.target.value)} type="number" style={{ width: 56, border: `2px solid ${T.borderStrong}`, padding: "6px 8px", fontSize: 14, fontFamily: "inherit", textAlign: "center", background: "transparent", outline: "none" }} />
          <span style={{ fontSize: 11, color: "#999" }}>min</span>
          <button onClick={saveEdit} style={{ border: `2px solid ${T.borderStrong}`, background: T.btnActive, color: T.btnActiveText, padding: "6px 14px", fontSize: 12, fontFamily: "inherit", fontWeight: 700, cursor: "pointer" }}>Set</button>
          <button onClick={() => setEditing(false)} style={{ border: `2px solid ${T.borderMedium}`, background: "transparent", color: "#999", padding: "6px 10px", fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}>✕</button>
        </div>
      ) : (
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <button onClick={openEdit} style={{ border: "none", background: "none", cursor: "pointer", fontFamily: "'Nunito', sans-serif", fontSize: 12, color: "#999", textDecoration: "underline", textUnderlineOffset: 3 }}>⚙ {focusMins}m focus / {breakMins}m break</button>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
        <div style={{ position: "relative", width: circleSize, height: circleSize }}>
          <svg width={circleSize} height={circleSize} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={circleSize/2} cy={circleSize/2} r={circleR} fill="none" stroke="#eee" strokeWidth={6} />
            <circle cx={circleSize/2} cy={circleSize/2} r={circleR} fill="none" stroke={mode === "focus" ? "#000" : "#888"} strokeWidth={6} strokeLinecap="round" strokeDasharray={circleC} strokeDashoffset={circleC * (1 - progress)} style={{ transition: "stroke-dashoffset 0.3s ease" }} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 11, fontFamily: "'Nunito', sans-serif", textTransform: "uppercase", letterSpacing: "0.15em", color: "#999", marginBottom: 4, fontWeight: 600 }}>{mode === "focus" ? "Focus" : "Break"}</div>
            <div style={{ fontSize: isMobile ? 36 : 42, fontFamily: "'Nunito', sans-serif", fontWeight: 700, letterSpacing: "-0.02em" }}>{formatTime(remaining)}</div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: isMobile ? 8 : 12, marginBottom: 40, flexWrap: "wrap" }}>
        <button onClick={toggle} style={{ padding: isMobile ? "10px 28px" : "12px 36px", border: `2px solid ${T.borderStrong}`, cursor: "pointer", background: running ? "transparent" : "#000", color: running ? "#000" : "#fff", fontSize: 13, fontFamily: "'Nunito', sans-serif", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", borderRadius: 0, transition: "all 0.2s" }}>{running ? "Pause" : "Start"}</button>
        <button onClick={reset} style={{ padding: isMobile ? "10px 16px" : "12px 20px", border: `2px solid ${T.borderMedium}`, cursor: "pointer", background: "transparent", color: "#999", fontSize: 13, fontFamily: "'Nunito', sans-serif", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Reset</button>
        <button onClick={skip} style={{ padding: isMobile ? "10px 16px" : "12px 20px", border: `2px solid ${T.borderMedium}`, cursor: "pointer", background: "transparent", color: "#999", fontSize: 13, fontFamily: "'Nunito', sans-serif", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Skip</button>
      </div>
      <div style={{ borderTop: `1px solid ${T.border}`, margin: "0 0 30px" }} />
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 11, fontFamily: "'Nunito', sans-serif", textTransform: "uppercase", letterSpacing: "0.15em", color: "#999", marginBottom: 12, fontWeight: 600 }}>Quick Log</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input value={manualTag} onChange={e => setManualTag(e.target.value)} placeholder="Tag" style={{ border: `2px solid ${T.borderStrong}`, padding: "10px 14px", fontSize: 14, fontFamily: "'Nunito', sans-serif", flex: 1, minWidth: 100, background: "transparent", outline: "none", boxSizing: "border-box" }} />
          <input value={manualMins} onChange={e => setManualMins(e.target.value)} placeholder="mins" type="number" style={{ border: `2px solid ${T.borderStrong}`, padding: "10px 14px", fontSize: 14, fontFamily: "'Nunito', sans-serif", width: 80, background: "transparent", outline: "none", boxSizing: "border-box" }} />
          <button onClick={logManual} style={{ padding: "10px 20px", border: `2px solid ${T.borderStrong}`, background: T.btnActive, color: T.btnActiveText, fontSize: 13, fontFamily: "'Nunito', sans-serif", fontWeight: 700, cursor: "pointer" }}>+</button>
        </div>
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontFamily: "'Nunito', sans-serif", textTransform: "uppercase", letterSpacing: "0.15em", color: "#999", fontWeight: 600 }}>Today's Sessions</span>
          <span style={{ fontSize: 14, fontFamily: "'Nunito', sans-serif", fontWeight: 700 }}>{formatHM(todayTotal)} {todayTotal >= 120 && "🔥"}</span>
        </div>
        {todaySessions.length === 0 && (<div style={{ color: "#ccc", fontFamily: "'Nunito', sans-serif", fontSize: 13, padding: "20px 0", textAlign: "center" }}>No sessions yet. Start studying!</div>)}
        {todaySessions.map(s => (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.border}`, fontFamily: "'Nunito', sans-serif", fontSize: 14 }}>
            <span style={{ fontWeight: 600 }}>{s.tag}</span>
            <span style={{ color: "#999" }}>{formatHM(s.duration)}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 48, padding: "14px 20px", borderRadius: 12, background: T.footerBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.footerColor, letterSpacing: "0.01em" }}>
          Vibe coded by Nithin Chowdary <span style={{ color: "#E53E3E", fontSize: 15 }}>❤️</span>
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// ─── Tasks Page ───
// ═══════════════════════════════════════════
function TasksPage({ tasks, setTasks }) {
  const T = useTheme();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [newTask, setNewTask] = useState("");
  const w = useWindowWidth();
  const isMobile = w < 480;
  const font = "'Nunito', sans-serif";
  const isToday = selectedDate === todayStr();
  const shiftDate = (dir) => { const d = new Date(selectedDate + "T12:00:00"); d.setDate(d.getDate() + dir); setSelectedDate(d.toISOString().slice(0, 10)); };
  const dateLabel = isToday ? "Today" : new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const dayTasks = tasks.filter(t => t.date === selectedDate && !t.time_slot);
  const dayPlannerTasks = tasks.filter(t => t.date === selectedDate && t.time_slot);
  const addTask = async () => { if (!newTask.trim()) return; const saved = await insertTask(newTask.trim(), selectedDate, null); if (saved) setTasks(prev => [...prev, saved]); setNewTask(""); };
  const toggleComplete = async (task) => { const newVal = task.completed_date ? null : todayStr(); await updateTaskCompleted(task.id, newVal); setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed_date: newVal } : t)); };
  const removeTask = async (taskId) => { await deleteTask(taskId); setTasks(prev => prev.filter(t => t.id !== taskId)); };
  const slots = [];
  for (let h = 4; h <= 23; h++) { const fmt = (hr) => { if (hr === 0) return "12 AM"; if (hr < 12) return `${hr} AM`; if (hr === 12) return "12 PM"; return `${hr - 12} PM`; }; slots.push({ label: `${fmt(h)} – ${fmt(h + 1 > 23 ? 0 : h + 1)}`, key: `${h}-${h + 1}` }); }
  const addPlannerTask = async (slotKey, title) => { if (!title.trim()) return; const existing = dayPlannerTasks.find(t => t.time_slot === slotKey); if (existing) return; const saved = await insertTask(title.trim(), selectedDate, slotKey); if (saved) setTasks(prev => [...prev, saved]); };
  const navBtn = { border: "none", background: "none", fontSize: 20, cursor: "pointer" };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, marginBottom: 24, fontFamily: font }}>
        <button onClick={() => shiftDate(-1)} style={navBtn}>←</button>
        <span style={{ fontSize: 16, fontWeight: 700, minWidth: 140, textAlign: "center" }}>{dateLabel}</span>
        <button onClick={() => shiftDate(1)} style={navBtn}>→</button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="Add a task..." onKeyDown={e => e.key === "Enter" && addTask()} style={{ flex: 1, border: `2px solid ${T.borderStrong}`, padding: "12px 16px", fontSize: 15, fontFamily: font, background: "transparent", outline: "none", fontWeight: 600, boxSizing: "border-box" }} />
        <button onClick={addTask} style={{ padding: "12px 22px", border: `2px solid ${T.borderStrong}`, background: T.btnActive, color: T.btnActiveText, fontSize: 14, fontFamily: font, fontWeight: 700, cursor: "pointer" }}>+</button>
      </div>
      <div style={{ fontSize: 11, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.15em", color: "#999", marginBottom: 10, fontWeight: 600 }}>Tasks ({dayTasks.filter(t => t.completed_date).length}/{dayTasks.length})</div>
      {dayTasks.length === 0 && (<div style={{ color: "#ccc", fontFamily: font, fontSize: 14, padding: "20px 0", textAlign: "center" }}>No tasks for this day</div>)}
      {dayTasks.map(t => { const done = !!t.completed_date; return (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${T.border}`, fontFamily: font, fontSize: 15 }}>
          <button onClick={() => toggleComplete(t)} style={{ width: 26, height: 26, border: done ? "none" : "2px solid #ccc", background: done ? "#2A9D8F" : "transparent", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: T.btnActiveText, fontSize: 15, flexShrink: 0 }}>{done && "✓"}</button>
          <span style={{ flex: 1, fontWeight: 600, textDecoration: done ? "line-through" : "none", color: done ? "#999" : "#000" }}>{t.title}</span>
          <button onClick={() => removeTask(t.id)} style={{ border: "none", background: "none", cursor: "pointer", color: "#ccc", fontSize: 18, padding: "0 4px" }}>✕</button>
        </div>
      ); })}
      <div style={{ marginTop: 36 }}>
        <div style={{ fontSize: 11, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.15em", color: "#999", marginBottom: 12, fontWeight: 600 }}>Day Planner</div>
        <div style={{ border: `2px solid ${T.border}`, borderRadius: 6, overflow: "hidden" }}>
          {slots.map(slot => { const slotTask = dayPlannerTasks.find(t => t.time_slot === slot.key); const done = slotTask && !!slotTask.completed_date; return (
            <div key={slot.key} style={{ display: "flex", borderBottom: `1px solid ${T.border}`, fontFamily: font, minHeight: 42 }}>
              <div style={{ width: isMobile ? 90 : 120, padding: isMobile ? "10px 8px" : "10px 12px", background: "#f8f8f8", fontWeight: 600, color: "#555", flexShrink: 0, display: "flex", alignItems: "center", fontSize: isMobile ? 11 : 13 }}>{slot.label}</div>
              <div style={{ flex: 1, padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                {slotTask ? (<>
                  <button onClick={() => toggleComplete(slotTask)} style={{ width: 22, height: 22, border: done ? "none" : "2px solid #ccc", background: done ? "#2A9D8F" : "transparent", borderRadius: 5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: T.btnActiveText, fontSize: 13, flexShrink: 0 }}>{done && "✓"}</button>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, textDecoration: done ? "line-through" : "none", color: done ? "#999" : "#000", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{slotTask.title}</span>
                  <button onClick={() => removeTask(slotTask.id)} style={{ border: "none", background: "none", cursor: "pointer", color: "#ccc", fontSize: 16, flexShrink: 0 }}>✕</button>
                </>) : (<PlannerSlotInput slotKey={slot.key} onAdd={(title) => addPlannerTask(slot.key, title)} />)}
              </div>
            </div>
          ); })}
        </div>
      </div>
    </div>
  );
}
function PlannerSlotInput({ slotKey, onAdd }) {
  const T = useTheme();
  const [val, setVal] = useState("");
  const submit = () => { if (val.trim()) { onAdd(val.trim()); setVal(""); } };
  return (<input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="+ add task" style={{ border: "none", background: "transparent", fontSize: 13, fontFamily: "'Nunito', sans-serif", fontWeight: 600, outline: "none", color: "#bbb", padding: "4px 0", width: "100%" }} />);
}

// ─── Shared chart components ───
const TAG_COLORS = ["#E63946","#457B9D","#2A9D8F","#E9C46A","#F4A261","#6A4C93","#1982C4","#8AC926","#FF595E","#6D6875","#264653","#F77F00","#D62828","#023E8A","#606C38"];
function getTagColor(tag, allTags) { return TAG_COLORS[allTags.indexOf(tag) % TAG_COLORS.length]; }
function getWeekRange(dateStr) { const d = new Date(dateStr + "T12:00:00"); const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const days = []; for (let i = 0; i < 7; i++) { const dd = new Date(mon); dd.setDate(mon.getDate() + i); days.push(dd.toISOString().slice(0, 10)); } return days; }
function getMonthDates(year, month) { const n = new Date(year, month + 1, 0).getDate(); const dates = []; for (let d = 1; d <= n; d++) dates.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`); return dates; }
function SectionHeader({ children }) { const T = useTheme(); return (<div style={{ fontSize: 11, fontFamily: "'Nunito', sans-serif", textTransform: "uppercase", letterSpacing: "0.15em", color: "#999", marginBottom: 14, fontWeight: 600, marginTop: 40 }}>{children}</div>); }
function TagBarChart({ sorted, allTags }) {
  if (sorted.length === 0) return null;
  const maxVal = sorted[0][1]; const barH = 160;
  return (
    <div style={{ overflowX: "auto", paddingBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, minWidth: sorted.length * 64, height: barH + 40, paddingTop: 20 }}>
        {sorted.map(([tag, mins]) => { const h = maxVal > 0 ? (mins / maxVal) * barH : 0; const color = getTagColor(tag, allTags); return (
          <div key={tag} style={{ flex: 1, minWidth: 48, maxWidth: 80, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: barH + 40 }}>
            <span style={{ fontSize: 11, fontFamily: "'Nunito', sans-serif", fontWeight: 700, marginBottom: 4, color }}>{formatHM(mins)}</span>
            <div style={{ width: "100%", height: h, background: color, borderRadius: "4px 4px 0 0", transition: "height 0.4s ease", minHeight: mins > 0 ? 6 : 0 }} />
            <span style={{ fontSize: 10, fontFamily: "'Nunito', sans-serif", marginTop: 6, textAlign: "center", color: "#666", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>{tag}</span>
          </div>
        ); })}
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
      <div style={{ display: "flex", gap: 24, marginBottom: 16, fontFamily: "'Nunito', sans-serif", flexWrap: "wrap" }}>
        {[["Total", totalMins], ["Peak", peakVal], ["Avg/day", avgMins]].map(([label, val]) => (<div key={label}><div style={{ fontSize: 22, fontWeight: 700 }}>{formatHM(val)}</div><div style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div></div>))}
      </div>
      <div style={{ position: "relative", overflowX: "auto", paddingBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: isWeekly ? 8 : 2, minWidth: isWeekly ? dates.length * 52 : dates.length * 16, height: barH + 50, paddingTop: 24, position: "relative" }}>
          {peakVal > 0 && (<div style={{ position: "absolute", top: 24, left: 0, right: 0, height: barH, pointerEvents: "none" }}><div style={{ position: "absolute", bottom: `${(peakVal / maxVal) * barH}px`, left: 0, right: 0, borderTop: "2px dashed #E63946", opacity: 0.6 }} /><span style={{ position: "absolute", bottom: `${(peakVal / maxVal) * barH + 4}px`, right: 0, fontSize: 9, color: "#E63946", fontFamily: "'Nunito', sans-serif", fontWeight: 700 }}>PEAK {formatHM(peakVal)}</span></div>)}
          {data.map((d) => { const h = maxVal > 0 ? (d.mins / maxVal) * barH : 0; const isPeak = d.mins === peakVal && d.mins > 0; const dayLabel = isWeekly ? new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }) : String(new Date(d.date + "T12:00:00").getDate()); return (
            <div key={d.date} style={{ flex: 1, minWidth: isWeekly ? 40 : 10, maxWidth: isWeekly ? 60 : 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: barH + 50 }}>
              {isWeekly && d.mins > 0 && (<span style={{ fontSize: 10, fontFamily: "'Nunito', sans-serif", fontWeight: 600, marginBottom: 3, color: isPeak ? "#E63946" : "#666" }}>{formatHM(d.mins)}</span>)}
              <div style={{ width: "100%", height: h, background: isPeak ? "linear-gradient(180deg, #E63946, #FF6B6B)" : getBarGradient(d.mins), borderRadius: "3px 3px 0 0", transition: "height 0.4s ease", minHeight: d.mins > 0 ? 4 : 2, position: "relative" }}>{isPeak && (<div style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", fontSize: 12 }}>⭐</div>)}</div>
              <span style={{ fontSize: isWeekly ? 10 : 8, fontFamily: "'Nunito', sans-serif", marginTop: 4, color: isPeak ? "#E63946" : "#999", fontWeight: isPeak ? 700 : 400 }}>{dayLabel}</span>
            </div>
          ); })}
        </div>
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 12, fontFamily: "'Nunito', sans-serif", fontSize: 10, color: "#999", flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, background: "#E63946", borderRadius: 2, display: "inline-block" }} /> Peak / &lt;2h</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, background: "#2A9D8F", borderRadius: 2, display: "inline-block" }} /> 2h+</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, background: "#0B6E4F", borderRadius: 2, display: "inline-block" }} /> 4h+</span>
      </div>
    </div>
  );
}

// ─── Excel Export ───
async function exportToExcel(sessions) {
  const XLSX = await import("xlsx");
  const dayMap = {}; sessions.forEach(s => { dayMap[s.date] = (dayMap[s.date] || 0) + s.duration; });
  const dailyData = Object.entries(dayMap).sort((a, b) => a[0].localeCompare(b[0])).map(([date, mins]) => ({ Date: date, Day: new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" }), "Hours": +(mins / 60).toFixed(2), "Status": mins >= 120 ? "🔥" : "❌" }));
  const weekMap = {}; Object.entries(dayMap).forEach(([date, mins]) => { const d = new Date(date + "T12:00:00"); const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const sun = new Date(mon); sun.setDate(mon.getDate() + 6); const label = `${mon.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${sun.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`; weekMap[label] = (weekMap[label] || 0) + mins; });
  const weeklyData = Object.entries(weekMap).map(([week, mins]) => ({ Week: week, "Hours": +(mins / 60).toFixed(2) }));
  const monthMap = {}; Object.entries(dayMap).forEach(([date, mins]) => { const key = date.slice(0, 7); monthMap[key] = (monthMap[key] || 0) + mins; });
  const monthlyData = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0])).map(([key, mins]) => { const [y, m] = key.split("-"); return { Month: new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }), "Hours": +(mins / 60).toFixed(2) }; });
  const tagMap = {}; const tagFirstDate = {}; sessions.forEach(s => { tagMap[s.tag] = (tagMap[s.tag] || 0) + s.duration; if (!tagFirstDate[s.tag] || s.date < tagFirstDate[s.tag]) tagFirstDate[s.tag] = s.date; });
  const topicData = Object.entries(tagMap).sort((a, b) => b[1] - a[1]).map(([tag, mins]) => ({ Topic: tag, "Hours": +(mins / 60).toFixed(2), "Started": tagFirstDate[tag] || "" }));
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(dailyData); ws1["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 6 }];
  const ws2 = XLSX.utils.json_to_sheet(weeklyData); ws2["!cols"] = [{ wch: 30 }, { wch: 10 }];
  const ws3 = XLSX.utils.json_to_sheet(monthlyData); ws3["!cols"] = [{ wch: 20 }, { wch: 10 }];
  const ws4 = XLSX.utils.json_to_sheet(topicData); ws4["!cols"] = [{ wch: 20 }, { wch: 10 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Day-wise"); XLSX.utils.book_append_sheet(wb, ws2, "Week-wise"); XLSX.utils.book_append_sheet(wb, ws3, "Month-wise"); XLSX.utils.book_append_sheet(wb, ws4, "Topic-wise");
  XLSX.writeFile(wb, `FocusMaxing_Export_${todayStr()}.xlsx`);
}

// ─── Analysis Page ───
function AnalysisPage({ sessions, setSessions }) {
  const T = useTheme();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [showReports, setShowReports] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const reportsRef = useRef(null); const advancedRef = useRef(null);
  const [viewMonth, setViewMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const w = useWindowWidth();
  const isMobile = w < 480;
  const font = "'Nunito', sans-serif";
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
  const buckets = [{ label: "0–30m", min: 0, max: 30 }, { label: "30m–1h", min: 30, max: 60 }, { label: "1–2h", min: 60, max: 120 }, { label: "2–3h", min: 120, max: 180 }, { label: "3–4h", min: 180, max: 240 }, { label: "4h+", min: 240, max: 99999 }];
  const bucketCounts = buckets.map(b => ({ ...b, count: Object.values(dayTotalsAll).filter(m => m >= b.min && m < b.max).length }));
  const maxBucket = Math.max(...bucketCounts.map(b => b.count), 1);
  const distColors = ["#E63946", "#E63946", "#F4A261", "#2A9D8F", "#2A9D8F", "#457B9D"];
  const dowDaySets = [new Set(), new Set(), new Set(), new Set(), new Set(), new Set(), new Set()];
  Object.keys(dayTotalsAll).forEach(date => { dowDaySets[new Date(date + "T12:00:00").getDay()].add(date); });
  const dowNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dowCounts = dowDaySets.map((s, i) => ({ dow: i, count: s.size }));
  const bestDow = [...dowCounts].sort((a, b) => b.count - a.count)[0];
  const windowDaySets = {}; sessions.forEach(s => { if (!s.ts) return; const hr = new Date(s.ts).getHours(); const start = Math.floor(hr / 2) * 2; const end = start + 2; const fmt = (h) => { if (h === 0) return "12 AM"; if (h < 12) return `${h} AM`; if (h === 12) return "12 PM"; return `${h - 12} PM`; }; const label = `${fmt(start)} – ${fmt(end > 23 ? 0 : end)}`; if (!windowDaySets[label]) windowDaySets[label] = new Set(); windowDaySets[label].add(s.date); });
  const windowData = Object.entries(windowDaySets).map(([label, set]) => ({ label, count: set.size })).sort((a, b) => b.count - a.count);
  const bestWindow = windowData[0];
  const zones = [{ label: "< 1 hr", min: 0, max: 60 }, { label: "1–2 hrs", min: 60, max: 120 }, { label: "2–3 hrs", min: 120, max: 180 }, { label: "3–4 hrs", min: 180, max: 240 }, { label: "4+ hrs", min: 240, max: 99999 }];
  const bestZone = zones.map(z => ({ ...z, count: Object.values(dayTotalsAll).filter(m => m >= z.min && m < z.max).length })).sort((a, b) => b.count - a.count)[0];
  const navBtn = { border: "none", background: "none", fontSize: 20, cursor: "pointer" };
  const tH = { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: font };
  const tR = { display: "grid", padding: "9px 0", borderBottom: `1px solid ${T.border}`, fontFamily: font, fontSize: isMobile ? 12 : 13, alignItems: "center" };
  const gridCols = isMobile ? "1fr 80px 60px" : "1fr 100px 80px";
  return (
    <div>
      <SectionHeader>Daily Report</SectionHeader>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, marginBottom: 20, fontFamily: font }}>
        <button onClick={() => shiftDate(-1)} style={navBtn}>←</button>
        <span style={{ fontSize: 16, fontWeight: 700, minWidth: 140, textAlign: "center" }}>{dateLabel}</span>
        <button onClick={() => shiftDate(1)} style={{ ...navBtn, opacity: isToday ? 0.2 : 1, pointerEvents: isToday ? "none" : "auto" }}>→</button>
      </div>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 42, fontFamily: font, fontWeight: 700 }}>{formatHM(totalMins)}</div>
        <div style={{ fontSize: 11, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.15em", color: "#999", marginTop: 4, fontWeight: 600 }}>Total Upskilling {totalMins >= 120 && "🔥"}</div>
      </div>
      {sorted.length === 0 ? (<div style={{ textAlign: "center", color: "#ccc", fontFamily: font, fontSize: 13, padding: "30px 0" }}>No sessions recorded</div>) : (<TagBarChart sorted={sorted} allTags={allTags} />)}
      {daySessions.length > 0 && (<div style={{ marginTop: 24 }}><div style={{ fontSize: 10, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.12em", color: "#bbb", marginBottom: 8, fontWeight: 600 }}>Session Log</div>{daySessions.map(s => (<div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f5f5f5", fontFamily: font, fontSize: 13 }}><span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: getTagColor(s.tag, allTags), display: "inline-block", flexShrink: 0 }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.tag}</span></span><span style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}><span style={{ color: "#999" }}>{formatHM(s.duration)}</span><button onClick={async () => { await deleteSession(s.id); setSessions(prev => prev.filter(x => x.id !== s.id)); }} style={{ border: "none", background: "none", cursor: "pointer", color: "#ccc", fontSize: 16, padding: "0 2px", lineHeight: 1 }} title="Delete session">✕</button></span></div>))}</div>)}
      <div style={{ marginTop: 32, textAlign: "center" }}>
        <button onClick={() => setShowReports(!showReports)} style={{ border: `2px solid ${T.borderStrong}`, background: showReports ? "#000" : "transparent", color: showReports ? "#fff" : "#000", padding: "10px 24px", fontSize: 12, fontFamily: font, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}><span style={{ display: "inline-block", transition: "transform 0.3s ease", transform: showReports ? "rotate(180deg)" : "rotate(0deg)", fontSize: 10 }}>▼</span>{showReports ? "Hide Reports" : "Weekly & Monthly Reports"}</button>
      </div>
      <div style={{ maxHeight: showReports ? (reportsRef.current ? reportsRef.current.scrollHeight + "px" : "2000px") : "0px", overflow: "hidden", transition: "max-height 0.5s ease, opacity 0.4s ease", opacity: showReports ? 1 : 0 }}>
        <div ref={reportsRef}>
          <SectionHeader>Weekly Report — {weekLabel}</SectionHeader>
          <PeriodBarChart dates={weekDates} sessions={sessions} />
          <div style={{ marginTop: 40, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 11, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.15em", color: "#999", fontWeight: 600 }}>Monthly Report</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: font }}><button onClick={() => shiftMonth(-1)} style={{ ...navBtn, fontSize: 16 }}>←</button><span style={{ fontSize: 13, fontWeight: 700 }}>{monthLabel}</span><button onClick={() => shiftMonth(1)} style={{ ...navBtn, fontSize: 16 }}>→</button></div>
          </div>
          <PeriodBarChart dates={monthDates} sessions={sessions} />
        </div>
      </div>
      {personalBests.length > 0 && (<><SectionHeader>🏆 Personal Bests</SectionHeader><div style={{ ...tR, borderBottom: `2px solid ${T.borderStrong}`, padding: "0 0 6px", gridTemplateColumns: gridCols }}><span style={tH}>Category</span><span style={{ ...tH, textAlign: "right" }}>Best</span><span style={{ ...tH, textAlign: "right" }}>Date</span></div>{personalBests.map((b, i) => (<div key={b.tag} style={{ ...tR, gridTemplateColumns: gridCols }}><span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: getTagColor(b.tag, allTags), display: "inline-block", flexShrink: 0 }} /><span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.tag}</span>{i === 0 && <span style={{ fontSize: 11, flexShrink: 0 }}>👑</span>}</span><span style={{ textAlign: "right", fontWeight: 700, color: "#2A9D8F" }}>{formatHM(b.mins)}</span><span style={{ textAlign: "right", color: "#999", fontSize: 11 }}>{b.date ? new Date(b.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</span></div>))}</>)}
      <div style={{ marginTop: 32, textAlign: "center" }}>
        <button onClick={() => setShowAdvanced(!showAdvanced)} style={{ border: `2px solid ${T.borderStrong}`, background: showAdvanced ? "#000" : "transparent", color: showAdvanced ? "#fff" : "#000", padding: "10px 24px", fontSize: 12, fontFamily: font, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}><span style={{ display: "inline-block", transition: "transform 0.3s ease", transform: showAdvanced ? "rotate(180deg)" : "rotate(0deg)", fontSize: 10 }}>▼</span>{showAdvanced ? "Hide Advanced" : "Advanced Analysis"}</button>
      </div>
      <div style={{ maxHeight: showAdvanced ? (advancedRef.current ? advancedRef.current.scrollHeight + "px" : "3000px") : "0px", overflow: "hidden", transition: "max-height 0.5s ease, opacity 0.4s ease", opacity: showAdvanced ? 1 : 0 }}>
        <div ref={advancedRef}>
          <SectionHeader>Distribution — Hours vs Days</SectionHeader>
          <div style={{ overflowX: "auto", paddingBottom: 8 }}><div style={{ display: "flex", alignItems: "flex-end", gap: 6, minWidth: bucketCounts.length * 56, height: 160, paddingTop: 16 }}>{bucketCounts.map((c, i) => { const h = maxBucket > 0 ? (c.count / maxBucket) * 120 : 0; return (<div key={c.label} style={{ flex: 1, minWidth: 44, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: 160 }}><span style={{ fontSize: 11, fontFamily: font, fontWeight: 700, marginBottom: 4, color: distColors[i] }}>{c.count > 0 ? c.count : ""}</span><div style={{ width: "100%", height: h, background: distColors[i], borderRadius: "4px 4px 0 0", transition: "height 0.4s ease", minHeight: c.count > 0 ? 6 : 2, opacity: 0.8 }} /><span style={{ fontSize: 9, fontFamily: font, marginTop: 6, color: "#999" }}>{c.label}</span></div>); })}</div></div>
          <SectionHeader>Focus Insights</SectionHeader>
          {sessions.length > 0 && (<><div style={{ ...tR, borderBottom: `2px solid ${T.borderStrong}`, padding: "0 0 6px", gridTemplateColumns: gridCols }}><span style={tH}>Insight</span><span style={{ ...tH, textAlign: "right" }}>Value</span><span style={{ ...tH, textAlign: "right" }}>Count</span></div><div style={{ ...tR, gridTemplateColumns: gridCols }}><div><div style={{ fontWeight: 600 }}>Comfort Zone</div><div style={{ fontSize: 10, color: "#999", marginTop: 2 }}>Most consistent range</div></div><span style={{ textAlign: "right", fontWeight: 700, color: "#6A4C93" }}>{bestZone && bestZone.count > 0 ? bestZone.label : "—"}</span><span style={{ textAlign: "right", color: "#666" }}>{bestZone && bestZone.count > 0 ? `${bestZone.count}d` : "—"}</span></div><div style={{ ...tR, gridTemplateColumns: gridCols }}><div><div style={{ fontWeight: 600 }}>Best Focus Day</div><div style={{ fontSize: 10, color: "#999", marginTop: 2 }}>Day you study most</div></div><span style={{ textAlign: "right", fontWeight: 700, color: "#2A9D8F" }}>{bestDow && bestDow.count > 0 ? (isMobile ? dowNames[bestDow.dow].slice(0,3) : dowNames[bestDow.dow]) : "—"}</span><span style={{ textAlign: "right", color: "#666" }}>{bestDow && bestDow.count > 0 ? `${bestDow.count}d` : "—"}</span></div><div style={{ ...tR, gridTemplateColumns: gridCols }}><div><div style={{ fontWeight: 600 }}>Peak Window</div><div style={{ fontSize: 10, color: "#999", marginTop: 2 }}>When you focus most</div></div><span style={{ textAlign: "right", fontWeight: 700, color: "#457B9D", fontSize: isMobile ? 11 : 13 }}>{bestWindow ? bestWindow.label : "—"}</span><span style={{ textAlign: "right", color: "#666" }}>{bestWindow ? `${bestWindow.count}d` : "—"}</span></div></>)}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 40, marginBottom: 20 }}>
        <button onClick={() => exportToExcel(sessions)} disabled={sessions.length === 0} style={{ padding: "10px 24px", border: `2px solid ${T.borderStrong}`, background: T.btnActive, color: T.btnActiveText, fontSize: 11, fontFamily: font, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: sessions.length > 0 ? "pointer" : "default", opacity: sessions.length > 0 ? 1 : 0.3, display: "flex", alignItems: "center", gap: 6 }}>↓ Export Excel</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// ─── Calendar Page — RESPONSIVE ───
// ═══════════════════════════════════════════
function CalendarPage({ sessions }) {
  const T = useTheme();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedTag, setSelectedTag] = useState("__all__");
  const font = "'Nunito', sans-serif";
  const w = useWindowWidth();
  const allTags = [...new Set(sessions.map(s => s.tag))].sort();
  const todayKey = todayStr();

  const fireDays = new Set();
  const dayMinsMap = {};
  if (selectedTag === "__all__") {
    sessions.forEach(s => {
      if (s.date.startsWith(String(selectedYear))) {
        dayMinsMap[s.date] = (dayMinsMap[s.date] || 0) + s.duration;
      }
    });
    Object.entries(dayMinsMap).forEach(([date, mins]) => { if (mins >= 120) fireDays.add(date); });
  } else {
    sessions.forEach(s => {
      if (s.date.startsWith(String(selectedYear)) && s.tag === selectedTag) {
        fireDays.add(s.date);
        dayMinsMap[s.date] = (dayMinsMap[s.date] || 0) + s.duration;
      }
    });
  }

  const isAllMode = selectedTag === "__all__";
  const dayHeaders = ["M", "T", "W", "T", "F", "S", "S"];
  const yearOptions = [];
  for (let y = 2025; y <= 2027; y++) yearOptions.push(y);
  const totalFireDays = fireDays.size;

  // Responsive: 1 col on small mobile, 2 on large mobile/tablet, 3 on desktop
  const colCount = w < 480 ? 1 : w < 768 ? 2 : 3;

  function MonthBlock({ year, month }) {
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayRaw = new Date(year, month, 1).getDay();
    const firstDayMon = (firstDayRaw + 6) % 7;
    const cells = [];
    for (let i = 0; i < firstDayMon; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    let monthTotal = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      monthTotal += (dayMinsMap[key] || 0);
    }
    const avgMins = Math.round(monthTotal / daysInMonth);

    let monthFireCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (fireDays.has(key)) monthFireCount++;
    }

    const now = new Date();
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
    const cellFontSize = colCount === 1 ? 14 : colCount === 2 ? 12 : 11;
    const headerFontSize = colCount === 1 ? 10 : 9;

    return (
      <div style={{ fontFamily: font }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, padding: "0 2px" }}>
          <span style={{ fontSize: colCount === 1 ? 16 : 13, fontWeight: 800 }}>{monthNames[month]}</span>
          <span style={{ fontSize: colCount === 1 ? 13 : 11, fontWeight: 700, color: avgMins > 0 ? "#2A9D8F" : "#bbb" }}>
            Avg {formatHM(avgMins)}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0 }}>
          {dayHeaders.map((d, i) => (
            <div key={i} style={{
              height: colCount === 1 ? 28 : 22, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: headerFontSize, fontWeight: 700, color: "#666",
              border: "1px solid #000", borderBottom: `2px solid ${T.borderStrong}`,
              background: T.calHeaderBg
            }}>{d}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0 }}>
          {cells.map((day, i) => {
            if (day === null) return <div key={`e${i}`} style={{ aspectRatio: "1", border: `0.5px solid ${T.border}`, background: T.calEmptyBg }} />;
            const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isFire = fireDays.has(key);
            const isFuture = key > todayKey;
            const isToday = isCurrentMonth && day === now.getDate();
            const isMissed = !isFuture && !isFire && key <= todayKey;

            let bg = T.calFutureBg;
            let color = T.text;
            if (isFire) { bg = "#2A9D8F"; color = "#fff"; }
            else if (isMissed) { bg = "#E63946"; color = "#fff"; }
            else if (isFuture) { bg = T.calFutureBg; color = T.calFutureColor; }

            return (
              <div key={i} title={`${key}${dayMinsMap[key] ? " — " + formatHM(dayMinsMap[key]) : ""}`} style={{
                aspectRatio: "1",
                border: isToday ? `2.5px solid ${T.borderStrong}` : `1px solid ${T.calCellBorder}`,
                background: bg, color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: cellFontSize, fontWeight: isToday ? 900 : 600,
                cursor: "default",
                position: "relative",
                zIndex: isToday ? 2 : 1
              }}>
                {day}
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: colCount === 1 ? 12 : 10, color: "#666", marginTop: 6, textAlign: "center", fontWeight: 600 }}>
          {monthFireCount} 🔥
        </div>
      </div>
    );
  }

  // Build rows dynamically based on colCount
  const allMonths = [0,1,2,3,4,5,6,7,8,9,10,11];
  const rows = [];
  for (let i = 0; i < 12; i += colCount) {
    rows.push(allMonths.slice(i, i + colCount));
  }

  return (
    <div style={{ paddingTop: 16, fontFamily: font }}>
      <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{
          border: `2px solid ${T.borderStrong}`, padding: "8px 14px", fontSize: 13, fontFamily: font,
          fontWeight: 700, background: T.selectBg, color: T.text, outline: "none", cursor: "pointer", borderRadius: 4
        }}>
          {yearOptions.map(y => (<option key={y} value={y}>{y}</option>))}
        </select>
        <select value={selectedTag} onChange={e => setSelectedTag(e.target.value)} style={{
          border: `2px solid ${T.borderStrong}`, padding: "8px 14px", fontSize: 13, fontFamily: font,
          fontWeight: 700, background: T.selectBg, color: T.text, outline: "none", cursor: "pointer", borderRadius: 4,
          maxWidth: w < 480 ? 200 : "none"
        }}>
          <option value="__all__">All — 2h+ goal</option>
          {allTags.map(tag => (<option key={tag} value={tag}>{tag}</option>))}
        </select>
      </div>

      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <span style={{ fontSize: 26, fontWeight: 800 }}>{totalFireDays}</span>
        <span style={{ fontSize: 13, color: "#999", marginLeft: 8, fontWeight: 600 }}>{isAllMode ? "fire days" : `${selectedTag} days`} in {selectedYear}</span>
      </div>

      {rows.map((monthGroup, rowIdx) => (
        <div key={rowIdx} style={{
          display: "grid",
          gridTemplateColumns: `repeat(${colCount}, 1fr)`,
          gap: colCount === 1 ? 20 : 12,
          marginBottom: colCount === 1 ? 12 : 24
        }}>
          {monthGroup.map(m => (<MonthBlock key={m} year={selectedYear} month={m} />))}
        </div>
      ))}

      <div style={{ display: "flex", justifyContent: "center", gap: 20, fontSize: 11, color: "#555", marginTop: 4, fontWeight: 600, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 14, height: 14, background: "#2A9D8F", border: `1px solid ${T.calCellBorder}`, display: "inline-block" }} /> {isAllMode ? "2h+" : "Studied"}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 14, height: 14, background: "#E63946", border: `1px solid ${T.calCellBorder}`, display: "inline-block" }} /> Missed</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 14, height: 14, background: "#fff", border: `1px solid ${T.calCellBorder}`, display: "inline-block" }} /> Future</span>
      </div>
    </div>
  );
}

// ─── Reflection Page ───
function ReflectionPage({ sessions }) {
  const T = useTheme();
  const [reflections, setReflections] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [editText, setEditText] = useState(""); const [editHrs, setEditHrs] = useState("");
  const w = useWindowWidth();
  const isMobile = w < 480;
  useEffect(() => { loadReflections().then(data => { setReflections(data); setLoaded(true); }); }, []);
  const saveReflection = async (date, note, hrsOverride) => { setReflections(prev => ({ ...prev, [date]: { note, hrsOverride } })); await upsertReflection(date, note, hrsOverride); };
  const dayTotals = getDayTotals(sessions);
  const allDates = [...new Set([...Object.keys(dayTotals), ...Object.keys(reflections)])].sort((a, b) => b.localeCompare(a));
  const today = todayStr(); if (!allDates.includes(today)) allDates.unshift(today);
  const startEdit = (date) => { const r = reflections[date] || {}; setEditingKey(date); setEditText(r.note || ""); setEditHrs(r.hrsOverride != null ? String(r.hrsOverride) : ""); };
  const saveRow = (date) => { const hrsVal = editHrs.trim() !== "" ? parseFloat(editHrs) : null; saveReflection(date, editText, hrsVal); setEditingKey(null); };
  const getHours = (date) => { const r = reflections[date]; if (r && r.hrsOverride != null) return r.hrsOverride; return (dayTotals[date] || 0) / 60; };
  const getMins = (date) => { const r = reflections[date]; if (r && r.hrsOverride != null) return Math.round(r.hrsOverride * 60); return dayTotals[date] || 0; };
  const gridCols = isMobile ? "70px 1fr 55px" : "90px 1fr 70px";
  if (!loaded) return (<div style={{ textAlign: "center", padding: "40px 0", fontFamily: "'Nunito', sans-serif", color: "#999", fontSize: 13 }}>Loading...</div>);
  return (
    <div>
      <div style={{ fontSize: 11, fontFamily: "'Nunito', sans-serif", textTransform: "uppercase", letterSpacing: "0.15em", color: "#999", marginBottom: 16, fontWeight: 600 }}>Daily Reflection</div>
      <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 0, fontFamily: "'Nunito', sans-serif", borderBottom: `2px solid ${T.borderStrong}`, paddingBottom: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Date</span>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Notes</span>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", textAlign: "right" }}>Hours</span>
      </div>
      {allDates.map(date => {
        const hrs = getHours(date); const mins = getMins(date); const isGreen = mins >= 120; const r = reflections[date] || {};
        const isEditing = editingKey === date; const isToday = date === today;
        const dayLabel = new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
        const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const rowBg = isGreen ? "rgba(42,157,143,0.08)" : "rgba(230,57,70,0.06)";
        const rowBorder = isGreen ? "rgba(42,157,143,0.2)" : "rgba(230,57,70,0.15)";
        const hrsColor = isGreen ? "#2A9D8F" : "#E63946";
        return (
          <div key={date} onClick={() => { if (!isEditing) startEdit(date); }} style={{ display: "grid", gridTemplateColumns: gridCols, gap: 0, padding: "10px 0", borderBottom: `1px solid ${rowBorder}`, fontFamily: "'Nunito', sans-serif", fontSize: 13, background: rowBg, cursor: isEditing ? "default" : "pointer", marginLeft: -8, marginRight: -8, paddingLeft: 8, paddingRight: 8, borderRadius: 2 }}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}><span style={{ fontWeight: 700, fontSize: 12 }}>{dayLabel}</span><span style={{ fontSize: 10, color: "#999" }}>{dateLabel}</span></div>
            <div style={{ display: "flex", alignItems: "center", paddingRight: 8, minWidth: 0 }}>
              {isEditing ? (<div style={{ display: "flex", gap: 6, width: "100%", alignItems: "center" }}><input value={editText} onChange={e => setEditText(e.target.value)} autoFocus placeholder="How was your study?" onKeyDown={e => { if (e.key === "Enter") saveRow(date); if (e.key === "Escape") setEditingKey(null); }} style={{ flex: 1, border: "none", borderBottom: `2px solid ${T.borderStrong}`, background: "transparent", fontSize: 13, fontFamily: "inherit", padding: "4px 0", outline: "none", minWidth: 0 }} /><button onClick={(e) => { e.stopPropagation(); saveRow(date); }} style={{ border: `2px solid ${T.borderStrong}`, background: T.btnActive, color: T.btnActiveText, padding: "4px 10px", fontSize: 10, fontFamily: "inherit", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>Save</button></div>
              ) : (<span style={{ color: r.note ? "#000" : "#ccc", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.note || (isToday ? "Tap to add..." : "—")}</span>)}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              {isEditing ? (<input value={editHrs} onChange={e => setEditHrs(e.target.value)} placeholder={hrs.toFixed(1)} type="number" step="0.1" onKeyDown={e => { if (e.key === "Enter") saveRow(date); }} style={{ width: 45, border: "none", borderBottom: `2px solid ${T.borderStrong}`, background: "transparent", fontSize: 13, fontFamily: "inherit", textAlign: "right", padding: "4px 0", outline: "none" }} />
              ) : (<span style={{ fontWeight: 700, color: hrsColor, fontSize: 13 }}>{hrs.toFixed(1)}h</span>)}
            </div>
          </div>
        );
      })}
      {allDates.length === 0 && (<div style={{ textAlign: "center", color: "#ccc", fontFamily: "'Nunito', sans-serif", fontSize: 13, padding: "40px 0" }}>No data yet. Start logging sessions!</div>)}
      <div style={{ display: "flex", gap: 16, marginTop: 20, fontFamily: "'Nunito', sans-serif", fontSize: 10, color: "#999", flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, background: "rgba(42,157,143,0.15)", border: "1px solid rgba(42,157,143,0.3)", display: "inline-block", borderRadius: 2 }} /> 2h+</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, background: "rgba(230,57,70,0.1)", border: "1px solid rgba(230,57,70,0.2)", display: "inline-block", borderRadius: 2 }} /> &lt;2h</span>
        <span>Tap row to edit</span>
      </div>
    </div>
  );
}

// ─── Sleep Page ───
function SleepPage({ sleepLogs, setSleepLogs }) {
  const T = useTheme();
  const [sleepStart, setSleepStart] = useState("23:00");
  const [wakeUp, setWakeUp] = useState("06:30");
  const [logDate, setLogDate] = useState(todayStr());
  const w = useWindowWidth();
  const isMobile = w < 480;
  const font = "'Nunito', sans-serif";
  const calcSleepMins = (start, wake) => { const [sh, sm] = start.split(":").map(Number); const [wh, wm] = wake.split(":").map(Number); let startMin = sh * 60 + sm; let wakeMin = wh * 60 + wm; if (wakeMin <= startMin) wakeMin += 1440; return wakeMin - startMin; };
  const logSleep = async () => { const totalMins = calcSleepMins(sleepStart, wakeUp); const saved = await upsertSleepLog(logDate, sleepStart, wakeUp, totalMins); if (saved) { setSleepLogs(prev => { const filtered = prev.filter(l => l.date !== logDate); return [saved, ...filtered].sort((a, b) => b.date.localeCompare(a.date)); }); } };
  const sleepColor = (mins) => { if (mins < 360) return "#F4A261"; if (mins <= 450) return "#2A9D8F"; return "#E63946"; };
  const last14 = []; for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); last14.push(d.toISOString().slice(0, 10)); }
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
  return (
    <div>
      <div style={{ fontSize: 11, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.15em", color: "#999", marginBottom: 14, fontWeight: 600 }}>Log Sleep</div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: isMobile ? "1 1 45%" : "none" }}><label style={{ fontSize: 10, fontFamily: font, color: "#999", fontWeight: 600 }}>DATE</label><input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} style={{ border: `2px solid ${T.borderStrong}`, padding: "8px 10px", fontSize: 13, fontFamily: font, fontWeight: 600, outline: "none", width: "100%", boxSizing: "border-box" }} /></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: isMobile ? "1 1 22%" : "none" }}><label style={{ fontSize: 10, fontFamily: font, color: "#999", fontWeight: 600 }}>SLEEP</label><input type="time" value={sleepStart} onChange={e => setSleepStart(e.target.value)} style={{ border: `2px solid ${T.borderStrong}`, padding: "8px 10px", fontSize: 13, fontFamily: font, fontWeight: 600, outline: "none", width: "100%", boxSizing: "border-box" }} /></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: isMobile ? "1 1 22%" : "none" }}><label style={{ fontSize: 10, fontFamily: font, color: "#999", fontWeight: 600 }}>WAKE</label><input type="time" value={wakeUp} onChange={e => setWakeUp(e.target.value)} style={{ border: `2px solid ${T.borderStrong}`, padding: "8px 10px", fontSize: 13, fontFamily: font, fontWeight: 600, outline: "none", width: "100%", boxSizing: "border-box" }} /></div>
        <button onClick={logSleep} style={{ padding: "10px 20px", border: `2px solid ${T.borderStrong}`, background: T.btnActive, color: T.btnActiveText, fontSize: 13, fontFamily: font, fontWeight: 700, cursor: "pointer", flex: isMobile ? "1 1 100%" : "none" }}>Log</button>
      </div>
      <div style={{ fontSize: 11, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.15em", color: "#999", marginBottom: 14, fontWeight: 600, marginTop: 32 }}>Last 14 Days</div>
      <div style={{ overflowX: "auto", paddingBottom: 8 }}><div style={{ display: "flex", alignItems: "flex-end", gap: 4, minWidth: 14 * 36, height: barH + 40, paddingTop: 16 }}>{barData.map(d => { const h = d.mins > 0 ? (d.mins / maxSleep) * barH : 0; const color = d.mins > 0 ? sleepColor(d.mins) : "#f0f0f0"; const dayLabel = new Date(d.date + "T12:00:00").getDate(); return (<div key={d.date} style={{ flex: 1, minWidth: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: barH + 40 }}>{d.mins > 0 && <span style={{ fontSize: 9, fontFamily: font, fontWeight: 700, marginBottom: 2, color }}>{formatHM(d.mins)}</span>}<div style={{ width: "100%", height: h, background: color, borderRadius: "3px 3px 0 0", minHeight: d.mins > 0 ? 4 : 2 }} /><span style={{ fontSize: 8, fontFamily: font, marginTop: 3, color: "#999" }}>{dayLabel}</span></div>); })}</div></div>
      <div style={{ display: "flex", gap: 16, marginTop: 8, fontFamily: font, fontSize: 10, color: "#999", flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, background: "#F4A261", borderRadius: 2, display: "inline-block" }} /> &lt;6h</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, background: "#2A9D8F", borderRadius: 2, display: "inline-block" }} /> 6–7.5h</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, background: "#E63946", borderRadius: 2, display: "inline-block" }} /> 7.5h+</span>
      </div>
      <div style={{ fontSize: 11, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.15em", color: "#999", marginBottom: 14, fontWeight: 600, marginTop: 32 }}>Averages</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={{ background: T.bgTertiary, padding: "16px", borderRadius: 8, fontFamily: font }}><div style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 6 }}>Weekly (last 7)</div><div style={{ fontSize: 22, fontWeight: 700 }}>{formatHM(avgSleep)}</div><div style={{ fontSize: 11, color: "#666", marginTop: 6 }}>Bed: {avgBed}</div><div style={{ fontSize: 11, color: "#666" }}>Wake: {avgWake}</div></div>
        <div style={{ background: T.bgTertiary, padding: "16px", borderRadius: 8, fontFamily: font }}><div style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 6 }}>Monthly</div><div style={{ fontSize: 22, fontWeight: 700 }}>{formatHM(monthAvg)}</div><div style={{ fontSize: 11, color: "#666", marginTop: 6 }}>{monthLogs.length} nights logged</div></div>
      </div>
      <div style={{ fontSize: 11, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.15em", color: "#999", marginBottom: 10, fontWeight: 600 }}>Sleep Log</div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 60px 60px 60px" : "90px 70px 70px 70px", gap: 0, fontFamily: font, borderBottom: `2px solid ${T.borderStrong}`, paddingBottom: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Date</span><span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Sleep</span><span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Wake</span><span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", textAlign: "right" }}>Total</span>
      </div>
      {sleepLogs.length === 0 && (<div style={{ color: "#ccc", fontFamily: font, fontSize: 13, padding: "20px 0", textAlign: "center" }}>No sleep logs yet</div>)}
      {sleepLogs.map(l => { const color = sleepColor(l.total_mins || 0); const dayLabel = new Date(l.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); return (
        <div key={l.id} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 60px 60px 60px" : "90px 70px 70px 70px", padding: "8px 0", borderBottom: `1px solid ${T.border}`, fontFamily: font, fontSize: isMobile ? 12 : 13 }}>
          <span style={{ fontWeight: 600, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dayLabel}</span><span style={{ color: "#666" }}>{l.sleep_start || "—"}</span><span style={{ color: "#666" }}>{l.wake_up || "—"}</span><span style={{ textAlign: "right", fontWeight: 700, color }}>{l.total_mins ? formatHM(l.total_mins) : "—"}</span>
        </div>
      ); })}
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => localStorage.getItem("fm_theme") === "dark");
  const toggleTheme = () => { setIsDark(prev => { const next = !prev; localStorage.setItem("fm_theme", next ? "dark" : "light"); return next; }); };
  const theme = isDark ? THEMES.dark : THEMES.light;
  const w = useWindowWidth();

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

  const handleLogout = async () => { await supabase.auth.signOut(); setUser(null); setSessions([]); setTasks([]); setSleepLogs([]); setLoaded(false); setSidebarOpen(false); };
  const streak = calcStreak(sessions);
  const todayMins = sessions.filter(s => s.date === todayStr()).reduce((a, s) => a + s.duration, 0);

  // Responsive max width — calendar gets more room
  const getMaxWidth = () => {
    if (page === PAGES.CALENDAR) return w < 480 ? "100%" : 900;
    return w < 480 ? "100%" : 540;
  };

  if (authLoading) return (<ThemeContext.Provider value={theme}><div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "'Nunito', sans-serif", fontSize: 14, color: theme.textMuted, background: theme.bg }}><link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet" />Loading...</div></ThemeContext.Provider>);
  if (!user) return (<ThemeContext.Provider value={theme}><link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet" /><AuthPage onAuth={setUser} /></ThemeContext.Provider>);
  if (!loaded) return (<ThemeContext.Provider value={theme}><div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "'Nunito', sans-serif", fontSize: 14, color: theme.textMuted, background: theme.bg }}><link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet" />Loading your data...</div></ThemeContext.Provider>);

  return (
    <ThemeContext.Provider value={theme}>
    <div style={{ maxWidth: getMaxWidth(), margin: "0 auto", padding: w < 480 ? "56px 12px 60px" : "60px 20px 60px", minHeight: "100vh", background: theme.bg, color: theme.text, transition: "all 0.3s ease" }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <TopNavBar sessions={sessions} streak={streak} todayMins={todayMins} onMenuClick={() => setSidebarOpen(true)} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} page={page} setPage={setPage} sessions={sessions} onLogout={handleLogout} isDark={isDark} onToggleTheme={toggleTheme} />
      {page === PAGES.TIMER && <><WeekStrip sessions={sessions} /><TimerPage sessions={sessions} setSessions={setSessions} /></>}
      {page === PAGES.TASKS && <div style={{ paddingTop: 16 }}><TasksPage tasks={tasks} setTasks={setTasks} /></div>}
      {page === PAGES.ANALYSIS && <div style={{ paddingTop: 16 }}><AnalysisPage sessions={sessions} setSessions={setSessions} /></div>}
      {page === PAGES.CALENDAR && <CalendarPage sessions={sessions} />}
      {page === PAGES.REFLECTION && <div style={{ paddingTop: 16 }}><ReflectionPage sessions={sessions} /></div>}
      {page === PAGES.SLEEP && <div style={{ paddingTop: 16 }}><SleepPage sleepLogs={sleepLogs} setSleepLogs={setSleepLogs} /></div>}
    </div>
  );
}