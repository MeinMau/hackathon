import {
  createHash,
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";

import { getRegistrationFirestore } from "@/lib/firebase-admin";

const RESPONSE_SOURCE = "hackathon-registration";
const PROTECTION_VERSION = "firebase-firestore-v2";
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const RESEND_EMAIL_URL = "https://api.resend.com/emails";

const RATE_LIMIT_WINDOW_SECONDS = 10 * 60;
const RATE_LIMIT_MAX_ATTEMPTS = 3;
const IP_RATE_LIMIT_WINDOW_SECONDS = 10 * 60;
const IP_RATE_LIMIT_MAX_ATTEMPTS = 10;
const EMAIL_SEND_WINDOW_SECONDS = 60 * 60;
const EMAIL_SEND_MAX_ATTEMPTS = 3;
const IP_EMAIL_SEND_MAX_ATTEMPTS = 12;
const EMAIL_SEND_COOLDOWN_SECONDS = 60;
const VERIFICATION_TTL_SECONDS = 10 * 60;
const VERIFICATION_MAX_ATTEMPTS = 5;
const EXTERNAL_REQUEST_TIMEOUT_MS = 10_000;

const REGISTRATIONS_COLLECTION = "registrations";
const PENDING_COLLECTION = "pendingRegistrations";
const RATE_LIMITS_COLLECTION = "registrationRateLimits";
const UNIQUE_KEYS_COLLECTION = "registrationUniqueKeys";

const REQUIRED_FIELDS = [
  "nombreCompleto",
  "telefono",
  "correoElectronico",
  "gradoEscolar",
  "escuelaProcedencia",
  "matriculaEscolar",
  "reglamento",
] as const;

const UNIQUE_FIELDS = [
  "correoElectronico",
  "telefono",
  "matriculaEscolar",
  "nombreCompleto",
] as const;

export type RegistrationInput = {
  website: string;
  submissionId: string;
  verificationId: string;
  verificationCode: string;
  nombreCompleto: string;
  telefono: string;
  correoElectronico: string;
  gradoEscolar: string;
  escuelaProcedencia: string;
  matriculaEscolar: string;
  tecnologias: string;
  hardSkills: string;
  softSkills: string;
  reglamento: string;
  turnstileToken: string;
};

type RegistrationData = Omit<
  RegistrationInput,
  "website" | "submissionId" | "verificationId" | "verificationCode" | "turnstileToken"
>;

type NormalizedRegistration = {
  nombreCompleto: string;
  telefono: string;
  correoElectronico: string;
  matriculaEscolar: string;
};

type PendingRegistration = {
  codeHash: string;
  attempts: number;
  expiresAt: Timestamp;
  data: RegistrationData;
  normalized: NormalizedRegistration;
  initialSubmissionId: string;
};

export type RegistrationResult = {
  ok: boolean;
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

type ResendConfig = {
  apiKey: string;
  from: string;
  replyTo: string;
};

type SuccessEmailData = {
  registrationId: string;
  nombreCompleto: string;
  correoElectronico: string;
  gradoEscolar: string;
  escuelaProcedencia: string;
};

type ConfirmEmailTransactionResult = RegistrationResult & {
  successEmailData?: SuccessEmailData;
};

type TimestampLike = {
  toMillis: () => number;
};

type RateLimitIdentifier = {
  kind: string;
  value: string;
  maxAttempts: number;
  windowSeconds: number;
};

export const registrationResponseMetadata = {
  source: RESPONSE_SOURCE,
  version: PROTECTION_VERSION,
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return clean(value).toLowerCase();
}

function normalizePhone(value: unknown) {
  return clean(value).replace(/\D/g, "");
}

function normalizeMatricula(value: unknown) {
  return clean(value).toUpperCase().replace(/[\s-]+/g, "");
}

function normalizeText(value: unknown) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeRegistration(data: RegistrationInput): NormalizedRegistration {
  return {
    nombreCompleto: normalizeText(data.nombreCompleto),
    telefono: normalizePhone(data.telefono),
    correoElectronico: normalizeEmail(data.correoElectronico),
    matriculaEscolar: normalizeMatricula(data.matriculaEscolar),
  };
}

function sanitizeRegistrationData(data: RegistrationInput): RegistrationData {
  return {
    nombreCompleto: clean(data.nombreCompleto),
    telefono: clean(data.telefono),
    correoElectronico: clean(data.correoElectronico),
    gradoEscolar: clean(data.gradoEscolar),
    escuelaProcedencia: clean(data.escuelaProcedencia),
    matriculaEscolar: clean(data.matriculaEscolar),
    reglamento: clean(data.reglamento),
    tecnologias: clean(data.tecnologias),
    hardSkills: clean(data.hardSkills),
    softSkills: clean(data.softSkills),
  };
}

function validateRegistration(data: RegistrationInput):
  | { ok: true; normalized: NormalizedRegistration }
  | RegistrationResult {
  const missingFields = REQUIRED_FIELDS.filter((field) => !clean(data[field]));
  if (missingFields.length) {
    return { ok: false, error: "missing_fields", fields: [...missingFields] };
  }

  if (!["preparatoria", "universidad"].includes(clean(data.gradoEscolar))) {
    return { ok: false, error: "invalid_grade" };
  }

  const normalized = normalizeRegistration(data);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.correoElectronico)) {
    return { ok: false, error: "invalid_email" };
  }

  if (normalized.telefono.length < 10) {
    return { ok: false, error: "invalid_phone" };
  }

  if (
    clean(data.nombreCompleto).length > 120 ||
    clean(data.telefono).length > 30 ||
    clean(data.correoElectronico).length > 254 ||
    clean(data.escuelaProcedencia).length > 140 ||
    clean(data.matriculaEscolar).length > 60 ||
    clean(data.tecnologias).length > 600 ||
    clean(data.hardSkills).length > 600 ||
    clean(data.softSkills).length > 600
  ) {
    return { ok: false, error: "invalid_field_length" };
  }

  return { ok: true, normalized };
}

