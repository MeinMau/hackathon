const SHEET_NAME = "Registros";

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
  try {
    const data = parseRequestData_(e);

    if (String(data.website || "").trim()) {
      return jsonResponse_({ ok: true, ignored: true });
    }

    const missingFields = REQUIRED_FIELDS.filter((field) => !String(data[field] || "").trim());
    if (missingFields.length) {
      return jsonResponse_({ ok: false, error: "missing_fields", fields: missingFields });
    }

    if (!["preparatoria", "universidad"].includes(String(data.gradoEscolar))) {
      return jsonResponse_({ ok: false, error: "invalid_grade" });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const sheet = getRegistrationSheet_();
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
      ]);
    } finally {
      lock.releaseLock();
    }

    return jsonResponse_({ ok: true });
  } catch (error) {
    return jsonResponse_({ ok: false, error: String(error) });
  }
}

function doGet() {
  return jsonResponse_({
    ok: true,
    message: "Registro Hackathon ISND - INGENIA activo",
  });
}

function setupSheet() {
  const sheet = getRegistrationSheet_();
  sheet.clear();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, HEADERS.length);
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

  return sheet;
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

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
