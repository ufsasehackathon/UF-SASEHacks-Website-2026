"use client";

import { useState, useMemo } from "react";
import { useForm, type DefaultValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  profileSchema,
  type ProfileFormValues,
  type ProfileFormDefaults,
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
} from "@/lib/validation";
import { searchSchools } from "@/lib/mlh-schools";
import { searchCountries } from "@/lib/countries";

type Props = {
  initialValues: ProfileFormDefaults;
  initialConsents?: {
    accuracy_agreement: boolean;
    terms_and_conditions: boolean;
    code_of_conduct: boolean;
    can_photograph: boolean;
    share_resume_with_companies: boolean;
    mlh_code_of_conduct: boolean;
    mlh_data_sharing: boolean;
    mlh_communications: boolean;
  };
  action: (state: unknown, formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  disabled?: boolean;
};

export default function ProfileForm({ initialValues, initialConsents, action, disabled }: Props) {
  const [serverMsg, setServerMsg] = useState<string | null>(null);

  // School autocomplete state
  const [schoolQuery, setSchoolQuery] = useState(initialValues.school);
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);
  const schoolResults = useMemo(() => searchSchools(schoolQuery, 8), [schoolQuery]);

  // Country autocomplete state
  const [countryQuery, setCountryQuery] = useState(initialValues.country);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const countryResults = useMemo(() => searchCountries(countryQuery, 10), [countryQuery]);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: initialValues as DefaultValues<ProfileFormValues>,
    mode: "onBlur",
  });

  const submit = async (data: ProfileFormValues) => {
    setServerMsg(null);
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        v.forEach(item => fd.append(k, item));
      } else {
        fd.append(k, String(v ?? ""));
      }
    });

    // Add consent checkboxes to FormData (they're not part of the react-hook-form)
    if (initialConsents) {
      const accuracyCheckbox = document.querySelector('input[name="accuracy_agreement"]') as HTMLInputElement;
      const termsCheckbox = document.querySelector('input[name="terms_and_conditions"]') as HTMLInputElement;
      const codeCheckbox = document.querySelector('input[name="code_of_conduct"]') as HTMLInputElement;
      const photoCheckbox = document.querySelector('input[name="can_photograph"]') as HTMLInputElement;
      const resumeCheckbox = document.querySelector('input[name="share_resume_with_companies"]') as HTMLInputElement;
      const mlhCodeCheckbox = document.querySelector('input[name="mlh_code_of_conduct"]') as HTMLInputElement;
      const mlhDataCheckbox = document.querySelector('input[name="mlh_data_sharing"]') as HTMLInputElement;
      const mlhCommsCheckbox = document.querySelector('input[name="mlh_communications"]') as HTMLInputElement;

      if (accuracyCheckbox?.checked) fd.append("accuracy_agreement", "on");
      if (termsCheckbox?.checked) fd.append("terms_and_conditions", "on");
      if (codeCheckbox?.checked) fd.append("code_of_conduct", "on");
      if (photoCheckbox?.checked) fd.append("can_photograph", "on");
      if (resumeCheckbox?.checked) fd.append("share_resume_with_companies", "on");
      if (mlhCodeCheckbox?.checked) fd.append("mlh_code_of_conduct", "on");
      if (mlhDataCheckbox?.checked) fd.append("mlh_data_sharing", "on");
      if (mlhCommsCheckbox?.checked) fd.append("mlh_communications", "on");
    }

    const result = await action(undefined, fd);
    if (result.ok) setServerMsg("Saved!");
    else setServerMsg(result.error ?? "Save failed");
  };

  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-6">
      {/* Personal Information */}
      <div className="relative">
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#560700] to-[#ff9b5e] opacity-10 blur-xl"></div>
        <div className="relative bg-white rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-6 md:p-8">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl text-[#560700] mb-4">Personal Information</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">First Name *</span>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              disabled={disabled}
              {...form.register("first_name")}
            />
            {form.formState.errors.first_name && (
              <p className="text-xs text-red-600 mt-1">{form.formState.errors.first_name.message}</p>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-medium">Last Name *</span>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
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
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-gray-100"
              readOnly
              {...form.register("email")}
            />
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
        <div className="relative bg-white rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-6 md:p-8">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl text-[#560700] mb-4">Education</h2>
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
            <span className="text-sm font-medium">Expected Graduation Year *</span>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              disabled={disabled}
              {...form.register("grad_year")}
            >
              <option value="">Select your graduation year</option>
              {gradYearOptions.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            {form.formState.errors.grad_year && (
              <p className="text-xs text-red-600 mt-1">{form.formState.errors.grad_year.message}</p>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-medium">Level of Study *</span>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              disabled={disabled}
              {...form.register("level_of_study")}
            >
              <option value="">Select your level of study</option>
              {levelOfStudyOptions.map(l => (
                <option key={l} value={l}>{levelOfStudyLabels[l]}</option>
              ))}
            </select>
            {form.formState.errors.level_of_study && (
              <p className="text-xs text-red-600 mt-1">{form.formState.errors.level_of_study.message}</p>
            )}
          </label>
        </div>
        </div>
      </div>

      {/* Experience */}
      <div className="relative">
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#FFC7E5] to-[#E6D4FF] opacity-20 blur-xl"></div>
        <div className="relative bg-white rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-6 md:p-8">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl text-[#560700] mb-4">Experience</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Engineering Skill Level *</span>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              disabled={disabled}
              {...form.register("engineering_skill")}
            >
              <option value="">Select your skill level</option>
              <option value="1">1 - Beginning</option>
              <option value="2">2 - Learning</option>
              <option value="3">3 - Somewhat Experienced</option>
              <option value="4">4 - Experienced</option>
              <option value="5">5 - Very Experienced</option>
            </select>
            {form.formState.errors.engineering_skill && (
              <p className="text-xs text-red-600 mt-1">{form.formState.errors.engineering_skill.message}</p>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-medium">Number of Hackathons Attended *</span>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              disabled={disabled}
              {...form.register("hackathon_experience")}
            >
              <option value="">Number of hackathons attended</option>
              {hackathonExperienceOptions.map(num => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
            {form.formState.errors.hackathon_experience && (
              <p className="text-xs text-red-600 mt-1">{form.formState.errors.hackathon_experience.message}</p>
            )}
          </label>
        </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="relative">
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#560700] to-[#ff9b5e] opacity-10 blur-xl"></div>
        <div className="relative bg-white rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-6 md:p-8">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl text-[#560700] mb-4">Contact Information</h2>

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

        </div>
      </div>

      {/* Event Preferences */}
      <div className="relative">
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#BFDCFF] to-[#D0FFCB] opacity-20 blur-xl"></div>
        <div className="relative bg-white rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-6 md:p-8">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl text-[#560700] mb-4">Event Preferences</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">T-shirt Size (optional)</span>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              disabled={disabled}
              {...form.register("tshirt")}
            >
              <option value="">Select size</option>
              {tshirtOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {form.formState.errors.tshirt && (
              <p className="text-xs text-red-600 mt-1">{form.formState.errors.tshirt.message}</p>
            )}
          </label>
        </div>

        <label className="block mt-4">
          <span className="text-sm font-medium">Dietary Restrictions (select all that apply)</span>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
            {dietaryOptions.map(opt => (
              <label key={opt} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  value={opt}
                  disabled={disabled}
                  defaultChecked={initialValues.dietary.includes(opt)}
                  {...form.register("dietary")}
                />
                <span className="capitalize">{opt.replace("-", " ")}</span>
              </label>
            ))}
          </div>
          {form.formState.errors.dietary && (
            <p className="text-xs text-red-600 mt-1">{form.formState.errors.dietary.message as string}</p>
          )}
        </label>

        <label className="block mt-4">
          <span className="text-sm font-medium">Accessibility Needs</span>
          <textarea
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            rows={3}
            disabled={disabled}
            {...form.register("accessibility")}
          />
        </label>
        </div>
      </div>

      {/* Demographics */}
      <div className="relative">
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#FFC7E5] to-[#E6D4FF] opacity-20 blur-xl"></div>
        <div className="relative bg-white rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-6 md:p-8">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl text-[#560700] mb-4">Demographics</h2>
        <div className="grid gap-4 sm:grid-cols-2">
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
            {form.formState.errors.gender && (
              <p className="text-xs text-red-600 mt-1">{form.formState.errors.gender.message}</p>
            )}
          </label>
        </div>

        <label className="block mt-4">
          <span className="text-sm font-medium">Race / Ethnicity (optional, select all that apply)</span>
          <div className="mt-2 grid gap-2">
            {raceOptions.map(opt => (
              <label key={opt} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  value={opt}
                  disabled={disabled}
                  defaultChecked={initialValues.race?.includes(opt)}
                  {...form.register("race")}
                />
                <span>{raceLabels[opt]}</span>
              </label>
            ))}
          </div>
          {form.formState.errors.race && (
            <p className="text-xs text-red-600 mt-1">{form.formState.errors.race.message as string}</p>
          )}
        </label>
        </div>
      </div>

      {/* Consents - only show if initialConsents is provided */}
      {initialConsents && (
        <>
          {/* MLH Agreements */}
          <div className="relative">
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#1d3a8a] to-[#4d7df9] opacity-10 blur-xl"></div>
            <div className="relative bg-white rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-6 md:p-8">
              <h2 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl text-[#560700] mb-4">MLH Agreements</h2>
              <p className="text-sm text-gray-600 mb-4">
                We participate in Major League Hacking (MLH) as an MLH Member Event. The following agreements are required by MLH.
              </p>
            <div className="space-y-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="mlh_code_of_conduct"
                  defaultChecked={initialConsents.mlh_code_of_conduct}
                  disabled={disabled}
                  className="mt-0.5"
                />
                <span>
                  I have read and agree to the{" "}
                  <a
                    href="https://github.com/MLH/mlh-policies/blob/main/code-of-conduct.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    MLH Code of Conduct
                  </a>. *
                </span>
              </label>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="mlh_data_sharing"
                  defaultChecked={initialConsents.mlh_data_sharing}
                  disabled={disabled}
                  className="mt-0.5"
                />
                <span>
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
                  </a>. *
                </span>
              </label>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="mlh_communications"
                  defaultChecked={initialConsents.mlh_communications}
                  disabled={disabled}
                  className="mt-0.5"
                />
                <span>
                  I authorize MLH to send me occasional emails about relevant events, career opportunities, and community announcements. (optional)
                </span>
              </label>
            </div>
          </div>
          </div>

          {/* Other Consents */}
          <div className="relative">
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#560700] to-[#ff9b5e] opacity-10 blur-xl"></div>
            <div className="relative bg-white rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-6 md:p-8">
              <h2 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl text-[#560700] mb-4">Consents</h2>
            <div className="space-y-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="accuracy_agreement"
                  defaultChecked={initialConsents.accuracy_agreement}
                  disabled={disabled}
                  className="mt-0.5"
                />
                <span>
                  I have filled out this application to the best of my knowledge and that I have not provided false, inaccurate, or misleading information. *
                </span>
              </label>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="terms_and_conditions"
                  defaultChecked={initialConsents.terms_and_conditions}
                  disabled={disabled}
                  className="mt-0.5"
                />
                <span>
                  I have read and agreed to the UF SASE Hacks Privacy Policy and the UF SASE Hacks Terms and Conditions *
                </span>
              </label>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="code_of_conduct"
                  defaultChecked={initialConsents.code_of_conduct}
                  disabled={disabled}
                  className="mt-0.5"
                />
                <span>
                  I have read and agreed to the UF SASE Hacks Code of Conduct *
                </span>
              </label>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="can_photograph"
                  defaultChecked={initialConsents.can_photograph}
                  disabled={disabled}
                  className="mt-0.5"
                />
                <span>
                  I consent to photography at the event (optional)
                </span>
              </label>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="share_resume_with_companies"
                  defaultChecked={initialConsents.share_resume_with_companies}
                  disabled={disabled}
                  className="mt-0.5"
                />
                <span>
                  I consent to having my resume shared with participating companies for recruitment purposes (optional)
                </span>
              </label>
            </div>
          </div>
          </div>
        </>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={disabled || form.formState.isSubmitting}
          className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium border bg-black text-white border-black hover:opacity-90 disabled:opacity-50"
        >
          {form.formState.isSubmitting ? "Saving..." : "Save profile"}
        </button>
        {serverMsg && <span className="text-sm text-gray-700">{serverMsg}</span>}
      </div>
    </form>
  );
}
