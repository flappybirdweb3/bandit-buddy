interface Props {
  size?: number;
  className?: string;
  animate?: boolean;
}

export function RaccoonMascot({ size = 160, className = '', animate = false }: Props) {
  const s = size / 160;

  return (
    <svg
      width={size}
      height={size * 1.1}
      viewBox="0 0 160 176"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* ── Tail (behind body) ── */}
      <ellipse cx="128" cy="148" rx="22" ry="12" fill="#9E9E9E" transform="rotate(-30 128 148)" />
      <ellipse cx="128" cy="148" rx="14" ry="7" fill="#424242" transform="rotate(-30 128 148)" />
      <ellipse cx="120" cy="138" rx="18" ry="10" fill="#9E9E9E" transform="rotate(-25 120 138)" />
      <ellipse cx="120" cy="138" rx="11" ry="6" fill="#424242" transform="rotate(-25 120 138)" />
      <ellipse cx="113" cy="130" rx="14" ry="8" fill="#9E9E9E" transform="rotate(-20 113 130)" />

      {/* ── Gold sack ── */}
      <ellipse cx="105" cy="132" rx="22" ry="26" fill="#8D6E63" />
      <ellipse cx="105" cy="132" rx="20" ry="24" fill="#A1887F" />
      {/* Sack tie */}
      <rect x="96" y="108" width="18" height="8" rx="4" fill="#6D4C41" />
      {/* Rope */}
      <path d="M100 108 Q105 103 110 108" stroke="#5D4037" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Coins peeking */}
      <circle cx="98" cy="128" r="8" fill="#FFD600" />
      <circle cx="98" cy="128" r="6" fill="#FFC107" />
      <circle cx="98" cy="128" r="4" fill="#FFD600" />
      <text x="96" y="131" fontSize="7" fill="#E65100" fontWeight="bold" fontFamily="Arial">$</text>
      <circle cx="113" cy="135" r="7" fill="#FFD600" />
      <circle cx="113" cy="135" r="5" fill="#FFC107" />
      <circle cx="113" cy="135" r="3.5" fill="#FFD600" />
      <text x="111" y="138" fontSize="6" fill="#E65100" fontWeight="bold" fontFamily="Arial">$</text>

      {/* ── Straw Hat (behind head) ── */}
      {/* Brim */}
      <ellipse cx="80" cy="44" rx="52" ry="12" fill="#F9A825" />
      <ellipse cx="80" cy="44" rx="52" ry="12" fill="none" stroke="#E65100" strokeWidth="2" />
      {/* Crown */}
      <path d="M46 44 Q46 10 80 10 Q114 10 114 44 Z" fill="#FDD835" />
      <path d="M46 44 Q46 10 80 10 Q114 10 114 44 Z" fill="none" stroke="#E65100" strokeWidth="2" />
      {/* Hat band */}
      <path d="M48 40 Q80 34 112 40" stroke="#8B4513" strokeWidth="5" fill="none" strokeLinecap="round" />
      {/* Straw texture lines */}
      <line x1="60" y1="40" x2="65" y2="12" stroke="#F9A825" strokeWidth="1" opacity="0.6" />
      <line x1="75" y1="38" x2="78" y2="10" stroke="#F9A825" strokeWidth="1" opacity="0.6" />
      <line x1="90" y1="38" x2="88" y2="10" stroke="#F9A825" strokeWidth="1" opacity="0.6" />
      <line x1="103" y1="40" x2="100" y2="13" stroke="#F9A825" strokeWidth="1" opacity="0.6" />
      {/* Little straw sprigs */}
      <path d="M58 10 Q56 4 62 6" stroke="#FDD835" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M80 10 Q79 3 85 5" stroke="#FDD835" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M100 11 Q103 4 107 7" stroke="#FDD835" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* ── Head ── */}
      <ellipse cx="80" cy="88" rx="46" ry="48" fill="#BDBDBD" />
      {/* Darker fur on top/sides */}
      <ellipse cx="80" cy="72" rx="36" ry="22" fill="#9E9E9E" />
      {/* Ear left */}
      <ellipse cx="42" cy="58" rx="14" ry="16" fill="#9E9E9E" />
      <ellipse cx="42" cy="58" rx="8" ry="10" fill="#F48FB1" />
      {/* Ear right */}
      <ellipse cx="118" cy="58" rx="14" ry="16" fill="#9E9E9E" />
      <ellipse cx="118" cy="58" rx="8" ry="10" fill="#F48FB1" />

      {/* Cheek fur (fluffy white) */}
      <ellipse cx="56" cy="100" rx="18" ry="14" fill="#EEEEEE" />
      <ellipse cx="104" cy="100" rx="18" ry="14" fill="#EEEEEE" />

      {/* ── Bandit mask ── */}
      <path d="M34 82 Q80 74 126 82 Q126 102 80 102 Q34 102 34 82 Z" fill="#212121" />
      {/* Mask outline */}
      <path d="M34 82 Q80 74 126 82 Q126 102 80 102 Q34 102 34 82 Z" fill="none" stroke="#111" strokeWidth="1.5" />

      {/* ── Eyes ── */}
      {/* Left eye (open, gleaming) */}
      <ellipse cx="62" cy="88" rx="13" ry="13" fill="white" />
      <circle cx="64" cy="89" r="9" fill="#1B5E20" />
      <circle cx="65" cy="89" r="6" fill="#33691E" />
      <circle cx="65" cy="89" r="3.5" fill="#111" />
      <circle cx="67" cy="87" r="2" fill="white" />
      {/* Right eye (winking — closed with lashes) */}
      <path d="M87 88 Q98 82 109 88" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
      <line x1="92" y1="85" x2="90" y2="81" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="98" y1="83" x2="98" y2="79" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="104" y1="85" x2="106" y2="81" stroke="white" strokeWidth="1.5" strokeLinecap="round" />

      {/* ── Nose ── */}
      <ellipse cx="80" cy="106" rx="7" ry="5" fill="#424242" />
      <ellipse cx="78" cy="105" rx="2.5" ry="1.5" fill="#616161" opacity="0.6" />

      {/* ── Mouth (sly smirk) ── */}
      <path d="M72 112 Q80 120 92 113" stroke="#424242" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M88 113 Q94 112 96 116" stroke="#424242" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* ── Whiskers ── */}
      <line x1="80" y1="108" x2="42" y2="103" stroke="#757575" strokeWidth="1.2" opacity="0.8" />
      <line x1="80" y1="110" x2="42" y2="112" stroke="#757575" strokeWidth="1.2" opacity="0.8" />
      <line x1="80" y1="108" x2="118" y2="103" stroke="#757575" strokeWidth="1.2" opacity="0.8" />
      <line x1="80" y1="110" x2="118" y2="112" stroke="#757575" strokeWidth="1.2" opacity="0.8" />

      {/* ── Body ── */}
      <ellipse cx="80" cy="152" rx="36" ry="28" fill="#BDBDBD" />
      {/* Body fur stripe */}
      <ellipse cx="80" cy="150" rx="20" ry="18" fill="#EEEEEE" />

      {/* ── Left arm (holding sack) ── */}
      <path d="M52 130 Q40 140 56 155" stroke="#9E9E9E" strokeWidth="14" fill="none" strokeLinecap="round" />
      {/* Hand */}
      <ellipse cx="56" cy="155" rx="10" ry="8" fill="#BDBDBD" />

      {/* ── Right arm (raised, pointing) ── */}
      <path d="M108 130 Q124 120 118 108" stroke="#9E9E9E" strokeWidth="12" fill="none" strokeLinecap="round" />
      {/* Hand / pointing finger */}
      <ellipse cx="118" cy="108" rx="8" ry="7" fill="#BDBDBD" />
      <ellipse cx="122" cy="102" rx="4" ry="7" fill="#BDBDBD" transform="rotate(15 122 102)" />

      {/* ── Sparkle effects on coins ── */}
      <g opacity="0.9">
        <line x1="90" y1="120" x2="90" y2="114" stroke="#FFD600" strokeWidth="1.5" />
        <line x1="87" y1="117" x2="93" y2="117" stroke="#FFD600" strokeWidth="1.5" />
        <line x1="88" y1="115" x2="92" y2="119" stroke="#FFD600" strokeWidth="1" />
        <line x1="92" y1="115" x2="88" y2="119" stroke="#FFD600" strokeWidth="1" />
      </g>
      <g opacity="0.7">
        <line x1="122" y1="125" x2="122" y2="121" stroke="#FFD600" strokeWidth="1.2" />
        <line x1="120" y1="123" x2="124" y2="123" stroke="#FFD600" strokeWidth="1.2" />
      </g>

      {/* ── Thick outline on head ── */}
      <ellipse cx="80" cy="88" rx="46" ry="48" fill="none" stroke="#212121" strokeWidth="2.5" />
      <ellipse cx="42" cy="58" rx="14" ry="16" fill="none" stroke="#212121" strokeWidth="2" />
      <ellipse cx="118" cy="58" rx="14" ry="16" fill="none" stroke="#212121" strokeWidth="2" />
    </svg>
  );
}
