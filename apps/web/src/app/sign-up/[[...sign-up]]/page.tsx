import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

import { afterAuthPath, isClerkEnabled, signInPath, signUpPath } from "@/lib/auth-config";

export const metadata = {
  title: "Create Account",
  description: "Create your RentalRadar account.",
};

export default function SignUpPage() {
  if (!isClerkEnabled) {
    return <AuthSetupNotice mode="sign-up" />;
  }

  return (
    <AuthShell eyebrow="Create Account" title="Create an account with Google or email">
      <SignUp
        path={signUpPath}
        routing="path"
        signInUrl={signInPath}
        fallbackRedirectUrl={afterAuthPath}
        appearance={clerkAppearance}
      />
    </AuthShell>
  );
}

function AuthSetupNotice({ mode }: { mode: "sign-up" }) {
  return (
    <AuthShell eyebrow="Auth Setup" title="Clerk keys are needed before account creation is live">
      <div className="max-w-md rounded-2xl border border-cyan-200/15 bg-white/[0.06] p-6 text-sm leading-6 text-slate-300">
        Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in Railway, enable Google in Clerk Social Connections,
        then redeploy. The {mode} page will render Google and email account creation automatically.
        <Link href={afterAuthPath} className="mt-5 inline-flex text-cyan-200 hover:text-cyan-100">
          Open dashboard while auth is being configured
        </Link>
      </div>
    </AuthShell>
  );
}

function AuthShell({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#050816] px-4 py-12 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(45,212,191,0.12),transparent_24%)]" />
      <div className="relative grid w-full max-w-5xl gap-8 lg:grid-cols-[0.9fr_1fr] lg:items-center">
        <div>
          <Link href="/" className="text-sm font-semibold text-cyan-200 hover:text-cyan-100">
            RentalRadar.ai
          </Link>
          <p className="mt-10 text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">{eyebrow}</p>
          <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-normal text-white sm:text-6xl">{title}</h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-slate-300">
            Continue with Google for the fastest setup, or use email. Clerk handles secure account access before opening the
            RentalRadar dashboard.
          </p>
        </div>
        <div className="flex justify-center lg:justify-end">{children}</div>
      </div>
    </main>
  );
}

const clerkAppearance = {
  elements: {
    rootBox: "w-full max-w-md",
    cardBox: "w-full shadow-2xl",
    card: "bg-slate-950/90 border border-white/10 text-white",
    headerTitle: "text-white",
    headerSubtitle: "text-slate-400",
    socialButtonsBlockButton: "border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]",
    formFieldLabel: "text-slate-300",
    formFieldInput: "bg-white/[0.04] border-white/10 text-white",
    footerActionText: "text-slate-400",
    footerActionLink: "text-cyan-200 hover:text-cyan-100",
    formButtonPrimary: "bg-cyan-300 text-slate-950 hover:bg-cyan-200",
  },
};
