// src/pages/TokoPage.jsx
import { useEffect, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import {
  Plus, Pencil, Trash2, X, Search, Package, TrendingUp, DollarSign,
  ShoppingCart, AlertCircle, Eye
} from "lucide-react";

// ─── Komponen pembantu ──────────────────────────────────────
function SummaryCard({ label, value, icon: Icon, color }) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    purple: "bg-purple-50 text-purple-700",
  };
  return (
    <div className={`rounded-xl p-4 shadow-sm ${colorMap[color]}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
        {Icon && <Icon size={18} className="opacity-60" />}
      </div>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange = () => {}, type = "text", full = false, readOnly = false, placeholder = "" }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="mb-1 block text-sm text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
        className={`w-full rounded-lg border px-3 py-2 text-sm ${readOnly ? "bg-gray-50 text-gray-700" : ""}`}
      />
    </div>
  );
}

// ─── Halaman Utama ──────────────────────────────────────────
export default function TokoPage() {
  const location = useLocation();
  const path = location.pathname;

  // Tentukan halaman aktif berdasarkan path
  const page = path.includes("/stok") ? "stok" : path.includes("/penjualan") ? "penjualan" : "beranda";

  // ─── State untuk Stok Barang ──────────────────────────────
  const [barang, setBarang] = useState([]);
  const [barangLoading, setBarangLoading] = useState(false);
  const [barangFilters, setBarangFilters] = useState({ search: "" });
  const [modalBarangOpen, setModalBarangOpen] = useState(false);
  const [editingBarang, setEditingBarang] = useState(null);
  const [formBarang, setFormBarang] = useState({ kode_barang: "", nama_barang: "", satuan: "Pcs", stok_awal: 0, harga_awal: 0 });
  const [deleteBarangId, setDeleteBarangId] = useState(null);

  // ─── State untuk Pembelian ─────────────────────────────────
  const [modalPembelianOpen, setModalPembelianOpen] = useState(false);
  const [formPembelian, setFormPembelian] = useState({ barang_id: "", jumlah: 1, harga_beli: 0, supplier: "", tanggal: "" });

  // ─── State untuk Penjualan ────────────────────────────────
  const [penjualanItems, setPenjualanItems] = useState([{ barang_id: "", jumlah: 1, harga_jual: 0 }]);
  const [formPenjualan, setFormPenjualan] = useState({ tanggal: "", deskripsi: "", anggota_id: "" });
  const [penjualanLoading, setPenjualanLoading] = useState(false);
  const [riwayatPenjualan, setRiwayatPenjualan] = useState([]);
  const [riwayatLoading, setRiwayatLoading] = useState(false);

  // ─── State untuk dropdown ──────────────────────────────────
  const [barangOptions, setBarangOptions] = useState([]);
  const [anggotaOptions, setAnggotaOptions] = useState([]);

  // ─── Fetch data awal ──────────────────────────────────────
  useEffect(() => {
    fetchBarang();
    fetchAnggota();
    fetchRiwayatPenjualan();
  }, []);

  const fetchBarang = async () => {
    setBarangLoading(true);
    try {
      const { data } = await api.get("/persediaan");
      setBarang(data.data);
      setBarangOptions(data.data.map((b) => ({ value: b.id, label: `${b.kode_barang} - ${b.nama_barang} (stok: ${b.stok_awal})` })));
    } catch (err) {
      console.error("Gagal ambil barang:", err);
    } finally {
      setBarangLoading(false);
    }
  };

  const fetchAnggota = async () => {
    try {
      const { data } = await api.get("/anggota?per_page=999");
      setAnggotaOptions(data.data.map((a) => ({ value: a.id, label: `${a.no_anggota} - ${a.nama}` })));
    } catch (err) {
      console.error("Gagal ambil anggota:", err);
    }
  };

  const fetchRiwayatPenjualan = async () => {
    setRiwayatLoading(true);
    try {
      const { data } = await api.get("/transaksi?unit_usaha=Waserda&per_page=20");
      setRiwayatPenjualan(data.data || []);
    } catch (err) {
      console.error("Gagal ambil riwayat:", err);
    } finally {
      setRiwayatLoading(false);
    }
  };

  // ─── CRUD Barang ───────────────────────────────────────────
  const handleBarangSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBarang) {
        await api.put(`/persediaan/${editingBarang}`, formBarang);
      } else {
        await api.post("/persediaan", formBarang);
      }
      setModalBarangOpen(false);
      fetchBarang();
    } catch (err) {
      alert(err.response?.data?.message || "Gagal menyimpan barang");
    }
  };

  const handleDeleteBarang = async () => {
    try {
      await api.delete(`/persediaan/${deleteBarangId}`);
      setDeleteBarangId(null);
      fetchBarang();
    } catch (err) {
      alert(err.response?.data?.message || "Gagal hapus barang");
    }
  };

  const openEditBarang = (item) => {
    setEditingBarang(item.id);
    setFormBarang({
      kode_barang: item.kode_barang,
      nama_barang: item.nama_barang,
      satuan: item.satuan,
      stok_awal: item.stok_awal,
      harga_awal: item.harga_awal,
    });
    setModalBarangOpen(true);
  };

  const openPembelian = (barangId) => {
    setFormPembelian({ barang_id: barangId, jumlah: 1, harga_beli: 0, supplier: "", tanggal: new Date().toISOString().slice(0, 10) });
    setModalPembelianOpen(true);
  };

  const handlePembelianSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/persediaan/pembelian", formPembelian);
      setModalPembelianOpen(false);
      fetchBarang();
    } catch (err) {
      alert(err.response?.data?.message || "Gagal mencatat pembelian");
    }
  };

  // ─── Penjualan ─────────────────────────────────────────────
  const addPenjualanItem = () => {
    setPenjualanItems([...penjualanItems, { barang_id: "", jumlah: 1, harga_jual: 0 }]);
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

  const totalPenjualan = penjualanItems.reduce((sum, item) => sum + (item.jumlah * item.harga_jual), 0);

  const handlePenjualanSubmit = async (e) => {
    e.preventDefault();
    if (penjualanItems.some((i) => !i.barang_id || i.jumlah <= 0 || i.harga_jual <= 0)) {
      alert("Lengkapi semua item penjualan");
      return;
    }
    setPenjualanLoading(true);
    try {
      await api.post("/persediaan/penjualan", {
        tanggal: formPenjualan.tanggal || new Date().toISOString().slice(0, 10),
        deskripsi: formPenjualan.deskripsi || "Penjualan Waserda",
        anggota_id: formPenjualan.anggota_id || null,
        kode_referensi_id: 11, // sesuaikan dengan id referensi penjualan di DB
        items: penjualanItems.map((i) => ({
          barang_id: i.barang_id,
          jumlah: i.jumlah,
          harga_jual: i.harga_jual,
        })),
      });
      alert("Penjualan berhasil dicatat!");
      setPenjualanItems([{ barang_id: "", jumlah: 1, harga_jual: 0 }]);
      setFormPenjualan({ tanggal: "", deskripsi: "", anggota_id: "" });
      fetchBarang();
      fetchRiwayatPenjualan();
    } catch (err) {
      alert(err.response?.data?.message || "Gagal mencatat penjualan");
    } finally {
      setPenjualanLoading(false);
    }
  };

  // ─── Render berdasarkan halaman ────────────────────────────
  const renderContent = () => {
    switch (page) {
      case "stok":
        return renderStok();
      case "penjualan":
        return renderPenjualan();
      default:
        return renderBeranda();
    }
  };

  // ─── Beranda ───────────────────────────────────────────────
  const renderBeranda = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard label="Total Barang" value={barang.length} icon={Package} color="blue" />
        <SummaryCard label="Total Stok" value={barang.reduce((s, b) => s + b.stok_awal, 0)} icon={Package} color="green" />
        <SummaryCard label="Penjualan Hari Ini" value={riwayatPenjualan.filter(t => t.tanggal === new Date().toISOString().slice(0,10)).length} icon={TrendingUp} color="amber" />
        <SummaryCard label="Pendapatan Hari Ini" value={`Rp ${riwayatPenjualan.filter(t => t.tanggal === new Date().toISOString().slice(0,10)).reduce((s, t) => s + (t.jumlah || 0), 0).toLocaleString()}`} icon={DollarSign} color="purple" />
      </div>
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-gray-800">Aktivitas Terakhir</h3>
        {riwayatLoading ? (
          <p className="py-4 text-gray-400">Memuat...</p>
        ) : riwayatPenjualan.length === 0 ? (
          <p className="py-4 text-gray-400">Belum ada transaksi penjualan.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {riwayatPenjualan.slice(0, 5).map((trx) => (
              <li key={trx.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{trx.no_transaksi}</p>
                  <p className="text-sm text-gray-500">{trx.deskripsi}</p>
                </div>
                <span className="font-semibold text-green-600">Rp {trx.jumlah?.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  // ─── Stok Barang ───────────────────────────────────────────
  const renderStok = () => (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          <input
            type="text"
            placeholder="Cari barang..."
            value={barangFilters.search}
            onChange={(e) => setBarangFilters({ ...barangFilters, search: e.target.value })}
            className="max-w-sm flex-1 rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={() => {
              setBarangFilters({ search: "" });
              fetchBarang();
            }}
            className="rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <Search size={16} />
          </button>
        </div>
        <button
          onClick={() => {
            setEditingBarang(null);
            setFormBarang({ kode_barang: "", nama_barang: "", satuan: "Pcs", stok_awal: 0, harga_awal: 0 });
            setModalBarangOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          <Plus size={16} /> Tambah Barang
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3">Kode</th>
              <th className="px-4 py-3">Nama Barang</th>
              <th className="px-4 py-3">Satuan</th>
              <th className="px-4 py-3 text-right">Stok</th>
              <th className="px-4 py-3 text-right">Harga Rata-rata</th>
              <th className="px-4 py-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {barangLoading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Memuat...</td></tr>
            ) : barang.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Belum ada barang.</td></tr>
            ) : (
              barang.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3 font-medium">{b.kode_barang}</td>
                  <td className="px-4 py-3">{b.nama_barang}</td>
                  <td className="px-4 py-3">{b.satuan}</td>
                  <td className="px-4 py-3 text-right font-semibold">{b.stok_awal}</td>
                  <td className="px-4 py-3 text-right">Rp {b.harga_awal?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-1.5">
                      <button
                        onClick={() => openPembelian(b.id)}
                        className="rounded-lg p-1.5 text-green-600 hover:bg-green-50"
                        title="Tambah stok"
                      >
                        <Plus size={16} />
                      </button>
                      <button
                        onClick={() => openEditBarang(b)}
                        className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteBarangId(b.id)}
                        className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
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
    </div>
  );

  // ─── Penjualan ─────────────────────────────────────────────
  const renderPenjualan = () => (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Form Penjualan */}
      <div className="lg:col-span-2">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">Form Penjualan</h3>
          <form onSubmit={handlePenjualanSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Tanggal"
                type="date"
                value={formPenjualan.tanggal}
                onChange={(v) => setFormPenjualan({ ...formPenjualan, tanggal: v })}
              />
              <div>
                <label className="mb-1 block text-sm text-gray-700">Anggota (opsional)</label>
                <select
                  value={formPenjualan.anggota_id}
                  onChange={(e) => setFormPenjualan({ ...formPenjualan, anggota_id: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">Tidak ada</option>
                  {anggotaOptions.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <Field
              label="Deskripsi"
              value={formPenjualan.deskripsi}
              onChange={(v) => setFormPenjualan({ ...formPenjualan, deskripsi: v })}
              placeholder="Penjualan Waserda..."
              full
            />

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Item Penjualan</label>
              {penjualanItems.map((item, idx) => (
                <div key={idx} className="flex flex-wrap items-end gap-2 border-b pb-2">
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs text-gray-500">Barang</label>
                    <select
                      value={item.barang_id}
                      onChange={(e) => updatePenjualanItem(idx, "barang_id", e.target.value)}
                      className="w-full rounded-lg border px-2 py-1 text-sm"
                    >
                      <option value="">Pilih...</option>
                      {barangOptions.map((b) => (
                        <option key={b.value} value={b.value}>{b.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-20">
                    <label className="block text-xs text-gray-500">Jml</label>
                    <input
                      type="number"
                      min="1"
                      value={item.jumlah}
                      onChange={(e) => updatePenjualanItem(idx, "jumlah", parseInt(e.target.value) || 1)}
                      className="w-full rounded-lg border px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-xs text-gray-500">Harga Jual</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={item.harga_jual}
                      onChange={(e) => updatePenjualanItem(idx, "harga_jual", parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border px-2 py-1 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removePenjualanItem(idx)}
                    className="mb-0.5 rounded-lg p-1 text-red-500 hover:bg-red-50"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addPenjualanItem}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
              >
                <Plus size={14} /> Tambah item
              </button>
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <span className="text-sm text-gray-600">Total Penjualan:</span>
              <span className="text-xl font-bold text-green-600">Rp {totalPenjualan.toLocaleString()}</span>
            </div>

            <button
              type="submit"
              disabled={penjualanLoading}
              className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
            >
              {penjualanLoading ? "Menyimpan..." : "Simpan Penjualan"}
            </button>
          </form>
        </div>
      </div>

      {/* Riwayat Penjualan */}
      <div className="lg:col-span-1">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <ShoppingCart size={16} /> Riwayat Terakhir
          </h4>
          {riwayatLoading ? (
            <p className="py-4 text-center text-gray-400">Memuat...</p>
          ) : riwayatPenjualan.length === 0 ? (
            <p className="py-4 text-center text-gray-400">Belum ada transaksi.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {riwayatPenjualan.slice(0, 10).map((trx) => (
                <li key={trx.id} className="py-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{trx.no_transaksi}</span>
                    <span className="font-semibold text-green-600">Rp {trx.jumlah?.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-gray-400">{trx.deskripsi}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );

  // ─── Render utama ──────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header Dinamis */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              {page === "beranda" && "Beranda Toko"}
              {page === "stok" && "Manajemen Stok"}
              {page === "penjualan" && "Transaksi Penjualan"}
            </h2>
            <p className="text-sm text-gray-500">
              {page === "beranda" && "Ringkasan aktivitas toko Waserda"}
              {page === "stok" && "Kelola data barang dan stok"}
              {page === "penjualan" && "Catat penjualan barang"}
            </p>
          </div>
        </div>

        {renderContent()}
      </div>

      {/* ─── MODAL: Tambah/Edit Barang ───────────────────────── */}
      {modalBarangOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editingBarang ? "Edit Barang" : "Tambah Barang"}</h3>
              <button onClick={() => setModalBarangOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleBarangSubmit} className="space-y-4">
              <Field label="Kode Barang" value={formBarang.kode_barang} onChange={(v) => setFormBarang({ ...formBarang, kode_barang: v })} full />
              <Field label="Nama Barang" value={formBarang.nama_barang} onChange={(v) => setFormBarang({ ...formBarang, nama_barang: v })} full />
              <Field label="Satuan" value={formBarang.satuan} onChange={(v) => setFormBarang({ ...formBarang, satuan: v })} full />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Stok Awal" type="number" value={formBarang.stok_awal} onChange={(v) => setFormBarang({ ...formBarang, stok_awal: parseInt(v) || 0 })} />
                <Field label="Harga Awal" type="number" value={formBarang.harga_awal} onChange={(v) => setFormBarang({ ...formBarang, harga_awal: parseFloat(v) || 0 })} />
              </div>
              <button type="submit" className="w-full rounded-lg bg-blue-600 py-2 text-white hover:bg-blue-700">
                Simpan
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: Pembelian ────────────────────────────────── */}
      {modalPembelianOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Tambah Stok</h3>
              <button onClick={() => setModalPembelianOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handlePembelianSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-gray-700">Barang</label>
                <select
                  value={formPembelian.barang_id}
                  onChange={(e) => setFormPembelian({ ...formPembelian, barang_id: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  required
                >
                  <option value="">Pilih...</option>
                  {barangOptions.map((b) => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Jumlah" type="number" value={formPembelian.jumlah} onChange={(v) => setFormPembelian({ ...formPembelian, jumlah: parseInt(v) || 1 })} />
                <Field label="Harga Beli" type="number" value={formPembelian.harga_beli} onChange={(v) => setFormPembelian({ ...formPembelian, harga_beli: parseFloat(v) || 0 })} />
              </div>
              <Field label="Supplier" value={formPembelian.supplier} onChange={(v) => setFormPembelian({ ...formPembelian, supplier: v })} full />
              <Field label="Tanggal" type="date" value={formPembelian.tanggal} onChange={(v) => setFormPembelian({ ...formPembelian, tanggal: v })} full />
              <button type="submit" className="w-full rounded-lg bg-blue-600 py-2 text-white hover:bg-blue-700">
                Simpan Pembelian
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── KONFIRMASI HAPUS ────────────────────────────────── */}
      {deleteBarangId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center">
            <AlertCircle size={32} className="mx-auto mb-3 text-red-500" />
            <p className="mb-4 text-gray-700">Yakin ingin menghapus barang ini?</p>
            <div className="flex justify-center gap-2">
              <button onClick={() => setDeleteBarangId(null)} className="rounded-lg border px-4 py-2 text-sm">Batal</button>
              <button onClick={handleDeleteBarang} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}