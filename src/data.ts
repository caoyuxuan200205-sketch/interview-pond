import type { InterviewFacts } from "./ai-types";

export type Fish = {
  id: string;
  name: string;
  role: string;
  category: string;
  rarity: string;
  traits: string[];
  quote: string;
  description: string;
  readonly sprite: number;
  readonly skin?: number;
  company?: string;
  date?: string;
  notes?: string;
  interview?: InterviewFacts;
  createdAt?: string;
  ai?: { model: string; generatedAt: string };
};

export const initialFish: Fish[] = [
  {
    id: "bai",
    name: "阿白",
    role: "产品经理",
    category: "产品",
    rarity: "R",
    traits: ["好奇", "快速学习", "细节控"],
    quote: "每一个好问题，都值得一颗气泡。",
    description:
      "总是第一个发现新鲜事，也总愿意认真听完每一个想法。它相信，好产品从理解彼此开始。",
    sprite: 0,
  },
  {
    id: "lan",
    name: "阿蓝",
    role: "后端工程师",
    category: "技术",
    rarity: "SR",
    traits: ["理性思维", "追求严谨", "逻辑强"],
    quote: "代码要优雅，方案要靠谱！",
    description:
      "后端工程师，逻辑严谨、注重系统性，喜欢把复杂问题拆解成清晰的技术方案。",
    sprite: 1,
  },
  {
    id: "cheng",
    name: "阿橙",
    role: "前端工程师",
    category: "技术",
    rarity: "SR",
    traits: ["热情", "坚持体验", "执行力"],
    quote: "让每一次点击，都有一点惊喜。",
    description:
      "对用户体验充满热情，总能从细节里发现更好的可能。虽然偶尔急躁，却始终愿意为好想法行动。",
    sprite: 2,
  },
  {
    id: "zi",
    name: "阿紫",
    role: "数据分析师",
    category: "产品",
    rarity: "R",
    traits: ["内敛", "深度思考", "分析力"],
    quote: "安静一点，数据正在说话。",
    description:
      "喜欢在静思洞窟阅读和记录。它的发言不多，但总能从纷乱的信息中找到值得关注的线索。",
    sprite: 3,
  },
  {
    id: "fan",
    name: "阿帆",
    role: "运营",
    category: "运营",
    rarity: "R",
    traits: ["活泼", "擅长连接", "推进快"],
    quote: "一起试试，说不定就成了！",
    description:
      "鱼塘里的社交小能手，带着公文包游遍每一个角落，把独立的想法连接成共同的计划。",
    sprite: 4,
  },
  {
    id: "yue",
    name: "阿悦",
    role: "HR",
    category: "HR",
    rarity: "R",
    traits: ["温暖", "善于倾听", "同理心"],
    quote: "你可以慢慢说，我在听。",
    description:
      "善于发现伙伴细微的情绪变化，相信每条鱼都值得被理解，也常常成为争论中的调解者。",
    sprite: 5,
  },
  {
    id: "zhe",
    name: "阿哲",
    role: "技术面试官",
    category: "技术",
    rarity: "SR",
    traits: ["技术钻研", "务实", "挑战难题"],
    quote: "这个问题，还能再深入一层。",
    description:
      "墨镜背后藏着一颗好奇的心。它对技术有很高的标准，也乐于分享解决问题的方法。",
    sprite: 6,
  },
  {
    id: "hai",
    name: "阿海",
    role: "产品负责人",
    category: "产品",
    rarity: "SSR",
    traits: ["全局视野", "战略思考", "创新"],
    quote: "往远处游一点，答案会不一样。",
    description:
      "圆滚滚的外表下，是对整个鱼塘未来的认真思考。善于发现机会，也愿意给新人试错的空间。",
    sprite: 7,
  },
  {
    id: "lan-green",
    name: "阿岚",
    role: "增长运营",
    category: "运营",
    rarity: "R",
    traits: ["灵活", "资源整合", "抗压强"],
    quote: "水流变了，我们也可以换条路。",
    description: "轻快灵活，擅长在变化中寻找新的方向，是伙伴们信赖的行动派。",
    sprite: 8,
  },
  {
    id: "xing",
    name: "阿星",
    role: "算法工程师",
    category: "技术",
    rarity: "SSR",
    traits: ["极客", "热爱探索", "创造力"],
    quote: "再大胆一点，去发现未知的水域。",
    description:
      "对未知充满好奇，常常带来令人意想不到的新点子。身上的星光，是每次探索留下的印记。",
    sprite: 9,
  },
  {
    id: "tang",
    name: "阿糖",
    role: "人才发展",
    category: "HR",
    rarity: "SR",
    traits: ["耐心", "组织力", "关注成长"],
    quote: "每一点成长，都值得被看见。",
    description:
      "温柔而坚定，喜欢陪伴伙伴找到自己的节奏，让每条鱼都能在合适的水域发光。",
    sprite: 10,
  },
  {
    id: "qiao",
    name: "阿礁",
    role: "项目运营",
    category: "运营",
    rarity: "R",
    traits: ["稳健", "落地执行", "团队协作"],
    quote: "慢一点也没关系，我们一直在前进。",
    description:
      "背着可靠的小小龟壳，把每一个计划稳稳地推向终点。大家都喜欢和它一起做事。",
    sprite: 11,
  },
];

