import Image from "next/image";
import styles from "./auth-garden-visual.module.css";

/** Decorative account-page art. The form remains the accessible content focus. */
export function AuthGardenVisual() {
  return (
    <aside className={styles.scene} aria-hidden="true">
      <Image
        src="/images/auth-flower-field-v2.png"
        alt=""
        fill
        priority
        unoptimized
        sizes="(min-width: 1280px) 52vw, (min-width: 1024px) 48vw, 0px"
        className={styles.photo}
      />
      <div className={styles.light} />
      <div className={styles.frame} />
    </aside>
  );
}
