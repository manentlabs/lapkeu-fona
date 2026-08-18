import { useEffect, useState } from "react";
import { Link } from "react-router-dom"; // sesuaikan dengan router yang dipakai
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import {
  Save,
  Loader,
  Building,
  User,
  MapPin,
  Globe,
  Calendar,
  FileText,
  ListPlus,
  ArrowRight,
  PiggyBank,
  HandCoins,
  TrendingUp,
} from "lucide-react";

const emptyForm = {
  nama_koperasi: "",
  nama_ketua: "",
  alamat_koperasi: "",
  no_badan_hukum: "",
  tgl_badan_hukum: "",
  tgl_awal: "",
  nama_website: "",
  warna_layout: "#20c997",
};

// Daftar menu pengaturan jenis (terpisah dari form profil koperasi)
const jenisMenus = [
  {
    to: "/dashboard/admin/pengaturan/jenis-simpanan",
    icon: ListPlus,
    title: "Kelola Jenis Simpanan",
    desc: "Tambah, ubah, atau nonaktifkan jenis simpanan anggota.",
    bg: "bg-blue-50",
    border: "border-blue-200",
    hover: "hover:bg-blue-100",
    iconBg: "bg-blue-600",
    arrow: "text-blue-600",
  },
  {
    to: "/dashboard/admin/pengaturan/jenis-tabungan",
    icon: PiggyBank,
    title: "Kelola Jenis Tabungan",
    desc: "Tambah, ubah, atau nonaktifkan jenis tabungan anggota.",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    hover: "hover:bg-emerald-100",
    iconBg: "bg-emerald-600",
    arrow: "text-emerald-600",
  },
  {
    to: "/dashboard/admin/pengaturan/jenis-piutang",
    icon: HandCoins,
    title: "Kelola Jenis Piutang",
    desc: "Tambah, ubah, atau nonaktifkan jenis piutang/pinjaman.",
    bg: "bg-amber-50",
    border: "border-amber-200",
    hover: "hover:bg-amber-100",
    iconBg: "bg-amber-600",
    arrow: "text-amber-600",
  },
  {
    to: "/dashboard/admin/pengaturan/jenis-pendapatan",
    icon: TrendingUp,
    title: "Kelola Jenis Pendapatan",
    desc: "Tambah, ubah, atau nonaktifkan jenis pendapatan koperasi.",
    bg: "bg-purple-50",
    border: "border-purple-200",
    hover: "hover:bg-purple-100",
    iconBg: "bg-purple-600",
    arrow: "text-purple-600",
  },
];

