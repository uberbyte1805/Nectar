import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TodoItem } from "../hooks/useNusa";

interface Props {
  items: TodoItem[];
  onAdd: (text: string, dueAt?: number) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}

function fmtDue(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) +
    (sameDay ? "" : " " + d.toLocaleDateString(undefined, { day: "numeric", month: "short" }));
}

export function NotchTodo({ items, onAdd, onToggle, onRemove }: Props) {
  const [text, setText] = useState("");
  const [due, setDue] = useState("");

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    let dueAt = 0;
    if (due) {
      const parsed = new Date(due).getTime();
      if (!isNaN(parsed)) dueAt = parsed;
    }
    onAdd(t, dueAt || undefined);
    setText("");
    setDue("");
  };

  const now = Date.now();
  const active = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  return (
    <div className="nusa-todo" onClick={(e) => e.stopPropagation()}>
      <div className="nusa-todo-inputrow">
        <input
          className="nusa-input"
          placeholder="Add a task…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); e.stopPropagation(); }}
          onPointerDown={(e) => e.stopPropagation()}
        />
        <input
          className="nusa-input nusa-input-due"
          type="datetime-local"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
        />
        <button className="nusa-btn primary" onClick={submit}>Add</button>
      </div>
      <div className="nusa-todo-list">
        <AnimatePresence initial={false}>
          {active.map((t) => {
            const overdue = t.due_at > 0 && now > t.due_at;
            return (
              <motion.div
                key={t.id}
                className={`nusa-todo-item ${overdue ? "overdue" : ""}`}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                layout
              >
                <button className="nusa-check" onClick={() => onToggle(t.id)} />
                <span className="nusa-todo-text">{t.text}</span>
                {t.due_at > 0 && <span className="nusa-todo-due">{fmtDue(t.due_at)}</span>}
                <button className="nusa-x" onClick={() => onRemove(t.id)}>×</button>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {active.length === 0 && <div className="nusa-empty">Nothing yet. Add a task above.</div>}
        {done.length > 0 && (
          <div className="nusa-todo-donewrap">
            <div className="nusa-todo-donehead">{done.length} done</div>
            {done.map((t) => (
              <motion.div key={t.id} className="nusa-todo-item done" layout>
                <button className="nusa-check checked" onClick={() => onToggle(t.id)}>✓</button>
                <span className="nusa-todo-text">{t.text}</span>
                <button className="nusa-x" onClick={() => onRemove(t.id)}>×</button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
