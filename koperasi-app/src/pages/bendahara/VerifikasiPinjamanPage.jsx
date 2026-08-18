// src/pages/bendahara/VerifikasiPinjamanPage.jsx
import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import {
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  FileText,
  Wallet,
  TrendingUp,
  AlertCircle,
  Loader,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ─── Helper ──────────────────────────────────────────────────
function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString("id-ID");
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

// ─── Komponen Utama ─────────────────────────────────────────
export default function VerifikasiPinjamanPage() {
  const [pinjaman, setPinjaman] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState({});
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);

  // ─── State Filter Status ──────────────────────────────
  const [statusFilter, setStatusFilter] = useState("pending"); // default pending

  // ─── Summary ──────────────────────────────────────────────
  const summary = {
    totalPending: pinjaman.length,
    totalPlafon: pinjaman.reduce((sum, p) => sum + (parseFloat(p.plafon) || 0), 0),
  };

  // ─── Fetch Data ───────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Kirim status filter ke backend
      const res = await api.get(`/pinjaman/verifikasi?status=${statusFilter}`);
      setPinjaman(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Gagal memuat data verifikasi");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]); // reload ketika filter berubah

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Metode Pembayaran ────────────────────────────────────
  const handleMetodeChange = (id, metode) => {
    setSelected((prev) => ({ ...prev, [id]: metode }));
  };

  const handleVerifikasi = async (id, disetujui) => {
    // fallback ke metode_pembayaran milik pinjaman itu sendiri,
    // bukan "cash", supaya pilihan default (potong_gaji) tetap terkirim
    // walau bendahara tidak menyentuh dropdown-nya
    const item = pinjaman.find((p) => p.id === id);
    const metode = selected[id] || item?.metode_pembayaran || "cash";

    try {
        await api.put(`/pinjaman/verifikasi/${id}`, {
        metode_pembayaran: metode,
        disetujui,
        });
        fetchData(); // refresh
    } catch (err) {
        alert(err.response?.data?.message || "Gagal memverifikasi pinjaman");
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
              <h2 className="text-xl font-semibold text-gray-800">Verifikasi Pinjaman</h2>
              <p className="text-sm text-gray-500">
                Daftar pinjaman yang menunggu persetujuan
              </p>
            </div>
          </div>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <SummaryCard
            label="Menunggu Verifikasi"
            value={summary.totalPending}
            icon={<AlertCircle size={18} className="text-amber-600" />}
            color="amber"
          />
          <SummaryCard
            label="Total Plafon"
            value={`Rp ${formatRupiah(summary.totalPlafon)}`}
            icon={<Wallet size={18} className="text-blue-600" />}
            color="blue"
          />
          <SummaryCard
            label="Jenis Pembayaran"
            value={
              pinjaman.filter((p) => p.metode_pembayaran === "potong_gaji").length +
              " Potong Gaji"
            }
            icon={<TrendingUp size={18} className="text-green-600" />}
            color="green"
          />
        </div>

        {/* FILTER */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
          >
            <span className="flex items-center gap-2 font-medium text-gray-700">
              <FileText size={18} className="text-gray-500" />
              Filter & Informasi
            </span>
            {filterOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {filterOpen && (
            <div className="border-t p-4 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status Pinjaman</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="pending">Menunggu</option>
                    <option value="disetujui">Disetujui</option>
                    <option value="ditolak">Ditolak</option>
                    <option value="semua">Semua</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <p className="text-sm text-gray-500">
                    Menampilkan {pinjaman.length} data
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* TABEL */}
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm border border-gray-100">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 text-center">NO</th>
                <th className="px-4 py-3">Anggota</th>
                <th className="px-4 py-3 text-right">Plafon</th>
                <th className="px-4 py-3 text-center">Jangka Waktu</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Metode</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-400">
                    <Loader size={20} className="inline-block animate-spin mr-2" />
                    Memuat data...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-red-500">
                    {error}
                  </td>
                </tr>
              ) : pinjaman.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-400">
                    Tidak ada pinjaman dengan status ini.
                  </td>
                </tr>
              ) : (
                pinjaman.map((p, idx) => {
                  const anggota = p.anggota || {};
                  const statusLabel =
                    p.verifikasi_status === "pending"
                      ? "Menunggu"
                      : p.verifikasi_status === "disetujui"
                      ? "✓ Disetujui"
                      : "✗ Ditolak";
                  const statusColor =
                    p.verifikasi_status === "pending"
                      ? "bg-amber-100 text-amber-700"
                      : p.verifikasi_status === "disetujui"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700";
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-center text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{anggota.nama || "-"}</p>
                        <p className="text-xs text-gray-400">{anggota.no_anggota || "-"}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-gray-800">
                        Rp {formatRupiah(p.plafon)}
                      </td>
                      <td className="px-4 py-3 text-center">{p.jangka_waktu} bulan</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${statusColor}`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.verifikasi_status === "pending" ? (
                          <select
                            value={selected[p.id] || p.metode_pembayaran || "cash"}
                            onChange={(e) => handleMetodeChange(p.id, e.target.value)}
                            className="rounded-lg border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="cash">Tunai</option>
                            <option value="potong_gaji">Potong Gaji</option>
                          </select>
                        ) : (
                          <span className="text-sm text-gray-500">
                            {p.metode_pembayaran === "potong_gaji" ? "Potong Gaji" : "Tunai"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.verifikasi_status === "pending" ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleVerifikasi(p.id, true)}
                              className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 transition"
                            >
                              <CheckCircle size={15} />
                              Setujui
                            </button>
                            <button
                              onClick={() => handleVerifikasi(p.id, false)}
                              className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 transition"
                            >
                              <XCircle size={15} />
                              Tolak
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Sudah diproses</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARD */}
        <div className="space-y-3 lg:hidden">
          {loading ? (
            <div className="text-center py-8 text-gray-400">
              <Loader className="inline-block animate-spin mr-2" size={20} /> Memuat...
            </div>
          ) : pinjaman.length === 0 ? (
            <div className="text-center py-8 text-gray-400">Tidak ada data.</div>
          ) : (
            pinjaman.map((p) => {
              const anggota = p.anggota || {};
              return (
                <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">{anggota.nama || "-"}</p>
                      <p className="text-xs text-gray-400">{anggota.no_anggota || "-"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Plafon</p>
                      <p className="font-mono font-bold text-gray-800">
                        Rp {formatRupiah(p.plafon)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Jangka Waktu</p>
                      <p className="font-medium">{p.jangka_waktu} bulan</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Metode</p>
                      {p.verifikasi_status === "pending" ? (
                        <select
                          value={selected[p.id] || p.metode_pembayaran || "cash"}
                          onChange={(e) => handleMetodeChange(p.id, e.target.value)}
                          className="w-full rounded-lg border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="cash">Tunai</option>
                          <option value="potong_gaji">Potong Gaji</option>
                        </select>
                      ) : (
                        <span className="text-gray-500">
                          {p.metode_pembayaran === "potong_gaji" ? "Potong Gaji" : "Tunai"}
                        </span>
                      )}
                    </div>
                  </div>
                  {p.verifikasi_status === "pending" && (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => handleVerifikasi(p.id, true)}
                        className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700"
                      >
                        <CheckCircle size={15} /> Setujui
                      </button>
                      <button
                        onClick={() => handleVerifikasi(p.id, false)}
                        className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
                      >
                        <XCircle size={15} /> Tolak
                      </button>
                    </div>
                  )}
                  {p.verifikasi_status !== "pending" && (
                    <div className="mt-4 text-center text-xs text-gray-400">Sudah diproses</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

// ─── SUMMARY CARD ────────────────────────────────────────────
function SummaryCard({ label, value, icon, color }) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    gray: "bg-gray-100 text-gray-700",
  };
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorMap[color] || colorMap.blue}`}>{icon}</div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-sm font-bold text-gray-800">{value}</p>
        </div>
      </div>
    </div>
  );
}