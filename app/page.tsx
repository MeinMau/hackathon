import LaptopExperience from "@/components/LaptopExperience";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.scrollLab} data-scroll-lab="true">
      <LaptopExperience />
    </main>
  );
}
