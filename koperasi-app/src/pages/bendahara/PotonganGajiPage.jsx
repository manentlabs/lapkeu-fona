// src/pages/bendahara/PotonganGajiPage.jsx
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
  CheckCircle,
  Wallet,
  Users,
  Clock,
  Building2,
  Save,
  Wand2,
  RotateCcw,
  Info,
  PiggyBank,
  Landmark,
} from "lucide-react";

const BULAN_LIST = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// ─── Default "seperti export PDF": bulan & tahun berjalan ─────
// Dipakai sebagai nilai awal filter, form tambah manual, dan modal input
// per instansi — supaya konsisten dengan periode yang otomatis dipakai
// export PDF saat filter dikosongkan.
const NOW = new Date();
const CURRENT_BULAN = BULAN_LIST[NOW.getMonth()];
const CURRENT_TAHUN = NOW.getFullYear();

const defaultFilters = { bulan: CURRENT_BULAN, tahun: CURRENT_TAHUN, instansi: "" };

// Harus sinkron dengan DEFAULT_SIMPANAN_WAJIB di backend
// (controllers/potonganGajiController.js).
const DEFAULT_SIMPANAN_WAJIB = 180000;

function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString("id-ID");
}

// ─── Sumber Kebenaran Tunggal untuk Field Potongan ─────────────
// Dikelompokkan berurutan (semua "simpanan" dulu, baru "utang") supaya
// tabel batch & form manual bisa menampilkan pengelompokan visual yang
// jelas tanpa logika tambahan — lihat FIELD_GROUPS di bawah.
const FIELD_CONFIG = [
  { key: "simpanan_wajib", label: "Simpanan Wajib", group: "simpanan" },
  { key: "simpanan_sukarela", label: "Simpanan Sukarela", group: "simpanan" },
  { key: "simpanan_pokok", label: "Simpanan Pokok", group: "simpanan" },
  { key: "utang_barang_pokok", label: "Utang Barang Pokok", group: "utang" },
  { key: "utang_barang_jasa", label: "Utang Barang Jasa", group: "utang" },
  { key: "utang_uang_menengah_pokok", label: "Utang Uang Menengah Pokok", group: "utang" },
  { key: "utang_uang_menengah_jasa", label: "Utang Uang Menengah Jasa", group: "utang" },
  { key: "utang_uang_pendek_pokok", label: "Utang Uang Pendek Pokok", group: "utang" },
  { key: "utang_uang_pendek_jasa", label: "Utang Uang Pendek Jasa", group: "utang" },
];

const FIELD_KEYS = FIELD_CONFIG.map((f) => f.key);

// Field cicilan uang menengah yang bisa muncul sebagai "pratinjau otomatis
// dari pinjaman" di modal Input per Instansi (lihat pinjaman_preview), dan
// yang dikunci di form edit manual ketika baris berasal dari pinjaman
// (sumber === "pinjaman").
const PINJAMAN_PREVIEW_FIELDS = ["utang_uang_menengah_pokok", "utang_uang_menengah_jasa"];
const isPinjamanLockedField = (key) => PINJAMAN_PREVIEW_FIELDS.includes(key);

