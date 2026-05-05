// Importing the DataAPIClient from Astra DB SDK for database operations
import { DataAPIClient } from "@datastax/astra-db-ts";

// Importing OpenAI SDK for generating embeddings and handling AI interactions
import OpenAI from "openai";

// Importing a utility to split large text into smaller chunks for processing
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

// Importing Puppeteer-based web scraper for extracting data from anime websites
import { PuppeteerWebBaseLoader } from "langchain/document_loaders/web/puppeteer";

// Loading environment variables from .env file
import "dotenv/config";

// Define the similarity metrics used for vector search in the database
type SimilarityMetric = "dot_product" | "cosine" | "euclidean";

// Destructuring environment variables for database and OpenAI configuration
const { ASTRA_DB_NAMESPACE,
        ASTRA_DB_COLLECTION,
        ASTRA_DB_API_ENDPOINT,
        ASTRA_DB_APPLICATION_TOKEN,
        OPENAI_API_KEY } = process.env;

// Initialize OpenAI client with the API key
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// List of anime-related websites to scrape data from
const AnimeData = [
  "https://www.animenewsnetwork.com/news/",
  "https://www.animenewsnetwork.com/review/",
  "https://www.animenewsnetwork.com/interest/",
  "https://www.livechart.me/",
  "https://www.livechart.me/schedule",
  "https://www.anime-planet.com/anime/",
  "https://www.anime-planet.com/anime/all",
  "https://www.animefillerlist.com/shows",
  "https://www.animefillerlist.com/shows/one-piece",
  "https://www.animefillerlist.com/shows/naruto-shippuden",
  "https://www.animefillerlist.com/shows/bleach",
  "https://www.animefillerlist.com/shows/dragon-ball-z",
  "https://www.animefillerlist.com/shows/fairy-tail",
  "https://www.cbr.com/anime/",
  "https://screenrant.com/anime/",
  "https://gamerant.com/anime/",
  "https://www.behindthevoiceactors.com/tv-shows/"
];

// Initialize Astra DB client and connect to the database
const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, {namespace: ASTRA_DB_NAMESPACE});

// Configure the text splitter to divide large text into smaller chunks for embedding
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512, 
  chunkOverlap: 100
});

// Function to create a collection in Astra DB with vector search capabilities
const createCollection = async (similarityMetric: SimilarityMetric='dot_product') => {
    const res = await db.createCollection(ASTRA_DB_COLLECTION, {
        vector: {
            dimension: 1536, // Number of dimensions in the embedding vector
            metric: similarityMetric // Similarity metric for vector search
        }
    });
    console.log(res);
}

// Function to scrape anime data, generate embeddings, and store them in the database
const loadSampleData = async () => {
    const collection = await db.collection(ASTRA_DB_COLLECTION);
    for await (const url of AnimeData) {
        // Scrape the content of the anime website
        const content = await scrapePage(url);

        // Split the content into smaller chunks for embedding
        const chunks = await splitter.splitText(content);

        for await (const chunk of chunks) {
            // Generate embedding for each text chunk using OpenAI
            const embedding = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: chunk,
                encoding_format: "float"
            });

            // Extract the embedding vector and store it in the database
            const vector = embedding.data[0].embedding;
            const res = await collection.insertOne({
                $vector: vector,
                text: chunk
            });
            console.log(res);
        }
    }
}

// Function to scrape a webpage and return its text content
const scrapePage = async (url: string) => {
    const loader = new PuppeteerWebBaseLoader(url, {
        launchOptions: {
            headless: true, // Run Puppeteer in headless mode
        },
        gotoOptions: {
            waitUntil: "domcontentloaded" // Wait until the DOM content is fully loaded
        }
    });

    // Extract the page content and clean it by removing HTML tags
    return (await loader.scrape())?.replace(/<[^>]*>?/gm, '');
}

// Create the collection and load the sample data into the database
createCollection().then(() => { loadSampleData() });
