const SHEET_NAME = "Registros";
const PROTECTION_VERSION = "turnstile-email-otp-v2";
const RESPONSE_SOURCE = "hackathon-registration";
const REQUEST_CODE_ACTION = "request_email_code";
const CONFIRM_CODE_ACTION = "confirm_email_code";

const TURNSTILE_SECRET_PROPERTY = "TURNSTILE_SECRET_KEY";
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const RESEND_API_KEY_PROPERTY = "RESEND_API_KEY";
const RESEND_FROM_PROPERTY = "RESEND_FROM";
const RESEND_REPLY_TO_PROPERTY = "RESEND_REPLY_TO";
const RESEND_EMAIL_URL = "https://api.resend.com/emails";

const RATE_LIMIT_WINDOW_SECONDS = 10 * 60;
const RATE_LIMIT_MAX_ATTEMPTS = 3;
const EMAIL_SEND_WINDOW_SECONDS = 60 * 60;
const EMAIL_SEND_MAX_ATTEMPTS = 3;
const EMAIL_SEND_COOLDOWN_SECONDS = 60;
const VERIFICATION_TTL_SECONDS = 10 * 60;
const VERIFICATION_MAX_ATTEMPTS = 5;

const HEADERS = [
  "Fecha de registro",
  "Nombre completo",
  "Numero de telefono",
  "Correo electronico",
  "Edad",
  "Genero",
  "Grado escolar",
  "Escuela de procedencia",
  "Matricula escolar",
  "Acepta reglamento",
  "Tecnologias que usa",
  "Hard Skills",
  "Soft Skills",
  "Correo normalizado",
  "Telefono normalizado",
  "Matricula normalizada",
  "Nombre normalizado",
];

const REQUIRED_FIELDS = [
  "nombreCompleto",
  "telefono",
  "correoElectronico",
  "edad",
  "genero",
  "gradoEscolar",
  "escuelaProcedencia",
  "matriculaEscolar",
  "reglamento",
];

function doPost(e) {
  const data = parseRequestData_(e);
  const submissionId = clean_(data.submissionId);
  const responseMode = clean_(data.responseMode);
  const respond = (payload) => formResponse_(payload, submissionId, responseMode);

  try {
    const action = clean_(data.action);

    if (action === REQUEST_CODE_ACTION) {
      return respond(requestEmailCode_(data));
    }

    if (action === CONFIRM_CODE_ACTION) {
      return respond(confirmEmailCode_(data));
    }

    return respond({ ok: false, error: "invalid_action" });
  } catch (error) {
    console.error(error);
    return respond({ ok: false, error: "internal_error" });
  }
}

function requestEmailCode_(data) {
  if (clean_(data.website)) {
    return {
      ok: true,
      ignored: true,
      verificationRequired: true,
      verificationId: Utilities.getUuid(),
      maskedEmail: maskEmail_(data.correoElectronico),
      expiresInSeconds: VERIFICATION_TTL_SECONDS,
    };
  }

  const validation = validateRegistration_(data);
  if (!validation.ok) {
    return validation;
  }

  const resendConfig = getResendConfig_();
  if (!resendConfig.ok) {
    return resendConfig;
  }

  const requestLimit = checkRequestRateLimit_(validation.normalized);
  if (!requestLimit.ok) {
    return requestLimit;
  }

  const turnstile = verifyTurnstile_(clean_(data["cf-turnstile-response"]));
  if (!turnstile.ok) {
    return turnstile;
  }

  const duplicate = findDuplicateWithLock_(validation.normalized);
  if (duplicate) {
    return {
      ok: false,
      error: "duplicate_registration",
      field: duplicate.field,
    };
  }

  const emailLimit = reserveEmailSend_(validation.normalized.correoElectronico);
  if (!emailLimit.ok) {
    return emailLimit;
  }

  const verificationId = Utilities.getUuid();
  const verificationCode = createVerificationCode_();
  const expiresAt = Date.now() + VERIFICATION_TTL_SECONDS * 1000;
  const pendingRegistration = {
    codeHash: hashVerificationCode_(verificationId, verificationCode),
    attempts: 0,
    expiresAt,
    data: sanitizeRegistrationData_(data),
    normalized: validation.normalized,
  };
  const cache = CacheService.getScriptCache();
  const pendingKey = verificationCacheKey_(verificationId);

  cache.put(pendingKey, JSON.stringify(pendingRegistration), VERIFICATION_TTL_SECONDS);

  const emailResult = sendVerificationEmail_(
    resendConfig,
    validation.normalized.correoElectronico,
    verificationCode,
    verificationId
  );

  if (!emailResult.ok) {
    cache.remove(pendingKey);
    return emailResult;
  }

  return {
    ok: true,
    verificationRequired: true,
    verificationId,
    maskedEmail: maskEmail_(validation.normalized.correoElectronico),
    expiresInSeconds: VERIFICATION_TTL_SECONDS,
  };
}

