import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

// ── Types mirroring the Rust structs ──

export interface WaterDay {
  date: string;
  ml: number;
}

export interface WaterState {
  today_ml: number;
  goal_ml: number;
  increment_ml: number;
  week: WaterDay[];
  streak_days: number;
}

export interface ShelfItem {
  id: string;
  path: string;
  name: string;
  added_at: number;
}

export interface TodoItem {
  id: string;
  text: string;
  due_at: number;
  done: boolean;
  notified: boolean;
}

export interface LyricLine {
  time_ms: number;
  text: string;
}

export interface LyricsResult {
  synced: boolean;
  lines: LyricLine[];
}

export interface NusaReminder {
  kind: "water" | "todo";
  id?: string;
  text?: string;
}

// ── Water ──

export function useWater(enabled: boolean) {
  const [state, setState] = useState<WaterState | null>(null);

  useEffect(() => {
    if (!enabled) return;
    invoke<WaterState>("water_state").then(setState).catch(() => {});
  }, [enabled]);

  const drink = useCallback(async (ml?: number) => {
    try {
      setState(await invoke<WaterState>("water_drink", { ml: ml ?? null }));
    } catch (e) {
      console.error("water_drink failed:", e);
    }
  }, []);

  const undo = useCallback(async () => {
    try {
      setState(await invoke<WaterState>("water_undo"));
    } catch (e) {
      console.error("water_undo failed:", e);
    }
  }, []);

  const resetToday = useCallback(async () => {
    try {
      setState(await invoke<WaterState>("water_reset_today"));
    } catch (e) {
      console.error("water_reset_today failed:", e);
    }
  }, []);

  return { state, drink, undo, resetToday };
}

// ── Shelf ──

export function useShelf(enabled: boolean) {
  const [items, setItems] = useState<ShelfItem[]>([]);

  useEffect(() => {
    if (!enabled) return;
    invoke<ShelfItem[]>("shelf_list").then(setItems).catch(() => {});
  }, [enabled]);

  const add = useCallback(async (path: string) => {
    try {
      setItems(await invoke<ShelfItem[]>("shelf_add", { path }));
    } catch (e) {
      console.error("shelf_add failed:", e);
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    try {
      setItems(await invoke<ShelfItem[]>("shelf_remove", { id }));
    } catch (e) {
      console.error("shelf_remove failed:", e);
    }
  }, []);

  const reveal = useCallback(async (path: string) => {
    try {
      await invoke("shelf_reveal", { path });
    } catch (e) {
      console.error("shelf_reveal failed:", e);
    }
  }, []);

  return { items, add, remove, reveal };
}

// ── To-do ──

export function useTodos(enabled: boolean) {
  const [items, setItems] = useState<TodoItem[]>([]);

  useEffect(() => {
    if (!enabled) return;
    invoke<TodoItem[]>("todo_list").then(setItems).catch(() => {});
  }, [enabled]);

  const add = useCallback(async (text: string, dueAt?: number) => {
    try {
      setItems(await invoke<TodoItem[]>("todo_add", { text, dueAt: dueAt ?? 0 }));
    } catch (e) {
      console.error("todo_add failed:", e);
    }
  }, []);

  const toggle = useCallback(async (id: string) => {
    try {
      setItems(await invoke<TodoItem[]>("todo_toggle", { id }));
    } catch (e) {
      console.error("todo_toggle failed:", e);
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    try {
      setItems(await invoke<TodoItem[]>("todo_remove", { id }));
    } catch (e) {
      console.error("todo_remove failed:", e);
    }
  }, []);

  return { items, add, toggle, remove };
}

// ── Lyrics ──

export function useLyrics(enabled: boolean) {
  const [result, setResult] = useState<LyricsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const lastQueryRef = useRef<string>("");

  const fetchFor = useCallback(
    async (title: string, artist: string, durationMs?: number) => {
      if (!enabled || !title) return;
      const key = `${title}|${artist}|${durationMs ?? 0}`;
      if (key === lastQueryRef.current) return;
      lastQueryRef.current = key;
      setLoading(true);
      try {
        const res = await invoke<LyricsResult>("lyrics_get", {
          title,
          artist,
          durationMs: durationMs ?? null,
        });
        setResult(res);
      } catch (e) {
        console.error("lyrics_get failed:", e);
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [enabled]
  );

  const clear = useCallback(() => {
    setResult(null);
    lastQueryRef.current = "";
  }, []);

  return { result, loading, fetchFor, clear };
}

// ── Reminder subscription ──

export function useNusaReminders(
  onReminder: (r: NusaReminder) => void
) {
  const cbRef = useRef(onReminder);
  cbRef.current = onReminder;

  useEffect(() => {
    const unlisten = listen<NusaReminder>("nusa-reminder", (event) => {
      cbRef.current(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
}
