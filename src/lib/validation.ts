import { z } from "zod";

export const tshirtOptions = ["XS","S","M","L","XL","2XL","3XL"] as const;

export const dietaryOptions = [
  "vegan",
  "vegetarian",
  "halal",
  "kosher",
  "nut-free",
  "gluten-free",
  "dairy-free",
  "celiac",
  "allergies",
  "none"
] as const;

export const gradYearOptions = ["2025","2026","2027","2028","2029","2030"] as const;

export const levelOfStudyOptions = [
  "less-than-secondary",
  "secondary",
  "undergraduate-2-year",
  "undergraduate-3-plus-year",
  "graduate",
  "code-school-bootcamp",
  "other-vocational-or-trade-program",
  "post-doctorate",
  "other",
  "not-currently-a-student",
  "prefer-not-to-answer"
] as const;

export const levelOfStudyLabels: Record<typeof levelOfStudyOptions[number], string> = {
  "less-than-secondary": "Less than Secondary / High School",
  "secondary": "Secondary / High School",
  "undergraduate-2-year": "Undergraduate University (2 year - community college or similar)",
  "undergraduate-3-plus-year": "Undergraduate University (3+ year)",
  "graduate": "Graduate University (Masters, Professional, Doctoral, etc)",
  "code-school-bootcamp": "Code School / Bootcamp",
  "other-vocational-or-trade-program": "Other Vocational / Trade Program or Apprenticeship",
  "post-doctorate": "Post Doctorate",
  "other": "Other",
  "not-currently-a-student": "I'm not currently a student",
  "prefer-not-to-answer": "Prefer not to answer"
};

export const skillLevelOptions = ["1","2","3","4","5"] as const;
export const hackathonExperienceOptions = ["0","1","2","3","4","5+"] as const;

export const genderOptions = [
  "man",
  "woman",
  "non-binary",
  "other",
  "prefer-not-to-say"
] as const;

export const genderLabels: Record<typeof genderOptions[number], string> = {
  "man": "Man",
  "woman": "Woman",
  "non-binary": "Non-binary",
  "other": "Other",
  "prefer-not-to-say": "Prefer not to say"
};

export const raceOptions = [
  "asian-indian",
  "black-or-african",
  "chinese",
  "filipino",
  "guamanian-or-chamorro",
  "hispanic-latino-spanish-origin",
  "japanese",
  "korean",
  "middle-eastern",
  "native-american-or-alaskan-native",
  "native-hawaiian",
  "samoan",
  "vietnamese",
  "white",
  "other-asian",
  "other-pacific-islander",
  "other",
  "prefer-not-to-answer"
] as const;

export const raceLabels: Record<typeof raceOptions[number], string> = {
  "asian-indian": "Asian Indian",
  "black-or-african": "Black or African",
  "chinese": "Chinese",
  "filipino": "Filipino",
  "guamanian-or-chamorro": "Guamanian or Chamorro",
  "hispanic-latino-spanish-origin": "Hispanic / Latino / Spanish Origin",
  "japanese": "Japanese",
  "korean": "Korean",
  "middle-eastern": "Middle Eastern",
  "native-american-or-alaskan-native": "Native American or Alaskan Native",
  "native-hawaiian": "Native Hawaiian",
  "samoan": "Samoan",
  "vietnamese": "Vietnamese",
  "white": "White",
  "other-asian": "Other Asian (Thai, Cambodian, etc)",
  "other-pacific-islander": "Other Pacific Islander",
  "other": "Other",
  "prefer-not-to-answer": "Prefer not to answer"
};

export const ageOptions = [
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25-34",
  "35-44",
  "45+"
] as const;

export const majorOptions = [
  "computer-science",
  "computer-engineering",
  "software-engineering",
  "information-technology",
  "information-systems",
  "data-science",
  "cybersecurity",
  "electrical-engineering",
  "mechanical-engineering",
  "civil-engineering",
  "chemical-engineering",
  "biomedical-engineering",
  "industrial-engineering",
  "aerospace-engineering",
  "mathematics",
  "statistics",
  "physics",
  "biology",
  "chemistry",
  "business",
  "economics",
  "finance",
  "marketing",
  "psychology",
  "design",
  "undeclared",
  "other"
] as const;

