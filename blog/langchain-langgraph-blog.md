---
title: Everything you need to know about LangChain and LangGraph
date: 2026-06-11
excerpt: This post takes you from "what is an LLM API?" to production agents - step by step, no prior knowledge assumed.
---

# LangChain + LangGraph - Zero to Master

Let me be honest with you upfront: **you do not need to have built an AI app before.** You need basic Python (functions, dicts, maybe a little typing), curiosity, and patience. Everything else - messages, chains, graphs, checkpointers, human-in-the-loop - we build from the ground up in this post.

By the end, you should be able to look at a production agent codebase and know *why* each piece exists, not just copy-paste it.

---

## Who this is for

- You have heard "LangChain" and "LangGraph" but they sound like magic words.
- You tried a tutorial, got a demo working, and then broke something you did not understand.
- You want to **ship** a customer-facing bot, not just win a hackathon notebook.

**What you do NOT need:** a PhD in ML, prior agent experience, or knowledge of every OpenAI API detail.

**What you DO need:** Python 3.10+, an API key from any major LLM provider (OpenAI, Anthropic, Google, etc.), and the willingness to read carefully.

---

## Our running example: Nova Support

Throughout this post, imagine you are building **Nova Support** - a customer support bot for an online store called NovaShop.

Nova Support must:

1. Answer questions from a help-center knowledge base (refund policy, shipping times).
2. Look up a customer's order when they give an email address.
3. Remember what was said earlier in the conversation.
4. Ask a human agent before issuing a refund over $100.
5. Keep working if the server restarts mid-conversation.

Every concept maps to Nova Support. When we talk about RAG, we mean "search the help center." When we talk about tools, we mean `search_orders` and `issue_refund`. When we talk about LangGraph, we mean "the control room that decides when to search, when to ask a human, and when to stop."

---

## Your learning path (read in order)

| Phase | What you learn | Nova Support milestone |
|-------|----------------|------------------------|
| **Intro** (you are here) | Why frameworks exist | Understand the goal |
| **Part 0** | Raw LLM API calls | One question → one answer |
| **Part A** | LangChain building blocks | RAG + tools + memory as chains |
| **Part B** | LangGraph control flow | Loops, persistence, human approval |
| **Part C** | Wiring it together | Full production shape |
| **Glossary + Takeaways** | Vocabulary lock-in | Explain any keyword |
| **Your first week** | Day-by-day practice | Build Nova Support for real |

**How to read:** Do not skim Part A to rush to agents. LangGraph is *LangChain inside nodes*. If messages and Runnables are fuzzy, graphs will feel like black magic. They are not - but the foundation has to be solid.

**Time estimate:** 4–8 hours of focused reading; 10–20 hours if you code along. That is normal. This is a craft, not a TikTok tutorial.

---

## Part 0 - The world before frameworks

Before you touch LangChain, let me explain what you would do **without** it - because that pain is exactly why these libraries exist.

### Plain English: what is an LLM API?

An **LLM** (Large Language Model) is a program trained on text. You send it text; it sends text back. That is the whole contract at the wire level.

A **provider** (OpenAI, Anthropic, etc.) hosts the model and gives you an **API** - an HTTP endpoint your Python code calls. You pay per **token** (roughly word-pieces). Input tokens + output tokens = your bill and your latency.

There is no memory built in. Every call is amnesiac unless **you** resend the conversation history.

### Analogy: a very smart temp worker

Imagine you hire a brilliant temp who forgets everything every time they leave the room. You must hand them a typed briefing sheet every time: "You are a support agent. Here is what the customer said before. Here is today's question."

That briefing sheet is your **prompt**. The temp's reply is the **completion**. LangChain eventually formalizes the briefing sheet as **messages**; LangGraph remembers which briefing sheets belong to which customer.

### Mental walkthrough: Nova Support v0 (raw API)

1. Customer asks: "What is your refund window?"
2. Your Python builds one big string: `"You are Nova Support. Answer politely. Question: What is your refund window?"`
3. You POST that string to the API.
4. You get back: `"Our refund window is 30 days from delivery."`
5. You show that to the customer. Done - for one turn, one question, no tools, no memory.

### The raw call (technical)

```python
from openai import OpenAI

client = OpenAI()
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "You are Nova Support for NovaShop."},
        {"role": "user", "content": "What is your refund window?"},
    ],
)
answer = response.choices[0].message.content
```

**Terms defined:**

| Term | Meaning |
|------|---------|
| `messages` | A list of `{role, content}` dicts - system, user, assistant |
| `system` | Instructions the user never sees - persona and rules |
| `user` | What the customer said |
| `assistant` | What the model said back |

### Pain points that appear by day two

Now Nova Support needs real features. Watch what breaks when you stay "raw":

```
Customer turn 1: "My email is alice@example.com"
Customer turn 2: "Where is my order?"
```

**Pain 1 - No memory unless you build it.** You must store turn 1 somewhere (database, Redis) and manually prepend it to every API call. Forget once → the bot asks for the email again.

**Pain 2 - No tools.** The model cannot query your order database. It will *guess* order status unless you wire function calling yourself: parse JSON tool requests, execute Python, append results, call again.

**Pain 3 - No streaming UX.** Users stare at a spinner for 8 seconds. You implement SSE (Server-Sent Events) by hand.

**Pain 4 - No retries, no fallbacks.** OpenAI returns 429 rate limit → your app crashes unless you write exponential backoff everywhere.

**Pain 5 - Prompt sprawl.** Every feature copy-pastes f-strings. Change the tone in one place → miss three others.

**Pain 6 - No observability.** Something fails in production. You have print statements and prayer.

**Pain 7 - Agents loop forever.** You write `while True: call model; if no tool: break` and forget a max iteration → infinite loop burns budget.

```
┌─────────────────────────────────────────────────────────────┐
│  RAW API APP (what YOU must build)                          │
├─────────────────────────────────────────────────────────────┤
│  HTTP client │ retry │ history DB │ prompt templates        │
│  tool parser │ tool executor │ streaming │ tracing          │
│  agent loop │ human approval │ crash recovery               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
              LangChain = building blocks
              LangGraph   = orchestration + persistence
```

### Beginner mistakes (Part 0)

1. **Trusting the model for facts.** Without RAG or tools, Nova Support will confidently invent refund policies. Models predict plausible text; they do not know your business rules.
2. **Stuffing the entire company wiki into one prompt.** Context windows are large but not free - cost and quality both suffer ("lost in the middle").
3. **Assuming the API remembers the thread.** It does not. *You* are the memory.

### Pause and check - Part 0

1. Why does turn 2 fail if you only send "Where is my order?" with no history?
2. Name three things raw API code forces you to build yourself that LangChain/LangGraph eventually provide.
3. In our analogy, what real-world object is the "briefing sheet"?

<details>
<summary>Answers</summary>

1. The model never saw turn 1; it has no record of alice@example.com.
2. Any three of: message formatting, retries, prompt templates, tool loops, streaming helpers, tracing, persistent multi-turn state, human-in-the-loop pauses.
3. The prompt / message list you send on each API call.

</details>

---

## Part A - LangChain from scratch

**LangChain** (specifically `langchain-core` plus provider packages) gives you standardized **messages**, a universal **Runnable** interface, **prompt templates**, **chains** (LCEL), **tools**, **retrievers**, and parsers - so you stop reinventing glue code.

**LangGraph comes in Part B.** For now, think straight pipelines: input → steps → output.

---

### A1. Messages and the Runnable core

#### Plain English

Real chat apps are not one string in, one string out. They are **conversations** with roles: system instructions, user messages, assistant replies, and (later) tool results injected in the middle.

LangChain represents each turn as a **Message** object. Anything that transforms data - model, prompt, parser, retriever, whole chain - is a **Runnable**: same `.invoke()`, same `.stream()`, same config object.

#### Analogy: a group chat with strict rules

Think of the model as a participant in a group chat. Messages are the chat log. But this group chat has house rules:

- System message = pinned rules at the top.
- Human message = customer spoke.
- AI message = bot spoke (maybe "I want to call search_orders" - that is a tool call).
- Tool message = "here is what search_orders returned."

You cannot send a tool result without the AI having requested it first. The chat app (provider API) rejects malformed logs.

#### Mental walkthrough - Nova Support message list

Turn 1, simple question:

1. Create `SystemMessage("You are Nova Support...")`.
2. Create `HumanMessage("What is the refund window?")`.
3. Pass `[system, human]` to the model Runnable.
4. Get back `AIMessage("Our refund window is 30 days...")`.
5. Append that AI message to the list for the next turn.

Turn 3, with a tool (preview - full detail in A6):

1. ... prior messages ...
2. Model returns `AIMessage` with `tool_calls=[{name: "search_orders", args: {...}, id: "call_abc"}]`.
3. Your code runs the tool → `ToolMessage(content="Order #991: shipped", tool_call_id="call_abc")`.
4. Append AI message, then tool message(s), then call model again.

#### Technical terms

| Type | Produced by | Carries |
|------|-------------|---------|
| `SystemMessage` | You | Persona, rules - usually first |
| `HumanMessage` | User | Text or **content blocks** (text + image for multimodal) |
| `AIMessage` | Model | `content`, optional `tool_calls`, `usage_metadata`, `response_metadata` |
| `ToolMessage` | Your code | Tool result, matched via `tool_call_id` |
| `AIMessageChunk` | Streaming | Partial AI message; chunks merge additively |

**The ordering invariant (burn this in):** every `tool_call` on an `AIMessage` must be answered by a matching `ToolMessage` *before* the next model call. Providers reject malformed sequences. The first time you hand-edit history and get cryptic 400 errors, this is why.

#### Runnable interface

Models, prompts, parsers, retrievers, tools - and compiled LangGraph graphs - all implement **Runnable**:

| Method | Use |
|--------|-----|
| `invoke` / `ainvoke` | One input → one output (sync / async) |
| `stream` / `astream` | Output chunks as produced |
| `batch` / `abatch` | Many inputs in parallel |
| `astream_events` | Fine-grained events from every nested Runnable |

The second argument is **`RunnableConfig`**, and it **propagates automatically** through nested Runnables. That is how tracing callbacks, `thread_id`, metadata, and limits flow from `graph.invoke` down to every model call - without glue code.

**Put in config from day one:**

