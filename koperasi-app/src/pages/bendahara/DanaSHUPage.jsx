// src/pages/bendahara/DanaSHUPage.jsx

import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";

import {
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  XCircle,
  CalendarDays,
  Wallet,
  TrendingUp,
  TrendingDown,
  FileText,
  FileSpreadsheet,
  Loader,
  AlertCircle,
  CheckCircle2,
  ArrowUpDown,
  Receipt,
} from "lucide-react";

// ============================================================
// HELPER
// ============================================================

function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString("id-ID");
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================
// PAGE
// ============================================================

export default function DanaSHUPage() {
  const { dana } = useParams();

  // ----------------------------------------------------------
  // STATE
  // ----------------------------------------------------------

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const [masterDana, setMasterDana] = useState([]);
  const [selectedDana, setSelectedDana] = useState(null);

  const [summary, setSummary] = useState({
    saldoAwal: 0,
    totalDebet: 0,
    totalKredit: 0,
    saldoAkhir: 0,
  });

  // Filter
  const [tanggalMulai, setTanggalMulai] = useState("");
  const [tanggalAkhir, setTanggalAkhir] = useState("");
  const [appliedTanggalMulai, setAppliedTanggalMulai] = useState("");
  const [appliedTanggalAkhir, setAppliedTanggalAkhir] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  // Modal Form
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [tanggal, setTanggal] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [debet, setDebet] = useState("");
  const [kredit, setKredit] = useState("");
  const [catatan, setCatatan] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Delete
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Export
  const [exporting, setExporting] = useState(false);

  // ----------------------------------------------------------
  // SLUG → KETERANGAN
  // ----------------------------------------------------------

  const slugToText = (slug) => {
    if (!slug) return "";
    return decodeURIComponent(slug)
      .replace(/-/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  // ----------------------------------------------------------
  // FETCH MASTER DANA SHU
  // ----------------------------------------------------------

  const fetchMasterDana = useCallback(async () => {
    try {
      // Gunakan endpoint yang sama dengan menu (tanpa parameter dana)
      const response = await api.get("/bendahara/dana-shu");
      const result = response.data;

      // Backend mengembalikan { success, menu, data, ... }
      const list = Array.isArray(result.menu)
        ? result.menu
        : Array.isArray(result.data)
        ? result.data
        : [];

      setMasterDana(list);

      const slug = dana?.toLowerCase();
      const found = list.find((item) => {
        const itemSlug = String(item.keterangan || "")
          .toLowerCase()
          .trim()
          .replace(/\s+/g, "-");
        return itemSlug === slug;
      });

      if (found) {
        setSelectedDana(found);
      } else if (slug) {
        setSelectedDana({
          id: null,
          keterangan: slugToText(slug),
          persentase: null,
        });
      }
    } catch (err) {
      console.error("Gagal mengambil master Dana SHU:", err);
      setSelectedDana({
        id: null,
        keterangan: slugToText(dana),
        persentase: null,
      });
    }
  }, [dana]);

  useEffect(() => {
    fetchMasterDana();
  }, [fetchMasterDana]);

  // ----------------------------------------------------------
  // FETCH DATA TRANSAKSI
  // ----------------------------------------------------------

  const fetchData = useCallback(async () => {
    if (!dana) return;

    setLoading(true);

    try {
      const params = { dana };
      if (appliedTanggalMulai) params.dari = appliedTanggalMulai;
      if (appliedTanggalAkhir) params.sampai = appliedTanggalAkhir;

      const response = await api.get("/bendahara/dana-shu", { params });
      const result = response.data;

      // Response memiliki properti transaksi, saldoAwal, totalDebet, dll.
      const rows = Array.isArray(result.transaksi)
        ? result.transaksi
        : Array.isArray(result.data)
        ? result.data
        : [];

      setData(rows);

      setSummary({
        saldoAwal: Number(result.saldoAwal) || 0,
        totalDebet: Number(result.totalDebet) || 0,
        totalKredit: Number(result.totalKredit) || 0,
        saldoAkhir: Number(result.saldoAkhir) || 0,
      });
    } catch (err) {
      console.error("Gagal mengambil data Dana SHU:", err);
      setData([]);
      setSummary({
        saldoAwal: 0,
        totalDebet: 0,
        totalKredit: 0,
        saldoAkhir: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [dana, appliedTanggalMulai, appliedTanggalAkhir]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ----------------------------------------------------------
  // FILTER
  // ----------------------------------------------------------

  const applyFilter = () => {
    setAppliedTanggalMulai(tanggalMulai);
    setAppliedTanggalAkhir(tanggalAkhir);
  };

  const resetFilter = () => {
    setTanggalMulai("");
    setTanggalAkhir("");
    setAppliedTanggalMulai("");
    setAppliedTanggalAkhir("");
  };

  // ----------------------------------------------------------
  // MODAL CREATE / EDIT
  // ----------------------------------------------------------

  const openCreateModal = () => {
    setEditingId(null);
    setTanggal(new Date().toISOString().slice(0, 10));
    setKeterangan("");
    setDebet("");
    setKredit("");
    setCatatan("");
    setError("");
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setTanggal(item.tanggal ? String(item.tanggal).slice(0, 10) : "");
    setKeterangan(item.keterangan || "");
    setDebet(item.debet !== null && item.debet !== undefined ? String(item.debet) : "");
    setKredit(item.kredit !== null && item.kredit !== undefined ? String(item.kredit) : "");
    setCatatan(item.catatan || "");
    setError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingId(null);
    setError("");
  };

  // ----------------------------------------------------------
  // SUBMIT (CREATE / UPDATE)
  // ----------------------------------------------------------

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!tanggal) {
      setError("Tanggal wajib diisi.");
      return;
    }

    const debetNum = parseFloat(debet) || 0;
    const kreditNum = parseFloat(kredit) || 0;

    if (debetNum < 0) {
      setError("Nilai debet tidak boleh negatif.");
      return;
    }
    if (kreditNum < 0) {
      setError("Nilai kredit tidak boleh negatif.");
      return;
    }
    if (debetNum === 0 && kreditNum === 0) {
      setError("Isi nilai debet atau kredit minimal salah satu.");
      return;
    }
    if (debetNum > 0 && kreditNum > 0) {
      setError("Debet dan kredit tidak boleh diisi bersamaan.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        tanggal,
        keterangan: keterangan.trim() || selectedDana?.keterangan || "",
        debet: debetNum,
        kredit: kreditNum,
        catatan: catatan.trim(),
      };

      if (editingId) {
        // PUT /bendahara/dana-shu/:dana/:id
        await api.put(`/bendahara/dana-shu/${dana}/${editingId}`, payload);
      } else {
        // POST /bendahara/dana-shu/:dana
        await api.post(`/bendahara/dana-shu/${dana}`, payload);
      }

      closeModal();
      fetchData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Terjadi kesalahan saat menyimpan data.");
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------------------------------------
  // DELETE
  // ----------------------------------------------------------

  const handleDelete = (item) => {
    setDeleteItem(item);
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);

    try {
      // DELETE /bendahara/dana-shu/:dana/:id
      await api.delete(`/bendahara/dana-shu/${dana}/${deleteItem.id}`);
      setDeleteItem(null);
      fetchData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Gagal menghapus transaksi.");
    } finally {
      setDeleting(false);
    }
  };

  // ----------------------------------------------------------
  // EXPORT
  // ----------------------------------------------------------

  const handleExport = async (type) => {
    setExporting(true);

    try {
      const params = { dana };
      if (appliedTanggalMulai) params.dari = appliedTanggalMulai;
      if (appliedTanggalAkhir) params.sampai = appliedTanggalAkhir;
      params.export = type;

      const response = await api.get("/bendahara/dana-shu/export", {
        params,
        responseType: "blob",
      });

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const extension = type === "excel" ? "xlsx" : "pdf";
      link.download = `Dana-SHU-${dana}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || `Gagal export ${type}.`);
    } finally {
      setExporting(false);
    }
  };

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

  const title = selectedDana?.keterangan || slugToText(dana);
  const persentase = selectedDana?.persentase;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                  <Wallet size={20} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
                  <p className="text-sm text-gray-500">
                    Pengelolaan dana SHU
                    {persentase !== null && persentase !== undefined ? ` • ${persentase}%` : ""}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <Plus size={16} />
              Tambah Transaksi
            </button>
          </div>
        </div>

        {/* SUMMARY */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SummaryCard
            label="Saldo Awal"
            value={`Rp ${formatRupiah(summary.saldoAwal)}`}
            icon={<Wallet size={18} className="text-blue-600" />}
            color="blue"
          />
          <SummaryCard
            label="Total Debet"
            value={`Rp ${formatRupiah(summary.totalDebet)}`}
            icon={<TrendingDown size={18} className="text-red-600" />}
            color="red"
          />
          <SummaryCard
            label="Total Kredit"
            value={`Rp ${formatRupiah(summary.totalKredit)}`}
            icon={<TrendingUp size={18} className="text-green-600" />}
            color="green"
          />
          <SummaryCard
            label="Saldo Akhir"
            value={`Rp ${formatRupiah(summary.saldoAkhir)}`}
            icon={<Wallet size={18} className="text-amber-600" />}
            color="amber"
          />
        </div>

        {/* FILTER & EXPORT */}
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="flex w-full items-center justify-between p-4 transition hover:bg-gray-50"
          >
            <span className="flex items-center gap-2 font-medium text-gray-700">
              <Search size={18} className="text-gray-500" />
              Filter & Export
            </span>
            <ArrowUpDown size={17} className="text-gray-400" />
          </button>

          {filterOpen && (
            <div className="border-t bg-gray-50 p-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Filter */}
                <div className="rounded-lg border bg-white p-4 lg:col-span-2">
                  <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-gray-500">
                    <CalendarDays size={14} />
                    Filter Periode
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-gray-500">Tanggal Mulai</label>
                      <input
                        type="date"
                        value={tanggalMulai}
                        onChange={(e) => setTanggalMulai(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-500">Tanggal Akhir</label>
                      <input
                        type="date"
                        value={tanggalAkhir}
                        onChange={(e) => setTanggalAkhir(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={applyFilter}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                    >
                      <Search size={15} />
                      Terapkan
                    </button>
                    <button
                      onClick={resetFilter}
                      className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                      <XCircle size={15} />
                      Reset
                    </button>
                  </div>
                </div>

                {/* Export */}
                <div className="rounded-lg border bg-white p-4">
                  <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-gray-500">
                    <FileText size={14} />
                    Export Laporan
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={exporting}
                      onClick={() => handleExport("excel")}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-60"
                    >
                      <FileSpreadsheet size={15} />
                      Excel
                    </button>
                    <button
                      disabled={exporting}
                      onClick={() => handleExport("pdf")}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      <FileText size={15} />
                      PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* INFO */}
        <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-blue-800">Dana {title}</p>
            <p className="mt-0.5 text-xs text-blue-700">
              Transaksi yang ditampilkan merupakan mutasi dana SHU untuk komponen ini.
              {persentase !== null && persentase !== undefined ? ` Persentase alokasi: ${persentase}%.` : ""}
            </p>
          </div>
        </div>

        {/* TABEL DESKTOP */}
        <div className="hidden overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm lg:block">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 text-center">NO</th>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Keterangan</th>
                <th className="px-4 py-3 text-right">Debet</th>
                <th className="px-4 py-3 text-right">Kredit</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3">Catatan</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-10 text-center text-gray-400">
                    <Loader size={20} className="mr-2 inline-block animate-spin" />
                    Memuat data...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-10 text-center text-gray-400">
                    <Receipt size={30} className="mx-auto mb-2 text-gray-300" />
                    Belum ada transaksi Dana SHU.
                  </td>
                </tr>
              ) : (
                data.map((item, index) => (
                  <tr key={item.id} className="transition hover:bg-gray-50">
                    <td className="px-4 py-3 text-center text-gray-500">{index + 1}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(item.tanggal)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{item.keterangan || "-"}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-red-600">
                      {Number(item.debet || 0) > 0 ? `Rp ${formatRupiah(item.debet)}` : "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-green-600">
                      {Number(item.kredit || 0) > 0 ? `Rp ${formatRupiah(item.kredit)}` : "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-gray-800">
                      Rp {formatRupiah(item.saldo)}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-gray-500">{item.catatan || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1.5">
                        <button
                          onClick={() => openEditModal(item)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 transition hover:bg-blue-50"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-50"
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
            {!loading && data.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td colSpan="3" className="px-4 py-3 text-right">
                    TOTAL
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-red-700">
                    Rp {formatRupiah(summary.totalDebet)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-green-700">
                    Rp {formatRupiah(summary.totalKredit)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-blue-700">
                    Rp {formatRupiah(summary.saldoAkhir)}
                  </td>
                  <td colSpan="2" className="px-4 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* MOBILE CARD */}
        <div className="space-y-3 lg:hidden">
          {loading ? (
            <div className="rounded-xl border border-gray-100 bg-white py-10 text-center text-gray-400 shadow-sm">
              <Loader size={20} className="mr-2 inline-block animate-spin" />
              Memuat data...
            </div>
          ) : data.length === 0 ? (
            <div className="rounded-xl border border-gray-100 bg-white py-10 text-center text-gray-400 shadow-sm">
              Belum ada transaksi.
            </div>
          ) : (
            data.map((item, index) => (
              <div key={item.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-400">
                      #{index + 1} • {formatDate(item.tanggal)}
                    </p>
                    <p className="mt-1 font-semibold text-gray-800">{item.keterangan || "-"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Saldo</p>
                    <p className="font-mono font-bold text-blue-700">Rp {formatRupiah(item.saldo)}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-red-50 p-2">
                    <p className="text-xs text-red-500">Debet</p>
                    <p className="font-mono text-sm font-semibold text-red-700">
                      Rp {formatRupiah(item.debet)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-green-50 p-2">
                    <p className="text-xs text-green-500">Kredit</p>
                    <p className="font-mono text-sm font-semibold text-green-700">
                      Rp {formatRupiah(item.kredit)}
                    </p>
                  </div>
                </div>
                {item.catatan && (
                  <div className="mt-3 border-t pt-3">
                    <p className="text-xs text-gray-400">Catatan</p>
                    <p className="mt-0.5 text-sm text-gray-600">{item.catatan}</p>
                  </div>
                )}
                <div className="mt-3 flex justify-end gap-1.5 border-t pt-3">
                  <button
                    onClick={() => openEditModal(item)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL FORM */}
      {/* ============================================================ */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  {editingId ? "Edit Transaksi Dana SHU" : "Tambah Transaksi Dana SHU"}
                </h3>
                <p className="mt-0.5 text-xs text-gray-400">Dana: {title}</p>
              </div>
              <button onClick={closeModal} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4 px-5 py-5">
                {error && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    {error}
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-sm text-gray-700">Dana SHU</label>
                  <div className="flex items-center justify-between rounded-lg border bg-gray-50 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Wallet size={16} className="text-blue-500" />
                      <span className="text-sm text-gray-700">{title}</span>
                    </div>
                    {persentase !== null && persentase !== undefined && (
                      <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                        {persentase}%
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-700">Tanggal</label>
                  <input
                    type="date"
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-700">Keterangan</label>
                  <input
                    type="text"
                    value={keterangan}
                    onChange={(e) => setKeterangan(e.target.value)}
                    placeholder="Contoh: Pembagian SHU tahun 2025"
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 flex items-center gap-1.5 text-sm text-gray-700">
                      <TrendingDown size={14} className="text-red-500" />
                      Debet
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={debet ? Number(debet).toLocaleString("id-ID") : ""}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^\d]/g, "");
                          setDebet(raw);
                          if (raw) setKredit("");
                        }}
                        placeholder="0"
                        className="w-full rounded-lg border px-3 py-2 pl-9 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 flex items-center gap-1.5 text-sm text-gray-700">
                      <TrendingUp size={14} className="text-green-500" />
                      Kredit
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={kredit ? Number(kredit).toLocaleString("id-ID") : ""}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^\d]/g, "");
                          setKredit(raw);
                          if (raw) setDebet("");
                        }}
                        placeholder="0"
                        className="w-full rounded-lg border px-3 py-2 pl-9 text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                      />
                    </div>
                  </div>
                </div>
                <p className="-mt-2 text-xs text-gray-400">Isi salah satu: Debet atau Kredit.</p>

                <div>
                  <label className="mb-1 block text-sm text-gray-700">Catatan</label>
                  <textarea
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    rows={3}
                    placeholder="Catatan transaksi..."
                    className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t px-5 py-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg border px-5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <Loader size={15} className="animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Plus size={15} />
                      Simpan
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL DELETE */}
      {/* ============================================================ */}
      {deleteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50">
                <Trash2 size={19} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Hapus Transaksi?</h3>
                <p className="mt-1 text-sm text-gray-500">Transaksi berikut akan dihapus:</p>
                <p className="mt-2 font-medium text-gray-800">
                  {deleteItem.keterangan || "Transaksi Dana SHU"}
                </p>
                <p className="text-sm text-gray-500">
                  {formatDate(deleteItem.tanggal)} {" • "}
                  {deleteItem.debet > 0
                    ? `Debet Rp ${formatRupiah(deleteItem.debet)}`
                    : `Kredit Rp ${formatRupiah(deleteItem.kredit)}`}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setDeleteItem(null)}
                disabled={deleting}
                className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? (
                  <>
                    <Loader size={15} className="animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />
                    Hapus
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// ============================================================
// SUMMARY CARD
// ============================================================

function SummaryCard({ label, value, icon, color = "blue" }) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    gray: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${colorMap[color] || colorMap.blue}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="truncate text-sm font-bold text-gray-800">{value}</p>
        </div>
      </div>
    </div>
  );
}