function hashIdentifier(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function rateLimitDocumentId(kind: string, value: string) {
  return `${kind}-${hashIdentifier(value)}`;
}

function uniqueDocumentId(field: keyof NormalizedRegistration, value: string) {
  return `${field}-${hashIdentifier(value)}`;
}

function getTimestampMillis(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as TimestampLike).toMillis === "function"
  ) {
    return (value as TimestampLike).toMillis();
  }

  return 0;
}

async function checkRequestRateLimit(normalized: NormalizedRegistration, clientIp: string) {
  const db = getRegistrationFirestore();
  const identifiers: RateLimitIdentifier[] = [
    {
      kind: "attempt-email",
      value: normalized.correoElectronico,
      maxAttempts: RATE_LIMIT_MAX_ATTEMPTS,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    },
    {
      kind: "attempt-phone",
      value: normalized.telefono,
      maxAttempts: RATE_LIMIT_MAX_ATTEMPTS,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    },
    {
      kind: "attempt-student",
      value: normalized.matriculaEscolar,
      maxAttempts: RATE_LIMIT_MAX_ATTEMPTS,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    },
    {
      kind: "attempt-ip",
      value: clientIp,
      maxAttempts: IP_RATE_LIMIT_MAX_ATTEMPTS,
      windowSeconds: IP_RATE_LIMIT_WINDOW_SECONDS,
    },
  ].filter((identifier) => identifier.value);
  const references = identifiers.map((identifier) =>
    db
      .collection(RATE_LIMITS_COLLECTION)
      .doc(rateLimitDocumentId(identifier.kind, identifier.value)),
  );

  return db.runTransaction<RegistrationResult>(async (transaction) => {
    const snapshots = await transaction.getAll(...references);
    const nowMs = Date.now();
    let retryAfterSeconds = 0;

    snapshots.forEach((snapshot, index) => {
      const data = snapshot.data();
      const expiresAtMs = getTimestampMillis(data?.windowExpiresAt);
      const count = expiresAtMs > nowMs ? Number(data?.count ?? 0) : 0;

      if (count >= identifiers[index].maxAttempts) {
        retryAfterSeconds = Math.max(
          retryAfterSeconds,
          Math.max(1, Math.ceil((expiresAtMs - nowMs) / 1000)),
        );
      }
    });

    if (retryAfterSeconds) {
      return { ok: false, error: "rate_limited", retryAfterSeconds };
    }

    snapshots.forEach((snapshot, index) => {
      const data = snapshot.data();
      const currentExpiryMs = getTimestampMillis(data?.windowExpiresAt);
      const isActive = currentExpiryMs > nowMs;
      const windowExpiresAtMs = isActive
        ? currentExpiryMs
        : nowMs + identifiers[index].windowSeconds * 1000;

      transaction.set(references[index], {
        kind: identifiers[index].kind,
        count: isActive ? Number(data?.count ?? 0) + 1 : 1,
        windowExpiresAt: Timestamp.fromMillis(windowExpiresAtMs),
        expiresAt: Timestamp.fromMillis(windowExpiresAtMs),
        updatedAt: Timestamp.fromMillis(nowMs),
      });
    });

    return { ok: true };
  });
}

