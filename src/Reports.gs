const REPORT_BATCH_MAX_MS = 4 * 60 * 1000;
const REPORT_CURSOR_PREFIX = 'REPORTS_CURSOR_';

/**
 * @param {string=} periodId
 */
function generateReports(periodId) {
  runLogged('generateReports', function () {
    withScriptLock(function () {
      const startTime = Date.now();
      const targetPeriodId = String(periodId || getConfigValue('ACTIVE_PERIOD')).trim();
      const period = getPeriod(targetPeriodId);

      const rootFolderId = getConfigValue('FOLDER_REPORTS');
      const templateId = getConfigValue('TEMPLATE_REPORT');

      const rootFolder = DriveApp.getFolderById(rootFolderId);
      const templateFile = DriveApp.getFileById(templateId);

      const periodSummaryRows = readTable(SHEETS.SUMMARY)
        .filter(function (row) {
          return String(row.period_id || '').trim() === targetPeriodId &&
            String(row.nim || '').trim() !== '';
        })
        .sort(function (a, b) {
          const divCmp = String(a.division || '').localeCompare(String(b.division || ''));
          if (divCmp !== 0) return divCmp;
          return String(a.nim || '').localeCompare(String(b.nim || ''));
        });

      if (periodSummaryRows.length === 0) {
        const emptyMsg = 'Tidak ada data di tab ' + SHEETS.SUMMARY + ' untuk periode ' + targetPeriodId + '.';
        notifyReportStatus('Generate Reports', emptyMsg, emptyMsg);
        return;
      }

      const eligibleRows = periodSummaryRows.filter(function (row) {
        return isTruthyCell(row.complete);
      });
      const skippedCount = periodSummaryRows.length - eligibleRows.length;

      if (eligibleRows.length === 0) {
        const noneMsg = 'Dibuat 0, dilewati ' + skippedCount + ' (belum lengkap).';
        notifyReportStatus('Generate Reports', noneMsg, noneMsg);
        return;
      }

      const props = PropertiesService.getScriptProperties();
      const cursorKey = REPORT_CURSOR_PREFIX + targetPeriodId;
      const lastProcessedNim = props.getProperty(cursorKey);

      let startIndex = 0;
      if (lastProcessedNim) {
        const foundIndex = eligibleRows.findIndex(function (r) {
          return String(r.nim).trim() === lastProcessedNim;
        });
        if (foundIndex !== -1) {
          if (foundIndex + 1 >= eligibleRows.length) {
            props.deleteProperty(cursorKey);
            const doneMsg = 'Semua rapor complete untuk periode ' + targetPeriodId +
              ' sudah selesai diproses. Dilewati ' + skippedCount + ' (belum lengkap).';
            notifyReportStatus('Generate Reports', doneMsg, doneMsg);
            return;
          }
          startIndex = foundIndex + 1;
        } else {
          props.deleteProperty(cursorKey);
        }
      }

      const commentsByNim = groupCommentsByNim(targetPeriodId);
      const periodFolder = getOrCreateSubfolder(rootFolder, targetPeriodId);
      const divisionFolderCache = {};

      const periodDisplay = period.label
        ? String(period.label).trim() + ' (' + targetPeriodId + ')'
        : targetPeriodId;

      let generatedCount = 0;

      for (let i = startIndex; i < eligibleRows.length; i++) {
        if (Date.now() - startTime > REPORT_BATCH_MAX_MS) {
          if (i > startIndex) {
            const pausedNim = String(eligibleRows[i - 1].nim).trim();
            props.setProperty(cursorKey, pausedNim);
          }
          const remaining = eligibleRows.length - i;
          const batchSummary = 'Dibuat ' + generatedCount + ', dilewati ' + skippedCount +
            ' (belum lengkap), tersisa ' + remaining + ' lagi.';
          notifyReportStatus(
            'Generate Reports (Batch Paused)',
            batchSummary + '\n\nMendekati batas waktu eksekusi. Jalankan kembali "SRE Tools > Generate reports" untuk melanjutkan otomatis.',
            batchSummary
          );
          return;
        }

        const row = eligibleRows[i];
        const nim = String(row.nim).trim();
        const name = String(row.name || '').trim();
        const division = String(row.division || '').trim();

        if (!division) {
          throw new Error('Baris Summary untuk NIM ' + nim + ' (' + targetPeriodId + ') tidak memiliki division.');
        }
        if (!name) {
          throw new Error('Baris Summary untuk NIM ' + nim + ' (' + targetPeriodId + ') tidak memiliki name.');
        }

        if (!divisionFolderCache[division]) {
          divisionFolderCache[division] = getOrCreateSubfolder(periodFolder, division);
        }
        const divisionFolder = divisionFolderCache[division];

        const comments = commentsByNim[nim] || [];

        createSingleReportPdf(templateFile, rootFolder, divisionFolder, {
          periodId: targetPeriodId,
          periodDisplay: periodDisplay,
          nim: nim,
          name: name,
          division: division,
          i1: row.final_i1,
          i2: row.final_i2,
          i3: row.final_i3,
          i4: row.final_i4,
          total: row.final_total,
          average: row.final_avg,
          status: String(row.status || '').trim(),
          comments: comments,
        });

        generatedCount++;
      }

      props.deleteProperty(cursorKey);
      const summaryText = 'Dibuat ' + generatedCount + ', dilewati ' + skippedCount + ' (belum lengkap).';
      notifyReportStatus(
        'Generate Reports Selesai',
        summaryText + '\nLokasi: Output/Reports/' + targetPeriodId + '/<Divisi>/.',
        summaryText
      );
    });
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

  Object.keys(map).forEach(function (nim) {
    map[nim].sort(function (a, b) {
      return a.localeCompare(b, 'id');
    });
  });

  return map;
}

function reportStatusText(status) {
  if (status === STATUSES.BEST_STAFF || status === STATUSES.RED_NOTICE) return status;
  return '';
}

function createSingleReportPdf(templateFile, tempParentFolder, divisionFolder, data) {
  const safeName = sanitizeFileName(data.name);
  const safeNim = sanitizeFileName(data.nim);
  const safePeriod = sanitizeFileName(data.periodId);

  const pdfFileName = safeNim + ' - ' + safeName + '.pdf';
  const tempDocName = 'TEMP_Rapot_' + safePeriod + '_' + safeNim + '_' + Date.now();

  const tempDocFile = templateFile.makeCopy(tempDocName, tempParentFolder);

  try {
    const doc = DocumentApp.openById(tempDocFile.getId());
    const body = doc.getBody();

    replaceTemplateTag(body, 'name', data.name);
    replaceTemplateTag(body, 'nim', data.nim);
    replaceTemplateTag(body, 'division', data.division);
    replaceTemplateTag(body, 'period', data.periodDisplay);
    replaceTemplateTag(body, 'i1', formatScoreValue(data.i1));
    replaceTemplateTag(body, 'i2', formatScoreValue(data.i2));
    replaceTemplateTag(body, 'i3', formatScoreValue(data.i3));
    replaceTemplateTag(body, 'i4', formatScoreValue(data.i4));
    replaceTemplateTag(body, 'total', formatScoreValue(data.total));
    replaceTemplateTag(body, 'average', formatScoreValue(data.average));
    replaceTemplateTag(body, 'status', reportStatusText(data.status));
    replaceTemplateTag(body, 'comments', data.comments.join('\n'));

    doc.saveAndClose();

    trashExistingReportPdfs(divisionFolder, safeNim);

    const pdfBlob = tempDocFile.getAs(MimeType.PDF).setName(pdfFileName);
    divisionFolder.createFile(pdfBlob);
  } finally {
    tempDocFile.setTrashed(true);
  }
}

function replaceTemplateTag(body, tagName, value) {
  const pattern = '\\{\\{' + tagName + '\\}\\}';
  const safeReplacement = String(value === undefined || value === null ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/\$/g, '$$$$');
  body.replaceText(pattern, safeReplacement);
}

function formatScoreValue(value) {
  const num = Number(value);
  if (isNaN(num)) return String(value || '');
  return (Math.round(num * 10 + 1e-9) / 10).toFixed(1);
}

function getOrCreateSubfolder(parentFolder, folderName) {
  const existing = parentFolder.getFoldersByName(folderName);
  if (existing.hasNext()) return existing.next();
  return parentFolder.createFolder(folderName);
}

function trashExistingReportPdfs(folder, safeNim) {
  const prefix = safeNim + ' - ';
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

function notifyReportStatus(title, alertMessage, toastMessage) {
  console.log('[' + title + '] ' + alertMessage);
  const ss = SpreadsheetApp.getActive();
  if (ss) {
    try {
      ss.toast(toastMessage || alertMessage, title, 8);
    } catch (e) {
      console.warn('[notifyReportStatus] Toast skipped: ' + (e && e.message ? e.message : e));
    }
  }
  try {
    SpreadsheetApp.getUi().alert(title, alertMessage, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    console.warn('[notifyReportStatus] UI alert skipped: ' + (e && e.message ? e.message : e));
  }
}