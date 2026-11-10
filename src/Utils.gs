const LOCK_WAIT_MS = 30000;

function getSheetOrThrow(name) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) throw new Error('Sheet "' + name + '" not found');
  return sheet;
}

function withScriptLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(LOCK_WAIT_MS);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function logError(context, err) {
  console.error('[' + context + '] ' + (err && err.stack ? err.stack : err));
  throw err;
}

function runLogged(context, fn) {
  try {
    return fn();
  } catch (err) {
    logError(context, err);
  }
}

function formatDateJakarta(date, pattern) {
  return Utilities.formatDate(date, TIME_ZONE, pattern || 'yyyy-MM-dd');
}

function todayJakarta() {
  return formatDateJakarta(new Date());
}

function nowJakarta() {
  return formatDateJakarta(new Date(), 'yyyy-MM-dd HH:mm:ss');
}

// Returns rows as objects keyed by header, plus _row (1-based sheet row).
function readTable(sheetName) {
  const values = getSheetOrThrow(sheetName).getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(function (h) { return String(h).trim(); });
  return values.slice(1).map(function (row, i) {
    const record = { _row: i + 2 };
    headers.forEach(function (header, col) {
      if (header) record[header] = row[col];
    });
    return record;
  });
}

function parseNim(label) {
  const match = /\((\d+)\)\s*$/.exec(String(label || ''));
  return match ? match[1] : null;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isTruthyCell(value) {
  return value === true || String(value).trim().toUpperCase() === 'TRUE';
}
