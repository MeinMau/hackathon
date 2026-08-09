"use client";

import { useEffect, useState } from "react";
import Terminal from "../components/Terminal/Terminal";
import PenguinAscii from "../components/PenguinAscii/PenguinAscii";
import styles from "./page.module.css";

export default function Home() {
  const [isSplashVisible, setIsSplashVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsSplashVisible(false);
    }, 2200);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <main className={styles.page}>
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
