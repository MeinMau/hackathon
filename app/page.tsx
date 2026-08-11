import Terminal from "../components/Terminal/Terminal";
import PenguinAscii from "../components/PenguinAscii/PenguinAscii";
import AnimatedNumberCountdown from "../components/Countdown/AnimatedNumberCountdown";
import styles from "./page.module.css";

const countdownEndDate = "2026-09-03T08:00:00-06:00";

export default function Home() {
  return (
    <>
      <main className={styles.page}>
        <section className={styles.countdownPanel} aria-label="Countdown">
          <AnimatedNumberCountdown endDate={countdownEndDate} />
        </section>

        <div className={styles.terminalPanel}>
          <Terminal />
        </div>

        <div className={styles.asciiPanel}>
          <PenguinAscii />
        </div>
      </main>
    </>
  );
}
