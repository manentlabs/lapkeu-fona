import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePengaturan } from "../context/PengaturanContext";
import { dashboardPathForRole } from "../utils/roles";
import { User, Lock, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { pengaturan } = usePengaturan();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const primaryColor = pengaturan?.warna_layout || "#2563eb";
  const namaKoperasi = pengaturan?.nama_koperasi || "Koperasi Mitra Husada Sejahtera";
  const namaWebsite = pengaturan?.nama_website || "Sistem Akuntansi";
  const logoUrl = pengaturan?.logo_koperasi_url || "/assets/logo-koperasi.png";
  const bgImage = pengaturan?.background_website_url;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Username dan kata sandi wajib diisi.");
      return;
    }

    setSubmitting(true);
    try {
      const user = await login(username.trim(), password);
      navigate(location.state?.from?.pathname || dashboardPathForRole(user.role), { replace: true });
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 422) setError("Username atau kata sandi salah.");
      else if (status === 403) setError("Akun Anda belum aktif.");
      else setError("Tidak dapat terhubung ke server.");
    } finally {
      setSubmitting(false);
    }
  };

  const bgStyle = bgImage
    ? { backgroundImage: `url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { backgroundColor: "#1e293b" };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-10" style={bgStyle}>
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/90">
         {namaWebsite}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="relative z-10 w-full max-w-sm space-y-5 rounded-3xl border border-white/40 bg-white/15 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl"
        style={{ borderColor: primaryColor + "66" }}
      >
        <div className="flex flex-col items-center text-center">
          <img
            src={logoUrl}
            alt={namaKoperasi}
            onError={(e) => { e.target.src = "/assets/logo-koperasi.png"; }}
            className="mb-4 h-14 w-14 rounded-2xl bg-white/80 object-contain p-1.5"
          />
          <h2 className="text-2xl font-semibold text-white drop-shadow-sm">Masuk ke akun Anda</h2>
          <p className="mt-1 text-sm text-white/80">{namaKoperasi}</p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-white/90">Username</label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-white/70 bg-white/70 py-2.5 pl-10 pr-3.5 text-sm text-gray-900 outline-none backdrop-blur-sm transition focus:border-2 focus:bg-white"
              style={{ '--tw-ring-color': primaryColor }}
              onFocus={(e) => e.target.style.borderColor = primaryColor}
              onBlur={(e) => e.target.style.borderColor = ""}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-white/90">Kata sandi</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-gray-500" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/70 bg-white/70 py-2.5 pl-10 pr-11 text-sm text-gray-900 outline-none backdrop-blur-sm transition focus:border-2 focus:bg-white"
              style={{ '--tw-ring-color': primaryColor }}
              onFocus={(e) => e.target.style.borderColor = primaryColor}
              onBlur={(e) => e.target.style.borderColor = ""}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center px-3.5 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50/90 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60"
          style={{ backgroundColor: primaryColor }}
        >
          {submitting ? "Memproses…" : "Masuk"}
        </button>

        <div className="flex items-center justify-between text-xs text-white/70">
          <span>Lupa kata sandi?</span>
          <span>Hubungi admin koperasi</span>
        </div>
      </form>

      <p className="relative z-10 mt-6 text-center text-xs text-white/60">
        &copy; {new Date().getFullYear()} {namaKoperasi}. Seluruh hak cipta dilindungi.
      </p>
    </div>
  );
}