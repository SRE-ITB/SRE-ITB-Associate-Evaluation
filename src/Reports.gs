const REPORT_BATCH_MAX_MS = 4 * 60 * 1000;
const REPORT_CURSOR_PREFIX = 'REPORTS_CURSOR_';

/**
 * @param {string=} periodId
 */
function generateReports(periodId) {
  runLogged('generateReports', function () {
    const startTime = Date.now();
    const targetPeriodId = String(periodId || getConfigValue('ACTIVE_PERIOD')).trim();
    const period = getPeriod(targetPeriodId);

    const rootFolderId = getConfigValue('FOLDER_REPORTS');
    const templateId = getConfigValue('TEMPLATE_REPORT');

    const rootFolder = DriveApp.getFolderById(rootFolderId);
    const templateFile = DriveApp.getFileById(templateId);

    const summaryRows = readTable(SHEETS.SUMMARY)
      .filter(function (row) {
        return String(row.period_id || '').trim() === targetPeriodId &&
          String(row.nim || '').trim() !== '';
      })
      .sort(function (a, b) {
        const divCmp = String(a.division || '').localeCompare(String(b.division || ''));
        if (divCmp !== 0) return divCmp;
        return String(a.nim || '').localeCompare(String(b.nim || ''));
      });

    if (summaryRows.length === 0) {
      notifyReportStatus(
        'Generate Reports',
        'Tidak ada data di tab ' + SHEETS.SUMMARY + ' untuk periode ' + targetPeriodId + '.'
      );
      return;
    }

    const commentsByNim = groupCommentsByNim(targetPeriodId);
    const periodFolder = getOrCreateSubfolder(rootFolder, targetPeriodId);
    const divisionFolderCache = {};

    const props = PropertiesService.getScriptProperties();
    const cursorKey = REPORT_CURSOR_PREFIX + targetPeriodId;
    const lastProcessedNim = props.getProperty(cursorKey);

    let startIndex = 0;
    if (lastProcessedNim) {
      const foundIndex = summaryRows.findIndex(function (r) {
        return String(r.nim).trim() === lastProcessedNim;
      });
      if (foundIndex !== -1 && foundIndex + 1 < summaryRows.length) {
        startIndex = foundIndex + 1;
      }
    }

    const periodDisplay = period.label
      ? String(period.label).trim() + ' (' + targetPeriodId + ')'
      : targetPeriodId;

    let generatedCount = 0;

    for (let i = startIndex; i < summaryRows.length; i++) {
      if (Date.now() - startTime > REPORT_BATCH_MAX_MS) {
        const pausedNim = String(summaryRows[i - 1].nim).trim();
        props.setProperty(cursorKey, pausedNim);
        const remaining = summaryRows.length - i;
        notifyReportStatus(
          'Generate Reports (Batch Paused)',
          'Berhasil membuat ' + generatedCount + ' rapot PDF untuk periode ' + targetPeriodId + '.\n' +
          'Tersisa ' + remaining + ' associate lagi karena mendekati batas waktu eksekusi.\n\n' +
          'Jalankan kembali "SRE Tools > Generate reports" untuk melanjutkan otomatis.'
        );
        return;
      }

      const row = summaryRows[i];
      const nim = String(row.nim).trim();
      const name = String(row.name || '').trim();
      const division = String(row.division || 'Uncategorized').trim();

      if (!divisionFolderCache[division]) {
        divisionFolderCache[division] = getOrCreateSubfolder(periodFolder, division);
      }
      const divisionFolder = divisionFolderCache[division];

      const comments = commentsByNim[nim] && commentsByNim[nim].length > 0
        ? commentsByNim[nim]
        : ['Belum ada catatan evaluasi.'];

      createSingleReportPdf(templateFile, divisionFolder, {
        periodId: targetPeriodId,
        periodDisplay: periodDisplay,
        nim: nim,
        name: name,
        division: division,
        complete: isTruthyCell(row.complete),
        i1: row.final_i1,
        i2: row.final_i2,
        i3: row.final_i3,
        i4: row.final_i4,
        total: row.final_total,
        avg: row.final_avg,
        status: String(row.status || '').trim() || STATUSES.INCOMPLETE,
        comments: comments,
      });

      generatedCount++;
    }

    props.deleteProperty(cursorKey);
    notifyReportStatus(
      'Generate Reports Selesai',
      'Berhasil membuat ' + generatedCount + ' rapot PDF untuk periode ' + targetPeriodId + '.\n' +
      'Lokasi: folder Output / ' + targetPeriodId + ' / <Divisi>.'
    );
  });
}

function groupCommentsByNim(periodId) {
  const map = {};
  const evalRows = readTable(SHEETS.EVALUATIONS);

  evalRows.forEach(function (row) {
    if (String(row.period_id || '').trim() !== periodId) return;
    if (String(row.flag || '').trim() === FLAGS.IGNORED_OM_ROLE) return;

    const nim = String(row.nim || '').trim();
    const comment = String(row.comment || '').trim();
    if (!nim || !comment) return;

    if (!map[nim]) map[nim] = [];
    map[nim].push(comment);
  });

  return map;
}

