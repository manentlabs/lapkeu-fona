// src/pages/bendahara/BendaharaHomePage.jsx
import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import { Bar, Pie, Line } from "react-chartjs-2";
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

export default function BendaharaHome() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get("/bendahara/dashboard");
        setData(res.data);
        setErrorMsg(null);
      } catch (error) {
        console.error("Gagal mengambil data dashboard:", error);
        setData(null);
        if (error.response?.status === 401) {
          setErrorMsg("Sesi kamu sudah berakhir. Silakan login ulang.");
        } else if (error.response?.data?.message) {
          setErrorMsg(error.response.data.message);
        } else {
          setErrorMsg("Gagal mengambil data dashboard.");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatRupiah = (number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number || 0);
  };

  // Opsi chart agar lebih rapi
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" },
    },
  };

  const barOptions = {
    ...chartOptions,
    scales: {
      y: { beginAtZero: true },
    },
  };

  // Data grafik
  const komposisiChartData = {
    labels: data?.grafik?.komposisiKeuangan?.map((item) => item.label) || [],
    datasets: [
      {
        label: "Nilai (Rp)",
        data: data?.grafik?.komposisiKeuangan?.map((item) => item.value) || [],
        backgroundColor: ["#4BC0C0", "#FF9F40", "#9966FF"],
        borderRadius: 4,
      },
    ],
  };

  const trenChartData = {
    labels: data?.grafik?.trenPendapatanBeban?.map((item) => item.bulan) || [],
    datasets: [
      {
        label: "Pendapatan",
        data: data?.grafik?.trenPendapatanBeban?.map((item) => item.pendapatan) || [],
        borderColor: "#4BC0C0",
        backgroundColor: "rgba(75,192,192,0.2)",
        fill: true,
        tension: 0.3,
      },
      {
        label: "Beban",
        data: data?.grafik?.trenPendapatanBeban?.map((item) => item.beban) || [],
        borderColor: "#FF6384",
        backgroundColor: "rgba(255,99,132,0.2)",
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const statusPinjamanChart = {
    labels: data?.grafik?.statusPinjaman?.map((item) => item.label) || [],
    datasets: [
      {
        label: "Jumlah Pinjaman",
        data: data?.grafik?.statusPinjaman?.map((item) => item.value) || [],
        backgroundColor: ["#36A2EB", "#FF6384"],
      },
    ],
  };

  // Skeleton loading sederhana
  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 animate-pulse">
          <div className="h-8 w-48 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-200 h-24 rounded-lg"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-gray-200 h-32 rounded-lg"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-200 h-64 rounded-lg"></div>
            <div className="bg-gray-200 h-64 rounded-lg"></div>
          </div>
          <div className="bg-gray-200 h-64 rounded-lg"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-red-500 font-medium text-lg">
            {errorMsg || "Gagal memuat data dashboard."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Coba lagi
          </button>
        </div>
      </DashboardLayout>
    );
  }

  // Card ringkasan
  const summaryCards = [
    {
      title: "Total Aset",
      value: formatRupiah(data.totalAset),
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "Total Kewajiban",
      value: formatRupiah(data.totalKewajiban),
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      title: "Modal",
      value: formatRupiah(data.totalModal),
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Laba / Rugi",
      value: formatRupiah(data.labaRugi),
      color: data.labaRugi >= 0 ? "text-green-600" : "text-red-600",
      bg: data.labaRugi >= 0 ? "bg-green-50" : "bg-red-50",
      detail: `Pendapatan: ${formatRupiah(data.pendapatan)} • Beban: ${formatRupiah(data.beban)}`,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
            Dashboard Bendahara
          </h1>
          <p className="text-gray-500 mt-1">Laporan keuangan dan ringkasan koperasi</p>
        </div>

        {/* Kartu Ringkasan Keuangan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map((card, idx) => (
            <div
              key={idx}
              className={`${card.bg} p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-100`}
            >
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                {card.title}
              </h3>
              <p className={`text-2xl font-bold mt-2 ${card.color}`}>
                {card.value}
              </p>
              {card.detail && (
                <p className="text-xs text-gray-500 mt-1">{card.detail}</p>
              )}
            </div>
          ))}
        </div>

        {/* Kartu Pinjaman & Simpanan & Anggota */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Pinjaman */}
          <div className="bg-white p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              Total Pinjaman
            </h3>
            <p className="text-2xl font-bold text-gray-800 mt-2">
              {data.totalPinjaman}
            </p>
            <div className="mt-3 space-y-1 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Aktif:</span>
                <span className="font-medium">{data.pinjamanAktif}</span>
              </div>
              <div className="flex justify-between">
                <span>Lunas:</span>
                <span className="font-medium">{data.pinjamanLunas}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Plafon:</span>
                <span className="font-medium">{formatRupiah(data.totalPlafon)}</span>
              </div>
              <div className="flex justify-between">
                <span>Piutang Aktif:</span>
                <span className="font-medium">{formatRupiah(data.totalPiutangAktif)}</span>
              </div>
            </div>
          </div>

          {/* Total Simpanan */}
          <div className="bg-white p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              Total Simpanan Anggota
            </h3>
            <p className="text-2xl font-bold text-gray-800 mt-2">
              {formatRupiah(data.totalSimpanan)}
            </p>
            <div className="mt-3 space-y-1 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Pokok:</span>
                <span className="font-medium">{formatRupiah(data.totalSimpananPokok)}</span>
              </div>
              <div className="flex justify-between">
                <span>Wajib:</span>
                <span className="font-medium">{formatRupiah(data.totalSimpananWajib)}</span>
              </div>
              <div className="flex justify-between">
                <span>Sukarela:</span>
                <span className="font-medium">{formatRupiah(data.totalSimpananSukarela)}</span>
              </div>
            </div>
          </div>

          {/* Anggota */}
          <div className="bg-white p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              Anggota
            </h3>
            <p className="text-2xl font-bold text-gray-800 mt-2">
              {data.totalAnggota}
            </p>
            <div className="mt-3 space-y-1 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Aktif:</span>
                <span className="font-medium text-green-600">{data.anggotaAktif}</span>
              </div>
              <div className="flex justify-between">
                <span>Nonaktif:</span>
                <span className="font-medium text-red-600">{data.anggotaNonaktif}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Grafik */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-gray-700 font-semibold mb-4">
              Komposisi Keuangan (Aset, Kewajiban, Modal)
            </h3>
            <div className="h-64">
              <Bar data={komposisiChartData} options={barOptions} />
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-gray-700 font-semibold mb-4">
              Status Pinjaman
            </h3>
            <div className="h-64 flex items-center justify-center">
              <Pie data={statusPinjamanChart} options={chartOptions} />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-gray-700 font-semibold mb-4">
            Tren Pendapatan & Beban (6 bulan terakhir)
          </h3>
          <div className="h-72">
            <Line data={trenChartData} options={chartOptions} />
          </div>
        </div>

        {/* Transaksi Terbaru */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-gray-700 font-semibold">Transaksi Terbaru</h3>
            <span className="text-sm text-gray-400">
              {data.transaksiTerbaru?.length || 0} transaksi
            </span>
          </div>
          {data.transaksiTerbaru && data.transaksiTerbaru.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      No. Transaksi
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tanggal
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Deskripsi
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Jumlah
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Anggota
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.transaksiTerbaru.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {t.no_transaksi}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{t.tanggal}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{t.deskripsi}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-800">
                        {formatRupiah(t.jumlah)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{t.user || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{t.anggota || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">Belum ada transaksi terbaru.</p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}