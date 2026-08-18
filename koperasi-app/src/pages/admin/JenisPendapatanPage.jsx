import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import {
  TrendingUp,
  Plus,
  Pencil,
  Trash2,
  X,
  GripVertical,
  Eye,
  EyeOff,
  Tag,
  AlertCircle,
  Lock,
  Link,
} from "lucide-react";

const emptyForm = { kode: "", nama: "", akun_id: "", urutan: "" };

export default function JenisPendapatanPage() {
  const [data, setData] = useState([]);
  const [akunList, setAkunList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [akunSearch, setAkunSearch] = useState("");
  const [showAkunSuggestions, setShowAkunSuggestions] = useState(false);

  const [deleteItem, setDeleteItem] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const isEditing = Boolean(editingId);

  const fetchData = useCallback(async (showInactive) => {
    setLoading(true);
    try {
      const { data } = await api.get("/pengaturan/jenis-pendapatan", {
        params: { include_inactive: showInactive ? "true" : "false" },
      });
      setData(data.data);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAkun = useCallback(async () => {
    try {
      const { data } = await api.get("/akun/list");
      setAkunList(data.data || []);
    } catch (err) {
      console.error("Gagal mengambil daftar akun:", err);
    }
  }, []);

  useEffect(() => {
    fetchData(includeInactive);
    fetchAkun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive]);

  const filteredAkun = akunList.filter((akun) => {
    const search = akunSearch.toLowerCase().trim();
    if (!search) return true;
    return (
      akun.kode_akun?.toLowerCase().includes(search) ||
      akun.nama_akun?.toLowerCase().includes(search)
    );
  });

  const selectAkun = (akun) => {
    setForm({ ...form, akun_id: akun.id });
    setAkunSearch(`${akun.kode_akun} – ${akun.nama_akun}`);
    setShowAkunSuggestions(false);
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setAkunSearch("");
    setError("");
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setForm({
      kode: item.kode || "",
      nama: item.nama || "",
      akun_id: item.akun_id || "",
      urutan: item.urutan ?? "",
    });
    if (item.akun) {
      setAkunSearch(`${item.akun.kode_akun} – ${item.akun.nama_akun}`);
    } else {
      setAkunSearch("");
    }
    setError("");
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isEditing) {
      if (!form.kode.trim()) {
        setError("Kode jenis pendapatan wajib diisi.");
        return;
      }
      if (!form.akun_id) {
        setError("Akun pendapatan wajib dipilih.");
        return;
      }
    }
    if (!form.nama.trim()) {
      setError("Nama jenis pendapatan wajib diisi.");
      return;
    }

    setError("");
    setSaving(true);
    try {
      let payload;

      if (isEditing) {
        payload = {
          nama: form.nama.trim(),
          ...(form.urutan !== "" ? { urutan: Number(form.urutan) } : {}),
        };
        await api.put(`/pengaturan/jenis-pendapatan/${editingId}`, payload);
      } else {
        payload = {
          kode: form.kode.trim().toUpperCase(),
          nama: form.nama.trim(),
          akun_id: Number(form.akun_id),
          ...(form.urutan !== "" ? { urutan: Number(form.urutan) } : {}),
        };
        await api.post("/pengaturan/jenis-pendapatan", payload);
      }

      setModalOpen(false);
      fetchData(includeInactive);
    } catch (err) {
      setError(err.response?.data?.message || "Terjadi kesalahan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item) => {
    try {
      await api.put(`/pengaturan/jenis-pendapatan/${item.id}`, {
        is_active: !item.is_active,
      });
      fetchData(includeInactive);
    } catch (err) {
      alert(err.response?.data?.message || "Gagal mengubah status.");
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      await api.delete(`/pengaturan/jenis-pendapatan/${deleteItem.id}`);
      setDeleteItem(null);
      fetchData(includeInactive);
    } catch (err) {
      alert(err.response?.data?.message || "Gagal menghapus jenis pendapatan.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Jenis Pendapatan</h2>
            <p className="text-sm text-gray-500">
              Kelola kategori pendapatan yang tersedia untuk koperasi.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            Tambah Jenis
          </button>
        </div>

        {/* Toggle tampilkan nonaktif */}
        <label className="flex w-fit items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Tampilkan jenis pendapatan nonaktif
        </label>

        {/* Daftar jenis pendapatan */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          {loading ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">Memuat…</p>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
              <TrendingUp size={28} className="text-gray-300" />
              <p className="text-sm text-gray-400">Belum ada jenis pendapatan.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {data.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="hidden text-gray-300 sm:block">
                      <GripVertical size={16} />
                    </span>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <TrendingUp size={16} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">
                        <span className="mr-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-600">
                          {item.kode}
                        </span>
                        {item.nama}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Tag size={11} />
                          {item.kolom_key}
                        </span>
                        <span className="flex items-center gap-1">
                          <Link size={11} />
                          {item.akun?.kode_akun || "—"} ·{" "}
                          {item.akun?.nama_akun || "Akun tidak ditemukan"}
                        </span>
                        <span>Urutan {item.urutan}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        item.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {item.is_active ? "Aktif" : "Nonaktif"}
                    </span>

                    <button
                      onClick={() => toggleActive(item)}
                      title={item.is_active ? "Nonaktifkan" : "Aktifkan"}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
                    >
                      {item.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button
                      onClick={() => openEditModal(item)}
                      title="Edit"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteItem(item)}
                      title="Hapus"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Modal Tambah/Edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
          <button
            onClick={() => setModalOpen(false)}
            className="fixed right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            aria-label="Tutup"
          >
            <X size={22} />
          </button>

          <div className="flex min-h-full items-center justify-center px-4 py-16">
            <div className="w-full max-w-md">
              <h3 className="mb-6 text-xl font-semibold text-gray-800">
                {isEditing ? "Edit Jenis Pendapatan" : "Tambah Jenis Pendapatan"}
              </h3>

              {error && (
                <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-sm text-gray-700">
                    Kode <span className="text-red-500">*</span>
                    {isEditing && <Lock size={12} className="text-gray-400" />}
                  </label>
                  <input
                    type="text"
                    value={form.kode}
                    onChange={(e) =>
                      setForm({ ...form, kode: e.target.value.toUpperCase() })
                    }
                    placeholder="Contoh: PD"
                    disabled={isEditing}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                    autoFocus={!isEditing}
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    {isEditing
                      ? "Kode tidak dapat diubah setelah dibuat."
                      : "Kode unik untuk identifikasi bisnis (contoh: PD, PL, PS)."}
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-700">
                    Nama Jenis Pendapatan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.nama}
                    onChange={(e) => setForm({ ...form, nama: e.target.value })}
                    placeholder="Contoh: Pendapatan Jasa"
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    autoFocus={isEditing}
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Kolom_key (identifier teknis) akan dibuat otomatis dari nama
                    ini.
                  </p>
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-sm text-gray-700">
                    Akun Pendapatan <span className="text-red-500">*</span>
                    {isEditing && <Lock size={12} className="text-gray-400" />}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={akunSearch}
                      onChange={(e) => {
                        setAkunSearch(e.target.value);
                        setShowAkunSuggestions(true);
                        if (e.target.value === "") {
                          setForm({ ...form, akun_id: "" });
                        }
                      }}
                      onFocus={() => setShowAkunSuggestions(true)}
                      onBlur={() =>
                        setTimeout(() => setShowAkunSuggestions(false), 200)
                      }
                      placeholder="Cari akun berdasarkan kode atau nama..."
                      disabled={isEditing}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                    />
                    {!isEditing && showAkunSuggestions && (
                      <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border bg-white shadow-lg">
                        {filteredAkun.length > 0 ? (
                          filteredAkun.map((akun) => (
                            <li
                              key={akun.id}
                              onMouseDown={() => selectAkun(akun)}
                              className="cursor-pointer px-3 py-2 text-sm hover:bg-gray-100"
                            >
                              {akun.kode_akun} – {akun.nama_akun}
                            </li>
                          ))
                        ) : (
                          <li className="px-3 py-2 text-sm text-gray-500">
                            {akunSearch.trim() === ""
                              ? "Ketik untuk mencari akun..."
                              : "Akun tidak ditemukan"}
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                  {isEditing && (
                    <p className="mt-1 text-xs text-gray-400">
                      Akun tidak dapat diubah setelah dibuat.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-700">
                    Urutan Tampil (opsional)
                  </label>
                  <input
                    type="number"
                    value={form.urutan}
                    onChange={(e) => setForm({ ...form, urutan: e.target.value })}
                    placeholder="Otomatis di urutan terakhir"
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {saving ? "Menyimpan…" : "Simpan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Konfirmasi hapus */}
      {deleteItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
          <button
            onClick={() => setDeleteItem(null)}
            className="fixed right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            aria-label="Tutup"
          >
            <X size={22} />
          </button>

          <div className="flex min-h-full items-center justify-center px-4 py-16">
            <div className="w-full max-w-sm text-center">
              <p className="mb-1 text-gray-700">
                Yakin ingin menghapus jenis pendapatan{" "}
                <span className="font-semibold">{deleteItem.nama}</span>?
              </p>
              <p className="mb-4 text-xs text-gray-400">
                Data transaksi yang sudah terkait jenis ini tidak akan ikut
                terhapus.
              </p>
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setDeleteItem(null)}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Batal
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-60"
                >
                  {deleting ? "Menghapus…" : "Hapus"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}