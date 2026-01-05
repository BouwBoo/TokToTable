// services/aiClient.ts
import { GoogleGenAI } from "@google/genai";
import { Ingredient } from "../types";
import { generateRecipeImage as generateImage } from "./geminiService";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("Missing API_KEY for AI client");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export async function generateRecipeImage(
  title: string,
  ingredients: Ingredient[]
): Promise<string | null> {
  const ai = getClient();
  return generateImage(ai, title, ingredients);
}
