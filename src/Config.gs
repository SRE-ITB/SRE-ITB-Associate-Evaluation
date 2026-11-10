// Contract with docs/01-architecture.md. Change both in the same PR, lead only.

const TIME_ZONE = 'Asia/Jakarta';

const SHEETS = {
  CONFIG: 'Config',
  MASTER: 'Master',
  ADMINS: 'Admins',
  FORM_RESPONSES: 'Form Responses',
  EVALUATIONS: 'Evaluations',
  SUMMARY: 'Summary',
  LEADERBOARD: 'Leaderboard',
  BIRTHDAY_LOG: 'BirthdayLog',
  REJECTED: 'Rejected',
};

// Row 1 headers, in column order. Form Responses and Leaderboard have no fixed headers.
const HEADERS = {
  Config: ['key', 'value'],
  Master: ['nim', 'name', 'division', 'email', 'birth_date', 'photo_file_id', 'active', 'evaluated'],
  Admins: ['email', 'name', 'role', 'division'],
  Evaluations: [
    'period_id', 'nim', 'name', 'division', 'role',
    'i1', 'i2', 'i3', 'i4', 'comment',
    'submitted_by', 'updated_at', 'source', 'flag',
  ],
  Summary: [
    'period_id', 'nim', 'name', 'division', 'has_kw', 'has_om',
    'final_i1', 'final_i2', 'final_i3', 'final_i4',
    'final_total', 'final_avg', 'complete', 'status_auto',
    'tie_override', 'status', 'division_complete',
  ],
  BirthdayLog: ['date', 'nim', 'poster_file_id', 'emailed_at'],
  Rejected: ['timestamp', 'email', 'period', 'role', 'division', 'nim', 'reason'],
};

// 1-based column numbers, e.g. COLS.Evaluations.I1 === 6.
const COLS = buildColumnIndex(HEADERS);

function buildColumnIndex(headers) {
  const index = {};
  Object.keys(headers).forEach(function (sheetName) {
    index[sheetName] = {};
    headers[sheetName].forEach(function (header, i) {
      index[sheetName][header.toUpperCase()] = i + 1;
    });
  });
  return index;
}

const CONFIG_KEYS = [
  'ENV',
  'LEAD_EMAIL',
  'ACTIVE_PERIOD',
  'OM_EMAILS',
  'FOLDER_BIRTHDAY',
  'FOLDER_BEST_STAFF',
  'FOLDER_REPORTS',
  'TEMPLATE_BIRTHDAY',
  'TEMPLATE_BEST_STAFF',
  'TEMPLATE_REPORT',
  'FORM_ID',
];

const PERIODS_RANGE_NAME = 'PERIODS';
const PERIODS_HEADER_A1 = 'D1:G1';
const PERIODS_HEADERS = ['period_id', 'label', 'start_date', 'end_date'];
const PERIODS_RANGE_A1 = 'D2:G50';

const LEADERBOARD_PERIOD_SELECTOR_A1 = 'B1';

const ENVIRONMENTS = { DEV: 'DEV', PROD: 'PROD' };

const OM_DIVISION = 'Organizational Management';

const DIVISIONS = [
  'Sponsorship',
  'Entrepreneurship',
  'Organizational Development',
  OM_DIVISION,
  'Community Development',
  'Competency Enhancement',
  'E&C Research',
  'E&C Product',
  'Event',
  'Partnership',
  'Design',
  'IT Development',
  'Publication & Documentation',
];

const ROLES = { KW: 'KW', OM: 'OM' };

const ROLE_BY_FORM_CHOICE = {
  'Kadiv/Wakadiv representative': ROLES.KW,
  'Asso OM': ROLES.OM,
};

const WEIGHTS = {
  DEFAULT: { KW: 0.6, OM: 0.4 },
  OM_DIVISION: { KW: 1.0, OM: 0 },
};

const FLAGS = { IGNORED_OM_ROLE: 'IGNORED_OM_ROLE', ROLE_MISMATCH: 'ROLE_MISMATCH' };

const SOURCES = { FORM: 'FORM', MANUAL: 'MANUAL', MANUAL_UNKNOWN: 'MANUAL (unknown)' };

const REJECT_REASONS = { NOT_REGISTERED: 'NOT_REGISTERED' };

const STATUSES = {
  INCOMPLETE: 'Incomplete',
  RED_NOTICE: 'Red Notice',
  BEST_STAFF_PROVISIONAL: 'Best Staff (Sementara)',
  BEST_STAFF: 'Best Staff',
  TIE: 'Tie',
  NORMAL: 'Normal',
};

const FORM_TITLE = 'SRE Staff Evaluation';

const FORM_TITLES = {
  PERIOD: 'Period',
  ROLE: 'Evaluator role',
  DIVISION: 'Division',
  STAFF_PREFIX: 'Staff - ',
  INDICATORS: [
    'Meeting attendance and progress-report activeness',
    'Task contribution',
    'Initiative',
    'Teamwork and communication',
  ],
  COMMENT: 'Comment',
};

const FORM_EMPTY_CHOICE = '(no staff)';

function staffItemTitle(division) {
  return FORM_TITLES.STAFF_PREFIX + division;
}

let configCache = null;

function getConfig() {
  if (configCache) return configCache;
  const values = getSheetOrThrow(SHEETS.CONFIG).getRange('A2:B').getValues();
  const config = {};
  values.forEach(function (row) {
    const key = String(row[0]).trim();
    if (key) config[key] = typeof row[1] === 'string' ? row[1].trim() : row[1];
  });
  configCache = config;
  return config;
}

function getConfigValue(key) {
  const value = getConfig()[key];
  if (value === undefined || value === null || value === '') {
    throw new Error('Config key "' + key + '" is missing or empty in the ' + SHEETS.CONFIG + ' tab');
  }
  return value;
}

function getConfigList(key) {
  return String(getConfigValue(key))
    .split(',')
    .map(function (item) { return item.trim(); })
    .filter(Boolean);
}

function setConfigValue(key, value) {
  const sheet = getSheetOrThrow(SHEETS.CONFIG);
  const keys = sheet.getRange('A2:A').getValues().map(function (row) { return String(row[0]).trim(); });
  const rowIndex = keys.indexOf(key);
  if (rowIndex === -1) throw new Error('Config key "' + key + '" not found. Run setupSheets() first');
  sheet.getRange(rowIndex + 2, 2).setValue(value);
  configCache = null;
}

function getPeriods() {
  const range = SpreadsheetApp.getActive().getRangeByName(PERIODS_RANGE_NAME);
  if (!range) throw new Error('Named range ' + PERIODS_RANGE_NAME + ' not found. Run setupSheets() first');
  return range.getValues()
    .filter(function (row) { return String(row[0]).trim() !== ''; })
    .map(function (row) {
      return { periodId: String(row[0]).trim(), label: row[1], startDate: row[2], endDate: row[3] };
    });
}

function getPeriod(periodId) {
  const period = getPeriods().find(function (p) { return p.periodId === periodId; });
  if (!period) throw new Error('Period "' + periodId + '" not found in ' + PERIODS_RANGE_NAME);
  return period;
}
