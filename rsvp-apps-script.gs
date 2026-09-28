/**
 * ==========================================================================
 *  rsvp-apps-script.gs
 *  Google Apps Script that receives each RSVP from the wedding invitation
 *  and appends it as a new row in a Google Sheet.
 *
 *  HOW TO SET THIS UP
 *  ------------------
 *  1. Create a Google Sheet, e.g. named "Wedding RSVPs".
 *     The first tab is used automatically.
 *  2. Extensions menu -> Apps Script.
 *  3. Delete the sample code, paste everything from this file, press Save.
 *  4. Deploy -> New deployment
 *       Type            : Web app
 *       Execute as      : Me
 *       Who has access  : Anyone            <-- important
 *     Press Deploy and copy the Web app URL (it ends in /exec).
 *  5. Open js/config.js in the website folder and paste that URL into
 *     googleAppsScriptUrl:
 *
 *        googleAppsScriptUrl: 'https://script.google.com/macros/s/AKfy.../exec',
 *
 *  6. Test it: open the /exec URL in a browser. You should see "Ready".
 *     Fill in the RSVP form on the site and a new row should appear.
 *
 *  NOTE: the sheet keeps collecting rows in the background, so you can read
 *  the replies from the Apps Script editor any time with
 *  menu View -> Spreadsheet, or just open the sheet.
 * ==========================================================================
 */

/** Name of the sheet tab to write into. */
var SHEET_NAME = 'RSVPs'; // <-- change if your tab is called something else

/**
 * doPost receives the request from script.js.
 * The site sends JSON as text/plain, which is why e.postData.contents is
 * parsed manually instead of using e.parameter.
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    appendRow(payload);
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error) });
  }
}

/** doGet makes the deployment easy to test: open the URL and see "Ready". */
function doGet(e) {
  return jsonResponse({
    ok: true,
    message: 'Ready. This endpoint accepts RSVP submissions from the invitation.'
  });
}

/** Writes one reply as a new row. */
function appendRow(payload) {
  var sheet = getSheet();
  var row = [
    new Date(),
    payload.name || '',
    payload.email || '',
    payload.attendance || '',
    payload.pax || '',
    payload.dietary || '',
    payload.message || '',
    payload.invitationToken || ''
  ];
  sheet.appendRow(row);
}

/** Finds the target sheet, creating the header row on first use. */
function getSheet() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'Replied',
      'Name',
      'Email',
      'Attending',
      'Number of Pax',
      'Dietary Notes',
      'Message',
      'Invitation Token'
    ]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

/** Minimal JSON reply. The site reads these with no-cors, so the body is a bonus. */
function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Optional helper: turn the collected rows into a simple summary.
 * Run it from the editor to see totals in the execution log.
 */
function summarise() {
  var sheet = getSheet();
  var lastRow = sheet.getLastRow();
  var attending = 0;
  var pax = 0;
  var declined = 0;

  for (var row = 2; row <= lastRow; row += 1) {
    var answer = sheet.getRange(row, 4).getValue();
    var heads = Number(sheet.getRange(row, 5).getValue()) || 0;

    if (answer === 'Yes') {
      attending += 1;
      pax += heads;
    } else if (answer === 'No') {
      declined += 1;
    }
  }

  var summary = {
    responses: Math.max(lastRow - 1, 0),
    attending: attending,
    declined: declined,
    totalPax: pax
  };

  console.log(JSON.stringify(summary));
  return summary;
}