async function reserveEmailSend(email: string, clientIp: string) {
  const db = getRegistrationFirestore();
  const identifiers: RateLimitIdentifier[] = [
    {
      kind: "otp-email",
      value: email,
      maxAttempts: EMAIL_SEND_MAX_ATTEMPTS,
      windowSeconds: EMAIL_SEND_WINDOW_SECONDS,
    },
    {
      kind: "otp-ip",
      value: clientIp,
      maxAttempts: IP_EMAIL_SEND_MAX_ATTEMPTS,
      windowSeconds: EMAIL_SEND_WINDOW_SECONDS,
    },
  ].filter((identifier) => identifier.value);
  const references = identifiers.map((identifier) =>
    db
      .collection(RATE_LIMITS_COLLECTION)
      .doc(rateLimitDocumentId(identifier.kind, identifier.value)),
  );

  return db.runTransaction<RegistrationResult>(async (transaction) => {
    const snapshots = await transaction.getAll(...references);
    const nowMs = Date.now();
    const emailData = snapshots[0]?.data();
    const cooldownUntilMs = getTimestampMillis(emailData?.cooldownUntil);

    if (cooldownUntilMs > nowMs) {
      return {
        ok: false,
        error: "code_recently_sent",
        retryAfterSeconds: Math.max(1, Math.ceil((cooldownUntilMs - nowMs) / 1000)),
      };
    }

    let retryAfterSeconds = 0;
    snapshots.forEach((snapshot, index) => {
      const data = snapshot.data();
      const currentWindowExpiresAtMs = getTimestampMillis(data?.windowExpiresAt);
      const isActiveWindow = currentWindowExpiresAtMs > nowMs;
      const sendCount = isActiveWindow ? Number(data?.count ?? 0) : 0;

      if (sendCount >= identifiers[index].maxAttempts) {
        retryAfterSeconds = Math.max(
          retryAfterSeconds,
          Math.max(1, Math.ceil((currentWindowExpiresAtMs - nowMs) / 1000)),
        );
      }
    });

    if (retryAfterSeconds) {
      return {
        ok: false,
        error: "rate_limited",
        retryAfterSeconds,
      };
    }

    const cooldownExpiresAtMs = nowMs + EMAIL_SEND_COOLDOWN_SECONDS * 1000;

    snapshots.forEach((snapshot, index) => {
      const data = snapshot.data();
      const currentWindowExpiresAtMs = getTimestampMillis(data?.windowExpiresAt);
      const isActiveWindow = currentWindowExpiresAtMs > nowMs;
      const windowExpiresAtMs = isActiveWindow
        ? currentWindowExpiresAtMs
        : nowMs + identifiers[index].windowSeconds * 1000;
      const nextData: Record<string, unknown> = {
        kind: identifiers[index].kind,
        count: isActiveWindow ? Number(data?.count ?? 0) + 1 : 1,
        windowExpiresAt: Timestamp.fromMillis(windowExpiresAtMs),
        expiresAt: Timestamp.fromMillis(
          identifiers[index].kind === "otp-email"
            ? Math.max(windowExpiresAtMs, cooldownExpiresAtMs)
            : windowExpiresAtMs,
        ),
        updatedAt: Timestamp.fromMillis(nowMs),
      };

      if (identifiers[index].kind === "otp-email") {
        nextData.cooldownUntil = Timestamp.fromMillis(cooldownExpiresAtMs);
      }

      transaction.set(references[index], nextData);
    });

    return { ok: true };
  });
}