function confirmEmailCode_(data) {
  const verificationId = clean_(data.verificationId);
  const verificationCode = clean_(data.verificationCode);

  if (!verificationId || !/^\d{6}$/.test(verificationCode)) {
    return { ok: false, error: "invalid_verification_code" };
  }

  const cache = CacheService.getScriptCache();
  const pendingKey = verificationCacheKey_(verificationId);
  const cachedValue = cache.get(pendingKey);

  if (!cachedValue) {
    return { ok: false, error: "verification_expired" };
  }

  let pendingRegistration;
  try {
    pendingRegistration = JSON.parse(cachedValue);
  } catch (error) {
    cache.remove(pendingKey);
    return { ok: false, error: "verification_expired" };
  }

  const remainingSeconds = Math.max(
    0,
    Math.ceil((Number(pendingRegistration.expiresAt) - Date.now()) / 1000)
  );

  if (!remainingSeconds) {
    cache.remove(pendingKey);
    return { ok: false, error: "verification_expired" };
  }

  const receivedHash = hashVerificationCode_(verificationId, verificationCode);
  if (!safeEqual_(receivedHash, clean_(pendingRegistration.codeHash))) {
    pendingRegistration.attempts = Number(pendingRegistration.attempts || 0) + 1;
    const attemptsRemaining = Math.max(
      0,
      VERIFICATION_MAX_ATTEMPTS - pendingRegistration.attempts
    );

    if (!attemptsRemaining) {
      cache.remove(pendingKey);
      return { ok: false, error: "too_many_code_attempts", attemptsRemaining: 0 };
    }

    cache.put(pendingKey, JSON.stringify(pendingRegistration), remainingSeconds);
    return {
      ok: false,
      error: "invalid_verification_code",
      attemptsRemaining,
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getRegistrationSheet_();
    const duplicate = findDuplicate_(sheet, pendingRegistration.normalized);

    if (duplicate) {
      cache.remove(pendingKey);
      return {
        ok: false,
        error: "duplicate_registration",
        field: duplicate.field,
      };
    }

    appendRegistration_(sheet, pendingRegistration.data, pendingRegistration.normalized);
  } finally {
    lock.releaseLock();
  }

  cache.remove(pendingKey);
  return { ok: true, emailVerified: true };
}

function validateRegistration_(data) {
  const missingFields = REQUIRED_FIELDS.filter((field) => !clean_(data[field]));
  if (missingFields.length) {
    return { ok: false, error: "missing_fields", fields: missingFields };
  }

  if (!["preparatoria", "universidad"].includes(clean_(data.gradoEscolar))) {
    return { ok: false, error: "invalid_grade" };
  }

  const edad = Number(clean_(data.edad));
  if (!Number.isInteger(edad) || edad < 12 || edad > 99) {
    return { ok: false, error: "invalid_age" };
  }

  if (
    ["femenino", "masculino", "no_binario", "prefiero_no_decirlo", "otro"].indexOf(
      clean_(data.genero)
    ) === -1
  ) {
    return { ok: false, error: "invalid_gender" };
  }

  const normalized = normalizeRegistration_(data);

  if (!isValidEmail_(normalized.correoElectronico)) {
    return { ok: false, error: "invalid_email" };
  }

  if (normalized.telefono.length !== 10) {
    return { ok: false, error: "invalid_phone" };
  }

  if (
    clean_(data.nombreCompleto).length > 120 ||
    clean_(data.telefono).length > 30 ||
    clean_(data.correoElectronico).length > 254 ||
    clean_(data.edad).length > 3 ||
    clean_(data.escuelaProcedencia).length > 140 ||
    clean_(data.matriculaEscolar).length > 60 ||
    clean_(data.tecnologias).length > 600 ||
    clean_(data.hardSkills).length > 600 ||
    clean_(data.softSkills).length > 600
  ) {
    return { ok: false, error: "invalid_field_length" };
  }

  return { ok: true, normalized };
}

function getResendConfig_() {
  const properties = PropertiesService.getScriptProperties();
  const apiKey = clean_(properties.getProperty(RESEND_API_KEY_PROPERTY));
  const from = clean_(properties.getProperty(RESEND_FROM_PROPERTY));
  const replyTo = clean_(properties.getProperty(RESEND_REPLY_TO_PROPERTY));

  if (!apiKey || !from) {
    return { ok: false, error: "resend_not_configured" };
  }

  return { ok: true, apiKey, from, replyTo };
}

function sendVerificationEmail_(config, email, code, verificationId) {
  const payload = {
    from: config.from,
    to: [email],
    subject: "Tu codigo de confirmacion | Hackathon INHACK",
    text: [
      "Tu codigo de confirmacion es: " + code,
      "",
      "El codigo vence en 10 minutos y solo puede utilizarse una vez.",
      "Si no solicitaste este registro, puedes ignorar este mensaje.",
    ].join("\n"),
    html: buildVerificationEmailHtml_(code),
    tags: [{ name: "category", value: "registration_otp" }],
  };

  if (config.replyTo) {
    payload.reply_to = config.replyTo;
  }

  try {
    const response = UrlFetchApp.fetch(RESEND_EMAIL_URL, {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + config.apiKey,
        "Idempotency-Key": "registration-otp/" + verificationId,
        "User-Agent": "INHACK-Registration/2.0",
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    const status = response.getResponseCode();

    if (status < 200 || status >= 300) {
      console.error("Resend error " + status + ": " + response.getContentText());
      return {
        ok: false,
        error: status === 429 ? "email_provider_rate_limited" : "email_send_failed",
      };
    }

    return { ok: true };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "email_send_failed" };
  }
}

function buildVerificationEmailHtml_(code) {
  return [
    '<div style="margin:0;background:#f1f5fb;padding:32px 16px;font-family:Arial,sans-serif;color:#081f5c">',
    '<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #d0e3ff;padding:32px">',
    '<p style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;color:#334eac">Hackathon INHACK</p>',
    '<h1 style="margin:0 0 16px;font-size:24px;line-height:1.2">Confirma tu correo</h1>',
    '<p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#33415c">Ingresa este codigo en el formulario para completar tu registro:</p>',
    '<div style="margin:0 0 24px;background:#d0e3ff;padding:18px;text-align:center;font-size:32px;font-weight:800;letter-spacing:8px;color:#081f5c">' +
      code +
      "</div>",
    '<p style="margin:0;font-size:13px;line-height:1.5;color:#5d6472">El codigo vence en 10 minutos y solo puede utilizarse una vez. Si no solicitaste este registro, ignora este mensaje.</p>',
    "</div></div>",
  ].join("");
}

function checkRequestRateLimit_(normalized) {
  const cache = CacheService.getScriptCache();
  const keys = [
    normalized.correoElectronico ? cacheKey_("attempt-email", normalized.correoElectronico) : "",
    normalized.telefono ? cacheKey_("attempt-phone", normalized.telefono) : "",
    normalized.matriculaEscolar
      ? cacheKey_("attempt-student", normalized.matriculaEscolar)
      : "",
  ].filter(Boolean);
  const currentValues = keys.map((key) => Number(cache.get(key) || 0));

  if (currentValues.some((count) => count >= RATE_LIMIT_MAX_ATTEMPTS)) {
    return {
      ok: false,
      error: "rate_limited",
      retryAfterSeconds: RATE_LIMIT_WINDOW_SECONDS,
    };
  }

  keys.forEach((key, index) => {
    cache.put(key, String(currentValues[index] + 1), RATE_LIMIT_WINDOW_SECONDS);
  });

  return { ok: true };
}

function reserveEmailSend_(email) {
  const cache = CacheService.getScriptCache();
  const cooldownKey = cacheKey_("otp-cooldown", email);
  const hourlyKey = cacheKey_("otp-hour", email);

  if (cache.get(cooldownKey)) {
    return {
      ok: false,
      error: "code_recently_sent",
      retryAfterSeconds: EMAIL_SEND_COOLDOWN_SECONDS,
    };
  }

  const hourlyCount = Number(cache.get(hourlyKey) || 0);
  if (hourlyCount >= EMAIL_SEND_MAX_ATTEMPTS) {
    return {
      ok: false,
      error: "rate_limited",
      retryAfterSeconds: EMAIL_SEND_WINDOW_SECONDS,
    };
  }

  cache.put(cooldownKey, "1", EMAIL_SEND_COOLDOWN_SECONDS);
  cache.put(hourlyKey, String(hourlyCount + 1), EMAIL_SEND_WINDOW_SECONDS);
  return { ok: true };
}

function findDuplicateWithLock_(normalized) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    return findDuplicate_(getRegistrationSheet_(), normalized);
  } finally {
    lock.releaseLock();
  }
}

