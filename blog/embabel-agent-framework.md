---
title: "Embabel Agent Framework: Build Smarter AI Agents on the JVM"
date: 2025-05-21
excerpt: A deep-dive into Embabel - the JVM-native agent framework that replaces brittle workflows with type-driven, goal-oriented AI planning. Learn the core concepts, write your first agent, and understand why it's a step ahead of LangGraph, CrewAI, and similar tools.
---

AI agents have gone from research curiosity to production reality in less than two years. But with that speed came a wave of brittle, hand-stitched workflows: rigid state machines, prompt spaghetti, and opaque execution paths that are nearly impossible to test or debug.

[Embabel](https://github.com/embabel/embabel-agent) is a new agent framework built by Rod Johnson (the creator of Spring) and contributors, designed specifically for the JVM. It treats agent orchestration as a first-class engineering problem: strong typing, dynamic planning, testability, and deep Spring integration. This post walks through everything you need to understand, configure, and build with it.

---

## Why Another Agent Framework?

LLMs are powerful, but raw LLM calls aren't agents. Real-world agent systems need:

- **Explainability** - why did the agent make the choices it did?
- **Discoverability** - how do we reliably route between tools without confusing the model?
- **LLM mixing** - different tasks deserve different models; one "God model" is wasteful and expensive
- **Guardrails** - the ability to intercept and constrain execution at any point
- **Composability** - agents that compose into larger federations

Embabel solves all of these at the framework level, so you don't rebuild them on every project. It also introduces a concept called **"code agency"** alongside "LLM agency", the idea that code and LLMs share the decision-making, rather than the LLM orchestrating everything.

---

## Core Concepts

Embabel models agentic flows around four building blocks:

**Actions** are the steps an agent can take. They are plain Java or Kotlin methods annotated with `@Action`. An action takes typed inputs and produces typed outputs and those types are the whole trick.

**Goals** define what an agent is trying to achieve. A method annotated with both `@Action` and `@AchievesGoal` signals the terminal step of an agent's work.

**Conditions** are boolean evaluations that the planner checks before and after actions. Most of the time you don't write them explicitly, they're inferred automatically from method signatures.

**Domain Objects** are the strongly-typed data structures that flow between actions. They're not just dumb DTOs: they can carry behavior and expose methods to LLMs via `@Tool` annotations.

Together, these let Embabel construct an **execution plan** a sequence of actions to reach a goal using a real AI planning algorithm (A\* GOAP), not a hand-written state machine.

---

## The Planning Engine: GOAP + OODA

Most frameworks execute agents as linear pipelines or simple graphs. Embabel goes further with **Goal-Oriented Action Planning (GOAP)**, a technique borrowed from game AI.

The planner works like this after each action:

1. Examine the current **blackboard** (shared state)
2. Identify which actions are executable given available data
3. Run A\* search to find an optimal path to the goal
4. Execute the next action, then replan

This is an **OODA loop** (Observe–Orient–Decide–Act). The agent adapts after every step. If an action returns `null` or produces unexpected output, the planner finds an alternative path rather than crashing.

Practically this means: adding a new action to your codebase *automatically* makes it available to the planner. No graph edits, no FSM updates.

---

## Your First Agent: Seeing Type-Driven Flow in Action

Here's a complete, annotated example straight from the Embabel examples repo  a `StarNewsFinder` that takes someone's star sign and writes a personalized news summary based on their horoscope:

```java
@Agent(description = "Find news based on a person's star sign")
public class StarNewsFinder {

    private final HoroscopeService horoscopeService;
    private final int storyCount;

    public StarNewsFinder(HoroscopeService horoscopeService,
                          @Value("${star-news-finder.story.count:5}") int storyCount) {
        this.horoscopeService = horoscopeService;
        this.storyCount = storyCount;
    }

    @Action
    public StarPerson extractStarPerson(UserInput userInput, OperationContext context) {
        return context.ai()
            .withLlm(OpenAiModels.GPT_41)
            .createObject("""
                Create a person from this user input, extracting their name and star sign:
                %s""".formatted(userInput.getContent()), StarPerson.class);
    }

    @Action
    public Horoscope retrieveHoroscope(StarPerson starPerson) {
        // Regular Spring service no LLM needed here
        return new Horoscope(horoscopeService.dailyHoroscope(starPerson.sign()));
    }

    @Action(toolGroups = {CoreToolGroups.WEB})
    public RelevantNewsStories findNewsStories(
            StarPerson person, Horoscope horoscope, OperationContext context) {
        var prompt = """
            %s is an astrology believer with the sign %s.
            Their horoscope for today is: %s
            Given this, use web tools to find %d relevant news stories.
            """.formatted(person.name(), person.sign(), horoscope.summary(), storyCount);

        return context.ai().withDefaultLlm().createObject(prompt, RelevantNewsStories.class);
    }

    @AchievesGoal(description = "Write an amusing writeup based on horoscope and news")
    @Action
    public Writeup writeup(StarPerson person, RelevantNewsStories stories,
                           Horoscope horoscope, OperationContext context) {
        var llm = LlmOptions.fromCriteria(ModelSelectionCriteria.getAuto())
            .withTemperature(0.9);

        var prompt = """
            Write something amusing for %s based on their horoscope and these news stories.
            Format as Markdown with links.
            """.formatted(person.name());

        return context.ai().withLlm(llm).createObject(prompt, Writeup.class);
    }
}
```

**What just happened?** Embabel reads the method signatures and infers the entire execution plan without any wiring code:

```
UserInput
  → extractStarPerson()  → StarPerson
  → retrieveHoroscope()  → Horoscope
  → findNewsStories()    → RelevantNewsStories
  → writeup()            → Writeup  ✓ GOAL
```

No YAML pipeline. No graph nodes. No `chain.pipe(step1).pipe(step2)`. The types *are* the workflow.

---

## The Blackboard: Shared State Done Right

Every agent process has a **Blackboard** - a shared, immutable key-value store indexed by type. Actions read their inputs from the blackboard (injected automatically by parameter type) and write their outputs back to it (automatically, from the return value).

Key properties:

- Objects are indexed by type, not by string key, no magic maps
- Latest object of a given type is the default; all versions are kept for history
- Once added, objects are immutable and new versions can be added but old ones aren't mutated
- The blackboard drives planning: an action becomes eligible when all its required input types are present

You rarely interact with the blackboard directly. The framework handles it. But understanding it explains why Embabel's data flow is so much cleaner than string-keyed context bags.

---

## Domain Objects with Behavior

This is one of Embabel's most distinctive ideas. Domain objects aren't just data carriers, they can expose methods to LLMs via `@Tool`:

```java
@Entity
public class Customer {
    private String name;
    private LoyaltyLevel loyaltyLevel;
    private List<Order> orders;

    @Tool(description = "Calculate the customer's loyalty discount percentage")
    public BigDecimal getLoyaltyDiscount() {
        return loyaltyLevel.calculateDiscount(orders.size());
    }

    @Tool(description = "Check if customer is eligible for premium service")
    public boolean isPremiumEligible() {
        return orders.stream()
            .mapToDouble(Order::getTotal)
            .sum() > 1000.0;
    }

    // This stays private not exposed to the LLM
    private void updateLoyaltyLevel() { ... }
}
```

When this `Customer` object is passed to an action that calls an LLM, the LLM can invoke `getLoyaltyDiscount()` and `isPremiumEligible()` as tools but `updateLoyaltyLevel()` stays hidden. You decide what the model can see and call. This is **selective tool exposure**, and it's a big deal for both capability and safety.

---

## Setting Up a Project

### Prerequisites

- Java 21+
- Maven 3.9+ or Gradle
- An OpenAI or Anthropic API key

### Quickstart with the Template

```bash
# Use the Java template on GitHub
# → https://github.com/embabel/java-agent-template
# Click "Use this template", then clone your new repo

# Or use the project creator CLI
uvx --from git+https://github.com/embabel/project-creator.git project-creator
```

### Maven Dependency

```xml
<dependency>
    <groupId>com.embabel.agent</groupId>
    <artifactId>embabel-agent-starter</artifactId>
    <version>${embabel-agent.version}</version>
</dependency>
```

Add the Embabel repository to your `pom.xml`:

```xml
<repository>
    <id>embabel-snapshots</id>
    <url>https://repo.embabel.com/artifactory/libs-snapshot</url>
    <snapshots><enabled>true</enabled></snapshots>
</repository>
```

### Enable the Framework

```java
@SpringBootApplication
@EnableAgentShell
@EnableAgents(
    loggingTheme = LoggingThemes.STAR_WARS,
    localModels = { "docker" },
    mcpClients = { "docker" }
)
public class MyAgentApplication {
    public static void main(String[] args) {
        SpringApplication.run(MyAgentApplication.class, args);
    }
}
```

### Environment Setup

```bash
export OPENAI_API_KEY="your_openai_key"
export ANTHROPIC_API_KEY="your_anthropic_key"  # optional
```

### Running the Shell

```bash
git clone https://github.com/embabel/embabel-agent-examples
cd embabel-agent-examples/scripts/java
./shell.sh
```

Inside the shell:

```
# Run an agent from natural language input
execute "Lynda is a Scorpio, find news for her" -p -r

# -p logs prompts, -r logs LLM responses
# Use !! to repeat the last command (Spring Shell history survives restarts)
```

---

## LLM Mixing: The Right Model for the Right Step

Because Embabel breaks flows into discrete actions, each action can use a different LLM. The `WriteAndReviewAgent` example makes this concrete:

```java
@Agent(description = "Agent that writes and reviews stories")
public class WriteAndReviewAgent {

    @Action
    public Story writeStory(UserInput userInput, OperationContext context) {
        var writer = LlmOptions.withModel(OpenAiModels.GPT_4O_MINI)
            .withTemperature(0.8)          // High temp → creative
            .withPersona("You are a creative storyteller");

        return context.ai().withLlm(writer)
            .createObject("Write a story about: " + userInput.getContent(), Story.class);
    }

    @AchievesGoal(description = "Review and improve the story")
    @Action
    public ReviewedStory reviewStory(Story story, OperationContext context) {
        var reviewer = LlmOptions.withModel(OpenAiModels.GPT_4O_MINI)
            .withTemperature(0.2)          // Low temp → analytical
            .withPersona("You are a careful editor and reviewer");

        return context.ai().withLlm(reviewer)
            .createObject("Review this story and suggest improvements: " + story.text(),
                          ReviewedStory.class);
    }
}
```

You're not stuck choosing one model per application. Every LLM call is independently configured model, temperature, persona, tool groups. This is critical for cost, quality, and privacy (e.g. using a local Ollama model for a sensitive step).

---

## Testing: First-Class, Not an Afterthought

Embabel agents are POJOs. Actions are methods. This means they're trivially unit-testable without mocking a cloud service:

```java
class WriteAndReviewAgentTest {

    @Test
    void testWriteAndReviewAgent() {
        var context = FakeOperationContext.create();
        var promptRunner = (FakePromptRunner) context.promptRunner();
        context.expectResponse(new Story("Once upon a time Sir Galahad..."));

        var agent = new WriteAndReviewAgent(200, 400);
        agent.craftStory(new UserInput("Tell me a story about a brave knight",
                         Instant.now()), context);

        // Assert on the actual prompt sent to the LLM
        String prompt = promptRunner.getLlmInvocations().getFirst().getPrompt();
        assertTrue(prompt.contains("knight"));

        // Assert on LLM hyperparameters
        double temp = promptRunner.getLlmInvocations().getFirst()
                          .getInteraction().getLlm().getTemperature();
        assertEquals(0.9, temp, 0.01);
    }
}
```

`FakeOperationContext` and `FakePromptRunner` intercept LLM calls and let you inspect prompts, temperature, tool group assignments and more, all without a real API call. For integration testing, Embabel builds on Spring's testing infrastructure, including Testcontainers support.

---

## Tool Groups and MCP Integration

Embabel introduces **tool groups** as a layer of indirection: your action doesn't ask for "Brave Search", it asks for `CoreToolGroups.WEB`, and the framework resolves that to whatever web tool is available in the current environment.

```java
@Action(toolGroups = {CoreToolGroups.WEB})
public ResearchResult doResearch(Query query, OperationContext context) {
    return context.ai().withDefaultLlm()
        .createObject("Research this topic using web tools: " + query.topic(),
                      ResearchResult.class);
}
```

Tool groups are often backed by **MCP (Model Context Protocol)** servers, configured via Spring:

```java
@Configuration
class ToolGroupsConfiguration(private val mcpSyncClients: List<McpSyncClient>) {

    @Bean
    fun mcpWebToolsGroup(): ToolGroup {
        return McpToolGroup(
            name = "docker-web",
            description = CoreToolGroups.WEB_DESCRIPTION,
            permissions = setOf(ToolGroupPermission.INTERNET_ACCESS),
            clients = mcpSyncClients,
            filter = { it.toolDefinition.name().contains("brave") }
        );
    }
}
```

Embabel also supports **A2A (Agent-to-Agent)** communication, meaning your agents can be exposed as MCP servers consumed by Claude Desktop or other tools.

---

## Invoking Agents Programmatically

In web applications you'll typically invoke agents from a controller, not a shell. `AgentInvocation` provides a type-safe, async-friendly API:

```java
// Synchronous
var invocation = AgentInvocation.create(agentPlatform, TravelPlan.class);
TravelPlan plan = invocation.invoke(travelRequest);

// Async (for long-running agents in web controllers)
CompletableFuture<TravelPlan> future = invocation.invokeAsync(travelRequest);
future.thenAccept(plan -> logger.info("Done: {}", plan));
```

With custom process options:

```java
var invocation = AgentInvocation.builder(agentPlatform)
    .options(options -> options
        .verbosity(v -> v.showPrompts(true).showResponses(true)))
    .build(TravelPlan.class);
```

---

## Key Takeaways

- **Type-driven planning**: Embabel infers the execution plan from Java method signatures alone, no graph wiring, no YAML pipelines
- **GOAP + replanning**: After every action, the planner re-evaluates the world state and can take a completely different path to the goal
- **Domain objects with behavior**: `@Tool` on domain object methods gives LLMs selective access to business logic with full encapsulation control
- **Per-action LLM mixing**: Different actions can use different models, temperatures, and personas for optimal cost and quality for every step
- **First-class testability**: Agents are POJOs; `FakeOperationContext` lets you test prompts and hyperparameters without a real LLM
- **Deep Spring integration**: All of Spring's ecosystem  DI, AOP, transactions, Testcontainers to works exactly as expected

---

*References and further reading:*
- [Official Embabel Docs](https://docs.embabel.com/embabel-agent/guide/0.1.2-SNAPSHOT/)
- [Embabel Agent Examples Repository](https://github.com/embabel/embabel-agent-examples)
- [Java Agent Template](https://github.com/embabel/java-agent-template)
- [Kotlin Agent Template](https://github.com/embabel/kotlin-agent-template)
- [Rod Johnson's Medium - Embabel: A New Agent Platform For the JVM](https://medium.com/@springrod/embabel-a-new-agent-platform-for-the-jvm-1c83402e0014)
- [Rod Johnson's Medium - The Embabel Vision](https://medium.com/@springrod/the-embabel-vision-967654f13793)
- [GOAP - Goal Oriented Action Planning](https://en.wikipedia.org/wiki/Goal-oriented_action_planning)
