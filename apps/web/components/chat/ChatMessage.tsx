import type { ChatMessage as Message } from '@study-abroad/contracts';
export function ChatMessage({ message }: { message: Message }) { return <article className={`chat-message chat-message-${message.role}`}><small>{message.role}</small><p>{message.content}</p></article>; }
