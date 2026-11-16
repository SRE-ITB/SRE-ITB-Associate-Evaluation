/**
 * Installable onFormSubmit trigger handler. Upserts valid evaluations and rejects unregistered submitters.
 */
function onFormSubmitHandler(e) {
  runLogged('onFormSubmitHandler', function () {
    if (!e || !e.namedValues) {
      throw new Error('onFormSubmitHandler requires a form submit event with namedValues');
    }
    const namedValues = e.namedValues;
    const periodId = getPeriod(getSubmittedValue(namedValues, FORM_TITLES.PERIOD)).periodId;
    const roleChoice = getSubmittedValue(namedValues, FORM_TITLES.ROLE);
    const role = ROLE_BY_FORM_CHOICE[roleChoice];
    if (!role) throw new Error('Unknown evaluator role "' + roleChoice + '" in form submission');
    const staffField = findSubmittedStaffField(namedValues);
    const nim = staffField ? parseNim(staffField.label) : null;

    if (!nim) {
      console.log('Skipping form submission: could not parse NIM from staff field');
      return;
    }

    const masterRows = readTable(SHEETS.MASTER);
    const staff = masterRows.find(function (row) {
      return String(row.nim).trim() === nim;
    });
    if (!staff || !isEvaluatedStaff(staff)) {
      console.log('Skipping form submission: NIM ' + nim + ' not found or not an evaluated staff member');
      return;
    }

    const staffName = String(staff.name).trim();
    const staffDivision = String(staff.division).trim();
    const submitterEmail = getSubmitterEmail(e);

    const adminRows = readTable(SHEETS.ADMINS).filter(function (row) {
      return normalizeEmail(row.email) === submitterEmail && submitterEmail !== '';
    });

    if (!adminRows.length) {
      recordRejectedSubmission(submitterEmail, periodId, role, staffDivision, nim);
      return;
    }

    const scores = FORM_TITLES.INDICATORS.map(function (title) {
      return Number(getSubmittedValue(namedValues, title));
    });
    const comment = getSubmittedValue(namedValues, FORM_TITLES.COMMENT);
    const flag = computeSubmissionFlag(adminRows, role, staffDivision);
    const updatedAt = nowJakarta();

    const rowValues = [
      periodId,
      nim,
      staffName,
      staffDivision,
      role,
      scores[0],
      scores[1],
      scores[2],
      scores[3],
      comment,
      submitterEmail,
      updatedAt,
      SOURCES.FORM,
      flag,
    ];

    withScriptLock(function () {
      const sheet = getSheetOrThrow(SHEETS.EVALUATIONS);
      const existingRows = readTable(SHEETS.EVALUATIONS);
      const existing = existingRows.find(function (row) {
        return String(row.period_id).trim() === periodId &&
          String(row.nim).trim() === nim &&
          String(row.role).trim() === role;
      });
      const targetRow = existing ? existing._row : sheet.getLastRow() + 1;
      sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
    });
  });
}

function firstNonEmpty(values) {
  if (!Array.isArray(values)) return '';
  for (let i = 0; i < values.length; i++) {
    const val = String(values[i] === undefined || values[i] === null ? '' : values[i]).trim();
    if (val !== '') return val;
  }
  return '';
}

function getSubmittedValue(namedValues, title) {
  if (namedValues[title]) {
    const direct = firstNonEmpty(namedValues[title]);
    if (direct !== '') return direct;
  }
  const keys = Object.keys(namedValues);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].trim() === title) {
      const val = firstNonEmpty(namedValues[keys[i]]);
      if (val !== '') return val;
    }
  }
  return '';
}

function findSubmittedStaffField(namedValues) {
  for (let i = 0; i < DIVISIONS.length; i++) {
    const division = DIVISIONS[i];
    const value = getSubmittedValue(namedValues, staffItemTitle(division));
    if (value && value !== FORM_EMPTY_CHOICE) {
      return { division: division, label: value };
    }
  }
  return null;
}

function getSubmitterEmail(e) {
  const namedValues = (e && e.namedValues) || {};
  const emailTitles = ['Email Address', 'Alamat Email', 'Email', 'Alamat email'];
  for (let i = 0; i < emailTitles.length; i++) {
    const val = getSubmittedValue(namedValues, emailTitles[i]);
    if (val) return normalizeEmail(val);
  }
  if (e && Array.isArray(e.values) && e.values.length > 1) {
    const candidate = normalizeEmail(e.values[1]);
    if (candidate.indexOf('@') !== -1) return candidate;
  }
  return '';
}

function recordRejectedSubmission(submitterEmail, periodId, role, division, nim) {
  const rejectedRow = [
    nowJakarta(),
    submitterEmail,
    periodId,
    role,
    division,
    nim,
    REJECT_REASONS.NOT_REGISTERED,
  ];
  withScriptLock(function () {
    const sheet = getSheetOrThrow(SHEETS.REJECTED);
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, rejectedRow.length).setValues([rejectedRow]);
  });
  if (submitterEmail) {
    MailApp.sendEmail(
      submitterEmail,
      'SRE Staff Evaluation - Submission Not Recorded',
      'Your evaluation submission for period ' + periodId +
        ' was not recorded because ' + submitterEmail +
        ' is not registered in Admins. Please submit using your registered account.'
    );
  }
}

