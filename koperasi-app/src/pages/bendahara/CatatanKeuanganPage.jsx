// src/pages/bendahara/CatatanKeuanganPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import {
  FileText,
  Download,
  FileSpreadsheet,
  FilePieChart,
  Sliders,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Calendar,
  ArrowRightLeft,
  BookOpen,
} from "lucide-react";

function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default function CatatanKeuanganPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [unit, setUnit] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [daftarUnit, setDaftarUnit] = useState([]);

  const fetchData = useCallback(async (dariDate = "", sampaiDate = "", unitUsaha = "") => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (dariDate) params.dari = dariDate;
      if (sampaiDate) params.sampai = sampaiDate;
      if (unitUsaha) params.unit = unitUsaha;
      const response = await api.get("/bendahara/catatan-keuangan", { params });
      setData(response.data);
      if (response.data.daftarUnit) {
        setDaftarUnit(response.data.daftarUnit);
      }
    } catch (err) {
      console.error("Gagal fetch catatan keuangan:", err);
      setError(err.response?.data?.message || "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const defaultDari = startOfYear.toISOString().slice(0, 10);
    const defaultSampai = now.toISOString().slice(0, 10);
    setDari(defaultDari);
    setSampai(defaultSampai);
    fetchData(defaultDari, defaultSampai, "");
  }, [fetchData]);

  const handleFilter = (e) => {
    e.preventDefault();
    fetchData(dari, sampai, unit);
  };

  const resetFilter = () => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const defaultDari = startOfYear.toISOString().slice(0, 10);
    const defaultSampai = now.toISOString().slice(0, 10);
    setDari(defaultDari);
    setSampai(defaultSampai);
    setUnit("");
    fetchData(defaultDari, defaultSampai, "");
  };

  const handleExport = async (type) => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (dari) params.append("dari", dari);
      if (sampai) params.append("sampai", sampai);
      if (unit) params.append("unit", unit);
      params.append("export", type);

      const response = await api.get(`/bendahara/catatan-keuangan/export?${params.toString()}`, {
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
      link.download = `catatan-keuangan-${new Date().toISOString().slice(0, 10)}.${type === "excel" ? "xlsx" : "pdf"}`;
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Memuat catatan keuangan...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-3" />
          <p className="text-red-700 font-medium">{error}</p>
          <button
            onClick={() => fetchData(dari, sampai, unit)}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Coba Lagi
          </button>
        </div>
      </DashboardLayout>
    );
  }

  if (!data) return null;

  const { data: catatan, labelPeriode, tahunBuku } = data;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Catatan Atas Laporan Keuangan</h2>
              <p className="text-sm text-gray-500">Periode: {labelPeriode || "-"}</p>
            </div>
          </div>
        </div>

        {/* Filter & Export */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
          >
            <span className="flex items-center gap-2 font-medium text-gray-700">
              <Sliders size={18} className="text-gray-500" />
              Filter & Export Data
            </span>
            {filterOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {filterOpen && (
            <div className="border-t p-4 bg-gray-50">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-white rounded-lg p-4 border space-y-3">
                  <p className="text-xs font-semibold uppercase text-gray-500 flex items-center gap-2">
                    <Calendar size={14} /> Filter Periode
                  </p>
                  <form onSubmit={handleFilter} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Dari Tanggal</label>
                        <input
                          type="date"
                          value={dari}
                          onChange={(e) => setDari(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Sampai Tanggal</label>
                        <input
                          type="date"
                          value={sampai}
                          onChange={(e) => setSampai(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Unit Usaha</label>
                        <select
                          value={unit}
                          onChange={(e) => setUnit(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:border-blue-500"
                        >
                          <option value="">Semua Unit</option>
                          {daftarUnit.map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                        <Sliders size={15} /> Terapkan Filter
                      </button>
                      <button type="button" onClick={resetFilter} className="flex items-center gap-1.5 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
                        <ArrowRightLeft size={15} /> Reset
                      </button>
                    </div>
                  </form>
                </div>
                <div className="bg-white rounded-lg p-4 border space-y-2">
                  <p className="text-xs font-semibold uppercase text-gray-500 flex items-center gap-2">
                    <Download size={14} /> Export Data
                  </p>
                  <button
                    onClick={() => handleExport("excel")}
                    disabled={exporting}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-60"
                  >
                    <FileSpreadsheet size={15} /> {exporting ? "Mengekspor..." : "Excel"}
                  </button>
                  <button
                    onClick={() => handleExport("pdf")}
                    disabled={exporting}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-60"
                  >
                    <FileText size={15} /> {exporting ? "Mengekspor..." : "PDF"}
                  </button>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <AlertCircle size={12} /> Export menggunakan filter aktif
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── Tampilkan Catatan ────────────────────────────── */}
        <div className="space-y-6">
          {catatan && catatan.length > 0 ? (
            catatan.map((item) => (
              <div key={item.nomor} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <FilePieChart size={20} className="text-blue-600" />
                    {item.nomor}. {item.judul}
                  </h3>
                </div>
                <div className="overflow-x-auto p-4">
                  {item.blok.map((blok, idx) => (
                    <div key={idx} className="mb-6 last:mb-0">
                      <h4 className="font-medium text-gray-700 mb-2">{blok.nama}</h4>
                      <table className="w-full text-sm border-collapse">
                        <thead className="bg-gray-50 text-gray-600">
                          <tr>
                            <th className="py-2 px-4 text-left text-xs font-semibold uppercase tracking-wider border-b border-gray-200">Uraian</th>
                            <th className="py-2 px-4 text-right text-xs font-semibold uppercase tracking-wider border-b border-gray-200">Nilai</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="py-2 px-4">{blok.labelSaldoAwal || "Saldo Awal"}</td>
                            <td className="py-2 px-4 text-right font-mono">{formatRupiah(blok.saldoAwal)}</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-4">{blok.labelPenambahan || "Penambahan"}</td>
                            <td className="py-2 px-4 text-right font-mono text-green-600">+ {formatRupiah(blok.penambahan)}</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-4">{blok.labelPengurangan || "Pengurangan"}</td>
                            <td className="py-2 px-4 text-right font-mono text-red-600">- {formatRupiah(blok.pengurangan)}</td>
                          </tr>
                          <tr className="font-bold border-t border-gray-300">
                            <td className="py-2 px-4">{blok.labelSaldoAkhir || "Saldo Akhir"}</td>
                            <td className="py-2 px-4 text-right font-mono">{formatRupiah(blok.saldoAkhir)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <BookOpen size={48} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Tidak ada catatan keuangan untuk periode ini.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}