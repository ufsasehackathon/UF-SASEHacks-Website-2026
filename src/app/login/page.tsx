import SignInForm from "@/components/auth/SignInForm";
import { HACK_NAME } from "@/lib/constants";
import { getPublicImageUrl } from "@/lib/images";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = sp?.next ?? "/portal";

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#560700] via-[#6b1003] to-[#4a0600]">
      {/* Shark mascot on left side */}
      <div className="absolute bottom-0 left-0 w-1/2 h-2/3 z-0 lg:w-2/3 lg:h-3/4">
        <div className="relative w-full h-full">
          <Image
            src={getPublicImageUrl("shark-mascot2.png")}
            alt="Shark mascot"
            fill
            className="object-contain object-left-bottom opacity-30 blur-sm"
            priority
          />
        </div>
      </div>

      {/* Gradient overlay to fade shark into background */}
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-[#560700]/40 to-[#560700]/80"></div>

      {/* Content */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 pt-24 lg:pt-8">
        <div className="w-full max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            {/* Left side - Big text */}
            <div className="text-center lg:text-left space-y-6">
              <h1 className="font-[family-name:var(--font-heading)] text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-[#FFE4B3] leading-tight tracking-tight">
                Welcome to<br />
                <span className="text-[#ff9b5e]">{HACK_NAME}</span>
              </h1>
              <p className="font-[family-name:var(--font-body)] text-lg sm:text-xl md:text-2xl text-[#FFE4B3]/80 max-w-lg mx-auto lg:mx-0">
                Sign in to register for the hackathon, manage your profile, and join the community.
              </p>
              <div className="flex items-center gap-3 justify-center lg:justify-start text-[#FFE4B3]/60 font-[family-name:var(--font-body)]">
                <div className="h-px w-12 bg-[#FFE4B3]/30"></div>
                <span className="text-sm">Secure magic link authentication</span>
              </div>
            </div>

            {/* Right side - Login bubble */}
            <div className="flex justify-center lg:justify-end">
              <div className="w-full max-w-md">
                <div className="relative">
                  {/* Glow effect */}
                  <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#ff9b5e] to-[#FFE4B3] opacity-20 blur-2xl"></div>

                  {/* Card */}
                  <div className="relative backdrop-blur-xl bg-white/95 rounded-3xl shadow-2xl border border-[#FFE4B3]/20 p-8 sm:p-10">
                    <div className="space-y-6">
                      <div>
                        <h2 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl text-[#560700] mb-2">
                          Sign In
                        </h2>
                        <p className="font-[family-name:var(--font-body)] text-sm text-gray-600">
                          Enter your email to receive a magic link
                        </p>
                      </div>

                      <SignInForm next={next} />

                      <div className="pt-4 border-t border-gray-200">
                        <p className="font-[family-name:var(--font-body)] text-xs text-gray-500 text-center">
                          No password required. We&apos;ll send you a secure link to sign in.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute top-10 left-10 w-20 h-20 rounded-full bg-[#ff9b5e]/10 blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-32 h-32 rounded-full bg-[#FFE4B3]/10 blur-3xl"></div>
    </div>
  );
}