// Info tampilan per grup (dipakai di form manual & tabel batch)
const GROUP_META = {
  simpanan: { label: "Simpanan", icon: PiggyBank, chip: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500" },
  utang: { label: "Utang", icon: Landmark, chip: "bg-amber-50 text-amber-700", bar: "bg-amber-500" },
};

// Dipecah jadi run yang berurutan per grup (dipakai untuk sekat visual di
// form manual, dan colSpan header grup di tabel batch). Karena FIELD_CONFIG
// di atas sudah disusun berurutan per grup, hasilnya cuma 2 entri:
// [{ group: "simpanan", count: 3 }, { group: "utang", count: 6 }].
const FIELD_GROUPS = FIELD_CONFIG.reduce((acc, { group }) => {
  const last = acc[acc.length - 1];
  if (last && last.group === group) {
    last.count += 1;
  } else {
    acc.push({ group, count: 1 });
  }
  return acc;
}, []);

const emptyForm = {
  bulan: "",
  tahun: new Date().getFullYear(),
  keterangan: "",
  metode_potongan: {},
  ...Object.fromEntries(FIELD_KEYS.map((k) => [k, 0])),
};

function rowTotal(row) {
  return FIELD_KEYS.reduce((sum, key) => sum + (parseFloat(row[key]) || 0), 0);
}

function metodeOf(metodeMap, key) {
  return metodeMap && metodeMap[key] === "tukin" ? "tukin" : "gaji";
}

export default function PotonganGajiPage() {
  // ─── State ──────────────────────────────────────────────────
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [filterOpen, setFilterOpen] = useState(true);

  // State untuk dropdown/autocomplete instansi
  const [instansiOptions, setInstansiOptions] = useState([]);

  // Modal form (tambah/edit manual per-anggota)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedAnggota, setSelectedAnggota] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Sumber baris yang sedang diedit ("manual" | "pinjaman" | null). Dipakai
  // untuk mengunci kolom Utang Uang Menengah Pokok/Jasa di form edit kalau
  // baris berasal dari pinjaman — nilainya dihitung otomatis dari sisa
  // angsuran dan tidak boleh diubah manual dari sini.
  const [editingSumber, setEditingSumber] = useState(null);

  // Modal detail
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

  // Modal input per instansi (batch)
  const [instansiModalOpen, setInstansiModalOpen] = useState(false);
  const [selectedInstansi, setSelectedInstansi] = useState("");
  const [instansiBulan, setInstansiBulan] = useState("");
  const [instansiTahun, setInstansiTahun] = useState(new Date().getFullYear());
  const [instansiAnggotaList, setInstansiAnggotaList] = useState([]);
  const [loadingInstansiAnggota, setLoadingInstansiAnggota] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);
  const [instansiError, setInstansiError] = useState("");
  const [bulkSimpananWajib, setBulkSimpananWajib] = useState("");

  const [exporting, setExporting] = useState(false);

  const isEditing = Boolean(editingId);

  // Dipakai untuk membatalkan request yang sudah usang (mencegah race condition)
  const instansiFetchIdRef = useRef(0);

  // ─── Fetch Data ─────────────────────────────────────────────
  const fetchData = useCallback(async (page = 1, activeFilters) => {
    setLoading(true);
    try {
      const params = { page, per_page: 10 };
      if (activeFilters.bulan) params.bulan = activeFilters.bulan;
      if (activeFilters.tahun) params.tahun = activeFilters.tahun;
      if (activeFilters.instansi) params.instansi = activeFilters.instansi;
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

  // ─── Fetch daftar instansi untuk dropdown/autocomplete ───────
  const fetchInstansiOptions = useCallback(async () => {
    try {
      const { data } = await api.get("/potongan-gaji/instansi");
      setInstansiOptions(data.data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchData(1, defaultFilters);
    fetchInstansiOptions();
  }, [fetchData, fetchInstansiOptions]);

  // ─── Ringkasan turunan ──────────────────────────────────────
  const totalHalaman = data.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
  const diprosesHalaman = data.filter((i) => i.is_processed).length;
  const anggotaUnikHalaman = new Set(data.map((i) => i.anggota_id)).size;

  // ─── Filter ─────────────────────────────────────────────────
  const handleFilterChange = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  const applyFilters = () => {
    setAppliedFilters(filters);
    fetchData(1, filters);
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    fetchData(1, defaultFilters);
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
    setEditingSumber(null);
    setSelectedAnggota(null);
    setForm({
      ...emptyForm,
      bulan: appliedFilters.bulan || CURRENT_BULAN,
      tahun: appliedFilters.tahun || CURRENT_TAHUN,
      simpanan_wajib: DEFAULT_SIMPANAN_WAJIB,
      metode_potongan: {},
    });
    setError("");
    setModalOpen(true);
  };

  const openEditForm = (item) => {
    setEditingId(item.id);
    setEditingSumber(item.sumber || "manual");
    setSelectedAnggota({
      id: item.anggota_id,
      no_anggota: item.anggota?.no_anggota || "",
      nama: item.anggota?.nama || "",
    });
    setForm({
      bulan: item.bulan,
      tahun: item.tahun,
      keterangan: item.keterangan || "",
      // Backend mengembalikan metode_potongan lewat field virtual model
      // (alias dari kolom sumber_field) -- normalisasi ke object kosong
      // kalau belum pernah diisi, supaya toggle G/T selalu punya nilai.
      metode_potongan: item.metode_potongan || {},
      ...Object.fromEntries(FIELD_KEYS.map((k) => [k, item[k] || 0])),
    });
    setError("");
    setModalOpen(true);
  };

  const handleFormChange = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const handleFormMetodeChange = (key, metode) =>
    setForm((f) => ({ ...f, metode_potongan: { ...(f.metode_potongan || {}), [key]: metode } }));

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

  // ─── Export Excel ───────────────────────────────────────────
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = {};
      if (appliedFilters.bulan) params.bulan = appliedFilters.bulan;
      if (appliedFilters.tahun) params.tahun = appliedFilters.tahun;
      if (appliedFilters.instansi) params.instansi = appliedFilters.instansi;

      const response = await api.get("/potongan-gaji/export-excel", {
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

  // ─── Export PDF ─────────────────────────────────────────────
  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const params = {};
      if (appliedFilters.bulan) params.bulan = appliedFilters.bulan;
      if (appliedFilters.tahun) params.tahun = appliedFilters.tahun;
      if (appliedFilters.instansi) params.instansi = appliedFilters.instansi;

      const response = await api.get("/potongan-gaji/export-pdf", {
        params,
        responseType: "blob",
      });

      if (response.data.type === "application/json") {
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        alert(errorData.message || "Gagal export PDF");
        return;
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `potongan-gaji-${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      let message = "Gagal export PDF";
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

  // ─── Input per Instansi (batch) ────────────────────────────
  const openInstansiModal = () => {
    setSelectedInstansi("");
    setInstansiBulan(appliedFilters.bulan || CURRENT_BULAN);
    setInstansiTahun(appliedFilters.tahun || CURRENT_TAHUN);
    setInstansiAnggotaList([]);
    setInstansiError("");
    setBulkSimpananWajib("");
    setInstansiModalOpen(true);
    if (instansiOptions.length === 0) fetchInstansiOptions();
  };

  const loadAnggotaByInstansi = useCallback(async (instansi, bulan, tahun) => {
    if (!instansi || !bulan || !tahun) {
      setInstansiAnggotaList([]);
      return;
    }
    const fetchId = ++instansiFetchIdRef.current;
    setLoadingInstansiAnggota(true);
    setInstansiError("");
    try {
      const { data } = await api.get("/potongan-gaji/anggota-by-instansi", {
        params: { instansi, bulan, tahun },
      });
      if (fetchId !== instansiFetchIdRef.current) return;
      // Backend sudah mengisi default (simpanan wajib, simpanan sukarela
      // dari bulan lalu, & pratinjau cicilan pinjaman kalau ada) --
      // tinggal pastikan metode_potongan selalu berupa object.
      const normalized = (data.data || []).map((r) => ({
        ...r,
        metode_potongan: r.metode_potongan || {},
      }));
      setInstansiAnggotaList(normalized);
    } catch (err) {
      if (fetchId !== instansiFetchIdRef.current) return;
      setInstansiError(err.response?.data?.message || "Gagal mengambil data anggota.");
      setInstansiAnggotaList([]);
    } finally {
      if (fetchId === instansiFetchIdRef.current) setLoadingInstansiAnggota(false);
    }
  }, []);

  useEffect(() => {
    if (instansiModalOpen && selectedInstansi && instansiBulan && instansiTahun) {
      loadAnggotaByInstansi(selectedInstansi, instansiBulan, instansiTahun);
      setBulkSimpananWajib("");
    } else if (instansiModalOpen) {
      setInstansiAnggotaList([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInstansi, instansiBulan, instansiTahun, instansiModalOpen]);

  const isRowLocked = (row) => Boolean(row.is_processed);
  const isPreviewField = (row, key) => row.pinjaman_preview && PINJAMAN_PREVIEW_FIELDS.includes(key);
  const isFieldLocked = (row, key) =>
    isRowLocked(row) || (row.sumber === "pinjaman" && PINJAMAN_PREVIEW_FIELDS.includes(key));

  const handleInstansiRowChange = (anggotaId, key, value) => {
    setInstansiAnggotaList((prev) =>
      prev.map((r) => (r.anggota_id === anggotaId ? { ...r, [key]: value } : r))
    );
  };

  const handleInstansiMetodeChange = (anggotaId, key, metode) => {
    setInstansiAnggotaList((prev) =>
      prev.map((r) =>
        r.anggota_id === anggotaId
          ? { ...r, metode_potongan: { ...(r.metode_potongan || {}), [key]: metode } }
          : r
      )
    );
  };

  const setColumnMetodeForAll = (key, metode) => {
    setInstansiAnggotaList((prev) =>
      prev.map((r) => {
        if (isFieldLocked(r, key) || isPreviewField(r, key)) return r;
        return { ...r, metode_potongan: { ...(r.metode_potongan || {}), [key]: metode } };
      })
    );
  };

  // Preset sesuai contoh: Simpanan (wajib/sukarela/pokok) dari Tukin,
  // semua Utang dari Gaji. Cocok untuk instansi yang membayar tukin rutin.
  const applyPresetSimpananTukinUtangGaji = () => {
    setInstansiAnggotaList((prev) =>
      prev.map((r) => {
        if (isRowLocked(r)) return r; // hanya skip kalau sudah diproses
        const metode = { ...(r.metode_potongan || {}) };
        FIELD_CONFIG.forEach(({ key, group }) => {
          if (isPreviewField(r, key) || isFieldLocked(r, key)) return; // skip kolom menengah yg terkunci
          metode[key] = group === "simpanan" ? "tukin" : "gaji";
        });
        return { ...r, metode_potongan: metode };
      })
    );
  };

  const resetMetodeSemua = () => {
    setInstansiAnggotaList((prev) =>
      prev.map((r) => {
        if (isRowLocked(r)) return r;
        const metode = {};
        FIELD_CONFIG.forEach(({ key }) => {
          if (isFieldLocked(r, key)) {
            metode[key] = (r.metode_potongan || {})[key]; // biarkan metode kolom terkunci apa adanya
          }
        });
        return { ...r, metode_potongan: metode };
      })
    );
  };

  const applyBulkSimpananWajib = () => {
    const raw = bulkSimpananWajib.replace(/[^\d]/g, "");
    if (!raw) return;
    setInstansiAnggotaList((prev) =>
      prev.map((r) => (isRowLocked(r) ? r : { ...r, simpanan_wajib: raw }))
    );
  };

  const instansiGrandTotal = instansiAnggotaList.reduce((sum, r) => sum + rowTotal(r), 0);
  const instansiRowsFilled = instansiAnggotaList.filter((r) => rowTotal(r) > 0).length;
  const instansiEditableCount = instansiAnggotaList.filter((r) => !isRowLocked(r)).length;
  const instansiHasPreview = instansiAnggotaList.some((r) => r.pinjaman_preview);

  const handleInstansiBatchSubmit = async () => {
    setInstansiError("");
    const editableRows = instansiAnggotaList.filter((r) => !isRowLocked(r));

    const rowsToSend = editableRows
      .map((r) => {
        // Cicilan uang menengah yang berasal dari pratinjau pinjaman TIDAK
        // ikut dikirim dari sini — baris resminya dibuat lewat alur
        // generate pinjaman terpisah supaya tidak dobel & tetap sinkron
        // dengan sisa_angsuran pinjaman.
        const clean = { ...r };
        if (r.pinjaman_preview) {
          clean.utang_uang_menengah_pokok = 0;
          clean.utang_uang_menengah_jasa = 0;
        }
        return clean;
      })
      .filter((r) => rowTotal(r) > 0)
      .map((r) => {
        const payload = {
          anggota_id: r.anggota_id,
          keterangan: r.keterangan || "",
          metode_potongan: r.metode_potongan || {},
        };
        FIELD_KEYS.forEach((key) => {
          payload[key] = parseFloat(r[key]) || 0;
        });
        return payload;
      });

    if (rowsToSend.length === 0) {
      setInstansiError("Belum ada nilai yang diisi untuk anggota manapun.");
      return;
    }

    setSavingBatch(true);
    try {
      const { data } = await api.post("/potongan-gaji/batch", {
        instansi: selectedInstansi,
        bulan: instansiBulan,
        tahun: instansiTahun,
        data: rowsToSend,
      });
      alert(data.message || "Berhasil disimpan.");
      setInstansiModalOpen(false);
      fetchData(1, appliedFilters);
    } catch (err) {
      setInstansiError(err.response?.data?.message || "Gagal menyimpan data.");
    } finally {
      setSavingBatch(false);
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
            <div className="flex flex-wrap gap-2">
              <button
                onClick={openInstansiModal}
                className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
              >
                <Building2 size={16} />
                Input per Instansi
              </button>
              <button
                onClick={openCreateModal}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus size={16} />
                Tambah Manual
              </button>
            </div>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-xs text-gray-400">
            <Info size={13} className="mt-0.5 shrink-0" />
            Proses ke jurnal sekarang dilakukan dari halaman Transaksi, bukan dari sini.
          </p>
        </div>

        {/* Ringkasan (halaman aktif) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="Anggota (Halaman Ini)"
            value={anggotaUnikHalaman}
            icon={<Users size={18} className="text-blue-600" />}
            color="blue"
          />
          <SummaryCard
            label="Total Potongan (Halaman Ini)"
            value={`Rp ${formatRupiah(totalHalaman)}`}
            icon={<Wallet size={18} className="text-green-600" />}
            color="green"
          />
          <SummaryCard
            label="Sudah Diproses (Halaman Ini)"
            value={`${diprosesHalaman} / ${data.length}`}
            icon={<CheckCircle size={18} className="text-emerald-600" />}
            color="green"
          />
          <SummaryCard
            label="Belum Diproses (Halaman Ini)"
            value={data.length - diprosesHalaman}
            icon={<Clock size={18} className="text-amber-600" />}
            color="amber"
          />
        </div>

        {/* Ringkasan Bulanan (dari server) */}
        {summary.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs font-semibold uppercase text-gray-500 mb-3">Total Potongan per Bulan</p>
            <div className="flex flex-wrap gap-2">
              {summary.map((s) => (
                <span
                  key={`${s.bulan}-${s.tahun}`}
                  className="rounded-lg bg-gray-50 border px-3 py-1.5 text-xs text-gray-600"
                >
                  {s.bulan} {s.tahun}: <span className="font-semibold text-green-700">Rp {formatRupiah(s.total)}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Filter & Export */}
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
                {/* ─── Panel Filter ────────────────────────── */}
                <div className="lg:col-span-2 bg-white rounded-lg p-4 border">
                  <p className="text-xs font-semibold uppercase text-gray-500 flex items-center gap-2 mb-3">
                    <Search size={14} /> Filter Data
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                        placeholder={String(CURRENT_TAHUN)}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Instansi</label>
                      <InstansiAutocomplete
                        value={filters.instansi}
                        onChange={(v) => handleFilterChange("instansi", v)}
                        options={instansiOptions}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
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
                      <XCircle size={15} /> Reset ke {CURRENT_BULAN} {CURRENT_TAHUN}
                    </button>
                  </div>
                </div>

                {/* ─── Panel Export ────────────────────────── */}
                <div className="bg-white rounded-lg p-4 border space-y-3">
                  <p className="text-xs font-semibold uppercase text-gray-500 flex items-center gap-2 mb-1">
                    <FileSpreadsheet size={14} className="text-green-600" /> Export
                  </p>
                  <button
                    onClick={handleExportExcel}
                    disabled={exporting}
                    className="flex items-center justify-center gap-2 px-4 py-2 border border-green-600 text-green-700 rounded-lg text-sm hover:bg-green-50 w-full disabled:opacity-60"
                  >
                    {exporting ? <Loader size={15} className="animate-spin" /> : <Download size={15} />}
                    Export Excel
                  </button>
                  <button
                    onClick={handleExportPdf}
                    disabled={exporting}
                    className="flex items-center justify-center gap-2 px-4 py-2 border border-red-600 text-red-700 rounded-lg text-sm hover:bg-red-50 w-full disabled:opacity-60"
                  >
                    {exporting ? <Loader size={15} className="animate-spin" /> : <FileText size={15} />}
                    Export PDF
                  </button>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <AlertCircle size={12} /> Export mengikuti filter bulan/tahun & instansi di atas. PDF menandai
                    komponen yang dipotong dari Tukin dengan tanda (*).
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
                        {/* Edit boleh untuk manual maupun otomatis (pinjaman)
                            selama belum diproses. Untuk baris pinjaman, kolom
                            Utang Uang Menengah Pokok/Jasa dikunci di dalam
                            form karena dihitung otomatis dari sisa angsuran. */}
                        {!item.is_processed && (
                          <button
                            onClick={() => openEditForm(item)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50"
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        {/* Hapus tetap hanya untuk manual — baris pinjaman
                            harus dihapus lewat alur generate pinjaman supaya
                            sisa angsuran tetap sinkron. */}
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
                  <td colSpan="4" className="px-4 py-3 text-right">TOTAL (Halaman Ini)</td>
                  <td className="px-4 py-3 text-right font-mono text-green-700">Rp {formatRupiah(totalHalaman)}</td>
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
                      onClick={() => openEditForm(item)}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
                    >
                      <Pencil size={15} /> Edit
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
            <PaginationControls pagination={pagination} onGoToPage={goToPage} />
          </div>
        )}
      </div>

      {/* ─── MODAL DETAIL ──────────────────────────────────────── */}
      {detailModalOpen && detailItem && (
        <ModalShell onClose={closeDetailModal}>
          <div className="flex items-center justify-between border-b px-4 py-4 sm:px-6">
            <h3 className="text-lg font-semibold text-gray-800">
              Detail Potongan: {detailItem.anggota?.no_anggota} - {detailItem.anggota?.nama}
            </h3>
            <button onClick={closeDetailModal} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
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

              {/* Rincian dikelompokkan Simpanan / Utang, konsisten dengan
                  pengelompokan di tabel batch & form manual. */}
              {FIELD_GROUPS.map(({ group }) => {
                const meta = GROUP_META[group];
                const GroupIcon = meta.icon;
                const fieldsInGroup = FIELD_CONFIG.filter((f) => f.group === group);
                return (
                  <div key={group} className="overflow-hidden rounded-lg border">
                    <div className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold ${meta.chip}`}>
                      <GroupIcon size={13} /> {meta.label}
                    </div>
                    <table className="min-w-full text-sm">
                      <tbody className="divide-y">
                        {fieldsInGroup.map(({ key, label }) => {
                          const metode = metodeOf(detailItem.metode_potongan, key);
                          return (
                            <tr key={key}>
                              <td className="px-4 py-2.5 text-gray-500">
                                <div className="flex items-center gap-2">
                                  {label}
                                  <span
                                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                      metode === "tukin" ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-500"
                                    }`}
                                  >
                                    {metode === "tukin" ? "Tukin" : "Gaji"}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono">Rp {formatRupiah(detailItem[key])}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}

              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                <span className="text-sm font-medium text-gray-600">Jumlah</span>
                <span className="font-bold text-green-700">Rp {formatRupiah(detailItem.total)}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t px-4 py-4 sm:px-6">
            {!detailItem.is_processed && (
              <>
                {detailItem.sumber === "manual" && (
                  <button
                    onClick={() => deleteFromDetail(detailItem)}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={15} /> Hapus
                  </button>
                )}
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
        </ModalShell>
      )}

      {/* ─── MODAL FORM (TAMBAH/EDIT MANUAL) ──────────────────── */}
      {modalOpen && (
        <ModalShell onClose={() => setModalOpen(false)}>
          <div className="flex items-center justify-between border-b px-4 py-4 sm:px-6">
            <h3 className="text-lg font-semibold text-gray-800">
              {isEditing ? "Edit Potongan" : "Tambah Potongan Manual"}
            </h3>
            <button onClick={() => setModalOpen(false)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            <form id="potongan-form" onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              {isEditing && editingSumber === "pinjaman" && (
                <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  <Info size={14} className="mt-0.5 shrink-0" />
                  Data ini berasal dari pinjaman aktif. Kolom <strong>Utang Uang Menengah Pokok</strong> dan{" "}
                  <strong>Utang Uang Menengah Jasa</strong> dikunci karena dihitung otomatis dari sisa angsuran —
                  ubah lewat menu generate potongan pinjaman, bukan dari sini.
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

              {/* Field dikelompokkan Simpanan / Utang dengan sekat berlabel,
                  supaya 9 input tidak terasa seperti satu tembok datar. Kolom
                  Utang Uang Menengah Pokok/Jasa dikunci kalau baris yang
                  diedit berasal dari pinjaman (sumber === "pinjaman"). */}
              {FIELD_GROUPS.map(({ group }) => {
                const meta = GROUP_META[group];
                const GroupIcon = meta.icon;
                const fieldsInGroup = FIELD_CONFIG.filter((f) => f.group === group);
                return (
                  <div key={group} className="pt-2">
                    <div className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.chip}`}>
                      <GroupIcon size={12} /> {meta.label}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {fieldsInGroup.map(({ key, label }) => {
                        const fieldLocked =
                          isEditing && editingSumber === "pinjaman" && isPinjamanLockedField(key);
                        return (
                          <div key={key}>
                            <div className="mb-1 flex items-center justify-between">
                              <label className="flex items-center gap-1.5 text-sm text-gray-700">
                                {label}
                                {fieldLocked && <Lock size={12} className="text-gray-400" />}
                              </label>
                              <MetodeToggle
                                value={metodeOf(form.metode_potongan, key)}
                                onChange={(m) => handleFormMetodeChange(key, m)}
                                disabled={fieldLocked}
                              />
                            </div>
                            <input
                              type="text"
                              inputMode="numeric"
                              disabled={fieldLocked}
                              value={form[key] ? Number(form[key]).toLocaleString("id-ID") : ""}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^\d]/g, "");
                                handleFormChange(key, raw);
                              }}
                              placeholder="0"
                              className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none ${
                                fieldLocked ? "bg-gray-100 text-gray-400 cursor-not-allowed" : ""
                              }`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Info size={12} /> Tombol <strong>G</strong>/<strong>T</strong> di tiap komponen menandai apakah
                potongan itu diambil dari Gaji atau Tunjangan Kinerja — bisa dicampur bebas per komponen.
              </p>

              <div className="rounded-lg bg-gray-50 px-4 py-3 flex justify-between items-center">
                <span className="text-sm text-gray-500">Total</span>
                <span className="font-bold text-green-700">
                  Rp {formatRupiah(FIELD_KEYS.reduce((s, key) => s + (parseFloat(form[key]) || 0), 0))}
                </span>
              </div>
            </form>
          </div>
          <div className="flex justify-end gap-2 border-t px-4 py-4 sm:px-6">
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
        </ModalShell>
      )}

      {/* ─── MODAL INPUT PER INSTANSI (BATCH) ─────────────────── */}
      {instansiModalOpen && (
        <ModalShell onClose={() => setInstansiModalOpen(false)}>
          <div className="flex items-center justify-between border-b px-4 py-4 sm:px-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Input Potongan per Instansi</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Pilih instansi — simpanan wajib, simpanan sukarela, dan cicilan pinjaman (kalau ada) sudah
                terisi otomatis. Cukup periksa lalu simpan.
              </p>
            </div>
            <button onClick={() => setInstansiModalOpen(false)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 shrink-0">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 space-y-4">
            {instansiError && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                {instansiError}
              </div>
            )}

            {/* Pemilihan instansi / bulan / tahun */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 rounded-lg p-4 border">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Instansi</label>
                <select
                  value={selectedInstansi}
                  onChange={(e) => setSelectedInstansi(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                >
                  <option value="">Pilih instansi…</option>
                  {instansiOptions.map((i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Bulan</label>
                <select
                  value={instansiBulan}
                  onChange={(e) => setInstansiBulan(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                >
                  <option value="">Pilih bulan</option>
                  {BULAN_LIST.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Tahun</label>
                <input
                  type="number"
                  value={instansiTahun}
                  onChange={(e) => setInstansiTahun(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Tabel anggota instansi */}
            {loadingInstansiAnggota ? (
              <div className="text-center py-10 text-gray-400">
                <Loader className="animate-spin inline-block mr-2" size={20} /> Memuat anggota…
              </div>
            ) : !selectedInstansi || !instansiBulan || !instansiTahun ? (
              <div className="text-center py-10 text-gray-400 text-sm">
                Pilih instansi, bulan, dan tahun untuk menampilkan daftar anggota.
              </div>
            ) : instansiAnggotaList.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">
                Tidak ada anggota aktif di instansi ini.
              </div>
            ) : (
              <>
                {/* Override cepat + preset metode */}
                <div className="flex flex-wrap items-end gap-2 rounded-lg border border-purple-200 bg-purple-50 p-3">
                  <div className="min-w-[220px] flex-1">
                    <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-600">
                      <Wand2 size={13} className="text-purple-600" />
                      Ubah Simpanan Wajib untuk Semua Anggota
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={bulkSimpananWajib ? Number(bulkSimpananWajib).toLocaleString("id-ID") : ""}
                      onChange={(e) => setBulkSimpananWajib(e.target.value.replace(/[^\d]/g, ""))}
                      placeholder={`Default: ${DEFAULT_SIMPANAN_WAJIB.toLocaleString("id-ID")}`}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={applyBulkSimpananWajib}
                    disabled={!bulkSimpananWajib || instansiEditableCount === 0}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    Terapkan ke Semua ({instansiEditableCount})
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  Simpanan Wajib sudah otomatis diisi <strong>Rp {formatRupiah(DEFAULT_SIMPANAN_WAJIB)}</strong> dan
                  Simpanan Sukarela mengikuti nilai bulan lalu masing-masing anggota — sama seperti komponen lain,
                  nilainya sudah terisi otomatis tapi tetap bisa diubah langsung di kotak input pada tabel. Gunakan
                  kotak di atas kalau mau mengganti nilai Simpanan Wajib yang sama untuk semua anggota sekaligus.
                </p>

                {/* Preset metode gaji/tukin */}
                <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-3">
                  <span className="text-xs font-medium text-gray-600 mr-1">Metode Potongan:</span>
                  <button
                    type="button"
                    onClick={applyPresetSimpananTukinUtangGaji}
                    className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100"
                  >
                    Preset: Simpanan dari Tukin, Utang dari Gaji
                  </button>
                  <button
                    type="button"
                    onClick={resetMetodeSemua}
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    <RotateCcw size={12} className="inline mr-1 -mt-0.5" />
                    Reset Semua ke Gaji
                  </button>
                  <span className="text-xs text-gray-400">
                    atau atur per komponen lewat tombol <strong>Semua G</strong>/<strong>Semua T</strong> di judul
                    kolom, maupun tombol <strong>G</strong>/<strong>T</strong> per anggota di tabel.
                  </span>
                </div>

                {instansiHasPreview && (
                  <p className="flex items-start gap-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    <Info size={13} className="mt-0.5 shrink-0" />
                    Kolom Utang Uang Menengah bertanda <strong>"Otomatis pinjaman"</strong> hanya pratinjau cicilan
                    dari pinjaman aktif anggota. Nilai itu tidak ikut tersimpan dari sini — baris resminya dibuat
                    lewat menu generate potongan pinjaman, supaya sisa angsuran tetap sinkron.
                  </p>
                )}

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{instansiAnggotaList.length} anggota &middot; {instansiRowsFilled} baris sudah diisi</span>
                  <span className="font-semibold text-green-700">Total: Rp {formatRupiah(instansiGrandTotal)}</span>
                </div>
                <div className="overflow-auto max-h-[65vh] rounded-lg border">
                  <table className="min-w-full text-sm">
                    <thead className="text-gray-600 sticky top-0 z-10">
                      {/* Baris grup: label Simpanan / Utang membentang di atas
                          kolom-kolom terkait, supaya tabel yang lebar (9 kolom
                          input) tetap terbaca sekilas tanpa harus mengikuti
                          tiap header satu-satu. */}
                      <tr>
                        <th
                          rowSpan={2}
                          className="px-3 py-2 text-left sticky left-0 top-0 bg-gray-100 min-w-[180px] z-20 border-r align-bottom"
                        >
                          Anggota
                        </th>
                        {FIELD_GROUPS.map(({ group, count }) => {
                          const meta = GROUP_META[group];
                          const GroupIcon = meta.icon;
                          return (
                            <th
                              key={group}
                              colSpan={count}
                              className={`px-2 py-1.5 text-center text-xs font-semibold border-b border-l ${meta.chip}`}
                            >
                              <span className="inline-flex items-center gap-1">
                                <GroupIcon size={12} /> {meta.label}
                              </span>
                            </th>
                          );
                        })}
                        <th rowSpan={2} className="px-3 py-2 text-right whitespace-nowrap bg-gray-50 align-bottom">Total</th>
                        <th rowSpan={2} className="px-3 py-2 text-center whitespace-nowrap bg-gray-50 align-bottom">Status</th>
                      </tr>
                      <tr className="bg-gray-50">
                        {FIELD_CONFIG.map(({ key, label, group }, idx) => {
                          const isGroupStart = idx === 0 || FIELD_CONFIG[idx - 1].group !== group;
                          return (
                            <th
                              key={key}
                              className={`px-2 py-2 text-right whitespace-nowrap min-w-[160px] align-top ${
                                isGroupStart ? "border-l" : ""
                              }`}
                            >
                              <div>{label}</div>
                              <div className="mt-1 flex justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => setColumnMetodeForAll(key, "gaji")}
                                  className="rounded border bg-white px-1.5 py-0.5 text-[10px] font-normal text-gray-500 hover:bg-gray-50"
                                  title="Set kolom ini ke Gaji untuk semua anggota"
                                >
                                  Semua G
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setColumnMetodeForAll(key, "tukin")}
                                  className="rounded border bg-white px-1.5 py-0.5 text-[10px] font-normal text-gray-500 hover:bg-gray-50"
                                  title="Set kolom ini ke Tukin untuk semua anggota"
                                >
                                  Semua T
                                </button>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {instansiAnggotaList.map((row) => {
                        const locked = isRowLocked(row); // tetap dipakai untuk styling baris yg sudah diproses
                        return (
                          <tr key={row.anggota_id} className={locked ? "bg-gray-50" : "hover:bg-gray-50"}>
                            <td className="px-3 py-2 sticky left-0 bg-white min-w-[180px] border-r align-top">
                              <p className="font-medium text-gray-800">{row.nama}</p>
                              <p className="text-xs text-gray-400">{row.no_anggota}</p>
                            </td>
                            {FIELD_CONFIG.map(({ key, group }, idx) => {
                              const isGroupStart = idx === 0 || FIELD_CONFIG[idx - 1].group !== group;
                              const preview = isPreviewField(row, key);
                              const fieldLocked = isFieldLocked(row, key);

                              // Semua kolom (termasuk Simpanan Wajib &
                              // Simpanan Sukarela) dirender seragam: input
                              // angka + toggle G/T. Nilai default (dari
                              // backend: DEFAULT_SIMPANAN_WAJIB & simpanan
                              // sukarela bulan lalu) sudah terisi di
                              // row[key] sejak awal — tidak ada tombol reset
                              // khusus lagi, sama seperti kolom Utang.
                              return (
                                <td key={key} className={`px-2 py-2 align-top ${isGroupStart ? "border-l" : ""}`}>
                                  {preview ? (
                                    <div className="w-32">
                                      <div className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-right text-sm font-mono text-blue-700">
                                        {formatRupiah(row[key])}
                                      </div>
                                      <p className="mt-0.5 text-[10px] text-blue-500 leading-tight">Otomatis pinjaman</p>
                                    </div>
                                  ) : (
                                    <>
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        disabled={fieldLocked}
                                        value={row[key] ? Number(row[key]).toLocaleString("id-ID") : ""}
                                        onChange={(e) => {
                                          const raw = e.target.value.replace(/[^\d]/g, "");
                                          handleInstansiRowChange(row.anggota_id, key, raw);
                                        }}
                                        placeholder="0"
                                        className={`w-28 text-right border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-purple-500 ${
                                          fieldLocked ? "bg-gray-100 text-gray-400 cursor-not-allowed" : ""
                                        }`}
                                      />
                                      {!fieldLocked && (
                                        <div className="mt-1 flex justify-end">
                                          <MetodeToggle
                                            value={metodeOf(row.metode_potongan, key)}
                                            onChange={(m) => handleInstansiMetodeChange(row.anggota_id, key, m)}
                                          />
                                        </div>
                                      )}
                                    </>
                                  )}
                                </td>
                              );
                            })}

                            <td className="px-3 py-2 text-right font-mono font-semibold text-green-700 align-top">
                              {formatRupiah(rowTotal(row))}
                            </td>
                            <td className="px-3 py-2 text-center align-top">
                              {row.is_processed ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                  Diproses
                                </span>
                              ) : row.sumber === "pinjaman" ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                  Pinjaman
                                </span>
                              ) : row.sumber === "manual" ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                  Sudah diisi
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                                  Belum diisi
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-400">
                  Baris berstatus <strong>Diproses</strong> terkunci sepenuhnya dan tidak bisa diubah dari sini. Baris
                  berstatus <strong>Pinjaman</strong> hanya mengunci kolom <strong>Utang Uang Menengah</strong> (pokok & jasa)
                  — kolom simpanan dan utang lainnya tetap bisa diisi/diubah. Baris <strong>Sudah diisi</strong> (manual,
                  belum diproses) akan diperbarui kalau nilainya diubah. Baris kosong akan dilewati otomatis.
                </p>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t px-4 py-4 sm:px-6">
            <button
              type="button"
              onClick={() => setInstansiModalOpen(false)}
              className="rounded-lg border px-5 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleInstansiBatchSubmit}
              disabled={savingBatch || instansiAnggotaList.length === 0}
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
            >
              {savingBatch ? (
                "Menyimpan…"
              ) : (
                <>
                  <Save size={16} /> Simpan Semua
                </>
              )}
            </button>
          </div>
        </ModalShell>
      )}
    </DashboardLayout>
  );
}

// ─── Kerangka Modal (full layar di semua ukuran) ───────────────
// Dipakai oleh ketiga modal (Detail, Form, Input per Instansi) supaya
// perilakunya konsisten: klik di backdrop tidak lagi relevan karena modal
// menutupi seluruh layar, tapi tetap dipertahankan (stopPropagation di
// panel) untuk jaga-jaga kalau nanti mode non-fullscreen diaktifkan lagi.
// Body pemanggil tetap mengurus scroll-nya sendiri lewat elemen
// `flex-1 overflow-y-auto` di dalam.
function ModalShell({ onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full flex-1 flex-col overflow-hidden bg-white"
      >
        {children}
      </div>
    </div>
  );
}

// ─── Toggle Metode Potongan (Gaji / Tukin) ─────────────────────
function MetodeToggle({ value, onChange, disabled }) {
  return (
    <div
      className={`inline-flex overflow-hidden rounded border text-[10px] ${disabled ? "opacity-40" : ""}`}
      title="Sumber potongan: Gaji atau Tunjangan Kinerja (Tukin)"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("gaji")}
        className={`px-1.5 py-0.5 ${
          value === "gaji" ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
        }`}
      >
        G
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("tukin")}
        className={`border-l px-1.5 py-0.5 ${
          value === "tukin" ? "bg-purple-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
        }`}
      >
        T
      </button>
    </div>
  );
}

// ─── Autocomplete Instansi (untuk panel Filter) ────────────────
function InstansiAutocomplete({ value, onChange, options, placeholder = "Cari instansi…" }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  const handlePick = (opt) => {
    onChange(opt);
    setQuery(opt);
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-lg border py-2 pl-8 pr-7 text-sm focus:ring-2 focus:ring-blue-500"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <XCircle size={14} />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border bg-white shadow-lg">
          <button
            type="button"
            onClick={handleClear}
            className="flex w-full items-center border-b px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
          >
            Semua Instansi
          </button>
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">Instansi tidak ditemukan.</p>
          ) : (
            filtered.map((opt) => (
              <button
                type="button"
                key={opt}
                onClick={() => handlePick(opt)}
                className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                {opt}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Komponen Pencarian Anggota ──────────────────────────────
function AnggotaSearchInput({ selected, onSelect }) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const timeoutRef = useRef(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

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
      const requestId = ++requestIdRef.current;
      setSearching(true);
      try {
        const { data } = await api.get("/anggota", {
          params: { search: val, status: "aktif", per_page: 8 },
        });
        if (requestId !== requestIdRef.current) return;
        setOptions(data.data || []);
        setOpen(true);
      } finally {
        if (requestId === requestIdRef.current) setSearching(false);
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

// ─── Kontrol Pagination ────────────────────────────────────────
function PaginationControls({ pagination, onGoToPage }) {
  const { page, total_pages } = pagination;

  const pages = [];
  const windowSize = 1;
  for (let p = 1; p <= total_pages; p++) {
    const isEdge = p === 1 || p === total_pages;
    const isNearCurrent = Math.abs(p - page) <= windowSize;
    if (isEdge || isNearCurrent) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        onClick={() => onGoToPage(page - 1)}
        disabled={page <= 1}
        className="h-8 px-3 rounded-lg border text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50"
      >
        Sebelumnya
      </button>
      <div className="flex flex-wrap gap-1.5">
        {pages.map((p, idx) =>
          p === "…" ? (
            <span key={`ellipsis-${idx}`} className="flex h-8 w-8 items-center justify-center text-sm text-gray-400">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onGoToPage(p)}
              className={`h-8 w-8 rounded-lg text-sm ${
                p === page ? "bg-blue-600 text-white" : "border hover:bg-gray-50"
              }`}
            >
              {p}
            </button>
          )
        )}
      </div>
      <button
        onClick={() => onGoToPage(page + 1)}
        disabled={page >= total_pages}
        className="h-8 px-3 rounded-lg border text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50"
      >
        Berikutnya
      </button>
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