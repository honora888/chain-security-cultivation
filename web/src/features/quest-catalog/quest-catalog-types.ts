export type QuestCatalogCategory =
  | "Metal"
  | "Wood"
  | "Water"
  | "Fire"
  | "Earth"
  | "Rare";

export type FiveElement = "Metal" | "Wood" | "Water" | "Fire" | "Earth";

export type RareAttribute =
  | "Lightning"
  | "Chaos"
  | "Void"
  | "Temporal"
  | "Spatial"
  | "Other";

export type QuestCatalogStatus = "open" | "reviewing" | "locked";

export interface QuestCatalogItem {
  id: string;
  questNumber: number;
  title: string;
  formalType: string;
  category: QuestCatalogCategory;
  primaryElement?: FiveElement;
  secondaryElements?: readonly FiveElement[];
  rareAttributes?: readonly RareAttribute[];
  realm: string;
  realmLabel: string;
  severity: string;
  status: QuestCatalogStatus;
  href: string;
  summary: string;
  learningPath: readonly string[];
}

export interface QuestRealmDefinition {
  id: QuestCatalogCategory;
  label: string;
  englishLabel: string;
  eyebrow: string;
  keywords: string;
  description: string;
}

