"use client";

import Script from "next/script";
import { FormEvent, useEffect, useRef, useState } from "react";
import styles from "../../app/page.module.css";

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const turnstileScriptUrl = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const registrationEndpoint = "/api/register";
const requestTimeoutMs = 20000;

type SubmitState = "idle" | "submitting" | "success" | "error" | "not-configured";
type FormStep = "details" | "verification";

type RegistrationResponse = {
  source?: string;
  submissionId?: string;
  ok?: boolean;
  ignored?: boolean;
  error?: string;
  field?: string;
  fields?: string[];
  retryAfterSeconds?: number;
  verificationRequired?: boolean;
  verificationId?: string;
  maskedEmail?: string;
  expiresInSeconds?: number;
  attemptsRemaining?: number;
  emailVerified?: boolean;
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
    case "code_recently_sent":
      return "Ya enviamos un codigo. Espera un minuto antes de solicitar otro.";
    case "captcha_failed":
      return "No pudimos validar que eres una persona. Recarga la verificacion e intenta de nuevo.";
    case "turnstile_not_configured":
      return "Falta configurar la clave secreta de Turnstile en el servidor.";
    case "resend_not_configured":
      return "Falta terminar la configuracion del correo de confirmacion.";
    case "otp_not_configured":
      return "Falta configurar la seguridad de los codigos de confirmacion.";
    case "firebase_not_configured":
      return "Falta terminar la configuracion de Firebase en el servidor.";
    case "email_send_failed":
      return "No pudimos enviar el codigo. Revisa el correo e intenta de nuevo.";
    case "email_provider_rate_limited":
      return "El servicio de correo alcanzo su limite temporal. Intenta de nuevo mas tarde.";
    case "invalid_verification_code":
      return response.attemptsRemaining === undefined
        ? "El codigo debe contener seis digitos."
        : `El codigo no es correcto. Te quedan ${response.attemptsRemaining} intentos.`;
    case "verification_expired":
      return "El codigo vencio. Vuelve a tus datos para solicitar uno nuevo.";
    case "too_many_code_attempts":
      return "El codigo fue bloqueado por demasiados intentos. Solicita uno nuevo.";
    case "internal_error":
      return "No pudimos conectar con el registro. Intenta de nuevo en unos minutos.";
    case "request_too_large":
    case "invalid_request":
    case "invalid_action":
    case "invalid_field_length":
      return "No pudimos procesar los datos del formulario. Revisa los campos e intenta de nuevo.";
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

async function postRegistration(formData: FormData) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(registrationEndpoint, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    const payload = (await response.json()) as RegistrationResponse;
    return { response, payload };
  } finally {
    window.clearTimeout(timeout);
  }
}

