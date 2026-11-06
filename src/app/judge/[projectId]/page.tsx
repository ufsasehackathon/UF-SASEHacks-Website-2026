import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentRole } from "@/lib/session";
import ScoreForm from "@/components/judge/ScoreForm";
import { Card, PageShell } from "@/components/staff/Card";

export const dynamic = "force-dynamic";

export default async function JudgeProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { supabase, user } = await getCurrentRole();
  if (!user) notFound();

  // Only assigned projects are visible to judges (RLS), so a missing row = not yours
  const [{ data: assignment }, { data: project }, { data: sheet }] = await Promise.all([
    supabase.from("judge_assignments").select("project_id").eq("judge_id", user.id).eq("project_id", projectId).maybeSingle(),
    supabase.from("projects").select("id, title, devpost_url, track, table_number, description, team").eq("id", projectId).maybeSingle(),
    supabase.from("judge_scores").select("scores, comments").eq("judge_id", user.id).eq("project_id", projectId).maybeSingle(),
  ]);
  if (!assignment || !project) notFound();

  return (
    <PageShell title={project.title} subtitle={<Link href="/judge" className="hover:underline">← All projects</Link>}>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Project">
          <dl className="font-[family-name:var(--font-body)] text-sm space-y-3">
            <div><dt className="text-gray-500">Table</dt><dd className="font-semibold">{project.table_number ?? "-"}</dd></div>
            {project.track && <div><dt className="text-gray-500">Track / prizes</dt><dd>{project.track}</dd></div>}
            {project.team && <div><dt className="text-gray-500">Team</dt><dd>{project.team}</dd></div>}
            {project.devpost_url && (
              <div><dt className="text-gray-500">Devpost</dt><dd><a href={project.devpost_url} target="_blank" rel="noreferrer" className="text-[#560700] underline break-all">{project.devpost_url}</a></dd></div>
            )}
            {project.description && (
              <div><dt className="text-gray-500">About</dt><dd className="whitespace-pre-wrap text-gray-700 max-h-96 overflow-y-auto">{project.description}</dd></div>
            )}
          </dl>
        </Card>
        <Card title="Your score" subtitle="1 = weak, 5 = excellent">
          <ScoreForm
            projectId={project.id}
            initialScores={(sheet?.scores ?? {}) as Record<string, number>}
            initialComments={sheet?.comments ?? null}
          />
        </Card>
      </div>
    </PageShell>
  );
}
