"use client";

import Image from "next/image";
import animegptLogo from "./assets/Animegpt-Logo.png";

import { useChat } from "ai/react";
import { Message } from "ai";

import PromptSuggestionsRow from "./components/PromptSuggestionsRow";
import Bubble from "./components/Bubble";
import LoadingBubble from "./components/LoadingBubble";





const Home = () => {


  const { append, isLoading,messages, input, handleInputChange, handleSubmit } = useChat();
  const noMessages = !messages || messages.length === 0;
  
  const handlePrompt = ( promptText ) => {
    const msg: Message = {
        id: crypto.randomUUID(),
        content: promptText,
        role: "user"
    };
    append(msg);
  } 


  return (
    <main>
      <Image
        src={animegptLogo}
        width={250}
        alt="AnimeGPT Logo"
        priority
       />

      <section className={noMessages ? "" : "populated"}>
        {noMessages ? (
          <>
            <p className="starter-text">
              Ask me about anime recommendations, characters, storylines, episodes, or the latest anime news.
            </p>

            <br />

            <PromptSuggestionsRow onPromptClick={handlePrompt} /> 
          </>
        ) : (
          <>
            {messages.map((message, index) => (<Bubble key={`message-${index}`} message={message} />))}
            {isLoading && <LoadingBubble />}
          </>
        )}

        
      </section>
      <form onSubmit={handleSubmit}>
          <input
            className="question-box"
            onChange={handleInputChange}
            value={input}
            placeholder="Ask me anything about anime..."
          />
          <input type="submit"/>
        </form>
    </main>
  );
};

export default Home;