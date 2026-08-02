'use client';
import { useEffect, useState } from 'react';
import { useChatConversation } from '../../hooks/useChatConversation';
import { getOrCreateGuestSessionId } from '../../lib/guest-session';
import { ChatMessage } from './ChatMessage';

type ChatPanelProps = { conversationId?: string };

export function ChatPanel({ conversationId }: ChatPanelProps) {
  const [guestSessionId, setGuestSessionId] = useState(conversationId);

  useEffect(() => {
    if (!conversationId) setGuestSessionId(getOrCreateGuestSessionId(window.localStorage));
  }, [conversationId]);

  if (!guestSessionId) return <section className="chat-panel" aria-label="Chat conversation"><p>Loading conversation...</p></section>;
  return <GuestChatPanel conversationId={guestSessionId} />;
}

function GuestChatPanel({ conversationId }: { conversationId: string }) {
  const chat = useChatConversation(conversationId, conversationId);
  const [value, setValue] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (value.trim()) {
      await chat.send(value.trim());
      setValue('');
    }
  };

  return <section className="chat-panel" aria-label="Chat conversation"><header><span>First chatbot slice</span><strong>{chat.status?.status ?? 'ready'}</strong></header><div className="chat-messages">{chat.loading?<p>Loading conversation...</p>:chat.messages.map(m=><ChatMessage key={m.messageId} message={m}/>)}{chat.status?.status==='pending'&&<p>Assistant is thinking...</p>}{chat.error&&<div role="alert">{chat.error} <button onClick={()=>void chat.reload()}>Retry</button></div>}</div><form onSubmit={submit}><input aria-label="Message" value={value} onChange={event=>setValue(event.target.value)} placeholder="Ask a question"/><button type="submit">Send</button></form></section>;
}
