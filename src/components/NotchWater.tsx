import { motion } from "framer-motion";
import type { WaterState } from "../hooks/useNusa";

interface Props {
  state: WaterState | null;
  onDrink: () => void;
  onUndo: () => void;
  onReset: () => void;
}

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

export function NotchWater({ state, onDrink, onUndo, onReset }: Props) {
  const goal = state?.goal_ml ?? 1500;
  const today = state?.today_ml ?? 0;
  const pct = Math.min(100, Math.round((today / Math.max(1, goal)) * 100));
  const done = today >= goal;

  // Circular progress ring.
  const r = 26;
  const circ = 2 * Math.PI * r;

  return (
    <div className="nusa-water" onClick={(e) => e.stopPropagation()}>
      <div className="nusa-water-left">
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="6" />
          <motion.circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={done ? "#4fc0ff" : "#2d6bff"}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circ}
            animate={{ strokeDashoffset: circ - (circ * pct) / 100 }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
            transform="rotate(-90 32 32)"
          />
        </svg>
        <div className="nusa-water-pct">{pct}%</div>
      </div>
      <div className="nusa-water-right">
        <div className="nusa-water-amt">
          <b>{(today / 1000).toFixed(1)}</b>
          <span className="dim"> / {(goal / 1000).toFixed(1)} L</span>
        </div>
        <div className="nusa-water-sub">
          {done ? "Goal reached" : `${((goal - today) / 1000).toFixed(1)} L to go`} · {state?.streak_days ?? 0}d streak
        </div>
        <div className="nusa-water-chart">
          {(state?.week ?? []).map((d) => {
            const h = Math.max(3, Math.min(1, d.ml / Math.max(1, goal)) * 34);
            const isToday = d.date === (state?.week[state.week.length - 1]?.date ?? "");
            return (
              <div key={d.date} className="nusa-water-bar" title={`${d.date}: ${d.ml}ml`}>
                <div
                  className="nusa-water-bar-fill"
                  style={{ height: `${h}px`, background: d.ml >= goal ? "#4fc0ff" : "#2d6bff", opacity: isToday ? 1 : 0.7 }}
                />
              </div>
            );
          })}
        </div>
        <div className="nusa-water-btns">
          <button className="nusa-btn primary" onClick={onDrink}>Drink +{state?.increment_ml ?? 250}</button>
          {today > 0 && (
            <>
              <button className="nusa-btn" onClick={onUndo}>Undo</button>
              <button className="nusa-btn ghost" onClick={onReset}>Reset</button>
            </>
          )}
        </div>
        <div className="nusa-water-date">{todayLabel()}</div>
      </div>
    </div>
  );
}
