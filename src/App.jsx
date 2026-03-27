import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";
import { supabase } from "./supabaseClient";
 
const PAGES = { TIMER: "timer" };
 
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
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
 
// 🔔 sound
let bell;
function playBell() {
  if (!bell) {
    bell = new Tone.Synth().toDestination();
  }
  Tone.start();
  bell.triggerAttackRelease("C6", "8n");
}
 
// ─── TOP BAR (FIXED CLEAN)
function TopBar({ todayMins }) {
  return (
    <div className="fixed top-0 left-0 right-0 bg-[#0f0f0f] border-b border-[#222] z-50 px-3 py-2">
      <div className="max-w-5xl mx-auto flex justify-between items-center text-xs">
        <div className="bg-[#161616] px-2 py-1 rounded-md text-white">
          📖 {formatHM(todayMins)}
        </div>
        <div className="text-[#888]">Focus Mode</div>
      </div>
    </div>
  );
}
 
// ─── NAV (CLEAN)
function Nav({ page, setPage }) {
  return (
    <nav className="flex gap-1 mb-4 bg-[#161616] p-0.5 rounded-md">
      <button
        onClick={() => setPage(PAGES.TIMER)}
        className={`flex-1 py-2 rounded-md text-[10px] font-semibold ${
          page === PAGES.TIMER
            ? "bg-[#3ea6ff] text-black"
            : "text-[#888]"
        }`}
      >
        ⏱ Timer
      </button>
    </nav>
  );
}
 
// ─── TIMER PAGE (CLEANED)
function TimerPage({ sessions, setSessions }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
 
  const intervalRef = useRef(null);
 
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed((p) => p + 1);
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);
 
  const addSession = useCallback(() => {
    const mins = Math.max(1, Math.round(elapsed / 60));
    const newS = {
      id: Date.now(),
      duration: mins,
      date: todayStr(),
    };
    setSessions((p) => [...p, newS]);
  }, [elapsed]);
 
  const toggle = () => {
    if (running) {
      addSession();
      playBell();
    }
    setRunning(!running);
  };
 
  const reset = () => {
    setRunning(false);
    setElapsed(0);
  };
 
  const todayTotal = sessions
    .filter((s) => s.date === todayStr())
    .reduce((a, s) => a + s.duration, 0);
 
  return (
    <div className="max-w-md mx-auto">
 
      {/* TIMER */}
      <div className="flex justify-center mb-5">
        <div className="relative w-44 h-44 flex items-center justify-center border border-[#222] rounded-full">
          <div className="text-center">
            <div className="text-[8px] text-[#888] mb-1 uppercase">
              Focus
            </div>
            <div className="text-3xl font-bold text-white">
              {formatTime(elapsed)}
            </div>
          </div>
        </div>
      </div>
 
      {/* BUTTONS */}
      <div className="flex justify-center gap-2 mb-5">
        <button
          onClick={toggle}
          className="px-5 py-2 bg-[#3ea6ff] text-black text-xs rounded-md font-bold"
        >
          {running ? "Stop" : "Start"}
        </button>
        <button
          onClick={reset}
          className="px-4 py-2 bg-[#222] text-white text-xs rounded-md"
        >
          Reset
        </button>
      </div>
 
      {/* TODAY */}
      <div className="bg-[#161616] p-3 rounded-md border border-[#222]">
        <div className="flex justify-between text-xs text-[#888] mb-2">
          <span>Today</span>
          <span className="text-white font-bold">
            {formatHM(todayTotal)}
          </span>
        </div>
 
        {sessions.length === 0 && (
          <div className="text-center text-[#666] text-xs py-4">
            No sessions
          </div>
        )}
      </div>
    </div>
  );
}
 
// ─── MAIN APP
export default function App() {
  const [page, setPage] = useState(PAGES.TIMER);
  const [sessions, setSessions] = useState([]);
 
  const todayMins = sessions
    .filter((s) => s.date === todayStr())
    .reduce((a, s) => a + s.duration, 0);
 
  return (
    <div className="min-h-screen bg-[#0f0f0f] pb-6 text-[13px]">
      <TopBar todayMins={todayMins} />
 
      <div className="max-w-5xl mx-auto px-3 pt-16">
        <Nav page={page} setPage={setPage} />
 
        {page === PAGES.TIMER && (
          <TimerPage sessions={sessions} setSessions={setSessions} />
        )}
      </div>
    </div>
  );
}