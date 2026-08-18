// src/pages/bendahara/BukuBesarPersediaanPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import {
  Search,
  Download,
  FileSpreadsheet,
  FileText,
  Loader,
  AlertCircle,
} from "lucide-react";

function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// Konversi Date ke string YYYY-MM-DD berdasarkan tanggal LOKAL,
// bukan UTC. toISOString() bawaan JS mengonversi ke UTC dulu,
// sehingga di zona waktu UTC+ (mis. WIB/UTC+7) tanggal bisa
// "mundur" satu hari saat jam lokal masih pagi/dini hari.
function toLocalISODate(d) {
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

export default function BukuBesarPersediaanPage() {
  // ─── State ──────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [totals, setTotals] = useState({
    totalSaldoAwal: 0,
    totalPembelian: 0,
    totalHpp: 0,
    totalPenjualan: 0,
    totalSaldoAkhir: 0,
    totalKeuntungan: 0,
    totalKerugian: 0,
  });
  const [tanggalMulai, setTanggalMulai] = useState("");
  const [tanggalSelesai, setTanggalSelesai] = useState("");
  const [exporting, setExporting] = useState(false);

  // ─── Fetch Data ─────────────────────────────────────────────
  const fetchData = useCallback(async (mulai = "", selesai = "") => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (mulai) params.tanggal_mulai = mulai;
      if (selesai) params.tanggal_selesai = selesai;
      const response = await api.get("/bendahara/buku-besar-persediaan", { params });
      const res = response.data;
      setItems(res.items || []);
      setTotals({
        totalSaldoAwal: res.totalSaldoAwal || 0,
        totalPembelian: res.totalPembelian || 0,
        totalHpp: res.totalHpp || 0,
        totalPenjualan: res.totalPenjualan || 0,
        totalSaldoAkhir: res.totalSaldoAkhir || 0,
        totalKeuntungan: res.totalKeuntungan || 0,
        totalKerugian: res.totalKerugian || 0,
      });
    } catch (err) {
      console.error("Gagal fetch:", err);
      setError(err.response?.data?.message || "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Set default date range (awal bulan berjalan s/d hari ini)
  useEffect(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const mulaiStr = toLocalISODate(startOfMonth);
    const selesaiStr = toLocalISODate(now);
    setTanggalMulai(mulaiStr);
    setTanggalSelesai(selesaiStr);
    fetchData(mulaiStr, selesaiStr);
  }, [fetchData]);

  // ─── Filter ──────────────────────────────────────────────────
  const handleSearch = (e) => {
    e.preventDefault();
    fetchData(tanggalMulai, tanggalSelesai);
  };

  // ─── Export ──────────────────────────────────────────────────
  const handleExport = async (type) => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (tanggalMulai) params.append("tanggal_mulai", tanggalMulai);
      if (tanggalSelesai) params.append("tanggal_selesai", tanggalSelesai);
      params.append("export", type);

      const response = await api.get(`/bendahara/buku-besar-persediaan/export?${params.toString()}`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(
        new Blob([response.data], {
          type: type === "excel"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "application/pdf",
        })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `buku-besar-persediaan-${toLocalISODate(new Date())}.${type === "excel" ? "xlsx" : "pdf"}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Gagal mengekspor data.");
    } finally {
      setExporting(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Buku Besar Persediaan</h2>
            <p className="text-sm text-gray-500">Riwayat mutasi persediaan barang</p>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tanggal Mulai</label>
              <input
                type="date"
                value={tanggalMulai}
                onChange={(e) => setTanggalMulai(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tanggal Selesai</label>
              <input
                type="date"
                value={tanggalSelesai}
                onChange={(e) => setTanggalSelesai(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                <Search size={16} /> Tampilkan
              </button>
              <button
                type="button"
                onClick={() => handleExport("excel")}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
              >
                <FileSpreadsheet size={16} />
              </button>
              <button
                type="button"
                onClick={() => handleExport("pdf")}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
              >
                <FileText size={16} />
              </button>
            </div>
          </form>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <SummaryCard label="Saldo Awal" value={totals.totalSaldoAwal} />
          <SummaryCard label="Total Pembelian" value={totals.totalPembelian} color="blue" />
          <SummaryCard label="Total HPP" value={totals.totalHpp} color="amber" />
          <SummaryCard label="Total Penjualan" value={totals.totalPenjualan} color="green" />
          <SummaryCard label="Stok Akhir" value={totals.totalSaldoAkhir} color="purple" />
          <SummaryCard label="Keuntungan" value={totals.totalKeuntungan} color="teal" />
          <SummaryCard label="Kerugian" value={totals.totalKerugian} color="red" />
        </div>

        {/* ─── Loading ─── */}
        {loading && (
          <div className="flex justify-center py-8">
            <Loader className="animate-spin text-blue-600" size={32} />
          </div>
        )}

        {/* ─── Error ─── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center text-red-700">
            <AlertCircle size={32} className="mx-auto mb-2" />
            <p>{error}</p>
          </div>
        )}

        {/* ─── Tabel ─── */}
        {!loading && !error && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="py-2 px-2 text-left font-semibold uppercase tracking-wider">Kode</th>
                    <th className="py-2 px-2 text-left font-semibold uppercase tracking-wider">Nama</th>
                    <th className="py-2 px-2 text-center font-semibold uppercase tracking-wider">Satuan</th>
                    <th className="py-2 px-2 text-right font-semibold uppercase tracking-wider">Stok Awal</th>
                    <th className="py-2 px-2 text-right font-semibold uppercase tracking-wider">Pembelian</th>
                    <th className="py-2 px-2 text-right font-semibold uppercase tracking-wider">Penjualan</th>
                    <th className="py-2 px-2 text-right font-semibold uppercase tracking-wider">Stok Akhir</th>
                    <th className="py-2 px-2 text-right font-semibold uppercase tracking-wider">Untung</th>
                    <th className="py-2 px-2 text-right font-semibold uppercase tracking-wider">Rugi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-10 text-center text-gray-400">
                        <p>Tidak ada data persediaan pada periode ini.</p>
                        <p className="text-xs mt-1">
                          Periode: {tanggalMulai} s/d {tanggalSelesai} — coba perluas rentang tanggal untuk melihat data bulan lain.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2 font-mono text-blue-600">{item.kode_barang}</td>
                        <td className="py-2 px-2">{item.nama_barang}</td>
                        <td className="py-2 px-2 text-center">{item.satuan}</td>
                        <td className="py-2 px-2 text-right">{item.stok_awal}</td>
                        <td className="py-2 px-2 text-right">
                          {item.pembelian_pcs || 0}
                          <div className="text-xs text-gray-400">
                            Rp {formatRupiah(item.total_pembelian || 0)}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right">
                          {item.penjualan_pcs || 0}
                          <div className="text-xs text-gray-400">
                            Rp {formatRupiah(item.total_penjualan || 0)}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right font-semibold">{item.saldo_akhir}</td>
                        <td className="py-2 px-2 text-right text-green-600">{formatRupiah(item.keuntungan || 0)}</td>
                        <td className="py-2 px-2 text-right text-red-600">{formatRupiah(item.kerugian || 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {items.length > 0 && (
                  <tfoot className="bg-gray-100 font-bold">
                    <tr>
                      <td colSpan="3" className="py-2 px-2 text-right">TOTAL</td>
                      <td className="py-2 px-2 text-right">{totals.totalSaldoAwal}</td>
                      <td className="py-2 px-2 text-right">{formatRupiah(totals.totalPembelian)}</td>
                      <td className="py-2 px-2 text-right">{formatRupiah(totals.totalPenjualan)}</td>
                      <td className="py-2 px-2 text-right">{totals.totalSaldoAkhir}</td>
                      <td className="py-2 px-2 text-right text-green-600">{formatRupiah(totals.totalKeuntungan)}</td>
                      <td className="py-2 px-2 text-right text-red-600">{formatRupiah(totals.totalKerugian)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function SummaryCard({ label, value, color = "gray" }) {
  const colors = {
    gray: "bg-gray-50 text-gray-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    purple: "bg-purple-50 text-purple-700",
    teal: "bg-teal-50 text-teal-700",
  };
  return (
    <div className={`rounded-xl p-2 text-center ${colors[color] || colors.gray}`}>
      <p className="text-xs font-medium">{label}</p>
      <p className="text-sm font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</p>
    </div>
  );
}