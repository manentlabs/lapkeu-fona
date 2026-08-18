// src/pages/anggota/AnggotaTransaksiPage.jsx
import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../api/axios';
import { Loader, Search, Filter, ChevronDown, ChevronUp, FileText } from 'lucide-react';

export default function AnggotaTransaksiPage() {
  const [transaksi, setTransaksi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState({
    search: '',
    jenis: '',
  });

  const fetchRiwayat = async () => {
    setLoading(true);
    setError(null);
    try {
      // ✅ Gunakan instance `api` (baseURL + token otomatis via interceptor)
      const res = await api.get('/transaksi/riwayat-anggota');
      setTransaksi(res.data.data || []);
    } catch (err) {
      console.error('❌ Error fetching riwayat:', err);
      setError(err.response?.data?.message || 'Gagal mengambil riwayat transaksi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiwayat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Format Rupiah
  const formatRupiah = (value) => {
    const num = parseFloat(value) || 0;
    return num.toLocaleString('id-ID');
  };

  // Format Tanggal
  const formatTanggal = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (isNaN(d.getTime())) return value.slice(0, 10);
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Filter data
  const filteredData = transaksi.filter((t) => {
    const searchLower = filter.search.toLowerCase();
    const matchSearch =
      (t.no_transaksi || '').toLowerCase().includes(searchLower) ||
      (t.deskripsi || '').toLowerCase().includes(searchLower) ||
      (t.anggota || '').toLowerCase().includes(searchLower);
    const matchJenis =
      !filter.jenis ||
      (t.jenisSimpanan && t.jenisSimpanan.nama === filter.jenis) ||
      (t.jenisTabungan && t.jenisTabungan.nama === filter.jenis) ||
      (t.jenisPiutang && t.jenisPiutang.nama === filter.jenis) ||
      (t.jenisPendapatan && t.jenisPendapatan.nama === filter.jenis);
    return matchSearch && matchJenis;
  });

  // Total nominal transaksi
  const totalNominal = filteredData.reduce((sum, t) => sum + (parseFloat(t.jumlah) || 0), 0);

  // Ambil daftar jenis transaksi unik
  const jenisOptions = [];
  transaksi.forEach((t) => {
    const nama =
      t.jenisSimpanan?.nama ||
      t.jenisTabungan?.nama ||
      t.jenisPiutang?.nama ||
      t.jenisPendapatan?.nama;
    if (nama && !jenisOptions.includes(nama)) jenisOptions.push(nama);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ─── HEADER ──────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm p-5 border">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Riwayat Transaksi</h2>
              <p className="text-sm text-gray-500">
                Daftar semua transaksi yang telah Anda lakukan
              </p>
            </div>
            <div className="text-sm text-gray-500">
              Total {filteredData.length} transaksi &bull;{' '}
              <span className="font-medium text-gray-700">
                Rp {formatRupiah(totalNominal)}
              </span>
            </div>
          </div>
        </div>

        {/* ─── FILTER ──────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
          >
            <span className="flex items-center gap-2 font-medium text-gray-700">
              <Filter size={18} className="text-gray-500" />
              Filter & Cari
            </span>
            {filterOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {filterOpen && (
            <div className="border-t p-4 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cari</label>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={filter.search}
                      onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                      placeholder="Cari no transaksi / deskripsi..."
                      className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Transaksi</label>
                  <select
                    value={filter.jenis}
                    onChange={(e) => setFilter({ ...filter, jenis: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Semua</option>
                    {jenisOptions.map((j) => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => setFilter({ search: '', jenis: '' })}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Reset Filter
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── TABEL ───────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="animate-spin text-gray-400" size={24} />
            </div>
          ) : error ? (
            <div className="py-8 text-center text-red-500">{error}</div>
          ) : filteredData.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <FileText size={48} className="mx-auto mb-2 opacity-50" />
              <p>Belum ada transaksi yang tercatat.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-center">No</th>
                    <th className="px-4 py-3">No Transaksi</th>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Deskripsi</th>
                    <th className="px-4 py-3">Jenis</th>
                    <th className="px-4 py-3 text-right">Jumlah</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredData.map((t, idx) => {
                    // Tentukan jenis transaksi
                    let jenisLabel = '-';
                    if (t.jenisSimpanan) jenisLabel = t.jenisSimpanan.nama;
                    else if (t.jenisTabungan) jenisLabel = t.jenisTabungan.nama;
                    else if (t.jenisPiutang) jenisLabel = t.jenisPiutang.nama;
                    else if (t.jenisPendapatan) jenisLabel = t.jenisPendapatan.nama;
                    else if (t.referensi) jenisLabel = t.referensi.uraian_transaksi || t.referensi.label;

                    const isDebit = parseFloat(t.jumlah) >= 0;
                    const jumlahColor = isDebit ? 'text-green-600' : 'text-red-600';

                    return (
                      <tr key={t.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 text-center text-gray-500">{idx + 1}</td>
                        <td className="px-4 py-3 font-mono text-xs">{t.no_transaksi}</td>
                        <td className="px-4 py-3">{formatTanggal(t.tanggal)}</td>
                        <td className="px-4 py-3 max-w-xs truncate">{t.deskripsi}</td>
                        <td className="px-4 py-3 text-xs">
                          <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-blue-700">
                            {jenisLabel}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-medium ${jumlahColor}`}>
                          {isDebit ? '+' : ''}Rp {formatRupiah(t.jumlah)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 font-medium">
                  <tr>
                    <td colSpan="5" className="px-4 py-3 text-right text-gray-700">Total</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-gray-800">
                      Rp {formatRupiah(totalNominal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}