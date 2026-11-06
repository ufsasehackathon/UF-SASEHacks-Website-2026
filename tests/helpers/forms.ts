import type { ProfileFormValues, RegistrationFlagsValues } from "@/lib/validation";
import { allConsents, validProfile } from "./fixtures";

/** FormData shaped like ProfileForm's submission */
export function profileForm(overrides: Partial<Record<keyof ProfileFormValues, unknown>> = {}) {
  const values = { ...validProfile(), ...overrides } as Record<string, unknown>;
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) value.forEach(v => fd.append(key, String(v)));
    else fd.set(key, String(value));
  }
  return fd;
}

/** Adds consent checkboxes ("on" when checked, absent when not) to a FormData */
export function withConsents(fd: FormData, flags: Partial<RegistrationFlagsValues> = {}) {
  for (const [key, checked] of Object.entries(allConsents(flags))) {
    if (checked) fd.set(key, "on");
  }
  return fd;
}

export function consentForm(flags: Partial<RegistrationFlagsValues> = {}) {
  return withConsents(new FormData(), flags);
}

export function fileForm(file: File, field = "resume") {
  const fd = new FormData();
  fd.set(field, file);
  return fd;
}
