// src/components/DashboardLayout.jsx

import { useState, useEffect, useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePengaturan } from "../context/PengaturanContext";
import { ROLES } from "../utils/roles";
import api from "../api/axios";
import * as Icons from "lucide-react";

// ============================================================
// HELPER
// ============================================================

function hexToRgb(hex) {
  if (!hex || typeof hex !== "string") {
    return "37, 99, 235";
  }

  let value = hex.trim();

  if (!value.startsWith("#")) {
    return "37, 99, 235";
  }

  value = value.replace("#", "");

  if (value.length === 3) {
    value = value
      .split("")
      .map((char) => char + char)
      .join("");
  }

  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    return "37, 99, 235";
  }

  const rgb = parseInt(value, 16);

  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = rgb & 0xff;

  return `${r}, ${g}, ${b}`;
}

function darkenHex(hex, amount = 0.35) {
  if (!hex || typeof hex !== "string") {
    return "#1d4ed8";
  }

  let value = hex.trim().replace("#", "");

  if (value.length === 3) {
    value = value
      .split("")
      .map((char) => char + char)
      .join("");
  }

  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    return "#1d4ed8";
  }

  const num = parseInt(value, 16);

  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;

  const newR = Math.max(0, Math.round(r * (1 - amount)));
  const newG = Math.max(0, Math.round(g * (1 - amount)));
  const newB = Math.max(0, Math.round(b * (1 - amount)));

  return `#${[newR, newG, newB]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

// ============================================================
// SLUGIFY
// ============================================================

function slugify(text) {
  if (!text) return "";

  return String(text)
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ============================================================
// GET ICON
// ============================================================

function getIconByName(iconName) {
  if (!iconName) {
    return Icons.Dot;
  }

  const IconComponent = Icons[iconName];

  return IconComponent || Icons.Dot;
}

// ============================================================
// NORMALIZE PERSENTASE SHU
// ============================================================

function normalizePersentaseSHU(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const id = item.id ?? item.persentase_shu_id ?? item.persentaseSHUId ?? null;
      const keterangan =
        item.keterangan ??
        item.nama ??
        item.nama_dana ??
        item.nama_shu ??
        item.label ??
        (id !== null ? `Dana SHU ${id}` : "Dana SHU");

      const slug = item.slug || slugify(keterangan);

      return {
        id,
        label: String(keterangan),
        path: `/dashboard/bendahara/dana-shu/${encodeURIComponent(slug)}`,
        icon: item.icon || "WalletCards",
        meta: {
          id,
          keterangan: String(keterangan),
          slug,
          persentase: item.persentase ?? item.nilai ?? item.persen ?? 0,
        },
      };
    });
}

// ============================================================
// NAV ITEM
// ============================================================

function NavItem({
  item,
  depth = 0,
  primaryColor,
  activeColor,
  primaryRgb,
  onNavigate,
  units = [],
  jenisPendapatan = [],
  persentaseSHU = [],
}) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  let childrenToRender = Array.isArray(item.children) ? item.children : [];
  const itemLabel = String(item.label || "").trim().toLowerCase();

  // Dynamic Unit Usaha
  if (itemLabel === "perhitungan hasil usaha") {
    const staticChildren = Array.isArray(item.children) ? item.children : [];
    const dynamicChildren = units.map((unit, index) => ({
      label: unit,
      path: `/dashboard/bendahara/laporan/phu/${encodeURIComponent(unit)}`,
      icon: "FilePieChart",
      key: `unit-${index}-${unit}`,
    }));
    childrenToRender = [...staticChildren, ...dynamicChildren];
  }

  // Dynamic Jenis Pendapatan (Kontribusi)
  if (itemLabel === "kontribusi") {
    childrenToRender = Array.isArray(jenisPendapatan)
      ? jenisPendapatan.filter((jenis) => jenis).map((jenis) => {
          const id = jenis.id ?? jenis.jenis_pendapatan_id;
          const nama = jenis.nama ?? jenis.nama_pendapatan ?? jenis.keterangan ?? `Pendapatan ${id}`;
          return {
            label: String(nama),
            path: `/dashboard/bendahara/kontribusi?jenis_pendapatan_id=${encodeURIComponent(id)}`,
            icon: "HandCoins",
          };
        })
      : [];
  }

  // Dynamic Dana SHU
  if (itemLabel === "dana shu") {
    childrenToRender = normalizePersentaseSHU(persentaseSHU);
  }

  const hasChildren = childrenToRender.length > 0;
  const isActive = item.path ? location.pathname === item.path : false;

  const isChildActive = (children) => {
    if (!children || children.length === 0) return false;
    return children.some((child) => {
      if (child.path) {
        const childPath = child.path.split("?")[0];
        if (location.pathname === childPath) return true;
      }
      if (child.children) return isChildActive(child.children);
      return false;
    });
  };

  const hasActiveChild = hasChildren && isChildActive(childrenToRender);

  const Icon = getIconByName(item.icon);

  useEffect(() => {
    if (hasActiveChild) {
      setIsOpen(true);
    }
  }, [hasActiveChild]);

  if (!hasChildren) {
    return (
      <NavLink
        to={item.path || "#"}
        end
        onClick={onNavigate}
        className={({ isActive: active }) => `
          group
          relative
          flex
          items-center
          gap-3
          rounded-lg
          px-3
          py-2.5
          text-sm
          font-medium
          transition-all
          duration-200
          ${active ? "shadow-sm" : "text-gray-600 hover:bg-gray-100"}
        `}
        style={({ isActive: active }) => ({
          color: active ? activeColor : undefined,
          backgroundColor: active ? `rgba(${primaryRgb}, 0.10)` : undefined,
          paddingLeft: `${1 + depth * 1.5}rem`,
        })}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="flex-1">{item.label}</span>
        {isActive && (
          <span
            className="absolute right-2 h-2 w-2 rounded-full"
            style={{ backgroundColor: activeColor }}
          />
        )}
      </NavLink>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`
          group
          flex
          w-full
          items-center
          gap-3
          rounded-lg
          px-3
          py-2.5
          text-sm
          font-medium
          transition-all
          duration-200
          ${hasActiveChild || isActive ? "" : "text-gray-600 hover:bg-gray-100"}
        `}
        style={{
          color: hasActiveChild || isActive ? activeColor : undefined,
          backgroundColor: hasActiveChild || isActive ? `rgba(${primaryRgb}, 0.10)` : undefined,
          paddingLeft: `${1 + depth * 1.5}rem`,
        }}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        {isOpen ? (
          <Icons.ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <Icons.ChevronRight className="h-4 w-4 shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="ml-2 border-l border-gray-200 pl-2">
          {childrenToRender.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">Tidak ada data.</div>
          ) : (
            childrenToRender.map((child, index) => (
              <NavItem
                key={child.path || child.key || `${child.label}-${index}`}
                item={child}
                depth={depth + 1}
                primaryColor={primaryColor}
                activeColor={activeColor}
                primaryRgb={primaryRgb}
                onNavigate={onNavigate}
                units={units}
                jenisPendapatan={jenisPendapatan}
                persentaseSHU={persentaseSHU}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// DASHBOARD LAYOUT
// ============================================================

export default function DashboardLayout({ children }) {
  const { user, logout } = useAuth();
  const { pengaturan } = usePengaturan();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [units, setUnits] = useState([]);
  const [jenisPendapatan, setJenisPendapatan] = useState([]);
  const [persentaseSHU, setPersentaseSHU] = useState([]);

  // ==========================================================
  // Cek apakah user adalah bendahara atau admin
  // ==========================================================
  const isBendahara = useMemo(() => {
    return user?.role === "bendahara" || user?.role === "admin";
  }, [user?.role]);

  // ==========================================================
  // FETCH UNIT USAHA (hanya untuk bendahara/admin)
  // ==========================================================
  useEffect(() => {
    if (!isBendahara) return;

    const fetchUnits = async () => {
      try {
        const res = await api.get("/bendahara/units");
        const data = Array.isArray(res.data?.units)
          ? res.data.units
          : Array.isArray(res.data?.data)
          ? res.data.data
          : [];
        setUnits(data);
      } catch (err) {
        console.error("Gagal mengambil unit usaha:", err);
        setUnits([]);
      }
    };
    fetchUnits();
  }, [isBendahara]);

  // ==========================================================
  // FETCH JENIS PENDAPATAN (hanya untuk bendahara/admin)
  // ==========================================================
  useEffect(() => {
    if (!isBendahara) return;

    const fetchJenisPendapatan = async () => {
      try {
        const res = await api.get("/bendahara/jenis-pendapatan");
        const data = Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data?.jenisPendapatan)
          ? res.data.jenisPendapatan
          : Array.isArray(res.data)
          ? res.data
          : [];
        setJenisPendapatan(data);
      } catch (err) {
        console.error("Gagal mengambil jenis pendapatan:", err);
        setJenisPendapatan([]);
      }
    };
    fetchJenisPendapatan();
  }, [isBendahara]);

  // ==========================================================
  // FETCH MASTER DANA SHU (hanya untuk bendahara/admin)
  // ==========================================================
  useEffect(() => {
    if (!isBendahara) return;

    const fetchPersentaseSHU = async () => {
      try {
        const res = await api.get("/bendahara/dana-shu");
        console.log("Response Master Dana SHU:", res.data);

        let data = [];
        if (Array.isArray(res.data?.menu)) data = res.data.menu;
        else if (Array.isArray(res.data?.data)) data = res.data.data;
        else if (Array.isArray(res.data?.persentaseSHU)) data = res.data.persentaseSHU;
        else if (Array.isArray(res.data)) data = res.data;

        const normalized = data
          .filter((item) => item && typeof item === "object")
          .map((item) => {
            const id = item.id ?? item.persentase_shu_id ?? null;
            const keterangan =
              item.keterangan ??
              item.nama ??
              item.nama_dana ??
              item.nama_shu ??
              item.label ??
              `Dana SHU ${id}`;
            const slug = item.slug || slugify(keterangan);
            return {
              id,
              keterangan: String(keterangan),
              slug,
              persentase: item.persentase ?? item.nilai ?? item.persen ?? 0,
              icon: item.icon || "WalletCards",
            };
          });

        console.log("Master Dana SHU untuk submenu:", normalized);
        setPersentaseSHU(normalized);
      } catch (err) {
        console.error("Gagal mengambil master Dana SHU:", err);
        setPersentaseSHU([]);
      }
    };
    fetchPersentaseSHU();
  }, [isBendahara]);

  // ==========================================================
  // PENGATURAN KOPERASI
  // ==========================================================
  const namaKoperasi = pengaturan?.nama_koperasi || "Koperasi MHS";
  const logoUrl = pengaturan?.logo_koperasi_url || "/assets/logo-koperasi.png";
  const primaryColor = pengaturan?.warna_layout || "#2563eb";
  const primaryRgb = hexToRgb(primaryColor);
  const activeColor = darkenHex(primaryColor, 0.35);

  const initials = (user?.name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  const menuItems = ROLES[user?.role]?.menu || [];

  // ==========================================================
  // RENDER
  // ==========================================================
  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* HEADER */}
      <header className="sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white/90 px-4 py-2.5 shadow-sm backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 md:hidden"
            aria-label="Buka menu"
          >
            <Icons.Menu className="h-5 w-5" />
          </button>

          <img
            src={logoUrl}
            alt={namaKoperasi}
            className="h-8 w-8 rounded-lg object-contain"
            onError={(e) => {
              e.currentTarget.src = "/assets/logo-koperasi.png";
            }}
          />

          <span className="text-sm font-semibold text-gray-800">{namaKoperasi}</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Notifikasi"
          >
            <Icons.Bell className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white shadow-md"
              style={{ backgroundColor: primaryColor }}
            >
              {initials}
            </div>
            <span className="hidden text-sm font-medium text-gray-700 sm:block">
              {user?.name}
            </span>
          </div>
        </div>
      </header>

      {/* BODY */}
      <div className="flex flex-1 overflow-hidden">
        {/* MOBILE OVERLAY */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
          />
        )}

        {/* SIDEBAR */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-50 flex h-full w-72 transform flex-col bg-white shadow-xl transition-transform duration-300 ease-out
            md:static md:z-0 md:translate-x-0
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          <nav className="flex-1 overflow-y-auto px-4 py-6">
            <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Menu Utama
            </p>

            {menuItems.map((item, index) => (
              <NavItem
                key={item.path || `${item.label}-${index}`}
                item={item}
                depth={0}
                primaryColor={primaryColor}
                activeColor={activeColor}
                primaryRgb={primaryRgb}
                onNavigate={() => setSidebarOpen(false)}
                units={units}
                jenisPendapatan={jenisPendapatan}
                persentaseSHU={persentaseSHU}
              />
            ))}
          </nav>

          {/* FOOTER */}
          <div className="flex-shrink-0 border-t border-gray-200 px-4 py-4">
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
            >
              <Icons.LogOut className="h-4 w-4" />
              <span>Keluar</span>
            </button>

            <p className="mt-2 text-center text-xs text-gray-400">
              &copy; {new Date().getFullYear()} {namaKoperasi}
            </p>
          </div>
        </aside>

        {/* CONTENT */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}