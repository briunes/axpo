import { redirect } from "next/navigation";

export default function LegacySimulationIssuesPage() {
  redirect("/internal/logs?tab=simulation-issues");
}