| Config key | Purpose |
|------------|---------|
| `callbacks` | Observability handlers (LangSmith, etc.) |
| `configurable.thread_id` / `user_id` | Identity (critical once you add LangGraph) |
| `metadata` / `tags` / `run_name` | Filter and debug in traces |
| `max_concurrency` | Batch jobs |
| `recursion_limit` | Graph safety (Part B) |

**Cost model:** one call = one API round-trip; billing scales with **O(input + output tokens)**. Every memory and RAG technique exists to control that number.

```python
from langchain_core.messages import SystemMessage, HumanMessage

msgs = [
    SystemMessage("You are Nova Support. Be concise. Cite help-center sources."),
    HumanMessage("What's the refund window?"),
]
resp = model.invoke(msgs)          # AIMessage
resp.content                       # visible text
resp.usage_metadata                # token counts
msgs.append(resp)                  # history grows
```

#### Beginner mistakes - A1

1. **Treating `AIMessage.content` as always a string.** With tool calls, content may be empty; the action is in `tool_calls`.
2. **Appending messages in wrong order.** Tool messages must follow their AI message; order matters.
3. **Ignoring `RunnableConfig`.** You invoke chains inside nodes later without passing config → broken tracing and lost `thread_id`.

#### Pause and check - A1

1. What message type carries `tool_calls`?
2. What happens if you call the model again before sending a `ToolMessage` for each pending tool call?
3. Why is "everything is a Runnable" useful instead of just calling OpenAI directly?

<details>
<summary>Answers</summary>

1. `AIMessage`.
2. The provider API returns an error - malformed message sequence.
3. Same interface for model, prompt, chain, and graph; config and streaming behave consistently; composition via `|` works everywhere.

</details>

---

### A2. Chat models in depth

#### Plain English

The **chat model** is the Runnable that talks to the provider. You choose which model (GPT-4o, Claude, etc.), set dials like temperature, and get an `AIMessage` back.

The old string-to-string `LLM` class is legacy. **`ChatModel`** (messages in, message out) is the standard.

#### Analogy: a mixing board

Temperature is like jazz vs classical: low = play the same note every time; high = improvise. `max_tokens` is a hard stop on how long the solo can run. `timeout` is "if the band does not start in 30 seconds, leave."

Nova Support uses **temperature 0** for order lookups and refund classification (deterministic). Maybe **0.3** for empathetic wording - but never high randomness when money is involved.

#### Mental walkthrough - picking model settings for Nova Support

1. Extraction task ("classify intent: refund / shipping / other") → `temperature=0`, `max_tokens=50`.
2. Final customer reply with RAG context → `temperature=0`, `max_tokens=800` (room for citations).
3. Wrap model with retry for rate limits.
4. Optional: fallback to a second provider if primary is down - **test that fallback supports your tools**.

#### Technical terms

```python
from langchain_openai import ChatOpenAI
from langchain.chat_models import init_chat_model

model = ChatOpenAI(model="gpt-4o", temperature=0, max_tokens=800, timeout=30)
model = init_chat_model("anthropic:claude-sonnet-4-5", temperature=0)  # swap vendors with a string
```

| Parameter | Effect | Nova Support guidance |
|-----------|--------|----------------------|
| `temperature` | Sampling randomness | **0** for tools, extraction, RAG answers |
| `max_tokens` | Output cap | Always set - too low truncates JSON mid-object |
| `top_p` | Nucleus sampling | Tune *either* this or temperature, not both |
| `stop` | Stop sequences | Cut at delimiters |
| `timeout` / `max_retries` | Network resilience | Tighten for production |

**Reliability decorators (Runnable-level):**

```python
robust = model.with_retry(stop_after_attempt=3)
safe   = primary.with_fallbacks([backup_model])
pinned = model.bind(stop=["\n\n"])
```

- **`with_retry`** - rate limits, 5xx blips
- **`with_fallbacks`** - primary provider down entirely
- **`bind`** - pre-attach kwargs; also how `bind_tools` works
- **`configurable_fields` / `configurable_alternatives`** - swap model per request (A/B tests)

**Cost control:**

1. **LLM cache** - exact-match or semantic (similar prompts → cached answer)
2. **Provider prompt caching** - stable-prefix-first (system + few-shot stable, user content last)
3. **Model routing** - cheap model for easy requests, expensive for hard ones (later: LangGraph conditional edge)

**Multimodal:** `HumanMessage` with content blocks - text + image. Requires vision model; resize images - token cost is substantial.

#### Beginner mistakes - A2

1. **`max_tokens` too small + structured output** → truncated JSON, always unparseable.
2. **Testing only the primary model** - fallback may speak a different tool-calling dialect.
3. **High temperature on tool-calling** - wrong tool args, flaky loops.

#### Pause and check - A2

1. Why temperature=0 for Nova Support's order lookup path?
2. `with_retry` vs `with_fallbacks` - when each?
3. Why set `max_tokens` even when you trust the model?

<details>
<summary>Answers</summary>

1. You want repeatable, correct tool args and classifications - not creative guesses on order IDs.
2. Retry = same model, transient failure. Fallback = switch model/provider after repeated/hard failure.
3. Runaway outputs cost money; truncation breaks structured parsing; caps are a safety rail.

</details>

---

### A3. Prompts - treat them like code

#### Plain English

A **prompt** is not a string you type once. In production it is a **template**: parameterized, validated, composable, versionable. F-strings do not validate variables, do not compose into chains, and do not version.

#### Analogy: Mad Libs with guardrails

`ChatPromptTemplate` is a Mad Libs sheet: `{role}`, `{context}`, `{question}` are blanks. `MessagesPlaceholder("history")` is a slot where you slide in the whole conversation so far. If you forget a variable, it fails at invoke time - not in production at 2 AM.

#### Mental walkthrough - Nova Support RAG prompt

1. System slot: "You are {role}. Answer only from context. Say 'I don't know' if insufficient."
2. History slot: prior turns (memory).
3. Human slot: "Context:\n{context}\n\nQuestion: {question}"
4. At invoke: pass `role="Nova Support"`, `history=[...]`, `context=retrieved_docs`, `question=user_msg`.
5. Template renders to a **list of messages** the model expects.

```python
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a {role}. Use only the provided context. Cite sources."),
    MessagesPlaceholder("history"),
    ("human", "Context:\n{context}\n\nQuestion: {question}"),
])
```

#### Technical terms

| Class | Role |
|-------|------|
| `PromptTemplate` | Single string with `{vars}` - legacy / sub-strings |
| `ChatPromptTemplate` | Multi-message template - **the standard** |
| `MessagesPlaceholder` | Slot for a *list* of messages - **the memory bridge** |
| `FewShotPromptTemplate` | Inject worked examples |

**Few-shot at scale:** use **`SemanticSimilarityExampleSelector`** - embed examples, pick k nearest to current query.

**Mechanics:**

