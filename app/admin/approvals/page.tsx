import { Suspense } from "react";
import ApprovalsClient from "./ApprovalsClient";

export default function ApprovalsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/60 to-rose-50/60" />
      }
    >
      <ApprovalsClient />
    </Suspense>
  );
}

