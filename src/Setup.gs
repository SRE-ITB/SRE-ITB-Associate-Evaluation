// Lead only (D-030). Run from the Apps Script editor, never from the menu. Every function is safe to re-run.

const PROTECTION_PREFIX = 'setup:';
const SEED_STAFF_PER_DIVISION = 2;
const SEED_NIM_BASE = 99000000;

/**
 * Creates missing tabs with their headers, Config keys, the PERIODS named range, and score validation.
 * Never deletes or overwrites data. Fails if an existing header row differs from the contract.
 */
function setupSheets() {
  runLogged('setupSheets', function () {
    withScriptLock(function () {
      const spreadsheet = SpreadsheetApp.getActive();
      spreadsheet.setSpreadsheetTimeZone(TIME_ZONE);

      Object.keys(HEADERS).forEach(function (name) {
        ensureHeaders(getOrCreateSheet(name), HEADERS[name]);
      });
      getOrCreateSheet(SHEETS.LEADERBOARD);

      const config = getSheetOrThrow(SHEETS.CONFIG);
      ensureConfigKeys(config);
      ensureHeaders(config, PERIODS_HEADERS, PERIODS_HEADER_A1);
      spreadsheet.setNamedRange(PERIODS_RANGE_NAME, config.getRange(PERIODS_RANGE_A1));

      setScoreValidation();
      console.log('setupSheets done');
    });
  });
}

function getOrCreateSheet(name) {
  const spreadsheet = SpreadsheetApp.getActive();
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function ensureHeaders(sheet, headers, a1) {
  const range = a1 ? sheet.getRange(a1) : sheet.getRange(1, 1, 1, headers.length);
  const current = range.getValues()[0].map(function (v) { return String(v).trim(); });
  const isEmpty = current.every(function (v) { return v === ''; });
  if (isEmpty) {
    range.setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return;
  }
  let filled = current.length;
  while (filled > 0 && current[filled - 1] === '') filled--;
  const prefixMatches = current.slice(0, filled).join('|') === headers.slice(0, filled).join('|');
  const tailEmpty = current.slice(filled).every(function (v) { return v === ''; });
  if (!prefixMatches || !tailEmpty) {
    throw new Error('Header mismatch in "' + sheet.getName() + '": found [' + current.join(', ') +
      '], expected [' + headers.join(', ') + ']. Fix the sheet by hand; setupSheets never overwrites data');
  }
  // New columns are only ever added at the end, so older sheets get the missing tail headers.
  if (filled < headers.length) {
    range.offset(0, filled, 1, headers.length - filled)
      .setValues([headers.slice(filled)]).setFontWeight('bold');
  }
}

function ensureConfigKeys(sheet) {
  const existing = sheet.getRange('A2:A').getValues()
    .map(function (row) { return String(row[0]).trim(); })
    .filter(Boolean);
  const missing = CONFIG_KEYS.filter(function (key) { return existing.indexOf(key) === -1; });
  if (!missing.length) return;
  const startRow = existing.length + 2;
  sheet.getRange(startRow, 1, missing.length, 1).setValues(missing.map(function (key) { return [key]; }));
}

function setScoreValidation() {
  const sheet = getSheetOrThrow(SHEETS.EVALUATIONS);
  const first = COLS.Evaluations.I1;
  const topLeft = sheet.getRange(2, first).getA1Notation();
  const rule = SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied('=AND(ISNUMBER(' + topLeft + '),' + topLeft + '=INT(' + topLeft + '),' +
      topLeft + '>=1,' + topLeft + '<=5)')
    .setAllowInvalid(false)
    .setHelpText('Integer from 1 to 5')
    .build();
  sheet.getRange(2, first, sheet.getMaxRows() - 1, 4).setDataValidation(rule);
}

/**
 * Creates the evaluation Form (docs/01-architecture.md section 3), links it to this spreadsheet,
 * renames the response tab to "Form Responses", and stores FORM_ID in Config. Stops if FORM_ID is set.
 */
function setupForm() {
  runLogged('setupForm', function () {
    if (getConfig().FORM_ID) {
      console.log('FORM_ID already set, setupForm skipped');
      return;
    }
    const spreadsheet = SpreadsheetApp.getActive();
    if (spreadsheet.getSheetByName(SHEETS.FORM_RESPONSES)) {
      throw new Error('"' + SHEETS.FORM_RESPONSES + '" exists but FORM_ID is empty. Fix Config by hand');
    }

    const form = FormApp.create(FORM_TITLE);
    form.setEmailCollectionType(FormApp.EmailCollectionType.VERIFIED);
    form.setAllowResponseEdits(false);
    form.setLimitOneResponsePerUser(false);
    form.setProgressBar(false);

    const periods = getPeriods().map(function (p) { return p.periodId; });
    form.addListItem().setTitle(FORM_TITLES.PERIOD).setRequired(true)
      .setChoiceValues(periods.length ? periods : ['(no period)']);
    form.addMultipleChoiceItem().setTitle(FORM_TITLES.ROLE).setRequired(true)
      .setChoiceValues(Object.keys(ROLE_BY_FORM_CHOICE));
    const divisionItem = form.addMultipleChoiceItem().setTitle(FORM_TITLES.DIVISION).setRequired(true);

    const pages = DIVISIONS.map(function (division, i) {
      const page = form.addPageBreakItem().setTitle(division);
      // A page break's navigation applies to the section before it, so every division section ends in submit.
      if (i > 0) page.setGoToPage(FormApp.PageNavigationType.SUBMIT);
      form.addListItem().setTitle(staffItemTitle(division)).setRequired(true).setChoiceValues([FORM_EMPTY_CHOICE]);
      FORM_TITLES.INDICATORS.forEach(function (title) {
        form.addScaleItem().setTitle(title).setBounds(1, 5).setRequired(true);
      });
      form.addParagraphTextItem().setTitle(FORM_TITLES.COMMENT).setRequired(true);
      return page;
    });
    divisionItem.setChoices(DIVISIONS.map(function (division, i) {
      return divisionItem.createChoice(division, pages[i]);
    }));

    form.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheet.getId());
    SpreadsheetApp.flush();
    const responseSheet = spreadsheet.getSheets().find(function (sheet) {
      const url = sheet.getFormUrl();
      return url && url.indexOf(form.getId()) !== -1;
    });
    if (!responseSheet) throw new Error('Linked response sheet not found for form ' + form.getId());
    responseSheet.setName(SHEETS.FORM_RESPONSES);

    setConfigValue('FORM_ID', form.getId());
    console.log('Form created: ' + form.getEditUrl() + '. Move it into the System/ folder.');
  });
}