function appendRegistration_(sheet, data, normalized) {
  sheet.appendRow([
    new Date(),
    clean_(data.nombreCompleto),
    clean_(data.telefono),
    clean_(data.correoElectronico),
    clean_(data.edad),
    clean_(data.genero),
    clean_(data.gradoEscolar),
    clean_(data.escuelaProcedencia),
    clean_(data.matriculaEscolar),
    "Si",
    clean_(data.tecnologias),
    clean_(data.hardSkills),
    clean_(data.softSkills),
    normalized.correoElectronico,
    normalized.telefono,
    normalized.matriculaEscolar,
    normalized.nombreCompleto,
  ]);
  hideSecurityColumns_(sheet);
}

function sanitizeRegistrationData_(data) {
  return {
    nombreCompleto: clean_(data.nombreCompleto),
    telefono: clean_(data.telefono),
    correoElectronico: clean_(data.correoElectronico),
    edad: clean_(data.edad),
    genero: clean_(data.genero),
    gradoEscolar: clean_(data.gradoEscolar),
    escuelaProcedencia: clean_(data.escuelaProcedencia),
    matriculaEscolar: clean_(data.matriculaEscolar),
    reglamento: clean_(data.reglamento),
    tecnologias: clean_(data.tecnologias),
    hardSkills: clean_(data.hardSkills),
    softSkills: clean_(data.softSkills),
  };
}

