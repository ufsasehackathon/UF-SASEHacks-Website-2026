import { describe, expect, it } from "vitest";
import {
  profileSchema,
  registrationFlagsSchema,
  responsesSchema,
  isProfileComplete,
  hasRequiredConsents,
  APPLICATION_QUESTIONS,
  levelOfStudyOptions,
  levelOfStudyLabels,
  genderOptions,
  genderLabels,
  raceOptions,
  raceLabels,
  majorOptions,
  majorLabels,
  registrationStatuses,
  registrationStatusLabels,
} from "@/lib/validation";
import { allConsents, validProfile, REQUIRED_CONSENTS } from "../helpers/fixtures";

function errorPaths(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return (result.error?.issues ?? []).map(i => i.path.join("."));
}

describe("profileSchema", () => {
  it("accepts a complete profile", () => {
    expect(profileSchema.safeParse(validProfile()).success).toBe(true);
  });

  it.each([
    "age",
    "grad_year",
    "level_of_study",
    "engineering_skill",
    "hackathon_experience",
  ] as const)("rejects a blank required select: %s", field => {
    const result = profileSchema.safeParse({ ...validProfile(), [field]: "" });
    expect(result.success).toBe(false);
    expect(errorPaths(result)).toContain(field);
  });

  it.each(["first_name", "last_name"] as const)("requires %s", field => {
    const result = profileSchema.safeParse(validProfile({ [field]: "" }));
    expect(errorPaths(result)).toContain(field);
  });

  it("rejects an invalid email", () => {
    expect(errorPaths(profileSchema.safeParse(validProfile({ email: "not-an-email" })))).toContain("email");
  });

  it("requires a phone number of at least 10 characters", () => {
    expect(errorPaths(profileSchema.safeParse(validProfile({ phone_number: "123456789" })))).toContain("phone_number");
    expect(profileSchema.safeParse(validProfile({ phone_number: "1234567890" })).success).toBe(true);
  });

  it("requires school and country of at least 2 characters", () => {
    const result = profileSchema.safeParse(validProfile({ school: "U", country: "X" }));
    expect(errorPaths(result)).toEqual(expect.arrayContaining(["school", "country"]));
  });

  it("requires a valid LinkedIn URL", () => {
    expect(errorPaths(profileSchema.safeParse(validProfile({ linkedin_url: "" })))).toContain("linkedin_url");
    expect(errorPaths(profileSchema.safeParse(validProfile({ linkedin_url: "linkedin.com/in/ada" })))).toContain("linkedin_url");
  });

  it("allows optional fields to be blank", () => {
    const result = profileSchema.safeParse(validProfile({ major: "", tshirt: "", gender: "", race: undefined }));
    expect(result.success).toBe(true);
  });

  it("rejects values outside the option lists", () => {
    const bad = { ...validProfile(), age: "16", tshirt: "XXS", dietary: ["paleo"], gender: "robot", race: ["martian"] };
    expect(errorPaths(profileSchema.safeParse(bad))).toEqual(
      expect.arrayContaining(["age", "tshirt", "dietary.0", "gender", "race.0"])
    );
  });
});

describe("registrationFlagsSchema", () => {
  it("accepts all consents", () => {
    expect(registrationFlagsSchema.safeParse(allConsents()).success).toBe(true);
  });

  it("accepts only the required consents", () => {
    const flags = allConsents({ can_photograph: false, share_resume_with_companies: false, mlh_communications: false });
    expect(registrationFlagsSchema.safeParse(flags).success).toBe(true);
  });

  it.each(REQUIRED_CONSENTS)("requires %s", field => {
    const result = registrationFlagsSchema.safeParse(allConsents({ [field]: false }));
    expect(errorPaths(result)).toEqual([field]);
  });
});

describe("isProfileComplete", () => {
  it("is false for null/undefined", () => {
    expect(isProfileComplete(null)).toBe(false);
    expect(isProfileComplete(undefined)).toBe(false);
  });

  it("is true for a valid row with DB nulls in optional columns", () => {
    const row = { ...validProfile(), tshirt: null, gender: null, major: null, dietary: null, race: null, accessibility: null, id: "x" };
    // tshirt/gender/major are optional, null is mapped to undefined
    expect(isProfileComplete(row)).toBe(true);
  });

  it("is false for a freshly created row (ensureRows defaults)", () => {
    expect(isProfileComplete({ email: "a@b.co", full_name: "", first_name: "", last_name: "", school: "", major: "", dietary: [], accessibility: "", country: "" })).toBe(false);
  });

  it("is false when one required field is missing", () => {
    expect(isProfileComplete({ ...validProfile(), linkedin_url: null })).toBe(false);
  });
});

describe("hasRequiredConsents", () => {
  it("is false for null", () => {
    expect(hasRequiredConsents(null)).toBe(false);
  });

  it("is true when the required ones are true", () => {
    expect(hasRequiredConsents(Object.fromEntries(REQUIRED_CONSENTS.map(k => [k, true])))).toBe(true);
  });

  it("treats null and truthy non-booleans as unchecked", () => {
    expect(hasRequiredConsents({ ...allConsents(), code_of_conduct: null })).toBe(false);
    expect(hasRequiredConsents({ ...allConsents(), code_of_conduct: "true" })).toBe(false);
  });
});

describe("responsesSchema", () => {
  const required = APPLICATION_QUESTIONS.filter(q => q.required);

  it("has at least one question with a unique id", () => {
    const ids = APPLICATION_QUESTIONS.map(q => q.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("accepts answers to every question", () => {
    const answers = Object.fromEntries(APPLICATION_QUESTIONS.map(q => [q.id, "An answer"]));
    expect(responsesSchema.safeParse(answers).success).toBe(true);
  });

  it.each(required.map(q => q.id))("requires %s (whitespace only counts as blank)", id => {
    const answers = Object.fromEntries(APPLICATION_QUESTIONS.map(q => [q.id, "An answer"]));
    expect(errorPaths(responsesSchema.safeParse({ ...answers, [id]: "   " }))).toContain(id);
    expect(errorPaths(responsesSchema.safeParse({ ...answers, [id]: undefined }))).toContain(id);
  });

  it.each(APPLICATION_QUESTIONS.map(q => [q.id, q.maxLength] as const))("limits %s to %i characters", (id, max) => {
    const answers = Object.fromEntries(APPLICATION_QUESTIONS.map(q => [q.id, "An answer"]));
    expect(responsesSchema.safeParse({ ...answers, [id]: "x".repeat(max) }).success).toBe(true);
    expect(errorPaths(responsesSchema.safeParse({ ...answers, [id]: "x".repeat(max + 1) }))).toContain(id);
  });

  it("trims answers and drops unknown keys", () => {
    const answers = Object.fromEntries(APPLICATION_QUESTIONS.map(q => [q.id, "  padded  "]));
    const parsed = responsesSchema.parse({ ...answers, not_a_question: "x" });
    expect(parsed).not.toHaveProperty("not_a_question");
    for (const q of APPLICATION_QUESTIONS) expect(parsed[q.id]).toBe("padded");
  });
});

describe("option labels", () => {
  it.each([
    ["level of study", levelOfStudyOptions, levelOfStudyLabels],
    ["gender", genderOptions, genderLabels],
    ["race", raceOptions, raceLabels],
    ["major", majorOptions, majorLabels],
    ["status", registrationStatuses, registrationStatusLabels],
  ] as [string, readonly string[], Record<string, string>][])("every %s option has a label and no extras", (_, options, labels) => {
    for (const o of options) expect(labels[o], o).toBeTruthy();
    expect(Object.keys(labels).sort()).toEqual([...options].sort());
  });
});
