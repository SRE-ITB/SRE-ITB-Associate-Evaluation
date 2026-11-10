// Lead only, from the org account on PROD (L-04). Devs never run these.

const DAILY_SYNC_FORM_HOUR = 5;
const DAILY_BIRTHDAY_HOUR = 6;

/**
 * Run once from the editor as the org account. Removes all project triggers, then installs the four
 * in docs/01-architecture.md section 5. Safe to run again.
 */
function installTriggers() {
  runLogged('installTriggers', function () {
    const handlers = ['onFormSubmitHandler', 'onEditHandler', 'dailyBirthday', 'syncForm'];
    const missing = handlers.filter(function (name) { return typeof globalThis[name] !== 'function'; });
    if (missing.length) throw new Error('Handlers not deployed yet: ' + missing.join(', '));

    removeTriggers();
    const spreadsheet = SpreadsheetApp.getActive();
    ScriptApp.newTrigger('onFormSubmitHandler').forSpreadsheet(spreadsheet).onFormSubmit().create();
    ScriptApp.newTrigger('onEditHandler').forSpreadsheet(spreadsheet).onEdit().create();
    ScriptApp.newTrigger('syncForm').timeBased().everyDays(1).atHour(DAILY_SYNC_FORM_HOUR).inTimezone(TIME_ZONE).create();
    ScriptApp.newTrigger('dailyBirthday').timeBased().everyDays(1).atHour(DAILY_BIRTHDAY_HOUR).inTimezone(TIME_ZONE).create();
    console.log('Installed ' + ScriptApp.getProjectTriggers().length + ' triggers');
  });
}

/**
 * Removes every trigger of this project for the current user.
 */
function removeTriggers() {
  runLogged('removeTriggers', function () {
    ScriptApp.getProjectTriggers().forEach(function (trigger) {
      ScriptApp.deleteTrigger(trigger);
    });
  });
}
