// src/pages/bendahara/RencanaAnggaranPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import {
  TrendingUp,
  Download,
  FileSpreadsheet,
  FileText,
  Sliders,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Calendar,
  Save,
  Target,
  CheckCircle,
} from "lucide-react";

function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// Ubah string berformat ("1.500.000", "Rp 1.500.000", dll) jadi angka murni
function parseRupiahInput(value) {
  const numericValue = String(value).replace(/[^\d]/g, "");
  return numericValue === "" ? 0 : parseInt(numericValue, 10);
}

export default function RencanaAnggaranPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [daftarTahun, setDaftarTahun] = useState([]);
  const [exporting, setExporting] = useState(false);

  // State untuk form rencana (edit inline)
  const [rencanaForm, setRencanaForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchData = useCallback(async (tahunValue) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/bendahara/rencana-anggaran?tahun=${tahunValue}`);
      setData(response.data);
      setDaftarTahun(response.data.daftarTahun || []);
      // Inisialisasi form dengan rencana existing
      const initialForm = {};
      const rencanaMap = response.data.rencanaMap || {};
      // Ambil semua akun dari pendapatan dan beban
      const allAkun = [
        ...(response.data.akunPendapatan || []),
        ...(response.data.akunBeban || []),
      ];
      for (const akun of allAkun) {
        const key = `${akun.id}_${tahunValue}`;
        initialForm[`${akun.id}_${tahunValue}`] = rencanaMap[key]?.jumlah || 0;
        const keyNext = `${akun.id}_${tahunValue + 1}`;
        initialForm[`${akun.id}_${tahunValue + 1}`] = rencanaMap[keyNext]?.jumlah || 0;
      }
      setRencanaForm(initialForm);
    } catch (err) {
      console.error("Gagal fetch rencana anggaran:", err);
      setError(err.response?.data?.message || "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(tahun);
  }, [tahun, fetchData]);

  const handleTahunChange = (e) => {
    setTahun(parseInt(e.target.value));
  };

  const handleInputChange = (key, value) => {
    setRencanaForm((prev) => ({
      ...prev,
      [key]: parseRupiahInput(value),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      // Group by tahun
      const rencanaByTahun = {};
      for (const [key, value] of Object.entries(rencanaForm)) {
        const [akunId, tahunStr] = key.split('_');
        const tahunKey = parseInt(tahunStr);
        if (!rencanaByTahun[tahunKey]) rencanaByTahun[tahunKey] = {};
        rencanaByTahun[tahunKey][akunId] = value;
      }

      // Simpan untuk tahun berjalan dan tahun berikutnya
      for (const [tahunSave, rencana] of Object.entries(rencanaByTahun)) {
        await api.post("/bendahara/rencana-anggaran", {
          tahun: parseInt(tahunSave),
          rencana,
        });
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      // Refresh data
      fetchData(tahun);
    } catch (err) {
      alert(err.response?.data?.message || "Gagal menyimpan rencana anggaran");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (type) => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.append("tahun", tahun);
      params.append("export", type);

      const response = await api.get(`/bendahara/rencana-anggaran/export?${params.toString()}`, {
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
      link.download = `rencana-anggaran-${tahun}.${type === "excel" ? "xlsx" : "pdf"}`;
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
            <p className="mt-4 text-gray-500">Memuat rencana anggaran...</p>
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
            onClick={() => fetchData(tahun)}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Coba Lagi
          </button>
        </div>
      </DashboardLayout>
    );
  }

  if (!data) return null;

  const { data: laporanData } = data;
  const { pendapatan, beban, shuRencanaBefore, shuRealisasi, shuRencanaNext, shuPersentase } = laporanData || {};

  // Helper untuk render tabel
  const renderTable = (title, group, isPendapatan = true) => {
    if (!group || !group.items || group.items.length === 0) {
      return <div className="text-center py-4 text-gray-500">Tidak ada data</div>;
    }

    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">{title}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wider border-b">Kode</th>
                <th className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wider border-b">Nama Akun</th>
                <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider border-b">
                  Rencana {tahun}
                </th>
                <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider border-b">
                  Realisasi {tahun}
                </th>
                <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider border-b">
                  Rencana {tahun + 1}
                </th>
                <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider border-b">
                  Persentase (%)
                </th>
              </tr>
            </thead>
            <tbody>
              {group.items.map((item) => {
                const keyBefore = `${item.akun_id}_${tahun}`;
                const keyNext = `${item.akun_id}_${tahun + 1}`;
                return (
                  <tr key={item.akun_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-sm font-mono">{item.kode_akun}</td>
                    <td className="py-2 px-3 text-sm">{item.nama}</td>
                    <td className="py-2 px-3 text-right text-sm">
                      <div className="relative inline-block">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                          Rp
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="w-36 text-right border rounded pl-7 pr-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                          value={formatRupiah(rencanaForm[keyBefore] || 0)}
                          onChange={(e) => handleInputChange(keyBefore, e.target.value)}
                        />
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right text-sm font-mono font-semibold">
                      {formatRupiah(item.realisasi)}
                    </td>
                    <td className="py-2 px-3 text-right text-sm">
                      <div className="relative inline-block">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                          Rp
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="w-36 text-right border rounded pl-7 pr-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                          value={formatRupiah(rencanaForm[keyNext] || 0)}
                          onChange={(e) => handleInputChange(keyNext, e.target.value)}
                        />
                      </div>
                    </td>
                    <td className={`py-2 px-3 text-right text-sm font-mono font-medium ${
                      item.persentase > 10 ? 'text-green-600' : item.persentase < -10 ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      {item.persentase.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-gray-100 font-bold">
                <td colSpan="2" className="py-2 px-3 text-sm">TOTAL</td>
                <td className="py-2 px-3 text-right text-sm">Rp {formatRupiah(group.totalRencanaBefore)}</td>
                <td className="py-2 px-3 text-right text-sm">Rp {formatRupiah(group.totalRealisasi)}</td>
                <td className="py-2 px-3 text-right text-sm">Rp {formatRupiah(group.totalRencanaNext)}</td>
                <td className="py-2 px-3 text-right text-sm"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Rencana & Realisasi Anggaran</h2>
              <p className="text-sm text-gray-500">Perbandingan rencana dan realisasi anggaran tahun berjalan</p>
            </div>
          </div>
        </div>

        {/* Filter & Export */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-gray-500" />
              <label className="text-sm font-medium text-gray-700">Tahun:</label>
              <select
                value={tahun}
                onChange={handleTahunChange}
                className="border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
              >
                {daftarTahun.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 ml-auto">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60"
              >
                <Save size={16} /> {saving ? "Menyimpan..." : "Simpan Rencana"}
              </button>
              {saveSuccess && (
                <span className="flex items-center gap-1 text-green-600 text-sm">
                  <CheckCircle size={16} /> Tersimpan!
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleExport("excel")}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-60"
              >
                <FileSpreadsheet size={15} />
              </button>
              <button
                onClick={() => handleExport("pdf")}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-60"
              >
                <FileText size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* SHU Card */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium opacity-80">Rencana SHU {tahun}</p>
              <p className="text-2xl font-bold">Rp {formatRupiah(shuRencanaBefore)}</p>
            </div>
            <div>
              <p className="text-sm font-medium opacity-80">Realisasi SHU {tahun}</p>
              <p className="text-2xl font-bold">Rp {formatRupiah(shuRealisasi)}</p>
            </div>
            <div>
              <p className="text-sm font-medium opacity-80">Rencana SHU {tahun + 1}</p>
              <p className="text-2xl font-bold">Rp {formatRupiah(shuRencanaNext)}</p>
            </div>
            <div>
              <p className="text-sm font-medium opacity-80">Persentase Perubahan</p>
              <p className={`text-2xl font-bold ${shuPersentase > 0 ? 'text-green-300' : shuPersentase < 0 ? 'text-red-300' : ''}`}>
                {shuPersentase.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>

        {/* Tabel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          {renderTable("PENDAPATAN", pendapatan, true)}
          {renderTable("BEBAN", beban, false)}

          {/* SHU Row Summary */}
          <div className="mt-4 border-t-2 border-gray-300 pt-4">
            <div className="grid grid-cols-5 gap-4 font-semibold text-gray-800">
              <div className="col-span-1">SISA HASIL USAHA (SHU)</div>
              <div className="text-right">Rp {formatRupiah(shuRencanaBefore)}</div>
              <div className="text-right">Rp {formatRupiah(shuRealisasi)}</div>
              <div className="text-right">Rp {formatRupiah(shuRencanaNext)}</div>
              <div className={`text-right ${shuPersentase > 0 ? 'text-green-600' : shuPersentase < 0 ? 'text-red-600' : ''}`}>
                {shuPersentase.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}