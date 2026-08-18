import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import AutocompleteInput from "../../components/AutocompleteInput";
import api from "../../api/axios";
import {
  SlidersHorizontal,
  ChevronDown,
  Filter,
  Search,
  XCircle,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  X,
  Pencil,
  Trash2,
  MapPin,
  Phone,
  CalendarDays,
  LogOut,
  Eye,
  Camera,
  User,
} from "lucide-react";

const emptyForm = {
  no_anggota: "", nama: "", jenis_kelamin: "L", alamat: "", desa: "", kecamatan: "",
  no_hp: "", tanggal_gabung: "", tanggal_keluar: "", status: "aktif",
};

const emptyFilters = {
  search: "", status: "", kecamatan: "", desa: "", gabung_dari: "", gabung_sampai: "",
};

export default function AnggotaPage() {
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [filterExportOpen, setFilterExportOpen] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(null);

  const fetchSummary = useCallback(async (activeFilters) => {
    setSummaryLoading(true);
    try {
      const { data } = await api.get("/anggota/summary", { params: activeFilters });
      setSummary(data);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const fetchData = useCallback(async (page = 1, activeFilters) => {
    setLoading(true);
    try {
      const params = { ...activeFilters, page, per_page: 10 };
      const { data } = await api.get("/anggota", { params });
      setData(data.data);
      setPagination(data.pagination);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary(emptyFilters);
    fetchData(1, emptyFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  const applyFilters = () => {
    setAppliedFilters(filters);
    fetchData(1, filters);
    fetchSummary(filters);
  };

  const resetFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    fetchData(1, emptyFilters);
    fetchSummary(emptyFilters);
  };

  const goToPage = (page) => {
    fetchData(page, appliedFilters);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFotoFile(null);
    setFotoPreview(null);
    setError("");
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setForm({
      no_anggota: item.no_anggota,
      nama: item.nama,
      jenis_kelamin: item.jenis_kelamin || "L",
      alamat: item.alamat || "",
      desa: item.desa || "",
      kecamatan: item.kecamatan || "",
      no_hp: item.no_hp || "",
      tanggal_gabung: item.tanggal_gabung?.slice(0, 10) || "",
      tanggal_keluar: item.tanggal_keluar?.slice(0, 10) || "",
      status: item.status,
    });
    setFotoFile(null);
    setFotoPreview(item.foto_url || null);
    setError("");
    setModalOpen(true);
  };

  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([key, value]) => fd.append(key, value ?? ""));
      if (fotoFile) fd.append("foto", fotoFile);

      if (editingId) {
        await api.put(`/anggota/${editingId}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.post("/anggota", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      setModalOpen(false);
      fetchData(pagination.page, appliedFilters);
      fetchSummary(appliedFilters);
    } catch (err) {
      setError(err.response?.data?.message || "Terjadi kesalahan.");
    }
  };

  const handleDelete = async () => {
    await api.delete(`/anggota/${deleteId}`);
    setDeleteId(null);
    fetchData(pagination.page, appliedFilters);
    fetchSummary(appliedFilters);
  };

  const handleExport = async (type) => {
    setExporting(type);
    try {
      const res = await api.get(`/anggota/export/${type}`, {
        params: appliedFilters,
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `data-anggota.${type === "excel" ? "xlsx" : "pdf"}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Gagal mengekspor data. Coba lagi beberapa saat.");
    } finally {
      setExporting(null);
    }
  };

  // Fetcher untuk autocomplete — dipakai baik di form filter maupun form tambah/edit
  const fetchKecamatanSuggestions = async (q) => {
    const { data } = await api.get("/wilayah/kecamatan", { params: { q } });
    return data.data;
  };
  const fetchDesaSuggestions = (kecamatanScope) => async (q) => {
    const { data } = await api.get("/wilayah/desa", { params: { q, kecamatan: kecamatanScope } });
    return data.data;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Data Anggota</h2>
            <p className="text-sm text-gray-500">Kelola data induk anggota koperasi.</p>
          </div>
          <button
            onClick={openCreateModal}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Tambah Anggota
          </button>
        </div>

        {/* Kartu ringkasan — mengikuti filter aktif */}
        <div className={`grid grid-cols-2 gap-4 lg:grid-cols-4 transition-opacity ${summaryLoading ? "opacity-50" : "opacity-100"}`}>
          <SummaryCard label="Total Anggota" value={summary?.total_anggota ?? "-"} color="blue" />
          <SummaryCard label="Anggota Aktif" value={summary?.anggota_aktif ?? "-"} color="green" />
          <SummaryCard label="Anggota Nonaktif" value={summary?.anggota_nonaktif ?? "-"} color="gray" />
          <SummaryCard label="Baru Bulan Ini" value={summary?.anggota_baru_bulan_ini ?? "-"} color="amber" />
        </div>

        {/* ════════════════ FILTER & EXPORT ════════════════ */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setFilterExportOpen((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-50"
          >
            <span className="flex items-center gap-2 font-semibold text-gray-800">
              <SlidersHorizontal size={18} className="text-gray-500" />
              Filter &amp; Export Data
            </span>
            <ChevronDown
              size={18}
              className={`text-gray-500 transition-transform ${filterExportOpen ? "rotate-180" : ""}`}
            />
          </button>

          {filterExportOpen && (
            <div className="grid grid-cols-1 gap-6 border-t px-5 py-5 lg:grid-cols-3">
              {/* Filter — 2/3 */}
              <div className="lg:col-span-2">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Filter size={16} className="text-blue-600" />
                  Filter Data
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Cari</label>
                    <input
                      type="text"
                      placeholder="Nama / No. anggota…"
                      value={filters.search}
                      onChange={(e) => handleFilterChange("search", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Status</label>
                    <select
                      value={filters.status}
                      onChange={(e) => handleFilterChange("status", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    >
                      <option value="">Semua Status</option>
                      <option value="aktif">Aktif</option>
                      <option value="nonaktif">Nonaktif</option>
                    </select>
                  </div>

                  <AutocompleteInput
                    label="Kecamatan"
                    value={filters.kecamatan}
                    onChange={(v) => {
                      handleFilterChange("kecamatan", v);
                      handleFilterChange("desa", ""); // reset desa kalau kecamatan berubah
                    }}
                    fetchSuggestions={fetchKecamatanSuggestions}
                    placeholder="Ketik kecamatan…"
                  />

                  <AutocompleteInput
                    label="Desa"
                    value={filters.desa}
                    onChange={(v) => handleFilterChange("desa", v)}
                    fetchSuggestions={fetchDesaSuggestions(filters.kecamatan)}
                    placeholder="Ketik desa…"
                  />

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Gabung Dari</label>
                    <input
                      type="date"
                      value={filters.gabung_dari}
                      onChange={(e) => handleFilterChange("gabung_dari", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Gabung Sampai</label>
                    <input
                      type="date"
                      value={filters.gabung_sampai}
                      onChange={(e) => handleFilterChange("gabung_sampai", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={applyFilters}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <Search size={15} />
                    Terapkan Filter
                  </button>
                  <button
                    onClick={resetFilters}
                    className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    <XCircle size={15} />
                    Reset
                  </button>
                </div>
              </div>

              {/* Export — 1/3 */}
              <div className="lg:col-span-1 lg:border-l lg:pl-6">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Download size={16} className="text-green-600" />
                  Export Data
                </p>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleExport("excel")}
                    disabled={exporting === "excel"}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    <FileSpreadsheet size={15} />
                    {exporting === "excel" ? "Mengekspor…" : "Export Excel"}
                  </button>
                  <button
                    onClick={() => handleExport("pdf")}
                    disabled={exporting === "pdf"}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    <FileText size={15} />
                    {exporting === "pdf" ? "Mengekspor…" : "Export PDF"}
                  </button>
                </div>

                <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
                  <Info size={13} />
                  Export menggunakan filter aktif
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Tabel — desktop / tablet ke atas */}
        <div className="hidden overflow-x-auto rounded-xl bg-white shadow-sm sm:block">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3">Foto</th>
                <th className="px-4 py-3">No. Anggota</th>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Desa / Kecamatan</th>
                <th className="px-4 py-3">No. HP</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400">Tidak ada data.</td></tr>
              ) : data.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    {item.foto_url ? (
                      <img src={item.foto_url} alt={item.nama} className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                        <User size={16} className="text-gray-400" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">{item.no_anggota}</td>
                  <td className="px-4 py-3 font-medium">{item.nama}</td>
                  <td className="px-4 py-3">{item.desa || "-"}, {item.kecamatan || "-"}</td>
                  <td className="px-4 py-3">{item.no_hp || "-"}</td>
                  <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => setDetailItem(item)}
                        title="Lihat detail"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => openEditModal(item)}
                        title="Edit anggota"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteId(item.id)}
                        title="Hapus anggota"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Kartu — mobile */}
        <div className="space-y-3 sm:hidden">
          {loading ? (
            <p className="py-6 text-center text-gray-400">Memuat…</p>
          ) : data.length === 0 ? (
            <p className="py-6 text-center text-gray-400">Tidak ada data.</p>
          ) : data.map((item) => (
            <div key={item.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {item.foto_url ? (
                    <img src={item.foto_url} alt={item.nama} className="h-12 w-12 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-100">
                      <User size={18} className="text-gray-400" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-800">{item.nama}</p>
                    <p className="text-xs text-gray-500">
                      {item.no_anggota} &middot; {item.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}
                    </p>
                  </div>
                </div>
                <StatusBadge status={item.status} />
              </div>

              <div className="mt-3 space-y-1.5 text-sm text-gray-600">
                <p className="flex items-center gap-2">
                  <MapPin size={14} className="shrink-0 text-gray-400" />
                  {item.desa || "-"}, {item.kecamatan || "-"}
                </p>
                <p className="flex items-center gap-2">
                  <Phone size={14} className="shrink-0 text-gray-400" />
                  {item.no_hp || "-"}
                </p>
                <p className="flex items-center gap-2">
                  <CalendarDays size={14} className="shrink-0 text-gray-400" />
                  Gabung: {item.tanggal_gabung}
                </p>
                {item.tanggal_keluar && (
                  <p className="flex items-center gap-2 text-red-500">
                    <LogOut size={14} className="shrink-0" />
                    Keluar: {item.tanggal_keluar}
                  </p>
                )}
              </div>

              <div className="mt-4 flex items-center gap-2 border-t pt-3">
                <button
                  onClick={() => setDetailItem(item)}
                  title="Lihat Detail"
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
                >
                  <Eye size={16} />
                  Lihat
                </button>

                <button
                  onClick={() => openEditModal(item)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-50 py-2.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-100"
                >
                  <Pencil size={16} />
                  Edit
                </button>

                <button
                  onClick={() => setDeleteId(item.id)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-50 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
                >
                  <Trash2 size={16} />
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Info total + Pagination */}
        {!loading && data.length > 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-white p-4 shadow-sm sm:flex-row sm:justify-between sm:bg-transparent sm:p-0 sm:shadow-none">
            <p className="text-sm text-gray-500">
              Halaman {pagination.page} dari {pagination.total_pages} &middot; {pagination.total} anggota
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={() => goToPage(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="h-8 rounded-lg border px-3 text-sm text-gray-600 disabled:opacity-40"
              >
                Sebelumnya
              </button>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: pagination.total_pages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    className={`h-8 w-8 rounded-lg text-sm ${
                      p === pagination.page ? "bg-blue-600 text-white" : "border bg-white text-gray-600"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                onClick={() => goToPage(pagination.page + 1)}
                disabled={pagination.page >= pagination.total_pages}
                className="h-8 rounded-lg border px-3 text-sm text-gray-600 disabled:opacity-40"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Form Tambah/Edit — Full Layar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b px-4 py-4 sm:px-8">
            <h3 className="text-lg font-semibold text-gray-800 sm:text-xl">
              {editingId ? "Edit Anggota" : "Tambah Anggota"}
            </h3>
            <button
              onClick={() => setModalOpen(false)}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              aria-label="Tutup"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <form id="anggota-form" onSubmit={handleSubmit} className="mx-auto max-w-2xl">
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Foto */}
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm text-gray-700">Foto Anggota</label>
                  <div className="flex items-center gap-4">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                      {fotoPreview ? (
                        <img src={fotoPreview} alt="Preview foto" className="h-full w-full object-cover" />
                      ) : (
                        <User size={28} className="text-gray-400" />
                      )}
                    </div>
                    <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <Camera size={15} />
                      Pilih Foto
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFotoChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Format JPG/PNG/WEBP, maksimal 2MB.</p>
                </div>

                <Field label="No. Anggota" value={form.no_anggota} onChange={(v) => setForm({ ...form, no_anggota: v })} full />
                <Field label="Nama" value={form.nama} onChange={(v) => setForm({ ...form, nama: v })} full />

                {/* Jenis Kelamin */}
                <div>
                  <label className="mb-1 block text-sm text-gray-700">Jenis Kelamin</label>
                  <select
                    value={form.jenis_kelamin}
                    onChange={(e) => setForm({ ...form, jenis_kelamin: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>

                <Field label="No. HP" value={form.no_hp} onChange={(v) => setForm({ ...form, no_hp: v })} />

                <Field label="Alamat" value={form.alamat} onChange={(v) => setForm({ ...form, alamat: v })} full />

                <AutocompleteInput
                  label="Kecamatan"
                  value={form.kecamatan}
                  onChange={(v) => setForm({ ...form, kecamatan: v, desa: "" })}
                  fetchSuggestions={fetchKecamatanSuggestions}
                  placeholder="Ketik kecamatan…"
                />
                <AutocompleteInput
                  label="Desa"
                  value={form.desa}
                  onChange={(v) => setForm({ ...form, desa: v })}
                  fetchSuggestions={fetchDesaSuggestions(form.kecamatan)}
                  placeholder="Ketik desa…"
                />

                <div>
                  <label className="mb-1 block text-sm text-gray-700">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="aktif">Aktif</option>
                    <option value="nonaktif">Nonaktif</option>
                  </select>
                </div>
                <Field label="Tgl Bergabung" type="date" value={form.tanggal_gabung} onChange={(v) => setForm({ ...form, tanggal_gabung: v })} />
                <Field label="Tgl Keluar" type="date" value={form.tanggal_keluar} onChange={(v) => setForm({ ...form, tanggal_keluar: v })} />
              </div>
            </form>
          </div>

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
              form="anggota-form"
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Simpan
            </button>
          </div>
        </div>
      )}

      {/* Modal Detail */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b px-4 py-4 sm:px-8">
            <h3 className="text-lg font-semibold text-gray-800 sm:text-xl">
              Detail Anggota
            </h3>

            <button
              onClick={() => setDetailItem(null)}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <div className="mx-auto max-w-2xl">

              {/* Foto */}
              <div className="mb-6">
                <label className="mb-1 block text-sm text-gray-700">
                  Foto Anggota
                </label>

                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                    {detailItem.foto_url ? (
                      <img
                        src={detailItem.foto_url}
                        alt={detailItem.nama}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User size={28} className="text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                <Field
                  label="No. Anggota"
                  value={detailItem.no_anggota}
                  readOnly
                  full
                />

                <Field
                  label="Nama"
                  value={detailItem.nama}
                  readOnly
                  full
                />

                <div>
                  <label className="mb-1 block text-sm text-gray-700">
                    Jenis Kelamin
                  </label>
                  <input
                    value={
                      detailItem.jenis_kelamin === "L"
                        ? "Laki-laki"
                        : "Perempuan"
                    }
                    readOnly
                    className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm"
                  />
                </div>

                <Field
                  label="No. HP"
                  value={detailItem.no_hp || "-"}
                  readOnly
                />

                <Field
                  label="Alamat"
                  value={detailItem.alamat || "-"}
                  readOnly
                  full
                />

                <Field
                  label="Kecamatan"
                  value={detailItem.kecamatan || "-"}
                  readOnly
                />

                <Field
                  label="Desa"
                  value={detailItem.desa || "-"}
                  readOnly
                />

                <Field
                  label="Status"
                  value={detailItem.status}
                  readOnly
                />

                <Field
                  label="Tgl Bergabung"
                  value={detailItem.tanggal_gabung?.slice(0, 10) || "-"}
                  readOnly
                />

                <Field
                  label="Tgl Keluar"
                  value={detailItem.tanggal_keluar?.slice(0, 10) || "-"}
                  readOnly
                />

              </div>
            </div>
          </div>

          <div className="flex justify-end border-t px-4 py-4 sm:px-8">
            <button
              onClick={() => setDetailItem(null)}
              className="rounded-lg border px-5 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Konfirmasi hapus */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center">
            <p className="mb-4 text-gray-700">Yakin ingin menghapus anggota ini?</p>
            <div className="flex justify-center gap-2">
              <button onClick={() => setDeleteId(null)} className="rounded-lg border px-4 py-2 text-sm">Batal</button>
              <button onClick={handleDelete} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function SummaryCard({ label, value, color }) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    gray: "bg-gray-100 text-gray-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <div className={`rounded-xl p-4 shadow-sm ${colorMap[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const isAktif = status === "aktif";
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${isAktif ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
      {isAktif ? "Aktif" : "Nonaktif"}
    </span>
  );
}

function Field({
  label,
  value,
  onChange = () => {},
  type = "text",
  full = false,
  readOnly = false,
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="mb-1 block text-sm text-gray-700">{label}</label>

      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        className={`w-full rounded-lg border px-3 py-2 text-sm ${
          readOnly ? "bg-gray-50 text-gray-700" : ""
        }`}
      />
    </div>
  );
}