# AnimeGPT

AnimeGPT is a personal AI chatbot project built for anime fans. It lets users ask questions about anime, get recommendations, explore characters, understand storylines, check watch orders, and receive friendly anime-focused answers through a clean chat interface.

The project was built to practice modern full-stack AI development using **Next.js**, **OpenAI**, **Astra DB**, **LangChain.js**, and a **Retrieval-Augmented Generation (RAG)** workflow.

---


## Author

Created by **Montassar Laboudi**.


## Overview

AnimeGPT is not just a basic chatbot. It uses a RAG system to improve its answers with anime-related data stored in a vector database.

Instead of only relying on the AI model’s general knowledge, the app retrieves relevant anime content from a custom database and sends that context to OpenAI before generating a response.

This helps the chatbot give more focused and useful answers for anime-related questions.

---

## Features

- Anime recommendations
- Similar anime suggestions
- Character explanations
- Story summaries
- Watch order help
- Episode and filler guidance
- Anime genre explanations
- Manga and anime comparisons
- Anime news and trend-based answers
- Suggested starter prompts
- Streaming chatbot responses
- Clean anime-inspired user interface
- RAG-powered anime knowledge retrieval

---

## Tech Stack

- **Next.js** — Full-stack React framework
- **React** — UI components and client-side interactivity
- **TypeScript** — Type-safe JavaScript development
- **OpenAI** — Chat responses and text embeddings
- **Vercel AI SDK** — Streaming AI chat responses
- **Astra DB** — Vector database for storing anime embeddings
- **LangChain.js** — Text splitting and document processing
- **Puppeteer** — Scraping anime-related website content
- **CSS** — Custom anime-inspired styling

---

## Project Structure

```txt
nextjs-animegpt/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts
│   │
│   ├── assets/
│   │   ├── anime_ui_background.avif
│   │   └── Animegpt-Logo.png
│   │
│   ├── components/
│   │   ├── Bubble.tsx
│   │   ├── LoadingBubble.tsx
│   │   ├── PromptSuggestionButton.tsx
│   │   └── PromptSuggestionsRow.tsx
│   │
│   ├── global.css
│   ├── layout.tsx
│   └── page.tsx
│
├── scripts/
│   └── loadDb.ts
│
├── .env
├── .gitignore
├── eslint.config.mjs
├── next-env.d.ts
├── next.config.ts
├── package-lock.json
├── package.json
├── README.md
└── tsconfig.json
```

---

## How It Works

AnimeGPT uses a **Retrieval-Augmented Generation** workflow.

### 1. Data Collection

The project uses a seed script to collect anime-related text from selected websites.

The script is located here:

```txt
scripts/loadDb.ts
```

It uses Puppeteer to open pages, extract text, and prepare the content for processing.

---

### 2. Text Splitting

Large blocks of text are split into smaller chunks using LangChain.js.

This makes the content easier to embed, store, and retrieve later.

---

### 3. Embedding Generation

Each text chunk is converted into a vector embedding using OpenAI.

Embeddings are numerical representations of text that allow the database to search by meaning instead of exact words.

---

### 4. Vector Storage

The generated embeddings are stored in Astra DB.

Each stored record contains:

- The text chunk
- Its vector embedding
- Optional metadata such as the source URL

---

### 5. User Question

When a user asks a question, the app sends the message to the API route:

```txt
app/api/chat/route.ts
```

The user’s question is also converted into an embedding.

---

### 6. Context Retrieval

Astra DB compares the user question embedding with the stored anime embeddings.

It returns the most relevant anime text chunks.

---

### 7. AI Response

The retrieved context is sent to OpenAI along with the user’s question.

OpenAI then generates a friendly anime-focused answer using the retrieved information.

---

## Chat Flow

```txt
User sends message
        ↓
Next.js API route receives request
        ↓
OpenAI creates an embedding for the question
        ↓
Astra DB finds similar anime content
        ↓
Relevant context is added to the prompt
        ↓
OpenAI generates a response
        ↓
Response streams back to the chat UI
```

---

## Environment Variables

Create a `.env` file in the root of the project:

```env
ASTRA_DB_NAMESPACE=your_astra_namespace
ASTRA_DB_COLLECTION=your_collection_name
ASTRA_DB_API_ENDPOINT=your_astra_api_endpoint
ASTRA_DB_APPLICATION_TOKEN=your_astra_application_token
OPENAI_API_KEY=your_openai_api_key
```

### Environment Variable Details

| Variable | Description |
|---|---|
| `ASTRA_DB_NAMESPACE` | Astra DB namespace/keyspace |
| `ASTRA_DB_COLLECTION` | Collection used to store anime vectors |
| `ASTRA_DB_API_ENDPOINT` | Astra DB API endpoint |
| `ASTRA_DB_APPLICATION_TOKEN` | Astra DB authentication token |
| `OPENAI_API_KEY` | OpenAI API key for embeddings and chat responses |

---

## Installation

Clone the project:

```bash
git clone <repository-url>
```

Go into the project folder:

