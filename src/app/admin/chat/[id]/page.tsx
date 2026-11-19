import { ChatConversationScreen } from "@/features/chat";

export default async function ChatConversationPage({ params }: PageProps<"/admin/chat/[id]">) {
  const { id } = await params;
  return <ChatConversationScreen id={id} />;
}
