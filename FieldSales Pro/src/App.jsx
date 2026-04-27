import React, { useEffect, useState } from "react";
import Routes from "./Routes";
import { fetchSessionContext } from "./utils/bootApi";
import { getRuntimeConfig } from "./utils/nativeRuntime";

function App() {
  const [bootStatus, setBootStatus] = useState({
    state: "idle",
    message: "Εκκίνηση του FieldSales Pro",
  });

  useEffect(() => {
    let isActive = true;

    const runBootCheck = async () => {
      const runtime = getRuntimeConfig();
      if (!runtime.bffBaseUrl || !runtime.idToken) {
        if (isActive) {
          setBootStatus({
            state: "waiting",
            message: "Αναμονή για σύνδεση με την native συνεδρία",
          });
        }
        return;
      }

      try {
        if (isActive) {
          setBootStatus({ state: "loading", message: "Επαλήθευση συνεδρίας" });
        }

        const session = await fetchSessionContext();
        window.__FIELD_SALES_SESSION = session;
        console.log("[FieldSales Pro] Session context", session);

        if (isActive) {
          const fullName = String(session.fullName || session.displayName || "").trim();
          setBootStatus({
            state: "success",
            message: fullName || "Πιστοποιημένος χρήστης",
          });
        }
      } catch (error) {
        console.error("[FieldSales Pro] Boot auth check failed", error);
        if (isActive) {
          setBootStatus({
            state: "error",
            message: error.message || "Αποτυχία επαλήθευσης συνεδρίας",
          });
        }
      }
    };

    const handleRuntimeUpdated = () => {
      runBootCheck();
    };

    runBootCheck();
    window.addEventListener("mysales-runtime-updated", handleRuntimeUpdated);

    return () => {
      isActive = false;
      window.removeEventListener("mysales-runtime-updated", handleRuntimeUpdated);
    };
  }, []);

  const bootStatusClassName = {
    idle: "border-slate-300 bg-white/90 text-slate-700",
    waiting: "border-amber-300 bg-amber-50/95 text-amber-900",
    loading: "border-sky-300 bg-sky-50/95 text-sky-900",
    success: "border-emerald-300 bg-emerald-50/95 text-emerald-900",
    error: "border-rose-300 bg-rose-50/95 text-rose-900",
  }[bootStatus.state] || "border-slate-300 bg-white/90 text-slate-700";

  return (
    <>
      <Routes />
      <div className={`fixed bottom-3 right-3 z-[1000] rounded-full border px-3 py-2 text-xs font-medium shadow-lg backdrop-blur ${bootStatusClassName}`}>
        {bootStatus.message}
      </div>
    </>
  );
}

export default App;
