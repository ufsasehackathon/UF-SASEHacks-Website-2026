import { describe, expect, it } from "vitest";
import { countries, searchCountries } from "@/lib/countries";
import { searchSchools } from "@/lib/mlh-schools";

describe("searchCountries", () => {
  it("returns the first countries for an empty query", () => {
    expect(searchCountries("")).toEqual(countries.slice(0, 10));
  });

  it("matches names case-insensitively", () => {
    const names = searchCountries("UNITED").map(c => c.name);
    expect(names).toContain("United States");
    expect(names.every(n => n.toLowerCase().includes("united"))).toBe(true);
  });

  it("matches an exact country code", () => {
    expect(searchCountries("us").map(c => c.code)).toContain("US");
  });

  it("respects the limit", () => {
    expect(searchCountries("a", 3)).toHaveLength(3);
  });

  it("returns [] when nothing matches", () => {
    expect(searchCountries("zzzz")).toEqual([]);
  });
});

describe("searchSchools", () => {
  it("needs at least 2 characters", () => {
    expect(searchSchools("")).toEqual([]);
    expect(searchSchools("f")).toEqual([]);
  });

  it("matches names case-insensitively", () => {
    const names = searchSchools("FLORIDA").map(s => s.name);
    expect(names).toContain("University of Florida");
    expect(names.every(n => n.toLowerCase().includes("florida"))).toBe(true);
  });

  it("respects the limit", () => {
    expect(searchSchools("university", 2)).toHaveLength(2);
  });
});
