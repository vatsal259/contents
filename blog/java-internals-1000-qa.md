---
title: "Know the JVM, My Brother. Offers Follow."
date: 2026-08-06
excerpt: A thousand Q&As on JVM guts - memory, GC, concurrency, proxies, classloading - and the basics that still break production. Built for revision, not fluff.
---

> Most production Java bugs are not exotic algorithms. They are **misunderstood runtime behavior** - a proxy that does not wrap `this`, a `HashMap` key that mutated its hash, a `volatile` mistaken for atomicity, a classloader that pinned Metaspace forever.

This is a deliberate **drill list**: 1000 questions and answers on internals and fundamentals that are too important to hand-wave. Use it for spaced repetition, interview warm-ups, or a pre-production checklist.

## At a glance

| | |
|---|---|
| **Format** | Cover → speak → check |
| **Depth** | Internals first (JVM, JMM, GC, proxies) + landmines |
| **Runtime** | HotSpot / OpenJDK mindset (8 → 21+) |
| **Pace** | ~50 / day → about three weeks |

## How to drill

1. **Cover the answer** - say it out loud before you peek.
2. **Chase the why** - flag names without mental models do not stick.
3. **Draw the hard ones** - proxies, happens-before, and GC deserve a sketch.
4. **Mark misses** - redo anything you hedged on within 48 hours.

> **Three distinctions that prevent entire bug classes:** identity vs equality · visibility vs atomicity · proxy vs target.

## Topic map

Jump to a section. Ranges are contiguous so you can slice a revision session cleanly.

| # | Questions | Topic | Focus |
|---:|---|---|---|
| 1 | **Q1–Q60** | JVM architecture & execution | Runtime data areas, JIT |
| 2 | **Q61–Q90** | Class loading, linking & modules | Loaders, init, JPMS |
| 3 | **Q91–Q179** | Memory layout, references & garbage collection | GC, refs, leaks |
| 4 | **Q180–Q274** | Objects, identity, equals & initialization | Lifecycle, contracts |
| 5 | **Q275–Q301** | Strings, primitives & wrappers | Pool, boxing |
| 6 | **Q302–Q469** | Generics, type erasure & collections | Erasure, HashMap |
| 7 | **Q470–Q605** | Concurrency & the Java Memory Model | JMM, locks, pools |
| 8 | **Q606–Q645** | Reflection, method handles & dynamic proxies | JDK/CGLIB proxies |
| 9 | **Q646–Q675** | Serialization, exceptions & errors | Ser risk, linkage |
| 10 | **Q676–Q690** | I/O, NIO & files | Buffers, channels |
| 11 | **Q691–Q730** | Lambdas, streams & modern language features | indy, records |
| 12 | **Q731–Q760** | Bytecode, JIT & HotSpot diagnostics | javap, tools |
| 13 | **Q761–Q962** | Production landmines & systems internals | 2am bugs |
| 14 | **Q963–Q1000** | Frameworks, JDBC, security & systems-facing Java | Spring, JDBC, TLS |

---

## JVM architecture & execution

`Q1–Q60` · The machine under `java Main` - stacks, heap, metaspace, interpreter, and JIT.

### Q1 · What is the JVM?

> The Java Virtual Machine is a process virtual machine that loads bytecode, verifies it, manages memory, and executes programs. It makes Java 'write once, run anywhere' by abstracting the OS and CPU. Application code sees objects and threads; the JVM owns class loading, memory, and how bytecode becomes machine code. Knowing its subsystems is what makes GC logs, thread dumps, and `OutOfMemoryError` messages actionable.

### Q2 · What is the difference between JDK, JRE, and JVM?

> JDK = compiler + tools + JRE. JRE = JVM + core libraries needed to run apps. JVM = the runtime engine that executes bytecode. You need JDK to develop, JRE/JVM to run. In modern distributions the lines blur (many 'JRE' installs are JDK builds), but the conceptual split still helps: develop with a JDK, reason about production failures at the JVM layer, and remember libraries live beside-not inside-the VM.

### Q3 · What happens when you run `java Main`?

> The launcher creates a JVM, loads the bootstrap classes, finds Main via the classpath/module path, links it, initializes it, then invokes `public static void main(String[])` on a new thread. Failures here are usually classpath/module-path, wrong main class, or static-init errors wrapping as `ExceptionInInitializerError` / `NoClassDefFoundError`. The launch sequence is the first place to debug 'works in IDE, dies in container'.

### Q4 · What are the main subsystems of the HotSpot JVM?

> Class loader subsystem, runtime data areas (heap, stacks, metaspace, PC registers, native method stacks), execution engine (interpreter + JIT), and native method interface (JNI). Prefer measuring with JFR/`jcmd` over folklore. Change one flag at a time and keep GC/heap settings aligned with container memory limits.

### Q5 · What is bytecode?

> Platform-independent instructions produced by `javac` (or other compilers) stored in `.class` files. The JVM interprets or JIT-compiles them to native machine code. `javap -c -p -v` is the fastest way to see what the compiler really emitted (bridges, indy, synthetics). Reading a little bytecode pays off when diagnosing unexpected allocations or dispatch. Bytecode is verified for type safety before execution. The same `.class` can run on any compatible JVM - that portability is why HotSpot can interpret first and JIT later without changing your sources.

### Q6 · What is the program counter (PC) register?

> Per-thread register pointing at the current bytecode instruction. Native methods may leave it undefined. Essential for the interpreter's fetch-decode-execute loop. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q7 · What is the Java stack (JVM stack)?

> A per-thread stack of frames. Each method call pushes a frame holding locals, operand stack, and a reference to the constant pool. Map symptoms to a subsystem (loader, heap/GC, stacks, JIT) and collect the matching artifact before changing random flags.

### Q8 · What is a stack frame?

> The activation record for one method invocation: local variable array, operand stack, dynamic linking info, and return address / exception dispatch data. Prefer measuring with JFR/`jcmd` over folklore. Map symptoms to a subsystem (loader, heap/GC, stacks, JIT) and collect the matching artifact before changing random flags.

### Q9 · What is the operand stack?

> A LIFO area inside a frame where bytecode pushes/pops values for arithmetic, method args, and returns. Depth is fixed at compile time and verified. Prefer measuring with JFR/`jcmd` over folklore. Change one flag at a time and keep GC/heap settings aligned with container memory limits.

### Q10 · What is Metaspace?

> Native off-heap area (since Java 8) storing class metadata: method bytecode, constant pool, annotations, etc. Replaced PermGen. Grows by default; can OOM with `OutOfMemoryError: Metaspace`. Classloader leaks (especially with generated classes, proxies, or hot-redeploy) show up here. Monitor with NMT / Metaspace MXBean; fix the loader lifecycle rather than only raising `-XX:MaxMetaspaceSize`. Unlike the Java heap, Metaspace lives in native memory and can grow until capped. If you see Metaspace OOMs after redeploys, hunt ClassLoader leaks before raising the ceiling again.

### Q11 · What was PermGen and why was it removed?

> Permanent Generation held class metadata on the Java heap (hotspot). It had a fixed max size and caused classloader leaks/OOM. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q12 · What is the method area conceptually?

> In the JVM specification the method area holds per-class metadata: the runtime constant pool, field and method data, and method code. HotSpot largely implements this with Metaspace (native memory) plus some heap-resident structures. When Metaspace grows without bound, you are usually retaining class loaders - not 'running out of heap' in the classic sense.

### Q13 · What is the heap?

> Shared memory where objects and arrays are allocated. Divided into generations (young/old) in typical HotSpot collectors. Subject to GC. Sizing (`-Xms`/`-Xmx`), GC choice, and allocation rate determine latency far more than micro-optimizing getters. When diagnosing, separate 'live set too large' (leak or cache) from 'allocation churn' (too many short-lived objects). Almost every business object you `new` lands here (unless escape analysis scalar-replaces it). Heap sizing should track live set and allocation rate; containers need flags that respect cgroup limits.

### Q14 · What is the young generation?

> Heap region for short-lived objects: Eden + two Survivor spaces (S0/S1). Most objects die here; minor GCs collect it frequently with short pauses. If the young gen is too small you promote early and pressure old gen; too large and minor pauses grow. Watch promotion rate and survivor occupancy in GC logs before turning random flags.

### Q15 · What is the old (tenured) generation?

> Heap region for long-lived objects promoted from young gen. Collected less often by major/full GC or concurrent collectors. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. The right collector depends on latency vs throughput goals and heap size - not fashion.

### Q16 · What is Eden space?

> Part of young gen where new objects are usually allocated (with TLAB). When Eden fills, a minor GC copies live objects to a Survivor space. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. The right collector depends on latency vs throughput goals and heap size - not fashion.

### Q17 · What are Survivor spaces?

> Two equally sized young-gen regions (from/to). Live objects are copied between them each minor GC; age increments until promotion threshold. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. The right collector depends on latency vs throughput goals and heap size - not fashion.

### Q18 · What is object promotion?

> Moving an object from young to old generation after surviving enough GC cycles (or when survivors are too full - premature promotion). Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q19 · What is a TLAB?

> Thread-Local Allocation Buffer: a small Eden chunk reserved per thread so allocation is a pointer bump without locking. Reduces allocation contention. Most allocations never contend on a global heap lock; they bump a pointer in the TLAB. When a TLAB is exhausted the thread gets another. Oversized objects may take the slow path outside the TLAB.

### Q20 · What is pointer bumping allocation?

> Fast allocation: advance a top pointer within a free region (TLAB/Eden). Used when free space is contiguous. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q21 · What is the native method stack?

> Per-thread stack for JNI/native frames. Separate from the Java stack; can also overflow (`StackOverflowError`). Prefer measuring with JFR/`jcmd` over folklore. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q22 · What is JNI?

> Java Native Interface: C/C++ API to call native code from Java and vice versa. Used for OS APIs, performance-critical code, and legacy libs. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q23 · What is the runtime constant pool?

> Per-class table of literals and symbolic references (classes, fields, methods) resolved at link/runtime. Lives with class metadata. `javap -c -p -v` is the fastest way to see what the compiler really emitted (bridges, indy, synthetics). Reading a little bytecode pays off when diagnosing unexpected allocations or dispatch.

### Q24 · What does `OutOfMemoryError: Java heap space` mean?

> The heap cannot satisfy an allocation even after GC. Causes: memory leak, undersized `-Xmx`, huge caches, or unexpectedly large data. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Exceptions are for uncommon paths - using them for ordinary control flow is expensive and noisy.

### Q25 · What does `StackOverflowError` mean?

> A thread's Java (or native) stack exceeded its limit - usually deep/unbounded recursion or huge local frames. Fix: reduce depth or raise `-Xss` carefully. Deep recursion, huge local frames, or cyclic calls through proxies/AOP can exhaust `-Xss`. Prefer rewriting recursion to iteration for unbounded depth; raising stack size is a temporary bandage.

### Q26 · What is `-Xms` vs `-Xmx`?

> `-Xms` sets initial heap size; `-Xmx` sets maximum heap. Setting them equal avoids heap resizing pauses. Prefer measuring with JFR/`jcmd` over folklore. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q27 · What is `-Xss`?

> Sets the Java thread stack size. Larger stacks allow deeper recursion but reduce max thread count for a given memory budget. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q28 · What is compressed oops?

> Ordinary Object Pointers stored as 32-bit offsets when heap is under ~32GB, saving memory and improving cache use. Enabled by default in that range on 64-bit HotSpot. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q29 · What is compressed class pointers?

> Similar compression for klass pointers into Metaspace, reducing object header size on 64-bit JVMs. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q30 · What is an object header in HotSpot?

> Mark word (hash, locking, GC age/bits) + klass pointer. Arrays also store length. Headers enable identity hash, biased/legacy locking metadata, and GC. Map symptoms to a subsystem (loader, heap/GC, stacks, JIT) and collect the matching artifact before changing random flags.

### Q31 · What is the mark word used for?

> Stores identity hash code, GC age, and lock state (unlocked / thin / fat / biased historically). Layout is word-size dependent. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q32 · What is identity hashCode?

> `System.identityHashCode(obj)` - typically derived from object address or stored in the mark word once computed. Unaffected by overridden `hashCode()`. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Add unit tests for symmetry, transitivity, and consistency with `hashCode`/`compareTo`.

### Q33 · What is escape analysis?

> JIT analysis deciding whether an object escapes its allocating method/thread. If not, the JIT may scalar-replace it or allocate on stack, reducing heap pressure. If the JIT proves an object never leaves the method/thread, it may scalar-replace fields into registers/locals or eliminate allocations and even elide locks on non-escaping monitors. Microbenchmarks that 'force' escape hide these wins.

### Q34 · What is scalar replacement?

> Optimization replacing an non-escaping object with its fields as locals - no heap allocation. Enabled via escape analysis. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q35 · What is the interpreter in HotSpot?

> Starts executing bytecode quickly. Profiles call sites and branches; hot methods are queued for JIT compilation. Prefer measuring with JFR/`jcmd` over folklore. Map symptoms to a subsystem (loader, heap/GC, stacks, JIT) and collect the matching artifact before changing random flags.

### Q36 · What is JIT compilation?

> Just-In-Time: compile hot bytecode to native code at runtime. Improves peak performance using profiling (types, branches). Warmup matters: early traffic runs interpreted/C1, then hot methods reach C2 (or Graal). Speculative opts can deoptimize when profiles change - that is normal, not a bug. Profile with JFR/async-profiler after warmup, not during the first seconds.

### Q37 · What are C1 and C2 compilers?

> HotSpot tiers: C1 (client) compiles faster with lighter opts; C2 (server) spends more time for highly optimized code. Tiered compilation uses both. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q38 · What is tiered compilation?

> Methods progress through compilation levels (interp → C1 → C2) based on invocation/backedge counters, balancing warmup and peak speed. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q39 · What is on-stack replacement (OSR)?

> Compiling and switching a long-running loop from interpreted to compiled code mid-execution without waiting for method exit. Prefer measuring with JFR/`jcmd` over folklore. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q40 · What is deoptimization?

> Throwing away compiled code and continuing in interpreter (or less optimized code) when speculative assumptions fail (e.g., uncommon trap). Most production defects here are lifecycle or encoding mistakes - close resources and name the charset.

### Q41 · What is an uncommon trap?

> A JIT placeholder for a rare path. When hit, the JVM deoptimizes and interprets, then may recompile with better knowledge. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q42 · What is speculative optimization?

> JIT bets on observed types/branches (e.g., monomorphic call). Fast until the bet fails, then deopt. Most production defects here are lifecycle or encoding mistakes - close resources and name the charset.

### Q43 · What is inlining?

> Replacing a call with the callee body. Critical HotSpot opt; enables further analysis. Limited by size and virtuality. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q44 · What is bimorphic / megamorphic call site?

> Call site with 2 receiver types (bimorphic) can still optimize; many types (megamorphic) often use vtable/itable and hurt inlining. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q45 · What is a safepoint?

> A point where all Java threads can be paused consistently for GC, deopt, biased lock revocation (legacy), etc. Threads poll for safepoint requests. Threads cooperate by polling; the VM cannot usually stop a thread at an arbitrary machine instruction. Long time-to-safepoint (TTSP) from tight loops without polls used to be a classic latency issue - modern JITs insert polls carefully.

### Q46 · What is a safepoint poll?

> Compiled code periodically checks a page/flag so the VM can bring threads to a safepoint without arbitrary preemption. Threads cooperate by polling; the VM cannot usually stop a thread at an arbitrary machine instruction. Long time-to-safepoint (TTSP) from tight loops without polls used to be a classic latency issue - modern JITs insert polls carefully.

### Q47 · What is Stop-The-World (STW)?

> A pause where application threads are halted (at safepoints) so the VM can do GC roots scanning, compaction, etc. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q48 · What is the difference between minor, major, and full GC?

> Minor = young gen. Major traditionally = old gen. Full = whole heap (and often metaspace unloading). Exact meaning varies by collector. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. The right collector depends on latency vs throughput goals and heap size - not fashion.

### Q49 · What is a GC root?

> A reference the collector treats as live: thread stacks, static fields, JNI globals, etc. Reachability starts from roots. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. The right collector depends on latency vs throughput goals and heap size - not fashion.

### Q50 · What does reachability mean for GC?

> An object is live if a path of references from any GC root reaches it. Unreachable objects are eligible for collection. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. The right collector depends on latency vs throughput goals and heap size - not fashion.

### Q51 · What is CDS / AppCDS?

> Class Data Sharing: archive class metadata to speed startup and save memory. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q52 · What is AOT compilation (Graal native)?

> Ahead-of-time to native binary means fast startup, limited peak opt/reflection config needed. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q53 · HotSpot vs OpenJ9 briefly?

> Different JVMs: GC/JIT strategies differ; same bytecode usually. Prefer measuring with JFR/`jcmd` over folklore. Change one flag at a time and keep GC/heap settings aligned with container memory limits. Map symptoms to a subsystem (loader, heap/GC, stacks, JIT) and collect the matching artifact before changing random flags.

### Q54 · What is JVMTI?

> Native tooling interface for debuggers/profilers/agents. Prefer measuring with JFR/`jcmd` over folklore. Change one flag at a time and keep GC/heap settings aligned with container memory limits. Map symptoms to a subsystem (loader, heap/GC, stacks, JIT) and collect the matching artifact before changing random flags.

### Q55 · jcmd useful subcommands?

> `jcmd <pid>` is the modern Swiss-army knife for live JDKs: `GC.heap_dump`, `GC.run`, `Thread.print`, `VM.native_memory`, `VM.flags`, and `VM.system_properties` cover most first-response needs. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q56 · Flight Recorder (JFR)?

> Java Flight Recorder captures timed events (GC, allocations, locks, I/O) with low overhead suitable for production. Start recordings on demand or continuously, then open them in JDK Mission Control. It answers 'what was the JVM doing when latency spiked?' better than guessing from logs alone.

### Q57 · Async-profiler / perf relationship?

> Sampling profilers using perf/os signals - find CPU hot methods without heavy STW. Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q58 · What is biased locking removal impact?

> Modern JDKs removed biased locking; synchronize still fine - less surprising revocation pauses. Know it for reading older material and GC/safepoint war stories. On modern JDKs the story is thin/fat locks and contending CAS - focus on reducing lock scope and contention rather than nostalgia flags.

### Q59 · Thread dump READING basics?

> Look for BLOCKED on monitors, deadlocks section, RUNNABLE stuck in I/O, parked locks. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q60 · What is a native stack frame in dumps?

> Thread in JNI/OS calls - CPU samples may show C frames. Prefer measuring with JFR/`jcmd` over folklore. Change one flag at a time and keep GC/heap settings aligned with container memory limits. Map symptoms to a subsystem (loader, heap/GC, stacks, JIT) and collect the matching artifact before changing random flags.

---

## Class loading, linking & modules

`Q61–Q90` · How bytes become `Class` objects, who loads them, and why two loaders mean two types.

### Q61 · What are the phases of class loading?

> Loading (find bytes, create Class), Linking (verify, prepare, optionally resolve), Initialization (run static initializers / static field inits). Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q62 · What happens in verification?

> Bytecode and structural checks: stack map frames, type safety, illegal jumps, access rules - prevents corrupt classes from crashing the VM. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q63 · What happens in preparation?

> Allocate memory for static fields and set default values (0/null/false). Explicit initializers run later during initialization. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q64 · What is resolution in linking?

> Turn symbolic references in the constant pool into direct references (classes, fields, methods). Can be lazy until first use. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q65 · When does class initialization run?

> Before first active use: new, static method/field access (non-constant), reflection certain ops, subclass init that requires super init. Synchronized per class. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q66 · What is the bootstrap class loader?

> The bootstrap class loader is the built-in root loader responsible for the core modules/classes such as `java.base`. In the Java API it appears as `null` from `Class.getClassLoader()` for those classes. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q67 · What is the platform (extension) class loader?

> The platform class loader sits above the application loader and loads platform / JDK extension modules. Its parent is the bootstrap loader. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q68 · What is the system/application class loader?

> The application (system) class loader loads types from the classpath / module path of your app - usually including your `main` class. It is the loader most application code sees by default. Containers may install child loaders beneath or beside it, which is why 'works locally' classpath assumptions fail in servers.

### Q69 · What is the parent-delegation model?

> Before loading, a loader asks its parent. Prevents user classes from spoofing core APIs and ensures unique Class identity per loader namespace. Delegation protects `java.lang.*` from being replaced by application classes and keeps a single Class identity for core types. Break it only with clear isolation needs (plugins), and understand that each loader defines a separate namespace. Custom loaders should call the parent first in normal designs. Parent-last / child-first loaders exist for plugin isolation but make `ClassCastException` and 'same class twice' bugs more likely.

### Q70 · Why can the same class file become two Class objects?

> Class identity = fully qualified name + defining class loader. Different loaders ⇒ different types; casting between them fails. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q71 · What is a custom ClassLoader used for?

> Plugin isolation, hot reload, shaded dependency isolation, bytecode weaving at load time, encrypting class bytes. Class identity is name + defining loader - the same bytes under two loaders are different types. Most 'it works in IDE but not in the server' bugs trace to loader or module-path mismatches.

### Q72 · What is `Class.forName` vs `ClassLoader.loadClass`?

> `forName` typically initializes the class (unless flag false). `loadClass` loads/links but may not initialize until active use. Class identity is name + defining loader - the same bytes under two loaders are different types. Most 'it works in IDE but not in the server' bugs trace to loader or module-path mismatches.

### Q73 · What is classpath vs module path?

> Classpath = unnamed module, classic path scanning. Module path = explicit modules with reads/exports. Mixing has rules (unnamed reads all). Class identity is name + defining loader - the same bytes under two loaders are different types. Most 'it works in IDE but not in the server' bugs trace to loader or module-path mismatches. Explicit `requires`/`exports`/`opens` make dependencies visible and reflection constrained. Most migration pain is split packages and libraries that assumed free classpath access.