/**
 * Applies the protections in docs/01-architecture.md section 2. Only the owner and LEAD_EMAIL can edit
 * locked ranges. Removes and recreates protections it created before.
 */
function setupProtections() {
  runLogged('setupProtections', function () {
    const leadEmail = getConfigValue('LEAD_EMAIL');
    const spreadsheet = SpreadsheetApp.getActive();
    spreadsheet.getProtections(SpreadsheetApp.ProtectionType.SHEET)
      .filter(function (p) { return p.getDescription().indexOf(PROTECTION_PREFIX) === 0; })
      .forEach(function (p) { p.remove(); });

    const editableByAdmins = {};
    editableByAdmins[SHEETS.EVALUATIONS] = function (sheet) {
      return [sheet.getRange(2, COLS.Evaluations.I1, sheet.getMaxRows() - 1, 5)];
    };
    editableByAdmins[SHEETS.SUMMARY] = function (sheet) {
      return [sheet.getRange(2, COLS.Summary.TIE_OVERRIDE, sheet.getMaxRows() - 1, 1)];
    };
    editableByAdmins[SHEETS.LEADERBOARD] = function (sheet) {
      return [sheet.getRange(LEADERBOARD_PERIOD_SELECTOR_A1)];
    };

    Object.keys(SHEETS).forEach(function (key) {
      const name = SHEETS[key];
      const sheet = getSheetOrThrow(name);
      const protection = sheet.protect().setDescription(PROTECTION_PREFIX + name);
      if (editableByAdmins[name]) protection.setUnprotectedRanges(editableByAdmins[name](sheet));
      protection.removeEditors(protection.getEditors());
      protection.addEditor(leadEmail);
      if (protection.canDomainEdit()) protection.setDomainEdit(false);
    });
    console.log('setupProtections done');
  });
}

