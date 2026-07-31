export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  conversationId: string;
  createdAt: string;
}

export interface ConversationInput {
  conversationId: string;
  messages: ChatMessage[];
}

export interface ConversationOutput extends ConversationInput {
  assistantMessage: ChatMessage;
  turn: number;
}

export function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<ChatMessage>;
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    typeof message.conversationId === "string" &&
    typeof message.createdAt === "string"
  );
}