### Q74 · What is the unnamed module?

> Classpath code lives in an unnamed module that reads every module, but named modules do not read it by default. Class identity is name + defining loader - the same bytes under two loaders are different types. Most 'it works in IDE but not in the server' bugs trace to loader or module-path mismatches. Explicit `requires`/`exports`/`opens` make dependencies visible and reflection constrained. Most migration pain is split packages and libraries that assumed free classpath access.

### Q75 · What does `NoClassDefFoundError` mean?

> Class was present at compile time but failed to load/initialize at runtime (missing jar, failed static init earlier). Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Exceptions are for uncommon paths - using them for ordinary control flow is expensive and noisy.

### Q76 · What does `ClassNotFoundException` mean?

> Checked exception from reflective/explicit load when the loader cannot find the class. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Exceptions are for uncommon paths - using them for ordinary control flow is expensive and noisy.

### Q77 · What does `ExceptionInInitializerError` mean?

> A static initializer threw an exception; wrapped so later uses surface as NoClassDefFoundError. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Exceptions are for uncommon paths - using them for ordinary control flow is expensive and noisy.

### Q78 · What is class unloading?

> Classes can be GC'd when their loader is unreachable and no Class/instances remain. Needs collectors that unload (and no leaks via statics/ThreadLocals). Classes unload only when their defining loader becomes unreachable. Static caches, ThreadLocals, JDBC drivers, and 'temporary' proxy loaders are the usual leak roots in app servers.

### Q79 · What causes Metaspace leaks?

> ClassLoader leaks: keeping loaders alive via ThreadLocals, caches, JDBC drivers, or regenerating proxies/classes without releasing loaders. Classloader leaks (especially with generated classes, proxies, or hot-redeploy) show up here. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q80 · What is bytecode weaving?

> Transforming class bytes at build or load time (AspectJ, agents) to insert behavior - common for AOP/monitoring. `javap -c -p -v` is the fastest way to see what the compiler really emitted (bridges, indy, synthetics). Reading a little bytecode pays off when diagnosing unexpected allocations or dispatch.

### Q81 · What is a Java agent (`-javaagent`)?

> A Java agent is a jar launched with `-javaagent` (or attached later) that can register `ClassFileTransformer`s. Transformers see class bytes at load time (and sometimes on retransform), which is how profilers and some AOP tools weave behavior. Agents are powerful: treat them as production-grade tooling, not ad-hoc monkey patches.

### Q82 · What is the difference between defineClass and findClass?

> `findClass` is the hook subclasses override to locate bytes; `defineClass` turns bytes into a Class in that loader's namespace. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q83 · What is package sealing?

> JAR manifest sealing ensures all classes of a package come from the same jar - blocks split packages from multiple codebases. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q84 · What is a split package problem (JPMS)?

> Two modules exporting the same package - forbidden. Classic cause of module-path headaches with shaded libs. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q85 · What is `ServiceLoader`?

> `ServiceLoader` discovers implementations via `META-INF/services/...` (classpath) or `provides`/`uses` (modules). It loads providers through a chosen `ClassLoader`, which is why context class loaders matter in containers. Class identity is name + defining loader. Loader leaks retain Metaspace; SPI/lookups often fail because the wrong context loader was used.

### Q86 · What is context ClassLoader?

> Thread's ClassLoader hint for SPI in containers - frameworks load resources via TCCL. Class identity is name + defining loader - the same bytes under two loaders are different types. Most 'it works in IDE but not in the server' bugs trace to loader or module-path mismatches.

### Q87 · Why set TCCL carefully in libs?

> Wrong TCCL → ServiceLoader misses providers; restore previous in finally. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q88 · OSGi / JPMS vs hierarchical loaders?

> Classic class loaders form a tree with parent delegation; OSGi/JPMS-style systems wire modules as a graph with explicit readability/exports. Isolation and versioning are stronger in the graph model, but failure modes shift toward missing `requires`/`exports` rather than simple classpath misses. Pick the model your platform actually runs - do not assume tree delegation in a modular runtime.

### Q89 · Hot reload limitation?

> A `Class` cannot be redefined into a new shape freely in the same loader for arbitrary changes; hot reload typically needs a new ClassLoader and abandonment of the old one. Failing to drop references to the old loader leaks Metaspace. That lifecycle discipline is the hard part of true hot-reload / plugin systems.

### Q90 · Bytecode version unsupported error?

> Running newer class file on older JVM - major.minor mismatch. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Preserve cause chains and inspect suppressed exceptions from try-with-resources. Do not use exceptions for ordinary control flow on hot paths.

---

## Memory layout, references & garbage collection

`Q91–Q179` · Reachability, generations, collectors, and the references that outlive your intuition.

### Q91 · How does mark-and-sweep work?

> Mark reachable objects from roots, then sweep unmarked memory into free lists. Can fragment without compaction. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q92 · How does copying (scavenge) collection work?

> Copy live objects from from-space to to-space; abandon the rest. Used for young gen - excellent for high mortality. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Know whether iterators are fail-fast or weakly consistent before sharing across threads.

### Q93 · How does mark-compact work?

> Mark live objects, then slide them together to remove fragmentation. Costly but yields contiguous free space. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q94 · What is generational hypothesis?

> Most objects die young; survivors tend to live long. Explains young/old split and frequent cheap minor GCs. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. The right collector depends on latency vs throughput goals and heap size - not fashion.

### Q95 · What is a card table / remembered set?

> Structures tracking old→young references so minor GC need not scan the entire old gen. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q96 · What is G1 GC?

> Garbage-First: heap split into regions; collects regions with most garbage first. Balances pause goals with throughput. Default in recent JDKs. G1 tracks pause goals softly via `-XX:MaxGCPauseMillis` and collects region sets rather than whole generations rigidly. Humongous objects and very high fragmentation are the usual operational pain points - keep an eye on region sizing and huge arrays.

### Q97 · What is Parallel GC?

> Throughput collector: parallel STW young/old collections. Maximizes work per CPU second; longer pauses acceptable. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q98 · What is Serial GC?

> Single-threaded STW collector. Good for small heaps/containers with one CPU. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q99 · What is CMS (historical)?

> Concurrent Mark Sweep: concurrent old-gen marking/sweeping to reduce pauses; fragmented; removed in favor of G1/ZGC/Shenandoah. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q100 · What is ZGC?

> Ultra-low-pause collector using colored pointers and load barriers; concurrent compaction; scales to huge heaps. Colored pointers and load barriers let marking/relocation stay concurrent. Pauses stay tiny even on large heaps, with some throughput tradeoff versus Parallel/G1 depending on workload. Confirm platform support and JDK version before standardizing on it.

### Q101 · What is Shenandoah?

> Low-pause concurrent compactor using Brooks pointers / barriers; aims for short pause times independent of heap size. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q102 · What is a GC barrier?

> Read/write instrumentation so concurrent collectors maintain correctness (e.g., load barrier in ZGC). Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q103 · What is humongous allocation in G1?

> Objects ≥ region_size/2 occupy contiguous humongous regions; can cause fragmentation and more full GCs if mismanaged. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. The right collector depends on latency vs throughput goals and heap size - not fashion.

### Q104 · What is `-XX:MaxGCPauseMillis`?

> Soft pause target for collectors like G1. Not a hard SLA; GC sizes young gen / selects regions to try to meet it. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. The right collector depends on latency vs throughput goals and heap size - not fashion.

### Q105 · What is allocation failure?

> Eden/region cannot satisfy allocation → triggers a GC cycle. Normal under load; pathological if constant full GCs. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q106 · What is a concurrent mode failure (CMS era)?

> Old gen filled before concurrent collection finished → fallback full GC. Motivation for G1/ZGC. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q107 · What is GC thrashing?

> Heap too small or leak: GC runs constantly, throughput collapses. Fix sizing/leaks; watch GC logs. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q108 · How do you read basic GC logs?

> Look for pause times, heap before/after, promotion rates, full GC frequency, to-space overflow, metaspace changes. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q109 · What is a memory leak in Java?

> Unintended retained references keeping unreachable-from-business objects alive (caches without bounds, static collections, ThreadLocals, listeners). Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q110 · What tools diagnose heap issues?

> jcmd, jmap, jhsdb, VisualVM, async-profiler, Eclipse MAT, YourKit; heap dumps + GC logs + allocation profiles. Prefer measuring with JFR/`jcmd` over folklore. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q111 · What is a heap dump?

> Snapshot of live objects for offline analysis. Trigger via `-XX:+HeapDumpOnOutOfMemoryError`, jcmd, or tooling. Prefer measuring with JFR/`jcmd` over folklore. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q112 · SoftReference vs WeakReference vs PhantomReference?

> Soft: cleared under memory pressure (caches). Weak: cleared at next GC when only weakly reachable (canonical maps). Phantom: for post-mortem cleanup via ReferenceQueue; get() is null. Soft refs are for memory-sensitive caches (cleared under pressure). Weak refs are for canonical mappings that must not keep keys alive. Phantom refs (+ `ReferenceQueue` / `Cleaner`) are for post-mortem cleanup - prefer them over `finalize()`.

### Q113 · What is a ReferenceQueue?

> Queue where the GC enqueues cleared Reference objects so you can run cleanup (replace finalizers). Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. References couple lifetime to reachability; they are not a general resource-management substitute for try-with-resources.

### Q114 · Why avoid finalize()?

> Unpredictable timing, delays reclamation, can resurrect objects, blocks GC threads historically. Prefer try-with-resources + Cleaner/ReferenceQueue. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q115 · What is `java.lang.ref.Cleaner`?

> Modern API to register cleanup actions when an object becomes phantom reachable means safer than finalize. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q116 · What is direct ByteBuffer memory?

> Off-heap native memory for I/O. Not counted in Java heap; limited by `-XX:MaxDirectMemorySize`; cleaned via Cleaner. Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Allocation and reclamation are more expensive than heap buffers; pool them if you allocate often. Track with `BufferPoolMXBean` / NMT because heap dumps will not show the native payload.

### Q117 · What is native memory tracking (NMT)?

> `-XX:NativeMemoryTracking=summary|detail` plus `jcmd VM.native_memory` to see malloc/metaspace/thread stacks outside the heap. Keep both the definition and a realistic failure mode in mind means that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q118 · Young GC vs Full GC impact?

> Young: short, frequent, copying. Full: longer STW (depending on collector), whole-heap work - investigate if frequent. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. The right collector depends on latency vs throughput goals and heap size - not fashion.

### Q119 · What is string deduplication (G1)?

> Optional feature sharing underlying char/byte arrays of equal Strings to save memory. Always be explicit about charset at API boundaries; platform defaults still surprise in containers. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q120 · What is object pinning?

> Keeping an object at a fixed address (JNI critical, some GC interactions) which can hinder compaction. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q121 · What is JVM flag `-XX:+UseG1GC` for?

> Select G1 collector (often default). Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q122 · What is JVM flag `-XX:+UseZGC` for?

> Select ZGC for ultra-low pauses. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q123 · What is JVM flag `-XX:+UseShenandoahGC` for?

> Select Shenandoah low-pause collector. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q124 · What is JVM flag `-XX:NewRatio` for?

> Ratio of old/young sizes for some collectors. Prefer measuring with JFR/`jcmd` over folklore. Change one flag at a time and keep GC/heap settings aligned with container memory limits. Map symptoms to a subsystem (loader, heap/GC, stacks, JIT) and collect the matching artifact before changing random flags.

### Q125 · What is JVM flag `-XX:SurvivorRatio` for?

> Eden/survivor sizing ratio. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. The right collector depends on latency vs throughput goals and heap size - not fashion. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q126 · What is JVM flag `-XX:MaxTenuringThreshold` for?

> Max age before forced promotion. Prefer measuring with JFR/`jcmd` over folklore. Change one flag at a time and keep GC/heap settings aligned with container memory limits. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q127 · What is JVM flag `-XX:InitiatingHeapOccupancyPercent` for?

> G1 concurrent cycle start threshold. Prefer measuring with JFR/`jcmd` over folklore. Change one flag at a time and keep GC/heap settings aligned with container memory limits. Map symptoms to a subsystem (loader, heap/GC, stacks, JIT) and collect the matching artifact before changing random flags.

### Q128 · What is JVM flag `-XX:+HeapDumpOnOutOfMemoryError` for?

> Auto dump heap on OOME. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Preserve cause chains and inspect suppressed exceptions from try-with-resources. Do not use exceptions for ordinary control flow on hot paths.

### Q129 · What is JVM flag `-Xlog:gc*` for?

> Unified logging for GC events (modern JDKs). Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q130 · What is JVM flag `-XX:+PrintGCDetails` for?

> Legacy GC detail logging (older JDKs). Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q131 · Is Java pass-by-value or pass-by-reference?

> Pass-by-value always. For objects, the value is the reference copy - callee can mutate object, not rebind caller's variable. Reassigning a parameter inside a method never rebinds the caller's variable. Mutating fields of a shared object is visible to the caller because both references point at the same heap object - that is still pass-by-value of the reference.

### Q132 · Direct buffer OOME not in heap dump?

> Off-heap - use NMT / BufferPoolMXBean. Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q133 · Metaspace OOME with Groovy/JSP?

> Dynamic class gen - bound caches / reuse loaders. Classloader leaks (especially with generated classes, proxies, or hot-redeploy) show up here. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q134 · GC root: local variable in frame?

> Yes - long-lived frames keep objects alive; null out huge locals if needed (rare). Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q135 · SafePoint bias in profilers?

> Safepoint-biased sampling skews means prefer async-profiler. Always close channels/streams (try-with-resources). Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q136 · TLABs and allocation profiles?

> Most allocations cheap; dump shows sites still. Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q137 · Humongous G1 and huge arrays?

> Avoid giant allocations when possible; fragment regions. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q138 · Region size G1?

> G1 splits the heap into equal regions; region size is chosen as a power of two from the heap size (and can be influenced by flags). Objects larger than half a region become humongous and occupy contiguous regions. Wrong region sizing plus many huge arrays increases fragmentation and can drive more expensive collections.

### Q139 · ZGC colored pointers requirement?

> Unused virtual address bits - OS/CPU constraints. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q140 · Parallel GC best when?

> Batch throughput jobs where latency secondary. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q141 · Serial GC in containers?

> Small heaps single CPU - less overhead. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q142 · CompressedOops disable when?

> Heaps ≳32GB or explicit means more memory per reference. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q143 · JOL (Java Object Layout)?

> Tool to print object sizes/layouts means learning internals. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q144 · Heap histogram jcmd?

> GC.class_histogram - quick leak hints. Prefer measuring with JFR/`jcmd` over folklore. Change one flag at a time and keep GC/heap settings aligned with container memory limits. Verify with `javap`/JFR rather than guessing. The interpreter/JIT and safepoints explain many 'why is this slow/pausy' mysteries.

### Q145 · Allocation sampling JFR?

> JFR allocation sampling records which call sites allocate without instrumenting every `new` at full cost. Use it to find churn hotspots (buffers, wrappers, temporary collections) that drive young-GC frequency. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q146 · Preferences API?

> `java.util.prefs.Preferences` stores small user/system configuration values in an OS-backed hierarchy. It is not a database - keep payloads tiny and expect platform-specific backing stores. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q147 · Finalizer guardian pattern historical?

> Cleanup without overriding finalize means obsolete vs Cleaner. Modern Java features reduce boilerplate only when they clarify the domain model. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q148 · Phantom cleanup vs finalizer?

> Phantom-based cleanup (via `ReferenceQueue` or `Cleaner`) runs after the object is phantom-reachable and cannot resurrect it. Finalizers are nondeterministic, can resurrect objects, and delay reclamation - avoid them in new code. Cleanup actions must not retain a strong reference to the object being cleaned.

### Q149 · Clearing SoftReference manually?

> `SoftReference.clear()` drops the referent immediately, which is useful when you invalidate a cache entry yourself. Soft references are otherwise cleared under memory pressure according to JVM policy - do not rely on them as a precise TTL mechanism.

### Q150 · Is GC deterministic?

> No - never rely on GC timing for correctness. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q151 · System.gc() advice?

> Hint only; often ignored/expensive - avoid in libs. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Only calls that enter the wrapper receive intercepted behavior; internal `this` calls do not. Check the runtime class name when advice seems missing.

### Q152 · Explicit GC disable flags?

> DisableExplicitGC for containers - ops choice. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q153 · RMI DGC?

> Distributed GC historically - niche today. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q154 · Finalize on Enum?

> Enum instances are immortal singletons managed by the JVM; finalization is not a meaningful lifecycle hook for them. If you need cleanup around enum-related resources, manage those resources explicitly elsewhere.

### Q155 · Foreign memory Arena?

> Lifetime for off-heap segments means try-with-resources. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q156 · Method reference kinds?

> Java method references come in several shapes: static (`Type::staticMethod`), unbound instance (`Type::instanceMethod`), bound instance (`obj::instanceMethod`), constructors (`Type::new`), and array constructors (`Type[]::new`). Each binds a different receiver/arity story to a functional interface.

### Q157 · Ctor references with generics?

> Inference can fail means type witnesses. Modern Java features reduce boilerplate only when they clarify the domain model. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q158 · Array constructor reference `int[]::new`?

> `int[]::new` is an array constructor reference used as an `IntFunction` (for example in `Stream.toArray(int[]::new)`). It allocates a typed array of the requested size and avoids the `Object[]` cast problems of the no-arg `toArray()`.

### Q159 · RemainingCapacity?

> Hint - not synchronization. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q160 · Escape analysis failed why?

> Object stored in field/returned/passed unknown - escapes. If the JIT proves an object never leaves the method/thread, it may scalar-replace fields into registers/locals or eliminate allocations and even elide locks on non-escaping monitors. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q161 · Always measure with production-like heap?

> GC effects change results drastically. Prefer measuring with JFR/`jcmd` over folklore. Change one flag at a time and keep GC/heap settings aligned with container memory limits. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q162 · Allocation rate impact latency?

> Young GC frequency - reduce alloc in hot paths. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q163 · Direct buffers in Netty?

> Reduce copies to socket - native memory. Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q164 · Reference counting vs GC?

> Manual cycles; GC handles cycles automatically. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q165 · Why GC handles cycles?

> Tracing from roots - not RC alone. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q166 · Arena vs malloc?

> Bump allocate + bulk free means great for request lifetimes. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q167 · TLABs are mini arenas?

> Yes means thread-scoped bump allocation. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q168 · Retirement of TLAB?

> When space low means new TLAB from Eden. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q169 · Waste in TLABs?

> Fragment leftover means tradeoff vs contention. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q170 · Allocation slow path?

> Outside TLAB / oversized - may safepoint/GC. Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q171 · Huge object allocation?

> May go old/humongous directly means policies differ. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q172 · TLABStats logging?

> TLAB statistics (via GC/allocation logging or JFR) show how threads allocate from thread-local buffers versus slow paths. High slow-path allocation or excessive TLAB waste can explain unexpected allocation latency. Use them when allocation profiles look odd but Eden sizing alone does not explain pauses.

### Q173 · Allocation profiler sampling?

> Find sites dominating Eden. Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q174 · Live data size for heap sizing?

> Heap >> live set for throughput; latency collectors differ. Prefer measuring with JFR/`jcmd` over folklore. Change one flag at a time and keep GC/heap settings aligned with container memory limits. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q175 · GC overhead limit exceeded?

> Too much time in GC vs mutator - throw OOME. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q176 · Disable GC overhead limit?

> Flag exists - treat symptom carefully. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q177 · Cleaner and classloader leaks?

> Cleaning actions must not capture classloader-heavy state accidentally. Class identity is name + defining loader means the same bytes under two loaders are different types. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q178 · Method reference bound to instance?

> A bound instance method reference (`obj::method`) retains `obj` for as long as the functional object lives. That is a classic accidental retention path when listeners or callbacks outlive the intended scope - same family of leak as non-static inner classes holding an outer `this`.

### Q179 · Canonical Map with WeakReference values?

> Need ReferenceQueue cleanup of map entries. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Match the data structure to access pattern and concurrency needs, and obey its equals/ordering contracts.

---

## Objects, identity, equals & initialization

`Q180–Q274` · Construction order, `==` vs `equals`, safe publication, and immutability that actually holds.

### Q180 · What does `new` do step by step?

> Resolve/init class, allocate heap memory (TLAB), zero memory, set header/klass, run constructor chain (super first), return reference. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q181 · Where do instance fields live?

> In the object's heap layout after the header, ordered by JVM rules (hot fields, alignment). Not on the stack unless scalar-replaced. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q182 · Where do local variables live?

> In the current stack frame's local variable array (or CPU registers in JIT code). Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q183 · What is the difference between == and equals for objects?

> `==` compares references (identity). `equals` is logical equality - default is identity; override with hashCode contract. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q184 · What is the equals/hashCode contract?

> Equal objects must have equal hashCodes. Unequal may collide. Consistency while used in hash-based collections is mandatory. Break the contract and `HashMap`/`HashSet` silently misbehave: lost entries, duplicates, impossible lookups. Include exactly the fields that define equality, keep them stable while the object is a key, and test symmetry/transitivity.

### Q185 · What breaks HashMap if hashCode is mutable?

> If a key's hash-relevant fields change after insert, it becomes unfindable (wrong bucket) - effectively lost. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q186 · Why call super.equals carefully?

> Inheritance + equals is tricky (symmetry/LSP). Prefer composition or final classes; or careful canEqual patterns. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q187 · What is `compareTo` consistency with equals?

> Sorted collections use compareTo. If compareTo==0 but equals false (or vice versa), TreeMap/Set behave surprisingly. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q188 · What is cloning and why is it discouraged?

> `Object.clone` is shallow by default, needs Cloneable, awkward exceptions. Prefer copy constructors or factories. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q189 · What is a defensive copy?

> Copying mutable inputs/outputs so callers cannot mutate internal state means critical for immutable designs. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q190 · What does immutable mean in Java practice?

> State cannot change after construction: final fields, no mutators, defensive copies, safe publication. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q191 · How do you safely publish an object?