export default function PengaturanPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState({
    logo_website: null,
    logo_koperasi: null,
    background_website: null,
  });
  const [previews, setPreviews] = useState({
    logo_website: null,
    logo_koperasi: null,
    background_website: null,
  });
  const [existingData, setExistingData] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ─── Fetch Data ──────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/pengaturan");
      if (data.data) {
        setExistingData(data.data);
        setForm({
          nama_koperasi: data.data.nama_koperasi || "",
          nama_ketua: data.data.nama_ketua || "",
          alamat_koperasi: data.data.alamat_koperasi || "",
          no_badan_hukum: data.data.no_badan_hukum || "",
          tgl_badan_hukum: data.data.tgl_badan_hukum?.slice(0, 10) || "",
          tgl_awal: data.data.tgl_awal?.slice(0, 10) || "",
          nama_website: data.data.nama_website || "",
          warna_layout: data.data.warna_layout || "#20c997",
        });
        setPreviews({
          logo_website: data.data.logo_website_url || null,
          logo_koperasi: data.data.logo_koperasi_url || null,
          background_website: data.data.background_website_url || null,
        });
      } else {
        setExistingData(null);
        setForm(emptyForm);
        setPreviews({ logo_website: null, logo_koperasi: null, background_website: null });
      }
    } catch (err) {
      setError("Gagal mengambil data pengaturan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ─── Handlers ─────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleColorChange = (e) => {
    setForm((prev) => ({ ...prev, warna_layout: e.target.value }));
  };

  const handleFileChange = (e) => {
    const { name, files: fileList } = e.target;
    if (fileList.length > 0) {
      const file = fileList[0];
      setFiles((prev) => ({ ...prev, [name]: file }));
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreviews((prev) => ({ ...prev, [name]: ev.target.result }));
      };
      reader.readAsDataURL(file);
    } else {
      setFiles((prev) => ({ ...prev, [name]: null }));
      setPreviews((prev) => ({ ...prev, [name]: null }));
    }
  };

  // ─── Submit ──────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    const formData = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });
    Object.entries(files).forEach(([key, value]) => {
      if (value) formData.append(key, value);
    });

    try {
      let res;
      if (existingData) {
        res = await api.put("/pengaturan", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        res = await api.post("/pengaturan", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      setSuccess(res.data.message);
      await fetchData();
      setFiles({ logo_website: null, logo_koperasi: null, background_website: null });
    } catch (err) {
      setError(err.response?.data?.message || "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader className="animate-spin text-blue-600" size={40} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Pengaturan Website</h2>
          <p className="text-gray-500">Kelola identitas dan tampilan website koperasi.</p>
        </div>

        {/* Link ke pengaturan jenis (terpisah dari form profil) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {jenisMenus.map((menu) => {
            const Icon = menu.icon;
            return (
              <Link
                key={menu.to}
                to={menu.to}
                className={`flex items-center justify-between gap-3 p-4 ${menu.bg} border ${menu.border} rounded-xl ${menu.hover} transition`}
              >
                <div className="flex items-center gap-3">
                  <span className={`p-2 ${menu.iconBg} text-white rounded-lg`}>
                    <Icon size={18} />
                  </span>
                  <div>
                    <p className="font-medium text-gray-800">{menu.title}</p>
                    <p className="text-sm text-gray-500">{menu.desc}</p>
                  </div>
                </div>
                <ArrowRight size={18} className={menu.arrow} />
              </Link>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">{error}</div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg border border-green-200">{success}</div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nama Koperasi */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Koperasi <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center border rounded-lg focus-within:ring-2 focus-within:ring-blue-500">
                <span className="pl-3 text-gray-400"><Building size={18} /></span>
                <input
                  type="text"
                  name="nama_koperasi"
                  value={form.nama_koperasi}
                  onChange={handleChange}
                  className="w-full px-3 py-2 outline-none bg-transparent"
                  required
                />
              </div>
            </div>

            {/* Nama Ketua */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Ketua <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center border rounded-lg focus-within:ring-2 focus-within:ring-blue-500">
                <span className="pl-3 text-gray-400"><User size={18} /></span>
                <input
                  type="text"
                  name="nama_ketua"
                  value={form.nama_ketua}
                  onChange={handleChange}
                  className="w-full px-3 py-2 outline-none bg-transparent"
                  required
                />
              </div>
            </div>

            {/* Alamat Koperasi */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alamat Koperasi <span className="text-red-500">*</span>
              </label>
              <div className="flex items-start border rounded-lg focus-within:ring-2 focus-within:ring-blue-500">
                <span className="pl-3 pt-2 text-gray-400"><MapPin size={18} /></span>
                <textarea
                  name="alamat_koperasi"
                  value={form.alamat_koperasi}
                  onChange={handleChange}
                  rows="3"
                  className="w-full px-3 py-2 outline-none bg-transparent resize-vertical"
                  required
                />
              </div>
            </div>

            {/* No Badan Hukum */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                No. Badan Hukum <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center border rounded-lg focus-within:ring-2 focus-within:ring-blue-500">
                <span className="pl-3 text-gray-400"><FileText size={18} /></span>
                <input
                  type="text"
                  name="no_badan_hukum"
                  value={form.no_badan_hukum}
                  onChange={handleChange}
                  className="w-full px-3 py-2 outline-none bg-transparent"
                  required
                />
              </div>
            </div>

            {/* Tgl Badan Hukum */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tgl. Badan Hukum
              </label>
              <div className="flex items-center border rounded-lg focus-within:ring-2 focus-within:ring-blue-500">
                <span className="pl-3 text-gray-400"><Calendar size={18} /></span>
                <input
                  type="date"
                  name="tgl_badan_hukum"
                  value={form.tgl_badan_hukum}
                  onChange={handleChange}
                  className="w-full px-3 py-2 outline-none bg-transparent"
                />
              </div>
            </div>

            {/* Tgl Awal */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tgl. Awal
              </label>
              <div className="flex items-center border rounded-lg focus-within:ring-2 focus-within:ring-blue-500">
                <span className="pl-3 text-gray-400"><Calendar size={18} /></span>
                <input
                  type="date"
                  name="tgl_awal"
                  value={form.tgl_awal}
                  onChange={handleChange}
                  className="w-full px-3 py-2 outline-none bg-transparent"
                />
              </div>
            </div>

            {/* Nama Website */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Website <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center border rounded-lg focus-within:ring-2 focus-within:ring-blue-500">
                <span className="pl-3 text-gray-400"><Globe size={18} /></span>
                <input
                  type="text"
                  name="nama_website"
                  value={form.nama_website}
                  onChange={handleChange}
                  className="w-full px-3 py-2 outline-none bg-transparent"
                  required
                />
              </div>
            </div>

            {/* Warna Layout */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Warna Layout
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  name="warna_layout"
                  value={form.warna_layout}
                  onChange={handleColorChange}
                  className="w-12 h-10 p-1 border rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={form.warna_layout}
                  onChange={handleColorChange}
                  className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Logo Website */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Logo Website
              </label>
              <div className="flex items-center gap-3">
                {previews.logo_website && (
                  <img src={previews.logo_website} alt="Logo Website" className="w-12 h-12 object-contain border rounded" />
                )}
                <input
                  type="file"
                  name="logo_website"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Format: JPG, PNG. Kosongkan jika tidak ingin mengubah.</p>
            </div>

            {/* Logo Koperasi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Logo Koperasi
              </label>
              <div className="flex items-center gap-3">
                {previews.logo_koperasi && (
                  <img src={previews.logo_koperasi} alt="Logo Koperasi" className="w-12 h-12 object-contain border rounded" />
                )}
                <input
                  type="file"
                  name="logo_koperasi"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Format: JPG, PNG. Kosongkan jika tidak ingin mengubah.</p>
            </div>

            {/* Background Website */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Background Website
              </label>
              <div className="flex items-center gap-3">
                {previews.background_website && (
                  <img src={previews.background_website} alt="Background" className="w-20 h-12 object-cover border rounded" />
                )}
                <input
                  type="file"
                  name="background_website"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Format: JPG, PNG. Kosongkan jika tidak ingin mengubah.</p>
            </div>
          </div>

          {/* Tombol Simpan */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? <Loader className="animate-spin" size={18} /> : <Save size={18} />}
              {existingData ? "Perbarui" : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}