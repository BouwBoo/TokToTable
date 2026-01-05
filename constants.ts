
import { Recipe } from './types';

export const MOCK_RECIPES: Recipe[] = [
  {
    id: '1',
    title: '5-Minute Garlic Butter Pasta',
    source_url: 'https://www.tiktok.com/@foodie/video/1',
    creator: '@chef_papi',
    thumbnail_url: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&q=80',
    ingredients: [
      { name: 'Spaghetti', quantity: 200, unit: 'g', raw_text: '200g spaghetti' },
      { name: 'Garlic', quantity: 4, unit: 'cloves', raw_text: '4 cloves of garlic' },
      { name: 'Butter', quantity: 50, unit: 'g', raw_text: '50g butter' }
    ],
    steps: [
      { step_number: 1, instruction: 'Boil pasta in salted water.', timestamp_start: 0, timestamp_end: 10 },
      { step_number: 2, instruction: 'Sauté minced garlic in butter until fragrant.', timestamp_start: 10, timestamp_end: 30 },
      { step_number: 3, instruction: 'Toss pasta in the garlic butter.', timestamp_start: 30, timestamp_end: 45 }
    ],
    status: 'validated',
    created_at: new Date().toISOString(),
    rating: 4.8,
    likes: 124,
    comments: [
      { id: 'c1', user: 'PastaLover', text: 'So quick and delicious!', date: new Date().toISOString() }
    ]
  },
  {
    id: '2',
    title: 'Crispy Smashed Potatoes',
    source_url: 'https://www.tiktok.com/@potato_king/video/2',
    creator: '@potato_king',
    thumbnail_url: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80',
    ingredients: [
      { name: 'Baby Potatoes', quantity: 1, unit: 'lb', raw_text: '1 lb baby potatoes' },
      { name: 'Olive Oil', quantity: 2, unit: 'tbsp', raw_text: '2 tbsp olive oil' }
    ],
    steps: [
      { step_number: 1, instruction: 'Boil potatoes until tender.', timestamp_start: 0, timestamp_end: 20 },
      { step_number: 2, instruction: 'Smash them flat on a baking sheet.', timestamp_start: 20, timestamp_end: 40 },
      { step_number: 3, instruction: 'Drizzle oil and bake at 400F until crispy.', timestamp_start: 40, timestamp_end: 60 }
    ],
    status: 'extracted',
    created_at: new Date().toISOString(),
    rating: 4.5,
    likes: 89
  },
  {
    id: '3',
    title: 'Honey Garlic Salmon',
    source_url: 'https://www.tiktok.com/@seafood_master/video/3',
    creator: '@fish_fanatic',
    thumbnail_url: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80',
    ingredients: [
      { name: 'Salmon Fillets', quantity: 2, unit: 'pcs', raw_text: '2 salmon fillets' },
      { name: 'Honey', quantity: 3, unit: 'tbsp', raw_text: '3 tbsp honey' },
      { name: 'Soy Sauce', quantity: 1, unit: 'tbsp', raw_text: '1 tbsp soy sauce' }
    ],
    steps: [
      { step_number: 1, instruction: 'Season salmon and sear in a pan.', timestamp_start: 0, timestamp_end: 15 },
      { step_number: 2, instruction: 'Mix honey and soy sauce, pour over salmon.', timestamp_start: 15, timestamp_end: 35 },
      { step_number: 3, instruction: 'Glaze until thick and sticky.', timestamp_start: 35, timestamp_end: 50 }
    ],
    status: 'validated',
    created_at: new Date().toISOString(),
    rating: 5.0,
    likes: 245
  }
];

export const SYSTEM_INSTRUCTION = `
You are a culinary AI specialist. Your job is to take raw text data extracted from a food video (OCR and Speech-to-Text) and synthesize it into a clean, structured JSON recipe format.
Follow this schema:
{
  "title": "string",
  "ingredients": [{ "name": "string", "quantity": "string", "unit": "string", "raw_text": "string" }],
  "steps": [{ "step_number": number, "instruction": "string" }]
}
Ensure quantities are separated from units where possible. If a piece of data is missing, make a best guess based on culinary logic.
`;
