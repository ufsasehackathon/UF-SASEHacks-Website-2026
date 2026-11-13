import { redirect } from "next/navigation";

/** /staff opens on the first tab */
export default function StaffPage() {
  redirect("/staff/applications");
}
