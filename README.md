# StudyLog — Supabase Edition

Pomodoro + study tracker with Supabase auth & per-user cloud storage.

## Quick Start (Local)

```bash
npm install
npm run dev
```

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Framework: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`
6. Click **Deploy**

No environment variables needed — Supabase credentials are in `src/supabaseClient.js`.

## Supabase Setup (already done)

Tables `sessions` and `reflections` exist with RLS enabled.  
Email auth is enabled.

### Required RLS Policies (if not set)

```sql
-- sessions: users can only read/write their own rows
CREATE POLICY "Users read own sessions" ON sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own sessions" ON sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- reflections: users can only read/write their own rows
CREATE POLICY "Users read own reflections" ON reflections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users upsert own reflections" ON reflections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own reflections" ON reflections
  FOR UPDATE USING (auth.uid() = user_id);
```

## Features

- Login/Signup (email + password)
- Pomodoro timer with bell sound (Tone.js)
- Tag-based session logging (timer + quick log)
- Analysis: daily report, tag bar chart, session log
- Personal bests per category
- Weekly & monthly reports with peak dotted line
- Advanced analysis: distribution graph + focus insights
- Calendar with 🔥 on 2h+ days
- Reflection page: editable daily notes, green/red rows
- Streak badge (top right)
- Top bar: max hours, yearly total, monthly total, week circles
- Export to Excel
- Logout button above nav
