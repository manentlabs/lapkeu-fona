// src/pages/bendahara/PotonganGajiPage.jsx
import { useEffect, useState, useCallback, useRef } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import * as XLSX from "xlsx";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  XCircle,
  Download,
  Upload,
  FileSpreadsheet,
  User,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader,
  Lock,
  CheckCircle,
  Wallet,
  Users,
  Clock,
} from "lucide-react";

const emptyFilters = { bulan: "", tahun: "" };

const BULAN_LIST = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString("id-ID");
}

const emptyForm = {
  bulan: "",
  tahun: new Date().getFullYear(),
  keterangan: "",
  simpanan_wajib: 0,
  simpanan_sukarela: 0,
  utang_barang_pokok: 0,
  utang_barang_jasa: 0,
  utang_uang_menengah_pokok: 0,
  utang_uang_menengah_jasa: 0,
  utang_uang_pendek_pokok: 0,
  utang_uang_pendek_jasa: 0,
  simpanan_pokok: 0,
};

const FIELD_LABELS = [
  ["simpanan_wajib", "Simp. Wajib"],
  ["simpanan_sukarela", "Simp. Sukarela"],
  ["utang_barang_pokok", "Utang Barang Pokok"],
  ["utang_barang_jasa", "Utang Barang Jasa"],
  ["utang_uang_menengah_pokok", "Utang Uang Menengah Pokok"],
  ["utang_uang_menengah_jasa", "Utang Uang Menengah Jasa"],
  ["utang_uang_pendek_pokok", "Utang Uang Pendek Pokok"],
  ["utang_uang_pendek_jasa", "Utang Uang Pendek Jasa"],
  ["simpanan_pokok", "Simp. Pokok"],
];