function createSingleReportPdf(templateFile, divisionFolder, data) {
  const safeName = sanitizeFileName(data.name);
  const safeNim = sanitizeFileName(data.nim);
  const safePeriod = sanitizeFileName(data.periodId);

  const pdfFileName = 'Rapot_' + safePeriod + '_' + safeNim + '_' + safeName + '.pdf';
  const tempDocName = 'TEMP_Rapot_' + safePeriod + '_' + safeNim + '_' + Date.now();

  const tempDocFile = templateFile.makeCopy(tempDocName, divisionFolder);

  try {
    const doc = DocumentApp.openById(tempDocFile.getId());
    const body = doc.getBody();

    const skorAkhirText = data.complete
      ? formatScoreValue(data.total)
      : '-';

    replaceTemplateTag(body, 'nama', data.name);
    replaceTemplateTag(body, 'nim', data.nim);
    replaceTemplateTag(body, 'divisi', data.division);
    replaceTemplateTag(body, 'periode', data.periodDisplay);
    replaceTemplateTag(body, 'i1', data.complete ? formatScoreValue(data.i1) : '-');
    replaceTemplateTag(body, 'i2', data.complete ? formatScoreValue(data.i2) : '-');
    replaceTemplateTag(body, 'i3', data.complete ? formatScoreValue(data.i3) : '-');
    replaceTemplateTag(body, 'i4', data.complete ? formatScoreValue(data.i4) : '-');
    replaceTemplateTag(body, 'skor_akhir', skorAkhirText);
    applyStatusTag(body, data.status);

    populateCommentsTable(body, data.comments);

    doc.saveAndClose();

    trashExistingReportPdfs(divisionFolder, safePeriod, safeNim);

    const pdfBlob = tempDocFile.getAs(MimeType.PDF).setName(pdfFileName);
    divisionFolder.createFile(pdfBlob);
  } finally {
    tempDocFile.setTrashed(true);
  }
}

function populateCommentsTable(body, comments) {
  const tables = body.getTables();
  for (let t = 0; t < tables.length; t++) {
    const table = tables[t];
    for (let r = 0; r < table.getNumRows(); r++) {
      const row = table.getRow(r);
      for (let c = 0; c < row.getNumCells(); c++) {
        const cell = row.getCell(c);
        if (cell.getText().indexOf('{{catatan}}') !== -1) {
          cell.setText(comments[0]);
          for (let k = 1; k < comments.length; k++) {
            const clonedRow = row.copy();
            clonedRow.getCell(c).setText(comments[k]);
            table.insertTableRow(r + k, clonedRow);
          }
          return;
        }
      }
    }
  }

  replaceTemplateTag(
    body,
    'catatan',
    comments.map(function (c) { return '- ' + c; }).join('\n')
  );
}

function replaceTemplateTag(body, tagName, value) {
  const pattern = '\\{\\{' + tagName + '\\}\\}';
  const safeReplacement = String(value === undefined || value === null ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/\$/g, '$$$$');
  body.replaceText(pattern, safeReplacement);
}

function applyStatusTag(body, statusValue) {
  const statusText = String(statusValue || '').trim() || STATUSES.INCOMPLETE;
  const color = getStatusFontColor(statusText);

  let found = body.findText('\\{\\{status\\}\\}');
  while (found) {
    const textEl = found.getElement().asText();
    const start = found.getStartOffset();
    const end = found.getEndOffsetInclusive();

    textEl.deleteText(start, end);
    textEl.insertText(start, statusText);

    if (statusText.length > 0) {
      const newEnd = start + statusText.length - 1;
      textEl.setForegroundColor(start, newEnd, color);
      textEl.setBold(start, newEnd, true);
    }

    found = body.findText('\\{\\{status\\}\\}');
  }
}

function getStatusFontColor(statusText) {
  const normalized = String(statusText || '').trim().toLowerCase();

  if (normalized === 'red notice') {
    return '#DC2626'; // Merah
  }
  if (normalized.indexOf('best staff') === 0) {
    return '#15803D'; // Hijau tua
  }
  if (normalized === 'belum lengkap' || normalized === 'incomplete') {
    return '#D97706'; // Oranye / amber
  }
  if (normalized === 'normal') {
    return '#000000'; // Hitam
  }
  return '#374151'; // Abu-abu gelap
}

function formatScoreValue(value) {
  const num = Number(value);
  if (isNaN(num)) return String(value || '-');
  return String(Number(num.toFixed(2)));
}

function getOrCreateSubfolder(parentFolder, folderName) {
  const existing = parentFolder.getFoldersByName(folderName);
  if (existing.hasNext()) return existing.next();
  return parentFolder.createFolder(folderName);
}

function trashExistingReportPdfs(folder, safePeriod, safeNim) {
  const prefix = 'Rapot_' + safePeriod + '_' + safeNim + '_';
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    if (name.indexOf(prefix) === 0 && name.slice(-4).toLowerCase() === '.pdf') {
      file.setTrashed(true);
    }
  }
}

function sanitizeFileName(name) {
  return String(name || 'Unknown')
    .replace(/[\/\\:*?"<>|]/g, '_')
    .trim();
}

function notifyReportStatus(title, message) {
  console.log('[' + title + '] ' + message);
  try {
    SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
  }
}