function createVerificationCode_() {
  const seed = Utilities.getUuid() + ":" + Date.now() + ":" + Math.random();
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, seed);
  let value = 0;

  for (let index = 0; index < 6; index += 1) {
    value = (value * 256 + ((digest[index] + 256) % 256)) % 900000;
  }

  return String(value + 100000);
}

function hashVerificationCode_(verificationId, code) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    verificationId + ":" + code
  );
  return Utilities.base64EncodeWebSafe(digest);
}

function safeEqual_(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return difference === 0;
}

function verificationCacheKey_(verificationId) {
  return "registration-otp:" + verificationId;
}

function maskEmail_(value) {
  const email = normalizeEmail_(value);
  const parts = email.split("@");

  if (parts.length !== 2) {
    return email;
  }

  const local = parts[0];
  const visibleStart = local.slice(0, 1);
  const visibleEnd = local.length > 3 ? local.slice(-1) : "";
  const hiddenLength = Math.max(2, Math.min(6, local.length - visibleEnd.length - 1));
  return visibleStart + "*".repeat(hiddenLength) + visibleEnd + "@" + parts[1];
}

function testResendConfiguration() {
  const config = getResendConfig_();
  if (!config.ok) {
    throw new Error("Configura RESEND_API_KEY y RESEND_FROM en Propiedades del script.");
  }

  const recipient = clean_(Session.getActiveUser().getEmail());
  if (!recipient) {
    throw new Error("No se pudo identificar el correo de la cuenta activa.");
  }

  const result = sendVerificationEmail_(config, recipient, "123456", Utilities.getUuid());
  if (!result.ok) {
    throw new Error("Resend rechazo el correo. Revisa el registro de ejecucion.");
  }

  console.log("Correo de prueba enviado a " + recipient);
}

function doGet() {
  return jsonResponse_({
    ok: true,
    version: PROTECTION_VERSION,
    message: "Registro Hackathon INHACK activo",
  });
}

