import { describe, expect, it } from "vitest";
import { parseDevpostCsv } from "@/lib/devpost";

const NO_PROJECTS = "No submitted projects found. Is this the Devpost submissions export?";

describe("parseDevpostCsv", () => {
  it("reads title, url, track, description and team", () => {
    const csv = [
      "Project Title,Submission Url,Project Status,Opt-In Prizes,About The Project,Submitter First Name,Submitter Last Name,Team Member 1 First Name,Team Member 1 Last Name,Team Member 2 First Name,Team Member 2 Last Name",
      "Gator Bot,https://devpost.com/software/gator-bot,Submitted (Gallery/Visible),Best AI,A bot for gators,Ada,Lovelace,Alan,Turing,,",
    ].join("\n");

    expect(parseDevpostCsv(csv)).toEqual({
      projects: [
        {
          title: "Gator Bot",
          devpost_url: "https://devpost.com/software/gator-bot",
          track: "Best AI",
          description: "A bot for gators",
          team: "Ada Lovelace, Alan Turing",
        },
      ],
      skippedDrafts: 0,
    });
  });

  it("uses null for missing track, description and team", () => {
    const csv = "Project Title,Submission Url\nSolo,https://devpost.com/software/solo\n";
    expect(parseDevpostCsv(csv).projects).toEqual([
      { title: "Solo", devpost_url: "https://devpost.com/software/solo", track: null, description: null, team: null },
    ]);
  });

  it("skips drafts and counts them", () => {
    const csv = [
      "Project Title,Submission Url,Project Status",
      "One,https://devpost.com/software/one,Submitted (Gallery/Visible)",
      "Two,https://devpost.com/software/two,Draft",
      "Three,https://devpost.com/software/three,draft (hidden)",
    ].join("\n");

    const result = parseDevpostCsv(csv);
    expect(result.projects.map(p => p.title)).toEqual(["One"]);
    expect(result.skippedDrafts).toBe(2);
    expect(result.error).toBeUndefined();
  });

  it("handles a BOM, CRLF and quoted commas/newlines", () => {
    const csv =
      "﻿Project Title,Submission Url,About The Project\r\n" +
      '"Hello, World",https://devpost.com/software/hello,"Line one\r\nLine two, with a comma"\r\n' +
      "Second,https://devpost.com/software/second,Plain\r\n";

    const result = parseDevpostCsv(csv);
    expect(result.error).toBeUndefined();
    expect(result.projects).toEqual([
      {
        title: "Hello, World",
        devpost_url: "https://devpost.com/software/hello",
        track: null,
        description: "Line one\r\nLine two, with a comma",
        team: null,
      },
      { title: "Second", devpost_url: "https://devpost.com/software/second", track: null, description: "Plain", team: null },
    ]);
  });

  it("matches headers case-insensitively and with alternates", () => {
    const csv = [
      " project name , DEVPOST URL ,project status,track,Elevator Pitch",
      "Alt,https://devpost.com/software/alt,submitted,Health,Short pitch",
    ].join("\n");

    expect(parseDevpostCsv(csv).projects).toEqual([
      { title: "Alt", devpost_url: "https://devpost.com/software/alt", track: "Health", description: "Short pitch", team: null },
    ]);
  });

  it("drops rows without a url", () => {
    const csv = [
      "Project Title,Submission Url",
      "Has url,https://devpost.com/software/has",
      "No url,",
      ",https://devpost.com/software/no-title",
    ].join("\n");

    const result = parseDevpostCsv(csv);
    expect(result.projects.map(p => p.title)).toEqual(["Has url"]);
    expect(result.skippedDrafts).toBe(0);
  });

  it("keeps the first of duplicate urls", () => {
    const csv = [
      "Project Title,Submission Url",
      "First,https://devpost.com/software/dup",
      "Second,https://devpost.com/software/dup",
      "Other,https://devpost.com/software/other",
    ].join("\n");

    expect(parseDevpostCsv(csv).projects.map(p => p.title)).toEqual(["First", "Other"]);
  });

  it('returns the "Is this the Devpost submissions export?" error for an unrelated CSV', () => {
    const csv = "Name,Email\nJane,jane@example.com\n";
    expect(parseDevpostCsv(csv)).toEqual({ projects: [], skippedDrafts: 0, error: NO_PROJECTS });
    expect(parseDevpostCsv("")).toEqual({ projects: [], skippedDrafts: 0, error: NO_PROJECTS });
  });

  it("returns the error when every row is a draft", () => {
    const csv = "Project Title,Submission Url,Project Status\nD,https://devpost.com/software/d,Draft\n";
    expect(parseDevpostCsv(csv)).toEqual({ projects: [], skippedDrafts: 1, error: NO_PROJECTS });
  });
});
