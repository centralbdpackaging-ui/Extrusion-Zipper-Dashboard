// ============================================================
//  PRODUCTION DASHBOARD — Google Apps Script (Updated)
//  ✅ Spreadsheet: 1ZdJW-jG-4nBhSU0Sye3JtEu8y8beqPZC6fLYGirTPOo
//  ✅ Sheet: "ENTRY_FORM"
//  ✅ Header: Row 2 | Data: Row 3+ | Columns: F to Q
// ============================================================

const SPREADSHEET_ID = "1ZdJW-jG-4nBhSU0Sye3JtEu8y8beqPZC6fLYGirTPOo";
const SHEET_NAME = "ENTRY_FORM";

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const result = getDashboardData(params);
    output.setContent(JSON.stringify(result));
  } catch (err) {
    output.setContent(JSON.stringify({ error: err.message }));
  }

  return output;
}

// Respond to pre‑flight OPTIONS requests (required by some browsers)
function doOptions(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function getDashboardData(params) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const tz = ss.getSpreadsheetTimeZone();
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    throw new Error('Sheet "' + SHEET_NAME + '" not found!');
  }

  // Get range F2:Q (Row 2 is header, columns F to Q)
  // Column F is 6, Q is 17. Number of columns is 12.
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { rawData: [], lastUpdated: new Date().getTime() };
  }

  const range = sheet.getRange(2, 6, lastRow - 1, 12);
  const data = range.getValues();

  const headers = data[0].map((h) => String(h).trim());
  const rows = data.slice(1);

  const rawData = rows
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => {
        let val = row[i];
        if (val instanceof Date) {
          obj[h] = Utilities.formatDate(val, tz, "yyyy-MM-dd");
        } else {
          obj[h] = val !== "" && val !== null && val !== undefined ? val : "";
        }
      });
      return obj;
    })
    .filter((row) => {
      return Object.values(row).some(
        (v) => v !== "" && v !== null && v !== undefined,
      );
    });

  return {
    rawData: rawData,
    debug: {
      sourceUsed: SHEET_NAME,
      totalRows: rawData.length,
      timezone: tz,
      lastUpdated: Utilities.formatDate(new Date(), tz, "yyyy-MM-dd HH:mm:ss"),
    },
    lastUpdated: new Date().getTime(),
  };
}
