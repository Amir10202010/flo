export default function ConversationPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1 className="text-2xl font-bold">Conversation {params.id}</h1>
      <p>Messages and analysis will show here.</p>
    </div>
  )
}
