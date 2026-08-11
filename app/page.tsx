import Image from "next/image";
import AnimatedNumberCountdown from "../components/Countdown/AnimatedNumberCountdown";
import LaptopExperience from "../components/LaptopExperience";
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
          <a href="#">Inicio</a>
          <a href="#brief">Solutions</a>
          <a href="#brief">Use Cases</a>
          <a href="#terminal">Resources</a>
          <a href="#brief">Plans</a>
          <a href="#terminal">Terminal</a>
        </nav>
        <a className={styles.navAction} href="https://forms.gle/XsfQJUWYxTgDEEDWA" target="_blank">
          Inscribete
        </a>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <h1>
            CREA
            <br />
            IMAGINA
            <br />
            INGENIA
          </h1>
          <p>
            Hackathon ISND e INGENIA para estudiantes de preparatoria y universidad. Fortalece pensamiento lógico, resolución de problemas y trabajo colaborativo a través del código.
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

      <LaptopExperience />
    </main>
  );
}
