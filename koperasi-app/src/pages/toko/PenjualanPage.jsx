// src/pages/TokoPenjualanPage.jsx
import React, { useEffect, useState, useCallback } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import AsyncSelect from "react-select/async";
import {
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
  Eye,
  Calendar,
  DollarSign,
  Package,
  ShoppingCart,
  Truck,
} from "lucide-react";

function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default function TokoPenjualanPage() {
  // ─── State ──────────────────────────────────────────────────
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({ totalPenjualan: 0, totalHariIni: 0, totalTransaksi: 0 });

  // Filter
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [tanggalMulai, setTanggalMulai] = useState("");
  const [tanggalSelesai, setTanggalSelesai] = useState("");
  const [appliedMulai, setAppliedMulai] = useState("");
  const [appliedSelesai, setAppliedSelesai] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  // Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ tanggal: "", deskripsi: "" });
  const [editItems, setEditItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ─── Form Tambah Penjualan ────────────────────────────────
  const [penjualanItems, setPenjualanItems] = useState([
    { barang_id: "", barang_label: "", stok: null, jumlah: 1, harga_jual: 0 },
  ]);
  const [formPenjualan, setFormPenjualan] = useState({
    tanggal: new Date().toISOString().slice(0, 10),
    deskripsi: "",
    anggota_id: "",
    anggota_label: "",
    metode: "tunai",
  });
  const [createLoading, setCreateLoading] = useState(false);

  // ─── Fetch Data ─────────────────────────────────────────────
  const fetchData = useCallback(
    async (page = 1, searchQuery = "", mulai = "", selesai = "") => {
      setLoading(true);
      try {
        const params = { page, per_page: 10 };
        if (searchQuery) params.search = searchQuery;
        if (mulai) params.tanggal_mulai = mulai;
        if (selesai) params.tanggal_selesai = selesai;

        const { data } = await api.get("/persediaan/penjualan", { params });
        setData(data.data || []);
        setPagination(data.pagination || { page: 1, total_pages: 1, total: 0 });
        setSummary(
          data.summary || { totalPenjualan: 0, totalHariIni: 0, totalTransaksi: 0 }
        );
      } catch (err) {
        console.error("Gagal fetch data penjualan:", err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchData(1, "", "", "");
  }, []);

  // ─── Autocomplete Loaders ─────────────────────────────────────
  const loadAnggotaOptions = async (inputValue) => {
    if (!inputValue || inputValue.length < 2) return [];
    try {
      const { data } = await api.get("/anggota/autocomplete", {
        params: { q: inputValue },
      });
      return data.data.map((a) => ({
        value: a.id,
        label: `${a.no_anggota} - ${a.nama}`,
      }));
    } catch (err) {
      console.error("Gagal mencari anggota:", err);
      return [];
    }
  };

  const loadBarangOptions = async (inputValue) => {
    if (!inputValue || inputValue.length < 2) return [];
    try {
      const { data } = await api.get("/persediaan/autocomplete", {
        params: { q: inputValue },
      });
      return data.data.map((b) => ({
        value: b.id,
        label: `${b.kode_barang} - ${b.nama_barang} (stok: ${b.stok_awal})`,
        stok: b.stok_awal,
        harga_awal: b.harga_awal,
        kode_barang: b.kode_barang,
        nama_barang: b.nama_barang,
        satuan: b.satuan,
      }));
    } catch (err) {
      console.error("Gagal mencari barang:", err);
      return [];
    }
  };

  // ─── Filter ──────────────────────────────────────────────────
  const handleSearch = () => {
    setAppliedSearch(search);
    setAppliedMulai(tanggalMulai);
    setAppliedSelesai(tanggalSelesai);
    fetchData(1, search, tanggalMulai, tanggalSelesai);
  };

  const resetFilters = () => {
    setSearch("");
    setTanggalMulai("");
    setTanggalSelesai("");
    setAppliedSearch("");
    setAppliedMulai("");
    setAppliedSelesai("");
    fetchData(1, "", "", "");
  };

  const goToPage = (page) => {
    fetchData(page, appliedSearch, appliedMulai, appliedSelesai);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ─── CRUD ────────────────────────────────────────────────────
  const addPenjualanItem = () => {
    setPenjualanItems([
      ...penjualanItems,
      { barang_id: "", barang_label: "", stok: null, jumlah: 1, harga_jual: 0 },
    ]);
  };

  const removePenjualanItem = (idx) => {
    if (penjualanItems.length <= 1) return;
    setPenjualanItems(penjualanItems.filter((_, i) => i !== idx));
  };

  const updatePenjualanItem = (idx, field, value) => {
    const newItems = [...penjualanItems];
    newItems[idx][field] = value;
    setPenjualanItems(newItems);
  };

  const handleBarangSelect = (idx, opt) => {
    const newItems = [...penjualanItems];
    newItems[idx] = {
      ...newItems[idx],
      barang_id: opt?.value || "",
      barang_label: opt?.label || "",
      stok: opt?.stok ?? null,
      harga_jual: opt?.harga_awal ? parseFloat(opt.harga_awal) : newItems[idx].harga_jual,
      kode_barang: opt?.kode_barang || "",
      nama_barang: opt?.nama_barang || "",
      satuan: opt?.satuan || "Pcs",
    };
    setPenjualanItems(newItems);
  };

  const totalPenjualan = penjualanItems.reduce(
    (sum, item) => sum + (item.jumlah * item.harga_jual),
    0
  );

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (penjualanItems.some((i) => !i.barang_id || i.jumlah <= 0 || i.harga_jual <= 0)) {
      alert("Lengkapi semua item penjualan");
      return;
    }
    setCreateLoading(true);
    try {
      await api.post("/persediaan/penjualan", {
        tanggal: formPenjualan.tanggal,
        deskripsi: formPenjualan.deskripsi || "Penjualan Waserda",
        anggota_id: formPenjualan.anggota_id || null,
        metode: formPenjualan.metode || "tunai",
        items: penjualanItems.map((i) => ({
          barang_id: i.barang_id,
          jumlah: i.jumlah,
          harga_jual: i.harga_jual,
        })),
      });
      setCreateModalOpen(false);
      resetCreateForm();
      fetchData(pagination.page, appliedSearch, appliedMulai, appliedSelesai);
    } catch (err) {
      alert(err.response?.data?.message || "Gagal mencatat penjualan");
    } finally {
      setCreateLoading(false);
    }
  };

  const resetCreateForm = () => {
    setPenjualanItems([
      { barang_id: "", barang_label: "", stok: null, jumlah: 1, harga_jual: 0 },
    ]);
    setFormPenjualan({
      tanggal: new Date().toISOString().slice(0, 10),
      deskripsi: "",
      anggota_id: "",
      anggota_label: "",
      metode: "tunai",
    });
  };

  // Edit
  const openEditModal = (item) => {
    setEditingId(item.id);
    setEditForm({
      tanggal: item.tanggal?.slice(0, 10) || "",
      deskripsi: item.deskripsi || "",
    });
    const items = (item.penjualanBarang || []).map((b) => ({
      barang_id: b.barang_id || "",
      barang_label: b.kode_barang
        ? `${b.kode_barang} - ${b.nama_barang}`
        : b.nama_barang || "",
      stok: null,
      jumlah: b.penjualan_pcs || 1,
      harga_jual: b.harga_penjualan || 0,
      kode_barang: b.kode_barang || "",
      nama_barang: b.nama_barang || "",
      satuan: b.satuan || "Pcs",
    }));
    setEditItems(
      items.length > 0
        ? items
        : [{ barang_id: "", barang_label: "", stok: null, jumlah: 1, harga_jual: 0 }]
    );
    setEditError("");
    setEditModalOpen(true);
  };

  const addEditItem = () => {
    setEditItems([
      ...editItems,
      { barang_id: "", barang_label: "", stok: null, jumlah: 1, harga_jual: 0 },
    ]);
  };

  const removeEditItem = (idx) => {
    if (editItems.length <= 1) return;
    setEditItems(editItems.filter((_, i) => i !== idx));
  };

  const updateEditItem = (idx, field, value) => {
    const newItems = [...editItems];
    newItems[idx][field] = value;
    setEditItems(newItems);
  };

  const handleEditBarangSelect = (idx, opt) => {
    const newItems = [...editItems];
    newItems[idx] = {
      ...newItems[idx],
      barang_id: opt?.value || "",
      barang_label: opt?.label || "",
      stok: opt?.stok ?? null,
      harga_jual: opt?.harga_awal ? parseFloat(opt.harga_awal) : newItems[idx].harga_jual,
      kode_barang: opt?.kode_barang || "",
      nama_barang: opt?.nama_barang || "",
      satuan: opt?.satuan || "Pcs",
    };
    setEditItems(newItems);
  };

  const totalEditPenjualan = editItems.reduce(
    (sum, item) => sum + (item.jumlah * item.harga_jual),
    0
  );

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (editItems.some((i) => !i.barang_id || i.jumlah <= 0 || i.harga_jual <= 0)) {
      setEditError("Lengkapi semua item penjualan");
      return;
    }
    setEditError("");
    setEditLoading(true);
    try {
      await api.put(`/persediaan/penjualan/${editingId}`, {
        tanggal: editForm.tanggal,
        deskripsi: editForm.deskripsi,
        items: editItems.map((i) => ({
          barang_id: i.barang_id,
          jumlah: i.jumlah,
          harga_jual: i.harga_jual,
        })),
      });
      setEditModalOpen(false);
      fetchData(pagination.page, appliedSearch, appliedMulai, appliedSelesai);
    } catch (err) {
      setEditError(err.response?.data?.message || "Terjadi kesalahan.");
    } finally {
      setEditLoading(false);
    }
  };

  // Detail
  const openDetail = (item) => {
    setSelectedItem(item);
    setDetailModalOpen(true);
  };

  // Hapus
  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await api.delete(`/persediaan/penjualan/${deleteId}`);
      setDeleteId(null);
      fetchData(pagination.page, appliedSearch, appliedMulai, appliedSelesai);
    } catch (err) {
      alert(err.response?.data?.message || "Gagal menghapus penjualan");
    } finally {
      setDeleteLoading(false);
    }
  };

  // ─── Export ──────────────────────────────────────────────────
  const handleExport = async (type) => {
    setExporting(true);
    try {
      const params = {
        unit_usaha: "Waserda",
      };
      if (appliedSearch) params.search = appliedSearch;
      if (appliedMulai) params.tanggal_mulai = appliedMulai;
      if (appliedSelesai) params.tanggal_selesai = appliedSelesai;

      const endpoint =
        type === "excel" ? "/transaksi/export-excel" : "/transaksi/export-pdf";
      const response = await api.get(endpoint, {
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
      link.download = `penjualan-${new Date().toISOString().slice(0, 10)}.${
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
              <h2 className="text-xl font-semibold text-gray-800">Penjualan Toko</h2>
              <p className="text-sm text-gray-500">Daftar transaksi penjualan Waserda</p>
            </div>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={16} /> Tambah Penjualan
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <DollarSign size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Total Penjualan</p>
                <p className="text-2xl font-bold text-gray-800">
                  Rp {formatRupiah(summary.totalPenjualan)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-amber-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Calendar size={20} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Hari Ini</p>
                <p className="text-2xl font-bold text-gray-800">
                  Rp {formatRupiah(summary.totalHariIni)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-purple-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Package size={20} className="text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Jumlah Transaksi</p>
                <p className="text-2xl font-bold text-gray-800">
                  {summary.totalTransaksi}
                </p>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Cari</label>
                      <input
                        type="text"
                        placeholder="No. transaksi / deskripsi..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tanggal Mulai</label>
                      <input
                        type="date"
                        value={tanggalMulai}
                        onChange={(e) => setTanggalMulai(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tanggal Selesai</label>
                      <input
                        type="date"
                        value={tanggalSelesai}
                        onChange={(e) => setTanggalSelesai(e.target.value)}
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
                Cari transaksi
              </label>
              <input
                type="text"
                placeholder="Ketik no. transaksi atau deskripsi..."
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
          {(appliedSearch || appliedMulai || appliedSelesai) && (
            <p className="mt-3 text-sm text-gray-500">
              Menampilkan hasil untuk:{" "}
              {appliedSearch && <span className="font-medium">"{appliedSearch}"</span>}
              {appliedMulai && <span className="font-medium"> dari {appliedMulai}</span>}
              {appliedSelesai && <span className="font-medium"> sampai {appliedSelesai}</span>}
            </p>
          )}
        </div>

        {/* ─── TABEL ─── */}
        <div className="hidden overflow-x-auto rounded-xl bg-white shadow-sm border border-gray-100 lg:block">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 text-center">NO</th>
                <th className="px-4 py-3">NO. TRANSAKSI</th>
                <th className="px-4 py-3">TANGGAL</th>
                <th className="px-4 py-3">DESKRIPSI</th>
                <th className="px-4 py-3 text-right">TOTAL</th>
                <th className="px-4 py-3 text-center">ITEM</th>
                <th className="px-4 py-3 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-6 text-center text-gray-400">
                    <Loader className="animate-spin inline-block mr-2" size={20} /> Memuat...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-6 text-center text-gray-400">
                    Belum ada transaksi penjualan.
                  </td>
                </tr>
              ) : (
                data.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-center text-sm">
                      {(pagination.page - 1) * 10 + idx + 1}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono font-medium text-blue-600">
                      {item.no_transaksi}
                    </td>
                    <td className="px-4 py-3 text-sm">{item.tanggal}</td>
                    <td className="px-4 py-3 text-sm max-w-xs truncate">
                      {item.deskripsi}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-right text-green-600">
                      Rp {formatRupiah(item.jumlah)}
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {item.penjualanBarang?.length || 0}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openDetail(item)}
                          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
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

        {/* ─── MOBILE ─── */}
        <div className="space-y-3 lg:hidden">
          {loading ? (
            <div className="text-center py-8 text-gray-400">
              <Loader className="animate-spin inline-block mr-2" size={20} /> Memuat...
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              Belum ada transaksi penjualan.
            </div>
          ) : (
            data.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl shadow-sm p-4 space-y-2 border border-gray-100"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono font-bold text-blue-600 text-sm">
                      {item.no_transaksi}
                    </p>
                    <p className="text-gray-800 font-medium">{item.deskripsi}</p>
                  </div>
                  <span className="text-sm font-bold text-green-600">
                    Rp {formatRupiah(item.jumlah)}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>{item.tanggal}</span>
                  <span>{item.penjualanBarang?.length || 0} item</span>
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <button
                    onClick={() => openDetail(item)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 bg-gray-50 text-gray-600 rounded-lg text-sm hover:bg-gray-100"
                  >
                    <Eye size={14} /> Detail
                  </button>
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
            ))
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

      {/* ─── MODAL TAMBAH (FULL LAYAR MODERN) ─── */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4 bg-gradient-to-r from-blue-50 to-white flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <ShoppingCart size={22} className="text-blue-600" />
              Tambah Penjualan
            </h3>
            <button
              onClick={() => setCreateModalOpen(false)}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X size={22} />
            </button>
          </div>

          {/* Body - Scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-6 bg-gray-50">
            <form className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tanggal</label>
                    <input
                      type="date"
                      value={formPenjualan.tanggal}
                      onChange={(e) =>
                        setFormPenjualan({ ...formPenjualan, tanggal: e.target.value })
                      }
                      className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Metode</label>
                    <select
                      value={formPenjualan.metode}
                      onChange={(e) =>
                        setFormPenjualan({ ...formPenjualan, metode: e.target.value })
                      }
                      className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value="tunai">Tunai</option>
                      <option value="transfer">Transfer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Anggota (opsional)</label>
                    <AsyncSelect
                      cacheOptions
                      loadOptions={loadAnggotaOptions}
                      value={
                        formPenjualan.anggota_id
                          ? { value: formPenjualan.anggota_id, label: formPenjualan.anggota_label }
                          : null
                      }
                      onChange={(opt) =>
                        setFormPenjualan({
                          ...formPenjualan,
                          anggota_id: opt?.value || "",
                          anggota_label: opt?.label || "",
                        })
                      }
                      placeholder="Cari anggota..."
                      isClearable
                      noOptionsMessage={({ inputValue }) =>
                        inputValue.length < 2 ? "Ketik minimal 2 huruf..." : "Anggota tidak ditemukan"
                      }
                      styles={{
                        control: (base) => ({ ...base, minHeight: 42, borderRadius: 8 }),
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Deskripsi</label>
                  <input
                    type="text"
                    placeholder="Deskripsi penjualan..."
                    value={formPenjualan.deskripsi}
                    onChange={(e) =>
                      setFormPenjualan({ ...formPenjualan, deskripsi: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-medium text-gray-700">Item Penjualan</label>
                  <button
                    type="button"
                    onClick={addPenjualanItem}
                    className="flex items-center gap-1.5 text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition"
                  >
                    <Plus size={16} /> Tambah Barang
                  </button>
                </div>

                <div className="space-y-3">
                  {penjualanItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex flex-wrap items-end gap-3 p-4 border rounded-xl bg-gray-50/50 hover:bg-gray-50 transition"
                    >
                      <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Barang</label>
                        <AsyncSelect
                          cacheOptions
                          loadOptions={loadBarangOptions}
                          value={
                            item.barang_id
                              ? { value: item.barang_id, label: item.barang_label }
                              : null
                          }
                          onChange={(opt) => handleBarangSelect(idx, opt)}
                          placeholder="Cari barang..."
                          isClearable
                          noOptionsMessage={({ inputValue }) =>
                            inputValue.length < 2 ? "Ketik minimal 2 huruf..." : "Barang tidak ditemukan"
                          }
                          styles={{
                            control: (base) => ({ ...base, minHeight: 38, borderRadius: 8 }),
                          }}
                        />
                        {item.stok != null && (
                          <p className="text-xs text-gray-400 mt-1">Stok: {item.stok}</p>
                        )}
                      </div>
                      <div className="w-20">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Jml</label>
                        <input
                          type="number"
                          min="1"
                          value={item.jumlah}
                          onChange={(e) =>
                            updatePenjualanItem(idx, "jumlah", parseInt(e.target.value) || 1)
                          }
                          className="w-full rounded-lg border px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div className="w-36">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Harga Jual</label>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={item.harga_jual}
                          onChange={(e) =>
                            updatePenjualanItem(idx, "harga_jual", parseFloat(e.target.value) || 0)
                          }
                          className="w-full rounded-lg border px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          Rp {formatRupiah(item.harga_jual)}
                        </p>
                      </div>
                      {item.barang_id && (
                        <div className="w-full basis-full text-xs text-gray-500 pt-1 border-t mt-1">
                          Subtotal: <span className="font-medium text-gray-700">Rp {formatRupiah(item.jumlah * item.harga_jual)}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removePenjualanItem(idx)}
                        className="mb-0.5 p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                        disabled={penjualanItems.length <= 1}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center mt-6 pt-4 border-t">
                  <span className="text-sm font-medium text-gray-700">Total Penjualan</span>
                  <span className="text-2xl font-bold text-green-600">
                    Rp {formatRupiah(totalPenjualan)}
                  </span>
                </div>
              </div>
            </form>
          </div>

          {/* Footer - Sticky */}
          <div className="flex justify-end gap-3 border-t px-6 py-4 bg-white flex-shrink-0 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-6 py-2.5 border rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              onClick={handleCreateSubmit}
              disabled={createLoading}
              className="px-6 py-2.5 bg-green-600 text-white rounded-xl text-sm hover:bg-green-700 disabled:opacity-60 flex items-center gap-2 transition"
            >
              {createLoading ? (
                <>
                  <Loader size={18} className="animate-spin" /> Menyimpan...
                </>
              ) : (
                "Simpan Penjualan"
              )}
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL EDIT (FULL LAYAR MODERN) ─── */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4 bg-gradient-to-r from-amber-50 to-white flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Pencil size={22} className="text-amber-600" />
              Edit Penjualan
            </h3>
            <button
              onClick={() => setEditModalOpen(false)}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X size={22} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-6 bg-gray-50">
            {editError && (
              <div className="max-w-4xl mx-auto mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm flex items-center gap-2 border border-red-200">
                <AlertCircle size={18} /> {editError}
              </div>
            )}
            <form className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tanggal</label>
                    <input
                      type="date"
                      value={editForm.tanggal}
                      onChange={(e) => setEditForm({ ...editForm, tanggal: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Deskripsi</label>
                    <input
                      type="text"
                      value={editForm.deskripsi}
                      onChange={(e) => setEditForm({ ...editForm, deskripsi: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-medium text-gray-700">Item Penjualan</label>
                  <button
                    type="button"
                    onClick={addEditItem}
                    className="flex items-center gap-1.5 text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition"
                  >
                    <Plus size={16} /> Tambah Barang
                  </button>
                </div>

                <div className="bg-amber-50 rounded-xl px-4 py-3 mb-4 flex items-start gap-2 border border-amber-200">
                  <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700">
                    Mengubah barang/jumlah/harga di sini akan otomatis menyesuaikan stok
                    (mengembalikan stok lama, lalu memotong sesuai perubahan).
                  </p>
                </div>

                <div className="space-y-3">
                  {editItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex flex-wrap items-end gap-3 p-4 border rounded-xl bg-gray-50/50 hover:bg-gray-50 transition"
                    >
                      <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Barang</label>
                        <AsyncSelect
                          cacheOptions
                          loadOptions={loadBarangOptions}
                          value={
                            item.barang_id
                              ? { value: item.barang_id, label: item.barang_label }
                              : null
                          }
                          onChange={(opt) => handleEditBarangSelect(idx, opt)}
                          placeholder="Cari barang..."
                          isClearable
                          noOptionsMessage={({ inputValue }) =>
                            inputValue.length < 2 ? "Ketik minimal 2 huruf..." : "Barang tidak ditemukan"
                          }
                          styles={{
                            control: (base) => ({ ...base, minHeight: 38, borderRadius: 8 }),
                          }}
                        />
                        {item.stok != null && (
                          <p className="text-xs text-gray-400 mt-1">Stok saat ini: {item.stok}</p>
                        )}
                      </div>
                      <div className="w-20">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Jml</label>
                        <input
                          type="number"
                          min="1"
                          value={item.jumlah}
                          onChange={(e) =>
                            updateEditItem(idx, "jumlah", parseInt(e.target.value) || 1)
                          }
                          className="w-full rounded-lg border px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                        />
                      </div>
                      <div className="w-36">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Harga Jual</label>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={item.harga_jual}
                          onChange={(e) =>
                            updateEditItem(idx, "harga_jual", parseFloat(e.target.value) || 0)
                          }
                          className="w-full rounded-lg border px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          Rp {formatRupiah(item.harga_jual)}
                        </p>
                      </div>
                      {item.barang_id && (
                        <div className="w-full basis-full text-xs text-gray-500 pt-1 border-t mt-1">
                          Subtotal: <span className="font-medium text-gray-700">Rp {formatRupiah(item.jumlah * item.harga_jual)}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeEditItem(idx)}
                        className="mb-0.5 p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                        disabled={editItems.length <= 1}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center mt-6 pt-4 border-t">
                  <span className="text-sm font-medium text-gray-700">Total Penjualan</span>
                  <span className="text-2xl font-bold text-green-600">
                    Rp {formatRupiah(totalEditPenjualan)}
                  </span>
                </div>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t px-6 py-4 bg-white flex-shrink-0 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="px-6 py-2.5 border rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              onClick={handleEditSubmit}
              disabled={editLoading}
              className="px-6 py-2.5 bg-amber-600 text-white rounded-xl text-sm hover:bg-amber-700 disabled:opacity-60 flex items-center gap-2 transition"
            >
              {editLoading ? (
                <>
                  <Loader size={18} className="animate-spin" /> Menyimpan...
                </>
              ) : (
                "Simpan Perubahan"
              )}
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL DETAIL (FULL LAYAR MODERN) ─── */}
      {detailModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4 bg-gradient-to-r from-indigo-50 to-white flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Eye size={22} className="text-indigo-600" />
              Detail Penjualan
            </h3>
            <button
              onClick={() => setDetailModalOpen(false)}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X size={22} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-6 bg-gray-50">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-gray-500 font-medium">No. Transaksi</p>
                    <p className="mt-1 font-semibold font-mono text-blue-600">{selectedItem.no_transaksi}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-gray-500 font-medium">Tanggal</p>
                    <p className="mt-1 font-semibold">{selectedItem.tanggal}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-gray-500 font-medium">Total</p>
                    <p className="mt-1 font-semibold text-green-600 text-lg">
                      Rp {formatRupiah(selectedItem.jumlah)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-gray-500 font-medium">Jumlah Item</p>
                    <p className="mt-1 font-semibold">{selectedItem.penjualanBarang?.length || 0}</p>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-4">
                    <p className="text-xs uppercase tracking-wider text-gray-500 font-medium">Deskripsi</p>
                    <p className="mt-1">{selectedItem.deskripsi || "-"}</p>
                  </div>
                  {selectedItem.anggota && (
                    <div className="sm:col-span-2 lg:col-span-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-medium">Anggota</p>
                      <p className="mt-1 font-medium">{selectedItem.anggota}</p>
                    </div>
                  )}
                </div>
              </div>

              {selectedItem.penjualanBarang?.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <div className="border-b px-6 py-4 bg-gray-50/50">
                    <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                      <Package size={18} className="text-gray-500" />
                      Daftar Barang
                    </h4>
                  </div>
                  <div className="divide-y">
                    {selectedItem.penjualanBarang.map((b) => (
                      <div key={b.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition">
                        <div>
                          <p className="font-medium text-gray-800">{b.nama_barang}</p>
                          <p className="mt-0.5 text-sm text-gray-500">
                            {b.penjualan_pcs} {b.satuan} × Rp {formatRupiah(b.harga_penjualan)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600">
                            Rp {formatRupiah(b.penjualan_pcs * b.harga_penjualan)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t px-6 py-4 bg-gray-50/50 flex justify-end">
                    <span className="text-sm font-medium text-gray-600 mr-8">Total</span>
                    <span className="text-lg font-bold text-green-600">
                      Rp {formatRupiah(selectedItem.jumlah)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t px-6 py-4 bg-white flex-shrink-0 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
            <button
              onClick={() => setDetailModalOpen(false)}
              className="px-6 py-2.5 border rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* ─── KONFIRMASI HAPUS ─── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} className="text-red-600" />
            </div>
            <h4 className="text-lg font-semibold text-gray-800">Hapus Penjualan</h4>
            <p className="text-sm text-gray-500 mt-1">
              Stok akan dikembalikan secara otomatis.
            </p>
            <p className="text-sm text-gray-600 mt-4 font-medium">Apakah Anda yakin?</p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2.5 border rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2 transition"
              >
                {deleteLoading ? (
                  <>
                    <Loader size={16} className="animate-spin" /> Memproses...
                  </>
                ) : (
                  "Hapus"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}