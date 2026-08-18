// src/pages/bendahara/SimpananAwalPage.jsx
import { useEffect, useState, useCallback, useRef } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  XCircle,
  Download,
  FileSpreadsheet,
  FileText,
  User,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader,
  Lock,
} from "lucide-react";

const emptyFilters = { nama_anggota: "", no_anggota: "" };

function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString("id-ID");
}

export default function SimpananAwalPage() {
  // ─── State ──────────────────────────────────────────────────
  const [data, setData] = useState([]);
  const [pivotData, setPivotData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });
  const [summary, setSummary] = useState({
    perJenis: {},
    totalSemua: 0,
    jumlahAnggota: 0,
  });
  const [jenisSimpananList, setJenisSimpananList] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [filterOpen, setFilterOpen] = useState(false);

  // Autocomplete anggota untuk filter
  const [anggotaSearch, setAnggotaSearch] = useState("");
  const [anggotaOptions, setAnggotaOptions] = useState([]);
  const [showAnggotaOptions, setShowAnggotaOptions] = useState(false);
  const [searchingAnggota, setSearchingAnggota] = useState(false);
  const anggotaTimeoutRef = useRef(null);

  // Modal form
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedAnggota, setSelectedAnggota] = useState(null);
  const [selectedJenis, setSelectedJenis] = useState(null);
  const [tanggal, setTanggal] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Modal detail
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailAnggota, setDetailAnggota] = useState(null);
  const [detailData, setDetailData] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modal import
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const [deleteItem, setDeleteItem] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Field anggota & jenis simpanan terkunci (LOCK) saat mode edit,
  // sesuai aturan SimpananAwalController Tahap 1.
  const isEditing = Boolean(editingId);

  // ─── Helper ─────────────────────────────────────────────────
  const getJenisLabel = (id) => {
    const found = jenisSimpananList.find((j) => j.id === id);
    return found ? found.nama : "—";
  };

  // ─── Build Pivot ────────────────────────────────────────────
  const buildPivot = (rawData, jenisList) => {
    const anggotaMap = new Map();

    rawData.forEach((item) => {
      const id = item.anggota_id;
      if (!anggotaMap.has(id)) {
        anggotaMap.set(id, {
          anggota_id: id,
          no_anggota: item.no_anggota || "-",
          nama: item.nama_anggota || "-",
          jenis: {},
        });
      }
      const entry = anggotaMap.get(id);
      const jenisId = item.jenis_simpanan_id;
      const val = parseFloat(item.jumlah) || 0;
      entry.jenis[jenisId] = (entry.jenis[jenisId] || 0) + val;
    });

    const pivotArray = [];
    for (const [_, entry] of anggotaMap) {
      const row = {
        anggota_id: entry.anggota_id,
        no_anggota: entry.no_anggota,
        nama: entry.nama,
      };
      jenisList.forEach((j) => {
        row[j.id] = entry.jenis[j.id] || 0;
      });
      row.total = Object.values(entry.jenis).reduce((a, b) => a + b, 0);
      pivotArray.push(row);
    }

    pivotArray.sort((a, b) => a.no_anggota.localeCompare(b.no_anggota));
    return pivotArray;
  };

  // ─── Fetch Data ─────────────────────────────────────────────
  const fetchData = useCallback(async (page = 1, activeFilters) => {
    setLoading(true);
    try {
      const params = { ...activeFilters, page, per_page: 10 };
      const { data } = await api.get("/simpanan-awal", { params });

      setData(data.data);
      setPagination(data.pagination);
      setJenisSimpananList(data.jenisSimpanan || []);

      const pivot = buildPivot(data.data, data.jenisSimpanan || []);
      setPivotData(pivot);

      const perJenis = {};
      let totalSemua = 0;
      const anggotaSet = new Set();
      data.data.forEach((item) => {
        const jenisId = item.jenis_simpanan_id;
        const val = parseFloat(item.jumlah) || 0;
        perJenis[jenisId] = (perJenis[jenisId] || 0) + val;
        totalSemua += val;
        anggotaSet.add(item.anggota_id);
      });
      setSummary({
        perJenis,
        totalSemua,
        jumlahAnggota: anggotaSet.size,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(1, emptyFilters);
  }, [fetchData]);

  // ─── Autocomplete Anggota untuk Filter ─────────────────────
  const fetchAnggotaOptions = useCallback(async (query) => {
    if (query.length < 3) {
      setAnggotaOptions([]);
      setShowAnggotaOptions(false);
      return;
    }
    setSearchingAnggota(true);
    try {
      const { data } = await api.get("/anggota", {
        params: { search: query, status: "aktif", per_page: 5 },
      });
      setAnggotaOptions(data.data || []);
      setShowAnggotaOptions(true);
    } catch (err) {
      console.error(err);
      setAnggotaOptions([]);
    } finally {
      setSearchingAnggota(false);
    }
  }, []);

  const handleAnggotaSearch = (value) => {
    setAnggotaSearch(value);
    if (anggotaTimeoutRef.current) clearTimeout(anggotaTimeoutRef.current);
    if (value.length < 3) {
      setAnggotaOptions([]);
      setShowAnggotaOptions(false);
      if (value === "") {
        setFilters((f) => ({ ...f, nama_anggota: "", no_anggota: "" }));
      }
      return;
    }
    anggotaTimeoutRef.current = setTimeout(() => {
      fetchAnggotaOptions(value);
    }, 300);
  };

  const selectAnggota = (anggota) => {
    setFilters({
      nama_anggota: anggota.nama,
      no_anggota: anggota.no_anggota,
    });
    setAnggotaSearch(`${anggota.no_anggota} - ${anggota.nama}`);
    setShowAnggotaOptions(false);
  };

  // ─── Filter ──────────────────────────────────────────────────
  const handleFilterChange = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  const applyFilters = () => {
    setAppliedFilters(filters);
    fetchData(1, filters);
  };

  const resetFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setAnggotaSearch("");
    setAnggotaOptions([]);
    setShowAnggotaOptions(false);
    fetchData(1, emptyFilters);
  };

  const goToPage = (page) => {
    fetchData(page, appliedFilters);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ─── Modal Detail Anggota ───────────────────────────────────
  const openDetailModal = async (anggotaId, noAnggota, nama) => {
    setDetailAnggota({ id: anggotaId, no_anggota: noAnggota, nama });
    setDetailLoading(true);
    setDetailModalOpen(true);
    try {
      const { data } = await api.get(`/simpanan-awal/anggota/${anggotaId}`);
      setDetailData(data.data || []);
    } catch (err) {
      alert("Gagal mengambil detail saldo awal anggota.");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetailModal = () => {
    setDetailModalOpen(false);
    setDetailData([]);
    setDetailAnggota(null);
  };

  // Edit dari modal detail
  const editFromDetail = (item) => {
    closeDetailModal();
    setEditingId(item.id);
    setSelectedAnggota({
      id: item.anggota_id,
      no_anggota: item.anggota?.no_anggota || item.no_anggota || "",
      nama: item.anggota?.nama || item.nama_anggota || "",
    });
    setSelectedJenis({
      id: item.jenis_simpanan_id,
      nama: item.jenis_simpanan?.nama || "",
    });
    setTanggal(item.tanggal?.slice(0, 10) || "");
    setJumlah(item.jumlah ? String(item.jumlah) : "");
    setError("");
    setModalOpen(true);
  };

  // Hapus dari modal detail
  const handleDeleteFromDetail = async (item) => {
    const namaAnggota = item.anggota?.nama || item.nama_anggota || "Anggota";
    const namaJenis = item.jenis_simpanan?.nama || item.jenis_simpanan || "Jenis";
    if (!window.confirm(`Yakin hapus saldo awal untuk ${namaAnggota} - ${namaJenis}?`)) return;
    try {
      await api.delete(`/simpanan-awal/${item.id}`);
      const { data } = await api.get(`/simpanan-awal/anggota/${detailAnggota.id}`);
      setDetailData(data.data || []);
      fetchData(pagination.page, appliedFilters);
    } catch (err) {
      alert(err.response?.data?.message || "Gagal menghapus.");
    }
  };

  // ─── Modal Form ─────────────────────────────────────────────
  const openCreateModal = () => {
    setEditingId(null);
    setSelectedAnggota(null);
    setSelectedJenis(null);
    setTanggal("");
    setJumlah("");
    setError("");
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!isEditing) {
      // Anggota & jenis hanya wajib dipilih saat membuat data baru.
      // Saat edit, keduanya sudah pasti terisi dan terkunci (LOCK).
      if (!selectedAnggota) {
        setError("Pilih anggota terlebih dahulu.");
        return;
      }
      if (!selectedJenis) {
        setError("Pilih jenis simpanan.");
        return;
      }
    }
    if (!tanggal) {
      setError("Tanggal wajib diisi.");
      return;
    }

    // Sesuai aturan controller: nominal harus > 0, bukan >= 0.
    const jumlahNum = parseFloat(jumlah) || 0;
    if (isNaN(jumlahNum) || jumlahNum <= 0) {
      setError("Jumlah harus berupa angka lebih dari 0.");
      return;
    }

    setSaving(true);
    try {
      let payload;

      if (isEditing) {
        // anggota_id & jenis_simpanan_id LOCK -> tidak pernah dikirim saat update.
        payload = {
          tanggal,
          jumlah: jumlahNum,
        };
        await api.put(`/simpanan-awal/${editingId}`, payload);
      } else {
        payload = {
          anggota_id: selectedAnggota.id,
          jenis_simpanan_id: selectedJenis.id,
          tanggal,
          jumlah: jumlahNum,
        };
        await api.post("/simpanan-awal", payload);
      }

      setModalOpen(false);
      if (detailModalOpen && detailAnggota) {
        const { data } = await api.get(`/simpanan-awal/anggota/${detailAnggota.id}`);
        setDetailData(data.data || []);
      }
      fetchData(pagination.page, appliedFilters);
    } catch (err) {
      setError(err.response?.data?.message || "Terjadi kesalahan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  // ─── Import ──────────────────────────────────────────────────
  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importFile) {
      alert("Pilih file terlebih dahulu.");
      return;
    }
    setImporting(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append("file", importFile);
    try {
      const { data } = await api.post("/simpanan-awal/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportResult(data.results);
      fetchData(pagination.page, appliedFilters);
    } catch (err) {
      alert(err.response?.data?.message || "Gagal import.");
    } finally {
      setImporting(false);
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
              <h2 className="text-xl font-semibold text-gray-800">Saldo Awal Simpanan</h2>
              <p className="text-sm text-gray-500">Tabel pivot per anggota dan jenis simpanan</p>
            </div>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={16} />
              Tambah Saldo Awal
            </button>
          </div>
        </div>

        {/* Ringkasan */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard 
            label="Total Anggota" 
            value={summary.jumlahAnggota} 
            icon={<User size={18} className="text-blue-600" />}
            color="blue" 
          />
          <SummaryCard 
            label="Total Saldo" 
            value={`Rp ${formatRupiah(summary.totalSemua)}`} 
            icon={<TrendingUp size={18} className="text-green-600" />}
            color="green" 
          />
          {Object.entries(summary.perJenis).slice(0, 2).map(([jenisId, total]) => (
            <SummaryCard
              key={jenisId}
              label={getJenisLabel(parseInt(jenisId)) || `Jenis ${jenisId}`}
              value={`Rp ${formatRupiah(total)}`}
              icon={<PiggyBank size={18} className="text-amber-600" />}
              color="amber"
            />
          ))}
        </div>

        {/* Filter & Import */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
          >
            <span className="flex items-center gap-2 font-medium text-gray-700">
              <Search size={18} className="text-gray-500" /> Filter & Import
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
                    {/* Autocomplete Nama/No Anggota */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Nama / No Anggota</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={anggotaSearch}
                          onChange={(e) => handleAnggotaSearch(e.target.value)}
                          placeholder="Ketik minimal 3 huruf..."
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        />
                        {showAnggotaOptions && (
                          <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {searchingAnggota ? (
                              <div className="px-3 py-2 text-sm text-gray-500">Mencari...</div>
                            ) : anggotaOptions.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-gray-500">Tidak ditemukan</div>
                            ) : (
                              anggotaOptions.map((anggota) => (
                                <button
                                  key={anggota.id}
                                  onClick={() => selectAnggota(anggota)}
                                  className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                                >
                                  <span className="font-medium">{anggota.no_anggota}</span> - {anggota.nama}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">No. Anggota</label>
                      <input
                        type="text"
                        value={filters.no_anggota}
                        onChange={(e) => handleFilterChange("no_anggota", e.target.value)}
                        placeholder="Cari no. anggota…"
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
                <div className="bg-white rounded-lg p-4 border">
                  <p className="text-xs font-semibold uppercase text-gray-500 flex items-center gap-2 mb-3">
                    <Download size={14} className="text-green-600" /> Import Data
                  </p>
                  <button
                    onClick={() => setImportModalOpen(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 w-full"
                  >
                    <FileSpreadsheet size={15} /> Import Excel/CSV
                  </button>
                  <p className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                    <AlertCircle size={12} /> Format: no_anggota, jenis_simpanan (kode), tanggal, jumlah
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── TABEL PIVOT ───────────────────────────────────── */}
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm border border-gray-100">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 text-center">NO</th>
                <th className="px-4 py-3">No. Anggota</th>
                <th className="px-4 py-3">Nama Anggota</th>
                {jenisSimpananList
                  .sort((a, b) => a.urutan - b.urutan)
                  .map((j) => (
                    <th key={j.id} className="px-4 py-3 text-right">
                      {j.nama}
                    </th>
                  ))}
                <th className="px-4 py-3 text-right font-bold">Total</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={jenisSimpananList.length + 5} className="px-4 py-6 text-center text-gray-400">
                    <Loader className="animate-spin inline-block mr-2" size={20} /> Memuat...
                  </td>
                </tr>
              ) : pivotData.length === 0 ? (
                <tr>
                  <td colSpan={jenisSimpananList.length + 5} className="px-4 py-6 text-center text-gray-400">
                    Tidak ada data.
                  </td>
                </tr>
              ) : (
                <>
                  {pivotData.map((row, idx) => (
                    <tr key={row.anggota_id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-center">{(pagination.page - 1) * 10 + idx + 1}</td>
                      <td className="px-4 py-3">{row.no_anggota}</td>
                      <td className="px-4 py-3 font-medium">{row.nama}</td>
                      {jenisSimpananList
                        .sort((a, b) => a.urutan - b.urutan)
                        .map((j) => (
                          <td key={j.id} className="px-4 py-3 text-right font-mono">
                            {row[j.id] !== undefined ? formatRupiah(row[j.id]) : "0"}
                          </td>
                        ))}
                      <td className="px-4 py-3 text-right font-bold text-green-700">
                        Rp {formatRupiah(row.total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => openDetailModal(row.anggota_id, row.no_anggota, row.nama)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50 mx-auto"
                          title="Detail Saldo Anggota"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan="3" className="px-4 py-3 text-right">TOTAL</td>
                    {jenisSimpananList
                      .sort((a, b) => a.urutan - b.urutan)
                      .map((j) => {
                        const total = summary.perJenis[j.id] || 0;
                        return (
                          <td key={j.id} className="px-4 py-3 text-right font-mono">
                            Rp {formatRupiah(total)}
                          </td>
                        );
                      })}
                    <td className="px-4 py-3 text-right font-bold text-green-700">
                      Rp {formatRupiah(summary.totalSemua)}
                    </td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="space-y-3 lg:hidden">
          {loading ? (
            <div className="text-center py-8 text-gray-400">
              <Loader className="animate-spin inline-block mr-2" size={20} /> Memuat...
            </div>
          ) : pivotData.length === 0 ? (
            <div className="text-center py-8 text-gray-400">Tidak ada data.</div>
          ) : (
            pivotData.map((row) => (
              <div key={row.anggota_id} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{row.nama}</p>
                    <p className="text-xs text-gray-500">{row.no_anggota}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="font-bold text-green-700">Rp {formatRupiah(row.total)}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1 text-sm">
                  {jenisSimpananList
                    .sort((a, b) => a.urutan - b.urutan)
                    .map((j) => (
                      <div key={j.id} className="flex justify-between border-b py-1">
                        <span className="text-gray-500">{j.nama}</span>
                        <span className="font-mono">Rp {formatRupiah(row[j.id] || 0)}</span>
                      </div>
                    ))}
                </div>
                <button
                  onClick={() => openDetailModal(row.anggota_id, row.no_anggota, row.nama)}
                  className="mt-3 flex items-center justify-center gap-2 w-full py-2 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100"
                >
                  <Eye size={16} /> Detail
                </button>
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

      {/* ─── MODAL DETAIL ANGGOTA ──────────────────────────────── */}
      {detailModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b px-4 py-4 sm:px-8">
            <h3 className="text-lg font-semibold text-gray-800 sm:text-xl">
              Saldo Awal: {detailAnggota?.no_anggota} - {detailAnggota?.nama}
            </h3>
            <button
              onClick={closeDetailModal}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            {detailLoading ? (
              <p className="text-center text-gray-400">Memuat data...</p>
            ) : detailData.length === 0 ? (
              <p className="text-center text-gray-400">Belum ada saldo awal untuk anggota ini.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-center">NO</th>
                      <th className="px-4 py-3">Jenis Simpanan</th>
                      <th className="px-4 py-3">Tanggal</th>
                      <th className="px-4 py-3 text-right">Jumlah</th>
                      <th className="px-4 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {detailData.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 text-center">{idx + 1}</td>
                        <td className="px-4 py-3">{item.jenis_simpanan?.nama || "-"}</td>
                        <td className="px-4 py-3">{item.tanggal?.slice(0, 10) || "-"}</td>
                        <td className="px-4 py-3 text-right font-medium font-mono">
                          Rp {formatRupiah(item.jumlah)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center gap-1.5">
                            <button
                              onClick={() => editFromDetail(item)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50"
                              title="Edit"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteFromDetail(item)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                              title="Hapus"
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
            )}
          </div>
          <div className="flex justify-end border-t px-4 py-4 sm:px-8">
            <button
              onClick={closeDetailModal}
              className="rounded-lg border px-5 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL FORM UTAMA ───────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b px-4 py-4 sm:px-8">
            <h3 className="text-lg font-semibold text-gray-800 sm:text-xl">
              {isEditing ? "Edit Saldo Awal" : "Tambah Saldo Awal"}
            </h3>
            <button
              onClick={() => setModalOpen(false)}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <form id="simpanan-awal-form" onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4">
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
                  <p className="mt-1 text-xs text-gray-400">
                    Anggota tidak dapat diubah setelah dibuat.
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-sm text-gray-700">
                  Jenis Simpanan
                  {isEditing && <Lock size={12} className="text-gray-400" />}
                </label>
                {isEditing ? (
                  <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    {selectedJenis?.nama || "—"}
                  </div>
                ) : (
                  <select
                    value={selectedJenis?.id || ""}
                    onChange={(e) => {
                      const id = parseInt(e.target.value);
                      const found = jenisSimpananList.find((j) => j.id === id);
                      setSelectedJenis(found || null);
                    }}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Pilih jenis simpanan</option>
                    {jenisSimpananList.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.nama}
                      </option>
                    ))}
                  </select>
                )}
                {isEditing && (
                  <p className="mt-1 text-xs text-gray-400">
                    Jenis simpanan tidak dapat diubah setelah dibuat.
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-700">Tanggal</label>
                <input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-700">Jumlah (Rp)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={jumlah ? Number(jumlah).toLocaleString("id-ID") : ""}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d]/g, "");
                    setJumlah(raw);
                  }}
                  placeholder="0"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-400">Jumlah harus lebih dari 0.</p>
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
              form="simpanan-awal-form"
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
            <h3 className="text-lg font-semibold text-gray-800">Import Saldo Awal</h3>
            <p className="text-sm text-gray-500 mt-1">
              Upload file Excel atau CSV dengan kolom: <strong>no_anggota, jenis_simpanan, tanggal, jumlah</strong>.
              Kolom <strong>jenis_simpanan</strong> diisi dengan kode jenis simpanan (contoh: SP), bukan nama.
            </p>
            <form onSubmit={handleImportSubmit} className="mt-4 space-y-4">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setImportFile(e.target.files[0])}
                className="w-full"
              />
              {importResult && (
                <div className="text-sm">
                  <p>Berhasil: {importResult.success}</p>
                  <p>Gagal: {importResult.failed}</p>
                  {importResult.errors.length > 0 && (
                    <div className="max-h-40 overflow-y-auto text-red-600">
                      {importResult.errors.map((err, idx) => <div key={idx}>{err}</div>)}
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setImportModalOpen(false);
                    setImportResult(null);
                    setImportFile(null);
                  }}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={importing || !importFile}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-60"
                >
                  {importing ? "Mengimpor..." : "Import"}
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
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-sm font-bold text-gray-800">{value}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Tambahan komponen untuk ikon ────────────────────────────
function TrendingUp({ size, className }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
}

function PiggyBank({ size, className }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z"/><path d="M2 9v1c0 1.1.9 2 2 2h1"/><path d="M16 11h.01"/></svg>;
}