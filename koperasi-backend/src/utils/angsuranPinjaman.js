// utils/angsuranPinjaman.js

/**
 * Hitung cicilan pokok & jasa/bunga bulanan untuk kategori
 * "Utang Uang Menengah".
 *
 *   Pokok = plafon / jangka_waktu   (cicilan pokok flat per bulan)
 *   Jasa  = 2,75% x plafon          (bunga flat per bulan, dihitung dari
 *                                    plafon awal, bukan sisa pokok berjalan)
 *
 * Dipakai bersama oleh PinjamanController (saat pengajuan pinjaman) dan
 * PotonganGajiController (saat generate baris cicilan bulanan), supaya
 * rumus ini tidak pernah drift / berbeda antara dua tempat. Kalau nanti
 * persentase jasa berubah, cukup ubah di satu titik ini.
 */
function hitungAngsuranUangMenengah(plafon, jangkaWaktu) {
  const plafonNum = parseFloat(plafon) || 0;
  const jangkaWaktuNum = parseInt(jangkaWaktu) || 0;

  if (plafonNum <= 0 || jangkaWaktuNum <= 0) {
    return { pokok: 0, jasa: 0 };
  }

  const pokok = plafonNum / jangkaWaktuNum;
  const jasa = plafonNum * 0.0275;

  return { pokok, jasa };
}

module.exports = { hitungAngsuranUangMenengah };