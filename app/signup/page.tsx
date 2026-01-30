import { Suspense } from "react";
import SignupClient from "./SignupClient";

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/60 to-rose-50/60" />
      }
    >
      <SignupClient />
    </Suspense>
  );
}

