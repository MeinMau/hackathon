import { FirebaseConfigurationError } from "@/lib/firebase-admin";
import {
  confirmEmailCode,
  registrationResponseMetadata,
  requestEmailCode,
  type RegistrationInput,
  type RegistrationResult,
} from "@/lib/registration-service";

const maxRequestBytes = 32_000;
const allowedContentTypes = ["multipart/form-data", "application/x-www-form-urlencoded"];

export const runtime = "nodejs";

type RegistrationResponse = RegistrationResult & {
  source: string;
  version: string;
  submissionId: string;
};

function statusForResult(payload: RegistrationResult) {
  switch (payload.error) {
    case "rate_limited":
    case "code_recently_sent":
    case "email_provider_rate_limited":
      return 429;
    case "duplicate_registration":
      return 409;
    case "resend_not_configured":
    case "turnstile_not_configured":
    case "otp_not_configured":
    case "firebase_not_configured":
      return 503;
    case "email_send_failed":
      return 502;
    case "internal_error":
      return 500;
    case undefined:
      return 200;
    default:
      return 400;
  }
}

function jsonResponse(payload: RegistrationResult, submissionId = "", status?: number) {
  const responsePayload: RegistrationResponse = {
    ...registrationResponseMetadata,
    submissionId,
    ...payload,
  };

  return Response.json(responsePayload, {
    status: status ?? statusForResult(payload),
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function formValue(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function parseRegistrationInput(formData: FormData): RegistrationInput {
  return {
    website: formValue(formData, "website"),
    submissionId: formValue(formData, "submissionId"),
    verificationId: formValue(formData, "verificationId"),
    verificationCode: formValue(formData, "verificationCode"),
    nombreCompleto: formValue(formData, "nombreCompleto"),
    telefono: formValue(formData, "telefono"),
    correoElectronico: formValue(formData, "correoElectronico"),
    gradoEscolar: formValue(formData, "gradoEscolar"),
    escuelaProcedencia: formValue(formData, "escuelaProcedencia"),
    matriculaEscolar: formValue(formData, "matriculaEscolar"),
    tecnologias: formValue(formData, "tecnologias"),
    hardSkills: formValue(formData, "hardSkills"),
    softSkills: formValue(formData, "softSkills"),
    reglamento: formValue(formData, "reglamento"),
    turnstileToken: formValue(formData, "cf-turnstile-response"),
  };
}

function getClientIp(request: Request) {
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) {
    return cloudflareIp;
  }

  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > maxRequestBytes) {
    return jsonResponse({ ok: false, error: "request_too_large" }, "", 413);
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!allowedContentTypes.some((allowedType) => contentType.startsWith(allowedType))) {
    return jsonResponse({ ok: false, error: "invalid_request" }, "", 415);
  }

  let formData: FormData;
  try {
    const rawBody = await request.arrayBuffer();
    if (rawBody.byteLength > maxRequestBytes) {
      return jsonResponse({ ok: false, error: "request_too_large" }, "", 413);
    }

    const bodyRequest = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: rawBody,
    });
    formData = await bodyRequest.formData();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_request" }, "", 400);
  }

  const data = parseRegistrationInput(formData);
  const action = formValue(formData, "action");
  if (
    !data.submissionId ||
    data.submissionId.length > 128 ||
    !["request_email_code", "confirm_email_code"].includes(action)
  ) {
    return jsonResponse({ ok: false, error: "invalid_request" }, data.submissionId, 400);
  }

  try {
    const result =
      action === "request_email_code"
        ? await requestEmailCode(data, getClientIp(request))
        : await confirmEmailCode(data);

    return jsonResponse(result, data.submissionId);
  } catch (error) {
    if (error instanceof FirebaseConfigurationError) {
      console.error(error.message);
      return jsonResponse({ ok: false, error: "firebase_not_configured" }, data.submissionId);
    }

    console.error("Registration request failed.", error);
    return jsonResponse({ ok: false, error: "internal_error" }, data.submissionId);
  }
}
