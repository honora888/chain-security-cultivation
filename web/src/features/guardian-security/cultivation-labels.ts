import type { ElementName, RealmName } from "./analysis-types";

export const CULTIVATION_ELEMENT_VALUES = [
  "Metal",
  "Wood",
  "Water",
  "Fire",
  "Earth",
] as const satisfies readonly ElementName[];

export const CULTIVATION_REALM_VALUES = [
  "Qi Refining",
  "Foundation Establishment",
  "Core Formation",
  "Nascent Soul",
  "Spirit Transformation",
  "Mahayana",
  "Tribulation",
] as const satisfies readonly RealmName[];

const ELEMENT_LABELS: Readonly<Record<ElementName, string>> = {
  Metal: "金",
  Wood: "木",
  Water: "水",
  Fire: "火",
  Earth: "土",
};

const REALM_LABELS: Readonly<Record<RealmName, string>> = {
  "Qi Refining": "练气期",
  "Foundation Establishment": "筑基期",
  "Core Formation": "金丹期",
  "Nascent Soul": "元婴期",
  "Spirit Transformation": "化神期",
  Mahayana: "大乘期",
  Tribulation: "渡劫期",
};

export function isCultivationElement(value: unknown): value is ElementName {
  return typeof value === "string" && CULTIVATION_ELEMENT_VALUES.includes(value as ElementName);
}

export function isCultivationRealm(value: unknown): value is RealmName {
  return typeof value === "string" && CULTIVATION_REALM_VALUES.includes(value as RealmName);
}

export function cultivationElementLabel(element: ElementName): string {
  return ELEMENT_LABELS[element];
}

export function cultivationRealmLabel(realm: RealmName): string {
  return REALM_LABELS[realm];
}
