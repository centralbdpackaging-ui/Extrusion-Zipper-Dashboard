// ============================================================
//  PRODUCTION DASHBOARD — Google Apps Script (Updated)
//  ✅ Spreadsheet: 1g-veZWhN4jDffzI2LPh-WPqrWH54XRodeMOrsHa-3w4
//  ✅ Sheet: "ENTRY_FORM"
//  ✅ Header: Row 2 | Data: Row 3+ | Columns: B to L
// ============================================================

const SPREADSHEET_ID = "1g-veZWhN4jDffzI2LPh-WPqrWH54XRodeMOrsHa-3w4";
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

  // Get range B2:L (Row 2 is header, columns B to L)
  // Column B is 2, L is 12. Number of columns is 11.
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { rawData: [], lastUpdated: new Date().getTime() };
  }

  const range = sheet.getRange(2, 2, lastRow - 1, 11);
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
