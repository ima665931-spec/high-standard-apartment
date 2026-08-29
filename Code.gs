/**
 * High Standard Apartment — Bookings + Status + Listings
 *
 * IMPORTANT: Deploy → Manage deployments → New version after every code change
 * Execute as: Me | Who has access: Anyone
 */

var OWNER_EMAIL = 'ima665931@gmail.com';
var SHEET_NAME = 'Bookings';
var LISTINGS_SHEET = 'Listings';
var TOKEN_SECRET = 'HSA_JAIPUR_2026_SECRET_CHANGE_ME';

// Optional: paste Spreadsheet ID from sheet URL (docs.google.com/spreadsheets/d/THIS_ID/edit)
// Leave empty if script was opened from the Sheet (Extensions → Apps Script)
var SPREADSHEET_ID = '';

function getSS_() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) {}
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  // last resort: open by name from Drive
  var files = DriveApp.getFilesByName('High Standard Apartment Panel');
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }
  return null;
}

function doGet(e) {
  e = e || { parameter: {} };
  var p = e.parameter || {};

  if (p.action === 'confirm' || p.action === 'reject') {
    return handleDecision(p);
  }
  if (p.action === 'status') {
    return handleStatus(p);
  }
  if (p.action === 'ping') {
    return jsonpOrJson(p, { ok: true, message: 'HSA backend alive', time: new Date().toISOString() });
  }

  try {
    var ss = getSS_();
    if (!ss) return jsonpOrJson(p, []);
    var sheet = ss.getSheetByName(LISTINGS_SHEET);
    if (!sheet) return jsonpOrJson(p, []);
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return jsonpOrJson(p, []);
    var headers = data[0].map(function(h){ return String(h).toLowerCase().trim(); });
    var rows = [];
    for (var i = 1; i < data.length; i++) {
      var obj = {};
      for (var j = 0; j < headers.length; j++) obj[headers[j]] = data[i][j];
      if (obj.id) rows.push(obj);
    }
    return jsonpOrJson(p, rows);
  } catch (err) {
    return jsonpOrJson(p, []);
  }
}

function doPost(e) {
  try {
    var body = e.postData && e.postData.contents ? e.postData.contents : '{}';
    var data = JSON.parse(body);
    if (data.action === 'new_booking' || data.utr) {
      return handleNewBooking(data);
    }
    if (data.action === 'status') {
      return handleStatus(data);
    }
    return jsonOut({ ok: false, error: 'unknown action' });
  } catch (err) {
    try {
      GmailApp.sendEmail(OWNER_EMAIL, 'HSA Script ERROR', String(err));
    } catch (e2) {}
    return jsonOut({ ok: false, error: String(err) });
  }
}

function handleStatus(p) {
  var bookingId = String(p.id || p.bookingId || '').trim().toUpperCase();
  var mobile = String(p.mobile || '').trim().replace(/\D/g, '');
  if (!bookingId || mobile.length < 10) {
    return jsonpOrJson(p, { ok: false, error: 'Booking ID and 10-digit mobile required' });
  }
  mobile = mobile.slice(-10);

  var ss = getSS_();
  if (!ss) return jsonpOrJson(p, { ok: false, error: 'Spreadsheet not linked' });
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return jsonpOrJson(p, { ok: false, error: 'No bookings sheet' });

  var all = sheet.getDataRange().getValues();
  for (var r = 1; r < all.length; r++) {
    var rowId = String(all[r][1] || '').trim().toUpperCase();
    var rowMobile = String(all[r][3] || '').replace(/\D/g, '').slice(-10);
    if (rowId === bookingId && rowMobile === mobile) {
      return jsonpOrJson(p, {
        ok: true,
        bookingId: rowId,
        name: all[r][2],
        mobile: rowMobile,
        email: all[r][4],
        visitDate: formatCell(all[r][7]),
        visitSlot: all[r][8],
        propertyTitle: all[r][10],
        area: all[r][11],
        bhk: all[r][12],
        utr: all[r][16],
        status: all[r][18] || 'Pending',
        message: statusMessage(all[r][18] || 'Pending')
      });
    }
  }
  return jsonpOrJson(p, { ok: false, error: 'No booking found for this ID and mobile' });
}

function statusMessage(status) {
  var s = String(status || 'Pending').toLowerCase();
  if (s.indexOf('confirm') >= 0 && s.indexOf('not') < 0) {
    return 'Your visit is confirmed. Our Agent will reach you soon.';
  }
  if (s.indexOf('not') >= 0 || s.indexOf('reject') >= 0 || s.indexOf('fail') >= 0) {
    return 'Your visiting fee was due / payment could not be verified. Please contact us if you already paid.';
  }
  return 'Payment verification is in progress. Usually confirmed within a few hours.';
}

