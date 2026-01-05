export interface Ingredient {
  name: string;
  normalized_name?: string;
  foodon_id?: string;
  quantity: string | number;
  unit: string;
  raw_text: string;
}

export interface Step {
  step_number: number;
  instruction: string;
  timestamp_start?: number;
  timestamp_end?: number;
}

export interface GroundingSource {
  title?: string;
  uri?: string;
}

export interface Comment {
  id: string;
  user: string;
  text: string;
  date: string;
}

export interface Recipe {
  id: string;
  title: string;
  source_url: string;
  creator: string;
  thumbnail_url: string;
  ingredients: Ingredient[];
  steps: Step[];
  sources?: GroundingSource[];
  status: 'extracted' | 'validated' | 'processing';
  created_at: string;
  rating?: number;
  likes?: number;
  isLiked?: boolean;
  comments?: Comment[];
}

export type PlannerData = Record<string, string[]>; // Day -> Recipe IDs

export type ProcessingState =
  | 'idle'
  | 'fetching'
  | 'analyzing'
  | 'synthesizing'
  | 'complete'
  | 'error';

/**
 * -------------------------
 * Shopping List (v1.1+)
 * -------------------------
 * - Local-first
 * - Deterministic aggregation
 * - Unit normalization where possible
 */

export type ShoppingUnit = 'g' | 'ml' | 'pcs' | string;

export interface ShoppingSourceRef {
  recipeId: string;
  day?: string;
}

/** NEW: exact contribution per recipe/day (after normalization) */
export interface ShoppingPart {
  recipeId: string;
  day?: string;
  quantity: number;
  unit: ShoppingUnit;
}

export interface ShoppingItem {
  id: string;
  ingredientKey: string; // stable normalized key
  label: string; // display label

  /** Aggregated total across ALL parts (canonical where possible) */
  quantity: number;
  unit: ShoppingUnit;

  checked: boolean;

  /** Backwards compat / debug */
  sources: ShoppingSourceRef[];

  /** NEW: breakdown to show per recipe */
  parts: ShoppingPart[];
}

export interface ShoppingList {
  id: string;
  source: 'planner' | 'manual';
  items: ShoppingItem[];
  createdAt: number;
  updatedAt: number;
}