```bash
cd anime-chatbot-gpt/nextjs-animegpt
```

Install dependencies:

```bash
npm install
```

---

## Running the Development Server

Start the app locally:

```bash
npm run dev
```

Open the app in your browser:

```txt
http://localhost:3000
```

---

## Loading Anime Data

To scrape anime data, create embeddings, and store them in Astra DB, run:

```bash
npm run seed
```

This command runs:

```txt
scripts/loadDb.ts
```

The seed script:

1. Opens anime-related websites
2. Extracts page text
3. Splits the text into chunks
4. Creates OpenAI embeddings
5. Saves the chunks and vectors into Astra DB

---

## Using the App

Once the development server is running, open the app and ask anime-related questions.

Example prompts:

```txt
Recommend me an anime like Solo Leveling
```

```txt
What are the best anime for beginners?
```

```txt
Give me a spoiler-free explanation of One Piece
```

```txt
Suggest a short anime I can finish quickly
```

```txt
What should I watch after Demon Slayer?
```

---

## Main Files

### `app/page.tsx`

The main chatbot page.

It handles:

- Chat UI
- User input
- Message rendering
- Prompt suggestions
- Loading state

---

### `app/api/chat/route.ts`

The backend API route for the chatbot.

It handles:

- Receiving user messages
- Creating embeddings
- Searching Astra DB
- Building the AI prompt
- Streaming the OpenAI response

---

### `scripts/loadDb.ts`

The database loading script.

It handles:

- Scraping anime websites
- Cleaning text
- Splitting text into chunks
- Creating embeddings
- Storing data in Astra DB

---

### `app/components/Bubble.tsx`

Displays individual chat messages.

It separates user messages from assistant messages using different styles.

---

### `app/components/LoadingBubble.tsx`

Shows a loading animation while the assistant is generating a response.

---

### `app/components/PromptSuggestionsRow.tsx`

Displays suggested prompts for users when the chat is empty.

---

### `app/components/PromptSuggestionButton.tsx`

Reusable button component for each suggested prompt.

---

## Styling

The app uses custom CSS in:

```txt
app/global.css
```

The design includes:

- Anime-inspired background
- Rounded chat container
- User and assistant message bubbles
- Prompt suggestion buttons
- Loading animation
- Clean, centered layout

---

## Deployment

This app can be deployed on Vercel.

### Deployment Steps

1. Push the project to GitHub.
2. Go to Vercel.
3. Import the GitHub repository.
4. Add the required environment variables.
5. Deploy the project.

Make sure these variables are added in the Vercel dashboard:

```env
ASTRA_DB_NAMESPACE
ASTRA_DB_COLLECTION
ASTRA_DB_API_ENDPOINT
ASTRA_DB_APPLICATION_TOKEN
OPENAI_API_KEY
```

---

## Notes

- This is a personal project created for learning and experimentation.
- The chatbot is not an official anime database.
- The quality of answers depends on the quality of the scraped and stored data.
- Some websites may block scraping or return limited content.
- API-based anime data sources are usually more reliable than scraping normal web pages.
- The app is designed to avoid spoilers unless the user clearly asks for them.

---

## Troubleshooting

### Missing Environment Variables

If the app throws an environment variable error, check that your `.env` file exists and contains all required values.

---

### Chat Response Not Showing

Check the following:

- The API route exists at `app/api/chat/route.ts`
- The OpenAI API key is valid
- The browser console has no frontend errors
- The terminal has no backend errors
- The AI SDK version matches your code

---

### Astra DB Connection Error

Verify:

- Your Astra DB API endpoint
- Your application token
- Your namespace
- Your collection name

---

### Seed Script Not Working

Make sure you are running the command from the project root:

```bash
npm run seed
```

Also check that:

- `scripts/loadDb.ts` exists
- Puppeteer is installed
- OpenAI API key is valid
- Astra DB credentials are correct

---

### Scraping Issues

Some websites may block automated scraping.

Possible fixes:

- Use fewer websites
- Use websites with simpler public pages
- Add better error handling
- Prefer official APIs where possible

---

### TypeScript Import Errors

If imports like `useChat`, `OpenAIStream`, or `StreamingTextResponse` fail, check your AI SDK version.

For the older tutorial-style code, the project should use a compatible older version of the AI SDK.

---

## Future Improvements

- Add user authentication
- Save chat history
- Add anime images and posters
- Add voice input
- Add dark mode
- Add spoiler-safe mode toggle
- Improve mobile responsiveness
- Add better anime APIs
- Add source citations in answers
- Improve scraped data cleaning
- Add genre and mood filters
- Add anime watchlist features

---

## Project Status

AnimeGPT is currently a personal learning project focused on building a full-stack AI chatbot with RAG.

The main goal of the project is to practice:

- AI application development
- Retrieval-Augmented Generation
- Vector databases
- API routes in Next.js
- Chat UI development
- Data scraping and embedding workflows

## License

This project is licensed under the **MIT License**.

You are free to use, modify, and distribute this project for personal or educational purposes.

See the `LICENSE` file for more details.