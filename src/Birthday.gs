/**
 * Birthday.gs — B-02: poster ulang tahun harian + satu email ke OM.
 *
 * Config (tab Config):
 *   TEMPLATE_BIRTHDAY  ID Slides template (format Google Slides, bukan .pptx)
 *   FOLDER_BIRTHDAY    ID folder "Birthday" (dibagikan ke OM, file mewarisi akses)
 *   OM_EMAILS          daftar email OM, dipisah koma
 * Kolom BirthdayLog: date, nim, poster_file_id, emailed_at.
 */

/* ===================== ENTRY POINT ===================== */

/** Dipasang lewat installTriggers() (Triggers.gs). Trigger mengirim event object, jadi tanpa parameter. */
function dailyBirthday() {
  runLogged('dailyBirthday', function () {
    runBirthday_(new Date());
  });
}

/** Inti proses; `today` bisa disuntik untuk tes (mis. 28 Feb tahun non-kabisat). */
function runBirthday_(today) {
  withScriptLock(function () {
    // Semua config dicek di awal, sebelum ada poster atau baris log yang dibuat.
    var templateId = getConfigValue('TEMPLATE_BIRTHDAY');
    var rootId = getConfigValue('FOLDER_BIRTHDAY');
    var omEmails = getConfigList('OM_EMAILS');

    var todayKey = Utilities.formatDate(today, TIME_ZONE, 'yyyy-MM-dd');
    var master = readTable(SHEETS.MASTER).map(parseMember_);
    var byNim = {};
    master.forEach(function (m) { byNim[m.id] = m; });

    var log = getSheetOrThrow(SHEETS.BIRTHDAY_LOG);
    var L = COLS.BirthdayLog;
    var logValues = log.getDataRange().getValues();
    var done = {};
    var ok = [];
    var failed = [];

    // Baris log hari ini yang posternya ada tetapi emailnya belum terkirim ikut dikirim sekarang.
    for (var i = 1; i < logValues.length; i++) {
      var r = logValues[i];
      var nim = String(r[L.NIM - 1]).trim();
      if (!nim) continue;
      var d = normalizeDate_(r[L.DATE - 1]);
      done[d + '|' + nim] = true;
      var fileId = String(r[L.POSTER_FILE_ID - 1] || '').trim();
      if (d === todayKey && fileId && !r[L.EMAILED_AT - 1]) {
        var person = byNim[nim] || { name: nim, division: '-' };
        try {
          ok.push({ name: person.name, division: person.division, url: DriveApp.getFileById(fileId).getUrl(), row: i + 1 });
        } catch (err) {
          console.error('[dailyBirthday] ' + nim + ': ' + err.stack);
          failed.push({ name: person.name, division: person.division, reason: 'Poster di log tidak bisa dibuka: ' + String(err.message || err) });
        }
      }
    }

    // Aktif = tetap dapat poster walau evaluated = FALSE (D-032)
    var targets = master.filter(function (m) {
      return isActiveMember(m.record) && m.birth && isBirthdayToday_(m.birth, today) && !done[todayKey + '|' + m.id];
    });

    if (targets.length === 0 && ok.length === 0 && failed.length === 0) return; // tidak ada email

    var newRows = [];
    if (targets.length) {
      var folder = getOrCreateMonthFolder_(rootId, Utilities.formatDate(today, TIME_ZONE, 'yyyy-MM'));
      targets.forEach(function (m) {
        try {
          // ID foto kosong atau tidak terbaca dianggap gagal (bukan poster tanpa foto).
          if (!m.photoId) {
            throw new Error('photo_file_id kosong atau bukan ID/link Drive yang valid: "' + m.photoRaw + '"');
          }
          var file = renderPoster(
            templateId,
            { '{{name}}': m.name, '{{division}}': m.division },
            m.photoId,
            folder.getId(),
            'Ulang Tahun - ' + m.name + ' - ' + todayKey
          );
          newRows.push([todayKey, m.id, file.getId(), '']);
          ok.push({ name: m.name, division: m.division, url: file.getUrl(), row: null, index: newRows.length - 1 });
        } catch (err) {
          console.error('[dailyBirthday] ' + m.id + ': ' + err.stack);
          failed.push({ name: m.name, division: m.division, reason: String(err.message || err) });
        }
      });
    }

    // Tulis semua baris log baru sekaligus. date dan nim sebagai teks agar dedup stabil.
    if (newRows.length) {
      var start = log.getLastRow() + 1;
      log.getRange(start, 1, newRows.length, 2).setNumberFormat('@');
      log.getRange(start, 1, newRows.length, newRows[0].length).setValues(newRows);
      ok.forEach(function (o) {
        if (o.row === null) o.row = start + o.index;
      });
    }

    sendBirthdayEmail_(todayKey, ok, failed, omEmails);

    // Tandai terkirim hanya setelah email berhasil, ditulis sekali untuk semua baris.
    if (ok.length) {
      var lastRow = log.getLastRow();
      var col = log.getRange(2, L.EMAILED_AT, lastRow - 1, 1);
      var vals = col.getValues();
      var now = new Date();
      ok.forEach(function (o) { vals[o.row - 2][0] = now; });
      col.setValues(vals);
    }
  });
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

/** Ubah satu record Master (hasil readTable) jadi bentuk yang dipakai modul ini. */
function parseMember_(rec) {
  var birth = rec.birth_date;
  if (birth && !(birth instanceof Date)) {
    var s = String(birth).trim();
    birth = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T12:00:00+07:00') : new Date(s);
  }
  var photoRaw = String(rec.photo_file_id || '').trim();
  var m = photoRaw.match(/[-\w]{25,}/); // terima ID polos maupun link Drive
  return {
    record: rec,
    id: String(rec.nim).trim(),
    name: String(rec.name).trim(),
    division: String(rec.division).trim(),
    birth: birth instanceof Date && !isNaN(birth) ? birth : null,
    photoRaw: photoRaw,
    photoId: m ? m[0] : ''
  };
}

function getOrCreateMonthFolder_(rootId, name) {
  var root = DriveApp.getFolderById(rootId);
  var it = root.getFoldersByName(name);
  return it.hasNext() ? it.next() : root.createFolder(name);
}

/* ===================== TES MANUAL ===================== */

/** Jalankan dari editor: tes Feb 29 tanpa menyentuh Drive/email. Lihat hasil di Logs. */
function test_feb29() {
  var birth = new Date('2000-02-29T12:00:00+07:00');
  Logger.log('28 Feb 2027 (non-kabisat): ' + isBirthdayToday_(birth, new Date('2027-02-28T12:00:00+07:00'))); // true
  Logger.log('1 Mar 2027:                ' + isBirthdayToday_(birth, new Date('2027-03-01T12:00:00+07:00')));  // false
  Logger.log('28 Feb 2028 (kabisat):     ' + isBirthdayToday_(birth, new Date('2028-02-28T12:00:00+07:00'))); // false
  Logger.log('29 Feb 2028 (kabisat):     ' + isBirthdayToday_(birth, new Date('2028-02-29T12:00:00+07:00'))); // true
}