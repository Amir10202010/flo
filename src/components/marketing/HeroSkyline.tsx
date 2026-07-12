/* Washed-out city skyline for the landing hero — an original SVG, not a stock
 * photo. High-key and fog-bound like an overexposed morning: two silhouette
 * layers in the page's own cool grays, a faint window texture on the near
 * layer, and a haze band that dissolves the base into --bg-base so the section
 * blends seamlessly into the page. Purely decorative. */

const FAR =
  'M0 400 V269 h34 v-18 h27 v18 h21 V236 h38 v-24 h12 v24 h20 v33 h30 V218 h44 v51 h24 v-92 h10 l4 -14 4 14 h10 v92 h27 V241 h36 v-30 h26 v30 h18 v28 h33 V204 h12 v-26 h8 l3 -12 3 12 h8 v26 h12 v65 h29 v-38 h40 v38 h22 V222 h38 v47 h25 v-71 h30 v-19 h9 l3 -16 3 16 h9 v19 h30 v71 h24 V235 h42 v34 h20 v-56 h36 v56 h26 V214 h12 v-25 h7 l3 -13 3 13 h7 v25 h12 v55 h31 v-31 h40 v31 h21 V226 h38 v43 h26 v-64 h28 v-20 h8 l3 -15 3 15 h8 v20 h28 v64 h24 V241 h38 v28 h20 v-49 h34 v49 h27 V219 h44 v50 h22 v-31 h36 v31 h24 V245 h32 v24 h22 v-18 h30 v18 h21 v155 Z'

const NEAR =
  'M0 400 V308 h44 v-26 h34 v26 h20 V262 h12 v-16 h32 v16 h12 v46 h26 V241 h10 v-18 h44 v18 h10 v67 h30 v-38 h14 V216 h6 l3 -38 3 38 h6 v54 h14 v38 h26 V273 h48 v-42 h12 v42 h14 v35 h30 v-62 h10 v-25 h15 l3 -20 3 20 h15 v25 h10 v62 h24 v-27 h46 v27 h22 V254 h12 v-20 h40 v20 h12 v54 h30 v-83 h8 v-18 h13 l2 -30 2 30 h13 v18 h8 v83 h26 v-33 h52 v33 h20 V259 h12 v-24 h38 v24 h12 v49 h30 v-70 h10 v-22 h14 l3 -26 3 26 h14 v22 h10 v70 h24 v-30 h48 v30 h22 V251 h12 v-19 h42 v19 h12 v57 h28 v-40 h50 v40 h22 V266 h44 v42 h26 v-24 h40 v24 h20 v-30 h38 v122 Z'

export default function HeroSkyline() {
  return (
    <div className="hero-skyline" aria-hidden>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1600 400"
        preserveAspectRatio="xMidYMax slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* faint vertical window texture, only readable up close */}
          <pattern id="skyWin" width="14" height="20" patternUnits="userSpaceOnUse">
            <rect x="4" y="5" width="4" height="9" fill="#FFFFFF" opacity="0.34" />
          </pattern>
          <linearGradient id="skyHazeTop" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--bg-base, #F6F8FE)" stopOpacity="1" />
            <stop offset="1" stopColor="var(--bg-base, #F6F8FE)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="skyHazeBase" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--bg-base, #F6F8FE)" stopOpacity="0" />
            <stop offset="0.72" stopColor="var(--bg-base, #F6F8FE)" stopOpacity="0.9" />
            <stop offset="1" stopColor="var(--bg-base, #F6F8FE)" stopOpacity="1" />
          </linearGradient>
          <filter id="skyBlur" x="-4%" y="-4%" width="108%" height="108%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
        </defs>

        {/* distant bank of towers — lighter, softened by atmosphere */}
        <path d={FAR} fill="#E4E8F8" filter="url(#skyBlur)" />

        {/* near skyline + its window texture */}
        <path d={NEAR} fill="#D9DEF3" />
        <path d={NEAR} fill="url(#skyWin)" />

        {/* fog: melt the tower tops into the sky, and the base into the page */}
        <rect x="0" y="150" width="1600" height="130" fill="url(#skyHazeTop)" opacity="0.55" />
        <rect x="0" y="268" width="1600" height="132" fill="url(#skyHazeBase)" />
      </svg>
    </div>
  )
}