function getResendConfig(): ResendConfig | null {
  const apiKey = clean(process.env.RESEND_API_KEY);
  const from = clean(process.env.RESEND_FROM);

  if (!apiKey || !from) {
    return null;
  }

  return {
    apiKey,
    from,
    replyTo: clean(process.env.RESEND_REPLY_TO),
  };
}

function getOtpSecret() {
  const secret = clean(process.env.REGISTRATION_OTP_SECRET);

  return secret.length >= 32 ? secret : "";
}

function shouldSendRegistrationSuccessEmail() {
  return clean(process.env.SEND_REGISTRATION_SUCCESS_EMAIL).toLowerCase() !== "false";
}

function createVerificationCode() {
  return String(randomInt(100_000, 1_000_000));
}

function hashVerificationCode(verificationId: string, code: string, secret: string) {
  return createHmac("sha256", secret).update(`${verificationId}:${code}`).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function maskEmail(value: string) {
  const email = normalizeEmail(value);
  const [local, domain] = email.split("@");

  if (!local || !domain) {
    return email;
  }

  const visibleStart = local.slice(0, 1);
  const visibleEnd = local.length > 3 ? local.slice(-1) : "";
  const hiddenLength = Math.max(2, Math.min(6, local.length - visibleEnd.length - 1));
  return `${visibleStart}${"*".repeat(hiddenLength)}${visibleEnd}@${domain}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function buildVerificationEmailHtml(code: string) {
  return [
    '<div style="margin:0;background:#f1f5fb;padding:32px 16px;font-family:Arial,sans-serif;color:#081f5c">',
    '<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #d0e3ff;padding:32px">',
    '<p style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;color:#334eac">Hackathon INHACK</p>',
    '<h1 style="margin:0 0 16px;font-size:24px;line-height:1.2">Confirma tu correo</h1>',
    '<p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#33415c">Ingresa este codigo en el formulario para completar tu registro:</p>',
    `<div style="margin:0 0 24px;background:#d0e3ff;padding:18px;text-align:center;font-size:32px;font-weight:800;letter-spacing:8px;color:#081f5c">${code}</div>`,
    '<p style="margin:0;font-size:13px;line-height:1.5;color:#5d6472">El codigo vence en 10 minutos y solo puede utilizarse una vez. Si no solicitaste este registro, ignora este mensaje.</p>',
    "</div></div>",
  ].join("");
}

function buildRegistrationSuccessEmailHtml(data: SuccessEmailData) {
  const nombre = escapeHtml(data.nombreCompleto);
  const escuela = escapeHtml(data.escuelaProcedencia);
  const grado = escapeHtml(data.gradoEscolar);

  return [
    '<div style="margin:0;background:#f1f5fb;padding:32px 16px;font-family:Arial,sans-serif;color:#081f5c">',
    '<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #d0e3ff;padding:32px">',
    '<p style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;color:#334eac">Hackathon INHACK</p>',
    '<h1 style="margin:0 0 16px;font-size:24px;line-height:1.2">Registro confirmado</h1>',
    `<p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#33415c">Hola ${nombre}, tu registro fue confirmado correctamente.</p>`,
    '<div style="margin:0 0 20px;background:#f7fbff;border:1px solid #d0e3ff;padding:18px">',
    `<p style="margin:0 0 8px;font-size:14px;line-height:1.5"><strong>Nombre:</strong> ${nombre}</p>`,
    `<p style="margin:0 0 8px;font-size:14px;line-height:1.5"><strong>Escuela:</strong> ${escuela}</p>`,
    `<p style="margin:0;font-size:14px;line-height:1.5"><strong>Grado:</strong> ${grado}</p>`,
    "</div>",
    '<p style="margin:0;font-size:13px;line-height:1.5;color:#5d6472">Conserva este correo como comprobante. Si necesitas corregir algun dato, responde a este mensaje.</p>',
    "</div></div>",
  ].join("");
}

