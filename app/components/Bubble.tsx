'use client';

import { Message } from 'ai';
import Image from 'next/image';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import logoSrc from '../assets/AG-Logo.png';

interface BubbleProps {
  message: Message;
}

export default function Bubble({ message }: BubbleProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={`bubble-wrapper ${isUser ? 'user' : 'assistant'}`}>
      {!isUser && (
        <div className="avatar" style={{ background: 'none', overflow: 'hidden' }}>
          <Image src={logoSrc} alt="AnimeGPT" width={32} height={32} style={{ display: 'block', borderRadius: '8px' }} />
        </div>
      )}
      <div className={`bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
        {isUser ? (
          <p className="bubble-text">{message.content}</p>
        ) : (
          <>
            <div className="markdown-content">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
            <button className="copy-btn" onClick={handleCopy} aria-label="Copy message">
              {copied ? '✓' : '⎘'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}