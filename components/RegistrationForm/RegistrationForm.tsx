"use client";

import { FormEvent, useRef, useState } from "react";
import styles from "../../app/page.module.css";

const appsScriptUrl = process.env.NEXT_PUBLIC_REGISTRATION_WEB_APP_URL;
const iframeName = "registration-submit-frame";

type SubmitState = "idle" | "submitting" | "success" | "error" | "not-configured";

export default function RegistrationForm() {
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const formRef = useRef<HTMLFormElement | null>(null);
  const submittedToIframeRef = useRef(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;

    if (!appsScriptUrl) {
      event.preventDefault();
      setSubmitState("not-configured");
      return;
    }

    const formData = new FormData(form);
    if (String(formData.get("website") ?? "").trim()) {
      event.preventDefault();
      setSubmitState("success");
      form.reset();
      return;
    }

    submittedToIframeRef.current = true;
    setSubmitState("submitting");
  }

  function handleIframeLoad() {
    if (!submittedToIframeRef.current) {
      return;
    }

    submittedToIframeRef.current = false;
    setSubmitState("success");
    formRef.current?.reset();
  }

  return (
    <form
      ref={formRef}
      action={appsScriptUrl || undefined}
      className={styles.registrationForm}
      encType="application/x-www-form-urlencoded"
      method="post"
      onSubmit={handleSubmit}
      target={iframeName}
    >
      <div className={styles.formHeader}>
        <span>Ficha de participante</span>
        <strong>* Obligatorio</strong>
      </div>

      <label className={styles.honeypotField} aria-hidden="true">
        Sitio web
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>

      <input name="source" type="hidden" value="landing-hackathon" />

      <div className={styles.formGrid}>
        <label className={styles.formField}>
          <span>Nombre completo *</span>
          <input name="nombreCompleto" type="text" placeholder="Tu nombre completo" required />
        </label>

        <label className={styles.formField}>
          <span>Numero de telefono *</span>
          <input name="telefono" type="tel" placeholder="833 000 0000" required />
        </label>

        <label className={styles.formField}>
          <span>Correo electronico *</span>
          <input name="correoElectronico" type="email" placeholder="tu@correo.com" required />
        </label>

        <label className={styles.formField}>
          <span>Grado escolar *</span>
          <select name="gradoEscolar" defaultValue="" required>
            <option value="" disabled>
              Selecciona una opcion
            </option>
            <option value="preparatoria">Preparatoria</option>
            <option value="universidad">Universidad</option>
          </select>
        </label>

        <label className={styles.formField}>
          <span>Escuela de procedencia *</span>
          <input name="escuelaProcedencia" type="text" placeholder="Nombre de tu escuela" required />
        </label>

        <label className={styles.formField}>
          <span>Matricula escolar *</span>
          <input name="matriculaEscolar" type="text" placeholder="Matricula o ID escolar" required />
        </label>
      </div>

      <div className={styles.optionalFields}>
        <label className={styles.formField}>
          <span>Tecnologias que usas</span>
          <textarea name="tecnologias" placeholder="React, Python, Java, Figma..." />
        </label>

        <label className={styles.formField}>
          <span>Hard Skills</span>
          <textarea name="hardSkills" placeholder="Programacion, bases de datos, UI, analisis..." />
        </label>

        <label className={styles.formField}>
          <span>Soft Skills</span>
          <textarea name="softSkills" placeholder="Liderazgo, comunicacion, creatividad..." />
        </label>
      </div>

      <label className={styles.checkboxField}>
        <input name="reglamento" type="checkbox" required />
        <span>
          Declaro haber leido y estar de acuerdo con el reglamento establecido
          en la Convocatoria del Primer Concurso de Programacion ISND - INGENIA.
        </span>
      </label>

      <div className={styles.formStatus} aria-live="polite">
        {submitState === "success" ? (
          <p className={styles.formSuccess} role="status">
            Registro enviado. Gracias por inscribirte al hackathon.
          </p>
        ) : null}

        {submitState === "error" ? (
          <p className={styles.formError} role="alert">
            No pudimos enviar tu registro. Revisa tu conexion e intenta de nuevo.
          </p>
        ) : null}

        {submitState === "not-configured" ? (
          <p className={styles.formError} role="alert">
            Falta configurar la URL de Google Apps Script para activar el envio.
          </p>
        ) : null}
      </div>

      <button className={styles.submitButton} type="submit" disabled={submitState === "submitting"}>
        {submitState === "submitting" ? "Enviando..." : "Enviar registro"}
      </button>

      <iframe
        className={styles.hiddenSubmitFrame}
        name={iframeName}
        onLoad={handleIframeLoad}
        title="Envio de registro"
      />
    </form>
  );
}
