import { useState, useCallback, useRef } from "react";

/**
 * NotchBot — a tiny decorative robot mascot for the idle notch row.
 * Purely playful: it idles with a soft bob, blinks its LED eyes every few
 * seconds, and does a little jump/wiggle when clicked. It is NOT an AI
 * assistant and opens no panel.
 */
export function NotchBot({ size = 22 }: { size?: number }) {
  const [isJumping, setIsJumping] = useState(false);
  const jumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleJump = useCallback(() => {
    if (isJumping) return;
    setIsJumping(true);
    if (jumpTimer.current) clearTimeout(jumpTimer.current);
    jumpTimer.current = setTimeout(() => setIsJumping(false), 650);
  }, [isJumping]);

  return (
    <button
      className={`notch-bot${isJumping ? " jumping" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        handleJump();
      }}
      title="Neko"
      aria-label="Nectar bot"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Antenna */}
        <g className="notch-bot-antenna">
          <line x1="16" y1="6" x2="16" y2="9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="16" cy="4.6" r="1.9" fill="currentColor" />
        </g>

        {/* Ears */}
        <rect x="5.2" y="13" width="2.8" height="7" rx="1.4" fill="currentColor" opacity="0.55" />
        <rect x="24" y="13" width="2.8" height="7" rx="1.4" fill="currentColor" opacity="0.55" />

        {/* Head */}
        <rect
          x="8.5"
          y="9.5"
          width="15"
          height="13.5"
          rx="4.4"
          fill="currentColor"
          opacity="0.92"
        />
        {/* Face plate */}
        <rect
          x="10.6"
          y="12.2"
          width="10.8"
          height="8.2"
          rx="2.8"
          fill="rgba(0,0,0,0.55)"
        />

        {/* Eyes (blink via scaleY) */}
        <g className="notch-bot-eyes">
          <rect x="13" y="14.9" width="2.2" height="3" rx="1.1" fill="#9be8ff" />
          <rect x="16.8" y="14.9" width="2.2" height="3" rx="1.1" fill="#9be8ff" />
        </g>

        {/* Little smile */}
        <path
          d="M14.4 18.9c.5.55 1.1.8 1.6.8s1.1-.25 1.6-.8"
          stroke="#9be8ff"
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity="0.8"
        />

        {/* Feet */}
        <rect x="11.6" y="23.4" width="3.4" height="2.6" rx="1.3" fill="currentColor" opacity="0.7" />
        <rect x="17" y="23.4" width="3.4" height="2.6" rx="1.3" fill="currentColor" opacity="0.7" />
      </svg>
    </button>
  );
}
