import React, { useEffect, useState, useCallback } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import {
  Plus, Pencil, Trash2, Eye, Search, XCircle,
  ChevronDown, ChevronRight, Loader, Building2, ListTree, Layers
} from "lucide-react";

const emptyForm = {
  kode_akun: "",
  nama_akun: "",
  tipe_akun: "aset",
  parent_id: "",
  is_active: 1,
  saldo_awal: "",
  pajak: "",
};

// Helper: build tree dari flat list
function buildTree(flatList) {
  const map = {};
  const roots = [];
  flatList.forEach(item => {
    map[item.id] = { ...item, children: [] };
  });
  flatList.forEach(item => {
    const node = map[item.id];
    if (item.parent_id && map[item.parent_id]) {
      map[item.parent_id].children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortChildren = (nodes) => {
    nodes.sort((a, b) => a.kode_akun.localeCompare(b.kode_akun));
    nodes.forEach(n => sortChildren(n.children));
  };
  sortChildren(roots);
  return roots;
}

export default function BaganAkunPage() {
  const [akunTree, setAkunTree] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [summary, setSummary] = useState({ total: 0, induk: 0, sub: 0 });

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const [deleteId, setDeleteId] = useState(null);
  const [detailAkun, setDetailAkun] = useState(null);

  const [parentList, setParentList] = useState([]);
  const [expanded, setExpanded] = useState(new Set());

  const fetchAkun = useCallback(async (searchQuery = "") => {
    setLoading(true);
    try {
      const params = { per_page: 1000 };
      if (searchQuery) params.search = searchQuery;
      const { data } = await api.get("/akun", { params });
      const tree = buildTree(data.data);
      setAkunTree(tree);
      setSummary(data.summary);
      setExpanded(new Set());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchParents = useCallback(async () => {
    try {
      const { data } = await api.get("/akun/list");
      setParentList(data.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchAkun();
    fetchParents();
  }, [fetchAkun, fetchParents]);

  const handleSearch = () => {
    setAppliedSearch(search);
    fetchAkun(search);
  };

  const resetSearch = () => {
    setSearch("");
    setAppliedSearch("");
    fetchAkun("");
  };

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setForm({
      kode_akun: item.kode_akun,
      nama_akun: item.nama_akun,
      tipe_akun: item.tipe_akun,
      parent_id: item.parent_id || "",
      is_active: item.is_active,
      saldo_awal: item.saldo_awal || "",
      pajak: item.pajak || "",
    });
    setFormError("");
    setModalOpen(true);
  };

  const openDetailModal = (item) => setDetailAkun(item);

  const handleFormChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    try {
      const payload = { ...form };
      if (!payload.parent_id) delete payload.parent_id;
      if (!payload.saldo_awal) delete payload.saldo_awal;
      if (!payload.pajak) delete payload.pajak;

      if (editingId) {
        await api.put(`/akun/${editingId}`, payload);
      } else {
        await api.post("/akun", payload);
      }
      setModalOpen(false);
      fetchAkun(appliedSearch);
      fetchParents();
    } catch (err) {
      setFormError(err.response?.data?.message || "Terjadi kesalahan.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/akun/${deleteId}`);
      setDeleteId(null);
      fetchAkun(appliedSearch);
      fetchParents();
    } catch (err) {
      alert(err.response?.data?.message || "Gagal menghapus akun.");
    }
  };

  const tipeLabel = {
    aset: "ASET",
    kewajiban: "KEWAJIBAN",
    modal: "MODAL",
    pendapatan: "PENDAPATAN",
    beban: "BEBAN",
  };

  const tipeBadgeColor = {
    aset: "bg-blue-100 text-blue-700",
    kewajiban: "bg-red-100 text-red-700",
    modal: "bg-purple-100 text-purple-700",
    pendapatan: "bg-green-100 text-green-700",
    beban: "bg-orange-100 text-orange-700",
  };

  // Render row tabel
  const renderRow = (item, level = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expanded.has(item.id);
    return (
      <React.Fragment key={item.id}>
        <tr className="hover:bg-gray-50 transition">
          <td className="px-4 py-3 text-sm font-mono">{item.kode_akun}</td>
          <td className="px-4 py-3 text-sm" style={{ paddingLeft: `${16 + level * 24}px` }}>
            <div className="flex items-center gap-1">
              {hasChildren && (
                <button onClick={() => toggleExpand(item.id)} className="p-1 hover:bg-gray-100 rounded-lg">
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              )}
              {!hasChildren && <span className="w-6 inline-block"></span>}
              <span>{item.nama_akun}</span>
              {hasChildren && <span className="ml-2 text-xs text-gray-400">({item.children.length} sub)</span>}
            </div>
          </td>
          <td className="px-4 py-3">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${tipeBadgeColor[item.tipe_akun]}`}>
              {tipeLabel[item.tipe_akun]}
            </span>
          </td>
          <td className="px-4 py-3 text-sm">
            {item.parent_id ? <span className="text-gray-500">Sub</span> : <span className="text-blue-600 font-medium">Induk</span>}
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-1.5">
              <button onClick={() => openDetailModal(item)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
                <Eye size={16} />
              </button>
              <button onClick={() => openEditModal(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
                <Pencil size={16} />
              </button>
              <button onClick={() => setDeleteId(item.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg">
                <Trash2 size={16} />
              </button>
            </div>
          </td>
        </tr>
        {hasChildren && isExpanded && item.children.map(child => renderRow(child, level + 1))}
      </React.Fragment>
    );
  };

  // Render kartu mobile
  const renderCard = (item, level = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expanded.has(item.id);
    return (
      <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {hasChildren && (
                <button onClick={() => toggleExpand(item.id)} className="p-1 hover:bg-gray-100 rounded-lg">
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              )}
              {!hasChildren && <span className="w-6"></span>}
              <span className="font-mono text-sm font-medium">{item.kode_akun}</span>
              <span className="text-sm font-semibold">{item.nama_akun}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1 ml-8">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tipeBadgeColor[item.tipe_akun]}`}>
                {tipeLabel[item.tipe_akun]}
              </span>
              <span className="text-xs text-gray-500">
                {item.parent_id ? "Sub" : "Induk"}
              </span>
              {hasChildren && (
                <span className="text-xs text-gray-400">({item.children.length} sub)</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => openDetailModal(item)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
              <Eye size={16} />
            </button>
            <button onClick={() => openEditModal(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
              <Pencil size={16} />
            </button>
            <button onClick={() => setDeleteId(item.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div className="ml-6 space-y-2 border-l-2 border-gray-200 pl-4">
            {item.children.map(child => renderCard(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Bagan Akun</h2>
            <p className="text-sm text-gray-500">Kelola bagan akun koperasi dengan hierarki parent-child.</p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} /> Tambah Akun
          </button>
        </div>

        {/* Ringkasan */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg"><Layers size={20} className="text-blue-600" /></div>
              <div><p className="text-xs text-gray-500 uppercase">Total Akun</p><p className="text-2xl font-bold">{summary.total}</p></div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg"><Building2 size={20} className="text-green-600" /></div>
              <div><p className="text-xs text-gray-500 uppercase">Akun Induk</p><p className="text-2xl font-bold">{summary.induk}</p></div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-purple-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg"><ListTree size={20} className="text-purple-600" /></div>
              <div><p className="text-xs text-gray-500 uppercase">Sub Akun</p><p className="text-2xl font-bold">{summary.sub}</p></div>
            </div>
          </div>
        </div>

        {/* Pencarian */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-xs font-medium text-gray-500">Cari kode / nama akun</label>
              <input
                type="text"
                placeholder="Ketik kode atau nama akun..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSearch} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                <Search size={15} /> Cari
              </button>
              <button onClick={resetSearch} className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                <XCircle size={15} /> Reset
              </button>
            </div>
          </div>
          {appliedSearch && <p className="mt-3 text-sm text-gray-500">Menampilkan hasil untuk: <span className="font-medium">"{appliedSearch}"</span></p>}
        </div>

        {/* Tabel Desktop (hidden on mobile) */}
        <div className="hidden sm:block overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3">KODE</th>
                <th className="px-4 py-3">NAMA AKUN</th>
                <th className="px-4 py-3">TIPE</th>
                <th className="px-4 py-3">LEVEL</th>
                <th className="px-4 py-3 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="px-4 py-6 text-center text-gray-400"><Loader className="animate-spin inline-block mr-2" size={20} />Memuat...</td></tr>
              ) : akunTree.length === 0 ? (
                <tr><td colSpan="5" className="px-4 py-6 text-center text-gray-400">Tidak ada data akun.</td></tr>
              ) : akunTree.map((item) => renderRow(item, 0))}
            </tbody>
          </table>
        </div>

        {/* Kartu Mobile (visible on mobile) */}
        <div className="sm:hidden space-y-3">
          {loading ? (
            <div className="flex justify-center py-8"><Loader className="animate-spin" size={30} /></div>
          ) : akunTree.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Tidak ada data akun.</p>
          ) : akunTree.map((item) => renderCard(item, 0))}
        </div>
      </div>

      {/* ===== MODAL FORM ===== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b px-4 py-4 sm:px-8">
            <h3 className="text-lg font-semibold">{editingId ? "Edit Akun" : "Tambah Akun"}</h3>
            <button onClick={() => setModalOpen(false)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><XCircle size={20} /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4">
              {formError && <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">{formError}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Kode Akun *</label>
                  <input type="text" value={form.kode_akun} onChange={(e) => handleFormChange("kode_akun", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Nama Akun *</label>
                  <input type="text" value={form.nama_akun} onChange={(e) => handleFormChange("nama_akun", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tipe Akun *</label>
                  <select value={form.tipe_akun} onChange={(e) => handleFormChange("tipe_akun", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" required>
                    <option value="aset">ASET</option>
                    <option value="kewajiban">KEWAJIBAN</option>
                    <option value="modal">MODAL</option>
                    <option value="pendapatan">PENDAPATAN</option>
                    <option value="beban">BEBAN</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Akun Induk</label>
                  <select value={form.parent_id} onChange={(e) => handleFormChange("parent_id", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="">-- Tidak ada (Induk) --</option>
                    {parentList.filter(p => p.id !== editingId).map(p => <option key={p.id} value={p.id}>{p.kode_akun} - {p.nama_akun}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select value={form.is_active} onChange={(e) => handleFormChange("is_active", parseInt(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                    <option value={1}>Aktif</option>
                    <option value={0}>Nonaktif</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Saldo Awal</label>
                  <input type="number" step="0.01" value={form.saldo_awal} onChange={(e) => handleFormChange("saldo_awal", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Pajak (%)</label>
                  <input type="number" step="0.01" value={form.pajak} onChange={(e) => handleFormChange("pajak", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" placeholder="0" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm">Batal</button>
                <button type="submit" disabled={formLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
                  {formLoading ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL DETAIL ===== */}
      {detailAkun && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b px-4 py-4 sm:px-8">
            <h3 className="text-lg font-semibold">Detail Akun</h3>
            <button onClick={() => setDetailAkun(null)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><XCircle size={20} /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <div className="max-w-2xl mx-auto space-y-3">
              <div className="grid grid-cols-2 gap-2 border-b pb-2"><span className="text-gray-500">Kode Akun</span><span className="font-medium">{detailAkun.kode_akun}</span></div>
              <div className="grid grid-cols-2 gap-2 border-b pb-2"><span className="text-gray-500">Nama Akun</span><span className="font-medium">{detailAkun.nama_akun}</span></div>
              <div className="grid grid-cols-2 gap-2 border-b pb-2"><span className="text-gray-500">Tipe</span><span className="font-medium">{tipeLabel[detailAkun.tipe_akun]}</span></div>
              <div className="grid grid-cols-2 gap-2 border-b pb-2"><span className="text-gray-500">Akun Induk</span><span className="font-medium">{detailAkun.parent_id ? parentList.find(p => p.id === detailAkun.parent_id)?.nama_akun || "-" : "-"}</span></div>
              <div className="grid grid-cols-2 gap-2 border-b pb-2"><span className="text-gray-500">Status</span><span className={`font-medium ${detailAkun.is_active ? "text-green-600" : "text-red-600"}`}>{detailAkun.is_active ? "Aktif" : "Nonaktif"}</span></div>
              <div className="grid grid-cols-2 gap-2 border-b pb-2"><span className="text-gray-500">Saldo Awal</span><span className="font-medium">{detailAkun.saldo_awal || "0"}</span></div>
              <div className="grid grid-cols-2 gap-2 border-b pb-2"><span className="text-gray-500">Pajak</span><span className="font-medium">{detailAkun.pajak ? detailAkun.pajak + "%" : "-"}</span></div>
              <div className="grid grid-cols-2 gap-2"><span className="text-gray-500">Dibuat</span><span className="font-medium">{new Date(detailAkun.created_at).toLocaleString()}</span></div>
            </div>
          </div>
          <div className="flex justify-end border-t px-4 py-4">
            <button onClick={() => setDetailAkun(null)} className="px-4 py-2 border rounded-lg text-sm">Tutup</button>
          </div>
        </div>
      )}

      {/* ===== KONFIRMASI HAPUS ===== */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full text-center">
            <p className="mb-4 text-gray-700">Yakin ingin menghapus akun ini?</p>
            <div className="flex justify-center gap-2">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 border rounded-lg text-sm">Batal</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}