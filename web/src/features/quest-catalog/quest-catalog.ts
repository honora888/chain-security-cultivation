import type {
  FiveElement,
  QuestCatalogCategory,
  QuestCatalogItem,
  QuestRealmDefinition,
  RareAttribute,
} from "@/features/quest-catalog/quest-catalog-types";

const FIVE_ELEMENTS = new Set<FiveElement>([
  "Metal",
  "Wood",
  "Water",
  "Fire",
  "Earth",
]);

export const QUEST_REALMS: readonly QuestRealmDefinition[] = [
  {
    id: "Metal",
    label: "金",
    englishLabel: "Metal",
    eyebrow: "METAL REALM",
    keywords: "权限 · 授权 · 签名 · 身份",
    description: "权限、授权、签名、身份与访问控制。",
  },
  {
    id: "Wood",
    label: "木",
    englishLabel: "Wood",
    eyebrow: "WOOD REALM",
    keywords: "生命周期 · 状态机 · 初始化 · 升级",
    description: "生命周期、状态机、初始化、升级与状态迁移。",
  },
  {
    id: "Water",
    label: "水",
    englishLabel: "Water",
    eyebrow: "WATER REALM",
    keywords: "资金流 · 回调 · 转移 · 重入",
    description:
      "资金流、回调、转移与重入。此境异兽常借外部调用之隙，侵入尚未完成的状态变化。",
  },
  {
    id: "Fire",
    label: "火",
    englishLabel: "Fire",
    eyebrow: "FIRE REALM",
    keywords: "价格 · 预言机 · 算术 · 清算",
    description: "价格、预言机、算术、清算与经济攻击。",
  },
  {
    id: "Earth",
    label: "土",
    englishLabel: "Earth",
    eyebrow: "EARTH REALM",
    keywords: "记账 · 余额 · 储备 · 一致性",
    description: "记账、余额、储备与状态一致性。",
  },
  {
    id: "Rare",
    label: "稀有",
    englishLabel: "Rare",
    eyebrow: "RARE REALM",
    keywords: "组合 · 跨机制 · 特殊攻击模型",
    description:
      "收录跨五行、组合型与特殊机制的安全案例。未来可能包含雷电、混沌、虚空、时序与空间等特性。",
  },
] as const;

export const RARE_ATTRIBUTES: readonly {
  id: RareAttribute;
  label: string;
}[] = [
  { id: "Lightning", label: "雷电" },
  { id: "Chaos", label: "混沌" },
  { id: "Void", label: "虚空" },
  { id: "Temporal", label: "时序" },
  { id: "Spatial", label: "空间" },
  { id: "Other", label: "其他" },
] as const;

function assertQuestCatalog(
  items: readonly QuestCatalogItem[],
): readonly QuestCatalogItem[] {
  for (const item of items) {
    if (item.category === "Rare") {
      continue;
    }

    if (!FIVE_ELEMENTS.has(item.category)) {
      throw new Error(`Unsupported Quest category: ${item.category}`);
    }

    if (item.primaryElement !== item.category) {
      throw new Error(
        `Quest ${item.id} must use ${item.category} as its primary element.`,
      );
    }

    if (item.rareAttributes !== undefined && item.rareAttributes.length > 0) {
      throw new Error(
        `Five-element Quest ${item.id} cannot declare rare attributes.`,
      );
    }
  }

  return items;
}

export const QUEST_CATALOG = assertQuestCatalog([
  {
    id: "quest-1-reentrancy",
    questNumber: 1,
    title: "噬灵回环兽",
    formalType: "Classic Reentrancy",
    category: "Water",
    primaryElement: "Water",
    secondaryElements: ["Earth"],
    realm: "Core Formation",
    realmLabel: "金丹期",
    severity: "High",
    status: "open",
    href: "/quests/1",
    summary: "识别外部调用先于状态更新所形成的重入路径。",
    learningPath: [
      "识别危险调用",
      "复现重入攻击",
      "完成 CEI 修复",
      "提交验证证据",
    ],
  },
] as const satisfies readonly QuestCatalogItem[]);

export function questsForCategory(
  category: QuestCatalogCategory,
): readonly QuestCatalogItem[] {
  return QUEST_CATALOG.filter((quest) => quest.category === category);
}

