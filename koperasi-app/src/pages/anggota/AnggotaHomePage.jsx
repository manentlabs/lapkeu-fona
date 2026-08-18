// src/pages/anggota/AnggotaHomePage.jsx
import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { Doughnut, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from "chart.js";
import api from "../../api/axios";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

export default function AnggotaHomePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get("/anggota-koperasi/dashboard");
        setData(res.data);
      } catch (err) {
        // Error 401 sudah ditangani oleh interceptor, tapi kita tetap tampilkan pesan
        console.error("Error fetching anggota dashboard:", err);
        setError(err.response?.data?.message || "Gagal mengambil data dashboard");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Helper format Rupiah
  const formatRupiah = (number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Memuat data anggota...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="text-red-500">Gagal memuat data: {error}</div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div className="text-gray-500">Belum ada data.</div>
      </DashboardLayout>
    );
  }

  // Data grafik
  const simpananChartData = {
    labels: ["Simpanan Pokok", "Simpanan Wajib", "Simpanan Sukarela"],
    datasets: [
      {
        label: "Jumlah Simpanan (Rp)",
        data: [
          data.totalSimpananPokok || 0,
          data.totalSimpananWajib || 0,
          data.totalSimpananSukarela || 0,
        ],
        backgroundColor: ["#4BC0C0", "#FF9F40", "#9966FF"],
      },
    ],
  };

  const pinjamanChartData = {
    labels: ["Aktif", "Lunas"],
    datasets: [
      {
        label: "Jumlah Pinjaman",
        data: [data.pinjamanAktif || 0, data.pinjamanLunas || 0],
        backgroundColor: ["#36A2EB", "#FF6384"],
      },
    ],
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard Anggota</h1>

        {/* Kartu Ringkasan */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded shadow">
            <h3 className="text-gray-500 text-sm">Total Simpanan</h3>
            <p className="text-2xl font-semibold text-blue-600">
              {formatRupiah(data.totalSimpanan || 0)}
            </p>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <h3 className="text-gray-500 text-sm">Total Tabungan</h3>
            <p className="text-2xl font-semibold text-green-600">
              {formatRupiah(data.totalTabungan || 0)}
            </p>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <h3 className="text-gray-500 text-sm">Total Piutang</h3>
            <p className="text-2xl font-semibold text-red-600">
              {formatRupiah(data.totalPiutang || 0)}
            </p>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <h3 className="text-gray-500 text-sm">Sisa Angsuran</h3>
            <p className="text-2xl font-semibold text-orange-600">
              {data.sisaAngsuran || 0} bulan
            </p>
          </div>
        </div>

        {/* Detail Pinjaman */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded shadow">
            <h3 className="text-gray-500 text-sm">Total Plafon Pinjaman</h3>
            <p className="text-xl font-semibold">
              {formatRupiah(data.totalPlafon || 0)}
            </p>
            <div className="text-sm text-gray-600">
              Aktif: {data.pinjamanAktif || 0} pinjaman &bull; Lunas:{" "}
              {data.pinjamanLunas || 0}
            </div>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <h3 className="text-gray-500 text-sm">Simpanan Per Jenis</h3>
            <ul className="mt-2 space-y-1 text-sm">
              <li>Pokok: {formatRupiah(data.totalSimpananPokok || 0)}</li>
              <li>Wajib: {formatRupiah(data.totalSimpananWajib || 0)}</li>
              <li>Sukarela: {formatRupiah(data.totalSimpananSukarela || 0)}</li>
            </ul>
          </div>
        
          <div className="bg-white p-4 rounded shadow">
            <h3 className="text-gray-600 font-medium mb-2">Komposisi Simpanan</h3>
            <Doughnut data={simpananChartData} />
          </div>
          <div className="bg-white p-4 rounded shadow">
            <h3 className="text-gray-600 font-medium mb-2">Status Pinjaman</h3>
            <Pie data={pinjamanChartData} />
          </div>
        </div>

        {/* Transaksi Terbaru */}
        {data.transaksiTerbaru && data.transaksiTerbaru.length > 0 && (
          <div className="bg-white p-4 rounded shadow">
            <h3 className="text-gray-600 font-medium mb-2">Transaksi Terbaru</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Tanggal
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Deskripsi
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Jumlah
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.transaksiTerbaru.map((t, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2 text-sm">{t.tanggal}</td>
                      <td className="px-4 py-2 text-sm">{t.deskripsi}</td>
                      <td className="px-4 py-2 text-sm">
                        {formatRupiah(t.jumlah)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}