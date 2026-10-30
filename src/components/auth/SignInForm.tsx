"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignInForm({ next = "/portal" }: { next?: string }) {
  const supabase = createSupabaseBrowserClient();
  const [loading, setLoading] = useState<"discord" | "email" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  async function signInWithProvider(provider: "discord") {
    setErr(null);
    setLoading(provider);
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (e: unknown) {
      if (e instanceof Error) setErr(e.message);
      else setErr("Failed to sign in");
      setLoading(null);
    }
  }

  async function signInWithEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setLoading("email");
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      setEmailSent(true);
    } catch (e: unknown) {
      if (e instanceof Error) setErr(e.message);
      else setErr("Failed to send magic link");
    } finally {
      setLoading(null);
    }
  }

  if (emailSent) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 p-5">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="font-[family-name:var(--font-body)]">
              <p className="text-sm font-medium text-green-900 mb-1">Magic link sent!</p>
              <p className="text-sm text-green-700">
                Check your inbox for a magic link. Make sure to open it in the same browser.
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setEmailSent(false);
            setShowEmailForm(false);
            setEmail("");
          }}
          className="font-[family-name:var(--font-body)] text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          ← Back to sign in options
        </button>
      </div>
    );
  }

  if (showEmailForm) {
    return (
      <div className="space-y-4">
        <form onSubmit={signInWithEmail} className="space-y-4">
          <label className="block">
            <span className="font-[family-name:var(--font-body)] text-sm font-medium text-gray-700 mb-2 block">
              Email Address
            </span>
            <input
              className="font-[family-name:var(--font-body)] w-full rounded-xl border border-gray-300 px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#ff9b5e] focus:border-transparent hover:border-gray-400"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <button
            type="submit"
            disabled={loading === "email"}
            className="font-[family-name:var(--font-body)] w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white bg-gradient-to-r from-[#560700] to-[#6b1003] hover:from-[#6b1003] hover:to-[#560700] transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === "email" ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending...
              </>
            ) : (
              <>
                Send Magic Link
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setShowEmailForm(false)}
          className="font-[family-name:var(--font-body)] text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          ← Back to sign in options
        </button>
        {err && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-[family-name:var(--font-body)] text-sm text-red-700">{err}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => signInWithProvider("discord")}
        disabled={loading !== null}
        className="font-[family-name:var(--font-body)] w-full inline-flex items-center justify-center gap-3 rounded-xl px-6 py-3.5 text-sm font-semibold text-white bg-[#5865F2] hover:bg-[#4752C4] transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading === "discord" ? (
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
        )}
        Continue with Discord
      </button>

      <div className="flex items-center gap-4 my-4">
        <div className="flex-1 border-t border-gray-300"></div>
        <span className="text-gray-500 text-sm font-[family-name:var(--font-body)]">or</span>
        <div className="flex-1 border-t border-gray-300"></div>
      </div>

      <button
        type="button"
        onClick={() => setShowEmailForm(true)}
        disabled={loading !== null}
        className="font-[family-name:var(--font-body)] w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        Continue with Email
      </button>
      <p className="font-[family-name:var(--font-body)] text-xs text-gray-500 text-center">
        No Discord? Email works too. If you&apos;re accepted, you&apos;ll connect Discord when you RSVP.
      </p>

      {err && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 mt-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-[family-name:var(--font-body)] text-sm text-red-700">{err}</p>
          </div>
        </div>
      )}
    </div>
  );
}
