// src/pages/TokoPembelianPage.jsx
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
  Truck,
} from "lucide-react";

function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default function TokoPembelianPage() {
  // ─── State ──────────────────────────────────────────────────
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    totalPembelian: 0,
    totalHariIni: 0,
    totalTransaksi: 0,
  });

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
  const [editForm, setEditForm] = useState({
    tanggal: "",
    deskripsi: "",
    supplier: "",
    no_faktur: "",
    metode: "tunai",
  });
  const [editItem, setEditItem] = useState({
    barang_id: "",
    barang_label: "",
    stok: null,
    jumlah: 1,
    harga_beli: 0,
  });
  const [selectedItem, setSelectedItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ─── Form Tambah Pembelian ──────────────────────────────────
  const [formPembelian, setFormPembelian] = useState({
    tanggal: new Date().toISOString().slice(0, 10),
    deskripsi: "",
    supplier: "",
    no_faktur: "",
    metode: "tunai",
    barang_id: "",
    barang_label: "",
    stok: null,
    jumlah: 1,
    harga_beli: 0,
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

        const { data } = await api.get("/persediaan/pembelian", { params });
        setData(data.data || []);
        setPagination(data.pagination || { page: 1, total_pages: 1, total: 0 });
        setSummary(
          data.summary || { totalPembelian: 0, totalHariIni: 0, totalTransaksi: 0 }
        );
      } catch (err) {
        console.error("Gagal fetch data pembelian:", err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchData(1, "", "", "");
  }, []);

  // ─── Autocomplete ────────────────────────────────────────────
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
  const handleBarangSelect = (opt) => {
    setFormPembelian({
      ...formPembelian,
      barang_id: opt?.value || "",
      barang_label: opt?.label || "",
      stok: opt?.stok ?? null,
      harga_beli: opt?.harga_awal ? parseFloat(opt.harga_awal) : formPembelian.harga_beli,
      kode_barang: opt?.kode_barang || "",
      nama_barang: opt?.nama_barang || "",
      satuan: opt?.satuan || "Pcs",
    });
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formPembelian.barang_id || formPembelian.jumlah <= 0 || formPembelian.harga_beli <= 0) {
      alert("Lengkapi data pembelian");
      return;
    }
    setCreateLoading(true);
    try {
      await api.post("/persediaan/pembelian", {
        barang_id: formPembelian.barang_id,
        jumlah: formPembelian.jumlah,
        harga_beli: formPembelian.harga_beli,
        tanggal: formPembelian.tanggal,
        supplier: formPembelian.supplier,
        no_faktur: formPembelian.no_faktur,
        keterangan: formPembelian.deskripsi,
        metode: formPembelian.metode,
      });
      setCreateModalOpen(false);
      resetCreateForm();
      fetchData(pagination.page, appliedSearch, appliedMulai, appliedSelesai);
    } catch (err) {
      alert(err.response?.data?.message || "Gagal mencatat pembelian");
    } finally {
      setCreateLoading(false);
    }
  };

  const resetCreateForm = () => {
    setFormPembelian({
      tanggal: new Date().toISOString().slice(0, 10),
      deskripsi: "",
      supplier: "",
      no_faktur: "",
      metode: "tunai",
      barang_id: "",
      barang_label: "",
      stok: null,
      jumlah: 1,
      harga_beli: 0,
    });
  };

  // Edit
  const openEditModal = (item) => {
    setEditingId(item.id);
    setEditForm({
      tanggal: item.tanggal?.slice(0, 10) || "",
      deskripsi: item.deskripsi || "",
      supplier: item.supplier || "",
      no_faktur: item.no_faktur || "",
      metode: item.metode || "tunai",
    });
    setEditItem({
      barang_id: item.barang_id || "",
      barang_label: item.kode_barang
        ? `${item.kode_barang} - ${item.nama_barang}`
        : item.nama_barang || "",
      stok: null,
      jumlah: item.jumlah_barang || 1,
      harga_beli: item.harga_beli || 0,
      kode_barang: item.kode_barang || "",
      nama_barang: item.nama_barang || "",
      satuan: item.satuan || "Pcs",
    });
    setEditError("");
    setEditModalOpen(true);
  };

  const handleEditBarangSelect = (opt) => {
    setEditItem({
      ...editItem,
      barang_id: opt?.value || "",
      barang_label: opt?.label || "",
      stok: opt?.stok ?? null,
      harga_beli: opt?.harga_awal ? parseFloat(opt.harga_awal) : editItem.harga_beli,
      kode_barang: opt?.kode_barang || "",
      nama_barang: opt?.nama_barang || "",
      satuan: opt?.satuan || "Pcs",
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editItem.barang_id || editItem.jumlah <= 0 || editItem.harga_beli <= 0) {
      setEditError("Lengkapi data pembelian");
      return;
    }
    setEditError("");
    setEditLoading(true);
    try {
      await api.put(`/persediaan/pembelian/${editingId}`, {
        barang_id: editItem.barang_id,
        jumlah: editItem.jumlah,
        harga_beli: editItem.harga_beli,
        tanggal: editForm.tanggal,
        supplier: editForm.supplier,
        no_faktur: editForm.no_faktur,
        keterangan: editForm.deskripsi,
        metode: editForm.metode,
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
      await api.delete(`/persediaan/pembelian/${deleteId}`);
      setDeleteId(null);
      fetchData(pagination.page, appliedSearch, appliedMulai, appliedSelesai);
    } catch (err) {
      alert(err.response?.data?.message || "Gagal menghapus pembelian");
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
      link.download = `pembelian-${new Date().toISOString().slice(0, 10)}.${
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
              <h2 className="text-xl font-semibold text-gray-800">Pembelian Toko</h2>
              <p className="text-sm text-gray-500">Daftar transaksi pembelian Waserda</p>
            </div>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={16} /> Tambah Pembelian
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
                <p className="text-xs text-gray-500 uppercase">Total Pembelian</p>
                <p className="text-2xl font-bold text-gray-800">
                  Rp {formatRupiah(summary.totalPembelian)}
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
                <th className="px-4 py-3">SUPPLIER</th>
                <th className="px-4 py-3">BARANG</th>
                <th className="px-4 py-3 text-right">JUMLAH</th>
                <th className="px-4 py-3 text-right">TOTAL</th>
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
                    Belum ada transaksi pembelian.
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
                    <td className="px-4 py-3 text-sm">{item.supplier || "-"}</td>
                    <td className="px-4 py-3 text-sm">{item.nama_barang || "-"}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      {item.jumlah_barang || item.jumlah || 0}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-right text-green-600">
                      Rp {formatRupiah(item.total || item.jumlah)}
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
              Belum ada transaksi pembelian.
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
                    Rp {formatRupiah(item.total || item.jumlah)}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>{item.tanggal}</span>
                  <span>{item.supplier || "-"}</span>
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

      {/* ─── MODAL TAMBAH (Full Layar) ─── */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4 bg-gray-50 flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Truck size={20} className="text-blue-600" />
              Tambah Pembelian
            </h3>
            <button
              onClick={() => setCreateModalOpen(false)}
              className="p-2 hover:bg-gray-200 rounded-lg transition"
            >
              <X size={22} />
            </button>
          </div>

          {/* Body - Scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <form onSubmit={handleCreateSubmit} className="max-w-4xl mx-auto space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tanggal</label>
                  <input
                    type="date"
                    value={formPembelian.tanggal}
                    onChange={(e) =>
                      setFormPembelian({ ...formPembelian, tanggal: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Metode</label>
                  <select
                    value={formPembelian.metode}
                    onChange={(e) =>
                      setFormPembelian({ ...formPembelian, metode: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="tunai">Tunai</option>
                    <option value="kredit">Kredit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">No. Faktur</label>
                  <input
                    type="text"
                    placeholder="Faktur..."
                    value={formPembelian.no_faktur}
                    onChange={(e) =>
                      setFormPembelian({ ...formPembelian, no_faktur: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Supplier</label>
                  <input
                    type="text"
                    placeholder="Nama supplier..."
                    value={formPembelian.supplier}
                    onChange={(e) =>
                      setFormPembelian({ ...formPembelian, supplier: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Deskripsi</label>
                  <input
                    type="text"
                    placeholder="Deskripsi pembelian..."
                    value={formPembelian.deskripsi}
                    onChange={(e) =>
                      setFormPembelian({ ...formPembelian, deskripsi: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Detail Barang</p>
                <div className="flex flex-wrap items-end gap-3 p-3 border rounded-lg bg-gray-50">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs text-gray-500">Pilih Barang</label>
                    <AsyncSelect
                      cacheOptions
                      loadOptions={loadBarangOptions}
                      value={
                        formPembelian.barang_id
                          ? { value: formPembelian.barang_id, label: formPembelian.barang_label }
                          : null
                      }
                      onChange={handleBarangSelect}
                      placeholder="Ketik kode / nama barang..."
                      isClearable
                      noOptionsMessage={({ inputValue }) =>
                        inputValue.length < 2 ? "Ketik minimal 2 huruf..." : "Barang tidak ditemukan"
                      }
                      styles={{
                        control: (base) => ({ ...base, minHeight: 38 }),
                      }}
                    />
                    {formPembelian.stok != null && (
                      <p className="text-xs text-gray-400 mt-0.5">Stok saat ini: {formPembelian.stok}</p>
                    )}
                  </div>
                  <div className="w-20">
                    <label className="block text-xs text-gray-500">Jml</label>
                    <input
                      type="number"
                      min="1"
                      value={formPembelian.jumlah}
                      onChange={(e) =>
                        setFormPembelian({ ...formPembelian, jumlah: parseInt(e.target.value) || 1 })
                      }
                      className="w-full rounded border px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-xs text-gray-500">Harga Beli</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={formPembelian.harga_beli}
                      onChange={(e) =>
                        setFormPembelian({ ...formPembelian, harga_beli: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full rounded border px-2 py-1 text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-0.5">
                      Rp {formatRupiah(formPembelian.harga_beli)}
                    </p>
                  </div>
                </div>

                {formPembelian.barang_id && (
                  <div className="flex justify-between items-center mt-4 border-t pt-4">
                    <span className="text-sm font-medium text-gray-700">Total Pembelian</span>
                    <span className="text-xl font-bold text-green-600">
                      Rp {formatRupiah(formPembelian.jumlah * formPembelian.harga_beli)}
                    </span>
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* Footer - Sticky */}
          <div className="flex justify-end gap-2 border-t px-6 py-4 bg-gray-50 flex-shrink-0">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-5 py-2.5 border rounded-lg text-sm text-gray-700 hover:bg-gray-100"
            >
              Batal
            </button>
            <button
              type="submit"
              onClick={handleCreateSubmit}
              disabled={createLoading}
              className="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-60 flex items-center gap-2"
            >
              {createLoading ? (
                <>
                  <Loader size={16} className="animate-spin" /> Menyimpan...
                </>
              ) : (
                "Simpan Pembelian"
              )}
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL EDIT (Full Layar) ─── */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4 bg-gray-50 flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Pencil size={20} className="text-blue-600" />
              Edit Pembelian
            </h3>
            <button
              onClick={() => setEditModalOpen(false)}
              className="p-2 hover:bg-gray-200 rounded-lg transition"
            >
              <X size={22} />
            </button>
          </div>

          {/* Body - Scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {editError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle size={18} /> {editError}
              </div>
            )}
            <form onSubmit={handleEditSubmit} className="max-w-4xl mx-auto space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tanggal</label>
                  <input
                    type="date"
                    value={editForm.tanggal}
                    onChange={(e) => setEditForm({ ...editForm, tanggal: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Metode</label>
                  <select
                    value={editForm.metode}
                    onChange={(e) => setEditForm({ ...editForm, metode: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="tunai">Tunai</option>
                    <option value="kredit">Kredit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">No. Faktur</label>
                  <input
                    type="text"
                    value={editForm.no_faktur}
                    onChange={(e) => setEditForm({ ...editForm, no_faktur: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Supplier</label>
                  <input
                    type="text"
                    value={editForm.supplier}
                    onChange={(e) => setEditForm({ ...editForm, supplier: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Deskripsi</label>
                  <input
                    type="text"
                    value={editForm.deskripsi}
                    onChange={(e) => setEditForm({ ...editForm, deskripsi: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Detail Barang</p>
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-3 flex items-start gap-1.5">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                  Mengubah barang/jumlah/harga di sini akan otomatis menyesuaikan stok
                  (mengembalikan stok lama, lalu menambahkan sesuai perubahan).
                </p>

                <div className="flex flex-wrap items-end gap-3 p-3 border rounded-lg bg-gray-50">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs text-gray-500">Pilih Barang</label>
                    <AsyncSelect
                      cacheOptions
                      loadOptions={loadBarangOptions}
                      value={
                        editItem.barang_id
                          ? { value: editItem.barang_id, label: editItem.barang_label }
                          : null
                      }
                      onChange={handleEditBarangSelect}
                      placeholder="Ketik kode / nama barang..."
                      isClearable
                      noOptionsMessage={({ inputValue }) =>
                        inputValue.length < 2 ? "Ketik minimal 2 huruf..." : "Barang tidak ditemukan"
                      }
                      styles={{
                        control: (base) => ({ ...base, minHeight: 38 }),
                      }}
                    />
                    {editItem.stok != null && (
                      <p className="text-xs text-gray-400 mt-0.5">Stok saat ini: {editItem.stok}</p>
                    )}
                  </div>
                  <div className="w-20">
                    <label className="block text-xs text-gray-500">Jml</label>
                    <input
                      type="number"
                      min="1"
                      value={editItem.jumlah}
                      onChange={(e) =>
                        setEditItem({ ...editItem, jumlah: parseInt(e.target.value) || 1 })
                      }
                      className="w-full rounded border px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-xs text-gray-500">Harga Beli</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={editItem.harga_beli}
                      onChange={(e) =>
                        setEditItem({ ...editItem, harga_beli: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full rounded border px-2 py-1 text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-0.5">
                      Rp {formatRupiah(editItem.harga_beli)}
                    </p>
                  </div>
                </div>

                {editItem.barang_id && (
                  <div className="flex justify-between items-center mt-4 border-t pt-4">
                    <span className="text-sm font-medium text-gray-700">Total Pembelian</span>
                    <span className="text-xl font-bold text-green-600">
                      Rp {formatRupiah(editItem.jumlah * editItem.harga_beli)}
                    </span>
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* Footer - Sticky */}
          <div className="flex justify-end gap-2 border-t px-6 py-4 bg-gray-50 flex-shrink-0">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="px-5 py-2.5 border rounded-lg text-sm text-gray-700 hover:bg-gray-100"
            >
              Batal
            </button>
            <button
              type="submit"
              onClick={handleEditSubmit}
              disabled={editLoading}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
            >
              {editLoading ? (
                <>
                  <Loader size={16} className="animate-spin" /> Menyimpan...
                </>
              ) : (
                "Simpan"
              )}
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL DETAIL (Full Layar) ─── */}
      {detailModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4 bg-gray-50 flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Eye size={20} className="text-blue-600" />
              Detail Pembelian
            </h3>
            <button
              onClick={() => setDetailModalOpen(false)}
              className="p-2 hover:bg-gray-200 rounded-lg transition"
            >
              <X size={22} />
            </button>
          </div>

          {/* Body - Scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="grid grid-cols-1 gap-4 rounded-xl border p-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">No. Transaksi</p>
                  <p className="mt-1 font-semibold">{selectedItem.no_transaksi}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Tanggal</p>
                  <p className="mt-1 font-semibold">{selectedItem.tanggal}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Total</p>
                  <p className="mt-1 font-semibold text-green-600">
                    Rp {formatRupiah(selectedItem.total || selectedItem.jumlah)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Metode</p>
                  <p className="mt-1 font-semibold capitalize">{selectedItem.metode || "Tunai"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Supplier</p>
                  <p className="mt-1">{selectedItem.supplier || "-"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">No. Faktur</p>
                  <p className="mt-1">{selectedItem.no_faktur || "-"}</p>
                </div>
                <div className="sm:col-span-2 lg:col-span-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Deskripsi</p>
                  <p className="mt-1">{selectedItem.deskripsi || "-"}</p>
                </div>
              </div>

              {selectedItem.nama_barang && (
                <div className="rounded-xl border">
                  <div className="border-b px-5 py-4">
                    <h4 className="font-semibold text-gray-800">Detail Barang</h4>
                  </div>
                  <div className="px-5 py-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{selectedItem.nama_barang}</p>
                        <p className="mt-1 text-sm text-gray-500">
                          {selectedItem.jumlah_barang || selectedItem.jumlah || 0} {selectedItem.satuan || "Pcs"} • @ Rp {formatRupiah(selectedItem.harga_beli || 0)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">
                          Rp {formatRupiah((selectedItem.jumlah_barang || selectedItem.jumlah || 0) * (selectedItem.harga_beli || 0))}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer - Sticky */}
          <div className="flex justify-end gap-2 border-t px-6 py-4 bg-gray-50 flex-shrink-0">
            <button
              onClick={() => setDetailModalOpen(false)}
              className="px-5 py-2.5 border rounded-lg text-sm text-gray-700 hover:bg-gray-100"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* ─── KONFIRMASI HAPUS ─── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full text-center shadow-xl">
            <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
            <p className="text-gray-700 font-medium">Yakin ingin menghapus pembelian ini?</p>
            <p className="text-sm text-gray-500 mt-1">Stok akan dikembalikan secara otomatis.</p>
            <div className="flex justify-center gap-3 mt-6">
              <button
                onClick={() => setDeleteId(null)}
                className="px-5 py-2.5 border rounded-lg text-sm text-gray-700 hover:bg-gray-100"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-60 flex items-center gap-2"
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