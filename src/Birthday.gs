/**
 * Birthday.gs — B-02: poster ulang tahun harian + satu email ke OM.
 *
 * Konfigurasi dibaca dari tab Config (kontrak docs/01-architecture.md):
 *   TEMPLATE_BIRTHDAY  ID Slides template (format Google Slides, bukan .pptx)
 *   FOLDER_BIRTHDAY    ID folder "Birthday" (dibagikan ke OM, file mewarisi akses)
 *   OM_EMAILS          daftar email OM, dipisah koma
 * Sementara, kalau sel Config di atas kosong, dipakai Script Properties
 *
 * Bergantung pada Config.gs: TIME_ZONE, SHEETS, HEADERS, COLS, getConfig(), getConfigList().
 * Kolom BirthdayLog: date, nim, poster_file_id, emailed_at.
 */

/* ===================== ENTRY POINT ===================== */

/** Dipasang di trigger harian (~06.00 WIB). Trigger mengirim event object, jadi jangan pakai parameter. */
function dailyBirthday() {
  runBirthday_(new Date());
}

/** Dijalankan SEKALI oleh Lead di sistem asli. */
function installBirthdayTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'dailyBirthday'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('dailyBirthday').timeBased().everyDays(1).atHour(6).inTimezone(TIME_ZONE).create();
}

/** Inti proses; `today` bisa disuntik untuk tes (mis. 28 Feb tahun non-kabisat). */
function runBirthday_(today) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Proses ulang tahun lain sedang berjalan');
  try {
    // Semua konfigurasi dicek di awal, sebelum ada poster atau baris log yang dibuat.
    var templateId = getSetting_('TEMPLATE_BIRTHDAY', 'BIRTHDAY_TEMPLATE_ID');
    var rootId = getSetting_('FOLDER_BIRTHDAY', 'BIRTHDAY_ROOT_FOLDER_ID');
    var omEmails = getConfigList('OM_EMAILS');

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var todayKey = Utilities.formatDate(today, TIME_ZONE, 'yyyy-MM-dd');
    var master = readMaster_(ss);
    var byNim = {};
    master.forEach(function (m) { byNim[m.id] = m; });

    var log = getLogSheet_(ss);
    var L = COLS.BirthdayLog;
    var logValues = log.getDataRange().getValues();
    var done = {};
    var ok = [];
    var failed = [];

    // Baris log hari ini yang posternya ada tetapi emailnya belum terkirim ikut dikirim sekarang.
    for (var i = 1; i < logValues.length; i++) {
      var r = logValues[i];
      var d = normalizeDate_(r[L.DATE - 1]);
      var nim = String(r[L.NIM - 1]).trim();
      if (!nim) continue;
      done[d + '|' + nim] = true;
      var fileId = String(r[L.POSTER_FILE_ID - 1] || '').trim();
      if (d === todayKey && fileId && !r[L.EMAILED_AT - 1]) {
        var person = byNim[nim] || { name: nim, division: '-' };
        try {
          ok.push({ name: person.name, division: person.division, url: DriveApp.getFileById(fileId).getUrl(), row: i + 1 });
        } catch (err) {
          failed.push({ name: person.name, division: person.division, reason: 'Poster di log tidak bisa dibuka: ' + String(err.message || err) });
        }
      }
    }

    // Aktif = tetap dapat poster walau evaluated = FALSE (D-032)
    var targets = master.filter(function (m) {
      return m.active && m.birth && isBirthdayToday_(m.birth, today) && !done[todayKey + '|' + m.id];
    });

    if (targets.length === 0 && ok.length === 0 && failed.length === 0) return; // tidak ada email

    if (targets.length) {
      var folder = getOrCreateMonthFolder_(rootId, Utilities.formatDate(today, TIME_ZONE, 'yyyy-MM'));
      targets.forEach(function (m) {
        try {
          var file = renderPoster(
            templateId,
            { '{{name}}': m.name, '{{division}}': m.division },
            m.photoId,
            folder.getId(),
            'Ulang Tahun - ' + m.name + ' - ' + todayKey
          );
          var row = log.getLastRow() + 1;
          log.getRange(row, 1, 1, 2).setNumberFormat('@'); // date dan nim sebagai teks agar dedup stabil
          log.getRange(row, 1, 1, 3).setValues([[todayKey, m.id, file.getId()]]);
          ok.push({ name: m.name, division: m.division, url: file.getUrl(), row: row });
        } catch (err) {
          failed.push({ name: m.name, division: m.division, reason: String(err.message || err) });
        }
      });
    }

    sendBirthdayEmail_(todayKey, ok, failed, omEmails);

    // Tandai terkirim hanya setelah email benar-benar berhasil.
    var now = new Date();
    ok.forEach(function (o) {
      log.getRange(o.row, L.EMAILED_AT).setValue(now);
    });
  } finally {
    lock.releaseLock();
  }
}

