'use client';

import { Message } from 'ai';
import ReactMarkdown from 'react-markdown';

interface BubbleProps {
  message: Message;
}

export default function Bubble({ message }: BubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`bubble-wrapper ${isUser ? 'user' : 'assistant'}`}>
      {!isUser && <div className="avatar">AG</div>}
      <div className={`bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
        {isUser ? (
          <p className="bubble-text">{message.content}</p>
        ) : (
          <div className="markdown-content">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}