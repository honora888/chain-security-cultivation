import styles from "./quest-1.module.css";

interface WaterFormationSigilProps {
  active: boolean;
}

const TICKS = Array.from({ length: 12 }, (_, index) => index * 30);
const WATER_RUNES = Array.from({ length: 8 }, (_, index) => index * 45);
const CARDINAL_SEALS = [
  { x: 190, y: 44 },
  { x: 326, y: 180 },
  { x: 190, y: 316 },
  { x: 54, y: 180 },
];

export function WaterFormationSigil({ active }: WaterFormationSigilProps) {
  return (
    <section
      className={`${styles.waterFormation} ${active ? styles.waterFormationActive : ""}`}
      aria-label="水灵鉴阵：漏洞类型、五行与风险等级的判断阵盘"
    >
      <p className={styles.waterFormationLabel}>
        水灵鉴阵
        <span>漏洞类型 · 五行 · 风险</span>
      </p>

      <svg
        viewBox="0 0 380 430"
        role="img"
        aria-label="具有右下断口、十二刻度、四方阵印、回流水脉、方形状态玉扣与水台的静态水灵阵盘"
      >
        <title>水灵鉴阵</title>
        <desc>
          深青玉石断环围绕水纹阵法，四方水脉汇聚到方形状态玉扣，双叶闸片与三层
          CEI 方印共同封住垂直递归线。
        </desc>
        <defs>
          <radialGradient id="waterFormationFilm" cx="50%" cy="44%" r="58%">
            <stop offset="0%" stopColor="#e9fffb" stopOpacity="0.82" />
            <stop offset="52%" stopColor="#89d8d2" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#2b7d84" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="waterFormationJade" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#bce8dd" />
            <stop offset="28%" stopColor="#347f82" />
            <stop offset="62%" stopColor="#174e58" />
            <stop offset="100%" stopColor="#79bdb7" />
          </linearGradient>
          <linearGradient id="waterFormationPlatform" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9dd6ce" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#285d62" stopOpacity="0.32" />
          </linearGradient>
          <filter
            id="waterFormationSoftGlow"
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className={styles.waterFormationSupport} aria-hidden="true">
          <ellipse cx="190" cy="374" rx="150" ry="34" />
          <ellipse cx="190" cy="374" rx="126" ry="25" />
          <ellipse cx="190" cy="374" rx="96" ry="17" />
          <path
            d="M49 361c29-25 254-25 282 0v24c-34 28-247 28-282 0Z"
            fill="url(#waterFormationPlatform)"
          />
          {[84, 132, 248, 296].map((x) => (
            <g key={x} transform={`translate(${x} 354)`}>
              <path d="M-7 0h14l4 25-11 8-11-8Z" />
              <rect x="-10" y="-5" width="20" height="7" rx="2" />
            </g>
          ))}
        </g>

        <g className={styles.waterFormationDisc}>
          <circle
            className={styles.waterFormationAura}
            cx="190"
            cy="180"
            r="176"
            fill="url(#waterFormationFilm)"
          />
          <circle className={styles.waterFormationWaterFilm} cx="190" cy="180" r="142" />
          <path
            className={styles.waterFormationBrokenRingShadow}
            d="M92 73A150 150 0 1 1 303 286"
          />
          <path
            className={styles.waterFormationBrokenRing}
            d="M92 73A150 150 0 1 1 303 286"
            stroke="url(#waterFormationJade)"
          />

          {TICKS.map((angle) => (
            <g
              className={styles.waterFormationTick}
              key={angle}
              transform={`rotate(${angle} 190 180)`}
            >
              <path d="M190 12v19" />
              <path d="M184 20h12" />
            </g>
          ))}

          <circle className={styles.waterFormationJadeRingOuter} cx="190" cy="180" r="118" />
          <circle className={styles.waterFormationJadeRingInner} cx="190" cy="180" r="89" />

          <g className={styles.waterFormationVeins}>
            <path d="M190 45c-22 34-21 62 0 88" />
            <path d="M325 180c-35-20-64-18-91 0" />
            <path d="M190 315c21-35 21-63 0-91" />
            <path d="M55 180c35 21 63 19 91 0" />
          </g>

          {CARDINAL_SEALS.map((seal) => (
            <g
              className={styles.waterFormationSeal}
              key={`${seal.x}-${seal.y}`}
              transform={`translate(${seal.x} ${seal.y})`}
            >
              <rect x="-13" y="-13" width="26" height="26" rx="3" />
              <path d="M-7-2h14M-7 4h14M-2-8v16M4-8v16" />
            </g>
          ))}

          {WATER_RUNES.map((angle) => (
            <g
              className={styles.waterFormationRune}
              key={angle}
              transform={`rotate(${angle} 190 180) translate(190 78)`}
            >
              <path d="M-9 1c4-7 8-7 12 0 4 7 8 7 12 0" />
              <path d="M-6 7c3-4 6-4 9 0 3 4 6 4 9 0" />
            </g>
          ))}

          <path
            className={styles.waterFormationFlow}
            d="M112 162c27-55 102-72 150-35 32 25 35 73 6 102-31 31-82 23-97-12-12-29 10-56 40-51"
          />
          <path
            className={styles.waterFormationFlowSecondary}
            d="M268 198c-27 55-102 72-150 35-32-25-35-73-6-102 31-31 82-23 97 12 12 29-10 56-40 51"
          />

          <g
            className={styles.waterFormationCore}
            filter="url(#waterFormationSoftGlow)"
          >
            <rect className={styles.waterFormationCorePlate} x="144" y="134" width="92" height="92" rx="8" />
            <rect x="153" y="143" width="74" height="74" rx="6" />
            <rect x="163" y="153" width="54" height="54" rx="4" />
            <rect x="174" y="164" width="32" height="32" rx="3" />
            <path
              className={styles.waterFormationValve}
              d="M143 159c-22-11-39-5-51 17 16 12 33 14 51 7Z"
            />
            <path
              className={styles.waterFormationValve}
              d="M237 159c22-11 39-5 51 17-16 12-33 14-51 7Z"
            />
            <path
              className={styles.waterFormationSealLine}
              d="M190 137v87M183 151h14M181 180h18M183 209h14"
            />
            <path
              className={styles.waterFormationDrop}
              d="M190 153c-9 13-13 19-13 25a13 13 0 0 0 26 0c0-6-4-12-13-25Z"
            />
          </g>

          <text className={styles.waterFormationWaterGlyph} x="190" y="256">
            水
          </text>
        </g>
      </svg>
    </section>
  );
}
