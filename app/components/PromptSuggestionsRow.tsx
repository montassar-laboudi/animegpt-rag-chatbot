'use client';

import { Message } from 'ai';

interface PromptSuggestionsRowProps {
  onSubmit: (message: Message) => void;
}

const PROMPT_SUGGESTIONS = [
  {
    title: 'Best anime of 2026',
    prompt: 'What are the best anime released in 2026?',
  },
  {
    title: 'Hidden gems',
    prompt: 'Recommend underrated anime that most people have never heard of but are absolutely worth watching.',
  },
  {
    title: 'One Piece new arc',
    prompt: 'What is the latest arc in One Piece and where should I start watching?',
  },
  {
    title: 'Anime like Jujutsu Kaisen',
    prompt: 'Recommend anime similar to Jujutsu Kaisen with dark themes and intense battles.',
  },
];

export default function PromptSuggestionsRow({ onSubmit }: PromptSuggestionsRowProps) {
  const handleClick = (prompt: string) => {
    onSubmit({
      role: 'user',
      content: prompt,
    } as Message);
  };

  return (
    <div className="suggestions-row">
      {PROMPT_SUGGESTIONS.map((suggestion, index) => (
        <button
          key={index}
          onClick={() => handleClick(suggestion.prompt)}
          className="suggestion-button"
          title={suggestion.prompt}
        >
          <span className="suggestion-icon">⟡</span>
          <span className="suggestion-text">{suggestion.title}</span>
        </button>
      ))}
    </div>
  );
}