> Store into volatile/final/static synchronized, or concurrent structures, so other threads see fully initialized state (JMM). Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q192 · What is the final field freeze guarantee?

> At constructor end, final fields are frozen; other threads reading a properly published reference see at least those finals initialized. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q193 · What is object resurrection?

> Making an object reachable again from finalize - prevents collection that cycle; another reason to avoid finalize. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q194 · What is composition vs inheritance?

> Composition: has-a, more flexible. Inheritance: is-a, tight coupling. Most production defects here are lifecycle or encoding mistakes - close resources and name the charset. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q195 · What is the diamond problem and how does Java handle it?

> Multiple inheritance of state is disallowed for classes. Interfaces can conflict on default methods - must override to disambiguate. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q196 · What is covariant return types?

> Override may return a subtype of the parent's return type means checked at compile time. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q197 · What is bridge method?

> Compiler-generated synthetic method to preserve polymorphism under generics erasure / covariant returns. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q198 · What are synthetic members?

> Compiler-generated fields/methods/constructors (bridges, outer-this, enum switches) marked ACC_SYNTHETIC. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q199 · What is the outer-class reference in inner classes?

> Non-static inner class holds synthetic `this$0` to the outer instance - can leak outer objects if inner lives long. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q200 · Can equals throw NPE?

> Prefer `Objects.equals`; your equals should handle null → false, not throw. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q201 · getClass vs instanceof in equals?

> getClass forbids subclass equality; instanceof allows - choose consciously for LSP. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q202 · Float/Double in equals?

> Use floatToIntBits/doubleToLongBits to treat NaNs consistently. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q203 · Arrays in equals/hashCode?

> Use Arrays.equals/hashCode or deep variants. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q204 · Records equals semantics?

> Component-wise; for arrays components use Arrays.equals - know shallow vs deep. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. These features pay off when they make invariants compiler-checked (immutability, exhaustiveness), not when they only shorten syntax.

### Q205 · Does `finally` always run?

> Almost - runs on normal/except paths; not if JVM halts, or thread death extremes, or System.exit. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Exceptions are for uncommon paths - using them for ordinary control flow is expensive and noisy.

### Q206 · static nested vs inner class?

> static nested: no outer this. inner: needs outer instance and holds reference. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q207 · Overloading vs overriding?

> Overload = same name different signature compile-time. Override = same signature runtime dispatch. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q208 · Hiding vs overriding static methods?

> Statics hide; invocation uses compile-time type means not polymorphic. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q209 · final method meaning?

> Cannot override means enables inlining confidence; security/design. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q210 · final class meaning?

> Cannot subclass means good for immutables/records-like designs. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q211 · abstract class vs interface modern Java?

> Both can have methods; classes hold state; interfaces allow multiple inheritance of type; sealed refines both. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q212 · Are interfaces allowed fields?

> Yes means implicitly public static final. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q213 · package-private meaning?

> No modifier: visible in same package (and related module rules). Keep both the definition and a realistic failure mode in mind means that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q214 · protected across packages?

> Accessible to subclasses (with care for instance access rules) and same package. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q215 · instanceof null?

> Always false means safe check. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q216 · String switch internals?

> Often hash lookup + equals cascade - still need non-null. Always be explicit about charset at API boundaries; platform defaults still surprise in containers. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q217 · enum switch exhaustiveness?

> Modern compilers check all constants when switching on enums/sealed. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q218 · Why override hashCode when equals overridden?

> Law of hash-based collections; violation → lost keys. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q219 · BigDecimal equals vs compareTo?

> equals considers scale (1.0 ≠ 1.00); compareTo mathematical - money bugs! Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q220 · Objects.requireNonNull purpose?

> Fail fast with clear NPE messages at boundaries. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q221 · Checked exception in lambdas?

> Functional interfaces usually don't allow - wrap in unchecked or custom interfaces. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Exceptions are for uncommon paths - using them for ordinary control flow is expensive and noisy.

### Q222 · Hashtable null policy?

> Also no nulls; legacy synchronized Map. Prefer battle-tested libraries and constant-time compares for secrets. Disabling verification 'just for now' in production is how outages become incidents. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q223 · EnumMap null keys?

> Not allowed; values may be null. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q224 · Handle checked exceptions in CF?

> Wrap; CF APIs use CompletionException. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Preserve cause chains and inspect suppressed exceptions from try-with-resources. Do not use exceptions for ordinary control flow on hot paths.

### Q225 · @Contended annotation?

> Pad hot fields to avoid false sharing (JDK internal mostly). Keep both the definition and a realistic failure mode in mind means that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q226 · StringTable pressure?

> Too much intern() - monitor string table stats. Always be explicit about charset at API boundaries; platform defaults still surprise in containers. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q227 · record serialization with custom fields?

> Prefer alternate formats; custom ser is limited/awkward. Modern Java features reduce boilerplate only when they clarify the domain model. Most production defects here are lifecycle or encoding mistakes - close resources and name the charset.

### Q228 · Interned strings as flyweights?

> Yes - with memory tradeoffs. Always be explicit about charset at API boundaries; platform defaults still surprise in containers. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q229 · Scanner vs String.split?

> Scanner streaming tokens; split allocates arrays - regex cost. Always be explicit about charset at API boundaries; platform defaults still surprise in containers. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q230 · String.replaceAll regex?

> Yes - replace(CharSequence) is literal. Always be explicit about charset at API boundaries; platform defaults still surprise in containers. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q231 · System.console() null?

> Often null in IDEs means fallback readers. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q232 · FlightRecorderMXBean?

> Control JFR via management APIs. Framework magic is still JVM behavior underneath: proxies, classloaders, thread pools, and transactions. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q233 · Checked exceptions and rollback rules?

> By default rollback on Runtime; configure for checked. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Preserve cause chains and inspect suppressed exceptions from try-with-resources. Do not use exceptions for ordinary control flow on hot paths.

### Q234 · ModuleLayer purpose?

> Multiple module graphs in one JVM - advanced isolation. Class identity is name + defining loader - the same bytes under two loaders are different types. Most 'it works in IDE but not in the server' bugs trace to loader or module-path mismatches. Explicit `requires`/`exports`/`opens` make dependencies visible and reflection constrained. Most migration pain is split packages and libraries that assumed free classpath access.

### Q235 · Incubator modules?

> `jdk.incubator.*` - APIs may change. Class identity is name + defining loader - the same bytes under two loaders are different types. Most 'it works in IDE but not in the server' bugs trace to loader or module-path mismatches. Explicit `requires`/`exports`/`opens` make dependencies visible and reflection constrained. Most migration pain is split packages and libraries that assumed free classpath access.

### Q236 · Primitive wrappers sync?

> Dangerous means may sync on cached instances shared globally. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q237 · Cleanable interface?

> Registered cleaning action means avoid referencing the cleaned object. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q238 · Cloneable on records?

> Prefer canonical copy via constructor. Modern Java features reduce boilerplate only when they clarify the domain model. Lean on the compiler (exhaustiveness, immutability) rather than reintroducing mutable bags of fields. These features pay off when they make invariants compiler-checked (immutability, exhaustiveness), not when they only shorten syntax.

### Q239 · Serializable records and evolution?

> Component changes break streams means version carefully. Modern Java features reduce boilerplate only when they clarify the domain model. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q240 · JSON-B / Jackson annotations?

> Prefer data formats over Java serialization for APIs. Most production defects here are lifecycle or encoding mistakes - close resources and name the charset. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q241 · Nullability annotations (JSPECIFY)?

> Ecosystem moving to standard null markers means tooling. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q242 · Withers for records?

> Manual withX or experimental proposals means copy constructors. Modern Java features reduce boilerplate only when they clarify the domain model. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q243 · Builder with records?

> Possible but often overkill for small records. Modern Java features reduce boilerplate only when they clarify the domain model. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q244 · Record serialization proxies?

> Rarely needed if you avoid Java ser. Modern Java features reduce boilerplate only when they clarify the domain model. Most production defects here are lifecycle or encoding mistakes - close resources and name the charset.

### Q245 · Local records?

> Yes inside methods means tidy DTOs. Modern Java features reduce boilerplate only when they clarify the domain model. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q246 · Nested records?

> Static by nature means no outer this. Modern Java features reduce boilerplate only when they clarify the domain model. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q247 · Sealed + records modeling?

> Algebraic data types in Java means powerful domain models. Modern Java features reduce boilerplate only when they clarify the domain model. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q248 · Switch exhaustiveness with sealed?

> Compiler enforces - safer refactors. Modern Java features reduce boilerplate only when they clarify the domain model. Lean on the compiler (exhaustiveness, immutability) rather than reintroducing mutable bags of fields. These features pay off when they make invariants compiler-checked (immutability, exhaustiveness), not when they only shorten syntax.

### Q249 · Pattern switch null?

> Null handled specially - know rules to avoid NPE. Modern Java features reduce boilerplate only when they clarify the domain model. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q250 · Final fields reflection mutation?

> Deep reflection may break finals means undefined; modules block. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q251 · constructor vs reflection newInstance?

> Prefer Constructor/lookup; Class.newInstance deprecated. Most production defects here are lifecycle or encoding mistakes - close resources and name the charset. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q252 · SwitchPoint for invalidation?

> Invalidate speculative linked sites en masse. Most production defects here are lifecycle or encoding mistakes - close resources and name the charset. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q253 · System.identityHashCode vs hashCode?

> Identity even if overridden - maps by identity. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q254 · Enum constant initialization order?

> Constants first then rest of statics means careful. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q255 · Abstract enum methods?

> Each constant implements means powerful state machines. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q256 · Enum ctor privacy?

> Implicit private means cannot `new`. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q257 · Enum switch default necessity?

> Future-proof if not sealed exhaustiveness in older Java. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q258 · Adding enum constants binary?

> Usually OK; switches without default may break logically. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q259 · EnumMap ordinal indexing?

> Dense arrays - why it's fast. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q260 · JSR-330 annotations?

> @Inject ecosystem means portable DI. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q261 · Visitor vs pattern matching sealed?

> Sealed switches often replace Visitor boilerplate in modern Java. Modern Java features reduce boilerplate only when they clarify the domain model. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q262 · trySplit null?

> Cannot split more means sequential remainder. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q263 · equals concurrency?

> Should be thread-safe or objects immutable. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q264 · Null check elimination?

> After dominating checks means speculative. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q265 · Finalization dependent resources?

> Don't means use explicit close. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q266 · Why 50+ functional interfaces in JDK?

> Boxing avoidance + arity. Most production defects here are lifecycle or encoding mistakes - close resources and name the charset. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q267 · nullsLast naturalOrder?

> `Comparator.nullsLast(naturalOrder())` (and `nullsFirst`) make null-handling explicit for sorting. Without a null policy, sorting collections that contain nulls can throw `NullPointerException`. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q268 · Char array vs String?

> String may compress to bytes. Always be explicit about charset at API boundaries; platform defaults still surprise in containers. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q269 · StringReader mark support?

> Some streams support mark - know. Always be explicit about charset at API boundaries; platform defaults still surprise in containers. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q270 · URLClassLoader and sealed packages?

> Sealing violations throw security errors. Class identity is name + defining loader - the same bytes under two loaders are different types. Class identity is name + defining loader. Loader leaks retain Metaspace; SPI/lookups often fail because the wrong context loader was used.

### Q271 · Package.getName vs module?

> Modules add another axis of encapsulation. Class identity is name + defining loader - the same bytes under two loaders are different types. Most 'it works in IDE but not in the server' bugs trace to loader or module-path mismatches. Explicit `requires`/`exports`/`opens` make dependencies visible and reflection constrained. Most migration pain is split packages and libraries that assumed free classpath access.

### Q272 · Deep reflection and modules?

> Denied by default - opens/add-opens. Class identity is name + defining loader - the same bytes under two loaders are different types. Most 'it works in IDE but not in the server' bugs trace to loader or module-path mismatches. Explicit `requires`/`exports`/`opens` make dependencies visible and reflection constrained. Most migration pain is split packages and libraries that assumed free classpath access.

### Q273 · Multi-release and modules?

> Supported with care. Class identity is name + defining loader - the same bytes under two loaders are different types. Most 'it works in IDE but not in the server' bugs trace to loader or module-path mismatches. Explicit `requires`/`exports`/`opens` make dependencies visible and reflection constrained. Most migration pain is split packages and libraries that assumed free classpath access.

### Q274 · Timing attack String equals?

> Use MessageDigest.isEqual for secrets. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

---

## Strings, primitives & wrappers

`Q275–Q301` · The pool, compact strings, autoboxing traps, and why `==` on `Integer` lies.

### Q275 · Where do String objects live?

> On the heap like other objects. The string pool (intern set) holds unique instances for literals and interned strings. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q276 · What is the string pool?

> A heap-managed deduplication table for Strings. Literals are interned automatically; `intern()` may add more. Literals are interned; `new String("x")` still allocates a distinct object. Do not intern unbounded user input - you can pin memory for the life of the JVM. Modern JDKs also use compact strings (`byte[]` + coder) to save RAM for Latin-1 text.

### Q277 · What changed for Strings in Java 9+?

> Compact Strings: `byte[]` + coder (LATIN1/UTF16) instead of `char[]`, saving memory for Latin-1 text. Always be explicit about charset at API boundaries; platform defaults still surprise in containers. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q278 · Why is String immutable?

> Security (classloading paths), concurrency safety, pool sharing, hashCode caching - immutability enables all of these. Always be explicit about charset at API boundaries; platform defaults still surprise in containers. In hot loops prefer `StringBuilder`/`StringConcatFactory`-friendly patterns over repeated immutable concat. Immutability lets the JVM share pooled instances and cache `hashCode` safely. It also means every 'edit' allocates - design APIs that build strings once when on a hot path.

### Q279 · What does `new String("a")` do?

> Creates a new heap String even if `"a"` is pooled - usually pointless; prefer literals. Always be explicit about charset at API boundaries; platform defaults still surprise in containers. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q280 · String concatenation + vs StringBuilder?

> Compile-time constants fold. Runtime `+` typically becomes StringBuilder/StringConcatFactory. Loops should use explicit builders. Always be explicit about charset at API boundaries; platform defaults still surprise in containers. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q281 · What is `StringConcatFactory` (indy)?

> Java 9+ invokedynamic-based concatenation strategy chosen by the runtime for efficient joining. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q282 · How does `String.intern()` work?

> Returns the pooled equivalent; may allocate into the pool. Overuse can bloat Metaspace/heap (implementation dependent) means use carefully. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q283 · Why is string comparison with == dangerous?

> Only true for identical references (often literals). Logical equality needs `equals`. Interning tricks are fragile. Always be explicit about charset at API boundaries; platform defaults still surprise in containers. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q284 · What is a string constant in the constant pool?

> Class file stores UTF-8 CONSTANT_String / Utf8 entries; at runtime they become pooled String instances. Always be explicit about charset at API boundaries; platform defaults still surprise in containers. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q285 · How does substring work historically vs now?

> Old JDKs shared backing array (leak risk). Modern JDKs copy - safer memory behavior. Always be explicit about charset at API boundaries; platform defaults still surprise in containers. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q286 · Text blocks - what are they?

> Java 15+ `"""` multi-line string literals with incidental indentation management - still immutable Strings. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. These features pay off when they make invariants compiler-checked (immutability, exhaustiveness), not when they only shorten syntax.

### Q287 · List Java primitive types and sizes (approx).

> byte 8, short 16, int 32, long 64, float 32, double 64, char 16 (UTF-16 code unit), boolean JVM-dependent (often 8 bits in arrays). Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Know whether iterators are fail-fast or weakly consistent before sharing across threads.

### Q288 · What is autoboxing?

> Compiler inserts conversions between primitives and wrappers (`int`↔`Integer`). Can hide allocations and NPEs. Hidden allocations in hot loops (`Long sum = 0; sum += ...`) create serious GC pressure. Prefer primitives for accumulators. Also remember `Integer` cache (-128..127 by default) makes `==` look 'randomly correct'.

### Q289 · What is the Integer cache?

> By default Integers -128..127 are cached/reused by `valueOf`. `==` on boxed values outside range is unreliable. Never write production logic that depends on `==` for boxed numbers. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q290 · Why prefer `equals` on wrappers?

> Because `==` may compare references; cached range makes bugs intermittent. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q291 · What is accidental boxing in loops?

> Using `Long sum` instead of `long` causes per-iteration allocations means major GC pressure. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q292 · Boolean vs boolean pitfalls?

> Boolean can be null; autounboxing null throws NPE. Prefer primitive when null is meaningless. Avoid `==` on wrappers and watch hidden boxing in hot loops.

### Q293 · What is widening vs narrowing conversion?

> Widening (int→long) is safe/implicit. Narrowing (long→int) needs cast and can truncate. Most production defects here are lifecycle or encoding mistakes - close resources and name the charset.

### Q294 · What is unsigned arithmetic support?

> Java lacks unsigned types historically; Integer/Long provide divideUnsigned etc. byte/short are signed when widened. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q295 · char vs code points?

> char is UTF-16 code unit. Supplementary Unicode needs two chars (surrogate pair) - use codePoint APIs. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q296 · What does `float` equality risk?

> Binary floating point rounding - use epsilon comparisons or BigDecimal for money. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q297 · StringBuilder vs StringBuffer?

> Buffer synchronized (legacy); Builder unsynchronized - prefer Builder locally. Always be explicit about charset at API boundaries; platform defaults still surprise in containers. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q298 · Capacity of StringBuilder?

> Growable `char[]`/`byte[]`; ensureCapacity to avoid repeated copies. Always be explicit about charset at API boundaries; platform defaults still surprise in containers. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q299 · Why String is not a good password holder?

> Immutable copies linger until GC; use char[] and clear. Always be explicit about charset at API boundaries; platform defaults still surprise in containers. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q300 · Interning for performance?

> Only for truly repeated bounded sets; otherwise memory tax. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q301 · Locale pitfalls in equalsIgnoreCase?

> Turkish dotted I issues - be careful with case folding locales. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

---

## Generics, type erasure & collections

`Q302–Q469` · PECS, HashMap bins, fail-fast iterators, and the contracts your keys must obey.

### Q302 · What is type erasure?

> Generics are checked at compile time; at runtime most type parameters become Object (or bounds). No `new T()`, no `T.class` without tokens. At runtime a `List<String>` is essentially a `List` of Objects (with bridge methods and casts inserted by `javac`). That is why you cannot do `new T()`, create `T[]` cleanly, or overload solely on different type parameters. Reification workarounds include `Class<T>` tokens and super-type tokens.

### Q303 · What is a reifiable type?

> A type fully available at runtime (primitives, non-generic classes, raw, unbound wildcards arrays). Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q304 · Why no generic arrays easily?

> Arrays are reified and covariant; generics are invariant and erased - mixing breaks type safety. Prefer lists. Modern Java features reduce boilerplate only when they clarify the domain model. Erasure means most type parameters are compile-time only - that is why `new T()` and reified generic arrays are restricted.

### Q305 · What is PECS?

