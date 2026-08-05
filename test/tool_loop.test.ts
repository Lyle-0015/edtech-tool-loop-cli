import assert from "node:assert/strict";
import test from "node:test";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { runToolLoop, type ToolLoopClient } from "../src/tool_loop.ts";

test("appends the assistant call before its tool result", async () => {
  const observed: ChatCompletionMessageParam[][] = [];
  let requestCount = 0;
  const client: ToolLoopClient = {
    chat: {
      completions: {
        async create(request) {
          observed.push(structuredClone(request.messages));
          requestCount += 1;
          if (requestCount === 1) {
            return {
              choices: [
                {
                  message: {
                    role: "assistant",
                    content: null,
                    refusal: null,
                    tool_calls: [
                      {
                        id: "call-1",
                        type: "function",
                        function: {
                          name: "get_student_progress",
                          arguments: '{"student_id":"stu-104"}',
                        },
                      },
                    ],
                  },
                },
              ],
            };
          }
          return {
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "Check-in queued.",
                  refusal: null,
                },
              },
            ],
          };
        },
      },
    },
  };

  const answer = await runToolLoop(
    client,
    [{ role: "user", content: "Triage stu-104." }],
    [],
    {
      async get_student_progress() {
        return '{"missingAssignments":2}';
      },
    },
  );

  assert.equal(answer, "Check-in queued.");
  assert.equal(observed.length, 2);
  assert.equal(observed[1]?.[1]?.role, "assistant");
  assert.deepEqual(observed[1]?.[2], {
    role: "tool",
    tool_call_id: "call-1",
    content: '{"missingAssignments":2}',
  });
});