async function sendResendEmail(
  config: ResendConfig,
  payload: Record<string, unknown>,
  idempotencyKey: string,
  logLabel: string,
): Promise<RegistrationResult> {
  const requestPayload: Record<string, unknown> = {
    from: config.from,
    ...payload,
  };

  if (config.replyTo) {
    requestPayload.reply_to = config.replyTo;
  }

  try {
    const response = await fetch(RESEND_EMAIL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
        "User-Agent": "INHACK-Registration/3.0",
      },
      body: JSON.stringify(requestPayload),
      signal: AbortSignal.timeout(EXTERNAL_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(`Resend rejected ${logLabel} with status ${response.status}.`);
      return {
        ok: false,
        error: response.status === 429 ? "email_provider_rate_limited" : "email_send_failed",
      };
    }

    return { ok: true };
  } catch (error) {
    console.error(`Resend request failed for ${logLabel}.`, error);
    return { ok: false, error: "email_send_failed" };
  }
}

async function sendVerificationEmail(
  config: ResendConfig,
  email: string,
  code: string,
  verificationId: string,
): Promise<RegistrationResult> {
  return sendResendEmail(
    config,
    {
    to: [email],
    subject: "Tu codigo de confirmacion | Hackathon INHACK",
    text: [
      `Tu codigo de confirmacion es: ${code}`,
      "",
      "El codigo vence en 10 minutos y solo puede utilizarse una vez.",
      "Si no solicitaste este registro, puedes ignorar este mensaje.",
    ].join("\n"),
    html: buildVerificationEmailHtml(code),
    tags: [{ name: "category", value: "registration_otp" }],
    },
    `registration-otp/${verificationId}`,
    "a registration OTP email",
  );
}

async function sendRegistrationSuccessEmail(
  config: ResendConfig,
  data: SuccessEmailData,
): Promise<RegistrationResult> {
  return sendResendEmail(
    config,
    {
      to: [data.correoElectronico],
      subject: "Registro confirmado | Hackathon INHACK",
      text: [
        `Hola ${data.nombreCompleto}, tu registro al Hackathon INHACK fue confirmado correctamente.`,
        "",
        "Datos:",
        `Nombre: ${data.nombreCompleto}`,
        `Escuela: ${data.escuelaProcedencia}`,
        `Grado: ${data.gradoEscolar}`,
        "",
        "Conserva este correo como comprobante. Si necesitas corregir algun dato, responde a este mensaje.",
      ].join("\n"),
      html: buildRegistrationSuccessEmailHtml(data),
      tags: [{ name: "category", value: "registration_success" }],
    },
    `registration-success/${data.registrationId}`,
    "a registration success email",
  );
}

async function verifyTurnstile(token: string, clientIp: string): Promise<RegistrationResult> {
  const secret = clean(process.env.TURNSTILE_SECRET_KEY);
  if (!secret) {
    return { ok: false, error: "turnstile_not_configured" };
  }

  if (!token || token.length > 2_048) {
    return { ok: false, error: "captcha_failed" };
  }

  const body = new URLSearchParams({
    secret,
    response: token,
    idempotency_key: randomUUID(),
  });
  if (clientIp) {
    body.set("remoteip", clientIp);
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(EXTERNAL_REQUEST_TIMEOUT_MS),
    });
    const result = (await response.json()) as { success?: boolean; hostname?: string };

    if (!response.ok || result.success !== true) {
      return { ok: false, error: "captcha_failed" };
    }

    const allowedHostnames = clean(process.env.TURNSTILE_ALLOWED_HOSTNAMES)
      .split(",")
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean);

    if (
      allowedHostnames.length > 0 &&
      (!result.hostname || !allowedHostnames.includes(result.hostname.toLowerCase()))
    ) {
      return { ok: false, error: "captcha_failed" };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "captcha_failed" };
  }
}