function setupSheet() {
  const sheet = getRegistrationSheet_();
  sheet.clear();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, HEADERS.length);
  hideSecurityColumns_(sheet);
}

function getRegistrationSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const hasHeaders = HEADERS.every((header, index) => firstRow[index] === header);

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }

  hideSecurityColumns_(sheet);
  return sheet;
}

function findDuplicate_(sheet, normalized) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return null;
  }

  const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNormalized = {
      correoElectronico: clean_(row[13]) || normalizeEmail_(row[3]),
      telefono: clean_(row[14]) || normalizePhone_(row[2]),
      matriculaEscolar: clean_(row[15]) || normalizeMatricula_(row[8]),
      nombreCompleto: clean_(row[16]) || normalizeText_(row[1]),
    };

    if (
      normalized.correoElectronico &&
      normalized.correoElectronico === rowNormalized.correoElectronico
    ) {
      return { field: "correoElectronico" };
    }

    if (normalized.telefono && normalized.telefono === rowNormalized.telefono) {
      return { field: "telefono" };
    }

    if (
      normalized.matriculaEscolar &&
      normalized.matriculaEscolar === rowNormalized.matriculaEscolar
    ) {
      return { field: "matriculaEscolar" };
    }

    if (
      normalized.nombreCompleto &&
      normalized.nombreCompleto === rowNormalized.nombreCompleto
    ) {
      return { field: "nombreCompleto" };
    }
  }

  return null;
}

function verifyTurnstile_(token) {
  const secret = PropertiesService.getScriptProperties().getProperty(TURNSTILE_SECRET_PROPERTY);

  if (!secret) {
    return { ok: false, error: "turnstile_not_configured" };
  }

  if (!token) {
    return { ok: false, error: "captcha_failed" };
  }

  try {
    const response = UrlFetchApp.fetch(TURNSTILE_VERIFY_URL, {
      method: "post",
      payload: {
        secret,
        response: token,
      },
      muteHttpExceptions: true,
    });
    const result = JSON.parse(response.getContentText() || "{}");

    if (response.getResponseCode() >= 500 || result.success !== true) {
      return { ok: false, error: "captcha_failed" };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: "captcha_failed" };
  }
}

function normalizeRegistration_(data) {
  return {
    nombreCompleto: normalizeText_(data.nombreCompleto),
    telefono: normalizePhone_(data.telefono),
    correoElectronico: normalizeEmail_(data.correoElectronico),
    matriculaEscolar: normalizeMatricula_(data.matriculaEscolar),
  };
}

function normalizeEmail_(value) {
  return clean_(value).toLowerCase();
}

function normalizePhone_(value) {
  return clean_(value).replace(/\D/g, "");
}

function normalizeMatricula_(value) {
  return clean_(value).toUpperCase().replace(/[\s-]+/g, "");
}

function normalizeText_(value) {
  return clean_(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isValidEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function cacheKey_(prefix, value) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value);
  return prefix + ":" + Utilities.base64EncodeWebSafe(digest).slice(0, 43);
}

function hideSecurityColumns_(sheet) {
  const startColumn = HEADERS.indexOf("Correo normalizado") + 1;

  if (startColumn > 0) {
    sheet.hideColumns(startColumn, HEADERS.length - startColumn + 1);
  }
}

function parseRequestData_(e) {
  if (e && e.parameter && Object.keys(e.parameter).length) {
    return e.parameter;
  }

  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  const contents = e.postData.contents;

  try {
    return JSON.parse(contents);
  } catch (error) {
    return e.parameter || {};
  }
}

function clean_(value) {
  return String(value || "").trim();
}

function formResponse_(payload, submissionId, responseMode) {
  const responsePayload = {
    source: RESPONSE_SOURCE,
    version: PROTECTION_VERSION,
    submissionId,
    ...payload,
  };

  if (responseMode === "json") {
    return jsonResponse_(responsePayload);
  }

  return htmlResponse_(responsePayload);
}

function htmlResponse_(payload) {
  const payloadJson = JSON.stringify(payload)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  const html =
    "<!doctype html><html><body><script>window.parent.postMessage(" +
    payloadJson +
    ', "*");</script></body></html>';

  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(
    HtmlService.XFrameOptionsMode.ALLOWALL
  );
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
