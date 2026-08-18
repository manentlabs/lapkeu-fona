// src/pages/LaporanPhuPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import { useLocation } from "react-router-dom";
import {
  PieChart,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Sliders,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Calendar,
} from "lucide-react";

// ─── Helper format Rupiah ────────────────────────────────────
function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// ─── Summary Card ─────────────────────────────────────────────
function SummaryCard({ label, value, icon: Icon, color = "blue" }) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    green: "bg-green-50 text-green-600 border-green-200",
    red: "bg-red-50 text-red-600 border-red-200",
    amber: "bg-amber-50 text-amber-600 border-amber-200",
    purple: "bg-purple-50 text-purple-600 border-purple-200",
    teal: "bg-teal-50 text-teal-600 border-teal-200",
  };

  const isNegative = parseFloat(value) < 0;
  const displayValue = isNegative ? `(${formatRupiah(Math.abs(value))})` : formatRupiah(value);

  return (
    <div className={`p-3 rounded-xl border ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-center gap-2">
        <Icon size={16} className="opacity-70" />
        <p className="text-xs font-medium opacity-70">{label}</p>
      </div>
      <p className={`text-lg font-bold mt-1 ${isNegative ? "text-red-600" : "text-green-600"}`}>
        Rp {displayValue}
      </p>
    </div>
  );
}

// ─── Halaman Utama ────────────────────────────────────────────
export default function LaporanPhuPage() {
  const location = useLocation();
  const pathSegments = location.pathname.split("/");
  const unitFromPath = pathSegments[pathSegments.length - 1];
  const isUnitPage = unitFromPath !== "phu" && !unitFromPath.includes("dashboard");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [unit, setUnit] = useState(isUnitPage ? unitFromPath : "");
  const [filterOpen, setFilterOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [daftarUnit, setDaftarUnit] = useState([]);

  // ─── Fetch Data ─────────────────────────────────────────────
  const fetchData = useCallback(async (dariDate = "", sampaiDate = "", unitUsaha = "") => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (dariDate) params.dari = dariDate;
      if (sampaiDate) params.sampai = sampaiDate;
      if (unitUsaha) params.unit = unitUsaha;

      const response = await api.get("/bendahara/phu", { params });
      setData(response.data);
      if (response.data.daftarUnit) {
        setDaftarUnit(response.data.daftarUnit);
      }
    } catch (err) {
      console.error("Gagal fetch PHU:", err);
      setError(err.response?.data?.message || "Gagal memuat data PHU.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Fetch Daftar Unit ──────────────────────────────────────
  useEffect(() => {
    const fetchUnits = async () => {
      try {
        const response = await api.get("/bendahara/units");
        setDaftarUnit(response.data.units || []);
      } catch (err) {
        console.error("Gagal ambil unit:", err);
      }
    };
    fetchUnits();
  }, []);

  // ─── Initial Load ──────────────────────────────────────────
  useEffect(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultDari = startOfMonth.toISOString().slice(0, 10);
    const defaultSampai = now.toISOString().slice(0, 10);
    setDari(defaultDari);
    setSampai(defaultSampai);
    fetchData(defaultDari, defaultSampai, unit);
  }, [fetchData, unit]);

  // ─── Filter Handlers ──────────────────────────────────────
  const handleFilter = (e) => {
    e.preventDefault();
    fetchData(dari, sampai, unit);
  };

  const resetFilter = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultDari = startOfMonth.toISOString().slice(0, 10);
    const defaultSampai = now.toISOString().slice(0, 10);
    setDari(defaultDari);
    setSampai(defaultSampai);
    setUnit("");
    fetchData(defaultDari, defaultSampai, "");
  };

  // ─── Export ──────────────────────────────────────────────────
  const handleExport = async (type) => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (dari) params.append("dari", dari);
      if (sampai) params.append("sampai", sampai);
      if (unit) params.append("unit", unit);
      params.append("export", type);

      const response = await api.get(`/bendahara/phu/export?${params.toString()}`, {
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
      link.download = `phu-${new Date().toISOString().slice(0, 10)}.${type === "excel" ? "xlsx" : "pdf"}`;
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

  // ─── Render ──────────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Memuat data PHU...</p>
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

  const { data: phuData, labelPeriode } = data;
  const { totalPendapatan, detailPendapatan, totalBeban, detailBeban, shu } = phuData || {};

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                Perhitungan Hasil Usaha {unit ? `- ${unit}` : ""}
              </h2>
              <p className="text-sm text-gray-500">Periode: {labelPeriode || "-"}</p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SummaryCard label="Total Pendapatan" value={totalPendapatan || 0} icon={TrendingUp} color="green" />
          <SummaryCard label="Total Beban" value={totalBeban || 0} icon={TrendingDown} color="red" />
          <SummaryCard 
            label="SHU (Laba/Rugi)" 
            value={shu || 0} 
            icon={DollarSign} 
            color={shu >= 0 ? "teal" : "amber"} 
          />
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
                    <Calendar size={14} /> Filter Periode & Unit
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
                        <ChevronUp size={15} /> Reset
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

        {/* ─── Detail PHU ────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pendapatan */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">A. Pendapatan</h3>
              <span className="text-sm font-bold text-green-600">
                Rp {formatRupiah(totalPendapatan)}
              </span>
            </div>
            <div className="space-y-1">
              {detailPendapatan && detailPendapatan.length > 0 ? (
                detailPendapatan.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center px-3 py-1.5 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">
                      <span className="font-mono text-gray-400 mr-2">{item.kode}</span>
                      {item.nama}
                    </span>
                    <span className="text-sm font-mono text-green-600">
                      Rp {formatRupiah(item.nilai)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">Tidak ada data pendapatan</p>
              )}
            </div>
          </div>

          {/* Beban */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">B. Beban</h3>
              <span className="text-sm font-bold text-red-600">
                Rp {formatRupiah(totalBeban)}
              </span>
            </div>
            <div className="space-y-1">
              {detailBeban && detailBeban.length > 0 ? (
                detailBeban.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center px-3 py-1.5 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">
                      <span className="font-mono text-gray-400 mr-2">{item.kode}</span>
                      {item.nama}
                    </span>
                    <span className="text-sm font-mono text-red-600">
                      Rp {formatRupiah(item.nilai)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">Tidak ada data beban</p>
              )}
            </div>
          </div>
        </div>

        {/* ─── SHU ────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="text-center">
            <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Hasil Usaha (SHU)</h4>
            <p className={`text-4xl font-bold mt-2 ${shu >= 0 ? "text-green-600" : "text-red-600"}`}>
              {shu >= 0 ? "+" : ""} Rp {formatRupiah(shu)}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {shu >= 0 ? "Laba" : "Rugi"}
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}