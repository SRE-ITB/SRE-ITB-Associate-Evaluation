/**
 * Posters.gs
 *
 * Render poster dari template Google Slides menjadi PNG di Google Drive.
 * Digunakan oleh:
 * - B-02: Daily Birthday Poster
 * - B-03: Best Staff Poster
 *
 * PNG Export:
 * Menggunakan Slides Advanced Service:
 * Presentations.Pages.getThumbnail()
 *
 * Alasan:
 * Tidak perlu mengurus OAuth token secara manual.
 * Cukup aktifkan Advanced Google Service "Slides".
 * Ukuran LARGE menghasilkan thumbnail dengan lebar sekitar 1600 px.
 *
 * Penanda foto di template:
 * Elemen foto dikenali dari alt text bernilai {{photo}}. UI Slides terbaru
 * hanya menyediakan satu kolom alt text (tersimpan sebagai description),
 * sedangkan UI lama punya kolom Title dan Description. Keduanya diterima.
 */

var PHOTO_ALT_TITLE = '{{photo}}';


/**
 * Generate poster PNG dari template Google Slides.
 *
 * @param {string} templateId
 *        ID Google Slides template.
 *
 * @param {Object} replacements
 *        Object berisi placeholder dan penggantinya.
 *        Contoh:
 *        {
 *          '{{name}}': 'Budi',
 *          '{{division}}': 'IT Development'
 *        }
 *
 * @param {string} photoFileId
 *        ID foto di Google Drive.
 *        Kosong/null = tidak mengganti foto.
 *
 * @param {string} outFolderId
 *        ID folder tujuan penyimpanan PNG.
 *
 * @param {string} fileName
 *        Nama file output tanpa ekstensi.
 *
 * @return {GoogleAppsScript.Drive.File}
 *         File PNG yang berhasil dibuat.
 */
