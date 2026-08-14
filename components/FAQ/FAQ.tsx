"use client";

import { useState } from "react";
import styles from "./FAQ.module.css";

const faqItems = [
    {
        question: "¿Quién puede participar en el hackathon?",
        answer:
            "Pueden participar estudiantes de preparatoria y universidad que quieran construir una solución tecnológica en equipo durante el evento.",
    },
    {
        question: "¿Cuántas personas puede tener un equipo?",
        answer:
            "La dinámica está pensada para equipos pequeños y ágiles. Si ya tienes un grupo, mantenlo compacto para repartir mejor diseño, desarrollo y presentación.",
    },
    {
        question: "¿Tengo que llegar con un proyecto ya hecho?",
        answer:
            "No. El núcleo de la propuesta debe construirse durante el hackathon. Puedes apoyarte en recursos propios, pero la solución debe nacer en el evento.",
    },
    {
        question: "¿Qué necesito llevar?",
        answer:
            "Laptop, cargador, ganas de colaborar y todo lo que uses para programar cómodamente. También ayuda llevar ideas previas, bocetos o notas de problema.",
    },
    {
        question: "¿Habrá acompañamiento durante el evento?",
        answer:
            "Sí. Tendrás apoyo de mentores, organización y espacios para resolver dudas técnicas y validar tu enfoque mientras avanzas.",
    },
    {
        question: "¿Dónde me inscribo?",
        answer:
            "La inscripción se realiza desde el enlace de registro de la página. Si vas en equipo, procura que cada integrante complete su registro cuando sea necesario.",
    },
];

export default function FAQ() {
    const [activeIndex, setActiveIndex] = useState(0);

    return (
        <section className={`${styles.container} ${styles.card}`} id="faq" aria-labelledby="faq-title">
            <div className={styles.header}>
                <p className={styles.mintTag}>04 / FAQ</p>
                <h2 className={styles.title} id="faq-title">
                    Preguntas frecuentes
                </h2>
            </div>

            <div className={styles.list}>
                {faqItems.map((item, index) => {
                    const isOpen = activeIndex === index;
                    const answerId = `faq-answer-${index}`;

                    return (
                        <article
                            className={`${styles.item} ${isOpen ? styles.itemOpen : ""}`}
                            key={item.question}
                        >
                            <button
                                className={styles.summary}
                                type="button"
                                aria-expanded={isOpen}
                                aria-controls={answerId}
                                onClick={() => setActiveIndex(isOpen ? -1 : index)}
                            >
                                <span>{item.question}</span>
                                <span className={styles.icon} aria-hidden="true">
                                    +
                                </span>
                            </button>
                            <div
                                className={styles.answerWrap}
                                id={answerId}
                                role="region"
                                aria-hidden={!isOpen}
                            >
                                <div className={styles.answer}>
                                    <p>{item.answer}</p>
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
