import Image from "next/image";
import AnimatedNumberCountdown from "../components/Countdown/AnimatedNumberCountdown";
import LaptopExperience from "../components/LaptopExperience";
import RegistrationForm from "../components/RegistrationForm/RegistrationForm";
import { MarqueeLogoScroller } from "../components/ui/marquee-logo-scroller";
import clicksPhoto from "../public/clicksphoto.png";
import ingeniaCartoon from "../public/ingenia-cartoon.png";
import ingeniaLogo from "../public/ingenia-logo.png";
import serpentinas from "../public/serpentinas.png";
import styles from "./page.module.css";
import FAQ from "@/components/FAQ";
import SmoothHashNavigation from "@/components/SmoothHashNavigation";

const countdownEndDate = "2026-09-03T08:00:00-06:00";

const sponsorLogos = [
  {
    src: "/sponsors/1.png",
    alt: "Ingenia",
    gradient: { from: "#D0E3FF", via: "#7096D1", to: "#334EAC" },
  },
  {
    src: "/sponsors/2.png",
    alt: "Formacion Integral",
    gradient: { from: "#F7F2EB", via: "#BAD6EB", to: "#7096D1" },
  },
  {
    src: "/sponsors/3.png",
    alt: "FESAL",
    gradient: { from: "#F7F2EB", via: "#D8CEC3", to: "#8C857C" },
  },
  {
    src: "/sponsors/4.png",
    alt: "ISND",
    gradient: { from: "#D0E3FF", via: "#7096D1", to: "#334EAC" },
  },
  {
    src: "/sponsors/6.png",
    alt: "La Marquesita",
    gradient: { from: "#FFDA8A", via: "#EA9E32", to: "#8F5A12" },
  },
  {
    src: "/sponsors/7.png",
    alt: "Sunshine",
    gradient: { from: "#FFE8F3", via: "#FF8FD0", to: "#D14EA2" },
  },
  {
    src: "/sponsors/blu.png",
    alt: "Blu",
    gradient: { from: "#668CFF", via: "#0049FF", to: "#003199" },
  },
  {
    src: "/sponsors/fesal_negro.png",
    alt: "FESAL negro",
    gradient: { from: "#F7F2EB", via: "#D8CEC3", to: "#8C857C" },
  },
  {
    src: "/sponsors/jetbrains.svg",
    alt: "JetBrains",
    gradient: { from: "#FF5A5F", via: "#7B2CFF", to: "#081F5C" },
  },
  {
    src: "/sponsors/LUNAR.png",
    alt: "Lunar",
    gradient: { from: "#E8E1FF", via: "#BFA8FF", to: "#7C6BD6" },
  },
  {
    src: "/sponsors/POKEBURRITO_page-0001.png",
    alt: "Pokeburrito",
    gradient: { from: "#77F28B", via: "#1ED760", to: "#107A36" },
  },
  {
    src: "/sponsors/veintitres.jpeg",
    alt: "Veintitres",
    gradient: { from: "#67F0D1", via: "#2AE5B9", to: "#1B8F72" },
  },
];

export default function Home() {
  return (
    <main className={styles.page}>
      <SmoothHashNavigation />
      <header className={styles.header}>
        <a className={styles.brand} href="#">
          <Image src={ingeniaLogo} alt="Ingenia" priority />
        </a>
        <nav className={styles.navPill} aria-label="Main navigation">
          <a href="#">Inicio</a>
          <a href="#brief">Info </a>
          <a href="#faq">FAQ</a>
          <a href="#terminal">O.S</a>
        </nav>
        <a className={styles.navAction} href="#registro">
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
        title="Partners"
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

        <article className={styles.card}>
          <span className={styles.mintTag}>03 / CONNECT</span>
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

      <section id="registro" className={styles.registrationSection} aria-labelledby="registro-title">
        <div className={styles.registrationIntro}>
          <span className={styles.monoLabel}>REGISTRO</span>
          <h2 id="registro-title">Reserva tu lugar en el hackathon</h2>
          <p>
            Completa tus datos para participar en el Primer Concurso de Programacion
            ISND - INGENIA. Los campos marcados como obligatorios nos ayudan a validar
            tu registro y categoria.
          </p>
          <div className={styles.registrationStats} aria-label="Resumen del evento">
            <span>3 y 4 de septiembre</span>
            <span>Preparatoria y Universidad</span>
            <span>IEST Anahuac</span>
          </div>
        </div>

        <RegistrationForm />
      </section>

      <FAQ />
      <section className={styles.cartoonBridge} aria-label="Ingenia">
        <Image
          className={styles.cartoonImage}
          src={ingeniaCartoon}
          alt="Ilustracion de Ingenia"
        />
      </section>
      <LaptopExperience />
    </main>
  );
}