async function findDuplicate(normalized: NormalizedRegistration) {
  const db = getRegistrationFirestore();
  const references = UNIQUE_FIELDS.map((field) =>
    db.collection(UNIQUE_KEYS_COLLECTION).doc(uniqueDocumentId(field, normalized[field])),
  );
  const snapshots = await db.getAll(...references);
  const duplicateIndex = snapshots.findIndex((snapshot) => snapshot.exists);

  return duplicateIndex >= 0 ? UNIQUE_FIELDS[duplicateIndex] : "";
}

export async function requestEmailCode(
  data: RegistrationInput,
  clientIp: string,
): Promise<RegistrationResult> {
  if (clean(data.website)) {
    return {
      ok: true,
      ignored: true,
      verificationRequired: true,
      verificationId: randomUUID(),
      maskedEmail: maskEmail(data.correoElectronico),
      expiresInSeconds: VERIFICATION_TTL_SECONDS,
    };
  }

  const validation = validateRegistration(data);
  if (!validation.ok || !("normalized" in validation)) {
    return validation;
  }

  const resendConfig = getResendConfig();
  if (!resendConfig) {
    return { ok: false, error: "resend_not_configured" };
  }

  const otpSecret = getOtpSecret();
  if (!otpSecret) {
    return { ok: false, error: "otp_not_configured" };
  }

  const turnstile = await verifyTurnstile(clean(data.turnstileToken), clientIp);
  if (!turnstile.ok) {
    return turnstile;
  }

  const requestLimit = await checkRequestRateLimit(validation.normalized, clientIp);
  if (!requestLimit.ok) {
    return requestLimit;
  }

  const duplicateField = await findDuplicate(validation.normalized);
  if (duplicateField) {
    return { ok: false, error: "duplicate_registration", field: duplicateField };
  }

  const emailLimit = await reserveEmailSend(validation.normalized.correoElectronico, clientIp);
  if (!emailLimit.ok) {
    return emailLimit;
  }

  const db = getRegistrationFirestore();
  const verificationId = randomUUID();
  const verificationCode = createVerificationCode();
  const nowMs = Date.now();
  const expiresAt = Timestamp.fromMillis(nowMs + VERIFICATION_TTL_SECONDS * 1000);
  const pendingReference = db.collection(PENDING_COLLECTION).doc(verificationId);

  await pendingReference.create({
    codeHash: hashVerificationCode(verificationId, verificationCode, otpSecret),
    attempts: 0,
    createdAt: Timestamp.fromMillis(nowMs),
    expiresAt,
    data: sanitizeRegistrationData(data),
    normalized: validation.normalized,
    initialSubmissionId: clean(data.submissionId),
  } satisfies PendingRegistration & { createdAt: Timestamp });

  const emailResult = await sendVerificationEmail(
    resendConfig,
    validation.normalized.correoElectronico,
    verificationCode,
    verificationId,
  );

  if (!emailResult.ok) {
    await pendingReference.delete().catch(() => undefined);
    return emailResult;
  }

  return {
    ok: true,
    verificationRequired: true,
    verificationId,
    maskedEmail: maskEmail(validation.normalized.correoElectronico),
    expiresInSeconds: VERIFICATION_TTL_SECONDS,
  };
}

