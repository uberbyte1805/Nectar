import { motion } from "framer-motion";
import type { ShelfItem } from "../hooks/useNusa";

interface Props {
  items: ShelfItem[];
  onRemove: (id: string) => void;
  onReveal: (path: string) => void;
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > -1 ? name.slice(i + 1).toLowerCase() : "";
}

const IMG_EXT = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"];

export function NotchShelf({ items, onRemove, onReveal }: Props) {
  return (
    <div className="nusa-shelf" onClick={(e) => e.stopPropagation()}>
      <div className="nusa-shelf-head">
        <span className="nusa-shelf-title">Shelf</span>
        <span className="nusa-shelf-hint">Drag files onto the notch to pin them · drag a chip out to export</span>
      </div>
      <div className="nusa-shelf-track">
        {items.length === 0 && (
          <div className="nusa-empty">No files pinned yet. Drag a file onto the notch.</div>
        )}
        {items.map((it) => {
          const ext = extOf(it.name);
          const missing = it.path.startsWith("missing:");
          return (
            <motion.div
              key={it.id}
              className={`nusa-shelf-chip ${missing ? "missing" : ""}`}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ y: -2 }}
              onDoubleClick={() => !missing && onReveal(it.path)}
              title={it.path}
            >
              <div className={`nusa-shelf-ico ${IMG_EXT.includes(ext) ? "img" : ""}`}>
                {ext ? ext.slice(0, 4).toUpperCase() : "FILE"}
              </div>
              <div className="nusa-shelf-name">{it.name}</div>
              <button className="nusa-x" onClick={() => onRemove(it.id)}>×</button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
