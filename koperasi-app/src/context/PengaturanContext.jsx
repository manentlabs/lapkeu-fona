// src/context/PengaturanContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/axios";

const PengaturanContext = createContext();

export function PengaturanProvider({ children }) {
  const [pengaturan, setPengaturan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await api.get("/pengaturan");
        setPengaturan(data.data);
      } catch (err) {
        console.error("Gagal ambil pengaturan:", err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return (
    <PengaturanContext.Provider value={{ pengaturan, loading }}>
      {children}
    </PengaturanContext.Provider>
  );
}

export function usePengaturan() {
  return useContext(PengaturanContext);
}