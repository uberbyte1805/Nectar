import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { LyricsResult } from "../hooks/useNusa";

interface Props {
  result: LyricsResult | null;
  loading: boolean;
  positionMs: number;
  title: string;
  artist: string;
  onSeek: (ms: number) => void;
}

export function NotchLyrics({ result, loading, positionMs, title, artist, onSeek }: Props) {
  const activeRef = useRef<HTMLDivElement>(null);

  // Find the active line index from playback position.
  let activeIdx = -1;
  if (result?.synced) {
    for (let i = 0; i < result.lines.length; i++) {
      if (result.lines[i].time_ms <= positionMs) activeIdx = i;
      else break;
    }
  }

  // Keep the active line in view.
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [activeIdx]);

  const header = (
    <div className="nusa-lyrics-head">
      <span className="nusa-lyrics-title">{title || "Nothing playing"}</span>
      {artist && <span className="nusa-lyrics-artist">{artist}</span>}
    </div>
  );

  if (loading && !result) {
    return (
      <div className="nusa-lyrics" onClick={(e) => e.stopPropagation()}>
        {header}
        <div className="nusa-empty">Finding lyrics…</div>
      </div>
    );
  }

  if (!result || result.lines.length === 0) {
    return (
      <div className="nusa-lyrics" onClick={(e) => e.stopPropagation()}>
        {header}
        <div className="nusa-empty">No lyrics found</div>
      </div>
    );
  }

  return (
    <div className="nusa-lyrics" onClick={(e) => e.stopPropagation()}>
      {header}
      <div className="nusa-lyrics-scroll">
        {result.lines.map((line, i) => {
          const isActive = i === activeIdx && result.synced;
          return (
            <motion.div
              key={`${line.time_ms}-${i}`}
              ref={isActive ? activeRef : undefined}
              className={`nusa-lyrics-line ${isActive ? "on" : ""} ${!result.synced ? "plain" : ""}`}
              animate={{ scale: isActive ? 1 : 0.98, opacity: isActive ? 1 : 0.55 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              onClick={() => result.synced && line.time_ms >= 0 && onSeek(line.time_ms)}
            >
              {line.text}
            </motion.div>
          );
        })}
      </div>
      {!result.synced && (
        <div className="nusa-lyrics-note">Unsynced lyrics — timings unavailable</div>
      )}
    </div>
  );
}
