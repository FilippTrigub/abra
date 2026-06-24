export interface BrandProfileInput {
  brandName: string;
  audience: string;
  offer: string;
  voice: string;
  differentiators: string;
  sourceNotes: string;
}

export interface BrandProfile extends BrandProfileInput {
  markdown: string;
  completedAt: string | null;
  updatedAt: string | null;
}
