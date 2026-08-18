import React, { useState, useEffect, useCallback } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import {
  Building2,
  ArrowDownCircle,
  PiggyBank,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Download,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  ChevronUp,
  ChevronRight,
} from "lucide-react";

// ─── Helper format Rupiah ────────────────────────────────────
function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// ─── Helper untuk formatting angka negatif dengan tanda kurung ──
function formatNegatif(value) {
  const num = parseFloat(value) || 0;
  if (num < 0) {
    return { text: `(${formatRupiah(Math.abs(num))})`, isMinus: true };
  }
  return { text: formatRupiah(num), isMinus: false };
}

// ─── Komponen Summary Card (selaras dengan halaman Transaksi) ──
function SummaryCard({ label, value, icon: Icon, color = "blue", status = false }) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    green: "bg-green-50 text-green-600 border-green-200",
    purple: "bg-purple-50 text-purple-600 border-purple-200",
    amber: "bg-amber-50 text-amber-600 border-amber-200",
    teal: "bg-teal-50 text-teal-600 border-teal-200",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-200",
    red: "bg-red-50 text-red-600 border-red-200",
  };

  return (
    <div className={`p-3 rounded-xl border ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-center gap-2">
        <Icon size={16} className="opacity-70" />
        <p className="text-xs font-medium opacity-70">{label}</p>
      </div>
      <p className="text-lg font-bold mt-1">
        {status ? value : typeof value === "string" ? value : `Rp ${formatRupiah(value)}`}
      </p>
    </div>
  );
}

// ─── Komponen Tabel Neraca ──────────────────────────────────
function NeracaTable({
  dataAktiva,
  dataPasiva,
  labelBerjalan,
  labelSebelumnya,
  totalAset,
  totalAsetAwal,
  totalKewajibanModal,
  totalKewajibanModalAwal,
}) {
  const maxRows = Math.max(dataAktiva.length, dataPasiva.length);

  const renderCell = (row, type) => {
    if (!row) return null;
    const rowType = row.type;
    const isGroup = rowType === "group";
    const isParent = rowType === "parent";
    const isRow = rowType === "row";
    const isSubtotal = rowType === "subtotal";
    const isSHU = row.kode === "SHU";

    if (isGroup) {
      return (
        <td colSpan={type === "aktiva" ? 3 : 4} className="bg-gray-50 font-bold text-gray-700 text-xs uppercase tracking-wider py-1.5 px-3">
          {row.label}
        </td>
      );
    }

    if (isParent) {
      return (
        <td colSpan={type === "aktiva" ? 3 : 4} className="bg-gray-50/60 py-1.5 px-3">
          <span className="flex items-center gap-1 text-sm font-semibold text-gray-600" style={{ paddingLeft: `${(row.depth || 0) * 16}px` }}>
            <ChevronRight size={14} className="opacity-50" />
            {row.nama}
          </span>
        </td>
      );
    }

    if (isRow || isSubtotal) {
      const isRowData = isRow;
      const berjalan = row.berjalan;
      const sebelumnya = row.sebelumnya;
      const fmtBerjalan = formatNegatif(berjalan);
      const fmtSebelumnya = formatNegatif(sebelumnya);

      return (
        <>
          {type === "aktiva" && (
            <>
              <td className="text-center text-gray-400 text-sm w-8">
                {isRowData && row.no ? <span className="text-gray-400">{row.no}</span> : null}
              </td>
              <td className="py-1.5 px-3">
                <span
                  className={`${isSubtotal ? "font-bold text-gray-800" : ""} ${isSHU ? "font-bold text-amber-700" : ""}`}
                  style={{ paddingLeft: isRowData ? `${(row.depth || 0) * 16}px` : 0 }}
                >
                  {row.nama}
                </span>
              </td>
            </>
          )}
          <td className={`text-right font-mono text-sm py-1.5 px-3 ${fmtBerjalan.isMinus ? "text-red-600" : "text-gray-700"}`}>
            {fmtBerjalan.text}
          </td>
          <td className={`text-right font-mono text-sm py-1.5 px-3 text-gray-500 ${fmtSebelumnya.isMinus ? "text-red-400" : ""}`}>
            {fmtSebelumnya.text}
          </td>
          {type === "pasiva" && (
            <>
              <td className="text-center text-gray-400 text-sm w-8">
                {isRowData && row.no ? <span className="text-gray-400">{row.no}</span> : null}
              </td>
              <td className="py-1.5 px-3">
                <span
                  className={`${isSubtotal ? "font-bold text-gray-800" : ""} ${isSHU ? "font-bold text-amber-700" : ""}`}
                  style={{ paddingLeft: isRowData ? `${(row.depth || 0) * 16}px` : 0 }}
                >
                  {row.nama}
                </span>
              </td>
            </>
          )}
        </>
      );
    }

    return null;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <colgroup>
          <col className="w-[5%]" />
          <col className="w-[25%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[2%]" />
          <col className="w-[5%]" />
          <col className="w-[25%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
        </colgroup>
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="py-2 px-2 text-center text-xs font-semibold uppercase tracking-wider border-b border-gray-200">No</th>
            <th className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wider border-b border-gray-200">AKTIVA / URAIAN</th>
            <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider border-b border-gray-200">{labelBerjalan}</th>
            <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider border-b border-gray-200">{labelSebelumnya}</th>
            <th className="py-0 px-0 border-b border-gray-200 w-[2%]"></th>
            <th className="py-2 px-2 text-center text-xs font-semibold uppercase tracking-wider border-b border-gray-200">No</th>
            <th className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wider border-b border-gray-200">PASIVA / URAIAN</th>
            <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider border-b border-gray-200">{labelBerjalan}</th>
            <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider border-b border-gray-200">{labelSebelumnya}</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: Math.max(1, maxRows) }).map((_, idx) => {
            const a = dataAktiva[idx] || null;
            const p = dataPasiva[idx] || null;
            const isGroupA = a?.type === "group";
            const isSubtotalA = a?.type === "subtotal";
            const isGroupP = p?.type === "group";
            const isSubtotalP = p?.type === "subtotal";

            let rowClass = "";
            if (isGroupA || isGroupP) rowClass = "bg-gray-50/60";
            else if (isSubtotalA || isSubtotalP) rowClass = "bg-gray-100/60 border-t border-gray-200 font-semibold";
            else rowClass = "hover:bg-gray-50";

            return (
              <tr key={idx} className={`${rowClass} border-b border-gray-100`}>
                {/* Aktiva */}
                {a ? (
                  <>
                    {renderCell(a, "aktiva")}
                    <td className="border-r border-gray-200 bg-gray-50 w-[2%]"></td>
                  </>
                ) : (
                  <>
                    <td colSpan="4"></td>
                    <td className="border-r border-gray-200 bg-gray-50 w-[2%]"></td>
                  </>
                )}

                {/* Pasiva */}
                {p ? (
                  renderCell(p, "pasiva")
                ) : (
                  <>
                    <td colSpan="4"></td>
                  </>
                )}
              </tr>
            );
          })}

          {/* Total Row */}
          <tr className="bg-blue-600 text-white font-bold border-t-2 border-blue-700">
            <td colSpan="2" className="py-2 px-3 text-center">TOTAL AKTIVA</td>
            <td className="py-2 px-3 text-right font-mono">{formatRupiah(totalAset)}</td>
            <td className="py-2 px-3 text-right font-mono">{formatRupiah(totalAsetAwal)}</td>
            <td className="bg-blue-700"></td>
            <td colSpan="2" className="py-2 px-3 text-center">TOTAL PASIVA</td>
            <td className="py-2 px-3 text-right font-mono">{formatRupiah(totalKewajibanModal)}</td>
            <td className="py-2 px-3 text-right font-mono">{formatRupiah(totalKewajibanModalAwal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Komponen Mobile ──────────────────────────────────────────
function NeracaMobile({ dataAktiva, dataPasiva, labelBerjalan, labelSebelumnya, totalAset, totalAsetAwal, totalKewajibanModal, totalKewajibanModalAwal }) {
  const renderMobileSection = (data, title, total, totalAwal, icon) => {
    const fmtTotal = formatRupiah(total);
    const fmtTotalAwal = formatRupiah(totalAwal);

    return (
      <div className="mb-6 last:mb-0">
        <div className="flex items-center gap-2 bg-gray-50 px-4 py-3 border-b-2 border-blue-600">
          {icon}
          <span className="font-semibold text-gray-700 text-sm uppercase tracking-wider">{title}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <colgroup>
              <col className="w-[10%]" />
              <col className="w-auto" />
              <col className="w-[30%]" />
              <col className="w-[30%]" />
            </colgroup>
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="py-1.5 px-2 text-center text-xs font-semibold border-b border-gray-200">No</th>
                <th className="py-1.5 px-2 text-left text-xs font-semibold border-b border-gray-200">Uraian</th>
                <th className="py-1.5 px-2 text-right text-xs font-semibold border-b border-gray-200">{labelBerjalan}</th>
                <th className="py-1.5 px-2 text-right text-xs font-semibold border-b border-gray-200">{labelSebelumnya}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => {
                if (row.type === "group") {
                  return (
                    <tr key={idx} className="bg-gray-50">
                      <td colSpan="4" className="py-1 px-3 font-bold text-gray-700 text-xs uppercase tracking-wider">{row.label}</td>
                    </tr>
                  );
                }
                if (row.type === "parent") {
                  return (
                    <tr key={idx} className="bg-gray-50/60">
                      <td colSpan="4" className="py-1 px-3">
                        <span className="flex items-center gap-1 text-sm font-semibold text-gray-600" style={{ paddingLeft: `${(row.depth || 0) * 16}px` }}>
                          <ChevronRight size={14} className="opacity-50" /> {row.nama}
                        </span>
                      </td>
                    </tr>
                  );
                }
                if (row.type === "row") {
                  const fmtBerjalan = formatNegatif(row.berjalan);
                  const fmtSebelumnya = formatNegatif(row.sebelumnya);
                  const isSHU = row.kode === "SHU";
                  return (
                    <tr key={idx} className={`hover:bg-gray-50 ${isSHU ? "bg-amber-50/50" : ""}`}>
                      <td className="py-1 px-2 text-center text-gray-400 text-sm">{row.no}</td>
                      <td className="py-1 px-2" style={{ paddingLeft: `${(row.depth || 0) * 16 + 8}px` }}>
                        <span className={`${isSHU ? "font-bold text-amber-700" : ""}`}>{row.nama}</span>
                      </td>
                      <td className={`py-1 px-2 text-right font-mono ${fmtBerjalan.isMinus ? "text-red-600" : "text-gray-700"}`}>
                        {fmtBerjalan.text}
                      </td>
                      <td className={`py-1 px-2 text-right font-mono text-gray-500 ${fmtSebelumnya.isMinus ? "text-red-400" : ""}`}>
                        {fmtSebelumnya.text}
                      </td>
                    </tr>
                  );
                }
                if (row.type === "subtotal") {
                  const fmtBerjalan = formatNegatif(row.berjalan);
                  const fmtSebelumnya = formatNegatif(row.sebelumnya);
                  return (
                    <tr key={idx} className="bg-gray-100/60 border-t border-gray-200 font-semibold">
                      <td colSpan="2" className="py-1 px-3 font-bold text-gray-800">{row.label}</td>
                      <td className="py-1 px-2 text-right font-mono text-gray-700">{fmtBerjalan.text}</td>
                      <td className="py-1 px-2 text-right font-mono text-gray-500">{fmtSebelumnya.text}</td>
                    </tr>
                  );
                }
                return null;
              })}
              <tr className="bg-blue-600 text-white font-bold border-t-2 border-blue-700">
                <td colSpan="2" className="py-2 px-3 text-center">TOTAL {title.toUpperCase()}</td>
                <td className="py-2 px-3 text-right font-mono">{fmtTotal}</td>
                <td className="py-2 px-3 text-right font-mono">{fmtTotalAwal}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {renderMobileSection(dataAktiva, "Aktiva", totalAset, totalAsetAwal, <Building2 size={18} className="text-blue-600" />)}
      {renderMobileSection(dataPasiva, "Pasiva", totalKewajibanModal, totalKewajibanModalAwal, <PiggyBank size={18} className="text-blue-600" />)}
    </div>
  );
}

// ─── Halaman Utama ────────────────────────────────────────────
export default function NeracaPage() {
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Fetch data
  const fetchData = useCallback(async (dariDate = "", sampaiDate = "") => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (dariDate) params.dari = dariDate;
      if (sampaiDate) params.sampai = sampaiDate;
      const response = await api.get("/bendahara/neraca", { params });
      setData(response.data);
    } catch (err) {
      console.error("Gagal fetch neraca:", err);
      setError(err.response?.data?.message || "Gagal memuat data neraca.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const now = new Date();
    const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const defaultDari = yearAgo.toISOString().slice(0, 10);
    const defaultSampai = now.toISOString().slice(0, 10);
    setDari(defaultDari);
    setSampai(defaultSampai);
    fetchData(defaultDari, defaultSampai);
  }, [fetchData]);

  const handleFilter = (e) => {
    e.preventDefault();
    fetchData(dari, sampai);
  };

  const resetFilter = () => {
    const now = new Date();
    const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const defaultDari = yearAgo.toISOString().slice(0, 10);
    const defaultSampai = now.toISOString().slice(0, 10);
    setDari(defaultDari);
    setSampai(defaultSampai);
    fetchData(defaultDari, defaultSampai);
  };

  const handleExport = async (type) => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (dari) params.append("dari", dari);
      if (sampai) params.append("sampai", sampai);
      params.append("export", type);
      if (type === "pdf") {
        params.append("nomor", "---");
        params.append("tanggal", new Date().toISOString().slice(0, 10));
      }
      const response = await api.get(`/bendahara/neraca/export?${params.toString()}`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(
        new Blob([response.data], {
          type: type === "excel"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "application/pdf",
        })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `neraca-${new Date().toISOString().slice(0, 10)}.${type === "excel" ? "xlsx" : "pdf"}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Gagal mengekspor data.");
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Memuat data neraca...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertTriangle size={48} className="text-red-500 mx-auto mb-3" />
          <p className="text-red-700 font-medium">{error}</p>
          <button
            onClick={() => fetchData(dari, sampai)}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Coba Lagi
          </button>
        </div>
      </DashboardLayout>
    );
  }

  if (!data) return null;

  const {
    labelBerjalan,
    labelSebelumnya,
    dataAktiva,
    dataPasiva,
    totalAset,
    totalAsetAwal,
    totalKewajiban,
    totalKewajibanModal,
    totalKewajibanModalAwal,
    totalEkuitas,
    isBalance,
  } = data;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Neraca</h2>
              <p className="text-sm text-gray-500">Per {labelBerjalan}</p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <SummaryCard title="Total Aktiva" label="Total Aktiva" value={totalAset} icon={Building2} color="blue" />
          <SummaryCard label="Total Kewajiban" value={totalKewajiban} icon={ArrowDownCircle} color="red" />
          <SummaryCard label="Total Ekuitas" value={totalEkuitas} icon={PiggyBank} color="green" />
          <SummaryCard
            label="Status Neraca"
            value={isBalance ? "Balance" : "Tidak Balance"}
            icon={isBalance ? CheckCircle2 : AlertTriangle}
            color={isBalance ? "teal" : "amber"}
            status
          />
        </div>

        {/* Filter & Export */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
          >
            <span className="flex items-center gap-2 font-medium text-gray-700">
              <Sliders size={18} className="text-gray-500" />
              Filter & Export Data
            </span>
            {filterOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {filterOpen && (
            <div className="border-t p-4 bg-gray-50">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-white rounded-lg p-4 border space-y-3">
                  <p className="text-xs font-semibold uppercase text-gray-500 flex items-center gap-2">
                    <Sliders size={14} /> Filter Periode
                  </p>
                  <form onSubmit={handleFilter} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Dari Tanggal</label>
                        <input
                          type="date"
                          value={dari}
                          onChange={(e) => setDari(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Sampai Tanggal</label>
                        <input
                          type="date"
                          value={sampai}
                          onChange={(e) => setSampai(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                        <Sliders size={15} /> Terapkan Filter
                      </button>
                      <button type="button" onClick={resetFilter} className="flex items-center gap-1.5 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
                        <ChevronDown size={15} /> Reset
                      </button>
                    </div>
                  </form>
                </div>
                <div className="bg-white rounded-lg p-4 border space-y-2">
                  <p className="text-xs font-semibold uppercase text-gray-500 flex items-center gap-2">
                    <Download size={14} /> Export Data
                  </p>
                  <button
                    onClick={() => handleExport("excel")}
                    disabled={exporting}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-60"
                  >
                    <FileSpreadsheet size={15} /> {exporting ? "Mengekspor..." : "Excel"}
                  </button>
                  <button
                    onClick={() => handleExport("pdf")}
                    disabled={exporting}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-60"
                  >
                    <FileText size={15} /> {exporting ? "Mengekspor..." : "PDF"}
                  </button>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <AlertTriangle size={12} /> Export menggunakan filter aktif
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tabel Neraca */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Desktop View */}
          <div className="hidden lg:block">
            <NeracaTable
              dataAktiva={dataAktiva}
              dataPasiva={dataPasiva}
              labelBerjalan={labelBerjalan}
              labelSebelumnya={labelSebelumnya}
              totalAset={totalAset}
              totalAsetAwal={totalAsetAwal}
              totalKewajibanModal={totalKewajibanModal}
              totalKewajibanModalAwal={totalKewajibanModalAwal}
            />
          </div>
          {/* Mobile View */}
          <div className="lg:hidden">
            <NeracaMobile
              dataAktiva={dataAktiva}
              dataPasiva={dataPasiva}
              labelBerjalan={labelBerjalan}
              labelSebelumnya={labelSebelumnya}
              totalAset={totalAset}
              totalAsetAwal={totalAsetAwal}
              totalKewajibanModal={totalKewajibanModal}
              totalKewajibanModalAwal={totalKewajibanModalAwal}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}