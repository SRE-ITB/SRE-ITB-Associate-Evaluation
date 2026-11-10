/**
 * Simple trigger: builds the SRE Tools menu when the spreadsheet opens.
 * Devs add their own entries here in their PR; the lead reviews the change.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('SRE Tools')
    .addItem('Show active period', 'showActivePeriod')
    .addToUi();
}

/**
 * Menu: shows the active period from Config. Also a quick check that getConfig() works.
 */
function showActivePeriod() {
  runLogged('showActivePeriod', function () {
    const periodId = getConfigValue('ACTIVE_PERIOD');
    const period = getPeriod(periodId);
    SpreadsheetApp.getUi().alert(
      'Active period: ' + period.periodId + ' (' + period.label + ')\n' +
      formatDateJakarta(period.startDate) + ' to ' + formatDateJakarta(period.endDate) + '\n' +
      'Environment: ' + getConfigValue('ENV')
    );
  });
}