/**
 * DEV only. Fills Master, Admins, PERIODS, and Config with fake data so a DEV copy works end to end.
 * Refuses to run unless Config ENV is DEV. Skips any table that already has data.
 */
function seedFakeData() {
  runLogged('seedFakeData', function () {
    if (getConfigValue('ENV') !== ENVIRONMENTS.DEV) {
      throw new Error('seedFakeData runs only when Config ENV is ' + ENVIRONMENTS.DEV);
    }
    withScriptLock(function () {
      seedPeriods();
      seedMaster();
      seedAdmins();
      seedConfigDefaults();
    });
    console.log('seedFakeData done');
  });
}

function seedPeriods() {
  if (getPeriods().length) return;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 3, 0);
  const label = 'DEV ' + formatDateJakarta(start, 'MMM yyyy') + ' - ' + formatDateJakarta(end, 'MMM yyyy');
  getSheetOrThrow(SHEETS.CONFIG).getRange(PERIODS_RANGE_A1).offset(0, 0, 1, 4)
    .setValues([['P1', label, start, end]]);
}

function seedMaster() {
  const sheet = getSheetOrThrow(SHEETS.MASTER);
  if (sheet.getLastRow() > 1) return;
  const today = new Date();
  const rows = [];
  DIVISIONS.forEach(function (division, d) {
    for (let n = 0; n < SEED_STAFF_PER_DIVISION; n++) {
      const seq = d * SEED_STAFF_PER_DIVISION + n + 1;
      rows.push([
        String(SEED_NIM_BASE + seq),
        'Fake Staff ' + seq,
        division,
        'staff' + seq + '@example.com',
        new Date(2005, seq % 12, (seq % 27) + 1),
        '',
        true,
        true,
      ]);
    }
  });
  // Members who get birthday posters but are never evaluated (D-032).
  const lastSeq = rows.length;
  rows.push(
    [String(SEED_NIM_BASE + lastSeq + 1), 'Fake Kadiv', 'IT Development', 'kadiv@example.com',
      new Date(2003, today.getMonth(), today.getDate()), '', true, false],
    [String(SEED_NIM_BASE + lastSeq + 2), 'Fake Secretary', 'Secretary', 'secretary@example.com',
      new Date(2004, 5, 10), '', true, false]
  );
  // docs/00-scope.md section 8 fixtures, a birthday today, a Feb 29 birthday, and an inactive staff.
  rows[0][1] = 'Staff A';
  rows[1][1] = 'Staff B';
  rows[2][4] = new Date(2005, today.getMonth(), today.getDate());
  rows[3][4] = new Date(2004, 1, 29);
  rows[lastSeq - 1][6] = false;
  sheet.getRange(2, 1, rows.length, HEADERS.Master.length).setValues(rows);
}

function seedAdmins() {
  const sheet = getSheetOrThrow(SHEETS.ADMINS);
  if (sheet.getLastRow() > 1) return;
  const rows = DIVISIONS.map(function (division, i) {
    return ['kw' + (i + 1) + '@example.com', 'Fake KW ' + (i + 1), ROLES.KW, division];
  });
  rows.push(['om1@example.com', 'Fake OM 1', ROLES.OM, '']);
  const me = normalizeEmail(Session.getActiveUser().getEmail());
  if (me) rows.push([me, 'DEV tester', ROLES.OM, '']);
  sheet.getRange(2, 1, rows.length, HEADERS.Admins.length).setValues(rows);
}

function seedConfigDefaults() {
  const config = getConfig();
  if (!config.ACTIVE_PERIOD) setConfigValue('ACTIVE_PERIOD', 'P1');
  const me = normalizeEmail(Session.getActiveUser().getEmail());
  if (!config.OM_EMAILS && me) setConfigValue('OM_EMAILS', me);
  if (!config.LEAD_EMAIL && me) setConfigValue('LEAD_EMAIL', me);
}
