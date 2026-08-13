"use client";

import Script from "next/script";
import { FormEvent, useEffect, useRef, useState } from "react";
import styles from "../../app/page.module.css";

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const turnstileScriptUrl = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const registrationEndpoint = "/api/register";
const requestTimeoutMs = 20000;

type SubmitState = "idle" | "submitting" | "success" | "error" | "not-configured";

type RegistrationResponse = {
  source?: string;
  submissionId?: string;
  ok?: boolean;
  ignored?: boolean;
  error?: string;
  field?: string;
  fields?: string[];
  retryAfterSeconds?: number;
};

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
          appearance?: "always" | "execute" | "interaction-only";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

function createSubmissionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getFieldLabel(field?: string) {
  switch (field) {
    case "correoElectronico":
      return "correo electronico";
    case "telefono":
      return "telefono";
    case "matriculaEscolar":
      return "matricula";
    case "nombreCompleto":
      return "nombre completo";
    default:
      return "dato";
  }
}

function getResponseMessage(response: RegistrationResponse) {
  switch (response.error) {
    case "duplicate_registration":
      return `Ya existe un registro con ese ${getFieldLabel(response.field)}.`;
    case "rate_limited": {
      const minutes = Math.max(1, Math.ceil((response.retryAfterSeconds ?? 600) / 60));
      return `Detectamos demasiados intentos. Espera ${minutes} min e intenta de nuevo.`;
    }
    case "captcha_failed":
      return "No pudimos validar que eres una persona. Recarga la verificacion e intenta de nuevo.";
    case "turnstile_not_configured":
      return "Falta configurar la clave secreta de Turnstile en Google Apps Script.";
    case "not_configured":
      return "Falta configurar la URL de Google Apps Script en el servidor.";
    case "apps_script_timeout":
      return "El registro tardo demasiado en responder. Intenta de nuevo en un momento.";
    case "apps_script_unreachable":
    case "apps_script_http_error":
    case "invalid_apps_script_response":
      return "No pudimos conectar con el registro. Intenta de nuevo en unos minutos.";
    case "request_too_large":
    case "invalid_request":
      return "No pudimos procesar los datos del formulario. Recarga la pagina e intenta de nuevo.";
    case "missing_fields":
      return "Faltan campos obligatorios. Revisa tu registro e intenta de nuevo.";
    case "invalid_email":
      return "El correo electronico no parece valido.";
    case "invalid_phone":
      return "El telefono debe incluir al menos 10 digitos.";
    case "invalid_grade":
      return "Selecciona un grado escolar valido.";
    default:
      return "No pudimos enviar tu registro. Revisa tus datos e intenta de nuevo.";
  }
}

export default function RegistrationForm() {
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [turnstileScriptReady, setTurnstileScriptReady] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef("");

  useEffect(() => {
    if (!turnstileSiteKey || !turnstileScriptReady || !turnstileContainerRef.current || !window.turnstile) {
      return;
    }

    if (turnstileWidgetIdRef.current) {
      return;
    }

    turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
      sitekey: turnstileSiteKey,
      theme: "light",
      size: "flexible",
      appearance: "interaction-only",
    });
  }, [turnstileScriptReady]);

  useEffect(() => {
    return () => {
      if (turnstileWidgetIdRef.current) {
        window.turnstile?.remove(turnstileWidgetIdRef.current);
      }
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    if (!turnstileSiteKey) {
      setSubmitState("not-configured");
      setStatusMessage("Falta configurar la site key publica de Cloudflare Turnstile.");
      return;
    }

    const formData = new FormData(form);
    if (!String(formData.get("cf-turnstile-response") ?? "").trim()) {
      setSubmitState("error");
      setStatusMessage("Completa la verificacion de seguridad e intenta de nuevo.");
      window.turnstile?.reset(turnstileWidgetIdRef.current);
      return;
    }

    const submissionId = createSubmissionId();
    formData.set("submissionId", submissionId);
    setSubmitState("submitting");
    setStatusMessage("");

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const response = await fetch(registrationEndpoint, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const payload = (await response.json()) as RegistrationResponse;

      if (!response.ok || !payload.ok) {
        setSubmitState("error");
        setStatusMessage(getResponseMessage(payload));
        return;
      }

      setSubmitState("success");
      setStatusMessage("Registro enviado. Gracias por inscribirte al hackathon.");
      form.reset();
    } catch (error) {
      setSubmitState("error");
      setStatusMessage(
        error instanceof DOMException && error.name === "AbortError"
          ? "El registro tardo demasiado en responder. Intenta de nuevo en un momento."
          : "No pudimos conectar con el registro. Revisa tu conexion e intenta de nuevo.",
      );
    } finally {
      window.clearTimeout(timeout);
      window.turnstile?.reset(turnstileWidgetIdRef.current);
    }
  }

  return (
    <>
      {turnstileSiteKey ? (
        <Script
          id="cloudflare-turnstile"
          src={turnstileScriptUrl}
          strategy="afterInteractive"
          onReady={() => setTurnstileScriptReady(true)}
        />
      ) : null}

      <form
        ref={formRef}
        className={styles.registrationForm}
        method="post"
        onSubmit={handleSubmit}
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

        {turnstileSiteKey ? (
          <div className={styles.turnstileField} ref={turnstileContainerRef} />
        ) : null}

        <div className={styles.formStatus} aria-live="polite">
          {submitState === "success" ? (
            <p className={styles.formSuccess} role="status">
              {statusMessage}
            </p>
          ) : null}

          {submitState === "error" ? (
            <p className={styles.formError} role="alert">
              {statusMessage}
            </p>
          ) : null}

          {submitState === "not-configured" ? (
            <p className={styles.formError} role="alert">
              {statusMessage}
            </p>
          ) : null}
        </div>

        <button className={styles.submitButton} type="submit" disabled={submitState === "submitting"}>
          {submitState === "submitting" ? "Enviando..." : "Enviar registro"}
        </button>
      </form>
    </>
  );
}
