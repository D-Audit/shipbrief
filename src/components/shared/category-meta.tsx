import type { Tone } from "@/lib/tones";

/**
 * Release categories. Only "Feature" carries the rose accent; everything else
 * reads in neutral ink so lists stay calm.
 */
const categories: Record<string, Tone> = {
  feature: "rose",
};

export function categoryMeta(category: string) {
  return { tone: categories[category.toLowerCase()] ?? ("neutral" as Tone) };
}