export default function PotonganGajiPage() {
  // ─── State ──────────────────────────────────────────────────
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [filterOpen, setFilterOpen] = useState(true);

  // Modal form (tambah/edit manual)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedAnggota, setSelectedAnggota] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Modal detail
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

  // Modal import
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importData, setImportData] = useState([]);
  const [importing, setImporting] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const isEditing = Boolean(editingId);

  // ─── Fetch Data ─────────────────────────────────────────────
  const fetchData = useCallback(async (page = 1, activeFilters) => {
    setLoading(true);
    try {
      const params = { page, per_page: 10 };
      if (activeFilters.bulan) params.bulan = activeFilters.bulan;
      if (activeFilters.tahun) params.tahun = activeFilters.tahun;
      const { data } = await api.get("/potongan-gaji", { params });
      setData(data.data || []);
      setPagination(data.pagination || { page: 1, total_pages: 1, total: 0 });
      setSummary(data.summary || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(1, emptyFilters);
  }, [fetchData]);

  // ─── Ringkasan turunan ──────────────────────────────────────
  const totalSemua = data.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
  const totalDiproses = data.filter((i) => i.is_processed).length;
  const anggotaUnik = new Set(data.map((i) => i.anggota_id)).size;

  // ─── Filter ─────────────────────────────────────────────────
  const handleFilterChange = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  const applyFilters = () => {
    setAppliedFilters(filters);
    fetchData(1, filters);
  };

  const resetFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    fetchData(1, emptyFilters);
  };

  const goToPage = (page) => {
    fetchData(page, appliedFilters);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ─── Modal Detail ───────────────────────────────────────────
  const openDetailModal = (item) => {
    setDetailItem(item);
    setDetailModalOpen(true);
  };
  const closeDetailModal = () => {
    setDetailModalOpen(false);
    setDetailItem(null);
  };

  const editFromDetail = (item) => {
    closeDetailModal();
    openEditForm(item);
  };

  const deleteFromDetail = async (item) => {
    closeDetailModal();
    await handleDelete(item);
  };

  // ─── Modal Form ─────────────────────────────────────────────
  const openCreateModal = () => {
    setEditingId(null);
    setSelectedAnggota(null);
    setForm({ ...emptyForm, bulan: appliedFilters.bulan || "", tahun: appliedFilters.tahun || new Date().getFullYear() });
    setError("");
    setModalOpen(true);
  };

  const openEditForm = (item) => {
    setEditingId(item.id);
    setSelectedAnggota({
      id: item.anggota_id,
      no_anggota: item.anggota?.no_anggota || "",
      nama: item.anggota?.nama || "",
    });
    setForm({
      bulan: item.bulan,
      tahun: item.tahun,
      keterangan: item.keterangan || "",
      simpanan_wajib: item.simpanan_wajib || 0,
      simpanan_sukarela: item.simpanan_sukarela || 0,
      utang_barang_pokok: item.utang_barang_pokok || 0,
      utang_barang_jasa: item.utang_barang_jasa || 0,
      utang_uang_menengah_pokok: item.utang_uang_menengah_pokok || 0,
      utang_uang_menengah_jasa: item.utang_uang_menengah_jasa || 0,
      utang_uang_pendek_pokok: item.utang_uang_pendek_pokok || 0,
      utang_uang_pendek_jasa: item.utang_uang_pendek_jasa || 0,
      simpanan_pokok: item.simpanan_pokok || 0,
    });
    setError("");
    setModalOpen(true);
  };

  const handleFormChange = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!isEditing && !selectedAnggota) {
      setError("Pilih anggota terlebih dahulu.");
      return;
    }
    if (!form.bulan || !form.tahun) {
      setError("Bulan dan tahun wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await api.put(`/potongan-gaji/${editingId}`, form);
      } else {
        await api.post("/potongan-gaji/manual", {
          ...form,
          anggota_id: selectedAnggota.id,
        });
      }
      setModalOpen(false);
      fetchData(pagination.page, appliedFilters);
    } catch (err) {
      setError(err.response?.data?.message || "Terjadi kesalahan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  // ─── Proses ke Jurnal ───────────────────────────────────────
  const handleProcess = async (id) => {
    if (!window.confirm("Proses potongan ini ke jurnal? Tindakan ini tidak bisa dibatalkan.")) return;
    setProcessingId(id);
    try {
      await api.post(`/potongan-gaji/${id}/process`);
      fetchData(pagination.page, appliedFilters);
    } catch (err) {
      alert(err.response?.data?.message || "Gagal memproses.");
    } finally {
      setProcessingId(null);
    }
  };

  // ─── Delete ─────────────────────────────────────────────────
  const handleDelete = async (item) => {
    if (!window.confirm(`Yakin hapus potongan ${item.anggota?.nama || "anggota ini"}?`)) return;
    try {
      await api.delete(`/potongan-gaji/${item.id}`);
      fetchData(pagination.page, appliedFilters);
    } catch (err) {
      alert(err.response?.data?.message || "Gagal hapus.");
    }
  };

  // ─── Import Excel ───────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const bin = new Uint8Array(ev.target.result);
      const workbook = XLSX.read(bin, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);
      setImportData(json);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (importData.length === 0) return;
    setImporting(true);
    try {
      const parsed = importData.map((row) => ({
        no_urut: row["No Urut"] || null,
        no_anggota: row["No"] ? String(row["No"]).trim() : null,
        nama: row["Nama"] ? String(row["Nama"]).trim() : null,
        plafon: parseFloat(row["Plafon"]) || null,
        jangka_waktu: row["JW"] ? String(row["JW"]).trim() : null,
        angsuran_ke: parseInt(row["Ke"]) || null,
        simpanan_wajib: parseFloat(row["Simp. Wajib"]) || 0,
        simpanan_sukarela: parseFloat(row["Skrl"]) || 0,
        utang_barang_pokok: parseFloat(row["Utang Brg. pokok"]) || 0,
        utang_barang_jasa: parseFloat(row["Utang Brg. jasa"]) || 0,
        utang_uang_menengah_pokok: parseFloat(row["Utang Uang menengah Pokok"]) || 0,
        utang_uang_menengah_jasa: parseFloat(row["Utang Uang menengah Jasa 2.75%"]) || 0,
        utang_uang_pendek_pokok: parseFloat(row["Utang Uang pendek Pokok"]) || 0,
        utang_uang_pendek_jasa: parseFloat(row["Utang Uang pendek Jasa 2.75%"]) || 0,
        simpanan_pokok: parseFloat(row["Simp. Pokok"]) || 0,
      }));

      const payload = {
        bulan: appliedFilters.bulan || "Agustus",
        tahun: parseInt(appliedFilters.tahun) || new Date().getFullYear(),
        data: parsed,
      };

      await api.post("/potongan-gaji", payload);
      setImportModalOpen(false);
      setImportData([]);
      setImportFile(null);
      fetchData(1, appliedFilters);
    } catch (err) {
      alert(err.response?.data?.message || "Gagal import data.");
    } finally {
      setImporting(false);
    }
  };

  // ─── Export Excel ───────────────────────────────────────────
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = {};
      if (appliedFilters.bulan) params.bulan = `${appliedFilters.bulan} ${appliedFilters.tahun || new Date().getFullYear()}`;
      if (appliedFilters.tahun) params.tahun = appliedFilters.tahun;

      const response = await api.get("/pinjaman/export-potongan-gaji", {
        params,
        responseType: "blob",
      });

      if (response.data.type === "application/json") {
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        alert(errorData.message || "Gagal export Excel");
        return;
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `potongan-gaji-${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      let message = "Gagal export Excel";
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          message = JSON.parse(text).message || message;
        } catch {}
      } else if (err.response?.data?.message) {
        message = err.response.data.message;
      }
      alert(message);
    } finally {
      setExporting(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Potongan Gaji</h2>
              <p className="text-sm text-gray-500">Rekap potongan dari pinjaman & utang manual per bulan</p>
            </div>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={16} />
              Tambah Manual
            </button>
          </div>
        </div>

        {/* Ringkasan */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard
            label="Anggota Terdampak"
            value={anggotaUnik}
            icon={<Users size={18} className="text-blue-600" />}
            color="blue"
          />
          <SummaryCard
            label="Total Potongan"
            value={`Rp ${formatRupiah(totalSemua)}`}
            icon={<Wallet size={18} className="text-green-600" />}
            color="green"
          />
          <SummaryCard
            label="Sudah Diproses"
            value={`${totalDiproses} / ${data.length}`}
            icon={<CheckCircle size={18} className="text-emerald-600" />}
            color="green"
          />
          <SummaryCard
            label="Belum Diproses"
            value={data.length - totalDiproses}
            icon={<Clock size={18} className="text-amber-600" />}
            color="amber"
          />
        </div>

        {/* Filter & Import/Export */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
          >
            <span className="flex items-center gap-2 font-medium text-gray-700">
              <Search size={18} className="text-gray-500" /> Filter & Import/Export
            </span>
            {filterOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {filterOpen && (
            <div className="border-t p-4 bg-gray-50">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-white rounded-lg p-4 border">
                  <p className="text-xs font-semibold uppercase text-gray-500 flex items-center gap-2 mb-3">
                    <Search size={14} /> Filter Data
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Bulan</label>
                      <select
                        value={filters.bulan}
                        onChange={(e) => handleFilterChange("bulan", e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Semua Bulan</option>
                        {BULAN_LIST.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tahun</label>
                      <input
                        type="number"
                        value={filters.tahun}
                        onChange={(e) => handleFilterChange("tahun", e.target.value)}
                        placeholder={String(new Date().getFullYear())}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
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
                <div className="bg-white rounded-lg p-4 border space-y-2">
                  <p className="text-xs font-semibold uppercase text-gray-500 flex items-center gap-2 mb-1">
                    <FileSpreadsheet size={14} className="text-green-600" /> Excel
                  </p>
                  <button
                    onClick={() => setImportModalOpen(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 w-full"
                  >
                    <Upload size={15} /> Import Excel
                  </button>
                  <button
                    onClick={handleExportExcel}
                    disabled={exporting}
                    className="flex items-center justify-center gap-2 px-4 py-2 border border-green-600 text-green-700 rounded-lg text-sm hover:bg-green-50 w-full disabled:opacity-60"
                  >
                    {exporting ? <Loader size={15} className="animate-spin" /> : <Download size={15} />}
                    Export Excel
                  </button>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <AlertCircle size={12} /> Export mengikuti filter bulan/tahun di atas.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── TABEL ──────────────────────────────────────────── */}
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm border border-gray-100 hidden lg:block">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 text-center">NO</th>
                <th className="px-4 py-3">Anggota</th>
                <th className="px-4 py-3">Bulan</th>
                <th className="px-4 py-3 text-center">Sumber</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-6 text-center text-gray-400">
                    <Loader className="animate-spin inline-block mr-2" size={20} /> Memuat...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-6 text-center text-gray-400">
                    Tidak ada data.
                  </td>
                </tr>
              ) : (
                data.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-center">{(pagination.page - 1) * 10 + idx + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{item.anggota?.nama || "-"}</p>
                      <p className="text-xs text-gray-400">{item.anggota?.no_anggota || "-"}</p>
                    </td>
                    <td className="px-4 py-3">{item.bulan} {item.tahun}</td>
                    <td className="px-4 py-3 text-center">
                      {item.sumber === "pinjaman" ? (
                        <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                          Otomatis
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                          Manual
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-green-700">
                      Rp {formatRupiah(item.total)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.is_processed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                          <CheckCircle size={12} /> Diproses
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                          <Clock size={12} /> Belum
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openDetailModal(item)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50"
                          title="Detail"
                        >
                          <Eye size={16} />
                        </button>
                        {!item.is_processed && item.sumber === "manual" && (
                          <button
                            onClick={() => openEditForm(item)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50"
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        {!item.is_processed && (
                          <button
                            onClick={() => handleProcess(item.id)}
                            disabled={processingId === item.id}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-green-600 hover:bg-green-50 disabled:opacity-50"
                            title="Proses ke Jurnal"
                          >
                            {processingId === item.id ? (
                              <Loader size={16} className="animate-spin" />
                            ) : (
                              <CheckCircle size={16} />
                            )}
                          </button>
                        )}
                        {!item.is_processed && item.sumber === "manual" && (
                          <button
                            onClick={() => handleDelete(item)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                            title="Hapus"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && data.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td colSpan="4" className="px-4 py-3 text-right">TOTAL</td>
                  <td className="px-4 py-3 text-right font-mono text-green-700">Rp {formatRupiah(totalSemua)}</td>
                  <td colSpan="2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Mobile View */}
        <div className="space-y-3 lg:hidden">
          {loading ? (
            <div className="text-center py-8 text-gray-400">
              <Loader className="animate-spin inline-block mr-2" size={20} /> Memuat...
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-8 text-gray-400">Tidak ada data.</div>
          ) : (
            data.map((item) => (
              <div key={item.id} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-800">{item.anggota?.nama || "-"}</p>
                    <p className="text-xs text-gray-400">{item.anggota?.no_anggota || "-"} · {item.bulan} {item.tahun}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="font-bold text-green-700">Rp {formatRupiah(item.total)}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {item.sumber === "pinjaman" ? (
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">Otomatis</span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">Manual</span>
                  )}
                  {item.is_processed ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                      <CheckCircle size={12} /> Diproses
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                      <Clock size={12} /> Belum
                    </span>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => openDetailModal(item)}
                    className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-600 hover:bg-blue-100"
                  >
                    <Eye size={15} /> Detail
                  </button>
                  {!item.is_processed && (
                    <button
                      onClick={() => handleProcess(item.id)}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700"
                    >
                      <CheckCircle size={15} /> Proses
                    </button>
                  )}
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
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => goToPage(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="h-8 px-3 rounded-lg border text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50"
              >
                Sebelumnya
              </button>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: pagination.total_pages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    className={`h-8 w-8 rounded-lg text-sm ${
                      p === pagination.page ? "bg-blue-600 text-white" : "border hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                onClick={() => goToPage(pagination.page + 1)}
                disabled={pagination.page >= pagination.total_pages}
                className="h-8 px-3 rounded-lg border text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── MODAL DETAIL ──────────────────────────────────────── */}
      {detailModalOpen && detailItem && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b px-4 py-4 sm:px-8">
            <h3 className="text-lg font-semibold text-gray-800 sm:text-xl">
              Detail Potongan: {detailItem.anggota?.no_anggota} - {detailItem.anggota?.nama}
            </h3>
            <button onClick={closeDetailModal} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <div className="mx-auto max-w-2xl space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-500">{detailItem.bulan} {detailItem.tahun}</span>
                {detailItem.sumber === "pinjaman" ? (
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">Otomatis dari Pinjaman</span>
                ) : (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">Manual</span>
                )}
                {detailItem.is_processed ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                    <CheckCircle size={12} /> Diproses
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                    <Clock size={12} /> Belum
                  </span>
                )}
              </div>

              {detailItem.keterangan && (
                <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                  <span className="text-xs text-gray-500 block mb-1">Keterangan</span>
                  {detailItem.keterangan}
                </div>
              )}

              {detailItem.sumber === "pinjaman" && (
                <div className="grid grid-cols-3 gap-3 rounded-lg bg-blue-50 p-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Plafon</p>
                    <p className="font-medium">Rp {formatRupiah(detailItem.plafon)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Jangka Waktu</p>
                    <p className="font-medium">{detailItem.jangka_waktu || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Angsuran Ke</p>
                    <p className="font-medium">{detailItem.angsuran_ke || "-"}</p>
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-lg border">
                <table className="min-w-full text-sm">
                  <tbody className="divide-y">
                    {FIELD_LABELS.map(([key, label]) => (
                      <tr key={key}>
                        <td className="px-4 py-2.5 text-gray-500">{label}</td>
                        <td className="px-4 py-2.5 text-right font-mono">Rp {formatRupiah(detailItem[key])}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-4 py-2.5">Jumlah</td>
                      <td className="px-4 py-2.5 text-right font-mono text-green-700">Rp {formatRupiah(detailItem.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t px-4 py-4 sm:px-8">
            {!detailItem.is_processed && detailItem.sumber === "manual" && (
              <>
                <button
                  onClick={() => deleteFromDetail(detailItem)}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={15} /> Hapus
                </button>
                <button
                  onClick={() => editFromDetail(detailItem)}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm text-white hover:bg-blue-700"
                >
                  <Pencil size={15} /> Edit
                </button>
              </>
            )}
            <button onClick={closeDetailModal} className="rounded-lg border px-5 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL FORM (TAMBAH/EDIT MANUAL) ──────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b px-4 py-4 sm:px-8">
            <h3 className="text-lg font-semibold text-gray-800 sm:text-xl">
              {isEditing ? "Edit Potongan Manual" : "Tambah Potongan Manual"}
            </h3>
            <button onClick={() => setModalOpen(false)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <form id="potongan-form" onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-sm text-gray-700">
                  Anggota
                  {isEditing && <Lock size={12} className="text-gray-400" />}
                </label>
                {isEditing ? (
                  <div className="flex items-center gap-2 rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    <User size={15} className="text-gray-400" />
                    {selectedAnggota?.no_anggota} &middot; {selectedAnggota?.nama}
                  </div>
                ) : (
                  <AnggotaSearchInput selected={selectedAnggota} onSelect={setSelectedAnggota} />
                )}
                {isEditing && (
                  <p className="mt-1 text-xs text-gray-400">Anggota tidak dapat diubah setelah dibuat.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-sm text-gray-700">
                    Bulan
                    {isEditing && <Lock size={12} className="text-gray-400" />}
                  </label>
                  {isEditing ? (
                    <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700">{form.bulan}</div>
                  ) : (
                    <select
                      value={form.bulan}
                      onChange={(e) => handleFormChange("bulan", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Pilih bulan</option>
                      {BULAN_LIST.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-sm text-gray-700">
                    Tahun
                    {isEditing && <Lock size={12} className="text-gray-400" />}
                  </label>
                  {isEditing ? (
                    <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700">{form.tahun}</div>
                  ) : (
                    <input
                      type="number"
                      value={form.tahun}
                      onChange={(e) => handleFormChange("tahun", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-700">Keterangan</label>
                <input
                  type="text"
                  value={form.keterangan}
                  onChange={(e) => handleFormChange("keterangan", e.target.value)}
                  placeholder="Utang lain-lain, dsb"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {FIELD_LABELS.map(([key, label]) => (
                  <div key={key}>
                    <label className="mb-1 block text-sm text-gray-700">{label}</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form[key] ? Number(form[key]).toLocaleString("id-ID") : ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^\d]/g, "");
                        handleFormChange(key, raw);
                      }}
                      placeholder="0"
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <div className="rounded-lg bg-gray-50 px-4 py-3 flex justify-between items-center">
                <span className="text-sm text-gray-500">Total</span>
                <span className="font-bold text-green-700">
                  Rp {formatRupiah(FIELD_LABELS.reduce((s, [key]) => s + (parseFloat(form[key]) || 0), 0))}
                </span>
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
              form="potongan-form"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL IMPORT ──────────────────────────────────────── */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6">
            <h3 className="text-lg font-semibold text-gray-800">Import Potongan Gaji</h3>
            <p className="text-sm text-gray-500 mt-1">
              Upload file Excel (.xlsx) dengan kolom sesuai template PKM SUDI. Data akan masuk sebagai
              kategori <strong>Manual</strong> untuk bulan/tahun yang sedang difilter.
            </p>
            <form onSubmit={handleImportSubmit} className="mt-4 space-y-4">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="w-full"
              />
              {importData.length > 0 && (
                <p className="text-sm text-green-600">✓ {importData.length} baris data siap diimport.</p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setImportModalOpen(false);
                    setImportData([]);
                    setImportFile(null);
                  }}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={importing || importData.length === 0}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-60"
                >
                  {importing ? "Mengimport..." : "Import Data"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// ─── Komponen Pencarian Anggota ──────────────────────────────
function AnggotaSearchInput({ selected, onSelect }) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const timeoutRef = useRef(null);

  const handleChange = (val) => {
    setQuery(val);
    onSelect(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!val.trim()) {
      setOptions([]);
      setOpen(false);
      return;
    }
    timeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get("/anggota", {
          params: { search: val, status: "aktif", per_page: 8 },
        });
        setOptions(data.data || []);
        setOpen(true);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const handlePick = (item) => {
    onSelect({ id: item.id, no_anggota: item.no_anggota, nama: item.nama });
    setQuery(`${item.no_anggota} - ${item.nama}`);
    setOpen(false);
  };

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border bg-blue-50 px-3 py-2 text-sm text-blue-700">
        <span className="flex items-center gap-2">
          <User size={15} />
          {selected.no_anggota} &middot; {selected.nama}
        </span>
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            setQuery("");
          }}
          className="text-blue-500 hover:text-blue-700"
        >
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => options.length > 0 && setOpen(true)}
        placeholder="Cari nama atau no. anggota…"
        className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />
      {open && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border bg-white shadow-lg">
          {searching ? (
            <p className="px-3 py-2 text-sm text-gray-400">Mencari…</p>
          ) : options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">Anggota tidak ditemukan.</p>
          ) : (
            options.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => handlePick(item)}
                className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span className="font-medium text-gray-800">{item.nama}</span>
                <span className="text-xs text-gray-400">{item.no_anggota}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Kartu Ringkasan ──────────────────────────────────────────
function SummaryCard({ label, value, icon, color }) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    gray: "bg-gray-100 text-gray-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>{icon}</div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-sm font-bold text-gray-800">{value}</p>
        </div>
      </div>
    </div>
  );
}