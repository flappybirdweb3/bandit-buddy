interface Props {
  size?: number;
  className?: string;
}

export function BorderCollieIcon({ size = 80, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* ── Body ── */}
      <ellipse cx="40" cy="56" rx="26" ry="20" fill="#212121" />
      <ellipse cx="40" cy="54" rx="14" ry="12" fill="#FAFAFA" />

      {/* ── Tail ── */}
      <path d="M64 52 Q76 44 72 36" stroke="#212121" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M64 52 Q76 44 72 36" stroke="#FAFAFA" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.5" />

      {/* ── Legs ── */}
      <rect x="26" y="68" width="8" height="12" rx="4" fill="#212121" />
      <rect x="46" y="68" width="8" height="12" rx="4" fill="#212121" />

      {/* ── Head ── */}
      <ellipse cx="40" cy="32" rx="22" ry="22" fill="#212121" />
      {/* White snout area */}
      <ellipse cx="40" cy="38" rx="12" ry="10" fill="#FAFAFA" />
      {/* White forehead blaze */}
      <ellipse cx="40" cy="22" rx="7" ry="9" fill="#FAFAFA" />

      {/* ── Ears ── */}
      {/* Left ear (folded forward) */}
      <path d="M20 24 Q14 12 22 10 Q28 16 26 28 Z" fill="#212121" />
      <path d="M22 24 Q18 16 22 13 Q26 17 24 26 Z" fill="#4A3728" />
      {/* Right ear */}
      <path d="M60 24 Q66 12 58 10 Q52 16 54 28 Z" fill="#212121" />
      <path d="M58 24 Q62 16 58 13 Q54 17 56 26 Z" fill="#4A3728" />

      {/* ── Eyes ── */}
      <circle cx="33" cy="28" r="6" fill="white" />
      <circle cx="47" cy="28" r="6" fill="white" />
      <circle cx="34" cy="28" r="4" fill="#795548" />
      <circle cx="48" cy="28" r="4" fill="#795548" />
      <circle cx="34" cy="28" r="2.5" fill="#111" />
      <circle cx="48" cy="28" r="2.5" fill="#111" />
      <circle cx="35" cy="27" r="1.2" fill="white" />
      <circle cx="49" cy="27" r="1.2" fill="white" />

      {/* ── Nose ── */}
      <ellipse cx="40" cy="36" rx="4" ry="3" fill="#111" />
      <ellipse cx="39" cy="35" rx="1.5" ry="1" fill="#424242" opacity="0.6" />

      {/* ── Mouth ── */}
      <path d="M36 39 Q40 43 44 39" stroke="#424242" strokeWidth="1.5" fill="none" strokeLinecap="round" />

      {/* ── Red Bandit Bandana ── */}
      <path d="M18 46 Q40 52 62 46 Q64 54 40 58 Q16 54 18 46 Z" fill="#C62828" />
      <path d="M18 46 Q40 44 62 46" stroke="#B71C1C" strokeWidth="1" fill="none" />
      {/* Bandana knot on side */}
      <ellipse cx="66" cy="50" rx="5" ry="4" fill="#B71C1C" transform="rotate(20 66 50)" />
      <path d="M64 48 Q70 44 69 52" stroke="#B71C1C" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Bandana pattern dots */}
      <circle cx="32" cy="50" r="1.5" fill="#EF9A9A" opacity="0.6" />
      <circle cx="40" cy="52" r="1.5" fill="#EF9A9A" opacity="0.6" />
      <circle cx="50" cy="50" r="1.5" fill="#EF9A9A" opacity="0.6" />

      {/* ── Alert eyebrow lines ── */}
      <path d="M28 22 Q33 19 38 22" stroke="#FAFAFA" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M42 22 Q47 19 52 22" stroke="#FAFAFA" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* ── Outline ── */}
      <ellipse cx="40" cy="32" rx="22" ry="22" fill="none" stroke="#111" strokeWidth="1.5" />
    </svg>
  );
}
