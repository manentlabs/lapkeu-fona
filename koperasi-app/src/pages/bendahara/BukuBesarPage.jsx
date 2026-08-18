// src/pages/bendahara/BukuBesarPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import {
  BookOpen,
  Search,
  Download,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight,
  Loader,
  AlertCircle,
  Calendar,
} from "lucide-react";

function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatTanggal(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export default function BukuBesarPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [akunDropdown, setAkunDropdown] = useState([]);
  const [selectedAkun, setSelectedAkun] = useState("");
  const [tanggalMulai, setTanggalMulai] = useState("");
  const [tanggalSelesai, setTanggalSelesai] = useState("");
  const [data, setData] = useState([]);
  const [akun, setAkun] = useState(null);
  const [saldoAwal, setSaldoAwal] = useState(0);
  const [totalDebet, setTotalDebet] = useState(0);
  const [totalKredit, setTotalKredit] = useState(0);
  const [saldoAkhir, setSaldoAkhir] = useState(0);
  const [exporting, setExporting] = useState(false);

  // Set default date range (start of month - now)
  useEffect(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    setTanggalMulai(startOfMonth.toISOString().slice(0, 10));
    setTanggalSelesai(now.toISOString().slice(0, 10));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedAkun) params.akun_id = selectedAkun;
      if (tanggalMulai) params.tanggal_mulai = tanggalMulai;
      if (tanggalSelesai) params.tanggal_selesai = tanggalSelesai;

      const response = await api.get("/bendahara/buku-besar", { params });
      const res = response.data;

      setAkunDropdown(res.akunDropdown || []);
      setData(res.data || []);
      setAkun(res.akun || null);
      setSaldoAwal(res.saldoAwal || 0);
      setTotalDebet(res.totalDebet || 0);
      setTotalKredit(res.totalKredit || 0);
      setSaldoAkhir(res.saldoAkhir || 0);
    } catch (err) {
      console.error("Gagal fetch buku besar:", err);
      setError(err.response?.data?.message || "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }, [selectedAkun, tanggalMulai, tanggalSelesai]);

  // Fetch dropdown awal
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchData();
  };

  const handleExport = async (type) => {
    if (!selectedAkun) {
      alert("Pilih akun terlebih dahulu");
      return;
    }
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.append("akun_id", selectedAkun);
      if (tanggalMulai) params.append("tanggal_mulai", tanggalMulai);
      if (tanggalSelesai) params.append("tanggal_selesai", tanggalSelesai);
      params.append("export", type);

      const response = await api.get(`/bendahara/buku-besar/export?${params.toString()}`, {
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
      const ext = type === "excel" ? "xlsx" : "pdf";
      link.download = `buku-besar-${akun?.kode_akun || 'akun'}-${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Gagal mengekspor data.");
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Buku Besar Umum</h2>
              <p className="text-sm text-gray-500">Riwayat transaksi per akun</p>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Pilih Akun</label>
              <select
                value={selectedAkun}
                onChange={(e) => setSelectedAkun(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Pilih Akun --</option>
                {akunDropdown.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.kode_akun} - {a.nama_akun}
                  </option>
                ))}
              </select>
            </div>
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
                disabled={exporting || !selectedAkun}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
              >
                <FileSpreadsheet size={16} />
              </button>
              <button
                type="button"
                onClick={() => handleExport("pdf")}
                disabled={exporting || !selectedAkun}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
              >
                <FileText size={16} />
              </button>
            </div>
          </form>
        </div>

        {/* Summary Cards */}
        {akun && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl shadow-sm p-3 border border-gray-100 text-center">
              <p className="text-xs text-gray-500">Saldo Awal</p>
              <p className="text-sm font-bold text-gray-700">{formatRupiah(saldoAwal)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-3 border border-gray-100 text-center">
              <p className="text-xs text-gray-500">Total Debet</p>
              <p className="text-sm font-bold text-green-600">{formatRupiah(totalDebet)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-3 border border-gray-100 text-center">
              <p className="text-xs text-gray-500">Total Kredit</p>
              <p className="text-sm font-bold text-red-600">{formatRupiah(totalKredit)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-3 border border-gray-100 text-center">
              <p className="text-xs text-gray-500">Saldo Akhir</p>
              <p className={`text-sm font-bold ${saldoAkhir >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formatRupiah(saldoAkhir)}
              </p>
            </div>
          </div>
        )}

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
        {!loading && !error && akun && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">
                {akun.kode_akun} - {akun.nama_akun}
              </h3>
              <span className="text-sm text-gray-500">
                {formatTanggal(tanggalMulai)} - {formatTanggal(tanggalSelesai)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="py-2 px-4 text-left text-xs font-semibold uppercase tracking-wider">Tanggal</th>
                    <th className="py-2 px-4 text-left text-xs font-semibold uppercase tracking-wider">No. Bukti</th>
                    <th className="py-2 px-4 text-left text-xs font-semibold uppercase tracking-wider">Keterangan</th>
                    <th className="py-2 px-4 text-right text-xs font-semibold uppercase tracking-wider">Debet</th>
                    <th className="py-2 px-4 text-right text-xs font-semibold uppercase tracking-wider">Kredit</th>
                    <th className="py-2 px-4 text-right text-xs font-semibold uppercase tracking-wider">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Saldo Awal */}
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <td colSpan="3" className="py-2 px-4 text-sm font-semibold">Saldo Awal</td>
                    <td colSpan="3" className="py-2 px-4 text-right text-sm font-semibold">
                      {formatRupiah(saldoAwal)}
                    </td>
                  </tr>

                  {data.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-gray-400">
                        Tidak ada transaksi untuk periode ini.
                      </td>
                    </tr>
                  ) : (
                    data.map((row, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-4 text-sm">{row.tanggal}</td>
                        <td className="py-2 px-4 text-sm font-mono">{row.no_bukti}</td>
                        <td className="py-2 px-4 text-sm">{row.keterangan}</td>
                        <td className="py-2 px-4 text-right text-sm font-mono text-green-600">
                          {row.debet > 0 ? formatRupiah(row.debet) : '-'}
                        </td>
                        <td className="py-2 px-4 text-right text-sm font-mono text-red-600">
                          {row.kredit > 0 ? formatRupiah(row.kredit) : '-'}
                        </td>
                        <td className="py-2 px-4 text-right text-sm font-mono font-bold">
                          {formatRupiah(row.saldo)}
                        </td>
                      </tr>
                    ))
                  )}

                  {/* Total */}
                  <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                    <td colSpan="3" className="py-2 px-4 text-sm">TOTAL</td>
                    <td className="py-2 px-4 text-right text-sm font-mono text-green-600">
                      {formatRupiah(totalDebet)}
                    </td>
                    <td className="py-2 px-4 text-right text-sm font-mono text-red-600">
                      {formatRupiah(totalKredit)}
                    </td>
                    <td className="py-2 px-4 text-right text-sm font-mono font-bold">
                      {formatRupiah(saldoAkhir)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── Empty State ─── */}
        {!loading && !error && !akun && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600">Pilih Akun untuk Melihat Buku Besar</h3>
            <p className="text-sm text-gray-400 mt-1">Pilih akun dari dropdown di atas dan klik Tampilkan</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}