export default function RegistrationForm() {
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [formStep, setFormStep] = useState<FormStep>("details");
  const [statusMessage, setStatusMessage] = useState("");
  const [turnstileScriptReady, setTurnstileScriptReady] = useState(false);
  const [verificationId, setVerificationId] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const formRef = useRef<HTMLFormElement | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef("");

  useEffect(() => {
    if (
      !turnstileSiteKey ||
      !turnstileScriptReady ||
      !turnstileContainerRef.current ||
      !window.turnstile
    ) {
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

  function returnToDetails() {
    setFormStep("details");
    setSubmitState("idle");
    setStatusMessage("");
    setVerificationId("");
    setVerificationCode("");
    setMaskedEmail("");
    window.turnstile?.reset(turnstileWidgetIdRef.current);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    if (!turnstileSiteKey) {
      setSubmitState("not-configured");
      setStatusMessage("Falta configurar la site key publica de Cloudflare Turnstile.");
      return;
    }

    let formData: FormData;

    if (formStep === "details") {
      formData = new FormData(form);
      if (!String(formData.get("cf-turnstile-response") ?? "").trim()) {
        setSubmitState("error");
        setStatusMessage("Completa la verificacion de seguridad e intenta de nuevo.");
        window.turnstile?.reset(turnstileWidgetIdRef.current);
        return;
      }

      formData.set("action", "request_email_code");
    } else {
      if (!verificationId || !/^\d{6}$/.test(verificationCode)) {
        setSubmitState("error");
        setStatusMessage("Ingresa el codigo de seis digitos que enviamos a tu correo.");
        return;
      }

      formData = new FormData();
      formData.set("action", "confirm_email_code");
      formData.set("verificationId", verificationId);
      formData.set("verificationCode", verificationCode);
      formData.set("source", "landing-hackathon");
    }

    formData.set("submissionId", createSubmissionId());
    setSubmitState("submitting");
    setStatusMessage("");

    try {
      const { response, payload } = await postRegistration(formData);

      if (!response.ok || !payload.ok) {
        setSubmitState("error");
        setStatusMessage(getResponseMessage(payload));

        if (
          formStep === "verification" &&
          ["verification_expired", "too_many_code_attempts"].includes(payload.error ?? "")
        ) {
          setFormStep("details");
          setVerificationId("");
          setVerificationCode("");
        }
        return;
      }

      if (formStep === "details") {
        if (!payload.verificationRequired || !payload.verificationId) {
          setSubmitState("error");
          setStatusMessage("No pudimos iniciar la confirmacion del correo. Intenta de nuevo.");
          return;
        }

        setVerificationId(payload.verificationId);
        setMaskedEmail(payload.maskedEmail ?? "tu correo");
        setVerificationCode("");
        setFormStep("verification");
        setSubmitState("idle");
        return;
      }

      setSubmitState("success");
      setStatusMessage("Correo confirmado y registro enviado. Gracias por inscribirte.");
      setFormStep("details");
      setVerificationId("");
      setVerificationCode("");
      setMaskedEmail("");
      form.reset();
    } catch (error) {
      setSubmitState("error");
      setStatusMessage(
        error instanceof DOMException && error.name === "AbortError"
          ? "El registro tardo demasiado en responder. Intenta de nuevo en un momento."
          : "No pudimos conectar con el registro. Revisa tu conexion e intenta de nuevo.",
      );
    } finally {
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

      <form ref={formRef} className={styles.registrationForm} method="post" onSubmit={handleSubmit}>
        <div className={styles.formHeader}>
          <span>Ficha de participante</span>
          <strong>{formStep === "details" ? "* Obligatorio" : "Paso 2 de 2"}</strong>
        </div>

        <label className={styles.honeypotField} aria-hidden="true">
          Sitio web
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>

        <input name="source" type="hidden" value="landing-hackathon" />

        <div className={styles.formDetails} hidden={formStep !== "details"}>
          <div className={styles.formGrid}>
            <label className={styles.formField}>
              <span>Nombre completo *</span>
              <input
                name="nombreCompleto"
                type="text"
                placeholder="Tu nombre completo"
                maxLength={120}
                required
              />
            </label>

            <label className={styles.formField}>
              <span>Numero de telefono *</span>
              <input
                name="telefono"
                type="tel"
                placeholder="833 000 0000"
                maxLength={30}
                required
              />
            </label>

            <label className={styles.formField}>
              <span>Correo electronico *</span>
              <input
                name="correoElectronico"
                type="email"
                placeholder="tu@correo.com"
                maxLength={254}
                required
              />
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
              <input
                name="escuelaProcedencia"
                type="text"
                placeholder="Nombre de tu escuela"
                maxLength={140}
                required
              />
            </label>

            <label className={styles.formField}>
              <span>Matricula escolar *</span>
              <input
                name="matriculaEscolar"
                type="text"
                placeholder="Matricula o ID escolar"
                maxLength={60}
                required
              />
            </label>
          </div>

          <div className={styles.optionalFields}>
            <label className={styles.formField}>
              <span>Tecnologias que usas</span>
              <textarea
                name="tecnologias"
                placeholder="React, Python, Java, Figma..."
                maxLength={600}
              />
            </label>

            <label className={styles.formField}>
              <span>Hard Skills</span>
              <textarea
                name="hardSkills"
                placeholder="Programacion, bases de datos, UI, analisis..."
                maxLength={600}
              />
            </label>

            <label className={styles.formField}>
              <span>Soft Skills</span>
              <textarea
                name="softSkills"
                placeholder="Liderazgo, comunicacion, creatividad..."
                maxLength={600}
              />
            </label>
          </div>

          <label className={styles.checkboxField}>
            <input name="reglamento" type="checkbox" required />
            <span>
              Declaro haber leido y estar de acuerdo con el reglamento establecido en la
              Convocatoria del Primer Concurso de Programacion ISND - INGENIA.
            </span>
          </label>
        </div>

        {formStep === "verification" ? (
          <section className={styles.verificationStep} aria-labelledby="verification-title">
            <div>
              <h3 id="verification-title">Confirma tu correo</h3>
              <p>
                Enviamos un codigo de seis digitos a <strong>{maskedEmail}</strong>. Vence en 10
                minutos.
              </p>
            </div>

            <label className={styles.verificationCodeField}>
              <span>Codigo de confirmacion</span>
              <input
                value={verificationCode}
                onChange={(event) =>
                  setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                name="verificationCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                autoFocus
                required
              />
            </label>

            <button className={styles.changeEmailButton} type="button" onClick={returnToDetails}>
              Cambiar datos o solicitar otro codigo
            </button>
          </section>
        ) : null}

        {turnstileSiteKey ? (
          <div hidden={formStep !== "details"}>
            <div className={styles.turnstileField} ref={turnstileContainerRef} />
          </div>
        ) : null}

        <div className={styles.formStatus} aria-live="polite">
          {submitState === "success" ? (
            <p className={styles.formSuccess} role="status">
              {statusMessage}
            </p>
          ) : null}

          {submitState === "error" || submitState === "not-configured" ? (
            <p className={styles.formError} role="alert">
              {statusMessage}
            </p>
          ) : null}
        </div>

        <button className={styles.submitButton} type="submit" disabled={submitState === "submitting"}>
          {submitState === "submitting"
            ? formStep === "details"
              ? "Enviando codigo..."
              : "Confirmando..."
            : formStep === "details"
              ? "Enviar codigo"
              : "Confirmar correo y enviar"}
        </button>
      </form>
    </>
  );
}
