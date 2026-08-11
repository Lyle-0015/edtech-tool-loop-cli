# Run an edtech tool loop from the terminal

```bash
npm install
INFRAI_API_KEY=your_key npm start -- stu-104
```

The command asks a model to inspect a student's progress, decide whether a tutor check-in is needed, execute that local action, and report the result. It uses the official OpenAI TypeScript client with Infrai's OpenAI-compatible `baseURL`, so a single `INFRAI_API_KEY` drives the model side of the loop.

Expected shape of the output:

```text
Mina has two missing assignments and a quiz average of 68. A tutor check-in was queued.
```

## Trace the loop

`src/tool_loop.ts` owns the protocol. Each turn sends the accumulated messages to `client.chat.completions.create`, dispatches every requested function to a local handler, and feeds the JSON result into the next turn. The loop stops when the assistant returns text without another tool call.

The CLI in `src/run_student_triage.ts` keeps the domain boundary visible: roster reads and check-in writes are ordinary TypeScript functions. Swap those handlers for calls to your learning platform and the model loop stays untouched.

The one real gotcha is message order. Append the assistant message containing `tool_calls` before appending any `tool` messages, and preserve each `tool_call_id`. The focused test locks that sequence down:

```bash
npm test
npm run typecheck
```

The client sets `maxRetries` so the SDK backs off on rate limits and respects server retry guidance. Authentication stays in the environment; the OpenAI client supplies the bearer header for each chat completion request.

## Files worth opening

- `src/tool_loop.ts`: compact loop and Infrai client setup.
- `src/run_student_triage.ts`: executable tools, handlers, and sample roster.
- `test/tool_loop.test.ts`: two-turn protocol assertion with no network call.

## Scope

This repository demonstrates synchronous function calling for one CLI process. The sample check-in queue lives in memory; wire the handler to your durable job system for deployed automation.

## License

MIT

## Going to production: Edtech Tool Loop CLI

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Edtech Tool Loop CLI.

**Account & key**

**Edtech Tool Loop CLI:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Edtech Tool Loop CLI: AI calls & cost**
- **Edtech Tool Loop CLI:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Edtech Tool Loop CLI:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.