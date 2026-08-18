// src/pages/anggota/AnggotaCetakKartuPage.jsx
import { useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../api/axios';
import { Printer, Download, Loader, CreditCard } from 'lucide-react';

export default function AnggotaCetakKartuPage() {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  // ─── Cetak / Download PDF ──────────────────────────────
  const handleCetak = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/anggota-koperasi/cetak-kartu', {
        responseType: 'blob', // penting untuk PDF
      });

      // Buat URL dari blob
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'kartu-anggota.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      // Tampilkan preview (bisa menggunakan iframe)
      setPreview(url);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mencetak kartu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* ─── HEADER ──────────────────────────────────────────── */}
        <div className="bg-white p-5 rounded-xl shadow-sm border">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <CreditCard className="text-blue-600" />
            Cetak Kartu Anggota
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Download atau cetak kartu anggota Anda dalam format PDF.
          </p>
        </div>

        {/* ─── TOMBOL CETAK ────────────────────────────────────── */}
        <div className="bg-white p-6 rounded-xl shadow-sm border text-center">
          <button
            onClick={handleCetak}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? <Loader className="animate-spin" size={20} /> : <Printer size={20} />}
            {loading ? 'Memproses...' : 'Cetak Kartu Anggota'}
          </button>
          <p className="text-xs text-gray-400 mt-3">
            Kartu akan diunduh sebagai PDF. Anda dapat mencetaknya langsung dari browser.
          </p>
        </div>

        {/* ─── ERROR ───────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">
            {error}
          </div>
        )}

        {/* ─── PREVIEW ──────────────────────────────────────────── */}
        {preview && (
          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Preview Kartu</h3>
            <iframe
              src={preview}
              className="w-full h-[400px] border rounded-lg"
              title="Preview Kartu Anggota"
            />
            <div className="flex justify-end mt-3">
              <a
                href={preview}
                download="kartu-anggota.pdf"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
              >
                <Download size={16} />
                Unduh ulang
              </a>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}