import { Suspense } from "react";
import PendingClient from "./pendingClient";

export default function PendingPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/60 to-rose-50/60" />
      }
    >
      <PendingClient />
    </Suspense>
  );
}

