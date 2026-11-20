"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-fetch the server data every few seconds (keeps the page and map current).
export default function AutoRefresh({ seconds = 30 }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
