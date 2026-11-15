import { describe, expect, it } from "vitest";
import {
  APPLICANT_FILTERS,
  applicantState,
  filterApplicants,
  unsentCounts,
  type ApplicantRow,
} from "@/lib/applications";
import type { RegistrationStatus } from "@/lib/validation";

function row(overrides: Partial<ApplicantRow> = {}): ApplicantRow {
  return {
    userId: "u1",
    name: "Jane Doe",
    email: "jane@example.com",
    school: "University of Florida",
    major: "Computer Science",
    gradYear: "2027",
    levelOfStudy: "Undergraduate University (3+ year)",
    hackathonExperience: "1",
    engineeringSkill: "3",
    linkedinUrl: null,
    hasResume: true,
    responses: {},
    submittedAt: "2026-11-01T12:00:00.000Z",
    status: "pending",
    decision: null,
    ...overrides,
  };
}

describe("applicantState", () => {
  it.each<[RegistrationStatus, string]>([
    ["pending", "pending"],
    ["accepted", "accepted"],
    ["confirmed", "confirmed"],
    ["declined", "declined"],
    ["rejected", "rejected"],
    ["waitlist", "waitlist"],
  ])("status %s → %s", (status, state) => {
    expect(applicantState(row({ status }))).toBe(state);
  });

  it("a pending row with an unsent acceptance is accepted_unsent", () => {
    expect(applicantState(row({ decision: "accepted" }))).toBe("accepted_unsent");
  });

  it("a pending row with an unsent rejection is rejected_unsent", () => {
    expect(applicantState(row({ decision: "rejected" }))).toBe("rejected_unsent");
  });

  it("a decision on a non-pending row is ignored", () => {
    expect(applicantState(row({ status: "accepted", decision: "rejected" }))).toBe("accepted");
  });
});

describe("APPLICANT_FILTERS", () => {
  it("lists every state plus All, in order", () => {
    expect(APPLICANT_FILTERS).toEqual([
      { value: "pending", label: "Pending" },
      { value: "accepted_unsent", label: "Accepted · not sent" },
      { value: "rejected_unsent", label: "Rejected · not sent" },
      { value: "accepted", label: "Accepted" },
      { value: "confirmed", label: "Confirmed" },
      { value: "declined", label: "Declined" },
      { value: "rejected", label: "Rejected" },
      { value: "waitlist", label: "Waitlist" },
      { value: "all", label: "All" },
    ]);
  });
});

describe("filterApplicants", () => {
  const rows = [
    row({ userId: "a", name: "Ana Pending", school: "University of Florida" }),
    row({ userId: "b", name: "Ben Queued", email: "ben@ucf.edu", school: "UCF", decision: "accepted" }),
    row({ userId: "c", name: "Cam Rejected", school: "FSU", status: "rejected" }),
    row({ userId: "d", name: "Dee Confirmed", school: "University of Florida", status: "confirmed" }),
  ];
  const ids = (r: ApplicantRow[]) => r.map(x => x.userId);

  it("filters by state", () => {
    expect(ids(filterApplicants(rows, "pending", ""))).toEqual(["a"]);
    expect(ids(filterApplicants(rows, "accepted_unsent", ""))).toEqual(["b"]);
    expect(ids(filterApplicants(rows, "rejected", ""))).toEqual(["c"]);
  });

  it("'all' keeps every row", () => {
    expect(ids(filterApplicants(rows, "all", ""))).toEqual(["a", "b", "c", "d"]);
  });

  it("matches the query against school, case-insensitively", () => {
    expect(ids(filterApplicants(rows, "all", "university OF florida"))).toEqual(["a", "d"]);
  });

  it("matches the query against name and email", () => {
    expect(ids(filterApplicants(rows, "all", "cam"))).toEqual(["c"]);
    expect(ids(filterApplicants(rows, "all", "BEN@UCF"))).toEqual(["b"]);
  });

  it("combines state and query", () => {
    expect(ids(filterApplicants(rows, "confirmed", "florida"))).toEqual(["d"]);
    expect(ids(filterApplicants(rows, "pending", "fsu"))).toEqual([]);
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(ids(filterApplicants(rows, "all", "  ucf  "))).toEqual(["b"]);
  });
});

describe("unsentCounts", () => {
  it("counts unsent decisions on pending rows only", () => {
    const rows = [
      row({ decision: "accepted" }),
      row({ decision: "accepted" }),
      row({ decision: "rejected" }),
      row({ decision: null }),
      row({ status: "accepted", decision: "rejected" }),
    ];
    expect(unsentCounts(rows)).toEqual({ accepted: 2, rejected: 1 });
  });

  it("is zero for no rows", () => {
    expect(unsentCounts([])).toEqual({ accepted: 0, rejected: 0 });
  });
});
