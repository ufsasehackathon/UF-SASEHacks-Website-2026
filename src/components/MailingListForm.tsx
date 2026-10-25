"use client"

import { useState, type FormEvent } from "react";
import { joinMailingList } from "@/app/actions";

type Status = "idle" | "submitting" | "success" | "error";

export default function MailingListForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    const res = await joinMailingList(email);
    if (res.ok) {
      setStatus("success");
      setEmail("");
    } else {
      setStatus("error");
      setError(res.error ?? "Something went wrong. Please try again.");
    }
  };

  if (status === "success") {
    return (
      <p className="font-[family-name:var(--font-body)] text-[#560700] text-sm md:text-base font-bold mb-8">
        Thanks! We&apos;ll keep you posted.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center mb-8 w-full">
      <form
        onSubmit={onSubmit}
        className="flex items-center w-full max-w-sm rounded-full bg-white/90 border-2 border-[#560700]/20 shadow-md pl-5 pr-1 py-1 focus-within:border-[#560700]/60 transition-colors"
      >
        <label htmlFor="mailing-list-email" className="sr-only">Email address</label>
        <input
          id="mailing-list-email"
          type="email"
          required
          autoComplete="email"
          placeholder="Find out when we open applications!"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          className="flex-1 min-w-0 bg-transparent font-[family-name:var(--font-body)] text-sm md:text-base text-[#560700] placeholder:text-[#560700]/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="rounded-full bg-[#560700] text-[#FFE4B3] px-4 py-1.5 font-[family-name:var(--font-body)] text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {status === "submitting" ? "..." : "Join"}
        </button>
      </form>
      {status === "error" && (
        <p className="font-[family-name:var(--font-body)] text-red-700 text-sm mt-2">{error}</p>
      )}
    </div>
  );
}