- **`.partial()`** - pre-fill stable vars (e.g. today's date)
- **Escaping** - literal `{` in user content breaks templates; use `{{ }}` or pass user text as a variable
- **External registry** - production prompts fetched by name + label; changing prompt should not require deploy

**Pattern name:** *Parameterized prompt + history placeholder.* Reuse for every chat feature.

#### Beginner mistakes - A3

1. **Putting user input inside template body** - if user text contains `{`, rendering crashes. Pass as variable.
2. **No `MessagesPlaceholder`** - you manually concatenate history strings and break message ordering.
3. **Prompts only in code** - product wants tone change Friday 5 PM; you redeploy.

#### Pause and check - A3

1. What does `MessagesPlaceholder` do that a plain string cannot?
2. Why is stable-prefix-first good for cost?
3. F-string vs template - one concrete advantage of templates?

<details>
<summary>Answers</summary>

1. Inserts a full list of Message objects in the correct positions for the provider.
2. Provider prompt caching discounts repeated long system prefixes; user content changes last.
3. Templates validate required variables at invoke time and compose as Runnables in chains.

</details>

---

### A4. LCEL - composition deep dive

#### Plain English

**LCEL** (LangChain Expression Language) wires Runnables with the pipe operator `|`. `prompt | model | parser` is a **chain**: one callable object.

A dict inside a chain is an implicit **parallel** branch - both arms get the same input.

#### Analogy: an assembly line with a fork

Input box arrives. Fork A grabs the question and fetches help docs. Fork B passes the question through unchanged. Both boxes merge at the prompt station. Model assembles. Parser ships a string.

That is Nova Support's FAQ path before any agent loop.

#### Mental walkthrough - canonical RAG chain

1. Input: `{"question": "Can I return opened items?"}`
2. Parallel branch A: question → retriever → format_docs → `context` string
3. Parallel branch B: question → `question` unchanged
4. Prompt receives `{context, question, history}` → messages
5. Model → AIMessage
6. Parser → string for UI

```python
from operator import itemgetter

chain = (
    {
        "context": itemgetter("question") | retriever | format_docs,
        "question": itemgetter("question"),
    }
    | prompt
    | model
    | parser
)
```

#### Technical terms - combinator zoo

| Combinator | Shape | Use |
|------------|-------|-----|
| `RunnableSequence` | A → B → C | The pipe |
| `RunnableParallel` | one input → `{"a": A(x), "b": B(x)}` | Fan-out; dict literal in chain |
| `RunnablePassthrough` | x → x | Carry original input |
| `.assign(k=...)` | dict → dict + new key | Add computed field |
| `RunnableLambda` | wrap any function | Custom glue |
| `RunnableBranch` | if/else between Runnables | Small local routing - real control flow → LangGraph |
| `itemgetter("k")` | dict → value | Pluck one key |

**Streaming semantics:**

- `chain.stream()` streams the **final** stage; intermediate stages stream *through* when transform-capable
- A **blocking** stage mid-chain (strict JSON parser) **buffers** - UI shows nothing until it finishes
- **`JsonOutputParser`** streams partial objects; **`astream_events`** exposes every internal event

**LCEL's boundary:** LCEL is a **DAG** - forward only. No cycles, no pauses, no evolving shared state. Need a loop, human approval, or state across steps → **LangGraph signal.**

```
Linear + ≤1 branch?  → LCEL
Loops / pauses / evolving state?  → LangGraph
```

#### Beginner mistakes - A4

1. **Shape mismatch** - piping a string into a prompt that expects a dict. #1 beginner error.
2. **Forgetting parallel dict** - you run retriever sequentially twice.
3. **Fighting LCEL to build agent loops** - use LangGraph.

#### Pause and check - A4

1. What does `{"context": branch_a, "question": branch_b}` create implicitly?
2. Why might tokens not appear until the end of a chain?
3. When should you stop using LCEL?

<details>
<summary>Answers</summary>

1. `RunnableParallel` - both branches on same input, merged dict output.
2. A blocking/non-transform parser or stage buffers complete input before emitting.
3. When you need cycles (agent loops), human interrupts, or shared mutable state across steps.

</details>

---

### A5. Structured output and parsing

#### Plain English

Sometimes Nova Support must output **data**, not prose - e.g. `{intent: "refund", order_id: "991", confidence: 0.92}` for your code to route the ticket. If you parse free text with regex, you will lose at scale.

**Structured output** constrains the model to a schema (usually Pydantic) and validates the result.

#### Analogy: a form with required fields

Free text is a blank page. Structured output is a form: Name, Order ID, Reason - each box typed. The model fills the form; Pydantic checks boxes are valid.

#### Mental walkthrough - classify Nova Support ticket

1. Define Pydantic model `TicketIntent` with fields `intent`, `order_id`, `summary`.
2. `extractor = model.with_structured_output(TicketIntent)`.
3. Pass customer message.
4. Get validated object or exception - no regex archaeology.

```python
from pydantic import BaseModel, Field

class TicketIntent(BaseModel):
    intent: str = Field(description="refund | shipping | product | other")
    order_id: str | None = Field(description="Order ID if mentioned")
    summary: str

extractor = model.with_structured_output(TicketIntent)
ticket = extractor.invoke("I want a refund for order 991, it arrived damaged")
```

#### Technical terms

**Modern path:** `with_structured_output(PydanticModel)` - function-calling or JSON mode + validation.

**Parser family (older, still everywhere):**

| Parser | Does |
|--------|------|
| `StrOutputParser` | AIMessage → text (ubiquitous chain tail) |
| `JsonOutputParser` | Parses JSON; **streams partial objects** |
| `PydanticOutputParser` | Validates + `get_format_instructions()` for prompt |
| `OutputFixingParser` | On failure, LLM repairs malformed output |
| `RetryOutputParser` | Re-asks with error context |

**Choosing:**

- Major provider → **`with_structured_output`**
- Local/exotic model → `PydanticOutputParser` + `OutputFixingParser`
- Streaming UI over JSON → `JsonOutputParser`

**Schema design IS prompt design:** field descriptions are micro-prompts. Optional-with-default beats required-but-missing. Flatten deep nesting.

#### Beginner mistakes - A5

1. **`max_tokens` too small** → truncated JSON.
2. **Huge nested schemas** → accuracy drops.
3. **No failure strategy** - retry, fix, or dead-letter queue?

#### Pause and check - A5

1. Why are Field descriptions important?
2. Best approach for extracting `Invoice` from email with GPT-4o?
3. Truncated JSON - first knob to turn?

<details>
<summary>Answers</summary>

1. Model reads them as instructions for each field.
2. `model.with_structured_output(Invoice)`.
3. Increase `max_tokens` for worst-case output size.

</details>

---

### A6. Tools and function calling

#### Plain English

**Tools** let the model *request* actions - search orders, check inventory - without executing them. The model emits a structured request; **your code** runs it and reports back via `ToolMessage`.

#### Analogy: a manager with a walkie-talkie

The model is the manager. It says "Run search_orders for alice@example.com." It cannot touch your database. Your engineer (Python) runs it and radios back the result.

#### Mental walkthrough - Nova Support order lookup

1. Register tools: `search_orders`, `get_policy_snippet` (maybe later `issue_refund`).
2. `model_with_tools = model.bind_tools([search_orders, ...])`.
3. Customer: "Where is my order? alice@example.com"
4. Model returns `AIMessage` with `tool_calls=[{name: "search_orders", args: {email: "..."}, id: "call_1"}]`.
5. You execute → `ToolMessage("Order 991: shipped, ETA Friday", tool_call_id="call_1")`.
6. Append AI + tool messages; invoke again.
7. Model returns natural language answer to customer.

```
1. model_with_tools = model.bind_tools([...])
2. ai = model_with_tools.invoke(messages)
3. if ai.tool_calls:
       execute each → ToolMessage(s) → append ai
       goto 2
4. else: ai.content is the final answer
```

**The model never executes anything.** Validation, permissions, rate limits, approval gates - all on your side.

```python
from langchain_core.tools import tool

@tool
def search_orders(customer_email: str, status: str = "any") -> str:
    """Search customer orders by email. status: 'any'|'open'|'shipped'.
    Use when the user asks about order state or history."""
    ...
```

Type hints → schema; docstring → description. **Vague descriptions = wrong tool selection.**

#### Technical terms

| Keyword | Effect |
|---------|--------|
| `tool_choice="auto"` | Model decides (default) |
| `tool_choice="required"` / specific name | Force tool use - routing, extraction |
| Parallel tool calls | One AIMessage may carry several - answer **all** before next model call |
| Injected args | Secrets, `user_id`, DB handles - hidden from model schema |
| Error-as-ToolMessage | Return failure text so model self-corrects |

**Design habits:**

1. Fewer, broader, well-described tools beat many overlapping ones
2. Return **concise** results - 50KB JSON wastes context
3. **Idempotent** tools when possible - loops and resume replay calls
4. Destructive tools (pay, send, delete) → approval gate in LangGraph (`interrupt()`)

#### Beginner mistakes - A6

1. **Tool descriptions interchangeable** - model picks randomly between `search_order` and `find_order`.
2. **Crashing on tool exception** - return error as ToolMessage instead.
3. **Secrets in tool schema** - use injected args.

#### Pause and check - A6

1. What three things does the model see about a tool?
2. Who executes `search_orders`?
3. One AIMessage has two tool_calls. How many ToolMessages before the next model call?

<details>
<summary>Answers</summary>

1. Name, description, args schema.
2. Your Python code (or ToolNode in LangGraph).
3. Two - one per tool_call_id.

</details>

---

### A7. Memory and chat history

#### Plain English

Models are stateless. **Memory** means: *which past messages do we put back into the prompt this turn?* Context window is finite; tokens cost money.

#### Analogy: a desk with limited space

You cannot fit every past email on the desk. You keep recent papers (window), summarize old piles (summary), or pull sticky notes from a filing cabinet (vector memory / Store later).

#### Mental walkthrough - Nova Support turn 5

1. Full history is 40 messages - too many tokens.
2. Keep system message always.
3. Summarize messages 1–30 into one paragraph.
4. Keep messages 31–40 raw.
5. Run `trim_messages` if still over budget - preserves tool pairs.

#### Technical terms

| Strategy | Idea | Risk |
|----------|------|------|
| Full buffer | Keep everything | Context overflow |
| Window | Last k turns | Forgets early facts |
| Summary | LLM-compress old turns | Lossy; costs a call |
| **Summary + window** | Summary of old + raw recent | **Sane default** |
| Fact / vector memory | Extract facts, retrieve relevant | Becomes LangGraph `Store` |

**Modern wiring:** `RunnableWithMessageHistory` wraps a chain, loads history into `MessagesPlaceholder` by `session_id`.

**In LangGraph (cleaner):** history is `messages` in state + checkpointer.

```python
from langchain_core.messages import trim_messages

recent = trim_messages(
    history, max_tokens=2000, token_counter=model,
    strategy="last", include_system=True, start_on="human",
)
```

**Trimming invariants:**

1. Keep the system message
2. Never orphan a `ToolMessage` from its `AIMessage`
3. Start the kept window on a valid role

`history[-10:]` violates all three. Use `trim_messages`.

#### Beginner mistakes - A7

1. **Naive list slicing** - breaks tool pairs; provider 400 errors.
2. **Full buffer in production** - cost explosion.
3. **Separate memory subsystem in LangGraph** - just use state + checkpointer.

#### Pause and check - A7

1. What is "memory" really?
2. Why summary + window for long support chats?
3. What breaks if you slice `history[-10:]` mid-tool-loop?

<details>
<summary>Answers</summary>

1. Choosing which past content re-enters the prompt each turn.
2. Balances cost, recall of old facts, and fresh detail on recent turns.
3. Orphaned ToolMessages, dropped system message, invalid sequence start.

</details>

---

### A8. RAG I - the ingestion pipeline

#### Plain English

**RAG** (Retrieval-Augmented Generation) means: before the model answers, **search your documents** and paste relevant snippets into the prompt. Nova Support searches the NovaShop help center instead of inventing policy.

**Ingestion** is the offline job: load docs → split → embed → store. Retrieval quality is mostly won or lost here - before the first user query.

#### Analogy: a library card catalog

Ingestion is librarians labeling and shelving books. Query time is the patron asking "where is the refund policy?" and the librarian fetching the right shelf. Bad shelving = wrong book every time, no matter how smart the patron (model) is.

#### Mental walkthrough - index NovaShop help center

1. **Load** PDFs and Markdown from `/help-center` → `Document(page_content, metadata={source, page})`.
2. **Split** each doc into ~800-char chunks with 15% overlap.
3. **Embed** each chunk → vector (list of floats).
4. **Store** vectors in Chroma (dev) or pgvector (prod).
5. Later at query time: embed question → find nearest chunks → pass to prompt.

#### Technical terms

**Pipeline: load → split → embed → store**

**1. Loaders** → `Document(page_content, metadata)`. PDF, web, Notion, SQL… mostly `langchain-community`. Layout-aware PDF parsing beats naive extraction on tables.

**2. Splitters**

| Splitter | Use |
|----------|-----|
| `RecursiveCharacterTextSplitter` | **Default for prose** - paragraphs → sentences → chars |
| `MarkdownHeaderTextSplitter` | Docs/wikis - headers become metadata |
| Code splitters | Functions/classes per language |
| `TokenTextSplitter` | Strict token budgets |
| Semantic chunking | Split where embedding similarity drops - quality-sensitive, costlier |

**Dials:** `chunk_size` ~500–1500 chars; `chunk_overlap` 10–20%. Too small = fragments; too large = diluted embeddings.

**3. Embeddings** - text → vector. **Same model for queries and documents, always.** Changing models = re-embed entire corpus.

**4. Vector stores**

| Store | Profile |
|-------|---------|
| FAISS | In-process, fast - prototypes |
| Chroma | Easy local dev |
| pgvector | Pragmatic production if you already run Postgres |
| Pinecone / Weaviate / Qdrant / Milvus | Managed scale |

Underlying: **ANN** (e.g. HNSW) - fast approximate search, tiny recall trade-off.

**Ingestion gotchas:**

- Stale indexes - re-ingest on doc updates; track via metadata hashes
- Duplicate documents poisoning results - dedupe before embedding
- Losing `source` / `page` metadata - you want citations later

#### Beginner mistakes - A8

1. **Giant chunks, zero overlap** - blurry embeddings + lost boundary sentences.
2. **Different embed models for index vs query** - nonsense similarity scores.
3. **Skipping metadata** - cannot filter by product line or date later.

#### Pause and check - A8

1. What are the four ingestion steps?
2. Why must query and document embeddings use the same model?
3. chunk_size=4000, overlap=0 on prose - likely symptom?

<details>
<summary>Answers</summary>

1. Load, split, embed, store.
2. Vectors must live in the same semantic space to compare meaningfully.
3. Diluted embeddings (too many topics per chunk) + sentences split across boundaries with no overlap recovery.

</details>

---

### A9. RAG II - retrieval mastery

#### Plain English

**Retrieval** is the query-time half: turn the user's question into a search, get top-k chunks, optionally rerank, inject into prompt. If wrong chunks arrive, the model will confidently wrong-answer.

#### Analogy: a search engine inside your prompt

Google for your help center - but you control ranking, filters, and how many results fit on the "page" (context window).

#### Mental walkthrough - "Can I return opened skincare?"

1. Embed question (or use hybrid BM25 + vector).
2. Retrieve k=4 chunks from `help-center` index, filter `category=returns`.
3. Optional: fetch k=20, rerank, keep top 3.
4. Format chunks with source URLs.
5. Prompt: "Answer only from context; cite sources; say I don't know if insufficient."
6. Model generates grounded answer.

```python
retriever = vectorstore.as_retriever(
    search_type="mmr",
    search_kwargs={"k": 4, "filter": {"category": "returns"}},
)
```

#### Technical terms

| Dial | Guidance |
|------|----------|
| `k` | Start 3–5; more = recall + noise + tokens |
| `similarity` vs `mmr` | MMR = diversity; kills near-duplicate top-k |
| Score threshold | Return nothing + "I don't know" beats garbage |
| Metadata filter | Hard pre-filter (tenant, date, doc type) |

**Advanced retriever zoo (escalate when symptoms demand):**

| Retriever | Deploy when… |
|-----------|--------------|
| `MultiQueryRetriever` | User phrasing ≠ document phrasing |
| `ParentDocumentRetriever` | Small chunks for precision, large parent for context |
| `ContextualCompressionRetriever` + reranker | Over-fetch k=20, rerank, keep top 3 - **cheapest quality win** |
| `EnsembleRetriever` (hybrid BM25 + vector) | Error codes, SKUs, exact strings semantic search misses |
| `SelfQueryRetriever` | "…from 2024 in EU docs" → metadata filter |
| HyDE | Embed hypothetical answer when vocab gap is huge |
| Time-weighted | News, changelogs - decay by recency |

**Grounded generation:** prompt must say answer only from context; cite sources. Without it, RAG becomes vibes.

**Lost in the middle** - models attend most to start/end of context; put best chunks there.

Helpers: `create_stuff_documents_chain` + `create_retrieval_chain`.

#### Debugging recipe (follow in order)

1. **Look at retrieved chunks first**
2. Wrong/empty? → chunking, hybrid, reranking (not the model)
3. Right chunks, wrong answer? → grounding instructions
4. Both right, users unhappy? → eval problem; harvest failures

The model is almost never the problem first. Swapping to a bigger one is almost never the fix first.

#### Beginner mistakes - A9

1. **Skipping chunk inspection** - tuning prompts while retrieval returns garbage.
2. **k=50 "to be safe"** - noise + cost + lost-in-the-middle.
3. **No "I don't know" instruction** - model hallucinates over irrelevant chunks.

#### Pause and check - A9

1. Users search exact error code `ERR_5023`; vector search misses. Fix?
2. First debugging step when RAG answers wrong?
3. What is "lost in the middle"?

<details>
<summary>Answers</summary>

1. Hybrid retrieval - BM25 + vector (`EnsembleRetriever`).
2. Inspect retrieved chunks before touching the model.
3. Models under-attend to middle of long context; order chunks accordingly.

</details>

---

### A10. Ecosystem, packages, and the legacy layer

#### Plain English

LangChain is not one pip package. It is a **family** of packages. Old tutorials use names that changed - you need a map.

#### Analogy: a toolbox with labeled drawers

`langchain-core` is the handle and latch standard. Provider packages are brand-specific bits. `langgraph` is the workshop layout for workflows. `langchain-community` is the junk drawer of integrations - useful, uneven quality.

#### Mental walkthrough - what to install for Nova Support

1. `langchain-core` - messages, Runnable, prompts, tools
2. `langchain-openai` - ChatOpenAI
3. `langchain` - retrieval helpers, chains
4. `langchain-community` - PDF loader, Chroma
5. `langgraph` - agent graph (Part B)
6. `langgraph-checkpoint-postgres` - production persistence

#### Technical terms

| Package | Contains |
|---------|----------|
| `langchain-core` | Messages, Runnable, prompts, tools, parsers - **foundation** |
| `langchain` | Chains, retrievers, agent helpers |
| `langchain-community` | Third-party integrations |
| `langchain-openai`, `-anthropic`, … | Provider packages |
| `langgraph` | Graph runtime |
| `langgraph-checkpoint-*` | Checkpointer backends |

**Legacy → modern:**

| Legacy | Modern |
|--------|--------|
| `LLMChain`, `SequentialChain` | LCEL pipes |
| `ConversationBufferMemory` | `RunnableWithMessageHistory` / LangGraph state |
| `RetrievalQA` | `create_retrieval_chain` or custom LCEL/graph |
| `AgentExecutor`, `initialize_agent` | **`create_react_agent` in LangGraph** |

Legacy vocabulary that still maps: **ReAct** (reason → act → observe), **scratchpad**, **`max_iterations`**, **`AgentAction` / `AgentFinish`**.

**Version survival:** imports moved across 0.1→0.2→0.3→1.0. Trust current docs over any blog post.

#### Beginner mistakes - A10

1. **`pip install langchain` only** - missing provider package.
2. **Copying 2022 AgentExecutor tutorials** - translate to `create_react_agent`.
3. **Everything in one file** - split ingestion, chain, graph, API.

#### Pause and check - A10

1. Where do `SystemMessage` and `Runnable` live?
2. Modern replacement for `AgentExecutor`?
3. Why split provider packages?

<details>
<summary>Answers</summary>

1. `langchain-core`.
2. `create_react_agent` in LangGraph.
3. Install only providers you use; lighter deps; independent versioning.

</details>

---

## Part A checkpoint - Nova Support so far

Before LangGraph, you can build:

```
User question
    → (optional) RAG chain for FAQ
    → (optional) manual tool loop in Python
    → RunnableWithMessageHistory for session memory
```

That works for demos. It breaks down when you need **persistent threads**, **human approval**, **crash recovery**, and **inspectable loops**. That is Part B.

---

## Part B - LangGraph from scratch

**Why before how:** LangChain gives you parts. LangGraph gives you the **assembly diagram** - who runs when, what state they share, where to pause, how to survive crashes.

If Part A was "how to speak to the model," Part B is "how to run a support floor."

---

### B1. The state-machine model - why LangGraph exists

#### Plain English

**Chains are straight lines.** Agents are not:

- **Loop** - think → act → observe → repeat
- **Branch** - "retrieval failed → search web instead"
- **Pause** - "wait for human to approve this refund"
- **Shared state** - messages, plan, docs evolve together
- **Survive crashes** - resume mid-task

LangChain's old `AgentExecutor` hid the loop in a black box. LangGraph makes it **explicit, inspectable, and persistent**.

#### Analogy: a whiteboard in a war room

**State** is the whiteboard everyone reads and writes. **Nodes** are workers who edit one section and hand off. **Edges** are rules: "if refund > $100, go to supervisor node."

#### Mental walkthrough - Nova Support as a graph

1. Customer message arrives → `messages` updated on whiteboard.
2. **Agent node** reads messages, calls model with tools.
3. If tool_calls → **Tools node** runs `search_orders` → adds ToolMessages.
4. Loop back to agent until no tool_calls.
5. If `issue_refund` requested with amount > $100 → **interrupt** for human.
6. Human approves → resume → tool runs → END.

#### Technical terms - three primitives

| Primitive | Is | Analogy |
|-----------|-----|---------|
| **State** | One shared typed dict | The whiteboard |
| **Node** | `state → partial update` | Worker editing the whiteboard |
| **Edge** | Static or conditional transition | Rule for who works next |

**Pregel execution - super-steps:**

1. All **active** nodes run (parallel if several)
2. Updates merge into state via **reducers**
3. Edges choose next active set
4. **Checkpoint saved** - repeat until `END`

```
super-step 1        super-step 2        super-step 3
┌─────────┐        ┌─────────┐        ┌─────────┐
│ agent   │ ─────► │ tools   │ ─────► │ agent   │ ──► END
└─────────┘        └─────────┘        └─────────┘
     │                                      ▲
     └──────────── (loop if tool_calls) ────┘
```

**Bridge fact:** `compile()` returns a **Runnable**. Config, callbacks, streaming, batch - everything from Part A applies. LangGraph does not replace LangChain; **nodes call chains**.

```python
from langgraph.graph import StateGraph, START, END

builder = StateGraph(State)
builder.add_node("agent", agent_node)
builder.add_node("tools", tool_node)
builder.add_edge(START, "agent")
builder.add_conditional_edges("agent", route, {"tools": "tools", "finish": END})
builder.add_edge("tools", "agent")
graph = builder.compile(checkpointer=checkpointer)
```

#### Beginner mistakes - B1

1. **Reimplementing agent loop in while-True** when you need persistence - use LangGraph.
2. **Thinking LangGraph replaces LangChain** - it orchestrates LangChain inside nodes.
3. **Ignoring super-step mental model** - parallel nodes + reducers confuse you later.

#### Pause and check - B1

1. Name three things chains cannot do that graphs can.
2. What does `compile()` return?
3. In Nova Support, what is "state"?

<details>
<summary>Answers</summary>

1. Cycles/loops, human pauses, durable crash recovery (any three).
2. A Runnable (CompiledGraph).
3. Shared data like `messages`, maybe `pending_refund`, etc.

</details>

---

### B2. State and reducers - where the bugs live

#### Plain English

**State** is a typed dictionary every node reads and partially updates. **Reducers** define how updates merge when multiple writes hit the same key - especially after parallel nodes.

#### Analogy: Git merge rules per file

Some files overwrite (`plan: str`). Some append (`docs: list` with `operator.add`). Chat history uses special merge (`add_messages`) - append, upsert by ID, support deletes.

#### Mental walkthrough - updating Nova Support state

1. Agent node returns `{"messages": [new_ai_message]}`.
2. Reducer **appends** to existing messages (not replace entire list).
3. Tools node returns `{"messages": [tool_message]}`.
4. Again append.
5. A parallel fan-out writes `summaries` from two nodes - need reducer or **InvalidUpdateError**.

```python
import operator
from typing import Annotated, TypedDict
from langgraph.graph.message import add_messages

class State(TypedDict):
    messages: Annotated[list, add_messages]
    docs:     Annotated[list, operator.add]
    plan:     str
```

| Reducer | Behavior | For |
|---------|----------|-----|
| *(none)* | Overwrite - last write wins | Scalars, flags |
| `add_messages` | Append; upsert by id; `RemoveMessage` | Chat history - **always** |
| `operator.add` / custom | Concat, sum, dedupe… | Fan-in accumulation |

**Why `add_messages` specifically:**

- Overwrite wipes history on every update
- Plain concat cannot edit/delete; double-appends on replay
- `add_messages` appends, upserts by ID, honors `RemoveMessage`

**`MessagesState`** - prebuilt schema with `messages` + `add_messages`. Subclass to add keys.

**Multiple schemas:** `input_schema`, `output_schema` (hide scratch keys), private state between specific nodes.

**State design checklist:**

1. Every key has a clear owner
2. Parallel-written keys have reducers
3. `messages` uses `add_messages`
4. State small + JSON-serializable - **IDs not blobs**
5. Scratch keys hidden via output schema

#### Beginner mistakes - B2

1. **No reducer on parallel-written key** → `InvalidUpdateError`.
2. **Overwrite messages** - history vanishes each step.
3. **Huge blobs in state** - slow checkpoints.

#### Pause and check - B2

1. Two parallel nodes write scalar `plan` without reducer. What happens?
2. Why not plain list concat for messages?
3. What is `MessagesState`?

<details>
<summary>Answers</summary>

1. `InvalidUpdateError` - ambiguous merge.
2. Cannot delete/edit; replay double-appends; no tool pair semantics.
3. Prebuilt TypedDict with `messages` + `add_messages`.

</details>

---

### B3. Edges, routers, and parallelism

#### Plain English

**Edges** connect nodes. **Static edges** always go A → B. **Conditional edges** call a **router** function that reads state and returns the next node name. **Parallelism** = multiple edges from one node fire together in one super-step.

#### Analogy: airport signage vs GPS

Static edge = "always go to baggage claim." Conditional edge = GPS reads your boarding pass and routes domestic vs international. Router must not stop for coffee (no I/O) - it only reads the sign (state).

#### Mental walkthrough - Nova Support routing

1. After agent node, router checks last message.
2. If `tool_calls` → label `"tools"`.
3. Else → `"finish"` → END.
4. Pure function - no LLM call inside router.

```python
def route(state) -> str:
    last = state["messages"][-1]
    return "tools" if getattr(last, "tool_calls", None) else "finish"

builder.add_conditional_edges("agent", route, {"tools": "tools", "finish": END})
```

#### Technical terms

| Mechanism | Decided | Use |
|-----------|---------|-----|
| `add_edge(A, B)` | Build time | Always A → B |
| `add_conditional_edges(A, router, map)` | Runtime, pure router | Branch, loop-back |
| `Send` | Runtime, dynamic fan-out | N parallel workers, N unknown at build |
| `Command` | Inside node | Update + destination fused |

**Router discipline:** routers are **pure** - read state, return label. No LLM calls, no writes, no I/O. Smart routing? Node computes decision into state; router reads it. Or use `Command`.

**Cycles and termination:**

- Loop = conditional edge pointing backward - first-class
- **Logical exit** - path to `END` (no tool_calls, step counter…)
- **Hard stop** - `recursion_limit` (default 25) → `GraphRecursionError`

**Static parallelism:** multiple edges from one node → all targets same super-step → merge via reducers.

#### Beginner mistakes - B3

1. **LLM call inside router** - side effects, untestable, breaks purity.
2. **No path to END** - burns `recursion_limit` and budget.
3. **Parallel nodes writing same key without reducer** - Module B2 strikes again.

#### Pause and check - B3

1. Can a router call `search_orders`?
2. What stops an infinite agent ↔ tools loop?
3. Static vs conditional edge - one difference?

<details>
<summary>Answers</summary>

1. No - routers must be pure; work belongs in nodes.
2. Logical exit (no tool_calls) + `recursion_limit` as circuit breaker.
3. Static is fixed at build time; conditional uses runtime router function.

</details>

---

### B4. Send and Command - dynamic control flow

#### Plain English - WHY first

Static edges are drawn when you build the graph. Sometimes you do not know **how many** branches you need until runtime - e.g. Nova Support must summarize **each** of 7 retrieved policy sections in parallel. **Send** solves that.

Sometimes one node both **updates state** and **decides where to go**. Splitting that across node + router is awkward. **Command** fuses update + goto.

#### Analogy

**Send** = a manager assigning one task per incoming ticket from a pile - pile size unknown at factory design time.

**Command** = a worker who fills out a form *and* stamps "send to Legal" in one motion.

#### Mental walkthrough - Send for multi-doc summary

1. RAG retrieves 5 policy chunks into `state["docs"]`.
2. Router returns `[Send("summarize_one", {"doc": d}) for d in state["docs"]]`.
3. Five `summarize_one` nodes run in parallel.
4. Reducer concatenates summaries.
5. Join node merges into final answer.

#### Mental walkthrough - Command for department routing

1. Structured output node classifies ticket: `dept = "billing"`.
2. Node returns `Command(update={"dept": dept}, goto=dept)`.
3. Graph jumps to billing specialist subgraph - no separate router function.

```python
from langgraph.types import Send, Command

def fan_out(state):
    return [Send("summarize_one", {"doc": d}) for d in state["docs"]]

def route_dept(state):
    dept = classify(state["messages"][-1].content)
    return Command(update={"dept": dept}, goto=dept)
```

**Command also:**

- **`Command(graph=Command.PARENT, goto=...)`** - handoff between agents
- **`Command(resume=...)`** - resume after `interrupt()`

| Need | Use |
|------|-----|
| Fixed fan-out at build time | Multiple static edges |
| Runtime N unknown | `Send` |
| Update + route in one node | `Command` |
| Pure branch on state | Conditional edge + router |

#### Beginner mistakes - B4

1. **Send without reduce step** - parallel results nowhere to land.
2. **Command and separate router duplicating logic** - pick one pattern.
3. **Send payload huge** - pass IDs, not full documents.

#### Pause and check - B4

1. When use Send vs static parallel edges?
2. What two things does Command combine?
3. Nova Support: summarize each retrieved chunk - which primitive?

<details>
<summary>Answers</summary>

1. Send when N is runtime-known; static when branches fixed at build.
2. State update and next-node routing.
3. Send (map-reduce pattern).

</details>

---

### B5. ReAct agents in graphs

#### Plain English - WHY ReAct

**ReAct** = **Re**ason + **Act** + observe in a loop. The model thinks (maybe invisibly), requests a tool, reads result, repeats until done. This is the dominant agent pattern for Nova Support: answer FAQ, lookup order, maybe refund.

LangGraph makes the loop **visible** - not buried in AgentExecutor.

#### Analogy: a detective with a notebook

Detective (model) reads case file (messages). Goes to lab (tool). Writes findings (ToolMessage). Repeats until ready to report to client.

#### Mental walkthrough - one full ReAct cycle

1. START → agent node.
2. Agent: `prompt | model.bind_tools` → new AIMessage.
3. Router: tool_calls? → tools node.
4. Tools: `ToolNode` executes all calls → ToolMessages added.
5. Edge back to agent.
6. Agent: model sees tool results → final AIMessage without tools.
7. Router: no tool_calls → END.

```
START ──► agent (LLM + bind_tools)
            │
            ▼ router: tool_calls?
      ┌── yes ──► tools (ToolNode) ──► agent   ← cycle
      └── no  ──► END
```

| Piece | Role |
|-------|------|
| `MessagesState` | `messages` + `add_messages`; subclass for extra keys |
| `ToolNode` | Executes all tool_calls; **errors → ToolMessages** |
| `tools_condition` | Prebuilt router: tools vs END |
| `create_react_agent(model, tools)` | Whole loop + optional `prompt`, `checkpointer`, hooks |

```python
from langgraph.prebuilt import create_react_agent, ToolNode, tools_condition

graph = create_react_agent(model, tools=[search_orders, get_policy], checkpointer=saver)
```

`create_react_agent` is **`AgentExecutor` done right**: inspectable, checkpointable, interruptible, streamable.

**Two defenses against infinite loops:**

1. **Error-as-ToolMessage** - model adapts logically
2. **`recursion_limit`** - hard stop

You want both. Always.

#### Beginner mistakes - B5

1. **Custom loop before trying `create_react_agent`** - reinventing bugs.
2. **Only recursion_limit, no logical exit** - hits error instead of graceful finish.
3. **ToolNode bypass** - manual tool execution with wrong message ordering.

#### Pause and check - B5

1. What does ToolNode do on tool exception?
2. What is `tools_condition`?
3. ReAct in one sentence?

<details>
<summary>Answers</summary>

1. Returns error text as ToolMessage (keeps loop alive).
2. Prebuilt router: route to tools if tool_calls else END.
3. Model alternates reasoning/tool requests with observing tool results until final answer.

</details>

---

### B6. Persistence - checkpointers, threads, time travel

#### Plain English - WHY persistence

Without persistence, every HTTP request is a stranger. Nova Support must remember Alice's thread after she closes the browser. If your server crashes mid-refund flow, you must **resume**, not restart from zero.

**Checkpointer** saves state after every super-step. **`thread_id`** names which conversation snapshot to load.

#### Analogy: save points in a video game

Each super-step is a save point. `thread_id` is the save slot. Crash or pause? Reload slot and continue. **Time travel** = fork from an old save and try a different choice.

#### Mental walkthrough - Alice's support thread

1. Alice opens chat → your API assigns `thread_id="alice-session-42"`.
2. Every `graph.invoke(..., config={"configurable": {"thread_id": "alice-session-42"}})` loads prior checkpoints.
3. Server restarts - same thread_id → graph continues from last checkpoint.
4. Support supervisor uses `get_state_history` to audit what happened.

```python
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.checkpoint.postgres import PostgresSaver

# dev
saver = InMemorySaver()
# prod
# saver = PostgresSaver(conn)

graph = builder.compile(checkpointer=saver)
config = {"configurable": {"thread_id": "alice-session-42"}}
graph.invoke({"messages": [HumanMessage("Where is order 991?")]}, config)
```

| Capability | API | Meaning |
|------------|-----|---------|
| Inspect | `get_state(config)` | Current snapshot + next nodes |
| History | `get_state_history(config)` | All checkpoints |
| Patch | `update_state(config, values)` | Manual edit - **through reducers** |
| Time travel | invoke with `checkpoint_id` | Replay or **fork** alternate future |
| Durable execution | automatic | Crash → resume last completed step |

**Gotchas:**

- `update_state` on `messages` **appends** - delete via `RemoveMessage`
- Big state = slow checkpoints - store references
- Checkpointer compiled but no `thread_id` → error; random `thread_id` per request → amnesia

**Corollary:** resume replays node bodies → **idempotent side effects**.

#### Beginner mistakes - B6

1. **New random thread_id every request** - "bot has amnesia" bug.
2. **Non-idempotent tools** - double charge on resume.
3. **InMemorySaver in production** - lost on restart.

#### Pause and check - B6

1. What is `thread_id`?
2. Why must refund tool be idempotent?
3. PostgresSaver vs InMemorySaver?

<details>
<summary>Answers</summary>

1. Conversation identity key for loading/saving checkpoints.
2. Node bodies may re-execute on resume/replay.
3. Postgres durable across restarts; InMemory dev-only.

</details>

---

### B7. Human-in-the-loop (HITL)

#### Plain English - WHY HITL

Nova Support must not auto-refund $500 without a human. You need to **pause** the graph, show a UI, wait minutes or days, then **continue** - without holding a worker process open.

#### Analogy: a door with a badge reader

The workflow walks up to the door (`interrupt`), stops, waits for badge swipe (human decision), then walks through. The building did not burn down while waiting - state is on disk.

#### Mental walkthrough - refund approval

1. Agent calls `issue_refund(amount=250)`.
2. Before tool runs, node hits `interrupt({"question": "Approve $250 refund?", "order": 991})`.
3. Graph pauses; checkpoint saved; API returns `__interrupt__` payload to frontend.
4. Human clicks Approve hours later.
5. `graph.invoke(Command(resume="approved"), config)` - same `thread_id`.
6. Node **re-executes from start**; `interrupt()` now returns `"approved"`; tool runs.

```python
from langgraph.types import interrupt, Command

def refund_node(state, config):
    draft = state["pending_refund"]
    decision = interrupt({"question": "Approve refund?", "draft": draft})
    if decision != "approved":
        return {"messages": [AIMessage("Refund cancelled.")]}
    result = issue_refund(**draft)
    return {"messages": [ToolMessage(...)]}
```

**The re-execution trap:** code *before* `interrupt()` runs **twice** on resume. Payment before pause = double charge. Keep pre-interrupt code pure or **split nodes**.

#### Four HITL patterns

| Pattern | Nova Support example |
|---------|---------------------|
| Approve / reject | "Issue this refund?" |
| Edit state | Human fixes order ID before lookup |
| Review tool call | Approve/edit args before risky tool |
| Wait for input | "Which account did you mean?" |

Static breakpoints: `interrupt_before` / `interrupt_after` - dev stepping. Production primitive: `interrupt()`.

**No checkpointer → no pause.** This feature *is* persistence.

#### Beginner mistakes - B7

1. **Side effects before interrupt** - double execution.
2. **No checkpointer** - interrupt impossible.
3. **Different thread_id on resume** - wrong conversation.

#### Pause and check - B7

1. What happens to code before `interrupt()` on resume?
2. How does human send decision back?
3. Can you HITL without checkpointer?

<details>
<summary>Answers</summary>

1. It runs again - must be pure or moved after interrupt/split node.
2. `Command(resume=value)` with same thread_id.
3. No - pause requires persisted state.

</details>

---

### B8. Long-term memory - the Store

#### Plain English - WHY Store

**Checkpointer** = memory *within one conversation* (`thread_id`). **Store** = memory *across conversations* for the same user - "Alice is vegetarian," "Alice prefers email over SMS," "Alice had three refunds last year."

Nova Support sees Alice in a new chat Tuesday; Store recalls facts without re-asking.

#### Analogy

Checkpointer = RAM for this phone call. Store = CRM profile that persists across every call Alice ever makes.

#### Mental walkthrough - remember preference across threads

1. Thread A: Alice says "I'm vegetarian - only suggest plant-based replacements."
2. Node extracts fact → `store.put(namespace, key, {"text": "vegetarian"})`.
3. Thread B (new `thread_id`, same `user_id`): before answering product questions, `store.search(namespace, query="dietary")` → inject top hits into prompt.

```python
# inside a node - store injected via config/runtime
ns = ("memories", config["configurable"]["user_id"])
hits = store.search(ns, query="dietary preferences", limit=3)
store.put(ns, "food", {"text": "user is vegetarian"})
```

| | Short-term | Long-term |
|--|------------|-----------|
| Mechanism | Checkpointer | **Store** |
| Scope | One `thread_id` | **Cross-thread**, by namespace |
| Holds | Full graph state | Facts as JSON docs |
| Analogy | Conversation RAM | User profile DB |

**Memory taxonomy:**

- **Semantic** - facts ("Alice, Enterprise tier")
- **Episodic** - past experiences ("resolved billing dispute 2025-03")
- **Procedural** - evolved instructions ("always offer 10% first")

**Gotcha:** Store is **queried, never bulk-loaded**. Search top few; inject those. Not a context stuffer.

#### Beginner mistakes - B8

1. **Confusing Store with checkpointer** - different scopes.
2. **Loading entire user history into prompt** - token bomb.
3. **Writing memory synchronously on hot path** - consider background extraction.

#### Pause and check - B8

1. thread_id vs user_id - what each scopes?
2. When to use Store vs checkpointer?
3. Why search instead of load-all?

<details>
<summary>Answers</summary>

1. thread_id = one conversation; user_id = person across conversations.
2. Checkpointer for thread state; Store for cross-thread user facts.
3. Relevant retrieval controls tokens; bulk load overflows context.

</details>

---

### B9. Multi-agent architectures

#### Plain English - WHY multi-agent

One Nova Support agent with 40 tools and a 200-line system prompt **degrades** - wrong tools, conflicting instructions. **Multi-agent** splits work: billing agent, shipping agent, supervisor routes between them.

**Honest truth:** most demos do not need this. Split when you can **name the overload** - too many tools, distinct domains, conflicting personas.

#### Analogy: a call center with departments

Front desk (supervisor) listens, transfers to Billing or Shipping. Specialists have smaller manuals (prompts) and fewer buttons (tools). You pay transfer time (latency + cost) for clarity.

#### Mental walkthrough - supervisor topology

1. Customer: "Refund order 991 and update shipping address."
2. Supervisor classifies → billing agent for refund, shipping agent for address - or sequential handoffs.
3. Each agent has own prompt + tools subset.
4. Results merge back to customer-facing message.

#### Technical terms - topologies

| Topology | How | Pick when |
|----------|-----|-----------|
| **Supervisor** | Central router LLM dispatches specialists | Predictable, debuggable - **start here** |
| **Swarm** | Handoff tools → `Command(goto=..., graph=PARENT)` | Fluid handoffs; harder global reasoning |
| **Hierarchical** | Compiled subgraph as node of parent | Teams-of-teams; parent checkpointer propagates |

```
Supervisor pattern:

         ┌─────────────┐
         │ supervisor  │
         └──────┬──────┘
    ┌──────────┼──────────┐
    ▼          ▼          ▼
 billing   shipping   product
  agent      agent     agent
```

Win = **context isolation** (smaller, sharper prompts), not emergent magic. Cost = more calls, latency, failure surface.

#### Beginner mistakes - B9

1. **Multi-agent day one** - start single ReAct agent.
2. **Supervisor with same tool list as workers** - defeats purpose.
3. **No shared checkpointer/thread_id** - handoffs lose context.

#### Pause and check - B9

1. When should you split agents?
2. Recommended first topology?
3. What do you trade for context isolation?

<details>
<summary>Answers</summary>

1. When one prompt/tool set is overloaded - wrong tools, conflicting domains.
2. Supervisor - central router to specialists.
3. Extra latency, cost, and failure points.

</details>

---

### B10. Streaming and production hardening

#### Plain English - WHY streaming

Users tolerate 8 seconds of **visible progress**; they rage-quit at 8 seconds of **blank screen**. Streaming shows tokens and step updates. Production hardening is everything else that keeps Nova Support alive at 3 AM.

#### Analogy: pizza tracker vs silent kitchen

`stream_mode="messages"` = see toppings applied. `stream_mode="updates"` = "dough → sauce → oven." `debug` = security camera on every worker.

#### Mental walkthrough - streaming Nova Support UI

1. Frontend opens SSE connection to your API.
2. API calls `graph.astream(input, config, stream_mode=["messages", "updates"])`.
3. Token chunks → chat bubble grows.
4. Update events → "Searching orders…" spinner.
5. On interrupt → send `__interrupt__` payload → show approval modal.

| `stream_mode` | Emits | For |
|---------------|-------|-----|
| `values` | Full state per super-step | Debug, simple UIs |
| `updates` | Per-node deltas | Progress ("retrieving…") |
| `messages` | **LLM tokens** | Chat typing effect |
| `custom` | `get_stream_writer()` events | Tool progress ("page 3/10") |
| `debug` | Everything | Deep debug |

Multiple modes at once; `astream_events` for finest granularity.

#### Production checklist (pin this)

1. **PostgresSaver**, pooled; monitor checkpoint table growth
2. **`recursion_limit`** tuned; alert on `GraphRecursionError`
3. **`with_retry` + `with_fallbacks`** on models
4. **Idempotent tools** - resume and interrupt replay bodies
5. **Trim/summarize node** - token budget on `messages`
6. **Stable `thread_id` / `user_id`** in `configurable`
7. **Tracing callbacks** on every invoke - you cannot debug agents from prints
8. **Config threaded through** every nested `chain.invoke(x, config)` inside nodes

```python
async for event in graph.astream(
    {"messages": [HumanMessage("Where is my order?")]},
    config,
    stream_mode=["messages", "updates"],
):
    handle(event)
```

#### Beginner mistakes - B10

1. **Streaming only final string** - no step progress during tool calls.
2. **No alerts on GraphRecursionError** - silent budget burn.
3. **Print debugging in prod** - use tracing.

#### Pause and check - B10

1. Which stream_mode for typing effect?
2. Name two production checklist items for persistence.
3. Why pass config into chains inside nodes?

<details>
<summary>Answers</summary>

1. `messages` (LLM token stream).
2. Any two: PostgresSaver, stable thread_id, monitor checkpoint growth, idempotent tools.
3. So tracing, thread_id, and limits propagate - avoid orphan traces.

</details>

---

## Part C - Putting it together

### C1. Chains inside graphs - integration patterns

#### Plain English

LangGraph nodes are functions. Inside them, you call **LangChain chains** - the same `prompt | model | retriever` from Part A. One **config** object ties the whole stack together.

#### The decision rule (final form)

```
Straight line with ≤1 branch?     → LCEL chain
Loops, pauses, evolving state?    → LangGraph (LangChain inside nodes)
```

#### Nova Support - full architecture

```
User ── HTTPS ──► Your API (auth, rate limits, thread_id)
                      │
                      ▼ invoke(config: thread_id, callbacks, recursion_limit)
                 LangGraph CompiledGraph
                 trim ─► agent ⇄ tools (ReAct)
                 interrupt() before issue_refund
                 Send fan-out for multi-doc summaries (optional)
                      │
                 PostgresSaver (threads) + Store (user memory)
                      │
                 LangChain inside every node:
                 models (+retry/fallbacks), prompts, @tools, retrievers
                      │
                 Vector store + embeddings + rerankers
```

#### Node pattern catalog

| Node | LangChain inside |
|------|------------------|
| Reasoning | `ChatPromptTemplate \| model_with_tools` → append AIMessage |
| RAG | Parallel-gather chain → grounded answer |
| Router-prep | `with_structured_output(Decision)` → state; router reads |
| Trim | `trim_messages` before each model call |
| Tools | `ToolNode(@tool functions)` |
| Summarize | Small chain → `summary` key + `RemoveMessage` for old turns |

```python
config = {
    "configurable": {"thread_id": tid, "user_id": uid},
    "callbacks": [tracing_handler],
    "metadata": {"feature": "nova-support"},
    "recursion_limit": 50,
}
graph.invoke({"messages": [HumanMessage("Refund order 991")]}, config)
# flows: graph → nodes → chains → models → tools. Automatically.
```

**Orphan-trace bug:** invoking a chain inside a node *without* passing the node's `config` severs propagation. Always `chain.invoke(x, config)`.

#### Failure modes (memorize)

| Symptom | Disconnect |
|---------|------------|
| Traces show LLM calls but no graph structure | Handler on model, not on `graph.invoke` config |
| Conversation resets every request | Missing/random `thread_id` |
| Agent loops forever | No logical exit + no `recursion_limit` |
| Double charge / double email | Side effect before `interrupt()` |
| Eval passes, prod fails | Experiment ran different pipeline than prod graph |
| RAG wrong in prod only | Different retriever/chunking in eval vs prod |

---

### C2. The production blueprint - Nova Support launch checklist

Run this before shipping:

1. **Messages:** valid ordering; tool_calls ↔ ToolMessages paired; trim with invariants
2. **Models:** temp 0 for tools/extraction; `max_tokens` set; retry + fallbacks tested
3. **Prompts:** templated; `MessagesPlaceholder`; externalized; stable-prefix-first
4. **Structured output** wherever output feeds code; repair/dead-letter strategy chosen
5. **Tools:** few + well-described; injected secrets; errors as ToolMessages; destructive → `interrupt()`
6. **RAG:** chunking tuned first; hybrid + rerank when needed; grounding + "I don't know"; re-ingest on updates
7. **State:** typed; reducers on parallel keys; `add_messages`; small + serializable
8. **Flow:** pure routers; paths to `END`; `recursion_limit`; `Send` for runtime fan-out
9. **Persistence:** PostgresSaver; stable `thread_id`; Store for cross-thread; idempotent side effects
10. **Operate:** `stream_mode="messages"` for UX; config everywhere; tracing on

#### End-to-end trace - Alice refunds damaged item

| Step | Layer | What happens |
|------|-------|--------------|
| 1 | API | Auth Alice; `thread_id=alice-42`, `user_id=alice@example.com` |
| 2 | Graph | Load checkpoint; trim messages |
| 3 | Agent | Model sees history; may call `search_orders` |
| 4 | Tools | ToolNode returns order details |
| 5 | Agent | Model requests `issue_refund` |
| 6 | HITL | `interrupt` - human approves $80 refund |
| 7 | Tools | Idempotent refund executes |
| 8 | Store | Optional: record "refund issued 2026-06" in episodic memory |
| 9 | API | Stream final AIMessage to UI; checkpoint saved |

---

## Glossary - every term defined

Terms appear in the order a beginner meets them, then alphabetically within each library.

### Foundations

| Term | Definition |
|------|------------|
| **LLM** | Large Language Model - predicts text continuations; accessed via API |
| **Token** | Subword unit; basis for billing and context limits |
| **Provider** | Company hosting the model (OpenAI, Anthropic, Google, …) |
| **Prompt** | Instructions + context sent to the model |
| **Context window** | Maximum tokens the model can see in one call |
| **RAG** | Retrieval-Augmented Generation - fetch docs, then generate |
| **Agent** | System where model repeatedly decides actions (often tools) until done |
| **ReAct** | Reason → Act (tool) → Observe loop |

### LangChain - core

| Term | Definition |
|------|------------|
| **Runnable** | Universal interface: invoke, stream, batch, astream_events |
| **invoke / ainvoke** | Sync / async single input → output |
| **stream / astream** | Incremental output chunks |
| **batch / abatch** | Parallel many inputs |
| **astream_events** | Fine-grained event stream from all nested Runnables |
| **RunnableConfig** | Second arg to invoke; propagates through nested Runnables |
| **configurable** | Dict inside config; holds `thread_id`, `user_id`, etc. |
| **callbacks** | Handlers for tracing/observability |
| **metadata / tags / run_name** | Labels on traces for filtering |
| **LCEL** | LangChain Expression Language - compose with `\|` |
| **RunnableSequence** | A → B → C pipe |
| **RunnableParallel** | One input → dict of branch outputs (implicit dict in chain) |
| **RunnablePassthrough** | Pass input through unchanged |
| **assign()** | Add computed keys to dict while passing rest |
| **RunnableLambda** | Wrap arbitrary function as Runnable |
| **RunnableBranch** | If/else between Runnables |
| **itemgetter** | Pluck dict key in chain |

### LangChain - messages

| Term | Definition |
|------|------------|
| **SystemMessage** | Pinned instructions / persona |
| **HumanMessage** | User input; may use content blocks (multimodal) |
| **AIMessage** | Model output; may include tool_calls |
| **ToolMessage** | Tool result; must match tool_call_id |
| **AIMessageChunk** | Streaming partial AIMessage |
| **tool_calls** | Structured tool requests on AIMessage |
| **tool_call_id** | Correlates ToolMessage to request |
| **usage_metadata** | Token counts on response |
| **content blocks** | List-structured multimodal content |

### LangChain - models

| Term | Definition |
|------|------------|
| **ChatModel** | Messages in → AIMessage out (standard) |
| **init_chat_model** | Factory string like `"openai:gpt-4o"` |
| **temperature** | Randomness dial; 0 = deterministic |
| **max_tokens** | Output length cap |
| **top_p** | Nucleus sampling alternative to temperature |
| **with_retry** | Retry transient failures |
| **with_fallbacks** | Switch to backup model on failure |
| **bind** | Pre-attach invoke kwargs (incl. bind_tools) |
| **configurable_fields** | Swap params via config at runtime |
| **LLM cache** | Reuse answers for identical/similar prompts |

### LangChain - prompts & parsing

| Term | Definition |
|------|------------|
| **PromptTemplate** | Single-string template |
| **ChatPromptTemplate** | Multi-message template (standard) |
| **MessagesPlaceholder** | Slot for message list (history) |
| **FewShotPromptTemplate** | Inject examples |
| **ExampleSelector** | Pick relevant few-shot examples per query |
| **partial variables** | Pre-fill template vars via `.partial()` |
| **with_structured_output** | Pydantic-validated model output |
| **StrOutputParser** | AIMessage → string |
| **JsonOutputParser** | Parse/stream JSON |
| **PydanticOutputParser** | Validate to Pydantic + format instructions |
| **OutputFixingParser** | LLM repairs parse failures |
| **RetryOutputParser** | Re-ask with error context |

### LangChain - tools & memory

| Term | Definition |
|------|------------|
| **@tool** | Decorator registering Python function as tool |
| **StructuredTool** | Tool with explicit schema |
| **bind_tools** | Attach tools to model |
| **tool_choice** | Force auto, required, or specific tool |
| **InjectedToolArg** | Runtime-only arg hidden from model schema |
| **RunnableWithMessageHistory** | Chain wrapper loading history by session_id |
| **session_id** | Key for chain-level chat history |
| **trim_messages** | Token-aware history trim preserving invariants |

### LangChain - RAG

| Term | Definition |
|------|------------|
| **Document** | page_content + metadata |
| **DocumentLoader** | Source → Documents |
| **TextSplitter** | Chunk documents |
| **chunk_size / chunk_overlap** | Chunking dials |
| **Embeddings** | Text → dense vectors |
| **VectorStore** | Stores vectors + metadata |
| **ANN / HNSW** | Approximate nearest neighbor index |
| **Retriever** | Query → relevant Documents |
| **k** | Number of chunks to retrieve |
| **MMR** | Maximal Marginal Relevance - diverse top-k |
| **score threshold** | Minimum similarity to include chunk |
| **metadata filter** | Pre-filter by doc metadata |
| **MultiQueryRetriever** | LLM rephrases query multiple ways |
| **ParentDocumentRetriever** | Small child chunks, large parent context |
| **ContextualCompressionRetriever** | Fetch many, compress/rerank to few |
| **reranker** | Cross-encoder reordering retrieved docs |
| **EnsembleRetriever / hybrid** | Combine BM25 + vector |
| **BM25** | Keyword/sparse retrieval |
| **SelfQueryRetriever** | LLM builds metadata filter from natural language |
| **HyDE** | Hypothetical Document Embeddings |
| **lost in the middle** | Model under-attends mid-context |
| **create_retrieval_chain** | Helper wiring retriever + stuff chain |

### LangChain - ecosystem & legacy

| Term | Definition |
|------|------------|
| **langchain-core** | Foundation package |
| **langchain-community** | Third-party integrations |
| **AgentExecutor** | Legacy agent loop wrapper |
| **scratchpad** | Intermediate agent steps in prompt |
| **max_iterations** | Legacy loop cap |

### LangGraph - graph core

| Term | Definition |
|------|------------|
| **StateGraph** | Builder for stateful graphs |
| **TypedDict schema** | State shape definition |
| **reducer** | Merge rule for state key updates |
| **add_messages** | Message-list reducer (append, upsert, remove) |
| **RemoveMessage** | Delete message by id via reducer |
| **MessagesState** | Prebuilt messages-only state |
| **node** | Function: state → partial update |
| **partial update** | Node returns only changed keys |
| **add_edge** | Static transition |
| **add_conditional_edges** | Runtime router transition |
| **router function** | Pure fn: state → next node label |
| **START / END** | Graph entry / termination sentinel |
| **compile()** | Build Runnable CompiledGraph |
| **CompiledGraph** | Executable graph |
| **Pregel / super-step** | Plan-execute-merge-checkpoint cycle |
| **InvalidUpdateError** | Parallel conflicting writes without reducer |
| **recursion_limit** | Max super-steps before GraphRecursionError |
| **GraphRecursionError** | Hard stop - loop limit exceeded |

### LangGraph - control flow

| Term | Definition |
|------|------------|
| **Send** | Dynamic fan-out to N node instances |
| **Command** | Fused state update + goto (and resume) |
| **Command.PARENT** | Route/handoff to parent graph |
| **map-reduce** | Send map + reducer reduce pattern |
| **fan-out / fan-in** | Parallel split and merge |
| **ToolNode** | Executes tool_calls from AIMessage |
| **tools_condition** | Prebuilt tools-vs-END router |
| **create_react_agent** | Prebuilt ReAct graph factory |
| **pre/post_model_hook** | Extension points around model call |

### LangGraph - persistence & HITL

| Term | Definition |
|------|------------|
| **checkpointer** | Saves state each super-step |
| **checkpoint** | Serialized state snapshot |
| **thread_id** | Conversation identity for checkpoints |
| **InMemorySaver** | Dev checkpointer (non-durable) |
| **SqliteSaver** | File-backed checkpointer |
| **PostgresSaver** | Production checkpointer |
| **StateSnapshot** | Result of get_state |
| **get_state / update_state** | Read / patch current checkpoint |
| **get_state_history** | List checkpoints (time travel) |
| **time travel / fork** | Resume from old checkpoint |
| **durable execution** | Crash-safe resume |
| **interrupt()** | Pause for human input |
| **Command(resume=…)** | Continue after interrupt |
| **interrupt_before / after** | Static dev breakpoints |
| **HITL** | Human-in-the-loop |

### LangGraph - memory, multi-agent, ops

| Term | Definition |
|------|------------|
| **Store** | Cross-thread long-term memory |
| **namespace** | Store key prefix (e.g. per user) |
| **semantic memory** | Stored facts |
| **episodic memory** | Stored experiences |
| **procedural memory** | Stored evolved procedures |
| **subgraph** | Compiled graph used as node |
| **supervisor** | Router agent dispatching workers |
| **swarm / handoff** | Peer agents passing control |
| **stream_mode** | values / updates / messages / custom / debug |
| **get_stream_writer** | Emit custom stream events from node |
| **LangGraph Platform** | Managed deployment (optional) |

---

## Key Takeaways

1. **Start raw to feel the pain.** One OpenAI call teaches you what frameworks automate - memory, tools, retries, loops, persistence.

2. **One foundation carries both libraries.** Messages with strict ordering invariants + Runnables with automatic config propagation - from a single model call to a 50-node graph.

3. **LangChain is the toolbox.** Models, prompts, LCEL, structured output, tools, trim, RAG ingestion/retrieval - linear pipelines and reusable parts inside nodes.

4. **LangGraph is the control room.** State, reducers, edges, Send, Command, ReAct, checkpointer, interrupt, Store - loops and production lifecycle.

5. **The seam is one config object.** Thread it through graph → nodes → chains → models. Orphan config = orphan traces and amnesia.

6. **Debug RAG at retrieval first.** Wrong chunks → wrong answers, always. Bigger models rarely fix bad search.

7. **The model never executes tools.** Your code does. Descriptions are API docs. Destructive actions need HITL.

8. **Persistence changes what agents can be.** Checkpointer = thread memory + crash recovery + interrupts. Store = user memory across threads.

9. **Resume replays code.** Idempotent tools; no side effects before `interrupt()`.

10. **Do not over-multi-agent.** Split when prompts/tools overload; supervisor first.

---

## Your first week - day-by-day action plan

Before you touch code on Day 1, read Part 0 and A1. The plan assumes ~1–2 hours/day. Adjust pace freely.

### Day 1 - Raw API + messages

**Read:** Part 0, A1.

**Do:**

- Get an API key; run raw chat completion (Part 0 snippet).
- Repeat with `SystemMessage` + two-turn history manually appended.
- Install `langchain-core`, `langchain-openai`; invoke model with message objects.

**Nova Support milestone:** Bot answers one FAQ with a system prompt.

**Check yourself:** Explain tool_call / ToolMessage ordering without looking.

---

### Day 2 - Models, prompts, first chain

**Read:** A2, A3.

**Do:**

- Set `temperature=0`, `max_tokens`, `with_retry`.
- Build `ChatPromptTemplate` with `{role}` and `{question}`.
- Chain: `prompt | model | StrOutputParser`.

**Nova Support milestone:** Template-driven replies; swap system persona in one variable.

---

### Day 3 - LCEL RAG (ingestion)

**Read:** A4 (RAG wiring), A8.

**Do:**

- Load 3–5 help-center Markdown files.
- Split with `RecursiveCharacterTextSplitter` (800 / 15% overlap).
- Embed into Chroma; inspect one chunk's metadata.

**Nova Support milestone:** Index exists; you can print top-k chunks for a query manually.

---

### Day 4 - LCEL RAG (retrieval chain)

**Read:** A9.

**Do:**

- Build canonical parallel-gather RAG chain (Module A4 shape).
- Add grounding instruction: cite sources, say "I don't know."
- **Debug exercise:** deliberately bad chunks → see hallucination → fix retrieval not prompt.

**Nova Support milestone:** FAQ bot answers from help center with citations.

---

### Day 5 - Tools + structured output

**Read:** A5, A6.

**Do:**

- Mock `search_orders(email)` returning JSON string.
- `bind_tools`; run manual ReAct loop in a `while` (max 5 iterations).
- Add `with_structured_output` intent classifier.

**Nova Support milestone:** Bot looks up fake order by email in a script.

---

### Day 6 - LangGraph ReAct + persistence

**Read:** B1–B2, B5–B6.

**Do:**

- Replace manual loop with `create_react_agent`.
- Add `InMemorySaver`; same `thread_id` across two invokes - verify memory.
- Pass `config` with callbacks (LangSmith free tier or console logging).

**Nova Support milestone:** Multi-turn agent with tools; survives process restart if you switch to SqliteSaver.

---

### Day 7 - HITL + production shape

**Read:** B7, B10, Part C.

**Do:**

- Add `interrupt()` before a mock `issue_refund` tool.
- Resume with `Command(resume="approved")`.
- **Trap exercise:** put a print before interrupt; invoke twice; see double print - then fix by splitting node.
- Sketch PostgresSaver + API layer diagram for your real deploy.

**Nova Support milestone:** Refund requires approval; you can whiteboard full architecture.

---

### Week 2 stretch goals (optional)

| Goal | Topics |
|------|--------|
| Store user preference across threads | B8 |
| Multi-doc parallel summarize | B4 Send |
| Supervisor billing vs shipping agents | B9 |
| Hybrid retrieval for SKU search | A9 |
| Streaming UI | B10 |
| External prompt registry | A3 |

---

## Author notes

This post is designed to stand alone. APIs evolve quickly - always verify method names and import paths against official documentation before shipping.

**Official documentation:**

- LangChain Python docs: [https://python.langchain.com/docs/](https://python.langchain.com/docs/)
- LangGraph Python docs: [https://langchain-ai.github.io/langgraph/](https://langchain-ai.github.io/langgraph/)
- LangChain API reference: [https://python.langchain.com/api_reference/](https://python.langchain.com/api_reference/)
- LangGraph reference: [https://langchain-ai.github.io/langgraph/reference/](https://langchain-ai.github.io/langgraph/reference/)

**Provider docs** (for underlying API behavior - tool calling, JSON mode, rate limits):

- OpenAI: [https://platform.openai.com/docs](https://platform.openai.com/docs)
- Anthropic: [https://docs.anthropic.com](https://docs.anthropic.com)

LangChain and LangGraph are open-source projects by LangChain Inc. This article is an independent educational synthesis - not affiliated with or endorsed by LangChain Inc.

If Nova Support makes sense in your head - messages, chains, graphs, checkpoints, interrupts - you are ready to build. The rest is repetition, tracing bad runs, and tuning retrieval. Welcome to the floor.