> Producer Extends, Consumer Super: `List<? extends T>` to read, `List<? super T>` to write - wildcard flexibility. `List<? extends Number>` is a producer you can read as `Number` but cannot safely add (except null). super Integer>` is a consumer you can add `Integer` into but can only read as `Object`. This is the practical rule that keeps wildcard APIs both flexible and sound.

### Q306 · What is a raw type?

> Using `List` without parameters means legacy hole that disables generic checks. Avoid. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q307 · What are bounded type parameters?

> `<T extends Number>` restricts T; erasure uses the leftmost bound as runtime type. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q308 · What is a generic method?

> Method declaring its own type params, inferred from arguments/target type. Modern Java features reduce boilerplate only when they clarify the domain model. Erasure means most type parameters are compile-time only - that is why `new T()` and reified generic arrays are restricted.

### Q309 · What is heap pollution?

> Parameterized type referring to wrong content via unchecked casts/varargs - can cause ClassCastException later at seemingly unrelated casts. Prefer measuring with JFR/`jcmd` over folklore. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q310 · What is `@SafeVarargs`?

> Asserts a varargs generic method does not pollute the heap - suppresses warnings when you guarantee safety. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q311 · How do you keep type info at runtime?

> Super type tokens (anonymous subclasses), `Class<T>` tokens, or libraries capturing ParameterizedType. Keep both the definition and a realistic failure mode in mind means that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q312 · What is capture of a wildcard?

> Compiler treats `?` as a fresh unknown type; helper methods capture it as a named type parameter. Modern Java features reduce boilerplate only when they clarify the domain model. Erasure means most type parameters are compile-time only - that is why `new T()` and reified generic arrays are restricted.

### Q313 · Covariant vs invariant generics?

> `List<Integer>` is not a subtype of `List<Number>` - invariance prevents unsound writes. Modern Java features reduce boilerplate only when they clarify the domain model. Erasure means most type parameters are compile-time only - that is why `new T()` and reified generic arrays are restricted.

### Q314 · What are bridge methods for generics?

> Compiler inserts bridges so erased overrides still dispatch correctly for polymorphic calls. Modern Java features reduce boilerplate only when they clarify the domain model. Erasure means most type parameters are compile-time only - that is why `new T()` and reified generic arrays are restricted.

### Q315 · Can you overload solely on generics?

> No - erasure would collide signatures. Distinct erasures required. Modern Java features reduce boilerplate only when they clarify the domain model. Erasure means most type parameters are compile-time only - that is why `new T()` and reified generic arrays are restricted.

### Q316 · Optional as a generic return - caveats?

> Good for return values; avoid in fields/params for APIs. Not a substitute for empty collections. Modern Java features reduce boilerplate only when they clarify the domain model. Erasure means most type parameters are compile-time only - that is why `new T()` and reified generic arrays are restricted.

### Q317 · What is a recursive type bound?

> `<T extends Comparable<T>>` means self-referential bound for compareTo. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q318 · Type witness syntax?

> `Collections.<String>emptyList()` when inference fails. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q319 · Unchecked cast warning meaning?

> Compiler cannot prove cast safety due to erasure - document or redesign. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q320 · Wildcard capture helper pattern?

> Private static method `<T> void foo(List<T>)` called with `List<?>` to recover T. Modern Java features reduce boilerplate only when they clarify the domain model. Erasure means most type parameters are compile-time only - that is why `new T()` and reified generic arrays are restricted.

### Q321 · Why `List<T>` not covariant?

> Would allow `List<Integer>` as `List<Number>` then add Double - heap pollution. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q322 · How does ArrayList grow?

> Internal Object[] ; when full, grow ~1.5× (implementation detail), copy elements. Amortized O(1) add at end. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Know whether iterators are fail-fast or weakly consistent before sharing across threads. Geometric growth keeps amortized append O(1), but a single huge grow copies the whole array. If you know the size, `ensureCapacity` / sized constructors avoid pointless churn.

### Q323 · ArrayList random access complexity?

> O(1) get/set by index; insert/remove in middle O(n) due to shifting. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q324 · How does LinkedList work?

> Doubly linked nodes. O(1) insert/remove given node; O(n) index access. Often slower than ArrayList in practice due to cache locality. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Know whether iterators are fail-fast or weakly consistent before sharing across threads.

### Q325 · HashMap internal structure (Java 8+)?

> Array of bins; colliding entries form lists then treeify to red-black trees when bin large & table big enough. Hash uses key.hashCode with perturbation. Index selection uses bit masking (`hash & (n-1)`), which is why capacity is a power of two. Poor `hashCode`/`equals` pairs destroy both correctness and performance. Never share a plain `HashMap` across threads without external sync - use `ConcurrentHashMap` instead.

### Q326 · What is HashMap capacity and load factor?

> Capacity = bin count (power of two). Load factor (default 0.75) triggers resize when size > capacity*loadFactor. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Know whether iterators are fail-fast or weakly consistent before sharing across threads. Initial capacity is the number of bins, not the number of expected entries exactly - account for load factor. `new HashMap<>(expectedSize)` overloads help, but understand they still translate through load factor.

### Q327 · What happens on HashMap resize?

> Allocate larger table (×2), re-distribute entries (index or index+oldCap). Costly O(n). Resize is O(n) and can dominate latency under sudden growth. If you know the expected size, construct with an adequate initial capacity to avoid repeated resizes. During resize, entries are redistributed; tree bins are split carefully in modern JDKs.

### Q328 · HashMap treeification thresholds?

> TREEIFY_THRESHOLD (8) and MIN_TREEIFY_CAPACITY (64) - short collisions stay lists; else trees for O(log n). Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q329 · Why must keys obey equals/hashCode?

> Lookup finds bin by hash then equals. Broken contracts corrupt retrieval and set membership. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q330 · HashMap vs Hashtable?

> Hashtable synchronized legacy, nulls forbidden. HashMap unsynchronized, one null key, many null values. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q331 · ConcurrentHashMap concurrency model?

> Lock-free/ CAS friendly bin design (Java 8+); no locking whole map for typical ops. Iterators weakly consistent. It allows high concurrency for independent keys without locking the entire map. Iterators are weakly consistent: they may see later updates and do not throw `ConcurrentModificationException`. Null keys/values are forbidden - absence is unambiguous.

### Q332 · HashMap iteration fail-fast?

> modCount checks - concurrent structural modification from another thread risks ConcurrentModificationException (best-effort). Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Know whether iterators are fail-fast or weakly consistent before sharing across threads. CME is a diagnostic aid, not a concurrency protocol. Two threads mutating an `ArrayList` can still corrupt it without always throwing - use concurrent structures or external locking.

### Q333 · What is weakly consistent iteration?

> May reflect some post-creation updates; does not throw CME means used by concurrent collections. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q334 · LinkedHashMap insertion vs access order?

> Maintains doubly linked list of entries. Access-order mode enables LRU-style caches via `removeEldestEntry`. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q335 · TreeMap ordering?

> Red-black tree keyed by Comparable/Comparator. O(log n) ops; no null keys with natural order. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q336 · HashSet implementation?

> Wrapper over HashMap keys (dummy values). Same hashing contracts apply. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q337 · EnumSet / EnumMap benefits?

> Bit-vector / array keyed by ordinal - extremely fast and compact for enums. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q338 · ArrayDeque use cases?

> Resizable circular array deque - fast stack/queue; prefer over Stack/LinkedList for queues. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q339 · PriorityQueue internals?

> Binary heap in array; O(log n) offer/poll; not fully sorted iteration. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q340 · Collections.unmodifiable* - deep?

> Shallow wrappers: structure immutable but elements mutable if they are. Not a security boundary against reflection. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q341 · CopyOnWriteArrayList when?

> Read-heavy, rare writes: write copies array. Iterators snapshot - great for listeners; bad for frequent writes. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q342 · What is IdentityHashMap?

> Uses reference equality (==) and identity hash - for topology graphs, serialization, etc. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q343 · What is WeakHashMap?

> Keys are weak references; entries vanish when keys only weakly reachable - canonical caches (values must not strongly ref keys). Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Know whether iterators are fail-fast or weakly consistent before sharing across threads.

### Q344 · Comparator vs Comparable?

> Comparable = natural order on the class. Comparator = external ordering strategy (Strategy pattern). Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q345 · Sorting stability in Java?

> `List.sort` / `Arrays.sort` for objects use TimSort - stable. Primitive sorts may be unstable dual-pivot quicksort. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q346 · ConcurrentModificationException meaning?

> Fail-fast iterator detected structural change. Not a reliable concurrency lock - still need real synchronization. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Preserve cause chains and inspect suppressed exceptions from try-with-resources. Do not use exceptions for ordinary control flow on hot paths.

### Q347 · What does Map.computeIfAbsent do and when use it?

> Atomically (for ConcurrentHashMap) associate mapping if missing; great for caches - function must be side-effect careful. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q348 · What does Map.merge do and when use it?

> Remap with BiFunction combining old and new - elegant counting/grouping. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q349 · What does Map.putIfAbsent do and when use it?

> Insert only if key free; returns previous or null. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q350 · What does Map.replace do and when use it?

> Conditional update if key mapped - CAS-like for maps. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q351 · What does Map.getOrDefault do and when use it?

> Avoid null checks with a fallback value (note: stored nulls still 'present' in HashMap). Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q352 · When would you use ConcurrentSkipListMap?

> Concurrent sorted map via skip list - logarithmic, weakly consistent. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q353 · When would you use ConcurrentLinkedQueue?

> Lock-free Michael-Scott queue variant - unbounded non-blocking. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q354 · When would you use ArrayBlockingQueue?

> Bounded array queue with locks/conditions - backpressure. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q355 · When would you use LinkedBlockingQueue?

> Optionally bounded linked queue - common executor work queue. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q356 · When would you use SynchronousQueue?

> No internal capacity - direct handoff between producer/consumer. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q357 · When would you use DelayQueue?

> Priority queue of Delayed elements - scheduling/timeouts. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q358 · When would you use PriorityBlockingQueue?

> Unbounded blocking priority heap - watch memory growth. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q359 · When would you use LinkedTransferQueue?

> Powerful transfer/tryTransfer producer-consumer queue. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q360 · Comparable and TreeSet nulls?

> Natural ordering TreeSet forbids null; Comparator may allow. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q361 · Fail-fast iterator remove?

> Iterator.remove is the safe way during iteration - not collection.remove. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Know whether iterators are fail-fast or weakly consistent before sharing across threads. CME is a diagnostic aid, not a concurrency protocol. Two threads mutating an `ArrayList` can still corrupt it without always throwing - use concurrent structures or external locking.

### Q362 · Arrays.asList characteristics?

> Fixed-size backed by array; set ok, add/remove throw. Not truly immutable. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q363 · List.of immutability?

> Truly unmodifiable; nulls forbidden; compact implementations. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q364 · Map.of limitations?

> Limited entries overloads; no nulls; unmodifiable. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q365 · Collections.sort vs List.sort?

> List.sort preferred; both TimSort for objects. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Match the data structure to access pattern and concurrency needs, and obey its equals/ordering contracts.

### Q366 · Optional in fields - controversy?

> Discouraged by many style guides; use for returns. Modern Java features reduce boilerplate only when they clarify the domain model. Most production defects here are lifecycle or encoding mistakes - close resources and name the charset.

### Q367 · null vs empty collection returns?

> Prefer empty collections - fewer NPEs. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q368 · Side effects in streams?

> Avoid; hurts parallel and readability - use forEach sparingly. Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Pipelines are lazy until a terminal op. Parallelism and captures have real costs - measure before defaulting to `parallelStream()`.

### Q369 · Enumeration vs Iterator?

> Enumeration legacy; Iterator supports remove; ListIterator bidirectional. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q370 · HashMap infinite loop historically?

> Pre-Java 8 concurrent resize could corrupt links - never share HashMap across threads. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q371 · KeySet view behavior?

> Backed by map - remove reflects; add unsupported usually. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q372 · subList pitfalls?

> View of original; structural changes to original can break subList semantics. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q373 · WeakHashMap value references key?

> Then entry never cleared - subtle leak. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q374 · PhantomReference must be registered with queue?

> Phantom reachability lets you run cleanup after an object is no longer usable, without allowing resurrection. Pair with `ReferenceQueue`/`Cleaner`, and never retain the cleaned object from the cleanup action.

### Q375 · Hash collisions attack on HashMap?

> HashDoS - treeify mitigates; still validate untrusted keys sizes. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q376 · Comparable consistency with equals for TreeMap?

> Should align; else Map contracts break (size vs contains). Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q377 · IdentityHashMap for serialization graphs?

> Yes - track visited by identity to handle cycles. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q378 · BitSet use?

> Dense boolean sets / flag vectors - memory efficient. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q379 · BitSet vs EnumSet?

> EnumSet typed and safer for enums; BitSet lower-level indexes. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q380 · TransferQueue transfer?

> Waits for consumer to take - sync handoff. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q381 · Reactive Streams relation to Flow API?

> `java.util.concurrent.Flow` is JDK SPI for reactive. Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Pipelines are lazy until a terminal op. Parallelism and captures have real costs - measure before defaulting to `parallelStream()`.

### Q382 · Collections.checkedList?

> Dynamically enforced type means debugging pollution. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q383 · replaceAll on List?

> Unary operator in place - Java 8+. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q384 · sort with Comparator.nullsFirst?

> Explicit null policy for sorting. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q385 · Comparator.thenComparing?

> Lexicographic multi-key sorts. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q386 · Streams on Random?

> ints()/longs() infinite streams - need limit. Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Pipelines are lazy until a terminal op. Parallelism and captures have real costs - measure before defaulting to `parallelStream()`.

### Q387 · CharsetEncoder leftover bytes?

> Handle underflow carefully in chunked encoding. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q388 · ObjectOutputStream header?

> Writes stream header - append scenarios need caution (protocol). Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Pipelines are lazy until a terminal op. Parallelism and captures have real costs - measure before defaulting to `parallelStream()`.

### Q389 · XStream / Jackson risks?

> Polymorphic typing can deserialize gadgets - harden configs. Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Pipelines are lazy until a terminal op. Parallelism and captures have real costs - measure before defaulting to `parallelStream()`.

### Q390 · Immutable Collections factories?

> List/Set/Map.of and Guava/Eclipse equivalents. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q391 · Persistent collections?

> Structural sharing libs (not JDK) for functional updates. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q392 · Defensive streaming APIs?

> Return Stream that closes resources via onClose - document. Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Pipelines are lazy until a terminal op. Parallelism and captures have real costs - measure before defaulting to `parallelStream()`.

### Q393 · AutoCloseable stream from Files.lines?

> `Files.lines` returns a `Stream` that holds an open file resource. You must use try-with-resources on the stream itself (not only consume it), or you can leak file descriptors.

### Q394 · BreakIterator use?

> Locale-sensitive character/word boundaries. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q395 · Collator for sorting text?

> Locale-sensitive ordering means not raw String.compareTo. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q396 · ListResourceBundle vs property?

> Classes vs files - both SPI-ish. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q397 · Charset for Console?

> Platform - be explicit when piping. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q398 · WeakHashMap and null values?

> Allowed; keys weak. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Match the data structure to access pattern and concurrency needs, and obey its equals/ordering contracts.

### Q399 · Reference.enqueue?

> Rarely call manually - GC enqueues. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q400 · Protocol version STREAM_PROTOCOL?

> ObjectStreamConstants means rare compatibility. Always close channels/streams (try-with-resources). Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q401 · Optional as field Lombok?

> Still controversial means prefer empty values. Modern Java features reduce boilerplate only when they clarify the domain model. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q402 · hashCode redistributes in HashMap?

> XOR shift mixing reduces collisions from poor hashes. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q403 · HashMap key Self-reference?

> Possible; equals must be careful; toString can recurse - watch. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q404 · Caffeine/Guava cache vs WeakHashMap?

> Real caches need size/time eviction - WeakHashMap is not enough. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q405 · Serialization resetting finals?

> readObject can set finals via special mechanisms - another ser quirk. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Treat deserialization of untrusted bytes as a security boundary. Prefer explicit filters or non-Java formats for public protocols.

### Q406 · Collection.toArray() Object[]?

> Always Object[]; prefer typed overload. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q407 · IdentityHashMap expected max size ctor?

> Tuning like HashMap - different load internals. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q408 · EnumSet.noneOf?

> Typed empty set - prefer over raw. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q409 · EnumSet.clone?

> Fast bit copy - mutable copy. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q410 · BitSet nextSetBit?

> Iterate set bits efficiently. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q411 · TreeMap red-black invariants?

> Balanced BST means o(log n) guarantee. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q412 · SkipList probabilistic balance?

> ConcurrentSkipList* - expected log complexity. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q413 · Snapshot iterators COW?

> Traverse immutable array snapshot - no CME. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q414 · Write amplification COW?

> Each mutation copies means o(n) write. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q415 · When COWSet?

> Small sets rare writes - listener registries. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q416 · Reactive listener registration pattern?

> CopyOnWriteArrayList classic. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Know whether iterators are fail-fast or weakly consistent before sharing across threads. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q417 · Reactive streams backpressure?

> Formalize observer with demand - Flow. Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Pipelines are lazy until a terminal op. Parallelism and captures have real costs - measure before defaulting to `parallelStream()`.

### Q418 · Iterator fail-fast fail?

> Best effort CME - not security. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Know whether iterators are fail-fast or weakly consistent before sharing across threads. CME is a diagnostic aid, not a concurrency protocol. Two threads mutating an `ArrayList` can still corrupt it without always throwing - use concurrent structures or external locking.

### Q419 · Spliterator characteristics?

> ORDERED/SIZED/SUBSIZED/IMMUTABLE/CONCURRENT/DISTINCT/SORTED/NONNULL means stream optimization. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q420 · Stream source mutation?

> Undefined if mutate during - don't. Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Pipelines are lazy until a terminal op. Parallelism and captures have real costs - measure before defaulting to `parallelStream()`.

### Q421 · Generator streams Random?

> Unlimited; always bound. Always close channels/streams (try-with-resources). Pay attention to captures and lifecycle: bound references and lambdas can retain enclosing instances and allocate more than they appear to.

### Q422 · Collectors.filtering?

> Downstream filter - grouping cleverness. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q423 · Collectors.flatMapping?

> Downstream flatMap. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. The right collector depends on latency vs throughput goals and heap size - not fashion. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q424 · Custom Collector supplier/accumulator/combiner/finisher?

> Four functions (+ characteristics) - parallel aware. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q425 · toList() Java 16?

> Unmodifiable List collector shorthand. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q426 · Stream.toList vs Collectors.toList?

> toList unmodifiable; Collectors.toList mutable ArrayList historically. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q427 · Memory visibility after parallel stream?

> Terminal op hb after - safe publication of results. Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Pipelines are lazy until a terminal op. Parallelism and captures have real costs - measure before defaulting to `parallelStream()`.

### Q428 · Exception in parallel stream?

> Wrapped; may cancel other tasks. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Preserve cause chains and inspect suppressed exceptions from try-with-resources. Do not use exceptions for ordinary control flow on hot paths.

### Q429 · False sharing in parallel streams?

> Mutable shared accumulators means use collectors. Two cores writing adjacent fields invalidate the same cache line and destroy scalability. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q430 · Record as HashMap key?

> Good if components immutable. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Match the data structure to access pattern and concurrency needs, and obey its equals/ordering contracts.

### Q431 · Arrays as HashMap keys?

> Use List or wrap - array equals by identity. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q432 · TreeMap comparator consistency?

> Must be consistent with equals if used as Map. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q433 · SortedSet and equals contract?

> Membership by compareTo==0 - subtle. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q434 · NavigableSet subSet views?

> Half-open ranges - careful endpoints. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q435 · ArrayDeque as Stack?

> push/pop/peek - official recommendation. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q436 · Queue offer vs add?

> offer returns false if capacity full; add throws. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q437 · DelayQueue and equals?

> Ordering by delay; identity care. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q438 · Work stealing vs shared queue?

> FJ steals from others' deques - reduces contention. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q439 · Young live set size?

> Survivors occupancy - promotion pressure. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q440 · Listener + lambda leak?

> Unregister; weak listeners patterns. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Pay attention to captures and lifecycle: bound references and lambdas can retain enclosing instances and allocate more than they appear to.

### Q441 · WeakListener pattern?

> Store weak ref to listener - GC allows drop. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q442 · HashMap computeIfAbsent reentrant update?

> Illegal/undefined means don't. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q443 · Collections.unmodifiable and serialization?

> May serialize as own types - details vary. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q444 · Immutable list implementations JDK?

> Compact List12 etc. - identity/random access tuned. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Map symptoms to a subsystem (loader, heap/GC, stacks, JIT) and collect the matching artifact before changing random flags.

### Q445 · BinarySearch on LinkedList?

> Painfully slow means randomAccess matters. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q446 · checked* collections?

> Dynamic type safety. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q447 · emptyList singleton?

> Yes - immutable shared. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q448 · singletonList?

> Tiny immutable. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Know whether iterators are fail-fast or weakly consistent before sharing across threads. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q449 · reducing with Optional?

> Empty stream → empty Optional. Modern Java features reduce boilerplate only when they clarify the domain model. Lean on the compiler (exhaustiveness, immutability) rather than reintroducing mutable bags of fields. Pipelines are lazy until a terminal op. Parallelism and captures have real costs - measure before defaulting to `parallelStream()`.

### Q450 · Primitive iterators?

> OfInt etc. means specialized. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q451 · Comparator.comparing chain?

> Readable multi-field sorts. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q452 · Sort stability importance?

> Multi-key sorts by successive stable sorts. Match the data structure to access pattern and concurrency needs, and obey its equals/ordering contracts. If you cannot state the concurrency and equality/ordering contracts, pick a simpler structure or wrap access explicitly.

### Q453 · TimSort runs?

> Exploits natural runs in data means real-world fast. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q454 · Dual-pivot quicksort?

> Primitive Arrays.sort means average fast. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q455 · Counting sort where?

> Bytes/shorts possibly means specialized. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q456 · BitSet for primes sieve?

> Classic teaching. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Know whether iterators are fail-fast or weakly consistent before sharing across threads. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q457 · EnumSet for flags instead of int bits?

> Readable; BitSet for huge dense. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q458 · State sets in parsers?

> EnumSet great. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Know whether iterators are fail-fast or weakly consistent before sharing across threads. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q459 · BitSet denser than boolean[]?

> Yes - pack bits. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q460 · codePoints() stream?

> Iterate Unicode scalar values. Always close channels/streams (try-with-resources). Pay attention to captures and lifecycle: bound references and lambdas can retain enclosing instances and allocate more than they appear to.

### Q461 · PushbackInputStream?

> Unread bytes means parsers. Always close channels/streams (try-with-resources). Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q462 · SequenceInputStream?

> Concatenate streams. Always close channels/streams (try-with-resources). Pay attention to captures and lifecycle: bound references and lambdas can retain enclosing instances and allocate more than they appear to.

### Q463 · Tee streams?

> Libraries to fork output - logging. Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Pipelines are lazy until a terminal op. Parallelism and captures have real costs - measure before defaulting to `parallelStream()`.

### Q464 · setAccessible false still?

> May still fail for modules. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q465 · Cipher streams?

> EncryptingInputStream patterns - auth tags for GCM. Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Pipelines are lazy until a terminal op. Parallelism and captures have real costs - measure before defaulting to `parallelStream()`.

### Q466 · ResultSet type/concurrency?

> Scroll sensitivity - know defaults FORWARD_ONLY. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q467 · Streaming large results?

> Avoid load all; stream/cursor. Always close channels/streams (try-with-resources). Pay attention to captures and lifecycle: bound references and lambdas can retain enclosing instances and allocate more than they appear to.

### Q468 · BLOB streaming?

> getBinaryStream means memory. Always close channels/streams (try-with-resources). Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q469 · OFFSET pagination cost?

> Large offsets slow - keyset pagination. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

---

## Concurrency & the Java Memory Model

`Q470–Q605` · Happens-before, volatile vs locks, atomics, pools, and virtual threads.

### Q470 · What is the Java Memory Model (JMM)?

> Spec defining when writes become visible across threads and which reorderings are allowed. Built on happens-before. Think of the JMM as the contract between your source code and what CPUs/compilers may reorder. Correct concurrent code is less about 'I used a lock somewhere' and more about ensuring every shared read is connected by happens-before to the writes that matter.

### Q471 · What is happens-before?

> Partial order: if A hb B, B sees A's effects. From program order, monitor unlock→lock, volatile write→read, thread start/join, etc. Without a happens-before edge, the JMM allows surprising reorderings and stale reads - even on a single variable. Build mental edges from: program order in one thread, unlock→lock on the same monitor, volatile write→read, thread start/join, and concurrent collection publication guarantees.

### Q472 · What is volatile?

> Ensures visibility and ordering for that variable's reads/writes (and acts as a memory barrier). Does not make compound ops atomic. Volatile does **not** make `i++` atomic and does not replace a lock for compound actions. Use it for simple flags, safe publication of immutable state, or as part of lock-free algorithms with CAS. If you need check-then-act, reach for atomics or synchronized/locks. A volatile read always sees the latest write to that variable (with the ordering constraints the JMM defines). Combine with CAS for lock-free updates; do not invent 'volatile + luck' protocols for multi-field invariants.

### Q473 · volatile vs synchronized?

> volatile = visibility/ordering for single vars. synchronized = mutual exclusion + visibility for the critical section. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q474 · What is a data race?

> Conflicting accesses (at least one write) to same location without happens-before - undefined visibility/tearing risks. A data race is undefined behavior under the JMM for that location - visibility failures are allowed. A race condition is broader: any timing-dependent logic bug. You can have race conditions without data races (e.g., bad check-then-act under a lock ordering mistake) and vice versa.

### Q475 · What is race condition vs data race?

> Race condition = logic bug from timing. Data race = JMM-level unsynchronized conflicting access. Related but not identical. A data race is undefined behavior under the JMM for that location - visibility failures are allowed. A race condition is broader: any timing-dependent logic bug. You can have race conditions without data races (e.g., bad check-then-act under a lock ordering mistake) and vice versa.

### Q476 · How does synchronized work historically?

> Monitor per object: biased → lightweight → inflated fat locks (evolved over JDK versions; biased locking removed in newer JDKs). In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Prefer clear `java.util.concurrent` utilities over homemade protocols. Prefer synchronizing on a private final lock object over public API types. Keep critical sections tiny - lock scope is a latency and deadlock budget.

### Q477 · What is a monitor / intrinsic lock?

> Every object has a monitor. `synchronized` acquires it; only one owner; wait/notify tied to that monitor. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q478 · wait/notify requirements?

> Must hold the monitor. Always wait in a loop checking condition (spurious wakeup). notifyAll often safer than notify. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q479 · What is spurious wakeup?

> Thread may leave wait without notify means hence while(!cond) wait();. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q480 · ReentrantLock vs synchronized?

> API lock: tryLock, timed, interruptible, fairness option, multiple conditions. synchronized is concise/less error-prone for simple cases. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q481 · What is lock fairness?

> Fair locks honor queue order; lower throughput. Unfair allows barging - usually faster. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q482 · ReadWriteLock idea?

> Many concurrent readers or one writer. Helps read-heavy workloads; writers can starve if mismanaged. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q483 · StampedLock briefly?

> Optimistic reads + read/write locks. Powerful but harder; careful with conversion. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q484 · What is deadlock?

> Cycle of lock waits. Prevent via lock ordering, timeouts, tryLock, reducing lock scope. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Prefer clear `java.util.concurrent` utilities over homemade protocols. Capture a thread dump when stuck; the JVM can report deadlock cycles via `jstack` / `ThreadMXBean`. Prevention beats detection: ordered locks, `tryLock` timeouts, and smaller critical sections.

### Q485 · What is livelock?

> Threads keep changing state in response to each other but make no progress. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q486 · What is thread starvation?

> A thread never gets CPU/locks due to scheduling/fairness issues. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q487 · AtomicInteger how?

> CAS (compare-and-swap) on volatile value - lock-free updates for single variables. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q488 · What is CAS?

> CPU atomic: update if value still expected. Basis of lock-free algorithms; can suffer ABA. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q489 · What is the ABA problem?

> Value A→B→A fools CAS into success. Mitigate with version tags (AtomicStampedReference). Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q490 · LongAdder vs AtomicLong?

> LongAdder stripes counters across cells - better under high contention for stats; not for identity semantics. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q491 · What is ThreadLocal?

> Per-thread map of values. Great for context; leak risk in pools if not `remove()`. In thread pools the worker outlives your request - always `remove()` in a `finally`. Leaked values often pin application ClassLoaders and show up as Metaspace growth after redeploys. Great for request context (correlation ids) if lifecycle is strict. In pooled threads, treat `remove()` as mandatory hygiene - same severity as closing a stream.

### Q492 · InheritableThreadLocal?

> Child threads copy parent values at creation - not dynamically linked afterward. In thread pools the worker outlives your request - always `remove()` in a `finally`. Leaked values often pin application ClassLoaders and show up as Metaspace growth after redeploys. Great for request context (correlation ids) if lifecycle is strict. In pooled threads, treat `remove()` as mandatory hygiene - same severity as closing a stream.

### Q493 · Executor framework roles?

> Decouple task submission from thread management: thread pools, scheduling, Futures. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q494 · What is ForkJoinPool?

> Work-stealing pool for recursive divide-and-conquer (parallel streams use common pool). The common pool is shared (parallel streams, some async defaults). Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q495 · parallelStream caveats?

> Uses common ForkJoinPool; blocking tasks can starve it. Not always faster - overhead + contention. Parallelism helps CPU-bound, splittable, associative reductions on large data. Pipelines are lazy until a terminal op. Parallelism and captures have real costs - measure before defaulting to `parallelStream()`.

### Q496 · Callable vs Runnable?

> Callable returns value and throws checked exceptions; Runnable cannot. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q497 · Future vs CompletableFuture?

> Future is blocking get. CompletableFuture supports composition, async pipelines, combining stages. `*Async` without an executor uses the common ForkJoinPool - do not block those workers. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q498 · What is a CountDownLatch?

> One-shot barrier: wait until N counts reach zero means good for start/done gates. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q499 · What is a CyclicBarrier?

> Reusable barrier: N parties await then run optional action means phased parallel work. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q500 · What is Phaser?

> Flexible multi-phase barrier with dynamic registration. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q501 · Semaphore use?

> Permit pool for rate limiting / bounding concurrency. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q502 · Exchanger use?

> Two threads swap objects at a rendezvous point. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q503 · BlockingQueue role?

> Producer-consumer handoff with blocking put/take - core concurrent design building block. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q504 · What is happens-before for Thread.start?

> Actions in parent before start hb actions in child at start. Without a happens-before edge, the JMM allows surprising reorderings and stale reads - even on a single variable. Build mental edges from: program order in one thread, unlock→lock on the same monitor, volatile write→read, thread start/join, and concurrent collection publication guarantees.

### Q505 · What is happens-before for Thread.join?

> Child thread completion hb return from join in parent. Without a happens-before edge, the JMM allows surprising reorderings and stale reads - even on a single variable. Build mental edges from: program order in one thread, unlock→lock on the same monitor, volatile write→read, thread start/join, and concurrent collection publication guarantees.

### Q506 · Double-checked locking - correct pattern?

> Need volatile field (or equivalent safe publication) so partially constructed objects are not seen. The classic broken pattern published a partially constructed object on non-volatile fields. With a `volatile` field (or holder-class / enum singleton), the publish is safe. Prefer clearer lazy idioms unless you have measured a real contention need.

### Q507 · Why is `synchronized (new Object())` useless?

> Every thread locks a different monitor - no mutual exclusion. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q508 · Thread interruption model?

> Set interrupt flag; blocking methods throw InterruptedException and clear flag. Preserve interrupt status if you cannot handle. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Prefer clear `java.util.concurrent` utilities over homemade protocols.

### Q509 · Daemon threads?

> JVM exits when only daemon threads remain. Not for critical work needing completion. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q510 · What is virtual threads (Project Loom)?

> Lightweight JVM-scheduled threads (Java 21+) multiplexing onto carrier platform threads - excellent for blocking I/O concurrency. They shine for high-concurrency blocking I/O, not for turning CPU-bound work into free parallelism. Avoid pinning carriers with long `synchronized` blocks around blocking calls; prefer `java.util.concurrent` locks when it matters. Still bound CPU work to roughly core-count pools.

### Q511 · Pinning with virtual threads?

> Holding a monitor/`synchronized` while blocking can pin carrier threads - prefer java.util.concurrent locks when it matters. They shine for high-concurrency blocking I/O, not for turning CPU-bound work into free parallelism. Avoid pinning carriers with long `synchronized` blocks around blocking calls; prefer `java.util.concurrent` locks when it matters. Still bound CPU work to roughly core-count pools.

### Q512 · Structured concurrency idea?

> Treat related tasks as a unit with clear lifetimes/cancellation (APIs evolving in modern Java). Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q513 · Memory visibility of finals after construction?

> Properly published object with finals → other threads see finals initialized (freeze). Most production defects here are lifecycle or encoding mistakes - close resources and name the charset.

### Q514 · What is false sharing?

> Unrelated fields on same cache line cause ping-pong between CPUs - pad/align hot counters. Two cores writing adjacent fields invalidate the same cache line and destroy scalability. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q515 · Can the compiler reorder statements?

> Yes within JMM rules if single-thread semantics preserved and no hb constraints violated across threads. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q516 · What is a memory barrier/fence?

> CPU/VM instruction constraining reorder and forcing visibility means volatiles/locks insert them. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q517 · Does synchronization only mutually exclude?

> No means also flushes memory effects: unlock hb subsequent lock. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q518 · Are 64-bit long/double atomic?

> Writes may tear without volatile/atomic on some older interpretations; use volatile or atomics for concurrency. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q519 · What is safe initialization of a scratch field?

> Publish via volatile write, synchronized, final, or concurrent structure. Most production defects here are lifecycle or encoding mistakes - close resources and name the charset.

### Q520 · Executors.newFixedThreadPool risks?

> Unbounded queue can OOM under load - prefer ThreadPoolExecutor with bounded queue + policy. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q521 · CallerRunsPolicy meaning?

> Saturated pool runs task on caller thread means natural throttling. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q522 · corePoolSize vs maximumPoolSize?

> Core kept alive; max used when queue full (for bounded queues) means understand Hand-off rules. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q523 · keepAliveTime for core threads?

> With allowCoreThreadTimeOut, core threads may die idle - good for bursty workloads. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q524 · ScheduledThreadPoolExecutor vs Timer?

> Prefer ScheduledExecutor - Timer is single-thread and fails hard on exceptions. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q525 · CompletableFuture default executor?

> Common ForkJoinPool for `*Async` without executor - don't block it. `*Async` without an executor uses the common ForkJoinPool - do not block those workers. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q526 · allOf vs anyOf?

> allOf completes when all complete; anyOf when first completes. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q527 · handle vs whenComplete vs exceptionally?

> handle transforms result/exception; whenComplete side-effect; exceptionally recovers. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Preserve cause chains and inspect suppressed exceptions from try-with-resources. Do not use exceptions for ordinary control flow on hot paths.

### Q528 · Reactive vs virtual threads?

> Virtual threads keep blocking style scalable; reactive needs async APIs - different complexity. They shine for high-concurrency blocking I/O, not for turning CPU-bound work into free parallelism. Avoid pinning carriers with long `synchronized` blocks around blocking calls; prefer `java.util.concurrent` locks when it matters. Still bound CPU work to roughly core-count pools.

### Q529 · Happens-before for volatile arrays?

> Volatile write of array reference ≠ volatile elements; use Atomic*Array or sync. Without a happens-before edge, the JMM allows surprising reorderings and stale reads - even on a single variable. Build mental edges from: program order in one thread, unlock→lock on the same monitor, volatile write→read, thread start/join, and concurrent collection publication guarantees.

### Q530 · When is a static block run?

> During class initialization, in textual order with static field inits, once per class loader. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q531 · Can constructors be synchronized?

> No - syntax forbidden; publish safely after construction instead. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q532 · Why not start threads from constructors?

> This escapes before subclass initialized - race hazards. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q533 · Compound assignment casting?

> `x += y` includes implicit cast back to x's type - subtle narrowing. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q534 · ConcurrentHashMap null policy?

> Disallows null keys/values means avoids ambiguity of absence. It allows high concurrency for independent keys without locking the entire map. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q535 · size() of ConcurrentHashMap?

> May be estimate under concurrency historically; modern is accurate but costlier. It allows high concurrency for independent keys without locking the entire map. Iterators are weakly consistent: they may see later updates and do not throw `ConcurrentModificationException`. Null keys/values are forbidden - absence is unambiguous.

### Q536 · Collections.synchronizedList iterators?

> Must manually synchronize on list when iterating! In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q537 · Why ConcurrentHashMap.computeIfAbsent not for expensive recursive builds sometimes?

> Holds bin locks; long functions increase contention - know costs. It allows high concurrency for independent keys without locking the entire map. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q538 · Thread.start twice?

> IllegalThreadStateException - one-shot. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q539 · volatile boolean shutdown flag?

> Common pattern for simple stop signals; still not atomic compound state machines. Prefer measuring with JFR/`jcmd` over folklore. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q540 · AtomicReference CAS loop?

> Typical lock-free update: read, compute next, compareAndSet until success. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q541 · synchronized method equals synchronized(this)?

> Yes for instance methods; static syncs on Class object. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q542 · Lock striping idea?

> Different locks for independent hotspots - ConcurrentHashMap segments historically. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q543 · park/unpark (LockSupport)?

> Efficient thread blocking primitives used by locks - permit-based. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q544 · Phaser vs CyclicBarrier choose?

> Phaser for dynamic parties/multi-phase; CyclicBarrier simpler fixed parties. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q545 · Daemon thread finally blocks?

> May not complete on JVM exit - don't rely for cleanup. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q546 · ClassLoader leak via ThreadLocal?

> Value holds class from child loader - classic Tomcat warning. In thread pools the worker outlives your request - always `remove()` in a `finally`. Leaked values often pin application ClassLoaders and show up as Metaspace growth after redeploys. Great for request context (correlation ids) if lifecycle is strict. In pooled threads, treat `remove()` as mandatory hygiene - same severity as closing a stream.

### Q547 · SoftReference cache stampede?

> Many threads may reload means combine with computeIfAbsent carefully. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q548 · Finalizer thread existence?

> Legacy finalization thread; prefer Cleaner. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. References couple lifetime to reachability; they are not a general resource-management substitute for try-with-resources.

### Q549 · synchronized allocation elision?

> Escape analysis may remove locks on non-escaping objects - surprising microbench results. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q550 · Biased locking historically?

> Optimized uncontended sync for single thread owner - revoked expensively; removed later. Know it for reading older material and GC/safepoint war stories. On modern JDKs the story is thin/fat locks and contending CAS - focus on reducing lock scope and contention rather than nostalgia flags.

### Q551 · Thin locks?

> CAS mark word for uncontended locking without object monitor inflate. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q552 · PriorityQueue not synchronized?

> True - external sync or PriorityBlockingQueue. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q553 · DelayQueue take blocking?

> Waits until head expired - task schedulers. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q554 · CompletableFuture cancel may not interrupt?

> Depends whether underlying stage supports interrupt - check carefully. `*Async` without an executor uses the common ForkJoinPool - do not block those workers. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q555 · Virtual thread per task Executor?

> Executors.newVirtualThreadPerTaskExecutor - unbounded style concurrency. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q556 · Semaphore fairness?

> Optional fair ordering of acquirers. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q557 · ReadWriteLock reentrancy?

> ReentrantReadWriteLock supports; watch upgrade deadlock (read→write). In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q558 · StampedLock optimistic read validation?

> validate(stamp) after reading fields - retry if fail. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q559 · Deadlock detection JVM?

> ThreadMXBean.findDeadlockedThreads - useful ops tool. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q560 · Shenandoah barriers cost?

> Some throughput trade for pause goals. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q561 · DecimalFormat thread safety?

> Not thread-safe - ThreadLocal or create per use. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q562 · SimpleDateFormat thread safety?

> Notoriously unsafe - use DateTimeFormatter. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q563 · Clock abstraction?

> Inject Clock for testable time. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q564 · Process deadlock streams?

> Must consume stdout/stderr or buffer fills - use redirect/inherit. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q565 · onExit CompletableFuture Process?

> Java 9+ async process completion. `*Async` without an executor uses the common ForkJoinPool - do not block those workers. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q566 · Alignment for atomic ops?

> Misaligned atomics undefined/slow on some CPUs - VM handles fields. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q567 · Contended atomics?

> LongAdder / striping / padding. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q568 · CPU memory model vs JMM?

> JMM maps onto CPU reorderings via barriers means portable abstraction. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q569 · Boolean.TRUE lock?

> Anti-pattern - global contention. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q570 · interned String locks?

> Never synchronize on literals - global. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q571 · Atomic*FieldUpdater?

> Reflection-like atomics on fields - VarHandle preferred now. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q572 · ThreadLocalRandom?

> Faster per-thread PRNG - not for security. In thread pools the worker outlives your request - always `remove()` in a `finally`. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q573 · SecureRandom blocking entropy?

> May block on entropy starvations - plan for servers. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q574 · ConcurrentHashMap size controls?

> Not bounded - wrap with logic or use cache libs. It allows high concurrency for independent keys without locking the entire map. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q575 · Why ConcurrentSkipListMap sorted concurrent?

> Hard to make TreeMap concurrent; skip lists fit CAS. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q576 · Happens-before for concurrent collections?

> Insertion hb subsequent retrieval of that element - detailed per class. Without a happens-before edge, the JMM allows surprising reorderings and stale reads - even on a single variable. Build mental edges from: program order in one thread, unlock→lock on the same monitor, volatile write→read, thread start/join, and concurrent collection publication guarantees.

### Q577 · Safe publication via ConcurrentHashMap?

> Yes means put hb later get of same key. It allows high concurrency for independent keys without locking the entire map. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q578 · volatile array elements myth?

> Declaring array volatile does not make element accesses volatile. Be explicit whether you need visibility, atomicity, or both - those requirements pick the tool. Write a two-thread failing test when unsure - concurrency bugs that only exist in comments are not fixed.

### Q579 · AtomicReferenceArray?

> Volatile/CAS semantics per element. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q580 · LongBuffer concurrent?

> Buffers not thread-safe - external sync. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q581 · StringBuffer as lock?

> Legacy; don't invent locks on shared buffers. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q582 · Class init lock?

> Per-class initialization is synchronized - deadlocks possible with weird static cycles. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q583 · Double-checked locking final helper?

> Holder class or enum usually clearer. The classic broken pattern published a partially constructed object on non-volatile fields. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q584 · CONCURRENT collector characteristic?

> Thread-safe accumulator - groupingByConcurrent. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q585 · ManagedBlocker purpose?

> Compensate FJ workers when blocking. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q586 · Virtual threads replace FJ for blocking?

> Often yes for I/O bound task graphs. They shine for high-concurrency blocking I/O, not for turning CPU-bound work into free parallelism. Avoid pinning carriers with long `synchronized` blocks around blocking calls; prefer `java.util.concurrent` locks when it matters. Still bound CPU work to roughly core-count pools.

### Q587 · Thread contention profiling?

> JFR monitor enter events - find hot locks. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q588 · LockProfiler mental model?

> Who waits on whom - dumps + flight recordings. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q589 · toString under lock?

> Danger if toString grabs other locks - keep simple. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q590 · hashCode under lock order?

> Same - side effects in equals/hashCode forbidden. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q591 · BlockingQueue put vs offer?

> put blocks; offer timed/nonblocking. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q592 · PriorityBlockingQueue unbounded growth?

> Yes - producers can OOM. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q593 · Lock coarsening?

> JIT merges adjacent sync blocks - microbench surprises. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q594 · Lock elision via escape?

> Remove sync if monitor non-escaping. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q595 · Cache stampede?

> Many miss simultaneously means single-flight computeIfAbsent. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q596 · ConcurrentHashMap computeIfAbsent recursive?

> May throw IllegalStateException - avoid. It allows high concurrency for independent keys without locking the entire map. Iterators are weakly consistent: they may see later updates and do not throw `ConcurrentModificationException`. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q597 · groupingBy Concurrent?

> groupingByConcurrent for parallel. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q598 · toConcurrentMap?

> Parallel friendly map collect. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q599 · Interruptible channels?

> Blocking NIO channel ops can respond to thread interruption by closing the channel and throwing `ClosedByInterruptException`. That differs from bare java.io streams. Design callers to treat interrupt as a real cancellation signal and restore interrupt status when appropriate.

### Q600 · Why not block NIO threads?

> Starves multiplexed channels. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Be explicit whether you need visibility, atomicity, or both - those requirements pick the tool.

### Q601 · Virtual threads + blocking sockets?

> Scales classic I/O - simpler than NIO for many apps. They shine for high-concurrency blocking I/O, not for turning CPU-bound work into free parallelism. Avoid pinning carriers with long `synchronized` blocks around blocking calls; prefer `java.util.concurrent` locks when it matters. Still bound CPU work to roughly core-count pools.

### Q602 · FileLock shared/exclusive?

> OS advisory locks - not always mandatory. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q603 · OverlappingFileLockException?

> JVM-level overlap detection. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Preserve cause chains and inspect suppressed exceptions from try-with-resources. Do not use exceptions for ordinary control flow on hot paths.

### Q604 · Optimistic locking version column?

> JPA @Version - concurrency control. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q605 · Pessimistic locks?

> SELECT FOR UPDATE - contention. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

---

## Reflection, method handles & dynamic proxies

`Q606–Q645` · JDK proxies, CGLIB, Spring AOP, and why `this.foo()` skips your advice.

### Q606 · What is reflection?

> Runtime inspection/invocation of classes, fields, methods, constructors via `java.lang.reflect` - powerful, slower, breaks encapsulation. Cache looked-up `Method`/`Field`/`MethodHandle` instances; do not re-resolve on every call in hot paths. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q607 · Cost of reflection?

> No inlining initially, access checks, boxing, security manager historically. MethodHandles/lookup can be faster when cached. Most production defects here are lifecycle or encoding mistakes - close resources and name the charset.

### Q608 · What is setAccessible?

> Suppresses Java language access checks (within module limits). Deep reflection restricted by JPMS strong encapsulation. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q609 · `--add-opens` meaning?

> CLI flag opening a package for deep reflection to named modules means migration escape hatch. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q610 · What is a MethodHandle?

> Low-level, typed, directly executable reference - JVM can optimize better than classic reflection. After linking, MethodHandles are much closer to ordinary calls for the JIT than reflective `invoke`. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q611 · What is `invokedynamic`?

> Bytecode linking a call site to a bootstrap method that produces a CallSite/MethodHandle - used by lambdas, string concat, dynamic languages. The bootstrap runs once (typically) to link a `CallSite` to a `MethodHandle`; afterward calls are cheap and JIT-friendly. Lambdas, string concat (`StringConcatFactory`), and some dynamic languages lean on this instead of hard-wired `invokevirtual`.

### Q612 · What is a JDK dynamic proxy?

> `Proxy.newProxyInstance`: runtime class implementing interfaces, dispatching to InvocationHandler. Requires interfaces. The generated class extends `Proxy` and implements the interfaces you pass in. Every call - including `equals`/`hashCode`/`toString` unless you special-case them - lands in `InvocationHandler.invoke`. You cannot proxy a concrete class this way; for that you need subclass generation (CGLIB/ByteBuddy) or compile-time weaving.

### Q613 · How does InvocationHandler work?

> `invoke(proxy, method, args)` intercepts every method call (including Object methods unless handled). Treat the handler as the policy object: logging, security, transactions, retries, lazy init. Keep it thin and avoid blocking work if the proxy sits on a hot path. Return types and checked exceptions must remain compatible with the interface method.

### Q614 · JDK proxy limitation?

> Only interfaces (plus Object methods). Cannot subclass concrete class. Confirm the call path crosses the proxy/wrapper; framework annotations do not rewrite internal `this` calls by themselves.

### Q615 · What is CGLIB / ByteBuddy subclass proxy?

> Generate a subclass overriding methods to insert advice. Needs non-final class/methods. Used by Spring when no interface. The enhancer creates a subclass, so constructors still run and `final` methods cannot be advised. Spring often falls back to this when the bean has no interface. In stack traces you will see names like `$$EnhancerBySpringCGLIB$$`.

### Q616 · Spring AOP JDK vs CGLIB?

> Interface → JDK proxy by default historically; class → CGLIB subclass. `@EnableAspectJAutoProxy(proxyTargetClass=true)` forces CGLIB. The enhancer creates a subclass, so constructors still run and `final` methods cannot be advised. Spring often falls back to this when the bean has no interface. In stack traces you will see names like `$$EnhancerBySpringCGLIB$$`.

### Q617 · Why self-invocation bypasses Spring proxies?

> `this.method()` calls the target directly, so Spring proxy advice (`@Transactional`, `@Cacheable`, `@Async`) never runs. That is why annotations look 'broken' on private helper flows inside the same class. Fix by routing through the proxied bean (self-inject), `AopContext.currentProxy()` where enabled, splitting the class, or using AspectJ weaving that intercepts self-calls.

### Q618 · What is the proxy pattern vs decorator?

> Both wrap. Proxy controls access (lazy, remote, security, AOP). Decorator adds responsibilities; same interface often. Modern Java features reduce boilerplate only when they clarify the domain model. Only calls that enter the wrapper receive intercepted behavior; internal `this` calls do not. Check the runtime class name when advice seems missing.

### Q619 · What is a stub/skeleton historically (RMI)?

> Client stub marshals calls; skeleton/server unmarshals means remote proxy idea. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q620 · Equals/hashCode on proxies?

> Handlers must define sensible behavior; default identity can break sets when wrapping equals-based domain objects. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q621 · What is annotation proxies?

> Annotations are interface-based; runtime retains them as proxy-like implementations returning member values. Most production defects here are lifecycle or encoding mistakes - close resources and name the charset.

### Q622 · What is Mockito's mock technically?

> Subclass/interface proxy (ByteBuddy) with interception means same family as AOP proxies. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q623 · Performance of proxies?

> Extra virtual call + handler logic; fine for I/O boundaries; avoid on ultra-hot numeric loops. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q624 · What is composition of proxies?

> Stacking handlers/adapters (transaction → security → metrics). Most production defects here are lifecycle or encoding mistakes - close resources and name the charset. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q625 · Can final classes be proxied by subclassing?

> No means cGLIB/ByteBuddy cannot subclass final. Use interfaces or instrumentation. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q626 · What is bridge method noise in proxies?

> Handlers may see synthetic bridges means filter by `method.isBridge()` when dispatching. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q627 · Default methods on proxied interfaces?

> Handler can `InvocationHandler.invokeDefault` (Java 16+) or reflectively invoke defaults carefully. Keep both the definition and a realistic failure mode in mind means that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q628 · What is a security proxy use case?

> Check permissions before delegating to real subject - classic GoF Proxy. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Only calls that enter the wrapper receive intercepted behavior; internal `this` calls do not. Check the runtime class name when advice seems missing.

### Q629 · Virtual proxy / lazy loading?

> Proxy loads expensive subject on first use (Hibernate entities historically used similar ideas). Confirm the call path crosses the proxy/wrapper; framework annotations do not rewrite internal `this` calls by themselves.

### Q630 · Remote proxy idea?

> Local object represents remote resource; network RPC under the hood. Confirm the call path crosses the proxy/wrapper; framework annotations do not rewrite internal `this` calls by themselves.

### Q631 · Protection proxy idea?

> Controls access based on caller identity/role. Confirm the call path crosses the proxy/wrapper; framework annotations do not rewrite internal `this` calls by themselves. Logging `getClass()` on the bean under discussion is the fastest way to see whether a wrapper is in play.

### Q632 · What is `Proxy.isProxyClass`?

> Detects JDK proxy classes means useful in frameworks. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q633 · ClassLoader argument to newProxyInstance?

> Defines the generated proxy class namespace - usually the interfaces' loader or context loader. Class identity is name + defining loader - the same bytes under two loaders are different types. Most 'it works in IDE but not in the server' bugs trace to loader or module-path mismatches.

### Q634 · Why pass multiple interfaces to Proxy?

> Proxy can implement many; must be visible to the ClassLoader and not conflict. Confirm the call path crosses the proxy/wrapper; framework annotations do not rewrite internal `this` calls by themselves.

### Q635 · Markers like Spring's Advised?

> Proxies often implement advisory interfaces exposing target/advisors for unwrap. Framework magic is still JVM behavior underneath: proxies, classloaders, thread pools, and transactions. Framework features still obey JVM rules: proxies, thread pools, and connection lifecycles. Boundary mistakes (proxy/`this`, pool leaks) dominate outages.

### Q636 · How does Spring @Transactional relate to proxies?

> Advisor intercepts calls through proxy to begin/commit/rollback - self-invocation skips it. Propagation, rollback rules (runtime vs checked), readOnly hints, and proxy boundaries all interact. Framework features still obey JVM rules: proxies, thread pools, and connection lifecycles. Boundary mistakes (proxy/`this`, pool leaks) dominate outages.

### Q637 · Interface proxy vs class proxy equals pitfalls?

> Casting to concrete class fails for JDK proxies; program to interfaces. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Only calls that enter the wrapper receive intercepted behavior; internal `this` calls do not. Check the runtime class name when advice seems missing.

### Q638 · What is target class exposure in Spring?

> AopUtils / Advised#getTargetSource to unwrap - use sparingly. Framework magic is still JVM behavior underneath: proxies, classloaders, thread pools, and transactions. Framework features still obey JVM rules: proxies, thread pools, and connection lifecycles. Boundary mistakes (proxy/`this`, pool leaks) dominate outages.

### Q639 · Can you proxy a class with only private constructors?

> Subclass proxies need accessible ctor; frameworks may fail means prefer interfaces. Only calls that enter the wrapper receive intercepted behavior; internal `this` calls do not. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q640 · How do Java EE/Jakarta interceptors compare?

> Container builds proxies/subclasses around beans similarly to Spring AOP. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q641 · What is AspectJ compile-time weaving vs proxy AOP?

> Weaving inserts calls into bytecode means can intercept self-calls/finals (with limits) unlike pure proxies. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q642 · Performance: AspectJ vs JDK proxy?

> Depends; proxies add indirection; weaving can be tighter but build more complex. Confirm the call path crosses the proxy/wrapper; framework annotations do not rewrite internal `this` calls by themselves.

### Q643 · How are default Object methods handled in InvocationHandler?

> You should special-case equals/hashCode/toString or risk broken collections/logging. Treat the handler as the policy object: logging, security, transactions, retries, lazy init. Keep it thin and avoid blocking work if the proxy sits on a hot path. Return types and checked exceptions must remain compatible with the interface method.

### Q644 · Proxy class name patterns?

> JDK: `$ProxyN`. CGLIB: `EnhancerBy...$$`. Useful recognizing stack traces. Modern Java features reduce boilerplate only when they clarify the domain model. Only calls that enter the wrapper receive intercepted behavior; internal `this` calls do not. Check the runtime class name when advice seems missing.

### Q645 · Can records be subclass-proxied?

> Records are final - no CGLIB subclass. Interface extraction or compile weaving needed. Modern Java features reduce boilerplate only when they clarify the domain model. These features pay off when they make invariants compiler-checked (immutability, exhaustiveness), not when they only shorten syntax.

---

## Serialization, exceptions & errors

`Q646–Q675` · Fragile streams, suppressed exceptions, and linkage errors that mean jar hell.

### Q646 · What is Java serialization?

> Turning object graphs into byte streams via ObjectOutputStream means fragile across versions; security sensitive. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q647 · serialVersionUID purpose?

> `serialVersionUID` is the compatibility fingerprint for a `Serializable` class. If it does not match what the stream expects, deserialization fails with `InvalidClassException`. Declare it explicitly for types you evolve, rather than relying on the compiler's computed default.

### Q648 · What is transient?

> Field skipped by default serialization means recompute in `readObject`. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q649 · readObject/writeObject hooks?

> Custom per-class serialization logic while using default mechanisms for the rest. Keep both the definition and a realistic failure mode in mind means that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q650 · Why serialization is a security risk?

> Deserializing untrusted data can execute gadget chains (RCE). Prefer JSON/protobuf + validation; avoid Java ser on untrusted boundaries. If you must deserialize, use `ObjectInputFilter` allow-lists, keep classes private to your domain, and prefer JSON/protobuf for untrusted boundaries. Java serialization is a feature-complete object graph protocol - that power is exactly the risk.

### Q651 · What is a serialization proxy pattern?

> Serialize a clean proxy object; `readResolve` returns real instance - better invariants. Modern Java features reduce boilerplate only when they clarify the domain model. Only calls that enter the wrapper receive intercepted behavior; internal `this` calls do not. Check the runtime class name when advice seems missing.

### Q652 · Externalizable vs Serializable?

> Externalizable: you fully control stream format via readExternal/writeExternal. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q653 · What does writeReplace/readResolve do?

> Substitute objects during ser/deser (singletons, enums historically, proxies). Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q654 · Enums serialization special?

> By name; cannot create new enum instances via normal deserialization. Most production defects here are lifecycle or encoding mistakes - close resources and name the charset.

### Q655 · Records serialization?

> Supported with canonical constructor reconstitution; still prefer explicit formats for public APIs. Modern Java features reduce boilerplate only when they clarify the domain model. Treat deserialization of untrusted bytes as a security boundary. Prefer explicit filters or non-Java formats for public protocols.

### Q656 · Checked vs unchecked exceptions?

> Checked (Exception except RuntimeException) must declare/handle. Unchecked = RuntimeException/Error - programming defects/fatal. Checked exceptions force API clients to confront recovery paths; overusing them creates noise and wrapping hell. Preserve cause chains and inspect suppressed exceptions from try-with-resources. Do not use exceptions for ordinary control flow on hot paths.

### Q657 · Error vs Exception?

> Error = serious VM/process issues (OOME, StackOverflow). Rarely catch. Exception = recoverable conditions. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Exceptions are for uncommon paths - using them for ordinary control flow is expensive and noisy.

### Q658 · try-with-resources how?

> AutoCloseable closed in reverse order; suppressed exceptions added if close fails after primary failure. Resources close in reverse declaration order. Preserve cause chains and inspect suppressed exceptions from try-with-resources. Do not use exceptions for ordinary control flow on hot paths.

### Q659 · What are suppressed exceptions?

> Attached via `addSuppressed`; visible in stack traces - don't lose close failures. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Exceptions are for uncommon paths - using them for ordinary control flow is expensive and noisy.

### Q660 · catch order matters?

> More specific subclasses before parents - otherwise compile error / dead catches. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Exceptions are for uncommon paths - using them for ordinary control flow is expensive and noisy.

### Q661 · Why not catch Throwable casually?

> May swallow Errors or interrupt control flow; log and rethrow if you must. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q662 · Exception wrapping best practice?

> Chain cause (`new X(msg, e)`) to preserve stack; don't empty-catch. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Preserve cause chains and inspect suppressed exceptions from try-with-resources. Do not use exceptions for ordinary control flow on hot paths.

### Q663 · Performance of exceptions?

> Filling stack traces is expensive - don't use exceptions for normal control flow in hot paths. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Exceptions are for uncommon paths - using them for ordinary control flow is expensive and noisy.

### Q664 · StackTraceElement / fillInStackTrace?

> Throwable captures stack at creation; override/omit carefully for lightweight exceptions. Prefer measuring with JFR/`jcmd` over folklore. Change one flag at a time and keep GC/heap settings aligned with container memory limits. Preserve cause chains and inspect suppressed exceptions from try-with-resources. Do not use exceptions for ordinary control flow on hot paths.

### Q665 · Multi-catch?

> `catch (A | B e)` - e is effectively final; common parent type. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Exceptions are for uncommon paths - using them for ordinary control flow is expensive and noisy.

### Q666 · OutOfMemoryError: Unable to create new native thread?

> OS thread limit / memory for stacks - too many platform threads; consider virtual threads or pool limits. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Prefer clear `java.util.concurrent` utilities over homemade protocols.

### Q667 · VerifyError meaning?

> Bytecode failed verification - corrupt classes or bad instrumentation. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Preserve cause chains and inspect suppressed exceptions from try-with-resources. Do not use exceptions for ordinary control flow on hot paths.

### Q668 · IllegalAccessError vs Exception?

> Linkage Error when access illegal at runtime (often binary incompatibility). Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Preserve cause chains and inspect suppressed exceptions from try-with-resources. Do not use exceptions for ordinary control flow on hot paths.

### Q669 · AbstractMethodError?

> Runtime missing method implementation - dependency version skew. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Preserve cause chains and inspect suppressed exceptions from try-with-resources. Do not use exceptions for ordinary control flow on hot paths.

### Q670 · NoSuchMethodError?

> Invoke linked to missing method - jar hell / version mismatch. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Exceptions are for uncommon paths - using them for ordinary control flow is expensive and noisy.

### Q671 · UnsupportedClassVersionError?

> Class compiled for newer JVM than runtime. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Preserve cause chains and inspect suppressed exceptions from try-with-resources. Do not use exceptions for ordinary control flow on hot paths.

### Q672 · UnsatisfiedLinkError?

> JNI native library missing/unresolvable symbol. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Preserve cause chains and inspect suppressed exceptions from try-with-resources. Do not use exceptions for ordinary control flow on hot paths.

### Q673 · IncompatibleClassChangeError family?

> Binary incompatibilities: fields became static, etc. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Preserve cause chains and inspect suppressed exceptions from try-with-resources. Do not use exceptions for ordinary control flow on hot paths.

### Q674 · BootstrapMethodError?

> invokedynamic bootstrap failed - lambda/metafactory issues. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Preserve cause chains and inspect suppressed exceptions from try-with-resources. Do not use exceptions for ordinary control flow on hot paths.

### Q675 · ZoneRulesException?

> Bad time zone data - missing tzdb. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Preserve cause chains and inspect suppressed exceptions from try-with-resources. Do not use exceptions for ordinary control flow on hot paths.

---

## I/O, NIO & files

`Q676–Q690` · Buffers, channels, selectors, and the charset bugs that only show in production.

### Q676 · java.io streams vs Readers?

> Streams = bytes; Readers/Writers = chars with charset encoding. Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Pipelines are lazy until a terminal op. Parallelism and captures have real costs - measure before defaulting to `parallelStream()`.

### Q677 · What is NIO?

> New I/O: Channels, Buffers, Selectors - non-blocking multiplexing, better large-file control. Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Mind buffer state (`flip`/`clear`/`compact`) and always close channels/streams. Specify charset explicitly at boundaries.

### Q678 · ByteBuffer flip/clear/compact?

> flip: write→read mode (limit=position, position=0). clear: prepare write. compact: slide unread to front. Forgetting `flip` before a read/write to a channel is the classic NIO bug. `compact` preserves unread bytes for the next read cycle; `clear` discards them. Draw the position/limit/capacity diagram once and keep it.

### Q679 · Heap vs direct ByteBuffer?

> Heap on Java heap; direct off-heap for native I/O. Direct has allocation/cleanup costs. Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Allocation and reclamation are more expensive than heap buffers; pool them if you allocate often. Track with `BufferPoolMXBean` / NMT because heap dumps will not show the native payload.

### Q680 · What is a Selector?

> Multiplexes selectable channels (non-blocking) - one thread many sockets (classic Netty building block). Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Mind buffer state (`flip`/`clear`/`compact`) and always close channels/streams. Specify charset explicitly at boundaries.

### Q681 · Path vs File?

> `java.nio.file.Path` modern; File legacy. Use Files utility methods. Most production defects here are lifecycle or encoding mistakes - close resources and name the charset. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q682 · Memory-mapped files?

> `MappedByteBuffer` maps file into address space - OS paging; great for large read patterns. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q683 · Charset encoding pitfalls?

> Always specify Charset; platform default varies. Malformed input strategies matter. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q684 · Buffered streams why?

> Reduce syscalls by batching - huge speedups for small reads/writes. Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Pipelines are lazy until a terminal op. Parallelism and captures have real costs - measure before defaulting to `parallelStream()`.

### Q685 · flush vs close?

> flush pushes buffers; close flushes then releases. try-with-resources handles close. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q686 · Files.lines vs readAllLines?

> lines is lazy stream (close it!); readAllLines loads all - memory. Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Mind buffer state (`flip`/`clear`/`compact`) and always close channels/streams. Specify charset explicitly at boundaries.

### Q687 · WatchService use?

> Directory change notifications means platform quirks abound. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q688 · StandardOpenOption.SYNC?

> Force durability writes means slow but safer for critical data. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q689 · Serialization vs Externalizable for performance?

> Custom Externalizable/ hand formats beat default Java serialization heavily. Most production defects here are lifecycle or encoding mistakes - close resources and name the charset.

### Q690 · NIO2 asynchronous channels?

> Future/CompletionHandler based async file/socket I/O means alternative to selectors. Always close channels/streams (try-with-resources). Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

---

## Lambdas, streams & modern language features

`Q691–Q730` · indy, laziness, records, sealed types, and collectors done right.

### Q691 · What is a lambda at bytecode level?

> invokedynamic → LambdaMetafactory spinning a call site to a method handle (often static method in same class). Capturing lambdas may allocate; non-capturing ones can be cached as singletons. Pipelines are lazy until a terminal op. Parallelism and captures have real costs - measure before defaulting to `parallelStream()`.

### Q692 · Capturing vs non-capturing lambdas?

> Non-capturing can be singleton-like; capturing allocates/binds locals means allocation cost. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q693 · Why effectively final captures?

> Lambdas capture values, not variables; prevents confusing mutable shared state. Keep both the definition and a realistic failure mode in mind means that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q694 · Stream pipeline laziness?

> Intermediate ops form a pipeline; terminal op triggers pull evaluation. Nothing runs until a terminal operation. That lets `filter`+`map`+`findFirst` short-circuit, but it also means side effects in intermediate ops are a design smell - especially under `parallel()`. Pipelines are lazy until a terminal op. Parallelism and captures have real costs - measure before defaulting to `parallelStream()`.

### Q695 · Stateful vs stateless intermediate ops?

> sorted/distinct may buffer; map/filter are stateless means affects parallel performance. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q696 · Short-circuiting ops?

> findFirst, anyMatch, limit can stop early. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q697 · Ordering in parallel streams?

> Encounter order may cost; `forEachOrdered` preserves; `forEach` may not. Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Pipelines are lazy until a terminal op. Parallelism and captures have real costs - measure before defaulting to `parallelStream()`.

### Q698 · Collector vs forEach side effects?

> Prefer collectors for results; forEach side effects complicate parallel safety. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q699 · What is a spliterator?

> Splits data for parallel traversal - backbone of stream parallelism. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Respect equals/hashCode (or ordering) contracts and the structure's concurrency story. Fail-fast iterators are diagnostics, not a locking protocol.

### Q700 · Optional discipline?

> Return type for 'maybe'; avoid Optional.get without check; prefer orElse/orElseGet/ifPresent. Modern Java features reduce boilerplate only when they clarify the domain model. Pipelines are lazy until a terminal op. Parallelism and captures have real costs - measure before defaulting to `parallelStream()`.

### Q701 · Retention policies?

> SOURCE (discard), CLASS (in bytecode, not runtime reflective), RUNTIME (visible via reflection). Most production defects here are lifecycle or encoding mistakes - close resources and name the charset.

### Q702 · Annotation targets?

> TYPE, FIELD, METHOD, PARAMETER, TYPE_USE, RECORD_COMPONENT, etc. Most production defects here are lifecycle or encoding mistakes - close resources and name the charset. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q703 · Inherited meta-annotation?

> Only on class annotations; subclasses appear to inherit means not for methods. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q704 · Repeatable annotations?

> Container annotation holds array; syntactic sugar for multiples. Most production defects here are lifecycle or encoding mistakes - close resources and name the charset. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q705 · Annotation processing (APT)?

> Compile-time codegen/validation via AbstractProcessor means lombok-like tools. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q706 · What are records?

> Transparent carriers: final fields, canonical ctor, accessors, equals/hashCode/toString generated. They are shallowly immutable by default: if a component is a mutable list, callers can still mutate it unless you defensively copy. These features pay off when they make invariants compiler-checked (immutability, exhaustiveness), not when they only shorten syntax.

### Q707 · What are sealed classes?

> Restrict which types may extend/implement - enables exhaustive switches. Domain modeling becomes closer to algebraic data types: a small permitted set of subtypes and exhaustive `switch`. When you add a permitted type, the compiler shows you every switch that must be updated - that is the point.

### Q708 · Pattern matching for instanceof?

> Bind variable in check means less casting boilerplate. Modern Java features reduce boilerplate only when they clarify the domain model. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q709 · switch expressions?

> Yield values; exhaustiveness checking with sealed/enums. Most production defects here are lifecycle or encoding mistakes - close resources and name the charset. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q710 · Modules `exports` vs `opens`?

> exports = compile/runtime API. opens = reflective access at runtime. Class identity is name + defining loader - the same bytes under two loaders are different types. Most 'it works in IDE but not in the server' bugs trace to loader or module-path mismatches. Explicit `requires`/`exports`/`opens` make dependencies visible and reflection constrained. Most migration pain is split packages and libraries that assumed free classpath access.

### Q711 · `requires transitive`?

> Re-exports dependency to your consumers means aPI dependency. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q712 · What is jlink?

> Build custom runtime images with only needed modules. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q713 · Var keyword?

> Local variable type inference means still statically typed. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q714 · Text blocks indentation?

> Incidental indentation stripped based on closing delimiter column. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. These features pay off when they make invariants compiler-checked (immutability, exhaustiveness), not when they only shorten syntax.

### Q715 · Sequenced collections (21+)?

> Unified first/last/reversed APIs across List/LinkedHashSet/etc. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q716 · What is a sealed interface permit list?

> Explicit subtypes means compiler exhaustiveness in switches. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q717 · Record canonical constructor validation?

> Compact constructor can validate/normalize components before assignment. Modern Java features reduce boilerplate only when they clarify the domain model. Most production defects here are lifecycle or encoding mistakes - close resources and name the charset.

### Q718 · Pattern matching switch with guards when?

> Refine cases with boolean guards (modern Java) means keep exhaustive. Modern Java features reduce boilerplate only when they clarify the domain model. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q719 · Foreign Function & Memory API idea?

> Replace much JNI with safer off-heap memory and downcalls (evolving). Keep both the definition and a realistic failure mode in mind means that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q720 · StructuredTaskScope purpose?

> Manage multiple virtual-thread tasks as one unit with cancellation. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q721 · SequencedMap useful methods?

> putFirst/putLast/poll* - predictable encounter order APIs. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q722 · UTF-8 by default in Java 18+?

> Charset.defaultCharset often UTF-8 means still specify explicitly in APIs. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q723 · SimpleWebServer (jwebserver)?

> JDK tool for static files means demos/teaching, not production app servers. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q724 · Deprecation of SecurityManager?

> Model obsolete; prefer containers OS isolation and modern security practices. Prefer battle-tested libraries and constant-time compares for secrets. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q725 · Value types / Valhalla direction?

> Future flattened objects without identity means performance for numeric aggregates. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q726 · How does Collectors.groupingBy work?

> Downstream map of classifiers to lists (or custom downstream). Parallel uses concurrent maps when concurrent collector. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. The right collector depends on latency vs throughput goals and heap size - not fashion.

### Q727 · Collectors.toMap duplicate key behavior?

> Throws IllegalStateException unless you supply merge function. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q728 · partitioningBy vs groupingBy?

> partitioningBy is specialized groupingBy for boolean → always two buckets true/false. Keep both the definition and a realistic failure mode in mind means that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q729 · reducing collector?

> General fold - often replaced by summing/averaging helpers. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

### Q730 · teeing collector (Java 12+)?

> Run two collectors and merge results - e.g., min and max in one pass. Read GC logs for pause time, heap before/after, and promotion failures before changing flags. Use GC logs or JFR to see pause time, promotion, and allocation rate before changing flags. Sizing mistakes look like 'the collector is bad' but are often live-set or churn problems.

---

## Bytecode, JIT & HotSpot diagnostics

`Q731–Q760` · `javap`, invoke* family, deopt, and the tools that show what the VM actually did.

### Q731 · What is a .class file roughly?

> Magic/version, constant pool, access flags, fields, methods, attributes (Code, Exceptions, Signature...). Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q732 · What is aload_0?

> Loads local 0 means usually `this` in instance methods. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q733 · invokevirtual vs invokespecial?

> invokevirtual = dynamic dispatch. invokespecial = ctors, private, super calls. `javap -c -p -v` is the fastest way to see what the compiler really emitted (bridges, indy, synthetics). Verify with `javap`/JFR rather than guessing. The interpreter/JIT and safepoints explain many 'why is this slow/pausy' mysteries.

### Q734 · invokeinterface?

> Dispatch on interface method - itable lookup. `javap -c -p -v` is the fastest way to see what the compiler really emitted (bridges, indy, synthetics). Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q735 · invokestatic?

> Static method call - no receiver. `javap -c -p -v` is the fastest way to see what the compiler really emitted (bridges, indy, synthetics). Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q736 · What is a constant pool index?

> Bytecode operands reference pool entries for classes/methods/strings. `javap -c -p -v` is the fastest way to see what the compiler really emitted (bridges, indy, synthetics). Verify with `javap`/JFR rather than guessing. The interpreter/JIT and safepoints explain many 'why is this slow/pausy' mysteries.

### Q737 · Stack map frames?

> Verification type info at jump targets (Java 6+) - speeds/strictens verification. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q738 · What is javap?

> Disassembler to inspect bytecode - essential for understanding compiler sugar. `javap -c -p -v` is the fastest way to see what the compiler really emitted (bridges, indy, synthetics). Verify with `javap`/JFR rather than guessing. The interpreter/JIT and safepoints explain many 'why is this slow/pausy' mysteries.

### Q739 · ACC_PUBLIC and friends?

> Bit flags for visibility and properties (final, abstract, synthetic, enum...). Keep both the definition and a realistic failure mode in mind means that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q740 · LineNumberTable purpose?

> Maps bytecode PCs to source lines for stack traces/debuggers. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q741 · What is equals for arrays?

> `==` identity; `Arrays.equals` content; `Arrays.deepEquals` for nested. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q742 · clone of arrays?

> Arrays clone shallowly but efficiently; multidimensional shares subarrays. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q743 · System.arraycopy vs loops?

> Native bulk copy means much faster for large ranges. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q744 · Why override toString?

> Debuggability/logs; records do it for you. Always be explicit about charset at API boundaries; platform defaults still surprise in containers. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q745 · Comparable anti-pattern with subtraction?

> `return a-b` overflows. Use Integer.compare. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q746 · hashCode distribution tips?

> Use Objects.hash or 31-multiplier pattern; include significant fields only. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q747 · Enum Singleton benefits?

> Serialization-safe, reflection-hardened singleton idiom. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q748 · Initialization-on-demand holder?

> Static nested class lazy loads singleton without locks means class init synchronization. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q749 · SPI breakages with modules?

> Need `uses`/`provides` or correct ClassLoader - classic JDBC/logging issue. Class identity is name + defining loader - the same bytes under two loaders are different types. Most 'it works in IDE but not in the server' bugs trace to loader or module-path mismatches. Explicit `requires`/`exports`/`opens` make dependencies visible and reflection constrained. Most migration pain is split packages and libraries that assumed free classpath access.

### Q750 · Class.isInstance vs instanceof?

> isInstance works with runtime Class tokens dynamically. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q751 · getClass() vs instanceof?

> getClass() exact type; instanceof allows subclasses means equals designs differ. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q752 · Marker interfaces?

> Serializable/Cloneable historically; annotations often replace markers now. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q753 · Covariance of arrays?

> `String[]` is `Object[]` means store Integer → ArrayStoreException at runtime. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q754 · Invariant generics fix for arrays?

> Prefer `List<String>` over `String[]` for type-safe collections. Modern Java features reduce boilerplate only when they clarify the domain model. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q755 · Assertions (`assert`)?

> Disabled by default; enable `-ea`. Not for validating public API args in production logic. Most production defects here are lifecycle or encoding mistakes - close resources and name the charset.

### Q756 · Time zones with Instant vs ZonedDateTime?

> Instant = UTC timeline point; ZonedDateTime = civil time with zone rules. Prefer `java.time` types with an explicit `Clock` in tests; avoid legacy mutable `Date`/`Calendar` in new code.

### Q757 · Why Mutable date APIs were replaced?

> java.util.Date/Calendar mutable and confusing; java.time immutable and clearer. Prefer `java.time` types with an explicit `Clock` in tests; avoid legacy mutable `Date`/`Calendar` in new code. In APIs and persistence, being explicit about instant vs local date-time vs zone prevents an entire class of offset bugs.

### Q758 · SecureRandom vs Random?

> SecureRandom for crypto; Random/SplittableRandom for simulations (thread concerns). Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q759 · UUID versions briefly?

> v4 random common; v7 time-ordered emerging means collision/tradeoff awareness. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q760 · Properties files encoding?

> Historically ISO-8859-1; use UTF-8 Readers / modern load APIs carefully. Always be explicit about charset at API boundaries; platform defaults still surprise in containers. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

---

## Production landmines & systems internals

`Q761–Q962` · The boring bugs that page you at 2am - still too basic to forget.

### Q761 · Can you catch an Error?

> Technically yes; rarely should. OOME catch is usually futile beyond logging. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Exceptions are for uncommon paths - using them for ordinary control flow is expensive and noisy.

### Q762 · Order of initialization with inheritance?

> Super static → sub static → super instance fields/init → super ctor → sub instance → sub ctor. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q763 · private methods polymorphic?

> No means invokespecial; not overridden. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q764 · default method conflict resolution?

> Class wins over interface; otherwise implementor must override. Most production defects here are lifecycle or encoding mistakes - close resources and name the charset. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q765 · What does `this()` vs `super()` do in ctors?

> this() chains same class; super() calls parent. Must be first statement. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q766 · Why clone Type arrays carefully?

> Cast of Object.clone result; prefer Arrays.copyOf. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q767 · What is short-circuit && ||?

> Second operand skipped if first decides result means guards NPEs. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q768 · Enhanced for loop removal?

> Cannot remove safely means use iterator or removeIf. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q769 · Binary search prerequisite?

> Sorted data; wrong order → undefined answer. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q770 · RoundingMode necessity?

> BigDecimal divide needs rounding mode or exact scale means else ArithmeticException. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q771 · float money - why not?

> Binary fractions; use BigDecimal or integer cents. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q772 · LocalDateTime has no zone?

> Cannot represent instants unambiguously means need ZoneId for moments. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q773 · Period vs Duration?

> Period = date-based (months); Duration = time-based (seconds/nanos). Most production defects here are lifecycle or encoding mistakes - close resources and name the charset. In APIs and persistence, being explicit about instant vs local date-time vs zone prevents an entire class of offset bugs.

### Q774 · peek for debugging?

> Yes; not for production mutation logic. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q775 · findAny vs findFirst?

> findAny looser for parallel; findFirst respects order. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q776 · reduce identity requirements?

> Identity must be neutral for the operator means parallel correctness. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q777 · Accumulator vs combiner in collect?

> combiner merges partial results for parallel means must be consistent with accumulator. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q778 · Properties inherits Hashtable quirks?

> Yes means prefer it only for string configs; or use Map/config libs. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q779 · Stack class legacy?

> Extends Vector; prefer ArrayDeque for stack behavior. Prefer measuring with JFR/`jcmd` over folklore. Change one flag at a time and keep GC/heap settings aligned with container memory limits. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q780 · Vector synchronization?

> Methods synchronized means coarse and often insufficient for compound actions. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q781 · fail-safe myth?

> People say CopyOnWrite is fail-safe means better: weakly consistent / snapshot. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q782 · compute methods reentrancy?

> Must not recursively update same map in function means can deadlock/illegal state. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q783 · Runnable exception handling?

> Cannot throw checked; uncaught go to UncaughtExceptionHandler. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Preserve cause chains and inspect suppressed exceptions from try-with-resources. Do not use exceptions for ordinary control flow on hot paths.

### Q784 · Condition await like wait?

> Yes with explicit Lock means multiple conditions per lock. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q785 · CompletionService purpose?

> Poll finished tasks as they complete from a pool of submissions. Keep both the definition and a realistic failure mode in mind means that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q786 · invokeAll timeout semantics?

> Waits up to timeout for all; cancels unfinished depending on usage - read docs carefully. `javap -c -p -v` is the fastest way to see what the compiler really emitted (bridges, indy, synthetics). Reading a little bytecode pays off when diagnosing unexpected allocations or dispatch.

### Q787 · shutdown vs shutdownNow?

> shutdown: no new tasks, finish queue. shutdownNow: interrupt workers, return waiting tasks. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q788 · awaitTermination usage?

> After shutdown, wait for quiet means production graceful stop. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q789 · ReachabilityFence purpose?

> Keep object reachable across critical native ops means niche FFM/JNI. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q790 · Inflated monitors?

> Fat locks with wait sets when contended or wait/notify used. Keep both the definition and a realistic failure mode in mind means that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q791 · Submit Callable get timeout?

> Future.get(timeout) means cancel on TimeoutException if needed. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q792 · orTimeout / completeOnTimeout?

> Java 9+ helpers for async deadlines. Prefer `java.time` types with an explicit `Clock` in tests; avoid legacy mutable `Date`/`Calendar` in new code. In APIs and persistence, being explicit about instant vs local date-time vs zone prevents an entire class of offset bugs.

### Q793 · exceptionallyAsync vs exceptionally?

> Async variants schedule recovery on executor. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Preserve cause chains and inspect suppressed exceptions from try-with-resources. Do not use exceptions for ordinary control flow on hot paths.

### Q794 · thenCompose vs thenApply?

> Compose flattens nested futures means flatMap analog. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q795 · allOf return type Void?

> Yes means join individuals for results. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q796 · Container awareness JVM?

> Modern JDKs respect cgroup memory/cpu limits for ergonomics. Prefer measuring with JFR/`jcmd` over folklore. Change one flag at a time and keep GC/heap settings aligned with container memory limits. Map symptoms to a subsystem (loader, heap/GC, stacks, JIT) and collect the matching artifact before changing random flags.

### Q797 · -XX:MaxRAMPercentage?

> Set heap as percent of available RAM - container friendly. Prefer measuring with JFR/`jcmd` over folklore. Change one flag at a time and keep GC/heap settings aligned with container memory limits. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q798 · Ergonomics meaning?

> JVM auto-tunes heap/GC based on machine resources. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q799 · AlwaysPreTouch?

> Touch pages at startup means predictable latency, slower start. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q800 · Large pages / huge pages?

> Reduce TLB misses for big heaps means ops setup required. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q801 · NUMA awareness?

> Some collectors can spread heap across NUMA nodes. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q802 · Object alignment padding?

> Fields aligned; object sizes multiple of 8 means layout tools show waste. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q803 · Instrumentation.getObjectSize?

> Approx shallow size means agent required. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q804 · Symbol table / system dictionary?

> VM internal tables for names/classes means classloader leaks show here. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q805 · Bytecode verifier why?

> Protect VM from illegal code - security and stability. `javap -c -p -v` is the fastest way to see what the compiler really emitted (bridges, indy, synthetics). Verify with `javap`/JFR rather than guessing. The interpreter/JIT and safepoints explain many 'why is this slow/pausy' mysteries.

### Q806 · StackMapTable mandatory?

> For modern class versions yes - ASM must compute frames. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q807 · ASM / ByteBuddy / Javassist?

> Bytecode engineering libraries for agents and proxies. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q808 · ClassFile API (Java 22+ preview/evolving)?

> Official JDK API to parse/generate class files - future of tooling. Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q809 · Nestmates?

> Java 11+ nests allow private access among nested classes without bridges. Keep both the definition and a realistic failure mode in mind means that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q810 · Nesthost attribute?

> Records which class is nest host for access control. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q811 · Dynamic constants / constant bootstraps?

> condy means lazy constant resolution via bootstraps. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q812 · ConstantDynamic use?

> Complex constants computed once means advanced. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q813 · Signature polymorphic methods?

> MethodHandle.invoke* means special typing rules. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q814 · varargs reification?

> Arrays are reified means heap pollution warnings with generics. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q815 · Generic array creation workaround?

> Create Object[] and cast unchecked means encapsulate. Modern Java features reduce boilerplate only when they clarify the domain model. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q816 · NavigableMap API?

> Ceiling/floor/higher/lower - TreeMap power. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q817 · Descending views?

> descendingMap/KeySet means live reversed views. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q818 · Compute vs merge for frequencies?

> Both work; merge often clearer for counts. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q819 · Files.find vs walk?

> find filters while walking; both need close. Always close channels/streams (try-with-resources). Most production defects here are lifecycle or encoding mistakes - close resources and name the charset.

### Q820 · HTTP Client in java.net.http?

> Modern HTTP/1.1 & 2 client means prefer over HttpURLConnection. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q821 · URI vs URL?

> URI for identifiers; URL for active connection legacy. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q822 · Externalizable superclasses?

> You must manually involve supers if needed. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q823 · XMLEncoder historical?

> Bean serialization to XML means niche/legacy. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q824 · Deep clone libraries?

> Prefer explicit copy; serialization clone is slow/fragile. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q825 · Prototype pattern in Java?

> Copy factories - GoF Prototype. Modern Java features reduce boilerplate only when they clarify the domain model. Lean on the compiler (exhaustiveness, immutability) rather than reintroducing mutable bags of fields. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q826 · Flyweight and Integer cache?

> Same idea: share immutable small values. Never write production logic that depends on `==` for boxed numbers. The cache range can be tuned (`-XX:AutoBoxCacheMax`) which makes such bugs environment-dependent. Immutability and caches make identity comparisons (`==`) and hidden boxing allocations common footguns - prefer `equals` and primitives in hot loops.

### Q827 · Reactive mutation vs immutable?

> Immutability simplifies concurrency means cost allocations. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q828 · Pattern compile once?

> Reuse Pattern; don't compile in hot loops. Modern Java features reduce boilerplate only when they clarify the domain model. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q829 · catastrophic backtracking regex?

> Evil patterns on hostile input means use timeouts/possessive/simple parsers. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q830 · quoteReplacement need?

> When replacement has $ \ specials in Matcher. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q831 · Named capturing groups?

> Regex readability; API support in Matcher. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q832 · Unicode regex flags?

> UNICODE_CASE / UNICODE_CHARACTER_CLASS - know defaults. Prefer measuring with JFR/`jcmd` over folklore. Change one flag at a time and keep GC/heap settings aligned with container memory limits. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q833 · Normalizer NFC/NFD?

> Unicode normalization for comparison means security/forms. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q834 · MessageFormat pitfalls?

> Locale and apostrophe escaping quirks. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q835 · ResourceBundle hierarchy?

> Locale fallback chain for i18n. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q836 · Currency / NumberFormat?

> Locale formatting means not for monetary computation accuracy. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q837 · DateTimeFormatter immutable?

> `DateTimeFormatter` is immutable and thread-safe, unlike the old `SimpleDateFormat`. Share static formatters freely, and prefer it for all new date/time formatting. In APIs and persistence, being explicit about instant vs local date-time vs zone prevents an entire class of offset bugs.

### Q838 · Instant.now coupling?

> Hard to test means prefer Clock. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q839 · Duration.between negatives?

> Order matters means abs if needed. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q840 · Period.between partial days?

> `Period.between` computes a date-based amount (years/months/days) and ignores time-of-day. For elapsed nanoseconds/seconds use `Duration` between instants or times instead. In APIs and persistence, being explicit about instant vs local date-time vs zone prevents an entire class of offset bugs.

### Q841 · TemporalAdjusters?

> `TemporalAdjusters` provides common calendar shifts such as `next(DayOfWeek.MONDAY)` or `lastDayOfMonth()`. They keep date math readable and less error-prone than hand-rolled field arithmetic. In APIs and persistence, being explicit about instant vs local date-time vs zone prevents an entire class of offset bugs.

### Q842 · DayOfWeek math?

> plus/minus wrapping means careful business calendars. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q843 · Cron vs Duration scheduling?

> Cron calendaring vs fixed delays means different tools. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q844 · ProcessBuilder vs Runtime.exec?

> Prefer ProcessBuilder means clearer env/redirects. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q845 · Security of Process args?

> Avoid shell; pass arg lists - injection. Prefer battle-tested libraries and constant-time compares for secrets. Disabling verification 'just for now' in production is how outages become incidents. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q846 · Desktop/AWT headless?

> HeadlessException means server must set headless. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q847 · JMX MBeans?

> Operational management/metrics - expose carefully. Framework magic is still JVM behavior underneath: proxies, classloaders, thread pools, and transactions. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q848 · MXBeans vs MBeans?

> Constrained open types - safer remoting. Framework magic is still JVM behavior underneath: proxies, classloaders, thread pools, and transactions. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q849 · Platform MXBeans?

> MemoryMXBean, ThreadMXBean - built-in telemetry. Framework magic is still JVM behavior underneath: proxies, classloaders, thread pools, and transactions. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q850 · Attach API?

> Load agents into running VMs means ops power tool. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q851 · jmap historical vs jcmd?

> Prefer jcmd means maintained path. Pick the structure for access pattern (index vs key vs order vs concurrency), not familiarity. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q852 · hs_err_pid files?

> JVM crash logs - native faults/bugs. Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q853 · core dumps and SA?

> Serviceability Agent inspects cores. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q854 · Fatal error log sections?

> Registers, stack, heap summary - support gold. Preserve the cause chain when wrapping, and do not catch broad `Throwable` unless you rethrow or terminate deliberately. Preserve cause chains and inspect suppressed exceptions from try-with-resources. Do not use exceptions for ordinary control flow on hot paths.

### Q855 · JVMCI?

> JVM compiler interface - Graal as JIT. Prefer measuring with JFR/`jcmd` over folklore. Change one flag at a time and keep GC/heap settings aligned with container memory limits. Map symptoms to a subsystem (loader, heap/GC, stacks, JIT) and collect the matching artifact before changing random flags.

### Q856 · Graal JIT vs Native Image?

> HotSpot JIT plugin vs AOT closed-world native. Prefer measuring with JFR/`jcmd` over folklore. Change one flag at a time and keep GC/heap settings aligned with container memory limits. Verify with `javap`/JFR rather than guessing. The interpreter/JIT and safepoints explain many 'why is this slow/pausy' mysteries.

### Q857 · Closed-world assumption?

> Native image needs known reflect/resources means config. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q858 · Reachability metadata?

> JSON configs for reflection/JNI in native image. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q859 · Class init at build vs runtime native?

> Init-time rules differ means static init side effects traps. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q860 · Buildpacks / jlink images?

> Ship minimal runtimes means smaller containers. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q861 · Open Session in View?

> Web pattern keeping persistence context means tradeoffs lazy loads vs decoupling. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q862 · LazyInitializationException cause?

> Using lazy association outside session/proxy context. The persistence context closed before you touched a lazy association. Fix with an explicit fetch plan (join fetch / entity graph), a transactional boundary that covers the read, or DTO projection - not by randomly opening sessions in the view forever.

### Q863 · Why learn classloaders for app servers?

> Per-app isolation, redeploy leaks, JDBC driver registration. Class identity is name + defining loader - the same bytes under two loaders are different types. Class identity is name + defining loader. Loader leaks retain Metaspace; SPI/lookups often fail because the wrong context loader was used.

### Q864 · URLClassLoader close?

> Java 7+ Closeable - release jars for delete/redeploy. Class identity is name + defining loader - the same bytes under two loaders are different types. Class identity is name + defining loader. Loader leaks retain Metaspace; SPI/lookups often fail because the wrong context loader was used.

### Q865 · Boot layer?

> Default module layer started by JVM. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q866 · Instrumentation retransform?

> Agents can redefine bodies with limits means no structural changes sometimes. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q867 · redefineClasses limits?

> Cannot add methods arbitrarily means jVMTI constraints. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q868 · Hidden classes?

> Lookup.defineHiddenClass means non-discoverable classes for frameworks (lambdas-like). Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q869 · Dynamic proxies vs hidden classes?

> Modern frameworks may prefer hidden classes/method handles. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q870 · MethodHandles.Lookup modes?

> Access control context of the lookup class - critical security. After linking, MethodHandles are much closer to ordinary calls for the JIT than reflective `invoke`. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q871 · privateLookupIn?

> Deep access within nest/modules rules means frameworks use carefully. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q872 · VarHandle purpose?

> Typed fences/CAS on fields/arrays means modern low-level concurrency. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q873 · MemoryOrder modes on VarHandle?

> Plain/opaque/acquire/release/volatile means finer than volatile. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q874 · Opaque vs acquire-release?

> Progressive ordering strength means expert lock-free. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q875 · FullFence?

> Strong barrier means rare need. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q876 · False sharing detection?

> Perf counters / JOL padding experiments. Two cores writing adjacent fields invalidate the same cache line and destroy scalability. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q877 · Cache line size assumption?

> Typically 64B means not API guaranteed. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q878 · Roach motel reordering metaphor?

> Ops can move in but not out across locks means teaching model. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q879 · Dekker/Peterson algorithms in Java?

> Need volatiles correctly means classic JMM litmus. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q880 · JCStress?

> Concurrency stress tests for JMM behaviors. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q881 · OpenJDK vs Oracle JDK?

> Builds/licensing/cert; same HotSpot lineage mostly. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q882 · LTS releases?

> 8, 11, 17, 21... Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q883 · Preview features?

> `--enable-preview` means not for irreversible prod commits. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q884 · Value-based classes warnings?

> Avoid sync on them; identity not meaningful means integer historically. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q885 · this escape publish in ctor?

> Don't assign this to global/shared before ctor returns. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q886 · Reachability and Soft caches under pressure?

> All soft cleared before OOME typically means still thrash. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q887 · -XX:SoftRefLRUPolicyMSPerMB?

> Tunes soft reference lifetime policy. Prefer measuring with JFR/`jcmd` over folklore. Change one flag at a time and keep GC/heap settings aligned with container memory limits. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q888 · Externalizable with inheritance tree?

> Manual protocol across hierarchy means easy to botch. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q889 · writeObject private magic?

> Signature recognized by serialization machinery means not overriding. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q890 · serialPersistentFields?

> Declare serialized shape explicitly. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q891 · PutField/GetField?

> Advanced custom field ser. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q892 · Validation ObjectInputValidation?

> Post-graph validate means niche. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q893 · Filter ObjectInputFilter?

> JDK filter to reject dangerous classes means mandatory for untrusted. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q894 · Serialization filter factories JEP?

> Global filters means harden apps. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q895 · Protobuf / FlatBuffers?

> Schema evolution & speed - systems languages of data. Always close channels/streams (try-with-resources). For non-blocking designs, understand readiness vs ability-to-complete-an-I/O-call - zero-byte results are normal. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q896 · Avro schema evolution?

> Writer/reader schemas means big data paths. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q897 · Why binary compatibility matters?

> Clients compiled against old jars fail with linkage errors means semantic versioning. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q898 · Source vs binary compatibility?

> Code may recompile but old class files break means or vice versa. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q899 · Default methods binary compat?

> Adding defaults can be compatible means conflicts require care. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q900 · API evolution with generics?

> Erasure helps some changes; bridges appear. Modern Java features reduce boilerplate only when they clarify the domain model. Most production defects here are lifecycle or encoding mistakes - close resources and name the charset.

### Q901 · @Deprecated forRemoval?

> Signals future breakage means plan upgrades. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q902 · Javadoc {@inheritDoc}?

> Documentation inheritance means aPI polish. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q903 · Preview Javadoc features?

> Keep docs aligned with language changes. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q904 · Immudia / immutables libs?

> Generate immutable value types means records cover many cases now. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q905 · Compact ctor vs canonical?

> Compact validates; canonical assigns components. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q906 · Guarded patterns readability?

> Keep guards simple - complex logic → methods. Modern Java features reduce boilerplate only when they clarify the domain model. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q907 · Unnamed patterns/variables?

> Modern `_` for unused - clarity. Modern Java features reduce boilerplate only when they clarify the domain model. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q908 · Unnamed classes (main)?

> Simplified launch for scripts means teaching/demos. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q909 · Instance main methods?

> Evolving launch protocols means watch JEP status. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q910 · Simplified console IO?

> Growing in modern teaching-friendly JEPs. Most production defects here are lifecycle or encoding mistakes - close resources and name the charset. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q911 · SegmentAllocator?

> Allocate within arenas means fFM. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q912 · Linker downcallHandle?

> Call native functions without classic JNI boilerplate. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q913 · Critical JNI vs FFM?

> FFM aims safer/faster path for many cases. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q914 · MemorySegment reinterpret?

> Powerful/unsafe-ish means lifetime discipline. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q915 · ByteBuffer view vs MemorySegment?

> Interop exists means prefer one model per layer. Always close channels/streams (try-with-resources). Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q916 · Why avoid sun.misc.Unsafe?

> Internal, removed gradually; VarHandle/FFM replacements. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q917 · LongAccumulator?

> Custom associative functions under contention means like LongAdder. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q918 · Striped64 idea?

> Shared base of adders means contention cells. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q919 · SplittableRandom?

> Parallel streams friendly splitting. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q920 · UUID.randomUUID SecureRandom?

> Uses secure RNG means costlier than fast PRNG. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q921 · NameUUID from bytes?

> Version 3/5 style name-based means deterministic. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q922 · ULID / UUIDv7?

> Sortable ids means dB index friendliness. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q923 · Snowflake IDs?

> Distributed time+worker ids means clock concerns. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q924 · DB sequence vs UUID?

> Trade locality vs coordination means systems choice. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q925 · Tree bins use comparable?

> Keys should be mutually comparable when treeified - ClassCast risk otherwise. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q926 · AccessibleObject.canAccess?

> Modern check before setAccessible. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q927 · MethodHandle slower first call?

> Linking cost then fast - cache handles. After linking, MethodHandles are much closer to ordinary calls for the JIT than reflective `invoke`. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q928 · Direct method handles inlining?

> JIT can inline through stable handles means reflection rarely. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q929 · CallSite mutable vs constant?

> MutableCallSite for changing targets; ConstantCallSite fixed. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q930 · MutableCallSite for hotswap logic?

> Language runtimes update targets means advanced. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q931 · Invokedynamic for multi-language?

> Da Vinci ML - JRuby etc historically. The bootstrap runs once (typically) to link a `CallSite` to a `MethodHandle`; afterward calls are cheap and JIT-friendly. Pipelines are lazy until a terminal op. Parallelism and captures have real costs - measure before defaulting to `parallelStream()`.

### Q932 · Lambda deserialization metafactory?

> SerializedLambdas reconstruct via bootstrap means rare need. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q933 · Why lambdas not serialize by default easily?

> Captures/env means implement Serializable carefully. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q934 · this::method vs Containing::method?

> Bound vs unbound receivers means different SAM shapes. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q935 · toArray(IntFunction) why?

> Avoid Object[] cast issues means typed arrays. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q936 · Arrays.copyOf range?

> Clarifies sizing/padding with nulls. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q937 · Long.bitCount?

> Hardware POPCOUNT means bit tricks. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q938 · Integer.numberOfLeadingZeros?

> `Integer.numberOfLeadingZeros` is a bit intrinsic often used when rounding up to a power of two (HashMap-style table sizing). It is a building block for mask-friendly capacities, not something you call casually in business logic.

### Q939 · Ceiling power of two?

> tableSizeFor in HashMap means bit twiddling. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q940 · Why capacity power of two?

> Index with mask `hash & (n-1)` instead of mod. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q941 · AVL vs RB in practice?

> JDK uses RB for TreeMap means similar goals. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q942 · Event bus concurrency?

> Define delivery thread model explicitly. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q943 · intern synchronization historically?

> Intern table locks means another reason not to over-intern. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q944 · Eager vs lazy class init?

> Lazy until active use means unless forced. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q945 · Constant compile-time inlining?

> static final primitives/strings may inline into callers means binary compat caution when values change. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q946 · Recompile consumers when constants change?

> Yes if inlined into other class files. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q947 · Ordinal for persistence?

> Fragile means prefer names. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q948 · Singletons and readResolve?

> Classic ser; enums better. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q949 · Bill Pugh holder idiom?

> Nested static holder for lazy singleton. Most production defects here are lifecycle or encoding mistakes - close resources and name the charset. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q950 · Synchronize getInstance?

> Simple correct; may be enough means measure before clever. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q951 · Provider in javax.inject?

> Lazy retrieve - factory-ish. Framework magic is still JVM behavior underneath: proxies, classloaders, thread pools, and transactions. When advice 'does not fire', verify the call path hits the proxy and that the runtime classpath matches what you compiled against. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q952 · Why proxies dominate DI frameworks?

> Cross-cutting without rewriting business code. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q953 · Facade vs Gateway?

> Simplify subsystem vs integrate external means related. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q954 · Bridge vs Adapter?

> Bridge separates abstraction/impl up-front; Adapter fixes after the fact. Treat the definition as incomplete until you can name one failure mode it prevents or explains.

### Q955 · Composite for trees?

> Uniform treat leaf/composite means uI/file trees. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q956 · Strategy with lambdas?

> SAM interfaces make Strategy trivial. Pay attention to captures and lifecycle: bound references and lambdas can retain enclosing instances and allocate more than they appear to.

### Q957 · Template method vs default methods?

> Abstract class hooks vs interface defaults means design taste. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q958 · Observer pitfalls?

> Leaks if not unsubscribe; notify reentrancy. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q959 · estimateSize?

> May be Long.MAX_VALUE unknown. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q960 · takeWhile/dropWhile?

> Java 9 short-circuit prefix ops. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q961 · iterate with predicate?

> Java 9 finite iterate. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q962 · collectingAndThen?

> Finish with transform means to unmodifiable. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

---

## Frameworks, JDBC, security & systems-facing Java

`Q963–Q1000` · Transactions, pools, TLS, and the runtime as part of your architecture.

### Q963 · Thread pool and ThreadLocal leak?

> Workers reused - always remove ThreadLocals in finally. In thread pools the worker outlives your request - always `remove()` in a `finally`. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q964 · MDC in logging with pools?

> Clear MDC after tasks; virtual threads still need care if inherited. Keep both the definition and a realistic failure mode in mind means that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q965 · CDS with Spring?

> Startup improvements with archived classes/AOT processing. Framework magic is still JVM behavior underneath: proxies, classloaders, thread pools, and transactions. Confirm the call path crosses the proxy/wrapper; framework annotations do not rewrite internal `this` calls by themselves.

### Q966 · Spring AOT processing?

> Generate reflect hints / beans at build for native. Framework magic is still JVM behavior underneath: proxies, classloaders, thread pools, and transactions. Framework features still obey JVM rules: proxies, thread pools, and connection lifecycles. Boundary mistakes (proxy/`this`, pool leaks) dominate outages.

### Q967 · Why understand proxies for Spring?

> Transactions, security, caching, async - all proxy advice. Framework magic is still JVM behavior underneath: proxies, classloaders, thread pools, and transactions. Framework features still obey JVM rules: proxies, thread pools, and connection lifecycles. Boundary mistakes (proxy/`this`, pool leaks) dominate outages.

### Q968 · @Async self-invocation?

> `this.method()` calls the target directly, so Spring proxy advice (`@Transactional`, `@Cacheable`, `@Async`) never runs. That is why annotations look 'broken' on private helper flows inside the same class. Fix by routing through the proxied bean (self-inject), `AopContext.currentProxy()` where enabled, splitting the class, or using AspectJ weaving that intercepts self-calls.

### Q969 · @Cacheable same?

> Must go through proxy unless AspectJ. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q970 · Transaction propagation REQUIRED?

> `REQUIRED` joins an existing Spring transaction or creates one if none is active - the usual default. Remember it still depends on proxy interception; self-invocation will not start a transaction.

### Q971 · REQUIRES_NEW proxy behavior?

> Suspend outer via interceptor stack means still proxy-based. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q972 · readOnly transactions optimization?

> Hint to flush mode/drivers means not magic immutability. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q973 · Bytecode enhancement Hibernate?

> Dirty tracking / lazy without interfaces - weaving again. `javap -c -p -v` is the fastest way to see what the compiler really emitted (bridges, indy, synthetics). Verify with `javap`/JFR rather than guessing. The interpreter/JIT and safepoints explain many 'why is this slow/pausy' mysteries.

### Q974 · Equals on JPA entities?

> Prefer business key or careful id strategy - proxies complicate getClass equals. Document which fields participate and keep them immutable while the object is used in hash/sorted structures. Framework features still obey JVM rules: proxies, thread pools, and connection lifecycles. Boundary mistakes (proxy/`this`, pool leaks) dominate outages.

### Q975 · instanceof and Hibernate proxies?

> Proxy subclass may break getClass equals; use Hibernate.getClass. Framework magic is still JVM behavior underneath: proxies, classloaders, thread pools, and transactions. Framework features still obey JVM rules: proxies, thread pools, and connection lifecycles. Boundary mistakes (proxy/`this`, pool leaks) dominate outages.

### Q976 · JDBC DriverManager leak?

> Drivers registered in shared loader - prevent unload. Framework magic is still JVM behavior underneath: proxies, classloaders, thread pools, and transactions. Framework features still obey JVM rules: proxies, thread pools, and connection lifecycles. Boundary mistakes (proxy/`this`, pool leaks) dominate outages.

### Q977 · Static cycle deadlock example?

> Class A static touches B while B static touches A - freeze. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q978 · ServiceLoader vs Spring DI?

> SPI for plugins; DI for app wiring - different scopes. Framework magic is still JVM behavior underneath: proxies, classloaders, thread pools, and transactions. When advice 'does not fire', verify the call path hits the proxy and that the runtime classpath matches what you compiled against.

### Q979 · Decorator vs Proxy vs Adapter?

> Intent differs: add behavior / control access / convert interface. Confirm the call path crosses the proxy/wrapper; framework annotations do not rewrite internal `this` calls by themselves.

### Q980 · teeing min max example?

> Pair results in a record means modern idiom. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q981 · Custom ForkJoinPool for parallelStream?

> Hack via thread context historically; prefer explicit ForkJoin tasks / future APIs. The common pool is shared (parallel streams, some async defaults). Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q982 · Blocking in common pool?

> Can deadlock/starvation - ManagedBlocker or avoid. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q983 · CPU bound still need pools?

> Yes means size near cores; virtual threads don't create cores. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q984 · Math exact methods?

> addExact throws on overflow means safer math. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q985 · Object pooling modern view?

> Usually harmful with generational GC; exceptions: expensive resources (buffers, DB). Keep both the definition and a realistic failure mode in mind means that is what makes the concept usable in debugging and design reviews. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q986 · ThreadLocal as free pool?

> Common for SimpleDateFormat historically - remember remove. In thread pools the worker outlives your request - always `remove()` in a `finally`. Name the shared state and the happens-before edge that protects it. If you need a compound check-then-act, a single `volatile` is not enough.

### Q987 · jpackage?

> Native installers shipping your app+runtime. Framework magic is still JVM behavior underneath: proxies, classloaders, thread pools, and transactions. Pool sizing, connection leaks, and transaction boundaries cause more pain than SQL micro-syntax.

### Q988 · TLS JSSE?

> Java Secure Socket Extension - HTTPS backbone. Prefer battle-tested libraries and constant-time compares for secrets. Disabling verification 'just for now' in production is how outages become incidents. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q989 · KeyStore types?

> PKCS12 preferred over JKS modern. Prefer battle-tested libraries and constant-time compares for secrets. Disabling verification 'just for now' in production is how outages become incidents. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q990 · JWT pitfalls?

> Algorithm none, key confusion - libraries carefully. Prefer battle-tested libraries and constant-time compares for secrets. Disabling verification 'just for now' in production is how outages become incidents. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q991 · XML XXE?

> Disable external entities on parsers. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q992 · SQL injection PreparedStatement?

> Parameter binding - never string concat. Bind parameters; never concatenate untrusted input into SQL. Batching (`addBatch`/`executeBatch`) and statement caching in pools are the usual throughput levers once correctness is settled. Framework features still obey JVM rules: proxies, thread pools, and connection lifecycles. Boundary mistakes (proxy/`this`, pool leaks) dominate outages.

### Q993 · JDBC batching?

> addBatch/executeBatch - throughput. Framework magic is still JVM behavior underneath: proxies, classloaders, thread pools, and transactions. When advice 'does not fire', verify the call path hits the proxy and that the runtime classpath matches what you compiled against. Framework features still obey JVM rules: proxies, thread pools, and connection lifecycles. Boundary mistakes (proxy/`this`, pool leaks) dominate outages.

### Q994 · Connection pool essentials?

> Max size, validation, leak detection, timeouts. Size for DB capacity, not thread count fantasies. Set max lifetime, validation, leak detection, and connection timeouts. Framework features still obey JVM rules: proxies, thread pools, and connection lifecycles. Boundary mistakes (proxy/`this`, pool leaks) dominate outages.

### Q995 · Statement vs PreparedStatement caching?

> Pools often cache prepared - good. Bind parameters; never concatenate untrusted input into SQL. Batching (`addBatch`/`executeBatch`) and statement caching in pools are the usual throughput levers once correctness is settled. Framework features still obey JVM rules: proxies, thread pools, and connection lifecycles. Boundary mistakes (proxy/`this`, pool leaks) dominate outages.

### Q996 · Connection per request?

> Borrow from pool means never share across threads. Keep that distinction handy when reading logs or choosing APIs - it is usually the difference between a correct mental model and a misleading one.

### Q997 · Thread safety of Connection?

> Not thread-safe - one thread at a time. In concurrent code, state the invariant you need (mutual exclusion, visibility, or both) and pick the weakest tool that provides it. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

### Q998 · XA transactions?

> XA/two-phase commit coordinates a transaction across multiple resources (e.g., two databases). It is powerful but operationally expensive and fragile - prefer local transactions plus idempotent messaging patterns when you can.

### Q999 · Eventually consistent vs XA?

> Prefer local + idempotency when possible. Treat the definition as incomplete until you can name one failure mode it prevents or explains. That distinction shows up in real debugging sessions more often than the textbook definition alone suggests.

### Q1000 · Outbox pattern?

> Reliable messaging with DB txn. Modern Java features reduce boilerplate only when they clarify the domain model. Lean on the compiler (exhaustiveness, immutability) rather than reintroducing mutable bags of fields. Keep both the definition and a realistic failure mode in mind - that is what makes the concept usable in debugging and design reviews.

---

## Key Takeaways

- The JVM is a machine: **load → link → init → interpret/JIT → allocate → collect**.
- Master **identity vs equality**, **visibility vs atomicity**, and **proxy vs target**.
- JDK / subclass proxies explain most Spring “why didn’t my annotation fire?” moments.
- Generational GC + happens-before + classloader namespaces beat trivia syntax.
- When unsure, **measure**: JFR, heap dumps, thread dumps, `javap`, GC logs.

## Suggested revision plan

| Days | Slice | Outcome |
|---|---|---|
| 1–3 | Q1–Q179 | JVM + memory/GC vocabulary locked |
| 4–6 | Q180–Q469 | Objects, strings, generics, collections |
| 7–10 | Q470–Q645 | JMM + **proxies** (draw both) |
| 11–14 | Q646–Q760 | Ser, I/O, streams, bytecode/tools |
| 15–21 | Q761–Q1000 | Landmines + frameworks/JDBC/security |

---

Author notes: for proxy deep-dives, pair **Q606–Q645** with a tiny Spring `@Transactional` self-invocation experiment. For JMM, write two-thread visibility demos until the race disappears only when you add the correct synchronization.
