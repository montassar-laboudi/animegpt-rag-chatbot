'use client';

import { Message } from 'ai';

interface Suggestion {
  title: string;
  prompt: string;
}

interface PromptSuggestionsRowProps {
  onSubmit: (message: Message) => void;
  suggestions: Suggestion[];
  isLoading?: boolean;
}

export default function PromptSuggestionsRow({ onSubmit, suggestions, isLoading }: PromptSuggestionsRowProps) {
  const handleClick = (prompt: string) => {
    onSubmit({
      role: 'user',
      content: prompt,
    } as Message);
  };

  if (isLoading) {
    return (
      <div className="suggestions-row">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="suggestion-button"
            style={{ opacity: 0.3, pointerEvents: 'none', minWidth: '130px' }}
          >
            &nbsp;
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="suggestions-row">
      {suggestions.map((suggestion, index) => (
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
