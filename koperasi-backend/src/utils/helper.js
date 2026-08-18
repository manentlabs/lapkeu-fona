// src/utils/helper.js

/**
 * Generate nomor transaksi otomatis dengan format:
 * TRX-YYYYMMDD-XXXX (XXXX = random 4 digit)
 */
function generateNoTransaksi() {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `TRX-${ymd}-${random}`;
}

/**
 * Format rupiah (untuk tampilan)
 */
function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString("id-ID");
}

module.exports = {
  generateNoTransaksi,
  formatRupiah,
};