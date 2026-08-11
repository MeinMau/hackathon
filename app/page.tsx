import Image from "next/image";
import AnimatedNumberCountdown from "../components/Countdown/AnimatedNumberCountdown";
import LaptopExperience from "../components/LaptopExperience";
import { MarqueeLogoScroller } from "../components/ui/marquee-logo-scroller";
import clicksPhoto from "../public/clicksphoto.png";
import ingeniaLogo from "../public/ingenia-logo.png";
import serpentinas from "../public/serpentinas.png";
import styles from "./page.module.css";

const countdownEndDate = "2026-09-03T08:00:00-06:00";

const sponsorLogos = [
  {
    src: "https://svgl.app/library/procure.svg",
    alt: "Procure",
    gradient: { from: "#668CFF", via: "#0049FF", to: "#003199" },
  },
  {
    src: "https://svgl.app/library/shopify.svg",
    alt: "Shopify",
    gradient: { from: "#D9FF5A", via: "#95BF47", to: "#5E8E3E" },
  },
  {
    src: "https://svgl.app/library/blender.svg",
    alt: "Blender",
    gradient: { from: "#FFB066", via: "#EA7600", to: "#8F4400" },
  },
  {
    src: "https://svgl.app/library/figma.svg",
    alt: "Figma",
    gradient: { from: "#C4C2FF", via: "#9896FF", to: "#5B4DCC" },
  },
  {
    src: "https://svgl.app/library/spotify.svg",
    alt: "Spotify",
    gradient: { from: "#77F28B", via: "#1ED760", to: "#107A36" },
  },
  {
    src: "https://svgl.app/library/lottielab.svg",
    alt: "LottieLab",
    gradient: { from: "#D9FF5A", via: "#AFFF01", to: "#7A9900" },
  },
  {
    src: "https://svgl.app/library/google-cloud.svg",
    alt: "Google Cloud",
    gradient: { from: "#8AA7FF", via: "#5F86FF", to: "#3A5ACC" },
  },
  {
    src: "https://svgl.app/library/bing.svg",
    alt: "Bing",
    gradient: { from: "#67F0D1", via: "#2AE5B9", to: "#1B8F72" },
  },
];

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

      <MarqueeLogoScroller
        className={styles.sponsors}
        title="Sponsors"
        description="Aliados que impulsan el hackathon, conectan talento joven con la industria y hacen posible una experiencia de alto impacto."
        logos={sponsorLogos}
        speed="normal"
      />

      <section id="brief" className={styles.cardGrid}>
        <article className={styles.card}>
          <span className={styles.mintTag}>01 / BUILD</span>
          <h2>Build the Future</h2>
          <p>
            Demuestra tu talento este 3 y 4 de septiembre desarrollando soluciones
            innovadoras desde cero. Atrévete a resolver problemas reales utilizando tu
            creatividad, lógica y habilidades tecnológicas en un ambiente de alta energía
            y colaboración contra reloj.
          </p>
        </article>

        <article className={styles.card}>
          <span className={styles.mintTag}>02 / HONOR</span>
          <h2>Code of Honor</h2>
          <p>
            Creemos en la originalidad y la innovación auténtica. Para garantizar un
            terreno de juego nivelado para todos los equipos, el núcleo de tu proyecto
            debe nacer durante el evento. Puedes apalancarte de tus propias librerías
            previas o repositorios personales, pero el verdadero impacto se medirá por lo
            que logres construir durante el transcurso de la competencia.
          </p>
        </article>

        <article className={styles.invertedCard}>
          <span className={styles.yellowMark}>03 / CONNECT</span>
          <h2>Connect & Elevate</h2>
          <p>
            Más que una competencia, esta es tu plataforma de despegue dentro del
            ecosistema de los sistemas y los negocios digitales. Conecta directamente con
            partners de la industria del software, recibe retroalimentación de mentores
            expertos y haz networking con otros desarrolladores apasionados que comparten
            tu visión.
          </p>
        </article>
      </section>

      <LaptopExperience />
    </main>
  );
}
