
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

export type ProcessingState = 'idle' | 'fetching' | 'analyzing' | 'synthesizing' | 'complete' | 'error';
