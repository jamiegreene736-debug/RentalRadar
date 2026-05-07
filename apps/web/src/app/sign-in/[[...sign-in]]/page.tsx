import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

import { afterAuthPath, isClerkEnabled, signInPath, signUpPath } from "@/lib/auth-config";

export const metadata = {
  title: "Sign In",
  description: "Sign in to RentalRadar.",
};

export default function SignInPage() {
  if (!isClerkEnabled) {
    return <AuthSetupNotice />;
  }

  return (
    <AuthShell eyebrow="Welcome Back" title="Sign in with Google or email">
      <SignIn
        path={signInPath}
        routing="path"
        signUpUrl={signUpPath}
        fallbackRedirectUrl={afterAuthPath}
        appearance={clerkAppearance}
      />
    </AuthShell>
  );
}

function AuthSetupNotice() {
  return (
    <AuthShell eyebrow="Auth Setup" title="Clerk keys are needed before sign-in is live">
      <div className="max-w-md rounded-2xl border border-cyan-200/15 bg-white/[0.06] p-6 text-sm leading-6 text-slate-300">
        Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in Railway, enable Google in Clerk Social Connections,
        then redeploy. The sign-in page will render Google and email login automatically.
        <Link href={afterAuthPath} className="mt-5 inline-flex text-cyan-200 hover:text-cyan-100">
          Open dashboard while auth is being configured
        </Link>
      </div>
    </AuthShell>
  );
}

function AuthShell({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <main className="radar-light grid min-h-screen place-items-center px-4 py-12">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(34,211,238,0.24),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(45,212,191,0.18),transparent_24%)]" />
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
    card: "bg-white/90 border border-cyan-900/10 text-slate-950 shadow-[0_32px_90px_rgba(14,116,144,0.16)]",
    headerTitle: "text-slate-950",
    headerSubtitle: "text-slate-500",
    socialButtonsBlockButton: "border-slate-200 bg-white text-slate-950 hover:bg-cyan-50",
    formFieldLabel: "text-slate-700",
    formFieldInput: "bg-white border-slate-200 text-slate-950",
    footerActionText: "text-slate-500",
    footerActionLink: "text-cyan-700 hover:text-cyan-600",
    formButtonPrimary: "bg-cyan-300 text-slate-950 hover:bg-cyan-200",
  },
};