function formatCell(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone() || 'Asia/Kolkata', 'yyyy-MM-dd');
  }
  return v == null ? '' : String(v);
}

function handleNewBooking(data) {
  var bookingId = String(data.bookingId || '').trim().toUpperCase();
  if (!bookingId) {
    bookingId = 'HSA-' + Utilities.getUuid().substring(0, 8).toUpperCase();
  }

  // 1) EMAIL FIRST — even if sheet fails, you still get the lead
  var ownerHtml =
    '<div style="font-family:Arial,sans-serif;max-width:560px;line-height:1.5">' +
    '<h2 style="color:#1C2430">New Visit Booking</h2>' +
    '<p><b>Booking ID:</b> ' + bookingId + '</p>' +
    '<table style="border-collapse:collapse;width:100%">' +
    row('Name', data.name) +
    row('Mobile', data.mobile) +
    row('Email', data.email) +
    row('Address', data.address) +
    row('Visitors', data.visitors) +
    row('Visit Date', data.visitDate) +
    row('Visit Slot', data.visitSlot) +
    row('Flat', data.propertyTitle) +
    row('Area', data.area) +
    row('BHK', data.bhk) +
    row('Rent', data.rent) +
    row('Deposit', data.deposit) +
    row('Fee', 'Rs. ' + (data.amount || 199)) +
    row('UTR', '<b style="color:#B85C33">' + (data.utr || '') + '</b>') +
    row('Notes', data.notes) +
    '</table>';

  var token = '';
  try {
    token = Utilities.base64EncodeWebSafe(
      Utilities.computeHmacSha256Signature(bookingId + '|' + (data.email || ''), TOKEN_SECRET)
    ).substring(0, 24);
    var webUrl = ScriptApp.getService().getUrl();
    var confirmUrl = webUrl + '?action=confirm&id=' + encodeURIComponent(bookingId) + '&t=' + encodeURIComponent(token);
    var rejectUrl = webUrl + '?action=reject&id=' + encodeURIComponent(bookingId) + '&t=' + encodeURIComponent(token);
    ownerHtml +=
      '<p style="margin-top:24px">Verify UTR, then choose:</p>' +
      '<p>' +
      '<a href="' + confirmUrl + '" style="display:inline-block;background:#3E7A52;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px;margin-right:12px">Visit Confirmed</a>' +
      '<a href="' + rejectUrl + '" style="display:inline-block;background:#A23B3B;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px">Visit Not Confirmed</a>' +
      '</p>';
  } catch (eTok) {
    ownerHtml += '<p style="color:#A23B3B">Token/buttons error: ' + eTok + '</p>';
  }
  ownerHtml += '</div>';

  GmailApp.sendEmail(OWNER_EMAIL, 'New Visit Booking — ' + (data.name || bookingId), '', {
    htmlBody: ownerHtml,
    name: 'High Standard Apartment'
  });

  if (data.email) {
    try {
      GmailApp.sendEmail(data.email, 'We received your visit request — High Standard Apartment', '', {
        htmlBody:
          '<div style="font-family:Arial,sans-serif;max-width:520px">' +
          '<h2>Request received</h2>' +
          '<p>Hi ' + (data.name || '') + ',</p>' +
          '<p>We got your visit booking for <b>' + (data.propertyTitle || 'the flat') + '</b>.</p>' +
          '<p><b>Booking ID: ' + bookingId + '</b><br>UTR: ' + (data.utr || '') + '</p>' +
          '<p>Track status on our website Status page using Booking ID + mobile. Email will also come when confirmed.</p>' +
          '<p>— High Standard Apartment, Jaipur</p></div>',
        name: 'High Standard Apartment'
      });
    } catch (eUser) {}
  }

  // 2) Save to sheet (after email)
  try {
    var ss = getSS_();
    if (!ss) throw new Error('Spreadsheet not found — open script from the Sheet or set SPREADSHEET_ID');
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow([
        'Timestamp', 'BookingId', 'Name', 'Mobile', 'Email', 'Address',
        'Visitors', 'VisitDate', 'VisitSlot', 'PropertyId', 'PropertyTitle',
        'Area', 'BHK', 'Rent', 'Deposit', 'Amount', 'UTR', 'Notes', 'Status'
      ]);
    }
    sheet.appendRow([
      new Date(),
      bookingId,
      data.name || '',
      data.mobile || '',
      data.email || '',
      data.address || '',
      data.visitors || '',
      data.visitDate || '',
      data.visitSlot || '',
      data.propertyId || '',
      data.propertyTitle || '',
      data.area || '',
      data.bhk || '',
      data.rent || '',
      data.deposit || '',
      data.amount || 199,
      data.utr || '',
      data.notes || '',
      'Pending'
    ]);

    if (token) {
      var tokSheet = ss.getSheetByName('_tokens');
      if (!tokSheet) {
        tokSheet = ss.insertSheet('_tokens');
        tokSheet.appendRow(['bookingId', 'token', 'email', 'name', 'status']);
      }
      tokSheet.appendRow([bookingId, token, data.email || '', data.name || '', 'Pending']);
    }
  } catch (eSheet) {
    try {
      GmailApp.sendEmail(OWNER_EMAIL, 'HSA Sheet save failed — ' + bookingId, String(eSheet));
    } catch (e2) {}
  }

  return jsonOut({ ok: true, bookingId: bookingId });
}

