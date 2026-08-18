// src/pages/admin/AdminHome.jsx
import React, { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import {
  Users,
  BookOpen,
  Hash,
  User,
  PieChart,
  Activity,
  CheckCircle,
  XCircle,
  Layers,
  UserCheck,
  UserX,
  Book,
} from "lucide-react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from "chart.js";
import { Pie, Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

export default function AdminHome() {
  const [stats, setStats] = useState(null);
  const [grafik, setGrafik] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await api.get("/admin/dashboard");
        setStats(data);
        setGrafik(data.grafik);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  // Data chart
  const chartColors = {
    blue: "#3b82f6",
    green: "#22c55e",
    red: "#ef4444",
    purple: "#8b5cf6",
    orange: "#f59e0b",
    teal: "#14b8a6",
    pink: "#ec4899",
    indigo: "#6366f1",
    gray: "#6b7280",
    cyan: "#06b6d4",
    amber: "#f59e0b",
  };

  // Data pie: Status Anggota
  const anggotaStatusData = {
    labels: ["Aktif", "Nonaktif"],
    datasets: [
      {
        data: [stats?.anggotaAktif || 0, stats?.anggotaNonaktif || 0],
        backgroundColor: [chartColors.green, chartColors.red],
        borderWidth: 2,
        borderColor: "#fff",
      },
    ],
  };

  // Data pie: Status User
  const userStatusData = {
    labels: ["Aktif", "Nonaktif"],
    datasets: [
      {
        data: [stats?.userAktif || 0, stats?.userNonaktif || 0],
        backgroundColor: [chartColors.blue, chartColors.gray],
        borderWidth: 2,
        borderColor: "#fff",
      },
    ],
  };

  // Data pie: Akun Induk vs Sub
  const akunHierarkiData = {
    labels: ["Akun Induk", "Sub Akun"],
    datasets: [
      {
        data: [stats?.totalAkunInduk || 0, stats?.totalAkunSub || 0],
        backgroundColor: [chartColors.purple, chartColors.cyan],
        borderWidth: 2,
        borderColor: "#fff",
      },
    ],
  };

  // Data bar: Ringkasan umum
  const ringkasanData = {
    labels: ["Anggota", "Akun", "User", "Referensi", "Persentase SHU"],
    datasets: [
      {
        label: "Total Data",
        data: [
          stats?.totalAnggota || 0,
          stats?.totalAkun || 0,
          stats?.totalUser || 0,
          stats?.totalReferensi || 0,
          stats?.totalPersentaseShu || 0,
        ],
        backgroundColor: [
          chartColors.blue,
          chartColors.purple,
          chartColors.green,
          chartColors.orange,
          chartColors.pink,
        ],
        borderRadius: 8,
      },
    ],
  };

  // Data bar: Anggota per Kecamatan (Top 5)
  const kecamatanLabels = grafik?.anggotaPerKecamatan?.map((item) => item.label) || [];
  const kecamatanValues = grafik?.anggotaPerKecamatan?.map((item) => item.value) || [];

  const anggotaKecamatanData = {
    labels: kecamatanLabels.length ? kecamatanLabels : ["Tidak ada data"],
    datasets: [
      {
        label: "Jumlah Anggota",
        data: kecamatanLabels.length ? kecamatanValues : [0],
        backgroundColor: chartColors.teal,
        borderRadius: 8,
      },
    ],
  };

  // Card data
  const cards = [
    { title: "Total Anggota", value: stats?.totalAnggota || 0, icon: Users, color: "blue" },
    { title: "Anggota Aktif", value: stats?.anggotaAktif || 0, icon: CheckCircle, color: "green" },
    { title: "Anggota Nonaktif", value: stats?.anggotaNonaktif || 0, icon: XCircle, color: "red" },
    { title: "Total Akun", value: stats?.totalAkun || 0, icon: BookOpen, color: "purple" },
    { title: "Akun Induk", value: stats?.totalAkunInduk || 0, icon: Layers, color: "indigo" },
    { title: "Sub Akun", value: stats?.totalAkunSub || 0, icon: Book, color: "teal" },
    { title: "Total User", value: stats?.totalUser || 0, icon: User, color: "orange" },
    { title: "User Aktif", value: stats?.userAktif || 0, icon: UserCheck, color: "green" },
    { title: "User Nonaktif", value: stats?.userNonaktif || 0, icon: UserX, color: "gray" },
    { title: "Kode Referensi", value: stats?.totalReferensi || 0, icon: Hash, color: "pink" },
    { title: "Persentase SHU", value: stats?.totalPersentaseShu || 0, icon: PieChart, color: "amber" },
  ];

  const colorMap = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    red: "bg-red-100 text-red-600",
    purple: "bg-purple-100 text-purple-600",
    indigo: "bg-indigo-100 text-indigo-600",
    teal: "bg-teal-100 text-teal-600",
    orange: "bg-orange-100 text-orange-600",
    pink: "bg-pink-100 text-pink-600",
    amber: "bg-amber-100 text-amber-600",
    gray: "bg-gray-100 text-gray-600",
  };

  // Opsi chart
  const pieOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "bottom",
      },
    },
  };

  const barOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          drawBorder: false,
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Dashboard Admin</h2>
          <p className="text-gray-500">Ringkasan data koperasi secara keseluruhan.</p>
        </div>

        {/* Grid Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div
                key={idx}
                className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{card.title}</p>
                    <p className="text-2xl font-bold text-gray-800">{card.value}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${colorMap[card.color]}`}>
                    <Icon size={20} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Pie: Status Anggota */}
          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Status Anggota</h3>
            <div className="h-64 flex items-center justify-center">
              <Pie data={anggotaStatusData} options={pieOptions} />
            </div>
          </div>

          {/* Pie: Status User */}
          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Status User</h3>
            <div className="h-64 flex items-center justify-center">
              <Pie data={userStatusData} options={pieOptions} />
            </div>
          </div>

          {/* Pie: Hierarki Akun */}
          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Hierarki Akun</h3>
            <div className="h-64 flex items-center justify-center">
              <Doughnut data={akunHierarkiData} options={pieOptions} />
            </div>
          </div>
        </div>

        {/* Bar: Ringkasan Umum */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Ringkasan Umum Data</h3>
          <div className="h-72">
            <Bar data={ringkasanData} options={barOptions} />
          </div>
        </div>

        {/* Bar: Anggota per Kecamatan */}
        {kecamatanLabels.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Anggota per Kecamatan (Top 5)</h3>
            <div className="h-72">
              <Bar data={anggotaKecamatanData} options={barOptions} />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}