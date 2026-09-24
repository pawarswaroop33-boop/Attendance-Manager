import React from 'react';

export const StudentStudyIllustration: React.FC<{ className?: string }> = ({ className = "w-full h-48 sm:h-52" }) => {
  return (
    <div className={`flex items-center justify-center select-none pointer-events-none ${className}`}>
      <svg
        viewBox="0 0 320 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full max-h-[220px] object-contain drop-shadow-xs"
      >
        <defs>
          <linearGradient id="blobGrad" x1="0" y1="0" x2="320" y2="220" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EEF2FF" />
            <stop offset="100%" stopColor="#E0F2FE" />
          </linearGradient>
          <linearGradient id="yellowShirt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#EAB308" />
          </linearGradient>
          <linearGradient id="redPants" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FB7185" />
            <stop offset="100%" stopColor="#E11D48" />
          </linearGradient>
        </defs>

        {/* Soft Organic Backdrop Blob (as seen in image) */}
        <path
          d="M 160 18 C 235 12, 285 55, 275 125 C 265 195, 210 208, 150 205 C 90 202, 35 178, 45 110 C 55 42, 85 24, 160 18 Z"
          fill="url(#blobGrad)"
        />

        {/* ================= LEFT STUDENT (Yellow Shirt, Studying at Desk) ================= */}
        <g id="left-student">
          {/* Chair Legs & Frame */}
          <path d="M 68 150 L 68 200" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
          <path d="M 112 150 L 112 200" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
          {/* Chair Back */}
          <path d="M 66 120 L 66 155" stroke="#1E293B" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M 64 125 C 64 125, 78 122, 92 122" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />

          {/* Dark Charcoal Pants / Legs */}
          <path
            d="M 68 152 C 68 145, 80 142, 100 142 C 122 142, 132 152, 126 182 C 124 192, 118 202, 112 202 C 108 202, 102 188, 98 175 C 95 188, 90 202, 85 202 C 78 202, 72 178, 68 152 Z"
            fill="#1E293B"
          />

          {/* Torso & Yellow T-Shirt */}
          <path
            d="M 72 90 C 72 75, 85 68, 102 68 C 122 68, 134 76, 132 94 L 126 144 C 120 146, 78 146, 72 144 Z"
            fill="url(#yellowShirt)"
          />

          {/* Left Arm leaning forward */}
          <path
            d="M 80 82 C 70 85, 52 100, 50 115 C 48 126, 56 128, 70 126 L 82 124"
            fill="#FACC15"
          />
          {/* Right Arm leaning on desk writing */}
          <path
            d="M 124 84 C 134 90, 142 106, 140 120 C 138 126, 126 128, 114 127 L 102 125"
            fill="#EAB308"
          />

          {/* Hands on Desk */}
          <ellipse cx="78" cy="125" rx="5" ry="4" fill="#FBBF24" />
          <ellipse cx="112" cy="126" rx="5" ry="4" fill="#FBBF24" />

          {/* Head & Face (tilted down towards paper) */}
          <ellipse cx="102" cy="58" rx="14" ry="16" fill="#FED7AA" />
          {/* Dark Hair (touseled/parted as in image) */}
          <path
            d="M 88 56 C 88 42, 94 36, 106 36 C 118 36, 122 44, 120 54 C 114 48, 108 46, 100 48 C 94 50, 90 54, 88 56 Z"
            fill="#0F172A"
          />
          <path
            d="M 94 40 C 100 34, 112 34, 118 42 C 114 42, 108 40, 102 42 Z"
            fill="#334155"
          />

          {/* Left Desk (Black minimal desk) */}
          <rect x="42" y="124" width="94" height="6" rx="2" fill="#0F172A" />
          <path d="M 46 130 L 46 195" stroke="#0F172A" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M 132 130 L 132 195" stroke="#0F172A" strokeWidth="3.5" strokeLinecap="round" />
          {/* Desk cross-support bar */}
          <path d="M 46 172 L 132 172" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
          {/* Paper on desk */}
          <rect x="74" y="122" width="30" height="4" rx="1" fill="#FFFFFF" opacity="0.9" />
        </g>

        {/* ================= RIGHT STUDENT (Dark Blazer, Red Pants, Writing) ================= */}
        <g id="right-student">
          {/* Chair Legs & Frame */}
          <path d="M 188 150 L 188 200" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
          <path d="M 232 150 L 232 200" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
          {/* Chair Back */}
          <path d="M 234 120 L 234 155" stroke="#1E293B" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M 208 122 C 220 122, 234 125, 234 125" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />

          {/* Vibrant Coral/Red Pants (from the image) */}
          <path
            d="M 188 145 C 188 145, 196 142, 210 142 C 225 142, 234 146, 234 155 C 234 175, 226 202, 220 202 C 214 202, 212 182, 210 172 C 208 182, 204 202, 198 202 C 190 202, 186 175, 188 145 Z"
            fill="url(#redPants)"
          />

          {/* Yellow undershirt peaking out */}
          <path d="M 204 88 L 216 88 L 212 110 L 206 110 Z" fill="#FACC15" />

          {/* Dark Blazer / Cardigan Torso */}
          <path
            d="M 188 90 C 188 74, 198 68, 212 68 C 226 68, 236 74, 236 90 L 234 144 C 224 146, 198 146, 188 144 Z"
            fill="#1E293B"
          />

          {/* Left & Right Arms (bent writing posture) */}
          <path
            d="M 190 84 C 180 90, 172 105, 174 120 C 176 126, 188 128, 200 127 L 206 124"
            fill="#334155"
          />
          <path
            d="M 234 84 C 244 90, 250 105, 248 120 C 246 126, 234 128, 222 127 L 216 124"
            fill="#1E293B"
          />

          {/* Hand holding pen */}
          <ellipse cx="206" cy="125" rx="5" ry="4" fill="#FED7AA" />
          <path d="M 208 122 L 212 118" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" />

          {/* Head & Face tilted down */}
          <ellipse cx="212" cy="58" rx="14" ry="16" fill="#FED7AA" />
          {/* Hair Bun / Styled Hair as in image */}
          <path
            d="M 198 56 C 198 42, 204 36, 216 36 C 228 36, 232 44, 230 54 C 224 48, 218 46, 210 48 C 204 50, 200 54, 198 56 Z"
            fill="#0F172A"
          />
          {/* Hair bun at top */}
          <circle cx="218" cy="34" r="7" fill="#0F172A" />

          {/* Right Desk (Black minimal desk) */}
          <rect x="164" y="124" width="94" height="6" rx="2" fill="#0F172A" />
          <path d="M 168 130 L 168 195" stroke="#0F172A" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M 254 130 L 254 195" stroke="#0F172A" strokeWidth="3.5" strokeLinecap="round" />
          {/* Desk cross-support bar */}
          <path d="M 168 172 L 254 172" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
          {/* Paper / Notebook on desk */}
          <rect x="194" y="122" width="32" height="4" rx="1" fill="#FFFFFF" opacity="0.95" />
        </g>
      </svg>
    </div>
  );
};
