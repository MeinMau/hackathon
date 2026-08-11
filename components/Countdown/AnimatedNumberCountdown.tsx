import styles from "./AnimatedNumberCountdown.module.css";

interface CountdownProps {
  endDate: Date | string | number;
  className?: string;
}

const countdownId = "hackathon-countdown";

export default function AnimatedNumberCountdown({
  endDate,
  className = "",
}: CountdownProps) {
  const endTime = new Date(endDate).getTime();

  return (
    <div
      id={countdownId}
      className={`${styles.countdown} ${className}`}
      data-end-time={endTime}
    >
      <div className={styles.segmentGroup}>
        <div className={styles.segment}>
          <span className={styles.number} data-countdown="days">
            00
          </span>
          <span className={styles.label}>Days</span>
        </div>
      </div>

      <div className={styles.segmentGroup}>
        <div className={styles.separator}>:</div>
        <div className={styles.segment}>
          <span className={styles.number} data-countdown="hours">
            00
          </span>
          <span className={styles.label}>Hours</span>
        </div>
      </div>

      <div className={styles.segmentGroup}>
        <div className={styles.separator}>:</div>
        <div className={styles.segment}>
          <span className={styles.number} data-countdown="minutes">
            00
          </span>
          <span className={styles.label}>Minutes</span>
        </div>
      </div>

      <div className={styles.segmentGroup}>
        <div className={styles.separator}>:</div>
        <div className={styles.segment}>
          <span className={styles.number} data-countdown="seconds">
            00
          </span>
          <span className={styles.label}>Seconds</span>
        </div>
      </div>

    </div>
  );
}
