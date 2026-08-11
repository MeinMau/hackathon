import Image from "next/image";
import Terminal from "../components/Terminal/Terminal";
import PenguinAscii from "../components/PenguinAscii/PenguinAscii";
import AnimatedNumberCountdown from "../components/Countdown/AnimatedNumberCountdown";
import clicksPhoto from "../public/clicksphoto.png";
import ingeniaLogo from "../public/ingenia-logo.png";
import serpentinas from "../public/serpentinas.png";
import styles from "./page.module.css";

const countdownEndDate = "2026-09-03T08:00:00-06:00";

export default function Home() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="#">
          <Image src={ingeniaLogo} alt="Ingenia" priority />
        </a>
        <nav className={styles.navPill} aria-label="Main navigation">
          <a href="#brief">Platform</a>
          <a href="#brief">Solutions</a>
          <a href="#brief">Use Cases</a>
          <a href="#terminal">Resources</a>
          <a href="#brief">Plans</a>
          <a href="#terminal">Terminal</a>
        </nav>
        <a className={styles.navAction} href="#terminal">
          Schedule a Demo
        </a>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <h1>
            BORN FROM
            <br />
            THE AI ERA.
            <br />
            NOT BOLTED
            <br />
            ONTO IT.
          </h1>
          <p>
            Hackathon ISND reune ingenieria, negocio e inteligencia artificial.
            Construye un prototipo listo para demo antes de que el reloj llegue
            a cero.
          </p>
        </div>

        <div className={styles.heroCountdown} aria-label="Countdown">
          <Image
            className={`${styles.countdownDecoration} ${styles.clicksPhoto}`}
            src={clicksPhoto}
            alt=""
            aria-hidden="true"
            priority
          />
          <Image
            className={`${styles.countdownDecoration} ${styles.serpentinas}`}
            src={serpentinas}
            alt=""
            aria-hidden="true"
            priority
          />
          <span className={styles.monoLabel}>TIME REMAINING</span>
          <AnimatedNumberCountdown endDate={countdownEndDate} />
          <p>3 de septiembre de 2026, 8:00 AM</p>
        </div>
      </section>

      <section id="brief" className={styles.cardGrid}>
        <article className={styles.card}>
          <span className={styles.mintTag}>01 / BUILD</span>
          <h2>Ideas que aterrizan en producto</h2>
          <p>
            El reto se enfoca en convertir problemas de negocio en prototipos
            funcionales con una narrativa clara.
          </p>
        </article>

        <article className={styles.card}>
          <span className={styles.mintTag}>02 / PRESENT</span>
          <h2>Demo, criterio y ejecucion</h2>
          <p>
            Cada equipo prepara una propuesta que pueda explicarse rapido,
            defenderse con datos y sentirse lista para usuarios reales.
          </p>
        </article>

        <article className={styles.invertedCard}>
          <span className={styles.yellowMark}>LIVE SYSTEM</span>
          <h2>Modo terminal activado</h2>
          <p>
            La estetica mantiene el caracter tecnico del proyecto original,
            ahora dentro de un showroom editorial.
          </p>
        </article>
      </section>

      <section id="terminal" className={styles.terminalShowroom}>
        <div className={styles.terminalCopy}>
          <span className={styles.monoLabel}>INTERFACE / 03</span>
          <h2>BRUTALIST COMMAND CENTER</h2>
          <p>
            Un bloque oscuro conserva la terminal y el arte ASCII como el centro
            tactil de la experiencia.
          </p>
        </div>

        <div className={styles.terminalPanel}>
          <Terminal />
        </div>

        <div className={styles.asciiPanel}>
          <PenguinAscii />
        </div>
      </section>
    </main>
  );
}