export const majorLabels: Record<typeof majorOptions[number], string> = {
  "computer-science": "Computer Science",
  "computer-engineering": "Computer Engineering",
  "software-engineering": "Software Engineering",
  "information-technology": "Information Technology",
  "information-systems": "Information Systems",
  "data-science": "Data Science",
  "cybersecurity": "Cybersecurity",
  "electrical-engineering": "Electrical Engineering",
  "mechanical-engineering": "Mechanical Engineering",
  "civil-engineering": "Civil Engineering",
  "chemical-engineering": "Chemical Engineering",
  "biomedical-engineering": "Biomedical Engineering",
  "industrial-engineering": "Industrial Engineering",
  "aerospace-engineering": "Aerospace Engineering",
  "mathematics": "Mathematics",
  "statistics": "Statistics",
  "physics": "Physics",
  "biology": "Biology",
  "chemistry": "Chemistry",
  "business": "Business",
  "economics": "Economics",
  "finance": "Finance",
  "marketing": "Marketing",
  "psychology": "Psychology",
  "design": "Design",
  "undeclared": "Undeclared",
  "other": "Other"
};

export const profileSchema = z.object({
  first_name: z.string().min(1, "Please enter your first name"),
  last_name: z.string().min(1, "Please enter your last name"),
  email: z.string().email(),
  phone_number: z.string().min(10, "Please enter a valid phone number"),
  age: z.enum(ageOptions, { message: "Please select your age" }),

  school: z.string().min(2, "Please enter your school"),
  major: z.string().optional().or(z.literal("")),
  grad_year: z.enum(gradYearOptions),
  level_of_study: z.enum(levelOfStudyOptions),

  engineering_skill: z.enum(skillLevelOptions),
  hackathon_experience: z.enum(hackathonExperienceOptions),

  address_line1: z.string().optional().or(z.literal("")),
  address_line2: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal("")),
  zip_code: z.string().optional().or(z.literal("")),
  country: z.string().min(2, "Please enter your country"),

  linkedin_url: z.string().url("Please enter a valid LinkedIn URL"),

  tshirt: z.enum(tshirtOptions).optional(),
  dietary: z.array(z.enum(dietaryOptions)),
  accessibility: z.string(),

  gender: z.enum(genderOptions).optional(),
  race: z.array(z.enum(raceOptions)).optional(),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export const registrationFlagsSchema = z.object({
  accuracy_agreement: z.boolean().refine(val => val === true, "You must agree to the accuracy statement"),
  terms_and_conditions: z.boolean().refine(val => val === true, "You must agree to the terms and conditions"),
  code_of_conduct: z.boolean().refine(val => val === true, "You must agree to the code of conduct"),
  can_photograph: z.boolean().default(false),
  share_resume_with_companies: z.boolean().default(false),
  mlh_code_of_conduct: z.boolean().refine(val => val === true, "You must agree to the MLH Code of Conduct"),
  mlh_data_sharing: z.boolean().refine(val => val === true, "You must agree to share your data with MLH"),
  mlh_communications: z.boolean().default(false),
});
export type RegistrationFlagsValues = z.infer<typeof registrationFlagsSchema>;

/**
 * Free-response application questions. To add or remove a question, edit this list only:
 * answers live in registrations.responses (jsonb) keyed by `id`, and the form, validation,
 * admin detail page and CSV export all read from here. Removing a question hides its old
 * answers but keeps them in the database. Don't reuse an old `id` for a different question.
 */
export const APPLICATION_QUESTIONS = [
  {
    id: "build_or_learn",
    label: "What do you want to build or learn at SASEHacks?",
    placeholder: "A project idea, a technology you want to try, people you want to meet...",
    required: false,
    maxLength: 500,
  },
] as const satisfies readonly {
  id: string;
  label: string;
  placeholder?: string;
  required: boolean;
  maxLength: number;
}[];

export type ApplicationResponses = Record<string, string>;

export const responsesSchema = z.object(
  Object.fromEntries(
    APPLICATION_QUESTIONS.map(q => {
      const base = z.string().trim().max(q.maxLength, `Please keep this under ${q.maxLength} characters`);
      return [q.id, q.required ? base.min(1, "This question is required") : base.optional().default("")];
    })
  )
);

/** Every registration status, in lifecycle order */
export const registrationStatuses = [
  "draft",
  "pending",
  "accepted",
  "confirmed",
  "declined",
  "waitlist",
  "rejected",
] as const;
export type RegistrationStatus = typeof registrationStatuses[number];

export const registrationStatusLabels: Record<RegistrationStatus, string> = {
  draft: "Not submitted",
  pending: "Under review",
  accepted: "Accepted (awaiting RSVP)",
  confirmed: "Confirmed attending",
  declined: "Declined",
  waitlist: "Waitlisted",
  rejected: "Rejected",
};
