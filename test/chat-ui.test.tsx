import { renderToStaticMarkup } from 'react-dom/server';
import { ChatMessage } from '../apps/web/components/chat/ChatMessage';
import { describe, expect, it } from 'vitest';

describe('chat UI', () => {
  it('renders roles and message content', () => {
    const html = renderToStaticMarkup(<ChatMessage message={{ messageId: 'm', conversationId: 'c', turnId: 't', role: 'assistant', content: 'Welcome', createdAt: new Date().toISOString() }} />);
    expect(html).toContain('Welcome');
    expect(html).toContain('assistant');
  });
});
