import PromptSuggestionButton from "./PromptSuggestionButton";

const PromptSuggestionsRow = ({onPromptClick}) => {
  const prompts = [
    "Find me an anime similar to Solo Leveling",
    "What are the best anime for beginners?",
    "Suggest a short anime I can finish quickly",
    "Give me a spoiler-free explanation of One Piece",
  ];

  return (
    <div className="prompt-suggestion-row">
      {prompts.map((prompt, index) => (
        <PromptSuggestionButton
          key={`suggestion-${index}`}
          text={prompt}
          onClick={() => onPromptClick(prompt)}
        />
      ))}
    </div>
  );
};

export default PromptSuggestionsRow;