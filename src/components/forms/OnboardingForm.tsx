"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  profileSchema,
  type ProfileFormValues,
  tshirtOptions,
  dietaryOptions,
  gradYearOptions,
  levelOfStudyOptions,
  levelOfStudyLabels,
  hackathonExperienceOptions,
  genderOptions,
  genderLabels,
  raceOptions,
  raceLabels,
  ageOptions,
  majorOptions,
  majorLabels,
  APPLICATION_QUESTIONS,
} from "@/lib/validation";
import { searchSchools } from "@/lib/mlh-schools";
import { searchCountries } from "@/lib/countries";
import { useRouter } from "next/navigation";

type Props = {
  initialProfile: ProfileFormValues;
  initialConsents: {
    accuracy_agreement: boolean;
    terms_and_conditions: boolean;
    code_of_conduct: boolean;
    can_photograph: boolean;
    share_resume_with_companies: boolean;
    mlh_code_of_conduct: boolean;
    mlh_data_sharing: boolean;
    mlh_communications: boolean;
  };
  profileAction: (state: unknown, formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  consentAction: (state: unknown, formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  resumeAction: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  responsesAction: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  submitAction: () => Promise<{ ok: boolean; error?: string }>;
  initialResponses: Record<string, string>;
  /** a resume is already on file, so picking a new one is optional */
  hasResume: boolean;
  disabled?: boolean;
};

export default function OnboardingForm({
  initialProfile,
  initialConsents,
  profileAction,
  consentAction,
  resumeAction,
  responsesAction,
  submitAction,
  initialResponses,
  hasResume,
  disabled
}: Props) {
  const router = useRouter();
  const [serverMsg, setServerMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accuracyAgreement, setAccuracyAgreement] = useState(initialConsents.accuracy_agreement);
  const [termsAndConditions, setTermsAndConditions] = useState(initialConsents.terms_and_conditions);
  const [codeOfConduct, setCodeOfConduct] = useState(initialConsents.code_of_conduct);
  const [canPhotograph, setCanPhotograph] = useState(initialConsents.can_photograph);
  const [shareResumeWithCompanies, setShareResumeWithCompanies] = useState(initialConsents.share_resume_with_companies);
  const [mlhCodeOfConduct, setMlhCodeOfConduct] = useState(initialConsents.mlh_code_of_conduct);
  const [mlhDataSharing, setMlhDataSharing] = useState(initialConsents.mlh_data_sharing);
  const [mlhCommunications, setMlhCommunications] = useState(initialConsents.mlh_communications);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>(() =>
    Object.fromEntries(APPLICATION_QUESTIONS.map(q => [q.id, initialResponses[q.id] ?? ""]))
  );

  // School autocomplete state
  const [schoolQuery, setSchoolQuery] = useState(initialProfile.school);
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);
  const schoolResults = useMemo(() => searchSchools(schoolQuery, 8), [schoolQuery]);

  // Country autocomplete state
  const [countryQuery, setCountryQuery] = useState(initialProfile.country);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const countryResults = useMemo(() => searchCountries(countryQuery, 10), [countryQuery]);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: initialProfile,
    mode: "onBlur",
  });

  const submit = async (data: ProfileFormValues) => {
    setServerMsg(null);
    setIsSubmitting(true);

    // Validate required consents
    if (!accuracyAgreement || !termsAndConditions || !codeOfConduct || !mlhCodeOfConduct || !mlhDataSharing) {
      setServerMsg("You must accept all required agreements to continue.");
      setIsSubmitting(false);
      return;
    }

    // Validate resume (required, but one already on file counts)
    if (!resumeFile && !hasResume) {
      setServerMsg("You must upload a resume to continue.");
      setIsSubmitting(false);
      return;
    }

    try {
      // Save profile
      const profileFd = new FormData();
      Object.entries(data).forEach(([k, v]) => {
        if (Array.isArray(v)) {
          v.forEach(item => profileFd.append(k, item));
        } else {
          profileFd.append(k, String(v ?? ""));
        }
      });

      const profileResult = await profileAction(undefined, profileFd);
      if (!profileResult.ok) {
        setServerMsg(profileResult.error ?? "Failed to save profile");
        setIsSubmitting(false);
        return;
      }

      // Save consents
      const consentFd = new FormData();
      if (accuracyAgreement) consentFd.append("accuracy_agreement", "on");
      if (termsAndConditions) consentFd.append("terms_and_conditions", "on");
      if (codeOfConduct) consentFd.append("code_of_conduct", "on");
      if (canPhotograph) consentFd.append("can_photograph", "on");
      if (shareResumeWithCompanies) consentFd.append("share_resume_with_companies", "on");
      if (mlhCodeOfConduct) consentFd.append("mlh_code_of_conduct", "on");
      if (mlhDataSharing) consentFd.append("mlh_data_sharing", "on");
      if (mlhCommunications) consentFd.append("mlh_communications", "on");

      const consentResult = await consentAction(undefined, consentFd);
      if (!consentResult.ok) {
        setServerMsg(consentResult.error ?? "Failed to save consents");
        setIsSubmitting(false);
        return;
      }

      // Upload resume
      if (resumeFile) {
        const resumeFd = new FormData();
        resumeFd.append("resume", resumeFile);

        const resumeResult = await resumeAction(resumeFd);
        if (!resumeResult.ok) {
          setServerMsg(resumeResult.error ?? "Failed to upload resume");
          setIsSubmitting(false);
          return;
        }
      }

      // Save free-response answers
      const responsesFd = new FormData();
      Object.entries(responses).forEach(([k, v]) => responsesFd.append(k, v));
      const responsesResult = await responsesAction(responsesFd);
      if (!responsesResult.ok) {
        setServerMsg(responsesResult.error ?? "Failed to save your answers");
        setIsSubmitting(false);
        return;
      }

      // Submit: draft -> pending
      const submitResult = await submitAction();
      if (!submitResult.ok) {
        setServerMsg(submitResult.error ?? "Failed to submit application");
        setIsSubmitting(false);
        return;
      }

      // Success! Redirect to portal
      router.push("/portal");
      router.refresh();
    } catch {
      setServerMsg("An error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-6">
      {/* Personal Information */}
      <div className="relative">
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#560700] to-[#ff9b5e] opacity-10 blur-xl"></div>
        <div className="relative bg-white rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-6 md:p-8 space-y-4">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl text-[#560700]">Personal Information</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="font-[family-name:var(--font-body)] text-sm font-semibold text-gray-700">First Name *</span>
            <input
              className="mt-2 w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#ff9b5e] focus:border-transparent hover:border-gray-400 font-[family-name:var(--font-body)]"
              disabled={disabled}
              {...form.register("first_name")}
            />
            {form.formState.errors.first_name && (
              <p className="text-xs text-red-600 mt-1">{form.formState.errors.first_name.message}</p>
            )}
          </label>

          <label className="block">
            <span className="font-[family-name:var(--font-body)] text-sm font-semibold text-gray-700">Last Name *</span>
            <input
              className="mt-2 w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#ff9b5e] focus:border-transparent hover:border-gray-400 font-[family-name:var(--font-body)]"
              disabled={disabled}
              {...form.register("last_name")}
            />
            {form.formState.errors.last_name && (
              <p className="text-xs text-red-600 mt-1">{form.formState.errors.last_name.message}</p>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-medium">Email *</span>
            <input
              type="email"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              disabled={disabled}
              {...form.register("email")}
            />
            <p className="text-xs text-gray-500 mt-1">We&apos;ll send your application decision here.</p>
            {form.formState.errors.email && (
              <p className="text-xs text-red-600 mt-1">{form.formState.errors.email.message}</p>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-medium">Phone Number *</span>
            <input
              type="tel"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              disabled={disabled}
              placeholder="(555) 123-4567"
              {...form.register("phone_number")}
            />
            {form.formState.errors.phone_number && (
              <p className="text-xs text-red-600 mt-1">{form.formState.errors.phone_number.message}</p>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-medium">Age *</span>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              disabled={disabled}
              {...form.register("age")}
            >
              <option value="">Select your age</option>
              {ageOptions.map(a => (
                <option key={a} value={a}>{a === "17" ? "Under 18" : a}</option>
              ))}
            </select>
            {form.formState.errors.age && (
              <p className="text-xs text-red-600 mt-1">{form.formState.errors.age.message}</p>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-medium">LinkedIn URL *</span>
            <input
              type="url"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              disabled={disabled}
              placeholder="https://linkedin.com/in/yourprofile"
              {...form.register("linkedin_url")}
            />
            {form.formState.errors.linkedin_url && (
              <p className="text-xs text-red-600 mt-1">{form.formState.errors.linkedin_url.message}</p>
            )}
          </label>
        </div>
        </div>
      </div>

      {/* Education */}
      <div className="relative">
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#BFDCFF] to-[#D0FFCB] opacity-20 blur-xl"></div>
        <div className="relative bg-white rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-6 md:p-8 space-y-4">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl text-[#560700]">Education</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* School with autocomplete */}
          <div className="block relative">
            <span className="text-sm font-medium">School *</span>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              disabled={disabled}
              placeholder="Start typing your school name..."
              value={schoolQuery}
              onChange={(e) => {
                setSchoolQuery(e.target.value);
                form.setValue("school", e.target.value);
                setShowSchoolDropdown(true);
              }}
              onFocus={() => setShowSchoolDropdown(true)}
              onBlur={() => setTimeout(() => setShowSchoolDropdown(false), 200)}
            />
            {showSchoolDropdown && schoolResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                {schoolResults.map(school => (
                  <button
                    key={school.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                    onMouseDown={() => {
                      setSchoolQuery(school.name);
                      form.setValue("school", school.name);
                      setShowSchoolDropdown(false);
                    }}
                  >
                    {school.name}
                  </button>
                ))}
              </div>
            )}
            {showSchoolDropdown && schoolQuery.length >= 2 && schoolResults.length === 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg p-3 text-sm text-gray-500">
                No matching schools found. You can enter a custom school name.
              </div>
            )}
            {form.formState.errors.school && (
              <p className="text-xs text-red-600 mt-1">{form.formState.errors.school.message}</p>
            )}
          </div>

          <label className="block">
            <span className="text-sm font-medium">Major / Field (optional)</span>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              disabled={disabled}
              {...form.register("major")}
            >
              <option value="">Select your major</option>
              {majorOptions.map(m => (
                <option key={m} value={m}>{majorLabels[m]}</option>
              ))}
            </select>
            {form.formState.errors.major && (
              <p className="text-xs text-red-600 mt-1">{form.formState.errors.major.message}</p>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-medium">Graduation Year *</span>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              disabled={disabled}
              {...form.register("grad_year")}
            >
              {gradYearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium">Level of Study *</span>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              disabled={disabled}
              {...form.register("level_of_study")}
            >
              {levelOfStudyOptions.map(l => (
                <option key={l} value={l}>{levelOfStudyLabels[l]}</option>
              ))}
            </select>
          </label>
        </div>
        </div>
      </div>

      {/* Experience */}
      <div className="relative">
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#FFC7E5] to-[#E6D4FF] opacity-20 blur-xl"></div>
        <div className="relative bg-white rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-6 md:p-8 space-y-4">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl text-[#560700]">Experience</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Engineering Skill Level *</span>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              disabled={disabled}
              {...form.register("engineering_skill")}
            >
              <option value="1">1 - Beginning</option>
              <option value="2">2 - Learning</option>
              <option value="3">3 - Somewhat Experienced</option>
              <option value="4">4 - Experienced</option>
              <option value="5">5 - Very Experienced</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium">Hackathon Experience *</span>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              disabled={disabled}
              {...form.register("hackathon_experience")}
            >
              <option value="">Number of hackathons attended</option>
              {hackathonExperienceOptions.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </label>
        </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="relative">
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#560700] to-[#ff9b5e] opacity-10 blur-xl"></div>
        <div className="relative bg-white rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-6 md:p-8 space-y-4">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl text-[#560700]">Contact Information</h2>

        <div className="grid gap-4">
          <div className="block relative">
            <span className="text-sm font-medium">Country of Residence *</span>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              disabled={disabled}
              placeholder="Start typing your country..."
              value={countryQuery}
              onChange={(e) => {
                setCountryQuery(e.target.value);
                form.setValue("country", e.target.value);
                setShowCountryDropdown(true);
              }}
              onFocus={() => setShowCountryDropdown(true)}
              onBlur={() => setTimeout(() => setShowCountryDropdown(false), 200)}
            />
            {showCountryDropdown && countryResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                {countryResults.map(country => (
                  <button
                    key={country.code}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                    onMouseDown={() => {
                      setCountryQuery(country.name);
                      form.setValue("country", country.name);
                      setShowCountryDropdown(false);
                    }}
                  >
                    {country.name}
                  </button>
                ))}
              </div>
            )}
            {form.formState.errors.country && (
              <p className="text-xs text-red-600 mt-1">{form.formState.errors.country.message}</p>
            )}
          </div>
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Shipping Address (Optional)</h3>
          <p className="text-xs text-gray-500 mb-4">
            Only needed if we need to ship prizes, swag, or other materials to you.
          </p>

        <div className="grid gap-4">
          <label className="block">
            <span className="text-sm font-medium">Address Line 1</span>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              disabled={disabled}
              placeholder="Street address"
              {...form.register("address_line1")}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Address Line 2</span>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              disabled={disabled}
              placeholder="Apt, suite, etc"
              {...form.register("address_line2")}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium">City</span>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                disabled={disabled}
                {...form.register("city")}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">State</span>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                disabled={disabled}
                {...form.register("state")}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Zip Code</span>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                disabled={disabled}
                {...form.register("zip_code")}
              />
            </label>
          </div>
        </div>
        </div>
        </div>
      </div>

      {/* Event Preferences */}
      <div className="relative">
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#BFDCFF] to-[#D0FFCB] opacity-20 blur-xl"></div>
        <div className="relative bg-white rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-6 md:p-8 space-y-4">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl text-[#560700]">Event Preferences</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">T-shirt size (optional)</span>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              disabled={disabled}
              {...form.register("tshirt")}
            >
              <option value="">Select size</option>
              {tshirtOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium">Dietary restrictions</span>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
            {dietaryOptions.map(opt => (
              <label key={opt} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  value={opt}
                  disabled={disabled}
                  defaultChecked={initialProfile.dietary.includes(opt)}
                  {...form.register("dietary")}
                />
                <span className="capitalize">{opt.replace("-", " ")}</span>
              </label>
            ))}
          </div>
        </label>

        <label className="block">
          <span className="text-sm font-medium">Accessibility needs (optional)</span>
          <textarea
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            rows={3}
            disabled={disabled}
            placeholder="Let us know if you need any accommodations"
            {...form.register("accessibility")}
          />
        </label>
        </div>
      </div>

      {/* Resume Upload */}
      <div className="relative">
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#FFC7E5] to-[#E6D4FF] opacity-20 blur-xl"></div>
        <div className="relative bg-white rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-6 md:p-8 space-y-4">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl text-[#560700]">Resume Upload</h2>

        <div>
          <label className="block">
            <span className="text-sm font-medium">
              {hasResume ? "Replace your resume (optional, PDF only)" : "Upload your resume (PDF only) *"}
            </span>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
              disabled={disabled}
              className="mt-2 block w-full text-sm text-gray-600
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border file:border-gray-300
                file:text-sm file:font-medium
                file:bg-white file:text-gray-700
                hover:file:bg-gray-50
                file:cursor-pointer cursor-pointer"
            />
          </label>
          {resumeFile && (
            <p className="mt-2 text-xs text-green-600">
              Selected: {resumeFile.name} ({(resumeFile.size / 1024).toFixed(1)} KB)
            </p>
          )}
          {hasResume && !resumeFile && (
            <p className="mt-2 text-xs text-green-600">You already have a resume on file.</p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            Maximum file size: 10 MB
          </p>
        </div>
        </div>
      </div>

      {/* Free-response questions (configured in APPLICATION_QUESTIONS) */}
      {APPLICATION_QUESTIONS.length > 0 && (
        <div className="relative">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#560700] to-[#ff9b5e] opacity-10 blur-xl"></div>
          <div className="relative bg-white rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-6 md:p-8 space-y-4">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl text-[#560700]">A Little About You</h2>

            {APPLICATION_QUESTIONS.map(q => (
              <label key={q.id} className="block">
                <span className="text-sm font-medium">
                  {q.label} {q.required ? "*" : "(optional)"}
                </span>
                <textarea
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  rows={4}
                  maxLength={q.maxLength}
                  disabled={disabled}
                  placeholder={q.placeholder}
                  value={responses[q.id] ?? ""}
                  onChange={(e) => setResponses(prev => ({ ...prev, [q.id]: e.target.value }))}
                />
                <p className="text-xs text-gray-500 mt-1 text-right">
                  {(responses[q.id] ?? "").length}/{q.maxLength}
                </p>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Demographics */}
      <div className="relative">
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#560700] to-[#ff9b5e] opacity-10 blur-xl"></div>
        <div className="relative bg-white rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-6 md:p-8 space-y-4">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl text-[#560700]">Demographics</h2>

        <label className="block">
          <span className="text-sm font-medium">Gender (optional)</span>
          <select
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            disabled={disabled}
            {...form.register("gender")}
          >
            <option value="">Select gender</option>
            {genderOptions.map(g => (
              <option key={g} value={g}>{genderLabels[g]}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium">Race / Ethnicity (optional, select all that apply)</span>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
            {raceOptions.map(opt => (
              <label key={opt} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  value={opt}
                  disabled={disabled}
                  defaultChecked={initialProfile.race?.includes(opt)}
                  {...form.register("race")}
                />
                <span>{raceLabels[opt]}</span>
              </label>
            ))}
          </div>
        </label>
        </div>
      </div>

      {/* MLH Agreements */}
      <div className="relative">
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#1d3a8a] to-[#4d7df9] opacity-10 blur-xl"></div>
        <div className="relative bg-white rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-6 md:p-8 space-y-4">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl text-[#560700]">MLH Agreements</h2>
          <p className="text-sm text-gray-600">
            We participate in Major League Hacking (MLH) as an MLH Member Event. The following agreements are required by MLH.
          </p>

        <div className="space-y-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={mlhCodeOfConduct}
              onChange={(e) => setMlhCodeOfConduct(e.target.checked)}
              disabled={disabled}
              className="mt-1"
            />
            <span className="text-sm">
              <span className="font-medium">MLH Code of Conduct *</span>
              <span className="block text-gray-600 mt-1">
                I have read and agree to the{" "}
                <a
                  href="https://github.com/MLH/mlh-policies/blob/main/code-of-conduct.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  MLH Code of Conduct
                </a>.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={mlhDataSharing}
              onChange={(e) => setMlhDataSharing(e.target.checked)}
              disabled={disabled}
              className="mt-1"
            />
            <span className="text-sm">
              <span className="font-medium">MLH Data Sharing *</span>
              <span className="block text-gray-600 mt-1">
                I authorize you to share my application/registration information with Major League Hacking for event administration, ranking, and MLH administration in-line with the{" "}
                <a
                  href="https://github.com/MLH/mlh-policies/blob/main/privacy-policy.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  MLH Privacy Policy
                </a>. I further agree to the terms of both the{" "}
                <a
                  href="https://github.com/MLH/mlh-policies/blob/main/contest-terms.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  MLH Contest Terms and Conditions
                </a>{" "}
                and the{" "}
                <a
                  href="https://github.com/MLH/mlh-policies/blob/main/privacy-policy.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  MLH Privacy Policy
                </a>.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={mlhCommunications}
              onChange={(e) => setMlhCommunications(e.target.checked)}
              disabled={disabled}
              className="mt-1"
            />
            <span className="text-sm">
              <span className="font-medium">MLH Communications (optional)</span>
              <span className="block text-gray-600 mt-1">
                I authorize MLH to send me occasional emails about relevant events, career opportunities, and community announcements.
              </span>
            </span>
          </label>
        </div>
        </div>
      </div>

      {/* Final Steps */}
      <div className="relative">
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#BFDCFF] to-[#D0FFCB] opacity-20 blur-xl"></div>
        <div className="relative bg-white rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-6 md:p-8 space-y-4">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl text-[#560700]">Final Steps</h2>

        <div className="space-y-3">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={accuracyAgreement}
              onChange={(e) => setAccuracyAgreement(e.target.checked)}
              disabled={disabled}
              className="mt-1"
            />
            <span className="text-sm">
              <span className="font-medium">Accuracy Agreement *</span>
              <span className="block text-gray-600 mt-1">
                I have filled out this application to the best of my knowledge and that I have not provided false, inaccurate, or misleading information.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={termsAndConditions}
              onChange={(e) => setTermsAndConditions(e.target.checked)}
              disabled={disabled}
              className="mt-1"
            />
            <span className="text-sm">
              <span className="font-medium">Terms and Conditions *</span>
              <span className="block text-gray-600 mt-1">
                I have read and agreed to the UF SASE Hacks Privacy Policy and the UF SASE Hacks Terms and Conditions.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={codeOfConduct}
              onChange={(e) => setCodeOfConduct(e.target.checked)}
              disabled={disabled}
              className="mt-1"
            />
            <span className="text-sm">
              <span className="font-medium">Code of Conduct *</span>
              <span className="block text-gray-600 mt-1">
                I have read and agreed to the UF SASE Hacks Code of Conduct.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={canPhotograph}
              onChange={(e) => setCanPhotograph(e.target.checked)}
              disabled={disabled}
              className="mt-1"
            />
            <span className="text-sm">
              <span className="font-medium">Photography Consent (optional)</span>
              <span className="block text-gray-600 mt-1">
                I consent to being photographed or recorded during the event for promotional purposes.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={shareResumeWithCompanies}
              onChange={(e) => setShareResumeWithCompanies(e.target.checked)}
              disabled={disabled}
              className="mt-1"
            />
            <span className="text-sm">
              <span className="font-medium">Share Resumes with Companies (optional)</span>
              <span className="block text-gray-600 mt-1">
                I consent to having my resume shared with participating companies for recruitment purposes.
              </span>
            </span>
          </label>
        </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={disabled || isSubmitting}
          className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-medium border bg-black text-white border-black hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? "Submitting..." : "Submit Application"}
        </button>
        {serverMsg && <span className="text-sm text-red-600">{serverMsg}</span>}
      </div>
    </form>
  );
}
