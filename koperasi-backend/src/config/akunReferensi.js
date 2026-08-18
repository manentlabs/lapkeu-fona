// config/akunReferensi.js
// Referensi kode akun untuk laporan Arus Kas.
// Kalau kode akun berubah di chart of accounts, cukup ubah nilainya di sini —
// tidak perlu menyentuh ArusKasController.js.

module.exports = {
  // ── Kode Akun Utama ──────────────────────────────────────────
  PENDAPATAN: '4000',   // parent, total diambil dari semua anak akun
  BEBAN: '5000',        // parent, total diambil dari semua anak akun
  ASET_LANCAR: '1100',  // parent, dipakai untuk cari akun-akun "kas"

  // ── Penyesuaian Arus Kas Operasi ─────────────────────────────
  // Kenaikan aset lancar operasional = penggunaan kas (negatif)
  ASET_LANCAR_OPERASIONAL: [
    '1103', // Piutang Usaha
    '1104', // Piutang Lain-lain
    '1105', // Piutang Karyawan
    '1106', // Uang Muka
    '1107', // Biaya Dibayar Dimuka
    '1109', // Perlengkapan
    '1110', // Persediaan
    '1111', // Aset Lancar Lainnya
  ],

  // Kenaikan kewajiban lancar = sumber kas (positif)
  KEWAJIBAN_LANCAR: [
    '2101', // Utang Usaha
    '2102', // Utang Pajak
    '2103', // Utang Dagang
    '2104', // Utang Lain-lain
    '2105', // Biaya Yang Masih Harus Dibayar
  ],

  // ── Aktivitas Investasi ───────────────────────────────────────
  INVESTASI: [
    '1201', // Tanah
    '1202', // Bangunan
    '1301', // Kendaraan
    '1302', // Peralatan Kantor
    '1303', // Peralatan Usaha
    '1304', // Aset Tetap Lainnya
  ],

  // ── Aktivitas Pendanaan ───────────────────────────────────────
  MODAL: [
    '3110', // Simpanan Pokok
    '3120', // Simpanan Wajib
    '3140', // Simpanan Sukarela
    '3150', // Modal Penyertaan
    '3170', // Cadangan
    '3180', // Modal Lainnya
  ],

  UTANG_JANGKA_PANJANG: [
    '2201', // Utang Bank
    '2202', // Utang Jangka Panjang Lainnya
    '2203', // Utang Pihak Ketiga
  ],

  KAS_WASERDA: '1112',
  PERSEDIAAN: '1110',
  UTANG_DAGANG: '2103',
  PENDAPATAN_WASERDA: '4120',
  HPP_TOKO: '5110',

  // ── Kode Akun untuk Laporan Perubahan Modal ──────────────────
  SP_POKOK: '3110',        // Simpanan Pokok
  SP_WAJIB: '3120',        // Simpanan Wajib
  SHU: '3140',             // Sisa Hasil Usaha / Pembagian SHU
  CADANGAN: '3150',        // Dana Cadangan
  PKL: '3160',             // Penghasilan Komprehensif Lain
  PENGURANGAN_MODAL: '3170', // Pengurangan Modal
  // '3180' (modal lainnya) sudah tercakup di MODAL[] & EKUITAS_LAIN di bawah

  EKUITAS_LAIN: ['3160', '3170', '3180'], // dipakai utk hitung saldo awal "ekuitas"
};