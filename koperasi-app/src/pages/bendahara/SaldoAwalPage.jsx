import React, { useEffect, useState, useCallback } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import {
  Wallet, Banknote, Receipt, Search, XCircle,
  ChevronDown, ChevronUp, Pencil, Trash2, Loader,
  FileSpreadsheet, FileText, Filter, ChevronLeft, ChevronRight,
  X, AlertCircle, FolderOpen, Wallet2,
} from "lucide-react";

export default function SaldoAwalPage() {
  // State
  const [data, setData] = useState([]);
  const [parentIds, setParentIds] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [tipeAkun, setTipeAkun] = useState("");
  const [appliedTipe, setAppliedTipe] = useState("");
  const [summary, setSummary] = useState({
    totalAset: 0,
    totalBeban: 0,
    totalKewajiban: 0,
    totalModal: 0,
    totalPendapatan: 0,
    totalKeseluruhan: 0,
    totalPajak: 0,
    totalAkunBerSaldo: 0,
  });

  const [filterOpen, setFilterOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ saldo_awal: "", pajak: "" });
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [resetId, setResetId] = useState(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ─── Fetch Data ──────────────────────────────────────────────
  const fetchData = useCallback(async (page = 1, searchQuery = "", tipe = "") => {
    setLoading(true);
    try {
      const params = { page, per_page: 10 };
      if (searchQuery) params.search = searchQuery;
      if (tipe) params.tipe_akun = tipe;

      const { data } = await api.get("/saldo-awal", { params });
      setData(data.data || []);
      setParentIds(data.parentIds || []);
      setPagination(data.pagination || { page: 1, total_pages: 1, total: 0 });

      setSummary({
        totalAset: parseFloat(data.totalAset) || 0,
        totalBeban: parseFloat(data.totalBeban) || 0,
        totalKewajiban: parseFloat(data.totalKewajiban) || 0,
        totalModal: parseFloat(data.totalModal) || 0,
        totalPendapatan: parseFloat(data.totalPendapatan) || 0,
        totalKeseluruhan: parseFloat(data.totalKeseluruhan) || 0,
        totalPajak: parseFloat(data.totalPajak) || 0,
        totalAkunBerSaldo: parseInt(data.totalAkunBerSaldo) || 0,
      });
    } catch (err) {
      console.error("Gagal fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(1, "", "");
  }, [fetchData]);

  // ─── Filter & Search ─────────────────────────────────────────
  const handleSearch = () => {
    setAppliedSearch(search);
    setAppliedTipe(tipeAkun);
    fetchData(1, search, tipeAkun);
  };

  const resetFilters = () => {
    setSearch("");
    setTipeAkun("");
    setAppliedSearch("");
    setAppliedTipe("");
    fetchData(1, "", "");
  };

  const goToPage = (page) => {
    fetchData(page, appliedSearch, appliedTipe);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ─── Edit Modal ─────────────────────────────────────────────
  const openEditModal = (item) => {
    setEditingId(item.id);
    setEditForm({
      saldo_awal: item.saldo_awal ?? 0,
      pajak: item.pajak ?? 0,
    });
    setEditError("");
    setEditModalOpen(true);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError("");
    setEditLoading(true);
    try {
      await api.put(`/saldo-awal/${editingId}`, {
        saldo_awal: parseFloat(editForm.saldo_awal) || 0,
        pajak: parseFloat(editForm.pajak) || 0,
      });
      setEditModalOpen(false);
      fetchData(pagination.page, appliedSearch, appliedTipe);
    } catch (err) {
      setEditError(err.response?.data?.message || "Terjadi kesalahan.");
    } finally {
      setEditLoading(false);
    }
  };

  // ─── Reset ────────────────────────────────────────────────────
  const handleReset = async () => {
    setResetLoading(true);
    try {
      await api.delete(`/saldo-awal/${resetId}`);
      setResetId(null);
      fetchData(pagination.page, appliedSearch, appliedTipe);
    } catch (err) {
      alert(err.response?.data?.message || "Gagal mereset saldo.");
    } finally {
      setResetLoading(false);
    }
  };

// ─── Export ──────────────────────────────────────────────────
const handleExport = async (type) => {
  setExporting(true);
  try {
    const params = {};
    if (appliedTipe) params.tipe_akun = appliedTipe;
    if (appliedSearch) params.search = appliedSearch;

    if (type === "excel") {
      // CSV export (sama seperti sebelumnya)
      const { data } = await api.get("/saldo-awal/export", { params });
      const items = data.data || [];
      const headers = ["Kode Akun", "Nama Akun", "Tipe", "Saldo Awal", "Pajak"];
      const rows = items.map((a) => [
        a.kode_akun,
        a.nama_akun,
        a.tipe_akun,
        a.saldo_awal ?? 0,
        a.pajak ?? 0,
      ]);
      const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `saldo-awal-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } else {
      // PDF - download dari backend
      const response = await api.get("/saldo-awal/export-pdf", {
        params,
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(
        new Blob([response.data], { type: "application/pdf" })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `saldo-awal-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    }
  } catch (err) {
    alert("Gagal mengekspor data.");
  } finally {
    setExporting(false);
  }
};

  // ─── Helper ──────────────────────────────────────────────────
  // Format Rupiah dengan tanda untuk akun kredit
  const formatRupiah = (value, tipeAkun) => {
    const num = parseFloat(value) || 0;
    const isKredit = ["kewajiban", "modal", "pendapatan"].includes(tipeAkun?.toLowerCase());
    if (isKredit && num > 0) {
      return `(Rp ${num.toLocaleString("id-ID")})`;
    }
    if (num < 0) {
      return `(Rp ${Math.abs(num).toLocaleString("id-ID")})`;
    }
    return `Rp ${num.toLocaleString("id-ID")}`;
  };

  const isParent = (id) => parentIds.includes(id);

  const tipeBadge = (tipe) => {
    const map = {
      aset: "bg-blue-100 text-blue-700",
      kewajiban: "bg-red-100 text-red-700",
      modal: "bg-green-100 text-green-700",
      pendapatan: "bg-amber-100 text-amber-700",
      beban: "bg-purple-100 text-purple-700",
    };
    return map[tipe] || "bg-gray-100 text-gray-700";
  };

  const tipeLabel = {
    aset: "ASET",
    kewajiban: "KEWAJIBAN",
    modal: "MODAL",
    pendapatan: "PENDAPATAN",
    beban: "BEBAN",
  };

  // ─── Pagination ──────────────────────────────────────────────
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
        {pages.map(p => (
          <button key={p} onClick={() => goToPage(p)}
            className={`h-8 w-8 rounded-lg text-sm ${p === page ? "bg-blue-600 text-white" : "border hover:bg-gray-50"}`}
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
        <button onClick={() => goToPage(page + 1)} disabled={page >= total_pages}
          className="h-8 px-3 rounded-lg border text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    );
  };

  // ─── Render Row ─────────────────────────────────────────────
  const renderRow = (item, index) => {
    const isParentRow = isParent(item.id);
    const indent = (item.kode_akun?.match(/\./g) || []).length * 16;
    const saldo = parseFloat(item.saldo_awal) || 0;

    return (
      <tr key={item.id} className={`hover:bg-gray-50 transition ${isParentRow ? "bg-purple-50" : ""}`}>
        <td className="px-4 py-3 text-sm text-center">{index + 1}</td>
        <td className="px-4 py-3 text-sm font-mono font-medium text-blue-600">{item.kode_akun}</td>
        <td className="px-4 py-3 text-sm" style={{ paddingLeft: `${12 + indent}px` }}>
          <div className="flex items-center gap-1">
            {isParentRow && <FolderOpen size={16} className="text-purple-600" />}
            {!isParentRow && <Wallet2 size={14} className="text-gray-400" />}
            <span>{item.nama_akun}</span>
            {isParentRow && <span className="ml-2 text-xs text-purple-500">(Induk)</span>}
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tipeBadge(item.tipe_akun)}`}>
            {tipeLabel[item.tipe_akun] || item.tipe_akun}
          </span>
        </td>
        <td className={`px-4 py-3 text-sm font-mono text-right ${isParentRow ? "text-purple-700" : saldo < 0 ? "text-red-600" : ""}`}>
          {formatRupiah(saldo, item.tipe_akun)}
        </td>
        <td className="px-4 py-3 text-sm text-right">{item.pajak ?? 0}%</td>
        <td className="px-4 py-3 text-center">
          {!isParentRow ? (
            <div className="flex items-center justify-center gap-1.5">
              <button onClick={() => openEditModal(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                <Pencil size={16} />
              </button>
              <button onClick={() => setResetId(item.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Reset ke 0">
                <Trash2 size={16} />
              </button>
            </div>
          ) : (
            <span className="text-xs text-gray-400">-</span>
          )}
        </td>
      </tr>
    );
  };

  // ─── Mobile Card ─────────────────────────────────────────────
  const renderMobileCard = (item) => {
    const isParentRow = isParent(item.id);
    const saldo = parseFloat(item.saldo_awal) || 0;

    return (
      <div key={item.id} className="bg-white rounded-xl shadow-sm p-4 space-y-2 border border-gray-100">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              {isParentRow ? <FolderOpen size={16} className="text-purple-600" /> : <Wallet2 size={14} className="text-gray-400" />}
              <span className="font-mono font-bold text-blue-600 text-sm">{item.kode_akun}</span>
            </div>
            <p className="font-medium text-gray-800">{item.nama_akun}</p>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tipeBadge(item.tipe_akun)}`}>
            {tipeLabel[item.tipe_akun] || item.tipe_akun}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">Saldo Awal</span>
            <p className={`font-bold ${isParentRow ? "text-purple-700" : saldo < 0 ? "text-red-600" : ""}`}>
              {formatRupiah(saldo, item.tipe_akun)}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Pajak</span>
            <p className="font-medium">{item.pajak ?? 0}%</p>
          </div>
        </div>
        {!isParentRow && (
          <div className="flex gap-2 pt-2 border-t">
            <button onClick={() => openEditModal(item)} className="flex-1 flex items-center justify-center gap-1 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100">
              <Pencil size={14} /> Edit
            </button>
            <button onClick={() => setResetId(item.id)} className="flex-1 flex items-center justify-center gap-1 py-2 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100">
              <Trash2 size={14} /> Reset
            </button>
          </div>
        )}
        {isParentRow && <div className="text-xs text-gray-400 text-center pt-1">Akun induk (otomatis)</div>}
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
              <h2 className="text-xl font-semibold text-gray-800">Saldo Awal Akun</h2>
              <p className="text-sm text-gray-500">Kelola saldo awal akun keuangan koperasi</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg"><Banknote size={20} className="text-blue-600" /></div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Akun Ber-Saldo</p>
                <p className="text-2xl font-bold text-gray-800">{summary.totalAkunBerSaldo}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg"><Wallet size={20} className="text-green-600" /></div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Total Pajak</p>
                <p className="text-2xl font-bold text-gray-800">{summary.totalPajak.toFixed(2)}%</p>
              </div>
            </div>
          </div>
          <div className={`bg-white rounded-xl shadow-sm p-4 border-l-4 ${Math.abs(summary.totalKeseluruhan) < 0.01 ? 'border-green-500' : 'border-red-500'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${Math.abs(summary.totalKeseluruhan) < 0.01 ? 'bg-green-50' : 'bg-red-50'}`}>
                <Receipt size={20} className={`${Math.abs(summary.totalKeseluruhan) < 0.01 ? 'text-green-600' : 'text-red-600'}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Selisih (Debit - Kredit)</p>
                <p className={`text-2xl font-bold ${Math.abs(summary.totalKeseluruhan) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatRupiah(summary.totalKeseluruhan, 'total')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter & Export (sama seperti sebelumnya) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <button onClick={() => setFilterOpen(!filterOpen)} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition">
            <span className="flex items-center gap-2 font-medium text-gray-700"><Filter size={18} className="text-gray-500" /> Filter & Export Data</span>
            {filterOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {filterOpen && (
            <div className="border-t p-4 bg-gray-50">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-white rounded-lg p-4 border">
                  <p className="text-xs font-semibold uppercase text-gray-500 flex items-center gap-2 mb-3"><Filter size={14} /> Filter Data</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Jenis Akun</label>
                      <select value={tipeAkun} onChange={(e) => setTipeAkun(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                        <option value="">Semua Jenis</option>
                        <option value="aset">Aset</option>
                        <option value="kewajiban">Kewajiban</option>
                        <option value="modal">Modal</option>
                        <option value="pendapatan">Pendapatan</option>
                        <option value="beban">Beban</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={handleSearch} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><Search size={15} /> Terapkan Filter</button>
                    <button onClick={resetFilters} className="flex items-center gap-1.5 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"><XCircle size={15} /> Reset</button>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 border">
                  <p className="text-xs font-semibold uppercase text-gray-500 flex items-center gap-2 mb-3"><FileSpreadsheet size={14} /> Export Data</p>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => handleExport('excel')} disabled={exporting} className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-60"><FileSpreadsheet size={15} /> {exporting ? 'Mengekspor...' : 'Export Excel'}</button>
                    <button onClick={() => handleExport('pdf')} disabled={exporting} className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-60"><FileText size={15} /> {exporting ? 'Mengekspor...' : 'Export PDF'}</button>
                  </div>
                  <p className="mt-2 text-xs text-gray-400 flex items-center gap-1"><AlertCircle size={12} /> Export menggunakan filter aktif</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Search box */}
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-xs font-medium text-gray-500">Cari kode / nama akun</label>
              <input type="text" placeholder="Ketik kode atau nama akun..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSearch} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"><Search size={15} /> Cari</button>
              <button onClick={resetFilters} className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"><XCircle size={15} /> Reset</button>
            </div>
          </div>
          {(appliedSearch || appliedTipe) && <p className="mt-3 text-sm text-gray-500">Menampilkan hasil untuk: {appliedSearch && <span className="font-medium">"{appliedSearch}"</span>}{appliedSearch && appliedTipe && ' dan '}{appliedTipe && <span className="font-medium">tipe: {appliedTipe}</span>}</p>}
        </div>

        {/* ─── TABEL ─── */}
        <div className="hidden overflow-x-auto rounded-xl bg-white shadow-sm border border-gray-100 lg:block">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 text-center">NO</th>
                <th className="px-4 py-3">KODE AKUN</th>
                <th className="px-4 py-3">NAMA AKUN</th>
                <th className="px-4 py-3">TIPE</th>
                <th className="px-4 py-3 text-right">SALDO AWAL</th>
                <th className="px-4 py-3 text-right">PAJAK</th>
                <th className="px-4 py-3 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="px-4 py-6 text-center text-gray-400"><Loader className="animate-spin inline-block mr-2" size={20} /> Memuat...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan="7" className="px-4 py-6 text-center text-gray-400">Tidak ada data saldo awal.</td></tr>
              ) : (
                data.map((item, idx) => renderRow(item, (pagination.page - 1) * 10 + idx))
              )}
            </tbody>
            {data.length > 0 && (
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td colSpan="3" className="px-4 py-3">TOTAL KESELURUHAN (Debit - Kredit)</td>
                  <td colSpan="2" className={`px-4 py-3 text-right font-mono ${Math.abs(summary.totalKeseluruhan) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatRupiah(summary.totalKeseluruhan, 'total')}
                  </td>
                  <td className="px-4 py-3 text-right">{summary.totalPajak.toFixed(2)}%</td>
                  <td className="px-4 py-3 text-center text-gray-400">-</td>
                </tr>
                <tr>
                  <td colSpan="3" className="px-4 py-3 text-sm text-gray-500">Rincian:</td>
                  <td colSpan="4" className="px-4 py-3 text-sm">
                    <div className="grid grid-cols-3 gap-2">
                      <span>Aset: {formatRupiah(summary.totalAset, 'aset')}</span>
                      <span>Beban: {formatRupiah(summary.totalBeban, 'beban')}</span>
                      <span>Kewajiban: {formatRupiah(summary.totalKewajiban, 'kewajiban')}</span>
                      <span>Modal: {formatRupiah(summary.totalModal, 'modal')}</span>
                      <span>Pendapatan: {formatRupiah(summary.totalPendapatan, 'pendapatan')}</span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ─── MOBILE ─── */}
        <div className="space-y-3 lg:hidden">
          {loading ? <div className="text-center py-8 text-gray-400"><Loader className="animate-spin inline-block mr-2" size={20} /> Memuat...</div> : data.length === 0 ? <div className="text-center py-8 text-gray-400">Tidak ada data saldo awal.</div> : data.map(item => renderMobileCard(item))}
        </div>

        {/* ─── PAGINATION ─── */}
        {!loading && data.length > 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-white p-4 shadow-sm border border-gray-100 sm:flex-row sm:justify-between">
            <p className="text-sm text-gray-500">Menampilkan {(pagination.page - 1) * 10 + 1}–{Math.min(pagination.page * 10, pagination.total)} dari {pagination.total} data</p>
            {renderPagination()}
          </div>
        )}
      </div>

      {/* ─── MODAL EDIT ─── */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Saldo Awal</h3>
              <button onClick={() => setEditModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            {editError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2"><AlertCircle size={18} /> {editError}</div>}
            <form onSubmit={handleEditSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Saldo Awal</label>
                  <input type="number" name="saldo_awal" step="0.01" value={editForm.saldo_awal} onChange={handleEditChange} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Pajak (%)</label>
                  <input type="number" name="pajak" step="0.01" min="0" value={editForm.pajak} onChange={handleEditChange} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <button type="button" onClick={() => setEditModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm">Batal</button>
                <button type="submit" disabled={editLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">{editLoading ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── KONFIRMASI RESET ─── */}
      {resetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full text-center">
            <p className="mb-4 text-gray-700">Reset saldo awal akun ini ke 0?</p>
            <div className="flex justify-center gap-2">
              <button onClick={() => setResetId(null)} className="px-4 py-2 border rounded-lg text-sm">Batal</button>
              <button onClick={handleReset} disabled={resetLoading} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-60">{resetLoading ? 'Memproses...' : 'Reset'}</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}