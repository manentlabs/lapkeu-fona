// src/pages/anggota/AnggotaPinjamanPage.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import {
  Plus,
  X,
  Loader,
  Wallet,
  AlertCircle,
} from "lucide-react";

// ─── Helper Format Rupiah ──────────────────────────────────
function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString("id-ID");
}

function parseRupiahInput(value) {
  return value.replace(/[^0-9]/g, "");
}

function formatTanggal(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStatusBadge(status) {
  const map = {
    pending: { label: "Menunggu", color: "bg-amber-100 text-amber-700" },
    disetujui: { label: "Disetujui", color: "bg-green-100 text-green-700" },
    ditolak: { label: "Ditolak", color: "bg-red-100 text-red-700" },
  };
  return map[status] || { label: status, color: "bg-gray-100 text-gray-700" };
}

// ─── Skema Pinjaman ─────────────────────────────────────────
// Bunga tetap 2.75% per bulan (flat), jangka waktu sesuai tabel angsuran koperasi.
const SUKU_BUNGA_TETAP = 2.75;
const JANGKA_WAKTU_OPTIONS = [10, 12, 15, 18, 20, 24, 36];

// Rumus anuitas: PMT = P * i / (1 - (1+i)^-n)
// Diverifikasi cocok dengan tabel (mis. Rp1.000.000 / 10 bulan -> Rp115.740)
function hitungAngsuranPerBulan(plafon, jangkaWaktu, sukuBunga = SUKU_BUNGA_TETAP) {
  const P = parseFloat(plafon) || 0;
  const n = parseInt(jangkaWaktu, 10) || 0;
  const i = (parseFloat(sukuBunga) || 0) / 100;

  if (P <= 0 || n <= 0) return 0;
  if (i === 0) return P / n;

  const factor = i / (1 - Math.pow(1 + i, -n));
  return P * factor;
}

const emptyForm = {
  plafon: "",
  jangka_waktu: "12",
  suku_bunga: String(SUKU_BUNGA_TETAP),
  metode_pembayaran: "cash",
};

// ─── KOMPONEN UTAMA ──────────────────────────────────────
export default function AnggotaPinjamanPage() {
  const { token } = useAuth();
  const [riwayat, setRiwayat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Modal form
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");

  // ─── Fetch riwayat ──────────────────────────────────────
  const fetchRiwayat = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/pinjaman/saya");
      setRiwayat(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Gagal memuat riwayat pinjaman");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRiwayat();
  }, [fetchRiwayat]);

  // ─── Handle perubahan form ──────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handlePlafonChange = (e) => {
    const raw = parseRupiahInput(e.target.value);
    setForm((f) => ({ ...f, plafon: raw }));
  };

  const openCreateModal = () => {
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setFormError("");
  };

  // ─── Estimasi angsuran per bulan (live preview) ─────────
  const angsuranPreview = useMemo(
    () => hitungAngsuranPerBulan(form.plafon, form.jangka_waktu, form.suku_bunga),
    [form.plafon, form.jangka_waktu, form.suku_bunga]
  );

  // ─── Submit pengajuan ────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    const plafonNum = parseFloat(form.plafon) || 0;
    if (plafonNum <= 0) {
      setFormError("Plafon harus lebih dari 0.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        plafon: plafonNum,
        jangka_waktu: parseInt(form.jangka_waktu, 10),
        suku_bunga: SUKU_BUNGA_TETAP,
        metode_pembayaran: form.metode_pembayaran,
      };

      await api.post("/pinjaman", payload);
      setModalOpen(false);
      setForm(emptyForm);
      fetchRiwayat();
    } catch (err) {
      setFormError(err.response?.data?.message || "Gagal mengajukan pinjaman");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Pinjaman Saya</h2>
              <p className="text-sm text-gray-500">Ajukan pinjaman atau lihat riwayat</p>
            </div>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={16} />
              Ajukan Pinjaman
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-100">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* ─── TABEL RIWAYAT ───────────────────────────────── */}
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm border border-gray-100">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 text-center">NO</th>
                <th className="px-4 py-3 text-right">Plafon</th>
                <th className="px-4 py-3 text-center">Jangka Waktu</th>
                <th className="px-4 py-3 text-center">Suku Bunga</th>
                <th className="px-4 py-3 text-right">Angsuran/Bulan</th>
                <th className="px-4 py-3 text-center">Sisa Angsuran</th>
                <th className="px-4 py-3 text-center">Metode</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Tgl Pengajuan</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-gray-400">
                    <Loader className="animate-spin inline-block mr-2" size={20} /> Memuat...
                  </td>
                </tr>
              ) : riwayat.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                    <Wallet size={40} className="mx-auto mb-2 opacity-50" />
                    Belum ada riwayat pinjaman.
                  </td>
                </tr>
              ) : (
                riwayat.map((p, idx) => {
                  const status = getStatusBadge(p.verifikasi_status);
                  const angsuran = hitungAngsuranPerBulan(
                    p.plafon,
                    p.jangka_waktu,
                    p.suku_bunga ?? SUKU_BUNGA_TETAP
                  );
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-center text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-3 text-right font-mono font-medium">
                        Rp {formatRupiah(p.plafon)}
                      </td>
                      <td className="px-4 py-3 text-center">{p.jangka_waktu} bulan</td>
                      <td className="px-4 py-3 text-center">
                        {p.suku_bunga ?? SUKU_BUNGA_TETAP}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        Rp {formatRupiah(angsuran)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.status === "aktif" ? p.sisa_angsuran : "-"}
                      </td>
                      <td className="px-4 py-3 text-center capitalize">
                        {p.metode_pembayaran === "potong_gaji" ? "Potong Gaji" : "Tunai"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${status.color}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500">
                        {formatTanggal(p.created_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile view */}
        <div className="space-y-3 lg:hidden">
          {!loading &&
            riwayat.map((p) => {
              const status = getStatusBadge(p.verifikasi_status);
              const angsuran = hitungAngsuranPerBulan(
                p.plafon,
                p.jangka_waktu,
                p.suku_bunga ?? SUKU_BUNGA_TETAP
              );
              return (
                <div key={p.id} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-gray-500">Plafon</p>
                      <p className="font-bold text-gray-800">Rp {formatRupiah(p.plafon)}</p>
                    </div>
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${status.color}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-1 text-sm">
                    <div className="flex justify-between border-b py-1">
                      <span className="text-gray-500">Jangka Waktu</span>
                      <span>{p.jangka_waktu} bulan</span>
                    </div>
                    <div className="flex justify-between border-b py-1">
                      <span className="text-gray-500">Suku Bunga</span>
                      <span>{p.suku_bunga ?? SUKU_BUNGA_TETAP}%</span>
                    </div>
                    <div className="flex justify-between border-b py-1 col-span-2">
                      <span className="text-gray-500">Angsuran/Bulan</span>
                      <span className="font-mono font-medium">
                        Rp {formatRupiah(angsuran)}
                      </span>
                    </div>
                    <div className="flex justify-between border-b py-1">
                      <span className="text-gray-500">Metode</span>
                      <span className="capitalize">
                        {p.metode_pembayaran === "potong_gaji" ? "Potong Gaji" : "Tunai"}
                      </span>
                    </div>
                    <div className="flex justify-between border-b py-1">
                      <span className="text-gray-500">Tgl Pengajuan</span>
                      <span>{formatTanggal(p.created_at)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* ─── MODAL FORM PENGAJUAN ───────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b px-4 py-4 sm:px-8">
            <h3 className="text-lg font-semibold text-gray-800 sm:text-xl">
              Ajukan Pinjaman
            </h3>
            <button
              onClick={closeModal}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <form id="pinjaman-form" onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4">
              {formError && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  {formError}
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm text-gray-700">Plafon (Rp)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    name="plafon"
                    value={form.plafon ? formatRupiah(form.plafon) : ""}
                    onChange={handlePlafonChange}
                    placeholder="0"
                    className="w-full rounded-lg border px-3 py-2 pl-10 text-right text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400">Jumlah pinjaman harus lebih dari 0.</p>
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-700">Jangka Waktu</label>
                <select
                  name="jangka_waktu"
                  value={form.jangka_waktu}
                  onChange={handleChange}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {JANGKA_WAKTU_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} bulan
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-700">Suku Bunga</label>
                <div className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  {SUKU_BUNGA_TETAP}% per bulan (tetap, sesuai ketentuan koperasi)
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-700">Metode Pembayaran</label>
                <select
                  name="metode_pembayaran"
                  value={form.metode_pembayaran}
                  onChange={handleChange}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="cash">Tunai</option>
                  <option value="potong_gaji">Potong Gaji</option>
                </select>
              </div>

              {/* ─── Estimasi Angsuran ─────────────────────────── */}
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                <p className="text-xs text-blue-700">Estimasi Angsuran per Bulan</p>
                <p className="text-lg font-bold text-blue-800">
                  Rp {formatRupiah(angsuranPreview)}
                </p>
                <p className="mt-0.5 text-xs text-blue-600">
                  Total {form.jangka_waktu} kali angsuran, bunga {SUKU_BUNGA_TETAP}%/bulan.
                </p>
              </div>
            </form>
          </div>
          <div className="flex justify-end gap-2 border-t px-4 py-4 sm:px-8">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-lg border px-5 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              form="pinjaman-form"
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting && <Loader size={15} className="animate-spin" />}
              {submitting ? "Mengajukan…" : "Ajukan"}
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}