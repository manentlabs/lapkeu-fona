// src/pages/anggota/AnggotaSimpananPage.jsx
import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../api/axios';
import { Loader } from 'lucide-react';

export default function AnggotaSimpananPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/anggota-koperasi/simpanan');
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Gagal mengambil data simpanan');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatRupiah = (value) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  const formatTanggal = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) return <DashboardLayout><div className="flex justify-center py-12"><Loader className="animate-spin" /></div></DashboardLayout>;
  if (error) return <DashboardLayout><div className="text-red-500 text-center py-12">{error}</div></DashboardLayout>;
  if (!data) return <DashboardLayout><div className="text-center py-12 text-gray-400">Tidak ada data</div></DashboardLayout>;

  const { grouped, totalPerJenis, totalKeseluruhan } = data;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border">
          <h2 className="text-xl font-semibold text-gray-800">Riwayat Simpanan</h2>
          <p className="text-sm text-gray-500">Daftar semua simpanan Anda (pokok, wajib, sukarela)</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.keys(totalPerJenis).map((key) => (
            <div key={key} className="bg-white p-4 rounded-xl shadow-sm border">
              <p className="text-sm text-gray-500">{key}</p>
              <p className="text-xl font-bold text-blue-600">{formatRupiah(totalPerJenis[key])}</p>
            </div>
          ))}
          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <p className="text-sm text-gray-500">Total Keseluruhan</p>
            <p className="text-xl font-bold text-green-600">{formatRupiah(totalKeseluruhan)}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">Jenis</th>
                  <th className="px-4 py-3 text-left">Tanggal</th>
                  <th className="px-4 py-3 text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.data.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{item.jenis_simpanan?.nama || '-'}</td>
                    <td className="px-4 py-3">{formatTanggal(item.tanggal)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatRupiah(item.jumlah)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}