function renderPoster(
  templateId,
  replacements,
  photoFileId,
  outFolderId,
  fileName
) {

  // =========================
  // 1. VALIDASI ARGUMEN
  // =========================

  if (!templateId) {
    throw new Error('templateId wajib diisi.');
  }

  if (!outFolderId) {
    throw new Error('outFolderId wajib diisi.');
  }

  if (!fileName) {
    throw new Error('fileName wajib diisi.');
  }

  if (
    !replacements ||
    typeof replacements !== 'object' ||
    Array.isArray(replacements)
  ) {
    throw new Error('replacements harus berupa Object.');
  }

  // Bersihkan karakter yang tidak valid untuk nama file.
  var safeName = String(fileName)
    .replace(/[\\\/:*?"<>|]/g, '-');

  // =========================
  // 2. COPY TEMPLATE
  // =========================

  var template = DriveApp.getFileById(templateId);

  var copy = template.makeCopy('tmp-' + safeName);

  try {

    var presId = copy.getId();

    var pres = SlidesApp.openById(presId);

    var slides = pres.getSlides();

    if (slides.length === 0) {
      throw new Error('Template tidak memiliki slide.');
    }

    // Hanya menggunakan slide pertama.
    var slide = slides[0];

    var pageId = slide.getObjectId();


    // =========================
    // 3. REPLACE TEXT
    // =========================

    Object.keys(replacements).forEach(function (key) {

      slide.replaceAllText(
        key,
        String(replacements[key] == null ? '' : replacements[key])
      );

    });


    // =========================
    // 4. REPLACE PHOTO
    // =========================

    if (photoFileId) {

      // Ambil foto dari Google Drive.
      // Jika ID tidak valid atau file tidak dapat dibaca,
      // error akan ditangani oleh pemanggil renderPoster().
      var photoFile = DriveApp.getFileById(photoFileId);

      var photoBlob = photoFile.getBlob();

      replacePhoto_(slide, photoBlob);

    }


    // Simpan perubahan sebelum export.
    pres.saveAndClose();


    // =========================
    // 5. EXPORT SLIDE TO PNG
    // =========================

    var thumbnail = Slides.Presentations.Pages.getThumbnail(
      presId,
      pageId,
      {
        'thumbnailProperties.mimeType': 'PNG',
        'thumbnailProperties.thumbnailSize': 'LARGE'
      }
    );

    if (!thumbnail || !thumbnail.contentUrl) {
      throw new Error('Gagal mendapatkan URL thumbnail Slides.');
    }

    var response = UrlFetchApp.fetch(thumbnail.contentUrl);

    if (response.getResponseCode() !== 200) {
      throw new Error(
        'Gagal mengunduh PNG. HTTP status: ' +
        response.getResponseCode()
      );
    }

    var pngBlob = response
      .getBlob()
      .setName(safeName + '.png')
      .setContentType('image/png');


    // =========================
    // 6. SAVE PNG TO DRIVE
    // =========================

    var outputFolder = DriveApp.getFolderById(outFolderId);

    var outputFile = outputFolder.createFile(pngBlob);

    return outputFile;

  } finally {

    // =========================
    // 7. CLEANUP TEMPORARY FILE
    // =========================

    // Tetap dijalankan meskipun proses export gagal.
    copy.setTrashed(true);

  }

}


/**
 * Mencari elemen dengan alt text {{photo}} (title atau description,
 * termasuk di dalam GROUP), kemudian menggantinya dengan foto yang diberikan.
 *
 * Mendukung:
 * - IMAGE: mengganti gambar yang sudah ada.
 * - SHAPE: menyisipkan gambar pada posisi dan ukuran shape,
 *          kemudian menghapus shape placeholder.
 *
 * @param {GoogleAppsScript.Slides.Slide} slide
 * @param {GoogleAppsScript.Base.Blob} blob
 */
function replacePhoto_(slide, blob) {

  var element = findElementByTitle_(slide.getPageElements(), PHOTO_ALT_TITLE);

  if (!element) {
    throw new Error(
      'Template tidak memiliki elemen dengan alt text (title atau description): ' +
      PHOTO_ALT_TITLE
    );
  }


  var type = element.getPageElementType();


  // =========================
  // IMAGE PLACEHOLDER
  // =========================

  if (type === SlidesApp.PageElementType.IMAGE) {

    element.asImage().replace(blob, true);

    return;

  }


  // =========================
  // SHAPE PLACEHOLDER
  // =========================

  if (type === SlidesApp.PageElementType.SHAPE) {

    // Simpan posisi dan dimensi placeholder.
    var left = element.getLeft();
    var top = element.getTop();
    var width = element.getWidth();
    var height = element.getHeight();

    // Sisipkan foto sesuai ukuran placeholder.
    // insertImage(blob, l, t, w, h) mempertahankan rasio aspek (foto diskalakan
    // agar muat lalu di-center), sehingga ada celah. Jadi: sisipkan dengan
    // ukuran asli, paksa ke kotak placeholder (sementara melar), lalu
    // replace(blob, true) men-crop foto agar menutupi kotak tanpa distorsi.
    var placed = slide.insertImage(blob);
    placed.setLeft(left);
    placed.setTop(top);
    placed.setWidth(width);
    placed.setHeight(height);
    var cropped = placed.replace(blob, true);

    // Kirim foto ke paling belakang: foto berada di bawah background/frame
    // template dan terlihat lewat jendela transparannya, sehingga sudut
    // melengkung mengikuti frame.
    cropped.sendToBack();

    // Hapus shape placeholder.
    element.remove();

    return;

  }


  // =========================
  // UNSUPPORTED ELEMENT
  // =========================

  throw new Error(
    'Elemen ' + PHOTO_ALT_TITLE +
    ' harus berupa IMAGE atau SHAPE (bukan ' + type + ').'
  );

}


/**
 * Mencari PageElement secara rekursif berdasarkan alt text,
 * sehingga tetap ditemukan meskipun berada di dalam GROUP.
 * Cocok jika title ATAU description sama dengan `title` (spasi di tepi diabaikan).
 *
 * @param {GoogleAppsScript.Slides.PageElement[]} elements
 * @param {string} title
 * @return {GoogleAppsScript.Slides.PageElement|null}
 */
function findElementByTitle_(elements, title) {
  for (var i = 0; i < elements.length; i++) {
    var el = elements[i];
    if (
      String(el.getTitle() || '').trim() === title ||
      String(el.getDescription() || '').trim() === title
    ) {
      return el;
    }
    if (el.getPageElementType() === SlidesApp.PageElementType.GROUP) {
      var found = findElementByTitle_(el.asGroup().getChildren(), title);
      if (found) return found;
    }
  }
  return null;
}