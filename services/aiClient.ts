// services/aiClient.ts
import { Ingredient } from "../types";
import { generateRecipeImage as generateImage } from "./geminiService";

/**
 * For now, AI runs on the backend via /api/image.
 * We keep this file so RecipeEditor can stay clean and stable.
 */
export async function generateRecipeImage(
  title: string,
  ingredients: Ingredient[]
): Promise<string | null> {
  // Pass null as legacy ai param (ignored in geminiService)
  return generateImage(null, title, ingredients);
}