export type PondEvent = {
  id: string;
  time: string;
  title: string;
  type: string;
  members: string[];
  summary: string;
  dialogue: [string, string][];
};
export const events: PondEvent[] = [
  {
    id: "arrival",
    time: "10:39",
    title: "新鱼入缸",
    type: "里程碑",
    members: ["fan"],
    summary:
      "阿帆带着新的面试记忆加入鱼塘。阿白带它参观珊瑚社交区，大家一起欢迎了新伙伴。",
    dialogue: [
      ["fan", "大家好！这里比我想象中还热闹。"],
      ["bai", "欢迎来到鱼塘！我带你去看看气泡广场。"],
    ],
  },
  {
    id: "debate",
    time: "10:28",
    title: "阿蓝与阿橙发生争论",
    type: "冲突讨论",
    members: ["lan", "cheng"],
    summary:
      "围绕“技术实现 vs 用户体验”展开讨论。双方最终决定先做小范围 A/B 测试，在保证稳定性的前提下改善体验。",
    dialogue: [
      ["lan", "我们需要先确保系统的稳定性，不能为了体验牺牲可靠性。"],
      ["cheng", "但用户体验也很重要啊！如果交互不够流畅，面试体验会大打折扣！"],
      ["lan", "我不是反对优化体验，只是想先评估风险，再分阶段迭代。"],
      ["cheng", "好吧…那我们可以先做一个小范围的 A/B 测试，你看如何？"],
    ],
  },
  {
    id: "mood",
    time: "09:46",
    title: "阿悦观察到异常情绪",
    type: "情绪观察",
    members: ["yue", "fan"],
    summary:
      "阿悦发现阿帆有些紧张，邀请它一起散步。一次认真倾听，让新来的伙伴多了一份归属感。",
    dialogue: [
      ["yue", "刚来这里，是不是还不太习惯？"],
      ["fan", "有一点。不过能和你聊聊天，我好多了。"],
    ],
  },
  {
    id: "council",
    time: "09:15",
    title: "鱼群议会开启",
    type: "群体决策",
    members: ["bai", "lan", "cheng"],
    summary:
      "本期议题为“如何提升面试通过率”。鱼群讨论了模拟练习、项目复盘和表达边界，并邀请塘主参与。",
    dialogue: [
      ["bai", "今天我们聊聊，什么样的练习真正有帮助。"],
      ["lan", "我投项目深挖一票，先把经历里的逻辑讲清楚。"],
      ["cheng", "也别忘了，面试是一次双向选择。"],
    ],
  },
  {
    id: "practice",
    time: "08:30",
    title: "阿紫独自练习自我介绍",
    type: "成长练习",
    members: ["zi"],
    summary: "阿紫在静思洞窟练习自我介绍，尝试用一个具体案例讲清自己的贡献。",
    dialogue: [
      ["zi", "先讲问题，再讲我的行动，最后说结果。这样好像清晰多了。"],
    ],
  },
  {
    id: "review",
    time: "昨天 21:08",
    title: "鱼塘例行复盘",
    type: "复盘总结",
    members: ["bai", "lan", "cheng"],
    summary:
      "鱼群回顾一天的互动，记录有价值的分歧与合作，约定给彼此更多表达的时间。",
    dialogue: [
      ["bai", "今天最有意思的，是我们发现彼此想要的结果其实一样。"],
      ["cheng", "明天继续试试新的方法吧！"],
    ],
  },
];

export const links = [
  { a: "zi", b: "lan", kind: "友谊", value: 86, color: "#ffa1ce" },
  { a: "lan", b: "cheng", kind: "竞争", value: 72, color: "#ff987f" },
  { a: "bai", b: "zhe", kind: "合作", value: 68, color: "#9bd7ff" },
  { a: "bai", b: "lan", kind: "信任", value: 74, color: "#b7eab0" },
  { a: "lan", b: "cheng", kind: "合作", value: 88, color: "#9bd7ff" },
  { a: "cheng", b: "yue", kind: "友谊", value: 76, color: "#ffa1ce" },
  { a: "fan", b: "lan", kind: "合作", value: 82, color: "#9bd7ff" },
  { a: "zi", b: "fan", kind: "暧昧", value: 34, color: "#eda4f1" },
  { a: "fan", b: "yue", kind: "信任", value: 78, color: "#b7eab0" },
  { a: "cheng", b: "zhe", kind: "竞争", value: 60, color: "#ff987f" },
];
