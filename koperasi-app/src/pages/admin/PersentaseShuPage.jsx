import React, { useEffect, useState, useCallback } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import {
  Plus, Pencil, Trash2, Eye, Search, XCircle,
  Loader, Percent, X, AlertCircle,
  ChevronLeft, ChevronRight
} from "lucide-react";

const emptyForm = {
  keterangan: "",
  persentase: "",
};

export default function PersentaseShuPage() {
  // State
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [summary, setSummary] = useState({ total: 0, totalPersentase: 0 });

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const [deleteId, setDeleteId] = useState(null);
  const [detailItem, setDetailItem] = useState(null);

  // Fetch data
  const fetchData = useCallback(async (page = 1, searchQuery = "") => {
    setLoading(true);
    try {
      const params = { page, per_page: 10 };
      if (searchQuery) params.search = searchQuery;
      const { data } = await api.get("/persentase-shu", { params });
      setData(data.data);
      setPagination(data.pagination);
      setSummary(data.summary);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = () => {
    setAppliedSearch(search);
    fetchData(1, search);
  };

  const resetSearch = () => {
    setSearch("");
    setAppliedSearch("");
    fetchData(1, "");
  };

  const goToPage = (page) => {
    fetchData(page, appliedSearch);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Modal form
  const openCreateModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setForm({
      keterangan: item.keterangan || "",
      persentase: item.persentase || "",
    });
    setFormError("");
    setModalOpen(true);
  };

  const openDetailModal = (item) => setDetailItem(item);

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    try {
      const payload = { ...form };
      if (editingId) {
        await api.put(`/persentase-shu/${editingId}`, payload);
      } else {
        await api.post("/persentase-shu", payload);
      }
      setModalOpen(false);
      fetchData(pagination.page, appliedSearch);
    } catch (err) {
      setFormError(err.response?.data?.message || "Terjadi kesalahan.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/persentase-shu/${deleteId}`);
      setDeleteId(null);
      fetchData(pagination.page, appliedSearch);
    } catch (err) {
      alert(err.response?.data?.message || "Gagal menghapus data.");
    }
  };

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
            <button onClick={() => goToPage(1)} className="h-8 w-8 rounded-lg border text-sm hover:bg-gray-50">1</button>
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
            <button onClick={() => goToPage(total_pages)} className="h-8 w-8 rounded-lg border text-sm hover:bg-gray-50">
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Persentase SHU</h2>
            <p className="text-sm text-gray-500">Kelola persentase pembagian SHU koperasi.</p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            Tambah Persentase
          </button>
        </div>

        {/* Ringkasan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Percent size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Total Data</p>
                <p className="text-2xl font-bold text-gray-800">{summary.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <Percent size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Total Persentase</p>
                <p className="text-2xl font-bold text-gray-800">{summary.totalPersentase}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pencarian */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Cari keterangan
              </label>
              <input
                type="text"
                placeholder="Ketik keterangan..."
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
                onClick={resetSearch}
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

        {/* Tabel Desktop */}
        <div className="hidden overflow-x-auto rounded-xl bg-white shadow-sm lg:block">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3">NO</th>
                <th className="px-4 py-3">KETERANGAN</th>
                <th className="px-4 py-3 text-center">PERSENTASE</th>
                <th className="px-4 py-3 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-4 py-6 text-center text-gray-400">
                    <Loader className="animate-spin inline-block mr-2" size={20} />
                    Memuat...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-4 py-6 text-center text-gray-400">
                    Tidak ada data persentase SHU.
                  </td>
                </tr>
              ) : (
                data.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {(pagination.page - 1) * pagination.per_page + index + 1}
                    </td>
                    <td className="px-4 py-3">{item.keterangan}</td>
                    <td className="px-4 py-3 text-center font-semibold text-blue-600">
                      {item.persentase}%
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openDetailModal(item)}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
                          title="Detail"
                        >
                          <Eye size={16} />
                        </button>
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
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Kartu Mobile */}
        <div className="space-y-3 lg:hidden">
          {loading ? (
            <div className="text-center py-8 text-gray-400">
              <Loader className="animate-spin inline-block mr-2" size={20} />
              Memuat...
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-8 text-gray-400">Tidak ada data persentase SHU.</div>
          ) : (
            data.map((item) => (
              <div key={item.id} className="bg-white rounded-xl shadow-sm p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{item.keterangan}</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{item.persentase}%</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openDetailModal(item)}
                      className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => openEditModal(item)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteId(item.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {!loading && data.length > 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-white p-4 shadow-sm sm:flex-row sm:justify-between">
            <p className="text-sm text-gray-500">
              Halaman {pagination.page} dari {pagination.total_pages} &middot; {pagination.total} data
            </p>
            {renderPagination()}
          </div>
        )}
      </div>

      {/* ===== MODAL FORM ===== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b px-4 py-4 sm:px-8">
            <h3 className="text-lg font-semibold">{editingId ? "Edit Persentase SHU" : "Tambah Persentase SHU"}</h3>
            <button onClick={() => setModalOpen(false)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-2">
                  <AlertCircle size={18} />
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Keterangan *</label>
                  <input
                    type="text"
                    value={form.keterangan}
                    onChange={(e) => handleFormChange("keterangan", e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    required
                    placeholder="Contoh: Dana Cadangan"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Persentase (%) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.persentase}
                    onChange={(e) => handleFormChange("persentase", e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    required
                    placeholder="Contoh: 25"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm">
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60"
                >
                  {formLoading ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL DETAIL ===== */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b px-4 py-4 sm:px-8">
            <h3 className="text-lg font-semibold">Detail Persentase SHU</h3>
            <button onClick={() => setDetailItem(null)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <div className="max-w-2xl mx-auto space-y-3">
              <div className="grid grid-cols-2 gap-2 border-b pb-2">
                <span className="text-gray-500">Keterangan</span>
                <span className="font-medium">{detailItem.keterangan}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 border-b pb-2">
                <span className="text-gray-500">Persentase</span>
                <span className="font-bold text-blue-600 text-lg">{detailItem.persentase}%</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <span className="text-gray-500">Dibuat</span>
                <span className="font-medium">{new Date(detailItem.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end border-t px-4 py-4">
            <button onClick={() => setDetailItem(null)} className="px-4 py-2 border rounded-lg text-sm">
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* ===== KONFIRMASI HAPUS ===== */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full text-center">
            <p className="mb-4 text-gray-700">Yakin ingin menghapus data ini?</p>
            <div className="flex justify-center gap-2">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 border rounded-lg text-sm">
                Batal
              </button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}