export async function confirmEmailCode(data: RegistrationInput): Promise<RegistrationResult> {
  const verificationId = clean(data.verificationId);
  const verificationCode = clean(data.verificationCode);

  if (!verificationId || verificationId.length > 128 || !/^\d{6}$/.test(verificationCode)) {
    return { ok: false, error: "invalid_verification_code" };
  }

  const otpSecret = getOtpSecret();
  if (!otpSecret) {
    return { ok: false, error: "otp_not_configured" };
  }

  const db = getRegistrationFirestore();
  const pendingReference = db.collection(PENDING_COLLECTION).doc(verificationId);

  const result = await db.runTransaction<ConfirmEmailTransactionResult>(async (transaction) => {
    const pendingSnapshot = await transaction.get(pendingReference);
    if (!pendingSnapshot.exists) {
      return { ok: false, error: "verification_expired" };
    }

    const pending = pendingSnapshot.data() as PendingRegistration;
    const nowMs = Date.now();
    if (getTimestampMillis(pending.expiresAt) <= nowMs) {
      transaction.delete(pendingReference);
      return { ok: false, error: "verification_expired" };
    }

    const receivedHash = hashVerificationCode(verificationId, verificationCode, otpSecret);
    if (!safeEqual(receivedHash, clean(pending.codeHash))) {
      const attempts = Number(pending.attempts ?? 0) + 1;
      const attemptsRemaining = Math.max(0, VERIFICATION_MAX_ATTEMPTS - attempts);

      if (!attemptsRemaining) {
        transaction.delete(pendingReference);
        return { ok: false, error: "too_many_code_attempts", attemptsRemaining: 0 };
      }

      transaction.update(pendingReference, { attempts, updatedAt: Timestamp.fromMillis(nowMs) });
      return { ok: false, error: "invalid_verification_code", attemptsRemaining };
    }

    const uniqueReferences = UNIQUE_FIELDS.map((field) =>
      db
        .collection(UNIQUE_KEYS_COLLECTION)
        .doc(uniqueDocumentId(field, pending.normalized[field])),
    );
    const uniqueSnapshots = await transaction.getAll(...uniqueReferences);
    const duplicateIndex = uniqueSnapshots.findIndex((snapshot) => snapshot.exists);

    if (duplicateIndex >= 0) {
      transaction.delete(pendingReference);
      return {
        ok: false,
        error: "duplicate_registration",
        field: UNIQUE_FIELDS[duplicateIndex],
      };
    }

    const registrationReference = db.collection(REGISTRATIONS_COLLECTION).doc();
    const registeredAt = Timestamp.fromMillis(nowMs);
    transaction.create(registrationReference, {
      ...pending.data,
      normalized: pending.normalized,
      emailVerified: true,
      emailVerifiedAt: registeredAt,
      registeredAt,
      source: RESPONSE_SOURCE,
      initialSubmissionId: pending.initialSubmissionId,
      confirmationSubmissionId: clean(data.submissionId),
    });

    uniqueReferences.forEach((reference, index) => {
      transaction.create(reference, {
        field: UNIQUE_FIELDS[index],
        registrationId: registrationReference.id,
        createdAt: registeredAt,
      });
    });

    transaction.delete(pendingReference);
    return {
      ok: true,
      emailVerified: true,
      successEmailData: {
        registrationId: registrationReference.id,
        nombreCompleto: pending.data.nombreCompleto,
        correoElectronico: pending.normalized.correoElectronico,
        gradoEscolar: pending.data.gradoEscolar,
        escuelaProcedencia: pending.data.escuelaProcedencia,
      },
    };
  });

  if (result.ok && result.successEmailData && shouldSendRegistrationSuccessEmail()) {
    const resendConfig = getResendConfig();
    if (resendConfig) {
      const successEmail = await sendRegistrationSuccessEmail(resendConfig, result.successEmailData);
      if (!successEmail.ok) {
        console.error(`Registration succeeded but success email failed: ${successEmail.error}.`);
      }
    } else {
      console.error("Registration succeeded but success email is not configured.");
    }
  }

  const response = { ...result };
  delete response.successEmailData;
  return response;
}
