
import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";

/**
 * Genereert een professionele culinaire foto op basis van het recept.
 */
export const generateRecipeImage = async (ai: any, title: string, ingredients: any[]) => {
  try {
    const ingredientList = ingredients.map(i => i.name).slice(0, 5).join(", ");
    const prompt = `Professional food photography of ${title}, containing ${ingredientList}. 
    High-end restaurant plating, macro shot, soft cinematic lighting, 8k resolution, appetizing, 
    shallow depth of field, vibrant colors, steam rising if hot dish.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        imageConfig: {
          aspectRatio: "3:4"
        }
      }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (error) {
    console.error("Image generation failed:", error);
  }
  return `https://picsum.photos/seed/${encodeURIComponent(title)}/400/600`; // Fallback
};

export const extractRecipeFromUrl = async (url: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    // FASE 1: Tekstuele extractie en grounding via Google Search
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Search for and extract the full recipe details for this TikTok: ${url}. 
      If the creator is @itshelenmelon, prioritize her specific recipe instructions. 
      I need the exact dish title, creator name, ingredients (with quantities), and clear steps.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            creator: { type: Type.STRING },
            ingredients: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  quantity: { type: Type.STRING },
                  unit: { type: Type.STRING },
                  raw_text: { type: Type.STRING }
                },
                required: ["name", "raw_text"]
              }
            },
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  step_number: { type: Type.INTEGER },
                  instruction: { type: Type.STRING }
                },
                required: ["step_number", "instruction"]
              }
            }
          },
          required: ["title", "ingredients", "steps"]
        }
      },
    });

    const result = JSON.parse(response.text || '{}');
    
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      title: chunk.web?.title,
      uri: chunk.web?.uri
    })).filter((s: any) => s.uri) || [];

    if (!result || !result.title) {
      return null;
    }

    // FASE 2: Genereer een realistische afbeelding van het gerecht
    const imageUrl = await generateRecipeImage(ai, result.title, result.ingredients);

    return { 
      ...result, 
      sources,
      thumbnail_url: imageUrl
    };
  } catch (e) {
    console.error("Gemini Extraction Error:", e);
    return null;
  }
};