function computeSubmissionFlag(adminRecords, role, staffDivision) {
  if (staffDivision === OM_DIVISION && role === ROLES.OM) {
    return FLAGS.IGNORED_OM_ROLE;
  }
  const hasMatchingRole = adminRecords.some(function (admin) {
    const adminRole = String(admin.role || '').trim();
    const adminDivision = String(admin.division || '').trim();
    if (role === ROLES.KW) {
      return adminRole === ROLES.KW && adminDivision === staffDivision;
    }
    return adminRole === role;
  });
  return hasMatchingRole ? '' : FLAGS.ROLE_MISMATCH;
}

/**
 * Installable onEdit trigger handler. Stamps audit fields when score or comment cells in Evaluations are edited.
 */
function onEditHandler(e) {
  runLogged('onEditHandler', function () {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    if (sheet.getName() !== SHEETS.EVALUATIONS) return;

    const startRow = e.range.getRow();
    const endRow = e.range.getLastRow();
    const startCol = e.range.getColumn();
    const endCol = e.range.getLastColumn();

    if (endRow < 2) return;
    if (endCol < COLS.Evaluations.I1 || startCol > COLS.Evaluations.COMMENT) return;

    const firstRow = Math.max(2, startRow);
    const numRows = endRow - firstRow + 1;
    const activeEmail = normalizeEmail(Session.getActiveUser().getEmail());
    const submittedBy = activeEmail || SOURCES.MANUAL_UNKNOWN;
    const updatedAt = nowJakarta();

    const stamps = [];
    for (let i = 0; i < numRows; i++) {
      stamps.push([submittedBy, updatedAt, SOURCES.MANUAL]);
    }

    withScriptLock(function () {
      sheet.getRange(firstRow, COLS.Evaluations.SUBMITTED_BY, numRows, 3).setValues(stamps);
    });
  });
}

/**
 * Menu and editor action: appends one Summary row per evaluated staff for the period if not already present.
 */
function openPeriod(periodId) {
  runLogged('openPeriod', function () {
    const targetPeriodId = periodId ? String(periodId).trim() : String(getConfigValue('ACTIVE_PERIOD')).trim();
    getPeriod(targetPeriodId);

    const evaluatedStaff = readTable(SHEETS.MASTER).filter(isEvaluatedStaff);

    withScriptLock(function () {
      const sheet = getSheetOrThrow(SHEETS.SUMMARY);
      const summaryRows = readTable(SHEETS.SUMMARY);
      const existingNims = {};
      summaryRows.forEach(function (row) {
        if (String(row.period_id).trim() === targetPeriodId) {
          existingNims[String(row.nim).trim()] = true;
        }
      });

      const missingStaff = evaluatedStaff.filter(function (staff) {
        return !existingNims[String(staff.nim).trim()];
      });
      if (!missingStaff.length) return;

      const rowsToWrite = missingStaff.map(function (staff) {
        return [
          targetPeriodId,
          String(staff.nim).trim(),
          String(staff.name).trim(),
          String(staff.division).trim(),
        ];
      });

      // Reuse row 2 if it holds only template formulas with empty A2:D2.
      const row2Unfilled = summaryRows.length === 1 &&
        String(summaryRows[0].period_id || '').trim() === '' &&
        String(summaryRows[0].nim || '').trim() === '';
      const startRow = row2Unfilled ? 2 : sheet.getLastRow() + 1;
      const endRow = startRow + rowsToWrite.length - 1;

      sheet.getRange(startRow, 1, rowsToWrite.length, 4).setValues(rowsToWrite);

      const formulaStartCol = COLS.Summary.HAS_KW;
      const formulaColCount = HEADERS.Summary.length - formulaStartCol + 1;
      const templateRange = sheet.getRange(2, formulaStartCol, 1, formulaColCount);
      const hasTemplateFormulas = templateRange.getFormulas()[0].some(Boolean);
      const copyStartRow = Math.max(3, startRow);
      if (!hasTemplateFormulas) {
        console.warn('openPeriod: Summary row 2 has no formulas in E:Q, so ' + rowsToWrite.length +
          ' new rows for ' + targetPeriodId + ' have no scores. Add the template formulas (A-02) and fill them down');
      }

      if (hasTemplateFormulas && endRow >= copyStartRow) {
        const destRange = sheet.getRange(copyStartRow, formulaStartCol, endRow - copyStartRow + 1, formulaColCount);
        templateRange.copyTo(destRange);
        const falseOverrides = [];
        for (let r = copyStartRow; r <= endRow; r++) {
          falseOverrides.push([false]);
        }
        sheet.getRange(copyStartRow, COLS.Summary.TIE_OVERRIDE, falseOverrides.length, 1).setValues(falseOverrides);
      }
    });
  });
}