function handleDecision(p) {
  var bookingId = p.id || '';
  var token = p.t || '';
  var action = p.action;

  var ss = getSS_();
  if (!ss) return htmlPage('Error', 'Spreadsheet not linked.');
  var tokSheet = ss.getSheetByName('_tokens');
  if (!tokSheet) return htmlPage('Error', 'Invalid or expired link.');

  var data = tokSheet.getDataRange().getValues();
  var rowIndex = -1;
  var email = '';
  var name = '';
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === bookingId && String(data[i][1]) === token) {
      rowIndex = i + 1;
      email = data[i][2];
      name = data[i][3];
      break;
    }
  }
  if (rowIndex < 0) return htmlPage('Error', 'Invalid or expired link.');

  var currentStatus = data[rowIndex - 1][4];
  if (currentStatus && currentStatus !== 'Pending') {
    return htmlPage('Already processed', 'This booking was already marked as: ' + currentStatus);
  }

  var newStatus = action === 'confirm' ? 'Confirmed' : 'Not Confirmed';
  tokSheet.getRange(rowIndex, 5).setValue(newStatus);

  var sheet = ss.getSheetByName(SHEET_NAME);
  if (sheet) {
    var all = sheet.getDataRange().getValues();
    for (var r = 1; r < all.length; r++) {
      if (String(all[r][1]) === bookingId) {
        sheet.getRange(r + 1, 19).setValue(newStatus);
        break;
      }
    }
  }

  if (email) {
    if (action === 'confirm') {
      GmailApp.sendEmail(email, 'Your visit is confirmed — High Standard Apartment', '', {
        htmlBody:
          '<div style="font-family:Arial,sans-serif;max-width:520px">' +
          '<h2 style="color:#3E7A52">Visit Confirmed</h2>' +
          '<p>Hi ' + (name || '') + ',</p>' +
          '<p><b>Your visit is confirmed.</b> Our Agent will reach you soon.</p>' +
          '<p>Booking ID: ' + bookingId + '</p>' +
          '<p>— High Standard Apartment, Jaipur</p></div>',
        name: 'High Standard Apartment'
      });
    } else {
      GmailApp.sendEmail(email, 'Visit not confirmed — High Standard Apartment', '', {
        htmlBody:
          '<div style="font-family:Arial,sans-serif;max-width:520px">' +
          '<h2 style="color:#A23B3B">Visit Not Confirmed</h2>' +
          '<p>Hi ' + (name || '') + ',</p>' +
          '<p><b>Your visiting fee was due</b> / payment could not be verified.</p>' +
          '<p>Booking ID: ' + bookingId + '</p>' +
          '<p>— High Standard Apartment, Jaipur</p></div>',
        name: 'High Standard Apartment'
      });
    }
  }

  GmailApp.sendEmail(OWNER_EMAIL, 'Booking ' + newStatus + ' — ' + bookingId, '', {
    htmlBody: '<p>Booking <b>' + bookingId + '</b> marked as <b>' + newStatus + '</b>.</p>',
    name: 'High Standard Apartment'
  });

  return htmlPage(newStatus, 'Done. Customer has been emailed.');
}

function row(label, value) {
  return '<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666;width:140px">' + label +
    '</td><td style="padding:6px 8px;border-bottom:1px solid #eee">' + (value || '—') + '</td></tr>';
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonpOrJson(p, obj) {
  var cb = p && p.callback ? String(p.callback).replace(/[^a-zA-Z0-9_$]/g, '') : '';
  if (cb) {
    return ContentService.createTextOutput(cb + '(' + JSON.stringify(obj) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jsonOut(obj);
}

function htmlPage(title, msg) {
  var html =
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + title + '</title></head><body style="font-family:Arial,sans-serif;padding:40px;max-width:480px;margin:auto">' +
    '<h2>' + title + '</h2><p>' + msg + '</p>' +
    '<p style="color:#888;font-size:13px">You can close this tab.</p></body></html>';
  return HtmlService.createHtmlOutput(html);
}
