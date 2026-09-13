import Image from "next/image";
import type { CSSProperties } from "react";
import styles from "./auth-wind-field.module.css";

const grassBlades = [
  ["2%", "31%", "-4deg", "0s", "6.8s", "far"],
  ["8%", "39%", "3deg", "-1.8s", "7.4s", "near"],
  ["15%", "27%", "-2deg", "-3.2s", "6.1s", "mid"],
  ["21%", "47%", "4deg", "-0.9s", "8.1s", "near"],
  ["28%", "33%", "-3deg", "-2.5s", "6.6s", "mid"],
  ["35%", "43%", "2deg", "-4.1s", "7.7s", "far"],
  ["42%", "30%", "-5deg", "-1.4s", "6.3s", "mid"],
  ["49%", "54%", "3deg", "-3.7s", "8.4s", "near"],
  ["55%", "36%", "-2deg", "-2.1s", "6.9s", "far"],
  ["61%", "48%", "5deg", "-4.6s", "7.2s", "mid"],
  ["67%", "29%", "-3deg", "-0.5s", "6.2s", "far"],
  ["72%", "57%", "3deg", "-2.9s", "8.6s", "near"],
  ["78%", "38%", "-4deg", "-1.2s", "7.1s", "mid"],
  ["84%", "51%", "2deg", "-3.5s", "8.2s", "near"],
  ["90%", "34%", "-3deg", "-1.7s", "6.5s", "far"],
  ["96%", "45%", "4deg", "-4.3s", "7.8s", "mid"],
] as const;

/** A decorative login scene. All movement is CSS-only and respects reduced motion. */
export function AuthWindField() {
  return (
    <aside className={styles.scene} aria-hidden="true">
      <Image
        src="/images/shipbrief-wind-field.png"
        alt=""
        fill
        sizes="(min-width: 1024px) 52vw, 0px"
        className={styles.photo}
      />
      <div className={styles.colorWash} />

      <svg className={styles.windLines} viewBox="0 0 100 100" preserveAspectRatio="none">
        <path className={styles.windLine} d="M-6 43C15 33 25 48 45 39S71 28 107 36" />
        <path className={`${styles.windLine} ${styles.windLineDelayed}`} d="M-8 58C12 47 27 61 43 53S71 43 109 51" />
        <path className={`${styles.windLine} ${styles.windLineSoft}`} d="M-3 27C17 19 29 31 48 24S75 17 104 24" />
      </svg>

      <svg className={styles.rotor} viewBox="0 0 100 100" role="presentation">
        <g>
          <circle cx="50" cy="50" r="6" />
          <path d="M52.5 46.2C59 34.5 71.5 25 88 21.8C75.6 36.5 64.7 45 53.7 51.2Z" />
          <path d="M47.2 52.2C38.4 62.5 34.2 77.4 37.5 93.5C48.6 77.7 54.8 64.8 52.2 53.8Z" />
          <path d="M46 48.5C33 43.1 18.4 43.4 5.4 50.5C23.8 55.1 38.1 55.3 48.7 52.9Z" />
        </g>
      </svg>

      <div className={styles.grass}>
        {grassBlades.map(([left, height, lean, delay, duration, depth]) => (
          <span
            key={`${left}-${height}`}
            className={`${styles.grassBlade} ${styles[depth]}`}
            style={
              {
                left,
                height,
                "--field-lean": lean,
                "--field-delay": delay,
                "--field-duration": duration,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className={styles.lockup}>
        <Image src="/brand/shipbrief-flower-mark-v1.png" alt="" width={1247} height={1261} sizes="72px" className={styles.lockupMark} />
        <span>ShipBrief</span>
      </div>
      <p className={styles.caption}>Every release has somewhere to go.</p>
    </aside>
  );
}
