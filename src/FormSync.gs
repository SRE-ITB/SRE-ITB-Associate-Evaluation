// B-01: keeps the Form dropdowns in sync with the Periods list and the Master sheet.
// Only updates choices on existing items. Never adds, removes, or renames items,
// because that would change the column layout of the Form Responses sheet.

function syncForm() {
  return runLogged('syncForm', function () {
    return withScriptLock(function () {
      const form = FormApp.openById(getConfigValue('FORM_ID'));
      const itemsByTitle = indexListItemsByTitle_(form);

      syncPeriodChoices_(itemsByTitle);
      syncStaffChoices_(itemsByTitle);
    });
  });
}

// Dropdown items only, keyed by title. Duplicate titles would make matching ambiguous.
function indexListItemsByTitle_(form) {
  const byTitle = {};
  form.getItems(FormApp.ItemType.LIST).forEach(function (item) {
    const title = item.getTitle();
    if (byTitle[title]) throw new Error('Form has more than one dropdown titled "' + title + '"');
    byTitle[title] = item.asListItem();
  });
  return byTitle;
}

function requireListItem_(itemsByTitle, title) {
  const item = itemsByTitle[title];
  if (!item) throw new Error('Form dropdown "' + title + '" not found. Do not rename or delete Form items');
  return item;
}

function syncPeriodChoices_(itemsByTitle) {
  const item = requireListItem_(itemsByTitle, FORM_TITLES.PERIOD);
  const periods = getPeriods();
  if (periods.length === 0) throw new Error('No periods found in ' + PERIODS_RANGE_NAME);

  // The choice value is period_id so the submit handler can match it to Evaluations.period_id.
  item.setChoices(periods.map(function (p) { return item.createChoice(p.periodId); }));
}

function syncStaffChoices_(itemsByTitle) {
  const evaluated = readTable(SHEETS.MASTER).filter(isEvaluatedStaff);

  const byDivision = {};
  evaluated.forEach(function (row) {
    const division = String(row.division).trim();
    (byDivision[division] = byDivision[division] || []).push(row);
  });

  Object.keys(byDivision).forEach(function (division) {
    if (DIVISIONS.indexOf(division) === -1) {
      console.warn('Master has evaluated staff in unknown division "' + division + '" (not in DIVISIONS)');
    }
  });

  DIVISIONS.forEach(function (division) {
    const item = requireListItem_(itemsByTitle, staffItemTitle(division));
    const rows = (byDivision[division] || []).slice().sort(function (a, b) {
      return String(a.name).localeCompare(String(b.name), 'id');
    });

    if (rows.length === 0) {
      console.warn('No evaluated staff in division "' + division + '"');
      item.setChoices([item.createChoice(FORM_EMPTY_CHOICE)]);
      return;
    }

    item.setChoices(rows.map(function (row) {
      return item.createChoice(formatStaffChoice_(row));
    }));
  });
}

// Must stay compatible with parseNim() in Utils.gs, which reads the trailing "(NIM)".
function formatStaffChoice_(masterRecord) {
  return String(masterRecord.name).trim() + ' (' + String(masterRecord.nim).trim() + ')';
}