/* ===================== KONFIGURASI ===================== */

/** Ambil dari tab Config; kalau kosong, fallback ke Script Property (sementara). */
function getSetting_(configKey, propKey) {
  var v = getConfig()[configKey];
  v = (v === undefined || v === null) ? '' : String(v).trim();
  if (!v) v = (PropertiesService.getScriptProperties().getProperty(propKey) || '').trim();
  if (!v) throw new Error('Config "' + configKey + '" belum diisi (atau Script Property ' + propKey + ').');
  return v;
}

/* ===================== LOGIKA TANGGAL ===================== */

/** Cocok bulan+hari di zona Asia/Jakarta; lahir 29 Feb dirayakan 28 Feb di tahun non-kabisat. */
function isBirthdayToday_(birth, today) {
  var b = Utilities.formatDate(birth, TIME_ZONE, 'MM-dd');
  var t = Utilities.formatDate(today, TIME_ZONE, 'MM-dd');
  if (b === t) return true;
  var year = Number(Utilities.formatDate(today, TIME_ZONE, 'yyyy'));
  return b === '02-29' && t === '02-28' && !isLeapYear_(year);
}

function isLeapYear_(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function normalizeDate_(v) {
  return v instanceof Date ? Utilities.formatDate(v, TIME_ZONE, 'yyyy-MM-dd') : String(v).trim();
}

/* ===================== EMAIL ===================== */

function sendBirthdayEmail_(todayKey, ok, failed, omEmails) {
  var subject = failed.length
    ? 'Ulang tahun hari ini (' + todayKey + '): ' + ok.length + ' siap, ' + failed.length + ' gagal'
    : 'Ulang tahun hari ini (' + todayKey + '): ' + ok.length + ' poster siap';

  var textLines = ['Poster ulang tahun hari ini:'];
  var htmlLines = ['<p>Poster ulang tahun hari ini:</p><ul>'];
  if (ok.length === 0) {
    textLines.push('- (Tidak ada poster yang berhasil dibuat)');
    htmlLines.push('<li><i>(Tidak ada poster yang berhasil dibuat)</i></li>');
  } else {
    ok.forEach(function (o) {
      textLines.push('- ' + o.name + ' (' + o.division + '): ' + o.url);
      htmlLines.push('<li><b>' + esc_(o.name) + '</b> (' + esc_(o.division) + ') — <a href="' + o.url + '">poster</a></li>');
    });
  }
  htmlLines.push('</ul>');

  if (failed.length) {
    textLines.push('', 'GAGAL dibuat:');
    htmlLines.push('<p><b>Gagal dibuat:</b></p><ul>');
    failed.forEach(function (f) {
      textLines.push('- ' + f.name + ' (' + f.division + '): ' + f.reason);
      htmlLines.push('<li>' + esc_(f.name) + ' (' + esc_(f.division) + ') — ' + esc_(f.reason) + '</li>');
    });
    htmlLines.push('</ul>');
  }

  GmailApp.sendEmail(omEmails.join(','), subject, textLines.join('\n'), {
    htmlBody: htmlLines.join(''),
    name: 'Sistem Penilaian SRE ITB'
  });
}

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ===================== DATA ===================== */

/**
 * ADAPTER ke tab Master (header sesuai HEADERS.Master di Config.gs).
 * Ganti `active` dengan isActiveMember() milik L-03 kalau sudah ada.
 */
function readMaster_(ss) {
  var values = ss.getSheetByName(SHEETS.MASTER).getDataRange().getValues();
  var header = values[0];
  function col(name) {
    var i = header.indexOf(name);
    if (i < 0) throw new Error('Kolom "' + name + '" tidak ada di tab ' + SHEETS.MASTER);
    return i;
  }
  var c = { id: col('nim'), name: col('name'), div: col('division'), birth: col('birth_date'),
            photo: col('photo_file_id'), active: col('active') };

  return values.slice(1).filter(function (r) { return r[c.id] !== ''; }).map(function (r) {
    var birth = r[c.birth];
    if (birth && !(birth instanceof Date)) {
      var s = String(birth).trim();
      birth = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T12:00:00+07:00') : new Date(s);
    }
    var m = String(r[c.photo] || '').match(/[-\w]{25,}/); // terima ID polos maupun link Drive
    return {
      id: String(r[c.id]).trim(),
      name: String(r[c.name]).trim(),
      division: String(r[c.div]).trim(),
      birth: birth instanceof Date && !isNaN(birth) ? birth : null,
      photoId: m ? m[0] : '',
      active: r[c.active] === true || String(r[c.active]).toUpperCase() === 'TRUE'
    };
  });
}

function getLogSheet_(ss) {
  var s = ss.getSheetByName(SHEETS.BIRTHDAY_LOG);
  if (!s) {
    s = ss.insertSheet(SHEETS.BIRTHDAY_LOG);
    s.appendRow(HEADERS.BirthdayLog);
  }
  return s;
}

function getOrCreateMonthFolder_(rootId, name) {
  var root = DriveApp.getFolderById(rootId);
  var it = root.getFoldersByName(name);
  return it.hasNext() ? it.next() : root.createFolder(name);
}

/* ===================== TES MANUAL ===================== */

/** Jalankan dari editor: tes Feb 29 tanpa menyentuh Drive/email. Lihat hasil di Logs. */
function test_feb29() {
  var birth = new Date('2000-02-29T12:00:00+07:00');                                       // 29 Feb 2000
  Logger.log('28 Feb 2027 (non-kabisat): ' + isBirthdayToday_(birth, new Date('2027-02-28T12:00:00+07:00'))); // true
  Logger.log('1 Mar 2027:                ' + isBirthdayToday_(birth, new Date('2027-03-01T12:00:00+07:00')));  // false
  Logger.log('28 Feb 2028 (kabisat):     ' + isBirthdayToday_(birth, new Date('2028-02-28T12:00:00+07:00'))); // false
  Logger.log('29 Feb 2028 (kabisat):     ' + isBirthdayToday_(birth, new Date('2028-02-29T12:00:00+07:00'))); // true
}

/** Jalankan end-to-end di salinan DEV dengan tanggal palsu (isi tanggal lahir staf fiktif). */
function test_runWithFakeToday() {
  runBirthday_(new Date('2026-11-21T12:00:00+07:00'));
  // Jalankan lagi: harus tidak ada poster/email baru (dedup lewat BirthdayLog)
}

function debugPhotoElement() {
  var id = getSetting_('TEMPLATE_BIRTHDAY', 'BIRTHDAY_TEMPLATE_ID');
  var els = SlidesApp.openById(id).getSlides()[0].getPageElements();
  els.forEach(function (e, i) {
    Logger.log(i + ' ' + e.getPageElementType() +
      ' title="' + e.getTitle() + '" desc="' + e.getDescription() + '"' +
      ' L=' + Math.round(e.getLeft()) + ' T=' + Math.round(e.getTop()) +
      ' W=' + Math.round(e.getWidth()) + ' H=' + Math.round(e.getHeight()));
  });
}