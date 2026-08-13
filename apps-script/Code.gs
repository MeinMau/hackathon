const SHEET_NAME = "Registros";
const PROTECTION_VERSION = "turnstile-duplicates-v1";
const RESPONSE_SOURCE = "hackathon-registration";
const TURNSTILE_SECRET_PROPERTY = "TURNSTILE_SECRET_KEY";
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const RATE_LIMIT_WINDOW_SECONDS = 10 * 60;
const RATE_LIMIT_MAX_ATTEMPTS = 3;

const HEADERS = [
  "Fecha de registro",
  "Nombre completo",
  "Numero de telefono",
  "Correo electronico",
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
    if (String(data.website || "").trim()) {
      return respond({ ok: true, ignored: true });
    }

    const missingFields = REQUIRED_FIELDS.filter((field) => !String(data[field] || "").trim());
    if (missingFields.length) {
      return respond({ ok: false, error: "missing_fields", fields: missingFields });
    }

    if (!["preparatoria", "universidad"].includes(String(data.gradoEscolar))) {
      return respond({ ok: false, error: "invalid_grade" });
    }

    const normalized = normalizeRegistration_(data);

    if (!isValidEmail_(normalized.correoElectronico)) {
      return respond({ ok: false, error: "invalid_email" });
    }

    if (normalized.telefono.length < 10) {
      return respond({ ok: false, error: "invalid_phone" });
    }

    const rateLimit = checkRateLimit_(normalized);
    if (!rateLimit.ok) {
      return respond(
        {
          ok: false,
          error: "rate_limited",
          retryAfterSeconds: RATE_LIMIT_WINDOW_SECONDS,
        }
      );
    }

    const turnstile = verifyTurnstile_(clean_(data["cf-turnstile-response"]));
    if (!turnstile.ok) {
      return respond({ ok: false, error: turnstile.error });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const sheet = getRegistrationSheet_();
      const duplicate = findDuplicate_(sheet, normalized);

      if (duplicate) {
        return respond(
          {
            ok: false,
            error: "duplicate_registration",
            field: duplicate.field,
          }
        );
      }

      sheet.appendRow([
        new Date(),
        clean_(data.nombreCompleto),
        clean_(data.telefono),
        clean_(data.correoElectronico),
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
    } finally {
      lock.releaseLock();
    }

    return respond({ ok: true });
  } catch (error) {
    console.error(error);
    return respond({ ok: false, error: "internal_error" });
  }
}

function doGet() {
  return jsonResponse_({
    ok: true,
    version: PROTECTION_VERSION,
    message: "Registro Hackathon ISND - INGENIA activo",
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
      correoElectronico: clean_(row[11]) || normalizeEmail_(row[3]),
      telefono: clean_(row[12]) || normalizePhone_(row[2]),
      matriculaEscolar: clean_(row[13]) || normalizeMatricula_(row[6]),
      nombreCompleto: clean_(row[14]) || normalizeText_(row[1]),
    };

    if (normalized.correoElectronico && normalized.correoElectronico === rowNormalized.correoElectronico) {
      return { field: "correoElectronico" };
    }

    if (normalized.telefono && normalized.telefono === rowNormalized.telefono) {
      return { field: "telefono" };
    }

    if (normalized.matriculaEscolar && normalized.matriculaEscolar === rowNormalized.matriculaEscolar) {
      return { field: "matriculaEscolar" };
    }

    if (normalized.nombreCompleto && normalized.nombreCompleto === rowNormalized.nombreCompleto) {
      return { field: "nombreCompleto" };
    }
  }

  return null;
}

function checkRateLimit_(normalized) {
  const cache = CacheService.getScriptCache();
  const keys = [
    normalized.correoElectronico ? cacheKey_("email", normalized.correoElectronico) : "",
    normalized.telefono ? cacheKey_("phone", normalized.telefono) : "",
    normalized.matriculaEscolar ? cacheKey_("student", normalized.matriculaEscolar) : "",
  ].filter(Boolean);

  if (!keys.length) {
    keys.push(cacheKey_("anonymous", "missing-identity"));
  }

  const currentValues = keys.map((key) => Number(cache.get(key) || 0));
  const isLimited = currentValues.some((count) => count >= RATE_LIMIT_MAX_ATTEMPTS);

  if (isLimited) {
    return { ok: false };
  }

  keys.forEach((key, index) => {
    cache.put(key, String(currentValues[index] + 1), RATE_LIMIT_WINDOW_SECONDS);
  });

  return { ok: true };
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
  return `${prefix}:${Utilities.base64EncodeWebSafe(digest).slice(0, 43)}`;
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
  const html = `<!doctype html><html><body><script>window.parent.postMessage(${payloadJson}, "*");</script></body></html>`;

  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
