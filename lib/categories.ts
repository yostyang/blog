export const CATEGORIES = [
  {
    name: "电车出行",
    description: "新能源车的选车、用车、充电和长途记录。",
  },
  {
    name: "跑步",
    description: "从入门到比赛的跑步训练、跑量和恢复记录。",
  },
  {
    name: "中年成长",
    description: "工作、家庭与自我认识里的中年成长笔记。",
  },
  {
    name: "生活随笔",
    description: "柴米油盐、亲子日常和一时的所想所感。",
  },
] as const;

export type CategoryName = (typeof CATEGORIES)[number]["name"];

export function isCategory(value: string): value is CategoryName {
  return CATEGORIES.some((category) => category.name === value);
}

export function getCategory(name: string) {
  return CATEGORIES.find((category) => category.name === name);
}
