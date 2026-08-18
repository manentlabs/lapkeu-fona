// src/pages/bendahara/AlokasiSHUPage.jsx
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
  ArrowRightLeft,
  PieChart,
  Plus,
  Pencil,
  Trash2,
  X,
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

export default function AlokasiSHUPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // State untuk CRUD alokasi persentase
  const [persentaseItems, setPersentaseItems] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ keterangan: "", persentase: 0 });
  const [formError, setFormError] = useState("");

  const fetchData = useCallback(async (dariDate = "", sampaiDate = "") => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (dariDate) params.dari = dariDate;
      if (sampaiDate) params.sampai = sampaiDate;
      const response = await api.get("/bendahara/alokasi-shu", { params });
      setData(response.data);
    } catch (err) {
      console.error("Gagal fetch alokasi SHU:", err);
      setError(err.response?.data?.message || "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPersentase = async () => {
    try {
      const res = await api.get("/bendahara/alokasi-shu/persentase");
      setPersentaseItems(res.data.data || []);
    } catch (err) {
      console.error("Gagal fetch persentase:", err);
    }
  };

  useEffect(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const defaultDari = startOfYear.toISOString().slice(0, 10);
    const defaultSampai = now.toISOString().slice(0, 10);
    setDari(defaultDari);
    setSampai(defaultSampai);
    fetchData(defaultDari, defaultSampai);
    fetchPersentase();
  }, [fetchData]);

  const handleFilter = (e) => {
    e.preventDefault();
    fetchData(dari, sampai);
  };

  const resetFilter = () => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const defaultDari = startOfYear.toISOString().slice(0, 10);
    const defaultSampai = now.toISOString().slice(0, 10);
    setDari(defaultDari);
    setSampai(defaultSampai);
    fetchData(defaultDari, defaultSampai);
  };

  const handleExport = async (type) => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (dari) params.append("dari", dari);
      if (sampai) params.append("sampai", sampai);
      params.append("export", type);

      const response = await api.get(`/bendahara/alokasi-shu/export?${params.toString()}`, {
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
      link.download = `alokasi-shu-${new Date().toISOString().slice(0, 10)}.${type === "excel" ? "xlsx" : "pdf"}`;
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

  // ─── CRUD Persentase ──────────────────────────────────────
  const openCreateModal = () => {
    setEditingId(null);
    setForm({ keterangan: "", persentase: 0 });
    setFormError("");
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setForm({ keterangan: item.keterangan, persentase: item.persentase });
    setFormError("");
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.keterangan || form.persentase <= 0) {
      setFormError("Keterangan dan persentase wajib diisi (min > 0)");
      return;
    }
    try {
      if (editingId) {
        await api.put(`/bendahara/alokasi-shu/persentase/${editingId}`, form);
      } else {
        await api.post("/bendahara/alokasi-shu/persentase", form);
      }
      setModalOpen(false);
      fetchPersentase();
      // Refresh alokasi
      fetchData(dari, sampai);
    } catch (err) {
      setFormError(err.response?.data?.message || "Terjadi kesalahan.");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Yakin ingin menghapus alokasi persentase ini?")) return;
    try {
      await api.delete(`/bendahara/alokasi-shu/persentase/${id}`);
      fetchPersentase();
      fetchData(dari, sampai);
    } catch (err) {
      alert("Gagal menghapus.");
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Memuat alokasi SHU...</p>
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
            onClick={() => fetchData(dari, sampai)}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Coba Lagi
          </button>
        </div>
      </DashboardLayout>
    );
  }

  if (!data) return null;

  const { data: alokasiData, labelPeriode } = data;
  const { shu, items, totalPersentase, totalJumlah, shuAnggota, alokasiJasa } = alokasiData || {};

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Alokasi Sisa Hasil Usaha (SHU)</h2>
              <p className="text-sm text-gray-500">Periode: {labelPeriode || "-"}</p>
            </div>
          </div>
        </div>

        {/* SHU Card */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium opacity-80">Total Sisa Hasil Usaha (SHU)</p>
              <p className="text-3xl font-bold">Rp {formatRupiah(shu)}</p>
            </div>
            <TrendingUp size={40} className="opacity-50" />
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
              Filter Periode & Export Data
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        {/* ─── Alokasi SHU ────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Alokasi Utama */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <PieChart size={18} className="text-blue-600" />
                Alokasi SHU
              </h3>
              <span className="text-sm font-bold">Total: Rp {formatRupiah(totalJumlah)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="py-2 px-4 text-left text-xs font-semibold uppercase tracking-wider">Keterangan</th>
                    <th className="py-2 px-4 text-right text-xs font-semibold uppercase tracking-wider">Persentase</th>
                    <th className="py-2 px-4 text-right text-xs font-semibold uppercase tracking-wider">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {items && items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-4 text-sm">{item.keterangan}</td>
                      <td className="py-2 px-4 text-right text-sm">{item.persentase}%</td>
                      <td className="py-2 px-4 text-right text-sm font-mono">{formatRupiah(item.jumlah)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-bold">
                    <td className="py-2 px-4 text-sm">TOTAL</td>
                    <td className="py-2 px-4 text-right text-sm">{totalPersentase}%</td>
                    <td className="py-2 px-4 text-right text-sm font-mono">{formatRupiah(totalJumlah)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Alokasi Jasa */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <PieChart size={18} className="text-amber-600" />
                Alokasi Jasa (Dari Dana Anggota)
              </h3>
              <span className="text-sm font-bold text-blue-600">Dana Anggota: Rp {formatRupiah(shuAnggota)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="py-2 px-4 text-left text-xs font-semibold uppercase tracking-wider">Keterangan</th>
                    <th className="py-2 px-4 text-right text-xs font-semibold uppercase tracking-wider">Persentase</th>
                    <th className="py-2 px-4 text-right text-xs font-semibold uppercase tracking-wider">Jumlah</th>
                    <th className="py-2 px-4 text-center text-xs font-semibold uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {alokasiJasa && alokasiJasa.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-4 text-sm">{item.keterangan}</td>
                      <td className="py-2 px-4 text-right text-sm">{item.persentase}%</td>
                      <td className="py-2 px-4 text-right text-sm font-mono">{formatRupiah(item.jumlah)}</td>
                      <td className="py-2 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Hapus"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan="4" className="py-3 text-center">
                      <button
                        onClick={openCreateModal}
                        className="flex items-center gap-1.5 mx-auto text-sm text-blue-600 hover:text-blue-800"
                      >
                        <Plus size={16} /> Tambah Alokasi Jasa
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MODAL ────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {editingId ? "Edit Alokasi Jasa" : "Tambah Alokasi Jasa"}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            {formError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle size={18} /> {formError}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Keterangan</label>
                <input
                  type="text"
                  value={form.keterangan}
                  onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Persentase (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.persentase}
                  onChange={(e) => setForm({ ...form, persentase: parseFloat(e.target.value) || 0 })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  {editingId ? "Update" : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}