export const interviewFields = [
  ["company", "公司名称"],
  ["role", "面试岗位"],
  ["department", "面试部门"],
  ["date", "面试日期"],
  ["time", "面试时间"],
  ["round", "面试轮次"],
  ["format", "面试形式"],
  ["location", "地点"],
  ["interviewer", "面试官"],
  ["topics", "准备重点"],
  ["experience", "面试经历"],
  ["feelings", "当下感受"],
  ["expectations", "你的期待"],
  ["outcome", "面试结果"],
] as const;
export type InterviewField = (typeof interviewFields)[number][0];
export type InterviewFacts = Record<InterviewField, string>;
export type ClarificationQuestion = { id: string; field: InterviewField; title: string; hint: string; options: string[] };
export type AiDraft = {
  message: string;
  questions: ClarificationQuestion[];
  uncertainties: string[];
  interview: InterviewFacts;
  fish: {
    name: string;
    category: string;
    sprite: number;
    skin?: number;
    traits: string[];
    quote: string;
    description: string;
  };
  model: string;
  generatedAt: string;
};
export type InterviewMessage = {
  role: "user" | "assistant";
  text: string;
  images?: string[];
  display?: string;
  questions?: ClarificationQuestion[];
};
