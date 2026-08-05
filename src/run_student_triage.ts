import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { createInfraiClient, runToolLoop } from "./tool_loop.ts";

type Student = {
  id: string;
  name: string;
  missingAssignments: number;
  quizAverage: number;
};

const roster: Student[] = [
  { id: "stu-104", name: "Mina", missingAssignments: 2, quizAverage: 68 },
  { id: "stu-219", name: "Owen", missingAssignments: 0, quizAverage: 91 },
];

const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_student_progress",
      description: "Read assignment and quiz progress for one student.",
      parameters: {
        type: "object",
        properties: {
          student_id: { type: "string", description: "Roster student ID" },
        },
        required: ["student_id"],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "queue_tutor_checkin",
      description: "Queue a tutor check-in for a student.",
      parameters: {
        type: "object",
        properties: {
          student_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["student_id", "reason"],
        additionalProperties: false,
      },
      strict: true,
    },
  },
];

function parseObject(argumentsJson: string): Record<string, unknown> {
  const value: unknown = JSON.parse(argumentsJson);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Tool arguments must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

const handlers = {
  async get_student_progress(argumentsJson: string): Promise<string> {
    const input = parseObject(argumentsJson);
    const student = roster.find((item) => item.id === input.student_id);
    if (!student) {
      return JSON.stringify({ found: false });
    }
    return JSON.stringify({ found: true, student });
  },
  async queue_tutor_checkin(argumentsJson: string): Promise<string> {
    const input = parseObject(argumentsJson);
    if (typeof input.student_id !== "string" || typeof input.reason !== "string") {
      throw new Error("student_id and reason must be strings.");
    }
    const jobId = `checkin-${input.student_id}`;
    return JSON.stringify({ queued: true, job_id: jobId });
  },
};

const studentId = process.argv[2] ?? "stu-104";
const result = await runToolLoop(
  createInfraiClient(),
  [
    {
      role: "system",
      content:
        "You coordinate student support. Inspect progress, queue a tutor check-in when assignments are missing or the quiz average is below 70, then summarize the action.",
    },
    { role: "user", content: `Triage student ${studentId}.` },
  ],
  tools,
  handlers,
);

console.log(result);
