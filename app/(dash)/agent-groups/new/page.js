import AgentGroupForm from "../AgentGroupForm";

export default function NewAgentGroupPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Create Agent Group</h1>
      </div>

      <AgentGroupForm />
    </div>
  );
}
