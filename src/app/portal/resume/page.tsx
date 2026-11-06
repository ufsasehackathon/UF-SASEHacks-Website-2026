import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignedResumeUrl, uploadResume } from "./actions";
import ResumeUploader from "@/components/resume/ResumeUploader";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ResumePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: reg } = await supabase
    .from("registrations")
    .select("editing_locked, resume_url, resume_updated_at")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();
  // The application form handles the first resume upload
  if (!reg) redirect("/portal");

  const locked = reg?.editing_locked ?? false;
  const hasResume = !!reg?.resume_url;
  const signed = await getSignedResumeUrl();

  return (
    <div className="min-h-screen bg-[#FFE4B3] relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-20 right-10 w-64 h-64 bg-[#ebb8ce] opacity-30 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 left-10 w-80 h-80 bg-[#ebb8ce] opacity-20 rounded-full blur-3xl"></div>

      <div className="relative z-10 mx-auto max-w-screen-md px-4 py-10">
        {/* Header with back button */}
        <div className="mb-8">
          <Link href="/portal" className="inline-flex items-center gap-2 text-[#560700] hover:underline font-[family-name:var(--font-body)] mb-4">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="font-[family-name:var(--font-heading)] text-5xl md:text-6xl text-[#560700] mb-4">
            Resume
          </h1>
          <p className="font-[family-name:var(--font-body)] text-lg text-[#560700]/70">
            {hasResume ? "Manage your resume" : "Upload your resume to complete registration"}
          </p>
        </div>

        {!hasResume && (
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-blue-100 to-indigo-100 border-2 border-blue-400 p-5 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 text-2xl">📄</div>
              <div className="font-[family-name:var(--font-body)]">
                <p className="font-semibold text-blue-900">Resume Required</p>
                <p className="text-sm text-blue-800 mt-1">
                  Resume upload is required to complete your registration. Please upload your resume below.
                </p>
              </div>
            </div>
          </div>
        )}

        {locked && (
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-yellow-100 to-orange-100 border-2 border-yellow-400 p-5 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 text-2xl">🔒</div>
              <div className="font-[family-name:var(--font-body)]">
                <p className="font-semibold text-yellow-900">Editing is locked</p>
                <p className="text-sm text-yellow-800 mt-1">
                  Editing is locked by admins. You can still download your last uploaded resume.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Current Resume Card */}
        <div className="relative mb-6">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#560700] to-[#ff9b5e] opacity-20 blur-xl"></div>
          <div className="relative backdrop-blur-xl bg-white/90 rounded-3xl shadow-2xl border border-[#FFE4B3]/30 p-8">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl text-[#560700] mb-4">
              Current Resume
            </h2>

            <div className="space-y-4">
              {hasResume ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#560700] to-[#ff9b5e] flex items-center justify-center text-white shadow-lg">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-[family-name:var(--font-body)] font-semibold text-[#560700]">resume.pdf</p>
                      {reg?.resume_updated_at && (
                        <p className="font-[family-name:var(--font-body)] text-xs text-gray-600">
                          Last updated: {new Date(reg.resume_updated_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {signed.url && (
                    <a
                      className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-[#560700] to-[#6b1003] hover:from-[#6b1003] hover:to-[#560700] transition-all shadow-lg hover:shadow-xl font-[family-name:var(--font-body)]"
                      href={signed.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Preview / Download
                    </a>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-3 text-gray-500">
                  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="font-[family-name:var(--font-body)]">No resume uploaded yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="relative">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#ff9b5e] to-[#560700] opacity-20 blur-xl"></div>
          <div className="relative backdrop-blur-xl bg-white/90 rounded-3xl shadow-2xl border border-[#FFE4B3]/30 p-8">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl text-[#560700] mb-4">
              {hasResume ? "Replace Resume" : "Upload Resume"}
            </h2>
            <ResumeUploader action={uploadResume} disabled={locked} />
            <p className="mt-4 font-[family-name:var(--font-body)] text-xs text-gray-500">
              PDFs only, max 10 MB. Your file is stored privately at <code className="bg-gray-100 px-1 py-0.5 rounded">resumes/{user?.id}/resume.pdf</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
