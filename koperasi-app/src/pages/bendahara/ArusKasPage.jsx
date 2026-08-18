// src/pages/ArusKasPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  Download,
  FileSpreadsheet,
  FileText,
  Sliders,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Calendar,
  Building2,
  PiggyBank,
  ArrowRightLeft,
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
      <p className={`text-lg font-bold mt-1 ${isNegative ? "text-red-600" : ""}`}>
        Rp {displayValue}
      </p>
    </div>
  );
}

// ─── Komponen Item Arus Kas ──────────────────────────────────
function ArusKasItem({ label, items, total, type = "operasi" }) {
  if (!items || items.length === 0) return null;

  const isPositive = (val) => val >= 0;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 font-semibold text-gray-700 text-sm border-b">
        {label}
      </div>
      <div className="divide-y divide-gray-100">
        {items.map((item, idx) => (
          <div key={idx} className="flex justify-between items-center px-4 py-2 hover:bg-gray-50">
            <span className="text-sm text-gray-600">{item.nama}</span>
            <span className={`text-sm font-mono font-medium ${item.nilai >= 0 ? "text-green-600" : "text-red-600"}`}>
              {item.nilai >= 0 ? "+" : ""} Rp {formatRupiah(item.nilai)}
            </span>
          </div>
        ))}
        <div className="flex justify-between items-center px-4 py-2 bg-gray-50 font-bold">
          <span className="text-sm">Total {label}</span>
          <span className={`text-sm font-mono ${total >= 0 ? "text-green-700" : "text-red-700"}`}>
            {total >= 0 ? "+" : ""} Rp {formatRupiah(total)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Halaman Utama ────────────────────────────────────────────
export default function ArusKasPage() {
  // ─── State ──────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [unit, setUnit] = useState("");
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
      if (unitUsaha) params.unit_usaha = unitUsaha;

      // ✅ Endpoint yang benar: /api/bendahara/arus-kas
      const response = await api.get("/bendahara/arus-kas", { params });
      
      // Response structure: { data: { shu, kasAwal, ... }, labelPeriode, dari, sampai, unit, daftarUnit }
      setData(response.data);
      if (response.data.daftarUnit) {
        setDaftarUnit(response.data.daftarUnit);
      }
    } catch (err) {
      console.error("Gagal fetch arus kas:", err);
      setError(err.response?.data?.message || "Gagal memuat data arus kas.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Initial Load ──────────────────────────────────────────
  useEffect(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultDari = startOfMonth.toISOString().slice(0, 10);
    const defaultSampai = now.toISOString().slice(0, 10);
    setDari(defaultDari);
    setSampai(defaultSampai);
    fetchData(defaultDari, defaultSampai, "");
  }, [fetchData]);

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
      if (unit) params.append("unit_usaha", unit);
      params.append("export", type);

      const response = await api.get(`/bendahara/arus-kas/export?${params.toString()}`, {
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
      link.download = `arus-kas-${new Date().toISOString().slice(0, 10)}.${type === "excel" ? "xlsx" : "pdf"}`;
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
            <p className="mt-4 text-gray-500">Memuat data arus kas...</p>
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

  // Extract data dari response
  const { data: arusKasData, labelPeriode } = data;
  const {
    shu,
    penyesuaian,
    totalPenyesuaian,
    totalOperasi,
    investasi,
    totalInvestasi,
    pendanaan,
    totalPendanaan,
    kasAwal,
    kasAkhir,
  } = arusKasData || {};

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Laporan Arus Kas</h2>
              <p className="text-sm text-gray-500">Periode: {labelPeriode || "-"}</p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label="Saldo Awal Kas" value={kasAwal || 0} icon={Wallet} color="blue" />
          <SummaryCard label="Arus Kas Operasi" value={totalOperasi || 0} icon={TrendingUp} color="green" />
          <SummaryCard label="Arus Kas Investasi" value={totalInvestasi || 0} icon={Building2} color="purple" />
          <SummaryCard label="Arus Kas Pendanaan" value={totalPendanaan || 0} icon={PiggyBank} color="amber" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SummaryCard label="SHU (Laba/Rugi)" value={shu || 0} icon={DollarSign} color="teal" />
          <SummaryCard label="Saldo Akhir Kas" value={kasAkhir || 0} icon={Wallet} color="indigo" />
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

        {/* ─── Detail Arus Kas ────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Operasi */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">A. Aktivitas Operasi</h3>
              <span className={`text-sm font-bold ${totalOperasi >= 0 ? "text-green-600" : "text-red-600"}`}>
                {totalOperasi >= 0 ? "+" : ""} Rp {formatRupiah(totalOperasi)}
              </span>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center px-3 py-2 bg-gray-50 rounded-lg">
                <span className="text-sm">SHU (Laba/Rugi)</span>
                <span className={`text-sm font-mono font-medium ${shu >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {shu >= 0 ? "+" : ""} Rp {formatRupiah(shu)}
                </span>
              </div>

              {penyesuaian && penyesuaian.length > 0 && (
                <div className="ml-4 space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-2">Penyesuaian:</p>
                  {penyesuaian.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center px-3 py-1.5 hover:bg-gray-50 rounded">
                      <span className="text-sm text-gray-600">{item.nama}</span>
                      <span className={`text-sm font-mono ${item.nilai >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {item.nilai >= 0 ? "+" : ""} Rp {formatRupiah(item.nilai)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center px-3 py-1.5 bg-gray-50 rounded font-semibold">
                    <span className="text-sm">Total Penyesuaian</span>
                    <span className={`text-sm ${totalPenyesuaian >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {totalPenyesuaian >= 0 ? "+" : ""} Rp {formatRupiah(totalPenyesuaian)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Investasi */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">B. Aktivitas Investasi</h3>
              <span className={`text-sm font-bold ${totalInvestasi >= 0 ? "text-green-600" : "text-red-600"}`}>
                {totalInvestasi >= 0 ? "+" : ""} Rp {formatRupiah(totalInvestasi)}
              </span>
            </div>
            <div className="space-y-1">
              {investasi && investasi.length > 0 ? (
                investasi.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center px-3 py-1.5 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">{item.nama}</span>
                    <span className={`text-sm font-mono ${item.nilai >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {item.nilai >= 0 ? "+" : ""} Rp {formatRupiah(item.nilai)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">Tidak ada aktivitas investasi</p>
              )}
            </div>
          </div>

          {/* Pendanaan */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">C. Aktivitas Pendanaan</h3>
              <span className={`text-sm font-bold ${totalPendanaan >= 0 ? "text-green-600" : "text-red-600"}`}>
                {totalPendanaan >= 0 ? "+" : ""} Rp {formatRupiah(totalPendanaan)}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {pendanaan && pendanaan.length > 0 ? (
                pendanaan.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center px-3 py-1.5 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">{item.nama}</span>
                    <span className={`text-sm font-mono ${item.nilai >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {item.nilai >= 0 ? "+" : ""} Rp {formatRupiah(item.nilai)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400 text-center py-4 col-span-2">Tidak ada aktivitas pendanaan</p>
              )}
            </div>
          </div>
        </div>

        {/* ─── Saldo Kas ────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">Saldo Awal Kas</p>
              <p className="text-2xl font-bold text-blue-700">Rp {formatRupiah(kasAwal)}</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg flex items-center justify-center">
              <ArrowRightLeft size={32} className="text-gray-400" />
              <div className="mx-4 text-sm text-gray-500">
                <div>Operasi: {totalOperasi >= 0 ? "+" : ""} {formatRupiah(totalOperasi)}</div>
                <div>Investasi: {totalInvestasi >= 0 ? "+" : ""} {formatRupiah(totalInvestasi)}</div>
                <div>Pendanaan: {totalPendanaan >= 0 ? "+" : ""} {formatRupiah(totalPendanaan)}</div>
              </div>
              <ArrowRightLeft size={32} className="text-gray-400" />
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">Saldo Akhir Kas</p>
              <p className="text-2xl font-bold text-green-700">Rp {formatRupiah(kasAkhir)}</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}