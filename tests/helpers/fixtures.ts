import {
  ageOptions,
  gradYearOptions,
  levelOfStudyOptions,
  skillLevelOptions,
  hackathonExperienceOptions,
  type ProfileFormValues,
  type RegistrationFlagsValues,
} from "@/lib/validation";

/** A profile that passes profileSchema */
export function validProfile(overrides: Partial<ProfileFormValues> = {}): ProfileFormValues {
  return {
    first_name: "Ada",
    last_name: "Lovelace",
    email: "ada@example.com",
    phone_number: "3525551234",
    age: ageOptions[1],
    school: "University of Florida",
    major: "computer-science",
    grad_year: gradYearOptions[2],
    level_of_study: levelOfStudyOptions[0],
    engineering_skill: skillLevelOptions[2],
    hackathon_experience: hackathonExperienceOptions[1],
    country: "United States",
    linkedin_url: "https://www.linkedin.com/in/ada",
    tshirt: "M",
    dietary: ["none"],
    accessibility: "",
    gender: "",
    race: [],
    ...overrides,
  };
}

/** Every consent checked */
export function allConsents(overrides: Partial<RegistrationFlagsValues> = {}): RegistrationFlagsValues {
  return {
    accuracy_agreement: true,
    terms_and_conditions: true,
    code_of_conduct: true,
    can_photograph: true,
    share_resume_with_companies: true,
    mlh_code_of_conduct: true,
    mlh_data_sharing: true,
    mlh_communications: true,
    ...overrides,
  };
}

/** Only the consents submit_application requires */
export const REQUIRED_CONSENTS = [
  "accuracy_agreement",
  "terms_and_conditions",
  "code_of_conduct",
  "mlh_code_of_conduct",
  "mlh_data_sharing",
] as const;

/** Bytes that pass the "%PDF-" signature check */
export function pdfBytes(extra = "1.4\n%%EOF\n"): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(`%PDF-${extra}`);
}

export function pdfFile(name = "resume.pdf", type = "application/pdf"): File {
  return new File([pdfBytes()], name, { type });
}
