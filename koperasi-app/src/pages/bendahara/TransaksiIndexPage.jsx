import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import {
  Plus, Pencil, Trash2, Eye, Search, XCircle,
  ChevronDown, ChevronUp, Loader, FileSpreadsheet, FileText,
  ChevronLeft, ChevronRight, X, AlertCircle,
  Calendar, Hash, User, Building2, Banknote,
  TrendingUp, FileBarChart, Wallet,
} from "lucide-react";

function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString("id-ID");
}

// ─── Autocomplete Input Custom (pengganti datalist native) ───
// Dropdown baru muncul setelah minimal 3 karakter diketik,
// dan hasil dibatasi maksimal 5 item teratas.
function AutocompleteInput({ name, value, onChange, options, placeholder, getLabel }) {
  const [showDropdown, setShowDropdown] = useState(false);

  const query = value.trim().toLowerCase();
  const filtered =
    query.length >= 3
      ? options
          .filter((opt) => getLabel(opt).toLowerCase().includes(query))
          .slice(0, 5)
      : [];

  const handleSelect = (opt) => {
    onChange({ target: { name, value: getLabel(opt) } });
    setShowDropdown(false);
  };

  return (
    <div className="relative">
      <input
        type="text"
        name={name}
        value={value}
        autoComplete="off"
        onChange={(e) => {
          onChange(e);
          setShowDropdown(true);
        }}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        className="w-full border rounded-lg px-3 py-2 text-sm"
        placeholder={placeholder}
      />
      {showDropdown && query.length >= 3 && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-52 overflow-auto rounded-lg border bg-white shadow-lg text-sm">
          {filtered.map((opt, i) => (
            <li
              key={i}
              onMouseDown={() => handleSelect(opt)}
              className="px-3 py-2 hover:bg-blue-50 cursor-pointer"
            >
              {getLabel(opt)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TransaksiIndexPage() {
  const navigate = useNavigate();

  // ─── State ──────────────────────────────────────────────
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    total: 0,
    totalHariIni: 0,
    totalBulanIni: 0,
    nominalTotal: 0,
    nominalHariIni: 0,
    nominalBulanIni: 0,
  });

  // Filter state
  const [filters, setFilters] = useState({
    tanggal_mulai: "",
    tanggal_selesai: "",
    kode_transaksi: "",
    nama_akun: "",
    nama_anggota: "",
    search: "",
  });
  const [appliedFilters, setAppliedFilters] = useState({});
  const [filterOpen, setFilterOpen] = useState(false);

  // 🔄 State untuk data form (referensi, anggota, akun) dari endpoint /form-data
  const [formData, setFormData] = useState({
    referensi: [],
    anggota: [],
    akun: [],
  });

  // Delete confirmation
  const [deleteId, setDeleteId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Detail modal
  const [detailItem, setDetailItem] = useState(null);

  // Export loading
  const [exporting, setExporting] = useState(false);

  // ─── Fetch Form Data (untuk opsi filter) ──────────────
  const fetchFormData = useCallback(async () => {
    try {
      const response = await api.get("/transaksi/form-data");
      setFormData(response.data);
    } catch (err) {
      console.error("Gagal mengambil data form:", err);
    }
  }, []);

  // ─── Fetch Data Transaksi ──────────────────────────────
  const fetchData = useCallback(async (page = 1, filterParams = {}) => {
    setLoading(true);
    try {
      const params = {
        page,
        per_page: 10,
        ...filterParams,
      };
      Object.keys(params).forEach((key) => {
        if (!params[key]) delete params[key];
      });

      const { data } = await api.get("/transaksi", { params });
      setData(data.data || []);
      setPagination(data.pagination || { page: 1, total_pages: 1, total: 0 });
      setSummary(data.summary || {});
      // 🔄 Opsi filter lama (dari index) kita abaikan, karena kita pakai dari formData
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFormData(); // ambil data form untuk opsi filter
    fetchData(1, {});
  }, [fetchData, fetchFormData]);

  // ─── Apply Filters ──────────────────────────────────────
  const applyFilters = () => {
    const active = {};
    Object.keys(filters).forEach((key) => {
      if (filters[key]) active[key] = filters[key];
    });
    setAppliedFilters(active);
    fetchData(1, active);
  };

  const resetFilters = () => {
    setFilters({
      tanggal_mulai: "",
      tanggal_selesai: "",
      kode_transaksi: "",
      nama_akun: "",
      nama_anggota: "",
      search: "",
    });
    setAppliedFilters({});
    fetchData(1, {});
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const goToPage = (page) => {
    fetchData(page, appliedFilters);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ─── Delete ──────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await api.delete(`/transaksi/${deleteId}`);
      setDeleteId(null);
      fetchData(pagination.page, appliedFilters);
    } catch (err) {
      alert(err.response?.data?.message || "Gagal menghapus transaksi.");
    } finally {
      setDeleteLoading(false);
    }
  };

  // ─── Export ──────────────────────────────────────────────
  const handleExport = async (type) => {
    setExporting(true);
    try {
      const params = { ...appliedFilters };
      const endpoint = type === "excel" ? "/transaksi/export-excel" : "/transaksi/export-pdf";
      const response = await api.get(endpoint, {
        params,
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: type === "excel"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "application/pdf",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const ext = type === "excel" ? "xlsx" : "pdf";
      link.download = `transaksi-${new Date().toISOString().slice(0, 10)}.${ext}`;
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

  // ─── Pagination ──────────────────────────────────────────
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

  // ─── Render ──────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Transaksi</h2>
              <p className="text-sm text-gray-500">Daftar semua transaksi keuangan</p>
            </div>
            <button
              onClick={() => navigate("/dashboard/bendahara/transaksi/tambah")}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={16} /> Tambah Transaksi
            </button>
          </div>
        </div>

        {/* ─── SUMMARY CARDS ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <SummaryCard
            label="Total Transaksi"
            value={summary.total}
            icon={FileBarChart}
            color="blue"
          />
          <SummaryCard
            label="Hari Ini"
            value={summary.totalHariIni}
            icon={Calendar}
            color="green"
          />
          <SummaryCard
            label="Bulan Ini"
            value={summary.totalBulanIni}
            icon={TrendingUp}
            color="purple"
          />
          <SummaryCard
            label="Nominal Total"
            value={formatRupiah(summary.nominalTotal)}
            icon={Banknote}
            color="amber"
          />
          <SummaryCard
            label="Nominal Hari Ini"
            value={formatRupiah(summary.nominalHariIni)}
            icon={Wallet}
            color="teal"
          />
          <SummaryCard
            label="Nominal Bulan Ini"
            value={formatRupiah(summary.nominalBulanIni)}
            icon={TrendingUp}
            color="indigo"
          />
        </div>

        {/* ─── FILTER & EXPORT ─── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
          >
            <span className="flex items-center gap-2 font-medium text-gray-700">
              <Search size={18} className="text-gray-500" /> Filter & Export
            </span>
            {filterOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {filterOpen && (
            <div className="border-t p-4 bg-gray-50">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Filter */}
                <div className="lg:col-span-2 bg-white rounded-lg p-4 border space-y-3">
                  <p className="text-xs font-semibold uppercase text-gray-500 flex items-center gap-2">
                    <Search size={14} /> Filter Data
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500">Tanggal Mulai</label>
                      <input
                        type="date"
                        name="tanggal_mulai"
                        value={filters.tanggal_mulai}
                        onChange={handleFilterChange}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">Tanggal Selesai</label>
                      <input
                        type="date"
                        name="tanggal_selesai"
                        value={filters.tanggal_selesai}
                        onChange={handleFilterChange}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>

                    {/* 🔄 Kode Transaksi - autocomplete custom (min 3 huruf, max 5 hasil) */}
                    <div>
                      <label className="block text-xs text-gray-500">Kode Transaksi</label>
                      <AutocompleteInput
                        name="kode_transaksi"
                        value={filters.kode_transaksi}
                        onChange={handleFilterChange}
                        options={formData.referensi}
                        getLabel={(ref) => ref.label}
                        placeholder="Ketik untuk mencari..."
                      />
                    </div>

                    {/* 🔄 Akun - autocomplete custom (min 3 huruf, max 5 hasil) */}
                    <div>
                      <label className="block text-xs text-gray-500">Akun</label>
                      <AutocompleteInput
                        name="nama_akun"
                        value={filters.nama_akun}
                        onChange={handleFilterChange}
                        options={formData.akun}
                        getLabel={(akun) => akun.nama_akun}
                        placeholder="Ketik untuk mencari..."
                      />
                    </div>

                    {/* 🔄 Anggota - autocomplete custom (min 3 huruf, max 5 hasil) */}
                    <div>
                      <label className="block text-xs text-gray-500">Anggota</label>
                      <AutocompleteInput
                        name="nama_anggota"
                        value={filters.nama_anggota}
                        onChange={handleFilterChange}
                        options={formData.anggota}
                        getLabel={(a) => `${a.no_anggota} - ${a.nama}`}
                        placeholder="Ketik untuk mencari..."
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={applyFilters}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                    >
                      <Search size={15} /> Terapkan
                    </button>
                    <button
                      onClick={resetFilters}
                      className="flex items-center gap-1.5 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
                    >
                      <XCircle size={15} /> Reset
                    </button>
                  </div>
                </div>

                {/* Export */}
                <div className="bg-white rounded-lg p-4 border space-y-2">
                  <p className="text-xs font-semibold uppercase text-gray-500 flex items-center gap-2">
                    <FileSpreadsheet size={14} /> Export Data
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

        {/* ─── PENCARIAN CEPAT ─── */}
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-xs font-medium text-gray-500">Cari transaksi</label>
              <input
                type="text"
                name="search"
                placeholder="No transaksi / deskripsi / akun / anggota..."
                value={filters.search}
                onChange={handleFilterChange}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={applyFilters}
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
        </div>

        {/* ─── TABEL ─── */}
        <div className="hidden overflow-x-auto rounded-xl bg-white shadow-sm border border-gray-100 lg:block">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 text-center">NO</th>
                <th className="px-4 py-3">No Transaksi</th>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Kode Ref</th>
                <th className="px-4 py-3 text-right">Jumlah</th>
                <th className="px-4 py-3">Anggota</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="9" className="px-4 py-6 text-center text-gray-400">
                  <Loader className="animate-spin inline-block mr-2" size={20} /> Memuat...
                </td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan="9" className="px-4 py-6 text-center text-gray-400">
                  Tidak ada transaksi.
                </td></tr>
              ) : (
                data.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-center">{ (pagination.page - 1) * 10 + idx + 1 }</td>
                    <td className="px-4 py-3 font-mono text-sm">{item.no_transaksi}</td>
                    <td className="px-4 py-3">{item.tanggal}</td>
                    <td className="px-4 py-3">{item.label || "-"}</td>
                    <td className="px-4 py-3 text-right font-mono">Rp {formatRupiah(item.jumlah)}</td>
                    <td className="px-4 py-3">{item.anggota || "-"}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setDetailItem(item)}
                          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
                          title="Detail"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => navigate(`/dashboard/bendahara/transaksi/edit/${item.id}`)}
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

        {/* Mobile cards */}
        <div className="space-y-3 lg:hidden">
          {loading ? (
            <div className="text-center py-8 text-gray-400">
              <Loader className="animate-spin inline-block mr-2" size={20} /> Memuat...
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-8 text-gray-400">Tidak ada transaksi.</div>
          ) : (
            data.map((item) => (
              <div key={item.id} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono font-bold text-sm">{item.no_transaksi}</p>
                    <p className="text-xs text-gray-500">{item.tanggal}</p>
                  </div>
                  <span className="text-sm font-bold">Rp {formatRupiah(item.jumlah)}</span>
                </div>
                <p className="text-sm font-medium">{item.deskripsi}</p>
                <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                  <span><span className="font-medium">Kode Ref:</span> {item.label || "-"}</span>
                  <span><span className="font-medium">Unit:</span> {item.unit_usaha || "-"}</span>
                  <span><span className="font-medium">Akun:</span> {item.jurnalList?.map(j => j.akun?.nama_akun || "-").join(", ") || item.akun || "-"}</span>
                  <span><span className="font-medium">Anggota:</span> {item.anggota || "-"}</span>
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <button
                    onClick={() => setDetailItem(item)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 bg-gray-50 text-gray-600 rounded-lg text-sm hover:bg-gray-100"
                  >
                    <Eye size={14} /> Detail
                  </button>
                  <button
                    onClick={() => navigate(`/dashboard/bendahara/transaksi/edit/${item.id}`)}
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
            ))
          )}
        </div>

        {/* Pagination */}
        {!loading && data.length > 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-white p-4 shadow-sm border border-gray-100 sm:flex-row sm:justify-between">
            <p className="text-sm text-gray-500">
              Menampilkan {(pagination.page - 1) * 10 + 1}–{Math.min(pagination.page * 10, pagination.total)} dari {pagination.total}
            </p>
            {renderPagination()}
          </div>
        )}
      </div>

      {/* ─── MODAL DETAIL ─── */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          {/* konten modal detail tetap sesuai implementasi asli project */}
        </div>
      )}

      {/* ─── KONFIRMASI HAPUS ─── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full text-center">
            <p className="mb-4 text-gray-700">Yakin ingin menghapus transaksi ini?</p>
            <div className="flex justify-center gap-2">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 border rounded-lg text-sm">Batal</button>
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

// ─── Summary Card Component ──────────────────────────────────
function SummaryCard({ label, value, icon: Icon, color }) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    green: "bg-green-50 text-green-600 border-green-200",
    purple: "bg-purple-50 text-purple-600 border-purple-200",
    amber: "bg-amber-50 text-amber-600 border-amber-200",
    teal: "bg-teal-50 text-teal-600 border-teal-200",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-200",
  };
  return (
    <div className={`p-3 rounded-xl border ${colorMap[color]}`}>
      <div className="flex items-center gap-2">
        <Icon size={16} className="opacity-70" />
        <p className="text-xs font-medium opacity-70">{label}</p>
      </div>
      <p className="text-lg font-bold mt-1">{value}</p>
    </div>
  );
}