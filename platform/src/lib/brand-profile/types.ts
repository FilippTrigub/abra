export interface BrandProfileInput {
  brandDescription: string;
}

export interface BrandProfile extends BrandProfileInput {
  markdown: string;
  completedAt: string | null;
  updatedAt: string | null;
}
