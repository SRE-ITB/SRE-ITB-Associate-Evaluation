/**
 * BestStaffPoster.gs — B-03: poster Best Staff per divisi untuk satu periode.
 *
 * Config (tab Config): TEMPLATE_BEST_STAFF, FOLDER_BEST_STAFF.
 * Sheet hanya dibaca. Output: BestStaff/<period_id>/<division>.png (ditimpa jika dijalankan ulang).
 */

var BS_STATUS_BEST = 'Best Staff'; // persis, bukan "Best Staff (Sementara)"
var BS_STATUS_TIE = 'Tie';

var BS_REASON = {
  INCOMPLETE: 'incomplete',
  TIE: 'tie',
  NO_ELIGIBLE: 'no eligible staff',
  NO_PHOTO: 'no photo',
  ERROR: 'error'
};

/**
 * @param {string} periodId
 * @return {{generated: Object[], skipped: Object[]}}
 */
function generateBestStaffPosters(periodId) {
  periodId = String(periodId || '').trim();
  if (!periodId) throw new Error('periodId wajib diisi.');

  var result = { generated: [], skipped: [] };

  withScriptLock(function () {
    var templateId = getConfigValue('TEMPLATE_BEST_STAFF');
    var rootId = getConfigValue('FOLDER_BEST_STAFF');
    var periodLabel = getPeriod(periodId).label;

    var rows = readTable(SHEETS.SUMMARY).filter(function (r) {
      return String(r.period_id).trim() === periodId && String(r.division).trim();
    });
    if (rows.length === 0) throw new Error('Tidak ada data Summary untuk periode ' + periodId + '.');

    var photoByNim = {};
    readTable(SHEETS.MASTER).forEach(function (m) {
      var match = String(m.photo_file_id || '').match(/[-\w]{25,}/); // ID polos atau link Drive
      photoByNim[String(m.nim).trim()] = match ? match[0] : '';
    });

    var divisions = {};
    var order = [];
    rows.forEach(function (r) {
      var d = String(r.division).trim();
      if (!divisions[d]) { divisions[d] = []; order.push(d); }
      divisions[d].push(r);
    });

    var periodFolder = null; // dibuat hanya jika ada poster

    order.forEach(function (division) {
      var divRows = divisions[division];

      var complete = divRows.every(function (r) { return isTrue_(r.division_complete); });
      if (!complete) {
        result.skipped.push({ division: division, reason: BS_REASON.INCOMPLETE });
        return;
      }

      var best = divRows.filter(function (r) { return String(r.status).trim() === BS_STATUS_BEST; });
      var tied = divRows.filter(function (r) { return String(r.status).trim() === BS_STATUS_TIE; });

      if (best.length > 1 || (best.length === 0 && tied.length > 0)) {
        var names = (best.length ? best : tied).map(function (r) { return r.name; }).join(', ');
        result.skipped.push({ division: division, reason: BS_REASON.TIE, detail: names });
        return;
      }
      if (best.length === 0) {
        result.skipped.push({ division: division, reason: BS_REASON.NO_ELIGIBLE });
        return;
      }

      var winner = best[0];
      var photoId = photoByNim[String(winner.nim).trim()];
      if (!photoId) {
        result.skipped.push({ division: division, reason: BS_REASON.NO_PHOTO, detail: winner.name });
        return;
      }

      try {
        if (!periodFolder) {
          periodFolder = getOrCreateSubfolder_(DriveApp.getFolderById(rootId), periodId);
        }
        var file = renderPoster(
          templateId,
          { '{{name}}': winner.name, '{{division}}': division, '{{period}}': periodLabel },
          photoId,
          periodFolder.getId(),
          division
        );
        // Timpa hasil lama setelah render baru sukses, supaya poster lama tidak hilang jika render gagal.
        trashOldCopies_(periodFolder, file);
        result.generated.push({ division: division, name: winner.name, url: file.getUrl() });
      } catch (err) {
        console.error('[bestStaff] ' + division + ': ' + err.stack);
        result.skipped.push({ division: division, reason: BS_REASON.ERROR, detail: String(err.message || err) });
      }
    });
  });

  return result;
}

/**
 * Runner tanpa argumen untuk tombol Run di editor Apps Script:
 * generate untuk ACTIVE_PERIOD tanpa dialog, hasil ditulis ke Execution log.
 */
function generateBestStaffPostersActive() {
  var periodId = String(getConfigValue('ACTIVE_PERIOD') || '').trim();
  var result = generateBestStaffPosters(periodId);
  console.log('Periode ' + periodId + '\n' + formatBestStaffSummary_(result));
  return result;
}

/** Menu: generate untuk ACTIVE_PERIOD, konfirmasi dulu, lalu tampilkan ringkasan. */
function generateBestStaffPostersMenu() {
  runLogged('generateBestStaffPostersMenu', function () {
    var ui = SpreadsheetApp.getUi();
    var period = getPeriod(getConfigValue('ACTIVE_PERIOD'));

    var confirm = ui.alert(
      'Generate Best Staff Poster',
      'Periode: ' + period.periodId + ' (' + period.label + ')\n' +
      'Poster lama untuk periode ini akan ditimpa. Lanjutkan?',
      ui.ButtonSet.OK_CANCEL
    );
    if (confirm !== ui.Button.OK) return;

    ui.alert('Best Staff Poster', formatBestStaffSummary_(generateBestStaffPosters(period.periodId)), ui.ButtonSet.OK);
  });
}

/* ===================== HELPER ===================== */

/** Checkbox atau formula bisa menghasilkan boolean true atau teks "TRUE". */
function isTrue_(v) {
  return v === true || String(v).trim().toUpperCase() === 'TRUE';
}

function getOrCreateSubfolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/** Buang file lama bernama sama di folder, kecuali file yang baru dibuat. */
function trashOldCopies_(folder, keepFile) {
  var it = folder.getFilesByName(keepFile.getName());
  while (it.hasNext()) {
    var f = it.next();
    if (f.getId() !== keepFile.getId()) f.setTrashed(true);
  }
}

function formatBestStaffSummary_(result) {
  var lines = ['Berhasil (' + result.generated.length + '):'];
  if (result.generated.length === 0) lines.push('  -');
  result.generated.forEach(function (g) {
    lines.push('  • ' + g.division + ' — ' + g.name);
  });

  lines.push('', 'Dilewati (' + result.skipped.length + '):');
  if (result.skipped.length === 0) lines.push('  -');
  result.skipped.forEach(function (s) {
    lines.push('  • ' + s.division + ' — ' + s.reason + (s.detail ? ' (' + s.detail + ')' : ''));
  });
  return lines.join('\n');
}