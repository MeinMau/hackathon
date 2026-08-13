const appsScriptUrl =
  process.env.REGISTRATION_WEB_APP_URL || process.env.NEXT_PUBLIC_REGISTRATION_WEB_APP_URL;
const appsScriptTimeoutMs = 20000;
const maxRequestBytes = 32_000;
const expectedSource = "hackathon-registration";
const expectedVersion = "turnstile-email-otp-v2";
const versionCheckTtlMs = 5 * 60 * 1000;
let versionVerifiedAt = 0;
const forwardedFields = [
  "action",
  "source",
  "website",
  "submissionId",
  "verificationId",
  "verificationCode",
  "nombreCompleto",
  "telefono",
  "correoElectronico",
  "gradoEscolar",
  "escuelaProcedencia",
  "matriculaEscolar",
  "tecnologias",
  "hardSkills",
  "softSkills",
  "reglamento",
  "cf-turnstile-response",
] as const;

export const runtime = "nodejs";

type AppsScriptResponse = {
  ok?: boolean;
  ignored?: boolean;
  error?: string;
  field?: string;
  fields?: string[];
  retryAfterSeconds?: number;
  source?: string;
  version?: string;
  submissionId?: string;
  verificationRequired?: boolean;
  verificationId?: string;
  maskedEmail?: string;
  expiresInSeconds?: number;
  attemptsRemaining?: number;
  emailVerified?: boolean;
};

function jsonResponse(payload: AppsScriptResponse, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function verifyAppsScriptVersion() {
  if (Date.now() - versionVerifiedAt < versionCheckTtlMs) {
    return { ok: true };
  }

  try {
    const response = await fetch(appsScriptUrl as string, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(appsScriptTimeoutMs),
    });
    const payload = (await response.json()) as AppsScriptResponse;

    if (!response.ok || payload.version !== expectedVersion) {
      return { ok: false, error: "apps_script_version_mismatch" };
    }

    versionVerifiedAt = Date.now();
    return { ok: true };
  } catch {
    return { ok: false, error: "apps_script_unreachable" };
  }
}

export async function POST(request: Request) {
  if (!appsScriptUrl) {
    return jsonResponse({ ok: false, error: "not_configured" }, 500);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > maxRequestBytes) {
    return jsonResponse({ ok: false, error: "request_too_large" }, 413);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_request" }, 400);
  }

  const body = new URLSearchParams();

  for (const key of forwardedFields) {
    const value = formData.get(key);
    if (typeof value === "string") {
      body.set(key, value);
    }
  }

  const submissionId = body.get("submissionId") || "";
  const action = body.get("action") || "";
  if (
    !submissionId ||
    !["request_email_code", "confirm_email_code"].includes(action)
  ) {
    return jsonResponse({ ok: false, error: "invalid_request" }, 400);
  }

  body.set("responseMode", "json");

  const versionCheck = await verifyAppsScriptVersion();
  if (!versionCheck.ok) {
    return jsonResponse({ ok: false, error: versionCheck.error }, 503);
  }

  try {
    const response = await fetch(appsScriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body,
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(appsScriptTimeoutMs),
    });
    const text = await response.text();

    if (!response.ok) {
      return jsonResponse({ ok: false, error: "apps_script_http_error" }, 502);
    }

    try {
      const payload = JSON.parse(text) as AppsScriptResponse;

      if (
        payload.source !== expectedSource ||
        payload.submissionId !== submissionId ||
        typeof payload.ok !== "boolean"
      ) {
        return jsonResponse({ ok: false, error: "invalid_apps_script_response" }, 502);
      }

      return jsonResponse(payload);
    } catch {
      return jsonResponse({ ok: false, error: "invalid_apps_script_response" }, 502);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return jsonResponse({ ok: false, error: "apps_script_timeout" }, 504);
    }

    return jsonResponse({ ok: false, error: "apps_script_unreachable" }, 502);
  }
}
