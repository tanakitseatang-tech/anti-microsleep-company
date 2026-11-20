"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CloseButton({ id }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        const note = window.prompt("บันทึกการปิดเคส (เช่น โทรหาคนขับแล้ว ให้พักที่ปั๊มถัดไป)", "");
        if (note === null) return;
        setBusy(true);
        await fetch(`/api/alerts/${id}/close`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note }),
        });
        setBusy(false);
        router.refresh();
      }}
    >
      ปิดเคส
    </button>
  );
}
