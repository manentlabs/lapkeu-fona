// src/pages/TokoStokPage.jsx
import React, { useEffect, useState, useCallback } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import {
  Package,
  Search,
  XCircle,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Loader,
  FileSpreadsheet,
  FileText,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  Plus,
  Box,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

// ─── Helper format Rupiah ──────────────────────────────────
function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString("id-ID");
}

function parseRupiah(value) {
  const cleaned = String(value).replace(/\./g, "").replace(/[^0-9-]/g, "");
  return parseInt(cleaned, 10) || 0;
}

export default function TokoStokPage() {
  // ─── State ──────────────────────────────────────────────────
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    totalBarang: 0,
    totalStok: 0,
    barangHampirHabis: 0,
    barangHabis: 0,
  });

  // Filter
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    kode_barang: "",
    nama_barang: "",
    satuan: "Pcs",
    stok_awal: 0,
    harga_awal: 0,
  });
  const [deleteId, setDeleteId] = useState(null);
  const [error, setError] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ─── Fetch Data ─────────────────────────────────────────────
  const fetchData = useCallback(async (page = 1, searchQuery = "") => {
    setLoading(true);
    try {
      const params = { page, per_page: 10 };
      if (searchQuery) params.search = searchQuery;

      const { data } = await api.get("/persediaan", { params });
      setData(data.data || []);
      setPagination(data.pagination || { page: 1, total_pages: 1, total: 0 });

      // Hitung summary dari data
      const totalStok = data.data.reduce((sum, item) => sum + (item.stok_awal || 0), 0);
      const hampirHabis = data.data.filter((item) => item.stok_awal > 0 && item.stok_awal <= 5).length;
      const habis = data.data.filter((item) => item.stok_awal === 0).length;

      setSummary({
        totalBarang: data.pagination?.total || 0,
        totalStok,
        barangHampirHabis: hampirHabis,
        barangHabis: habis,
      });
    } catch (err) {
      console.error("Gagal fetch data stok:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(1, "");
  }, []);

  // ─── Filter ──────────────────────────────────────────────────
  const handleSearch = () => {
    setAppliedSearch(search);
    fetchData(1, search);
  };

  const resetFilters = () => {
    setSearch("");
    setAppliedSearch("");
    fetchData(1, "");
  };

  const goToPage = (page) => {
    fetchData(page, appliedSearch);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ─── CRUD ────────────────────────────────────────────────────
  const openCreateModal = () => {
    setEditingId(null);
    setForm({ kode_barang: "", nama_barang: "", satuan: "Pcs", stok_awal: 0, harga_awal: 0 });
    setError("");
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setForm({
      kode_barang: item.kode_barang,
      nama_barang: item.nama_barang,
      satuan: item.satuan || "Pcs",
      stok_awal: item.stok_awal || 0,
      harga_awal: item.harga_awal || 0,
    });
    setError("");
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setEditLoading(true);
    try {
      if (editingId) {
        await api.put(`/persediaan/${editingId}`, form);
      } else {
        await api.post("/persediaan", form);
      }
      setModalOpen(false);
      fetchData(pagination.page, appliedSearch);
    } catch (err) {
      setError(err.response?.data?.message || "Terjadi kesalahan.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await api.delete(`/persediaan/${deleteId}`);
      setDeleteId(null);
      fetchData(pagination.page, appliedSearch);
    } catch (err) {
      alert(err.response?.data?.message || "Gagal menghapus barang");
    } finally {
      setDeleteLoading(false);
    }
  };

  // ─── Export ──────────────────────────────────────────────────
  const handleExport = async (type) => {
    setExporting(true);
    try {
      const params = {};
      if (appliedSearch) params.search = appliedSearch;

      const response = await api.get(`/persediaan/export-${type}`, {
        params,
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
      link.download = `stok-barang-${new Date().toISOString().slice(0, 10)}.${
        type === "excel" ? "xlsx" : "pdf"
      }`;
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

  // ─── Pagination ─────────────────────────────────────────────
  const renderPagination = () => {
    const { page, total_pages } = pagination;
    if (total_pages <= 1) return null;

    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(total_pages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);

    return (
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button
          onClick={() => goToPage(page - 1)}
          disabled={page <= 1}
          className="h-8 px-3 rounded-lg border text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50"
        >
          <ChevronLeft size={16} />
        </button>
        {start > 1 && (
          <>
            <button
              onClick={() => goToPage(1)}
              className="h-8 w-8 rounded-lg border text-sm hover:bg-gray-50"
            >
              1
            </button>
            {start > 2 && <span className="px-1 text-gray-400">...</span>}
          </>
        )}
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => goToPage(p)}
            className={`h-8 w-8 rounded-lg text-sm ${
              p === page ? "bg-blue-600 text-white" : "border hover:bg-gray-50"
            }`}
          >
            {p}
          </button>
        ))}
        {end < total_pages && (
          <>
            {end < total_pages - 1 && <span className="px-1 text-gray-400">...</span>}
            <button
              onClick={() => goToPage(total_pages)}
              className="h-8 w-8 rounded-lg border text-sm hover:bg-gray-50"
            >
              {total_pages}
            </button>
          </>
        )}
        <button
          onClick={() => goToPage(page + 1)}
          disabled={page >= total_pages}
          className="h-8 px-3 rounded-lg border text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    );
  };

  // ─── Render ──────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Stok Barang</h2>
              <p className="text-sm text-gray-500">Kelola data barang dan stok Waserda</p>
            </div>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={16} /> Tambah Barang
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Box size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Total Barang</p>
                <p className="text-2xl font-bold text-gray-800">{summary.totalBarang}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <Package size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Total Stok</p>
                <p className="text-2xl font-bold text-gray-800">{summary.totalStok}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-amber-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg">
                <TrendingDown size={20} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Hampir Habis (≤5)</p>
                <p className="text-2xl font-bold text-gray-800">{summary.barangHampirHabis}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-red-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <TrendingDown size={20} className="text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Habis (0)</p>
                <p className="text-2xl font-bold text-gray-800">{summary.barangHabis}</p>
              </div>
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
              <Filter size={18} className="text-gray-500" /> Filter & Export Data
            </span>
            {filterOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {filterOpen && (
            <div className="border-t p-4 bg-gray-50">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-white rounded-lg p-4 border">
                  <p className="text-xs font-semibold uppercase text-gray-500 flex items-center gap-2 mb-3">
                    <Filter size={14} /> Filter Data
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-1 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Cari</label>
                      <input
                        type="text"
                        placeholder="Kode / nama barang..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleSearch}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                    >
                      <Search size={15} /> Terapkan Filter
                    </button>
                    <button
                      onClick={resetFilters}
                      className="flex items-center gap-1.5 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
                    >
                      <XCircle size={15} /> Reset
                    </button>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 border">
                  <p className="text-xs font-semibold uppercase text-gray-500 flex items-center gap-2 mb-3">
                    <FileSpreadsheet size={14} /> Export Data
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleExport("excel")}
                      disabled={exporting}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-60"
                    >
                      <FileSpreadsheet size={15} />{" "}
                      {exporting ? "Mengekspor..." : "Export Excel"}
                    </button>
                    <button
                      onClick={() => handleExport("pdf")}
                      disabled={exporting}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-60"
                    >
                      <FileText size={15} />{" "}
                      {exporting ? "Mengekspor..." : "Export PDF"}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                    <AlertCircle size={12} /> Export menggunakan filter aktif
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Search box */}
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Cari barang
              </label>
              <input
                type="text"
                placeholder="Ketik kode atau nama barang..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSearch}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Search size={15} /> Cari
              </button>
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                <XCircle size={15} /> Reset
              </button>
            </div>
          </div>
          {appliedSearch && (
            <p className="mt-3 text-sm text-gray-500">
              Menampilkan hasil untuk: <span className="font-medium">"{appliedSearch}"</span>
            </p>
          )}
        </div>

        {/* ─── TABEL ─── */}
        <div className="hidden overflow-x-auto rounded-xl bg-white shadow-sm border border-gray-100 lg:block">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 text-center">NO</th>
                <th className="px-4 py-3">KODE</th>
                <th className="px-4 py-3">NAMA BARANG</th>
                <th className="px-4 py-3 text-center">SATUAN</th>
                <th className="px-4 py-3 text-right">STOK</th>
                <th className="px-4 py-3 text-right">HARGA RATA-RATA</th>
                <th className="px-4 py-3 text-center">STATUS</th>
                <th className="px-4 py-3 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-6 text-center text-gray-400">
                    <Loader className="animate-spin inline-block mr-2" size={20} /> Memuat...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-6 text-center text-gray-400">
                    Belum ada data barang.
                  </td>
                </tr>
              ) : (
                data.map((item, idx) => {
                  const stok = item.stok_awal || 0;
                  const status = stok === 0 ? "Habis" : stok <= 5 ? "Hampir Habis" : "Tersedia";
                  const statusColor = stok === 0 ? "bg-red-100 text-red-700" : stok <= 5 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700";
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-center text-sm">
                        {(pagination.page - 1) * 10 + idx + 1}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono font-medium text-blue-600">
                        {item.kode_barang}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">{item.nama_barang}</td>
                      <td className="px-4 py-3 text-center text-sm">{item.satuan || "Pcs"}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold">
                        {stok}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-mono">
                        Rp {formatRupiah(item.harga_awal || 0)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteId(item.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Hapus"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ─── MOBILE ─── */}
        <div className="space-y-3 lg:hidden">
          {loading ? (
            <div className="text-center py-8 text-gray-400">
              <Loader className="animate-spin inline-block mr-2" size={20} /> Memuat...
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              Belum ada data barang.
            </div>
          ) : (
            data.map((item) => {
              const stok = item.stok_awal || 0;
              const status = stok === 0 ? "Habis" : stok <= 5 ? "Hampir Habis" : "Tersedia";
              const statusColor = stok === 0 ? "bg-red-100 text-red-700" : stok <= 5 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700";
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl shadow-sm p-4 space-y-2 border border-gray-100"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono font-bold text-blue-600 text-sm">
                        {item.kode_barang}
                      </p>
                      <p className="text-gray-800 font-medium">{item.nama_barang}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                      {status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Stok</span>
                      <p className="font-semibold">{stok} {item.satuan || "Pcs"}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Harga Rata-rata</span>
                      <p className="font-semibold">Rp {formatRupiah(item.harga_awal || 0)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2 border-t">
                    <button
                      onClick={() => openEditModal(item)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100"
                    >
                      <Pencil size={14} /> Edit
                    </button>
                    <button
                      onClick={() => setDeleteId(item.id)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100"
                    >
                      <Trash2 size={14} /> Hapus
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ─── PAGINATION ─── */}
        {!loading && data.length > 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-white p-4 shadow-sm border border-gray-100 sm:flex-row sm:justify-between">
            <p className="text-sm text-gray-500">
              Menampilkan {(pagination.page - 1) * 10 + 1}–
              {Math.min(pagination.page * 10, pagination.total)} dari {pagination.total}{" "}
              data
            </p>
            {renderPagination()}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-4 sm:px-8">
            <h3 className="text-lg font-semibold text-gray-800 sm:text-xl">
                {editingId ? "Edit Barang" : "Tambah Barang"}
            </h3>

            <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            >
                <X size={20} />
            </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <form
                id="barang-form"
                onSubmit={handleSubmit}
                className="mx-auto max-w-2xl"
            >
                {error && (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    <AlertCircle size={18} />
                    {error}
                </div>
                )}

                <div className="space-y-4">
                {/* seluruh input yang sudah ada dipindahkan ke sini */}

                <div>
                    <label className="block text-sm font-medium text-gray-700">
                    Kode Barang
                    </label>
                    <input
                    type="text"
                    value={form.kode_barang}
                    onChange={(e) =>
                        setForm({
                        ...form,
                        kode_barang: e.target.value.toUpperCase(),
                        })
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">
                    Nama Barang
                    </label>
                    <input
                    type="text"
                    value={form.nama_barang}
                    onChange={(e) =>
                        setForm({ ...form, nama_barang: e.target.value })
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    required
                    />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                    <label className="block text-sm font-medium text-gray-700">
                        Satuan
                    </label>
                    <input
                        type="text"
                        value={form.satuan}
                        onChange={(e) =>
                        setForm({ ...form, satuan: e.target.value })
                        }
                        className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        placeholder="Pcs"
                    />
                    </div>

                    <div>
                    <label className="block text-sm font-medium text-gray-700">
                        Stok Awal
                    </label>
                    <input
                        type="number"
                        min="0"
                        value={form.stok_awal}
                        onChange={(e) =>
                        setForm({
                            ...form,
                            stok_awal: parseInt(e.target.value) || 0,
                        })
                        }
                        className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">
                    Harga Rata-rata
                    </label>

                    <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                        Rp
                    </span>

                    <input
                        type="text"
                        inputMode="numeric"
                        value={form.harga_awal ? formatRupiah(form.harga_awal) : ""}
                        onChange={(e) => {
                        const numeric = parseRupiah(e.target.value);
                        setForm({ ...form, harga_awal: numeric });
                        }}
                        placeholder="0"
                        className="w-full rounded-lg border pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                    </div>
                </div>
                </div>
            </form>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t px-4 py-4 sm:px-8">
            <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border px-5 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
                Batal
            </button>

            <button
                type="submit"
                form="barang-form"
                disabled={editLoading}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
                {editLoading ? "Menyimpan..." : "Simpan"}
            </button>
            </div>
        </div>
        )}

      {/* ─── KONFIRMASI HAPUS ─── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full text-center">
            <AlertCircle size={32} className="mx-auto mb-3 text-red-500" />
            <p className="mb-4 text-gray-700">
              Yakin ingin menghapus barang ini? <br />
              <span className="text-sm text-gray-500">(Data terkait pembelian/penjualan akan tetap tersimpan)</span>
            </p>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 border rounded-lg text-sm"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-60"
              >
                {deleteLoading ? "Memproses..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}