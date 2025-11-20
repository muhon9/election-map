import CommitteeForm from "@/components/CommitteeForm";

export const dynamic = "force-dynamic";

export default function CommitteeCreatePage() {
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Create Committee</h1>
        <a href="/committees" className="text-blue-600 underline">
          Back to Committees
        </a>
      </header>
      <CommitteeForm />
    </div>
  );
}
