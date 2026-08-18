// src/pages/KalkulatorPajakPage.jsx
import React, { useState, useEffect } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import {
  Calculator,
  FileText,
  Copy,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Users,
  ShoppingBag,
  Briefcase,
} from "lucide-react";

function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function parseRupiah(value) {
  return parseFloat(value.replace(/[^0-9]/g, "")) || 0;
}

export default function KalkulatorPajakPage() {
  const [jenisPajak, setJenisPajak] = useState("ppn");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // ─── State per jenis pajak ──────────────────────────────────
  // PPN
  const [ppnData, setPpnData] = useState({
    totalPenjualan: "",
    totalPembelian: "",
    tarif: 11,
  });
  const [ppnResult, setPpnResult] = useState(null);

  // PPh 21
  const [pph21Data, setPph21Data] = useState({
    totalGaji: "",
    totalPegawai: 1,
    tarif: 5,
  });
  const [pph21Result, setPph21Result] = useState(null);

  // PPh 23
  const [pph23Data, setPph23Data] = useState({
    totalJasa: "",
    tarif: 2,
    jenis: "jasa", // jasa / sewa
  });
  const [pph23Result, setPph23Result] = useState(null);

  // PPh Badan
  const [pphBadanData, setPphBadanData] = useState({
    labaBersih: "",
    tarif: 22,
  });
  const [pphBadanResult, setPphBadanResult] = useState(null);

  // ─── Hitung PPN ─────────────────────────────────────────────
  const hitungPpn = () => {
    const totalPenjualan = parseFloat(ppnData.totalPenjualan) || 0;
    const totalPembelian = parseFloat(ppnData.totalPembelian) || 0;
    const tarif = parseFloat(ppnData.tarif) / 100;

    const ppnKeluaran = totalPenjualan * tarif;
    const ppnMasukan = totalPembelian * tarif;
    const ppnKurangBayar = ppnKeluaran - ppnMasukan;

    setPpnResult({
      ppnKeluaran,
      ppnMasukan,
      ppnKurangBayar,
      status: ppnKurangBayar > 0 ? "Kurang Bayar" : ppnKurangBayar < 0 ? "Lebih Bayar" : "Nihil",
      jurnal: [
        { akun: "Utang PPN Keluaran", debet: 0, kredit: ppnKeluaran },
        { akun: "PPN Masukan (Piutang)", debet: ppnMasukan, kredit: 0 },
        { akun: "Kas", debet: ppnKurangBayar > 0 ? ppnKurangBayar : 0, kredit: ppnKurangBayar < 0 ? Math.abs(ppnKurangBayar) : 0 },
      ],
    });
  };

  // ─── Hitung PPh 21 ──────────────────────────────────────────
  const hitungPph21 = () => {
    const totalGaji = parseFloat(pph21Data.totalGaji) || 0;
    const tarif = parseFloat(pph21Data.tarif) / 100;
    const pph21 = totalGaji * tarif;

    setPph21Result({
      pph21,
      totalGaji,
      tarif: pph21Data.tarif,
      jurnal: [
        { akun: "Beban Gaji", debet: totalGaji, kredit: 0 },
        { akun: "Utang PPh Pasal 21", debet: 0, kredit: pph21 },
        { akun: "Kas", debet: 0, kredit: totalGaji - pph21 },
      ],
    });
  };

  // ─── Hitung PPh 23 ──────────────────────────────────────────
  const hitungPph23 = () => {
    const totalJasa = parseFloat(pph23Data.totalJasa) || 0;
    const tarif = parseFloat(pph23Data.tarif) / 100;
    const pph23 = totalJasa * tarif;

    setPph23Result({
      pph23,
      totalJasa,
      tarif: pph23Data.tarif,
      jenis: pph23Data.jenis,
      jurnal: [
        { akun: "Beban Jasa", debet: totalJasa, kredit: 0 },
        { akun: "Utang PPh Pasal 23", debet: 0, kredit: pph23 },
        { akun: "Kas", debet: 0, kredit: totalJasa - pph23 },
      ],
    });
  };

  // ─── Hitung PPh Badan ───────────────────────────────────────
  const hitungPphBadan = () => {
    const labaBersih = parseFloat(pphBadanData.labaBersih) || 0;
    const tarif = parseFloat(pphBadanData.tarif) / 100;
    const pphBadan = labaBersih * tarif;

    setPphBadanResult({
      pphBadan,
      labaBersih,
      tarif: pphBadanData.tarif,
      jurnal: [
        { akun: "Beban PPh Badan", debet: pphBadan, kredit: 0 },
        { akun: "Utang PPh Badan", debet: 0, kredit: pphBadan },
      ],
    });
  };

  // ─── Copy Jurnal ────────────────────────────────────────────
  const copyJurnal = (jurnal) => {
    const text = jurnal
      .map((j) => `${j.akun}\tDebet: ${formatRupiah(j.debet)}\tKredit: ${formatRupiah(j.kredit)}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Render Hasil ────────────────────────────────────────────
  const renderHasil = (result, title, color) => {
    if (!result) return null;

    return (
      <div className="mt-6 p-4 rounded-xl border-2" style={{ borderColor: color }}>
        <h4 className="font-semibold text-gray-800 flex items-center gap-2">
          <FileText size={18} /> {title}
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          {Object.entries(result)
            .filter(([key]) => key !== "jurnal")
            .map(([key, value]) => (
              <div key={key} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase">{key.replace(/_/g, " ")}</p>
                <p className="text-sm font-semibold">
                  {typeof value === "number" ? `Rp ${formatRupiah(value)}` : value}
                </p>
              </div>
            ))}
        </div>

        {/* Tabel Jurnal */}
        <div className="mt-4 border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left">Akun</th>
                <th className="px-4 py-2 text-right">Debet</th>
                <th className="px-4 py-2 text-right">Kredit</th>
              </tr>
            </thead>
            <tbody>
              {result.jurnal.map((j, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-4 py-2">{j.akun}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    {j.debet > 0 ? `Rp ${formatRupiah(j.debet)}` : "-"}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {j.kredit > 0 ? `Rp ${formatRupiah(j.kredit)}` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tombol Copy & Buat Transaksi */}
        <div className="flex flex-wrap gap-3 mt-4">
          <button
            onClick={() => copyJurnal(result.jurnal)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Tersalin!" : "Salin Jurnal"}
          </button>
          <button
            onClick={() => {
              alert("Fungsi ini akan membuka halaman Transaksi dengan jurnal terisi otomatis (coming soon)");
            }}
            className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg text-sm hover:bg-blue-50"
          >
            <Briefcase size={16} /> Buat Transaksi
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          💡 Hasil jurnal dapat disalin dan diinput ke menu Transaksi Bendahara
        </p>
      </div>
    );
  };

  // ─── Render Form ────────────────────────────────────────────
  const renderForm = () => {
    switch (jenisPajak) {
      case "ppn":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Total Penjualan (Rp)</label>
                <input
                  type="number"
                  value={ppnData.totalPenjualan}
                  onChange={(e) => setPpnData({ ...ppnData, totalPenjualan: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Total Pembelian (Rp)</label>
                <input
                  type="number"
                  value={ppnData.totalPembelian}
                  onChange={(e) => setPpnData({ ...ppnData, totalPembelian: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Tarif PPN (%)</label>
              <input
                type="number"
                value={ppnData.tarif}
                onChange={(e) => setPpnData({ ...ppnData, tarif: parseFloat(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                step="0.01"
              />
              <p className="text-xs text-gray-400 mt-1">Tarif default 11% (UU HPP)</p>
            </div>
            <button
              onClick={hitungPpn}
              className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Hitung PPN
            </button>
            {renderHasil(ppnResult, "Hasil Perhitungan PPN", "#22c55e")}
          </div>
        );

      case "pph21":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Total Gaji Bruto (Rp)</label>
              <input
                type="number"
                value={pph21Data.totalGaji}
                onChange={(e) => setPph21Data({ ...pph21Data, totalGaji: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Tarif PPh 21 (%)</label>
              <input
                type="number"
                value={pph21Data.tarif}
                onChange={(e) => setPph21Data({ ...pph21Data, tarif: parseFloat(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                step="0.1"
              />
              <p className="text-xs text-gray-400 mt-1">
                Tarif progresif: 5% (≤60jt), 15% (60-250jt), 25% (250-500jt), 30% (500jt-5M), 35% (&gt;5M)
              </p>
            </div>
            <button
              onClick={hitungPph21}
              className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Hitung PPh 21
            </button>
            {renderHasil(pph21Result, "Hasil Perhitungan PPh 21", "#3b82f6")}
          </div>
        );

      case "pph23":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Jenis Transaksi</label>
              <select
                value={pph23Data.jenis}
                onChange={(e) => setPph23Data({ ...pph23Data, jenis: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="jasa">Jasa (2%)</option>
                <option value="sewa">Sewa (10%)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Total Bruto (Rp)</label>
              <input
                type="number"
                value={pph23Data.totalJasa}
                onChange={(e) => setPph23Data({ ...pph23Data, totalJasa: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Tarif PPh 23 (%)</label>
              <input
                type="number"
                value={pph23Data.tarif}
                onChange={(e) => setPph23Data({ ...pph23Data, tarif: parseFloat(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                step="0.1"
              />
              <p className="text-xs text-gray-400 mt-1">
                Default: Jasa 2%, Sewa 10%, Sesuaikan dengan jenis jasa
              </p>
            </div>
            <button
              onClick={hitungPph23}
              className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Hitung PPh 23
            </button>
            {renderHasil(pph23Result, "Hasil Perhitungan PPh 23", "#f59e0b")}
          </div>
        );

      case "pphBadan":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Laba Bersih Fiskal (Rp)</label>
              <input
                type="number"
                value={pphBadanData.labaBersih}
                onChange={(e) => setPphBadanData({ ...pphBadanData, labaBersih: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
              <p className="text-xs text-gray-400 mt-1">Laba setelah koreksi fiskal</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Tarif PPh Badan (%)</label>
              <input
                type="number"
                value={pphBadanData.tarif}
                onChange={(e) => setPphBadanData({ ...pphBadanData, tarif: parseFloat(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                step="0.1"
              />
              <p className="text-xs text-gray-400 mt-1">Tarif default 22% (PPh Badan)</p>
            </div>
            <button
              onClick={hitungPphBadan}
              className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Hitung PPh Badan
            </button>
            {renderHasil(pphBadanResult, "Hasil Perhitungan PPh Badan", "#ef4444")}
          </div>
        );

      default:
        return null;
    }
  };

  // ─── Main Render ────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Calculator size={24} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Kalkulator Pajak</h2>
              <p className="text-sm text-gray-500">
                Hitung pajak dan dapatkan jurnal siap input untuk Bendahara
              </p>
            </div>
          </div>
        </div>

        {/* Pilihan Jenis Pajak */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => setJenisPajak("ppn")}
              className={`p-3 rounded-lg text-sm font-medium border transition ${
                jenisPajak === "ppn"
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <ShoppingBag size={18} className="mx-auto mb-1" />
              PPN
            </button>
            <button
              onClick={() => setJenisPajak("pph21")}
              className={`p-3 rounded-lg text-sm font-medium border transition ${
                jenisPajak === "pph21"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <Users size={18} className="mx-auto mb-1" />
              PPh 21
            </button>
            <button
              onClick={() => setJenisPajak("pph23")}
              className={`p-3 rounded-lg text-sm font-medium border transition ${
                jenisPajak === "pph23"
                  ? "border-amber-500 bg-amber-50 text-amber-700"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <FileText size={18} className="mx-auto mb-1" />
              PPh 23
            </button>
            <button
              onClick={() => setJenisPajak("pphBadan")}
              className={`p-3 rounded-lg text-sm font-medium border transition ${
                jenisPajak === "pphBadan"
                  ? "border-red-500 bg-red-50 text-red-700"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <Briefcase size={18} className="mx-auto mb-1" />
              PPh Badan
            </button>
          </div>
        </div>

        {/* Form & Hasil */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={16} className="text-gray-400" />
            <p className="text-sm text-gray-500">
              Masukkan data, hitung, lalu salin jurnal ke menu Transaksi Bendahara
            </p>
          </div>
          {renderForm()}
        </div>

        {/* Catatan */}
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <h4 className="font-medium text-amber-800 flex items-center gap-2">
            <AlertCircle size={18} /> Catatan Penting
          </h4>
          <ul className="text-sm text-amber-700 space-y-1 mt-2 list-disc list-inside">
            <li>Kalkulator ini adalah alat bantu, bukan sistem pajak resmi.</li>
            <li>Konsultasikan dengan akuntan/pajak untuk keakuratan perhitungan.</li>
            <li>Pastikan kode akun yang digunakan sesuai dengan chart of account Anda.</li>
            <li>PPh 21 menggunakan tarif progresif, sesuaikan dengan lapisan penghasilan.</li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}