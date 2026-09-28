# Spring Boot & Apache Maven: Master Class Deep-Dive Reference Notes

This document provides a comprehensive, production-grade reference based on the *Concept && Coding (by Shrayansh)* Spring Boot series. It includes deep technical explanations, code implementations, internal execution flows, and architectural diagrams.

---

## Table of Contents
1. [Module 1: Spring Boot Project Setup & Layered Architecture](#module-1-spring-boot-project-setup--layered-architecture)
2. [Module 2: Apache Maven & Build Lifecycle Mechanics](#module-2-apache-maven--build-lifecycle-mechanics)
3. [Module 3: Spring Boot Controller Layer Annotations (Deep Dive)](#module-3-spring-boot-controller-layer-annotations-deep-dive)
4. [Module 4: Spring Beans, IoC Container & Bean Lifecycle Mechanics](#module-4-spring-beans-ioc-container--bean-lifecycle-mechanics)
5. [Module 5: Dependency Injection Mechanics](#module-5-dependency-injection-mechanics)
6. [Module 6: Bean Scopes & Scoped Proxies](#module-6-bean-scopes--scoped-proxies)
7. [Module 7: Profiles, Environment & Externalized Configuration](#module-7-profiles-environment--externalized-configuration)
8. [Module 8: Spring AOP — Proxies, Pointcuts & Advice](#module-8-spring-aop--proxies-pointcuts--advice)
9. [Module 9: Transaction Management](#module-9-transaction-management)
10. [Module 10: Asynchronous Execution](#module-10-asynchronous-execution)
11. [Module 11: Validation & Centralized Exception Handling](#module-11-validation--centralized-exception-handling)
12. [Module 12: Spring Data JPA, Entity Lifecycle & Relational Mapping](#module-12-spring-data-jpa-entity-lifecycle--relational-mapping)
13. [Module 13: Scheduling, DevTools & Actuator](#module-13-scheduling-devtools--actuator)

---

## Module 1: Spring Boot Project Setup & Layered Architecture

### 1.1 Spring Boot Core Concept & Setup
Spring Boot simplifies the creation of stand-alone, production-grade Spring-based applications by eliminating complex XML configurations, offering opinionated auto-configuration defaults, providing starter dependencies, and embedding Servlet containers directly.

#### Spring Initializr (`start.spring.io`) Deep-Dive:
When bootstrapping an application via [Spring Initializr](https://start.spring.io), each selected parameter configures fundamental project properties:

*   **Project Type:**
    *   `Maven Project`: Uses `pom.xml` for declarative XML dependency and plugin lifecycle management.
    *   `Gradle Project`: Uses `build.gradle` (Groovy or Kotlin DSL) for domain-specific programmatic build scripting.
*   **Language:** `Java` (or Kotlin/Groovy).
*   **Spring Boot Versioning Strategy:**
    *   `SNAPSHOT`: Unstable, under active development (e.g., `3.3.0-SNAPSHOT`). Never use in production.
    *   `M1, M2... (Milestone)`: Feature-complete previews for testing before general release.
    *   `GA / RELEASE` (e.g., `3.2.4`): General Availability / Stable. Production-ready releases without suffix labels.
*   **Project Metadata:**
    *   `Group`: Uniquely identifies your project across all projects in reverse domain format (e.g., `com.conceptandcoding`).
    *   `Artifact`: Name of the jar/war archive file without version info (e.g., `account-service`).
    *   `Packaging`:
        *   `Jar` (Default): Packages application as a self-contained executable archive containing all dependencies and an embedded servlet container (Tomcat, Jetty, or Undertow).
        *   `War`: Packages application as a Web Application Archive to be deployed onto external servlet application servers (e.g., standalone WildFly, Apache Tomcat).
    *   `Java Version`: Select an LTS (Long Term Support) JDK release (Java 17 or Java 21).

#### Essential Initial Dependencies:
1.  **`spring-boot-starter-web`**:
    *   Includes `spring-web`, `spring-webmvc`, `jackson-databind` (for JSON serialization/deserialization), `hibernate-validator`, and `tomcat-embed-core`.
2.  **`Lombok`**:
    *   Compile-only annotation library that generates getters, setters, constructors, builders, and loggers during compilation, reducing Java boilerplate.

---

### 1.2 Layered Architecture Pattern (3-Tier Architecture)

Spring Boot applications follow a **3-Tier / Layered Architecture** based on the **Separation of Concerns (SoC)** principle. Each layer has specific responsibilities and communicates only with adjacent layers.

```
+-----------------------------------------------------------------------+
|                             CLIENT LAYER                              |
|             (Postman / Web Browser / Mobile App / SPA)               |
+-----------------------------------------------------------------------+
                                   |  HTTP Request (JSON / Params / Path)
                                   v
+-----------------------------------------------------------------------+
|                           CONTROLLER LAYER                            |
|             Annotated with: @RestController / @Controller              |
|  - Maps endpoints and HTTP methods                                    |
|  - Validates incoming request payloads                                |
|  - Extracts headers, path parameters, and query params                |
|  - Converts incoming DTOs to internal business objects                |
|  - Returns ResponseEntity<T> with explicit HTTP status codes          |
+-----------------------------------------------------------------------+
                                   |  Domain Objects / DTOs
                                   v
+-----------------------------------------------------------------------+
|                            SERVICE LAYER                              |
|                  Annotated with: @Service                             |
|  - Encapsulates core business logic and algorithms                     |
|  - Manages transactional boundaries via @Transactional                |
|  - Coordinates calls between multiple repositories or external APIs   |
|  - Transforms Entity models into DTOs                                  |
+-----------------------------------------------------------------------+
                                   |  Entity Models / Domain Models
                                   v
+-----------------------------------------------------------------------+
|                          REPOSITORY LAYER                             |
|                 Annotated with: @Repository                           |
|  - Direct interface to the Database (MySQL, PostgreSQL, MongoDB)      |
|  - Uses Spring Data JPA / Hibernate / JDBC Template                   |
|  - Translates persistence exceptions into Spring DataAccessException   |
+-----------------------------------------------------------------------+
                                   |  SQL / Database Queries
                                   v
+-----------------------------------------------------------------------+
|                            DATABASE LAYER                             |
+-----------------------------------------------------------------------+
```

#### Layer Responsibilities & Best Practices:

1.  **Controller Layer (`@RestController`):**
    *   *Rule:* No core business algorithms or SQL/persistence calls should exist here.
    *   Handles HTTP mapping (`@GetMapping`, `@PostMapping`), request body validation (`@Valid`), and serializing responses.
2.  **Service Layer (`@Service`):**
    *   *Rule:* Should be designed using interfaces (`UserService`) and implementations (`UserServiceImpl`) to enable loose coupling, modularity, and mockability during unit testing.
    *   Manages transaction boundaries using Spring's `@Transactional`.
3.  **Repository Layer (`@Repository`):**
    *   Extends interfaces like `JpaRepository<Entity, ID>` or `CrudRepository<Entity, ID>`.
    *   Automatically provides CRUD methods, custom query derivation (`findByEmail(String email)`), and pagination.
4.  **DTO (Data Transfer Object) vs Entity:**
    *   *Why separation is critical:* Direct exposure of database Entities via controllers creates security vulnerabilities (e.g., mass assignment attacks), exposes raw database schemas, and leads to infinite recursion errors during JSON serialization in bidirectional relationships (`@OneToMany`).
    *   *Flow:* Request JSON $\rightarrow$ DTO $\rightarrow$ Controller $\rightarrow$ Service $\rightarrow$ Entity $\rightarrow$ Repository $\rightarrow$ DB.

---

### 1.3 Spring Boot vs Classic Spring MVC

Classic Spring MVC is the web framework. Spring Boot is the opinionated runtime that assembles that framework (and the rest of the stack) without hand-written XML or a manually deployed servlet container.

```
+-------------------------------+          +----------------------------------+
|        Classic Spring MVC     |          |           Spring Boot            |
+-------------------------------+          +----------------------------------+
| web.xml / WebApplicationInit  |          | @SpringBootApplication main()    |
| DispatcherServlet registered  |          | Servlet auto-registered          |
|   by the developer            |          |   by auto-configuration          |
| Beans declared in XML or      |          | Beans discovered by component    |
|   @Configuration by hand      |          |   scan + auto-configuration      |
| Versions chosen dependency    |          | Versions locked by the parent    |
|   by dependency               |          |   POM / BOM                      |
| WAR dropped on external       |          | Executable JAR with embedded     |
|   Tomcat / WildFly            |          |   Tomcat (default), Jetty,       |
|                               |          |   or Undertow                    |
+-------------------------------+          +----------------------------------+
```

*   **Spring Framework** supplies IoC, MVC, transactions, and AOP.
*   **Spring MVC** supplies `DispatcherServlet`, handler mappings, and view resolution.
*   **Spring Boot** supplies starters, auto-configuration, the embedded server, Actuator hooks, and production defaults (`spring.jpa.open-in-view`, error pages, logging, banner).

Boot does not replace MVC. A `@RestController` is still a Spring MVC handler. Boot only decides *how that machinery is created*.

---

### 1.4 Anatomy of `@SpringBootApplication`

The class that contains `main` is the composition root. The annotation is a stereotype made of three annotations:

| Composed Annotation | What It Activates |
| :--- | :--- |
| `@SpringBootConfiguration` | Specialization of `@Configuration`. Marks the class as a source of bean definitions. |
| `@EnableAutoConfiguration` | Imports `AutoConfigurationImportSelector`, which loads `AutoConfiguration.imports` (Boot 2.7+ / 3.x; previously `spring.factories`) and conditionally registers beans. |
| `@ComponentScan` | Scans the package of the main class and every sub-package for `@Component`, `@Service`, `@Repository`, `@Controller`, `@RestController`, and `@Configuration`. |

```java
@SpringBootApplication // scan root = package of this class
public class OrderServiceApplication {

    public static void main(String[] args) {
        // Creates AnnotationConfigServletWebServerApplicationContext,
        // refreshes it, starts the embedded server, then blocks.
        SpringApplication.run(OrderServiceApplication.class, args);
    }
}
```

#### `SpringApplication.run` Execution Outline:

$$\text{prepare Environment} \rightarrow \text{print banner} \rightarrow \text{create and refresh context} \rightarrow \text{call runners} \rightarrow \text{ready event}$$

1.  **Deduce application type** while constructing `SpringApplication`: Servlet (web starter present), Reactive (WebFlux only), or None (no web stack).
2.  **Load `Environment`:** `application.properties` / `application.yml`, profile documents, OS environment variables, and command-line arguments.
3.  **Print the banner**, then create the context: `AnnotationConfigServletWebServerApplicationContext` for a servlet app.
4.  **Refresh:** component scan, auto-configuration, bean instantiation, singleton eager init.
5.  **Start the embedded server** as part of refresh (`ServletWebServerApplicationContext`).
6.  **Invoke `ApplicationRunner` and `CommandLineRunner` beans**, sorted together by `@Order` / `Ordered`.
7.  **Publish** `ApplicationReadyEvent`. Failures during refresh abort startup (fail-fast).

*   *Rule:* Keep the main class in a root package such as `com.conceptandcoding.orderservice`. A main class sitting in `com.conceptandcoding.orderservice.web` will not scan `..service` or `..repository`, because those packages are not children of `web`.

---

### 1.5 Canonical Project Layout

```
order-service/
├── pom.xml
├── mvnw / mvnw.cmd
├── .mvn/wrapper/maven-wrapper.properties
└── src/
    ├── main/
    │   ├── java/com/conceptandcoding/orderservice/
    │   │   ├── OrderServiceApplication.java      # composition root
    │   │   ├── controller/                       # HTTP adapters
    │   │   ├── service/                          # business interfaces + impls
    │   │   ├── repository/                       # Spring Data interfaces
    │   │   ├── entity/                           # JPA entities (persistence model)
    │   │   ├── dto/                              # request / response contracts
    │   │   ├── config/                           # @Configuration classes
    │   │   └── exception/                        # domain + API error types
    │   └── resources/
    │       ├── application.properties            # default config
    │       ├── application-dev.properties        # profile overlay
    │       ├── application-prod.properties
    │       ├── db/migration/                     # Flyway / Liquibase (when used)
    │       └── static/ , templates/              # served only if MVC views exist
    └── test/
        └── java/...                              # mirrors main packages
```

| Directory | Classpath Role | Typical Contents |
| :--- | :--- | :--- |
| `src/main/java` | Compile scope. Packaged into the JAR. | Production code. |
| `src/main/resources` | Copied to `target/classes`. Packaged. | Properties, YAML, banners, DB migrations. |
| `src/test/java` | Test compile only. | JUnit 5, `@SpringBootTest`, slices. |
| `src/test/resources` | Test classpath only. Overrides main resources of the same name during tests. | `application.properties` for tests, SQL fixtures. |

---

### 1.6 `application.properties` vs `application.yml`

Both formats bind to the same `Environment`. YAML is a tree; properties are flat keys. Boot loads `application.properties` and `application.yml` from `src/main/resources` and from `./config/` outside the JAR.

```properties
# application.properties
server.port=8081
spring.application.name=order-service
spring.datasource.url=jdbc:postgresql://localhost:5432/orders
spring.datasource.username=orders
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.open-in-view=false
```

```yaml
# application.yml — equivalent tree
server:
  port: 8081
spring:
  application:
    name: order-service
  datasource:
    url: jdbc:postgresql://localhost:5432/orders
    username: orders
  jpa:
    hibernate:
      ddl-auto: validate
    open-in-view: false
```

*   **Relaxed binding:** `server.port`, `SERVER_PORT`, and `server_port` all bind to `server.port`. Environment variables conventionally use `SCREAMING_SNAKE` (`SPRING_DATASOURCE_URL`).
*   **Profile documents in one YAML file** use `spring.config.activate.on-profile`. Separate `application-{profile}.properties` files are easier to diff in review.
*   **`ddl-auto`:** `validate` in production (schema owned by migrations). `update` mutates schema on boot and is unsafe for production. `create-drop` destroys data on shutdown.
*   **`open-in-view=false`:** disables the request-scoped Hibernate session that would otherwise stay open for the whole HTTP request. Lazy loads then fail outside a transaction, which forces fetching to happen in the service layer.

---

### 1.7 Embedded Server & Executable JAR

`spring-boot-starter-web` pulls `spring-boot-starter-tomcat`. The server is a bean (`TomcatServletWebServerFactory`), not an external process.

| Starter Swap | Embedded Server | When To Use |
| :--- | :--- | :--- |
| `spring-boot-starter-tomcat` (default, transitive) | Apache Tomcat | Default servlet stack. |
| Exclude Tomcat, add `spring-boot-starter-jetty` | Eclipse Jetty | Smaller footprint, different connector model. |
| Exclude Tomcat, add `spring-boot-starter-undertow` | Undertow | Non-blocking I/O, XNIO worker model. |
| `spring-boot-starter-webflux` without the servlet starter | Netty | Reactive stack. No `DispatcherServlet`. |

#### Fat JAR Layout Produced by `spring-boot-maven-plugin`:

```
order-service-1.0.0-SNAPSHOT.jar
├── META-INF/MANIFEST.MF
│     Main-Class: org.springframework.boot.loader.launch.JarLauncher
│     Start-Class: com.conceptandcoding.orderservice.OrderServiceApplication
├── BOOT-INF/classes/                 # your compiled code + resources
├── BOOT-INF/lib/                     # dependency JARs
└── org/springframework/boot/loader/  # Boot's nested JAR classloader
```

$$\text{java -jar app.jar} \rightarrow \text{JarLauncher} \rightarrow \text{LaunchedClassLoader} \rightarrow \text{Start-Class.main}$$

A normal `java -jar` cannot see classes inside nested JARs. `JarLauncher` builds a custom classloader over `BOOT-INF/classes` and `BOOT-INF/lib/*.jar`, then calls the `Start-Class`.

*   **Dev run:** `./mvnw spring-boot:run` (plugin forks a JVM, picks up resource changes when DevTools is present).
*   **Prod run:** `java -jar target/order-service-1.0.0-SNAPSHOT.jar --spring.profiles.active=prod`.
*   **WAR mode:** set `<packaging>war</packaging>`, extend `SpringBootServletInitializer`, and mark the embedded server as `provided` so the external container supplies it.

---

## Module 2: Apache Maven & Build Lifecycle Mechanics

### 2.1 What is Apache Maven?
Apache Maven is a project management and build automation tool built around the **Project Object Model (POM)**. It standardizes project structures, manages third-party software dependencies, compiles source code, runs automated tests, and packages applications into deployable artifacts.

---

### 2.2 Anatomical Structure of `pom.xml`

The `pom.xml` file contains all project configurations, dependencies, build steps, and plugin declarations.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 
                             https://maven.apache.org/xsd/maven-4.0.0.xsd">
    
    <modelVersion>4.0.0</modelVersion>

    <!-- 1. Parent POM Definition -->
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.4</version>
        <relativePath/> <!-- Lookup parent from repository -->
    </parent>

    <!-- 2. Project Identification (GAV Coordinates) -->
    <groupId>com.conceptandcoding</groupId>
    <artifactId>order-service</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <name>order-service</name>
    <description>Order Processing Service for E-Commerce Platform</description>

    <!-- 3. Global Properties -->
    <properties>
        <java.version>17</java.version>
        <org.mapstruct.version>1.5.5.Final</org.mapstruct.version>
    </properties>

    <!-- 4. Dependencies -->
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
            <!-- Version omitted: Managed automatically by spring-boot-starter-parent -->
        </dependency>

        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
            <scope>provided</scope>
        </dependency>

        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <!-- 5. Build Plugins -->
    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <configuration>
                    <excludes>
                        <exclude>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok</artifactId>
                        </exclude>
                    </excludes>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
```

#### Key `pom.xml` Components Explained:
*   **GAV Coordinates (`groupId`, `artifactId`, `version`):** The three coordinates that uniquely identify any Maven artifact in local or remote repositories.
*   **`<parent>` Tag:** References `spring-boot-starter-parent`. Provides central dependency management (locks down compatible version numbers), default plugin configurations, resource filtering, and Java compiler configuration.
*   **`<dependencyManagement>` vs `<dependencies>`:**
    *   `<dependencyManagement>`: Declares dependency versions without implicitly inheriting them. Sub-modules or projects can include the dependency without specifying a version number.
    *   `<dependencies>`: Direct dependencies inherited and included in the current build classpath.

#### Dependency Scopes in Detail:

| Scope | Description | Included in Final Package? | Example Use Case |
| :--- | :--- | :--- | :--- |
| `compile` | Default scope. Required to build, test, and run the project. Transitive. | **Yes** | `spring-boot-starter-web` |
| `provided` | Needed for compilation and testing, but supplied by the JDK or Servlet container at runtime. | **No** | `lombok`, `servlet-api` |
| `runtime` | Not required for compilation, but needed during execution. | **Yes** | Database JDBC drivers (e.g., `mysql-connector-j`) |
| `test` | Only required for compiling and running test source code (`src/test/java`). | **No** | `junit-jupiter`, `mockito-core` |
| `system` | Explicitly points to a local JAR on the system file path. | **No** | Proprietary legacy non-maven JARs |
| `import` | Used inside `<dependencyManagement>` tags to import BOM (Bill of Materials) files. | **No** | `spring-cloud-dependencies` BOM |

---

### 2.3 Maven Repository Resolution Flow
When Maven compiles or builds a project, it resolves declared dependencies across three repository tiers:

```
                  +-----------------------------------+
                  |  Dependency Resolution Initiated  |
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |      Local Repository Check       |
                  |     (~/.m2/repository/...)        |
                  +-----------------------------------+
                                 /     \
                       FOUND    /       \ NOT FOUND
                               /         \
                              v           v
                    +------------+     +-----------------------------------+
                    | Use Local  |     |     Remote / Corporate Repository  |
                    | Cache JAR  |     |     (Artifactory / Nexus Repo)    |
                    +------------+     +-----------------------------------+
                                                     /     \
                                           FOUND    /       \ NOT FOUND
                                                   /         \
                                                  v           v
                                        +------------+     +-----------------------------------+
                                        | Download   |     |    Maven Central Repository       |
                                        | & Cache    |     | (repo.maven.apache.org/maven2)    |
                                        +------------+     +-----------------------------------+
                                                                         /     \
                                                               FOUND    /       \ NOT FOUND
                                                                       /         \
                                                                      v           v
                                                            +------------+     +-------------------+
                                                            | Download   |     | BUILD FAILURE     |
                                                            | & Cache    |     | Could not resolve |
                                                            +------------+     +-------------------+
```

---

### 2.4 Complete Maven Build Lifecycles & Phases

Maven features three independent built-in lifecycles: **`clean`**, **`default` (build)**, and **`site`**. A lifecycle consists of ordered **phases**. Executing a target phase automatically runs all preceding phases in sequence.

#### 1. The `clean` Lifecycle
Handles cleaning up prior build artifacts:
1.  `pre-clean`: Executes tasks required prior to actual project cleaning.
2.  `clean`: Removes all files generated by previous builds by deleting the `target/` directory.
3.  `post-clean`: Executes tasks required to finalize project cleaning.

#### 2. The `default` (Build & Package) Lifecycle
Handles actual compilation, testing, packaging, and deployment:

$$\text{validate} \rightarrow \text{compile} \rightarrow \text{test-compile} \rightarrow \text{test} \rightarrow \text{package} \rightarrow \text{verify} \rightarrow \text{install} \rightarrow \text{deploy}$$

*   **`validate`:** Verifies project structure and checks if all necessary POM information is available.
*   **`compile`:** Compiles main Java source code (`src/main/java`) into bytecode (`.class`) files placed in `target/classes`.
*   **`test-compile`:** Compiles test source code (`src/test/java`) into `target/test-classes`.
*   **`test`:** Runs compiled unit tests (JUnit / TestNG) using the Maven Surefire Plugin.
*   **`package`:** Takes compiled code and packages it into its target distribution format (`.jar` or `.war`) inside `target/`.
*   **`verify`:** Runs integration test checks against the packaged artifact to verify quality requirements.
*   **`install`:** Installs the packaged `.jar`/`.war` into the **Local Repository** (`~/.m2/repository`). This allows other local applications to use it as a dependency.
*   **`deploy`:** Copies the final package to a **Remote Repository** (Nexus/JFrog) for enterprise sharing and deployment pipelines.

#### 3. The `site` Lifecycle
Generates project documentation: `site` $\rightarrow$ `site-deploy`.

#### Essential Maven Commands Cheat Sheet:
*   `mvn clean`: Deletes the `target/` directory.
*   `mvn compile`: Compiles `src/main/java`.
*   `mvn test`: Runs unit tests.
*   `mvn package`: Compiles, tests, and creates the JAR/WAR file in `target/`.
*   `mvn clean package -DskipTests`: Cleans previous builds, skips test execution, and generates a fresh JAR.
*   `mvn install`: Installs the build output to `~/.m2/repository`.

---

### 2.5 Maven Wrapper (`mvnw` / `mvnw.cmd`)
The Maven Wrapper allows executing Maven builds without installing Maven locally on the operating system.

#### Wrapper File Structure:
*   `mvnw`: POSIX shell script for Linux/macOS.
*   `mvnw.cmd`: Batch script for Windows.
*   `.mvn/wrapper/maven-wrapper.properties`: Specifies the exact Maven version URL downloaded automatically upon execution.

---

### 2.6 Dependency Mediation, Exclusions & Optional Flags

Maven builds a tree, not a flat list. Every direct dependency drags in transitive dependencies. When two paths request different versions of the same GAV, Maven **mediates**.

#### Mediation Rule (Nearest-Wins):

```
                 order-service
                 /           \
                /             \
     spring-boot-starter-web   some-old-lib
              |                      |
         jackson-databind:2.17   jackson-databind:2.12
              \                      /
               \                    /
        Nearest depth wins (both depth 2 → first declaration wins)
```

*   **Nearest definition wins.** A version declared at depth 1 beats a version at depth 2.
*   **At equal depth, the first declaration in the POM (dependency order) wins.**
*   **`<dependencyManagement>` pins a version** without adding the JAR. It overrides mediation for that artifact. `spring-boot-starter-parent` imports `spring-boot-dependencies`, which is why starter versions can be omitted.

#### Inspect and Force a Version:

```bash
./mvnw dependency:tree
./mvnw dependency:tree -Dincludes=com.fasterxml.jackson.core
./mvnw dependency:tree -Dverbose          # shows omitted-for-conflict nodes
```

```xml
<dependency>
    <groupId>com.example</groupId>
    <artifactId>some-old-lib</artifactId>
    <version>1.4.0</version>
    <exclusions>
        <exclusion>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-databind</artifactId>
        </exclusion>
    </exclusions>
</dependency>
```

| Mechanism | Effect on Classpath | Effect on Dependents of *this* artifact |
| :--- | :--- | :--- |
| `<exclusion>` | Drops a transitive JAR from this build. | Does not change the excluded artifact's own POM. |
| `<optional>true</optional>` | Artifact is on this project's classpath. | Not pulled transitively by projects that depend on you. |
| `<dependencyManagement>` | No JAR added by itself. | Version is enforced when a child or the same POM declares the dependency. |
| BOM import (`scope=import`, `type=pom`) | No JAR. Imports that POM's managed versions. | Used inside `<dependencyManagement>` only. |

*   *Rule:* Do not randomly upgrade a single Jackson or Tomcat artifact. Let the Boot BOM own those versions. Override only through a property the parent already exposes (`<jackson-bom.version>`, `<tomcat.version>`) when a CVE forces it.

---

### 2.7 Bill of Materials and the Parent POM Chain

```
your pom.xml
    <parent> spring-boot-starter-parent
        <parent> spring-boot-dependencies   (the actual BOM: dependencyManagement only)
            imports third-party BOMs (jackson, netty, reactor, ...)
```

| File | Contains Build Plugins? | Contains `<dependencyManagement>`? | Intended Use |
| :--- | :--- | :--- | :--- |
| `spring-boot-starter-parent` | Yes. Compiler release, resource filtering, Surefire, repackage plugin defaults. | Inherits them from the BOM. | Parent of application POMs. |
| `spring-boot-dependencies` | No. It is a BOM, packaging `pom`. | Yes. Every managed version. | Import when you already have a company parent POM and cannot use `starter-parent`. |

#### Company Parent Already Exists — Import the BOM:

```xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-dependencies</artifactId>
            <version>3.2.4</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>
```

When the parent is not `spring-boot-starter-parent`, you must declare `spring-boot-maven-plugin` yourself (version included) or the JAR will not be repackaged into an executable archive.

---

### 2.8 Plugins, Goals, and Phase Binding

A **plugin** is a JAR of build logic. A **goal** is one task inside it (`spring-boot:repackage`, `compiler:compile`, `surefire:test`). A **phase** is a slot in the lifecycle. Binding a goal to a phase makes that goal run when the phase runs.

| Phase | Plugin Goal Bound by Default (JAR packaging) | Output |
| :--- | :--- | :--- |
| `process-resources` | `resources:resources` | Copies `src/main/resources` → `target/classes`, filtering `${...}` when enabled. |
| `compile` | `compiler:compile` | `.java` → `target/classes/**/*.class`. Release level comes from `java.version`. |
| `test` | `surefire:test` | Runs `*Test.java`. Failures fail the build. |
| `package` | `jar:jar`, then `spring-boot:repackage` | Plain JAR, then rewritten as the Boot loader layout. |
| `install` | `install:install` | Copies the artifact into `~/.m2/repository/{groupPath}/{artifact}/{version}/`. |

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-compiler-plugin</artifactId>
    <configuration>
        <parameters>true</parameters> <!-- keeps -parameters so @PathVariable names bind -->
    </configuration>
</plugin>
```

*   **`-DskipTests`:** skips *running* tests. Test sources are still compiled.
*   **`-Dmaven.test.skip=true`:** skips compiling and running tests.
*   **`-Pprod`:** activates a `<profile>` whose `id` is `prod` (dependencies, plugins, or properties that exist only for that profile).
*   **`mvn -q -DskipTests clean package`:** quiet CI package. The repackaged JAR in `target/` is the artifact you copy to the server.

#### Effective POM:

`./mvnw help:effective-pom` prints the POM after parent inheritance, profiles, and property interpolation. Use it when a plugin "is not configured" but the parent already configured it.

---

### 2.9 Multi-Module Reactor

A reactor is one parent POM with `<modules>` and children that produce their own artifacts. The parent is usually `packaging` = `pom` and is not a runnable JAR.

```
platform/                         # packaging pom, <modules>
├── pom.xml
├── platform-bom/                 # dependencyManagement only
├── order-api/                    # shared DTOs, no Spring web
└── order-service/                # boot app, depends on order-api
```

```xml
<modules>
    <module>platform-bom</module>
    <module>order-api</module>
    <module>order-service</module>
</modules>
```

$$\text{./mvnw -pl order-service -am package} \rightarrow \text{build order-service and every module it depends on}$$

| Flag | Meaning |
| :--- | :--- |
| `-pl order-service` | Project list. Build only this module. |
| `-am` | Also make dependencies of `-pl` that live in the reactor. |
| `-amd` | Also make dependents (modules that depend on the ones you changed). |
| `-T 1C` | Parallel build, one thread per CPU core. Module graph must be free of cycles. |

*   *Rule:* Do not make the Boot application module the parent of libraries. Libraries must build without `spring-boot-maven-plugin` repackaging them, or downstream services cannot use them as normal dependencies.

---

## Module 3: Spring Boot Controller Layer Annotations (Deep Dive)

### 3.1 `@Controller` vs `@RestController` Architecture

```
                       +-------------------------------+
                       |          @Controller          |
                       +-------------------------------+
                                       |
                   Is meta-annotated with @ResponseBody?
                                 /           \
                           NO   /             \   YES
                               /               \
                              v                 v
            +--------------------+   +----------------------------+
            |  Returns View Name |   | Returns Raw Data / Objects |
            |  (String = "home") |   | (User object, List, DTO)   |
            +--------------------+   +----------------------------+
                      |                            |
                      v                            v
            +--------------------+   +----------------------------+
            |    ViewResolver    |   | HttpMessageConverter       |
            | (Thymeleaf / JSP)  |   | (Jackson JSON Serializer)  |
            +--------------------+   +----------------------------+
                      |                            |
                      v                            v
            +--------------------+   +----------------------------+
            | Renders HTML Page  |   | Writes JSON directly into  |
            |   to Browser       |   | HTTP Response Body         |
            +--------------------+   +----------------------------+
```

```java
// Standard Spring MVC Controller
@Controller
public class MVCViewController {
    
    @GetMapping("/welcome")
    public String renderWelcomePage(Model model) {
        model.addAttribute("message", "Hello World");
        return "welcome"; // ViewResolver resolves this to /templates/welcome.html
    }

    @GetMapping("/api/data")
    @ResponseBody // Explicitly needed to bypass ViewResolver and return JSON directly
    public User getRawData() {
        return new User("John", "Doe");
    }
}

// RESTful API Controller
@RestController // Equivalent to @Controller + @ResponseBody on every method
@RequestMapping("/api/v1/users")
public class UserRestController {

    @GetMapping
    public List<User> getAllUsers() {
        return List.of(new User("Jane", "Doe")); // Directly serialized to JSON Array
    }
}
```

---

### 3.2 Request Mapping Annotations & Path Specification

`@RequestMapping` routes incoming client HTTP requests to appropriate Java classes or handler methods.

#### Primary Request Mapping Annotations:

| Annotation | Equivalent `@RequestMapping` Syntax | Recommended HTTP Operation Use Case |
| :--- | :--- | :--- |
| `@GetMapping` | `@RequestMapping(method = RequestMethod.GET)` | Reading/fetching existing resources (Idempotent). |
| `@PostMapping` | `@RequestMapping(method = RequestMethod.POST)` | Creating new resources. |
| `@PutMapping` | `@RequestMapping(method = RequestMethod.PUT)` | Completely replacing existing resources (Idempotent). |
| `@DeleteMapping` | `@RequestMapping(method = RequestMethod.DELETE)` | Deleting existing resources (Idempotent). |
| `@PatchMapping` | `@RequestMapping(method = RequestMethod.PATCH)` | Partially updating fields on an existing resource. |

---

### 3.3 Data Extraction Annotations in Spring MVC

#### 1. `@RequestParam`
Extracts query parameters from the HTTP URL query string (e.g., `/api/products?category=electronics&page=1`) or standard HTML form-encoded parameters.

```java
@GetMapping("/products")
public ResponseEntity<List<Product>> getProducts(
        @RequestParam(name = "category") String category,
        @RequestParam(name = "page", required = false, defaultValue = "0") int page,
        @RequestParam(name = "pageSize", required = false, defaultValue = "20") int pageSize
) {
    return ResponseEntity.ok(productService.findProducts(category, page, pageSize));
}
```

#### 2. `@PathVariable`
Extracts dynamic template variables embedded directly inside the URI path segment (e.g., `/api/users/105/orders/992`).

```java
@GetMapping("/users/{userId}/orders/{orderId}")
public ResponseEntity<Order> getUserOrder(
        @PathVariable(name = "userId") Long userId,
        @PathVariable(name = "orderId") Long orderId
) {
    return ResponseEntity.ok(orderService.findOrder(userId, orderId));
}
```

#### Key Differences: `@RequestParam` vs `@PathVariable`

| Metric | `@PathVariable` | `@RequestParam` |
| :--- | :--- | :--- |
| **URL Pattern** | `/users/101` | `/users?id=101` |
| **Primary Use** | Identifying specific RESTful resources. | Filtering, sorting, searching, or paginating datasets. |
| **Nullability** | Required by default (part of path structure). | Can easily be marked optional (`required = false`). |

#### 3. `@RequestBody`
Deserializes the incoming HTTP Request Payload (JSON or XML) into a Java Object using `HttpMessageConverter` (Jackson).

```java
@PostMapping("/users")
public ResponseEntity<UserDTO> createUser(@Valid @RequestBody UserDTO userDto) {
    UserDTO savedUser = userService.createUser(userDto);
    return ResponseEntity.status(HttpStatus.CREATED).body(savedUser);
}
```

#### 4. `@InitBinder`
Customizes data binding rules before the request data is bound to Java models or DTO objects. It converts raw String input parameters into custom types or formats, trims whitespaces, or sanitizes inputs.

```java
@RestController
@RequestMapping("/api/account")
public class AccountController {

    @InitBinder
    public void customizeBinding(WebDataBinder binder) {
        // Automatically trim whitespace from all String parameters/fields
        StringTrimmerEditor stringTrimmer = new StringTrimmerEditor(true);
        binder.registerCustomEditor(String.class, stringTrimmer);

        // Disallow binding to internal sensitive fields to prevent mass assignment
        binder.setDisallowedFields("isAdmin", "accountBalance");
    }

    @PostMapping("/register")
    public ResponseEntity<String> registerAccount(@ModelAttribute UserRegistrationForm form) {
        // Disallowed fields won't be bound even if supplied in the incoming request
        return ResponseEntity.ok("Registration processed successfully");
    }
}
```

---

### 3.4 Response Customization with `ResponseEntity<T>`
`ResponseEntity<T>` allows full customization of the HTTP Response, including HTTP Status Codes, HTTP Headers, and the Response Body payload.

```java
@RestController
@RequestMapping("/api/v1/documents")
public class DocumentController {

    @GetMapping("/{id}")
    public ResponseEntity<byte[]> getDocument(@PathVariable String id) {
        byte[] documentBytes = documentService.downloadDocument(id);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("attachment", "document_" + id + ".pdf");
        headers.add("X-Download-Source", "Spring-Boot-API");

        return new ResponseEntity<>(documentBytes, headers, HttpStatus.OK);
    }

    // Modern Fluent API Builder Pattern (Preferred)
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDocument(@PathVariable String id) {
        documentService.deleteDocument(id);
        return ResponseEntity.noContent().build(); // HTTP Status 204 No Content
    }
}
```

---

### 3.5 Remaining Handler Argument Annotations

`DispatcherServlet` does not call the controller method directly. `RequestMappingHandlerAdapter` asks each `HandlerMethodArgumentResolver` whether it supports a parameter. The first matching resolver reads the HTTP request and produces the Java argument.

| Annotation | Source | Required by Default | Typical Use |
| :--- | :--- | :--- | :--- |
| `@RequestHeader` | A single HTTP header, or `HttpHeaders` / `Map` for all of them. | Yes | `Authorization`, `X-Correlation-Id`, `Accept-Language`. |
| `@CookieValue` | One cookie. | Yes | Session id when you are not using Spring Session. |
| `@RequestPart` | One part of `multipart/form-data`. | Yes | File plus a JSON metadata part in the same request. |
| `@ModelAttribute` | Query, form fields, or multipart fields bound onto a bean. | Binds what is present. | HTML forms. Not raw JSON. |
| `@MatrixVariable` | `path;key=value` segments. Off unless `UrlPathHelper` matrix variables are enabled. | No | Rare. Prefer query params. |
| `HttpServletRequest` / `HttpServletResponse` | The raw servlet types. No annotation. | — | Escape hatch. Avoid leaking them into services. |

```java
@PostMapping(path = "/invoices", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
public ResponseEntity<InvoiceDTO> upload(
        @RequestHeader("X-Tenant-Id") String tenantId,
        @RequestPart("meta") @Valid InvoiceMetaDTO meta,
        @RequestPart("file") MultipartFile file
) {
    return ResponseEntity.status(HttpStatus.CREATED)
            .body(invoiceService.store(tenantId, meta, file));
}
```

#### `@ModelAttribute` vs `@RequestBody`:

| Metric | `@RequestBody` | `@ModelAttribute` |
| :--- | :--- | :--- |
| **Content type** | `application/json`, `application/xml`. | `application/x-www-form-urlencoded`, multipart, query string. |
| **Converter** | `HttpMessageConverter` (Jackson). | `WebDataBinder` / `ServletRequestDataBinder`. |
| **Nested objects** | Full JSON tree. | Dot or bracket field names (`address.city`). |
| **Validation trigger** | `@Valid` or `@Validated` on the argument. | Same annotations, but binding errors arrive as `BindingResult` if that argument is declared next. |

If `BindingResult` is omitted and binding fails, Boot raises `MethodArgumentNotValidException` (`@RequestBody`) or `BindException` (`@ModelAttribute`). Both are handled in Module 11.

---

### 3.6 `consumes`, `produces`, and Content Negotiation

`consumes` filters the **request** `Content-Type`. `produces` filters the **response** against the request `Accept` header. A mismatch never enters the method: the client receives **415 Unsupported Media Type** (`consumes` miss) or **406 Not Acceptable** (`produces` miss).

```java
@PostMapping(
        path = "/reports",
        consumes = MediaType.APPLICATION_JSON_VALUE,
        produces = MediaType.APPLICATION_JSON_VALUE
)
public ReportDTO create(@RequestBody ReportRequest request) {
    return reportService.create(request);
}
```

#### Negotiation Order (default, Boot MVC):

$$\text{path extension (off by default)} \rightarrow \text{request parameter (off)} \rightarrow \text{Accept header} \rightarrow \text{produces attribute}$$

*   Boot turns **path-extension** negotiation off (`.json` in the URL does not choose the converter). Rely on `Accept` and `produces`.
*   `Jackson` is registered because `jackson-databind` is on the classpath (`JacksonAutoConfiguration`). Removing it removes JSON conversion.
*   To return a body with **201** and a `Location` header, prefer `ResponseEntity.created(uri).body(dto)` over a bare DTO (a bare return is always **200**).

---

### 3.7 Status Codes That Belong on the Controller

The controller chooses the HTTP contract. The service returns domain results or throws domain exceptions. It does not build `ResponseEntity` unless you have deliberately made the web types part of the service API (avoid that).

| Outcome | Status | `ResponseEntity` Factory | Body |
| :--- | :--- | :--- | :--- |
| Resource fetched | 200 OK | `ok(body)` | Representation. |
| Created | 201 Created | `created(location).body(body)` | Representation + `Location`. |
| Accepted for later processing | 202 Accepted | `accepted().body(body)` | Handle / status link, not the finished resource. |
| Delete succeeded, nothing to return | 204 No Content | `noContent().build()` | Empty. Do not return `null` from a `ResponseEntity<Void>` by accident without a status. |
| Bad client syntax / validation | 400 Bad Request | Produced by `@ControllerAdvice`, not by a happy-path return. | Field errors. |
| Authenticated but not allowed | 403 Forbidden | Security filter, before the controller. | — |
| No route or no row | 404 Not Found | `notFound().build()` or advice on `EntityNotFoundException`. | Empty or problem detail. |
| Conflict (duplicate key, version clash) | 409 Conflict | `status(CONFLICT).body(...)` | Which invariant broke. |

*   *Rule:* `POST` creates and is not idempotent. `PUT` replaces the whole resource and is idempotent. `PATCH` applies a partial change. `GET` and `DELETE` must not mutate beyond the delete itself. Mapping a write to `@GetMapping` breaks caches, crawlers, and retries.

---

### 3.8 Request Pipeline Inside `DispatcherServlet`

```
HTTP request
    |
    v
+----------------------+
| Filter chain         |  CharacterEncoding, Security, OncePerRequest
+----------------------+
    |
    v
+----------------------+
| DispatcherServlet    |  doDispatch()
+----------------------+
    |
    v
+----------------------+
| HandlerMapping       |  RequestMappingHandlerMapping matches method + verb + path
+----------------------+
    |
    v
+----------------------+
| HandlerAdapter       |  resolves arguments, invokes controller, handles return value
+----------------------+
    |
    +-- @ResponseBody / ResponseEntity --> HttpMessageConverter --> JSON bytes
    |
    +-- String view name --> ViewResolver --> HTML
    |
    +-- exception --> HandlerExceptionResolver chain
                         |
                         +-- @ExceptionHandler / @ControllerAdvice
                         +-- ResponseStatusExceptionResolver
                         +-- DefaultErrorAttributes (Boot /error JSON)
```

*   **Interceptors** (`HandlerInterceptor.preHandle / postHandle / afterCompletion`) sit between mapping and the controller. Filters sit outside Spring MVC and can wrap the raw request. Use a filter for security, correlation ids, and request logging; use an interceptor when you need the resolved handler method.

---

## Module 4: Spring Beans, IoC Container & Bean Lifecycle Mechanics

### 4.1 Inversion of Control (IoC) & Spring IoC Container

#### Inversion of Control (IoC):
In standard Java applications, dependencies are created explicitly using `new`:
```java
// Tight Coupling: Code controls dependency lifecycle
OrderService service = new OrderServiceImpl(new UserRepositoryImpl(), new EmailServiceImpl());
```

With **Inversion of Control**, dependency instantiation, configuration, and injection are delegated to the framework container:

$$\text{Developer specifies Config/Annotations} \longrightarrow \text{Spring IoC Container creates and injects dependencies}$$

#### Types of Spring IoC Containers:
1.  **`BeanFactory`**: Basic IoC container interface. Instantiates singletons lazily on demand.
2.  **`ApplicationContext`**: Enterprise-grade container interface extending `BeanFactory`. Adds features such as eager initialization of singletons, AOP integration, message source internationalization (i18n), and application event publishing.

---

### 4.2 Spring Bean Definition Methods

A **Spring Bean** is any object instantiated, assembled, and managed by the Spring IoC container.

#### Method 1: Component Scanning via Stereotype Annotations
Spring discovers classes annotated with component stereotypes and registers them as beans automatically.

*   `@Component`: Generic stereotype annotation for any Spring-managed class.
*   `@Service`: Denotes service layer classes containing business logic.
*   `@Repository`: Denotes persistence layer repositories (translates database exceptions).
*   `@Controller` / `@RestController`: Denotes web controllers handling HTTP requests.

```java
@Service // Auto-detected during component scanning
public class NotificationService {
    public void sendEmail(String recipient, String msg) { ... }
}
```

#### Method 2: Explicit Declaration via `@Configuration` and `@Bean`
Used when configuring third-party libraries (where class source code cannot be edited with `@Component`), or when custom creation logic is required.

```java
@Configuration // Marks class as a source of bean definitions
public class AppThirdPartyConfig {

    @Bean // Tells Spring that method returns a managed Spring Bean
    public RestTemplate restTemplate() {
        RestTemplate restTemplate = new RestTemplate();
        // Configure timeouts, interceptors, error handlers...
        return restTemplate;
    }
}
```

---

### 4.3 Component Scanning (`@ComponentScan`)
Spring uses `@ComponentScan` to locate annotated classes within specified package hierarchies.

```java
@Configuration
@ComponentScan(basePackages = {
    "com.conceptandcoding.service",
    "com.conceptandcoding.repository"
})
public class CustomScanConfiguration { }
```

*   By default, `@SpringBootApplication` includes `@ComponentScan` and scans the package containing the main application class and all sub-packages below it.

---

### 4.4 Bean Initialization Strategies: Eager vs Lazy

```java
// Strategy A: Eager Initialization (Default)
@Component
public class EagerSingletonBean {
    public EagerSingletonBean() {
        System.out.println("EagerSingletonBean: Created at application startup!");
    }
}

// Strategy B: Lazy Initialization
@Component
@Lazy // Instantiation delayed until requested
public class LazySingletonBean {
    public LazySingletonBean() {
        System.out.println("LazySingletonBean: Instantiated only on first explicit access!");
    }
}
```

#### Trade-off Analysis:

| Feature | Eager Initialization (Default) | Lazy Initialization (`@Lazy`) |
| :--- | :--- | :--- |
| **Creation Time** | During `ApplicationContext` startup. | On first request or injection. |
| **Startup Time** | Slower startup, higher initial memory footprint. | Faster startup, reduced initial memory footprint. |
| **Error Detection** | Fail-Fast: Catches missing dependencies or configuration errors immediately at startup. | Delayed: Errors occur at runtime during execution. |

---

### 4.5 The Complete Spring Bean Lifecycle

The Spring Container manages the lifecycle of a bean from instantiation to destruction:

```
+-----------------------------------------------------------------------------------+
| 1. INSTANTIATION                                                                  |
|    - JVM allocates memory.                                                        |
|    - Constructor invoked (Constructor Injection happens here).                    |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| 2. POPULATE PROPERTIES                                                            |
|    - Setter injection & Field injection (@Autowired) performed.                   |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| 3. EXECUTE AWARE INTERFACES                                                       |
|    - setBeanName(), setBeanFactory(), setApplicationContext() invoked.            |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| 4. BEAN POST PROCESSOR: PRE-INITIALIZATION                                        |
|    - BeanPostProcessor.postProcessBeforeInitialization() executed.                |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| 5. INITIALIZATION CALLBACKS                                                       |
|    - Method annotated with @PostConstruct invoked.                                |
|    - InitializingBean.afterPropertiesSet() invoked.                               |
|    - Custom initMethod declared on @Bean executed.                                |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| 6. BEAN POST PROCESSOR: POST-INITIALIZATION                                       |
|    - BeanPostProcessor.postProcessAfterInitialization() executed.                 |
|    - (Spring AOP creates proxy wrappers here if applicable).                      |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| 7. BEAN READY FOR USE                                                             |
|    - Bean serves requests inside the application runtime.                         |
+-----------------------------------------------------------------------------------+
                                          |
                                          v (Application Shutdown Initiated)
+-----------------------------------------------------------------------------------+
| 8. DESTRUCTION CALLBACKS                                                          |
|    - Method annotated with @PreDestroy invoked.                                   |
|    - DisposableBean.destroy() invoked.                                            |
|    - Custom destroyMethod declared on @Bean executed.                             |
+-----------------------------------------------------------------------------------+
```

#### Comprehensive Code Example Demonstrating All Lifecycle Phases:

```java
package com.conceptandcoding.demo.lifecycle;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.BeanFactory;
import org.springframework.beans.factory.BeanFactoryAware;
import org.springframework.beans.factory.BeanNameAware;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.stereotype.Component;

@Component
public class CompleteLifecycleBean implements 
        BeanNameAware, 
        BeanFactoryAware, 
        InitializingBean, 
        DisposableBean {

    private String beanName;

    // Phase 1: Instantiation
    public CompleteLifecycleBean() {
        System.out.println("Lifecycle Step 1: Instantiation - Constructor called.");
    }

    // Phase 3: Aware Interface Callbacks
    @Override
    public void setBeanName(String name) {
        this.beanName = name;
        System.out.println("Lifecycle Step 3a: BeanNameAware - Bean Name is: " + name);
    }

    @Override
    public void setBeanFactory(BeanFactory beanFactory) throws BeansException {
        System.out.println("Lifecycle Step 3b: BeanFactoryAware - BeanFactory reference injected.");
    }

    // Phase 5a: Annotation Initialization Callback
    @PostConstruct
    public void postConstruct() {
        System.out.println("Lifecycle Step 5a: @PostConstruct - Custom initialization tasks.");
    }

    // Phase 5b: Programmatic Interface Initialization Callback
    @Override
    public void afterPropertiesSet() throws Exception {
        System.out.println("Lifecycle Step 5b: InitializingBean.afterPropertiesSet() called.");
    }

    // Phase 7: Business Operation
    public void performTask() {
        System.out.println("Lifecycle Step 7: Bean is actively performing business operations.");
    }

    // Phase 8a: Annotation Destruction Callback
    @PreDestroy
    public void preDestroy() {
        System.out.println("Lifecycle Step 8a: @PreDestroy - Cleaning up resources.");
    }

    // Phase 8b: Programmatic Interface Destruction Callback
    @Override
    public void destroy() throws Exception {
        System.out.println("Lifecycle Step 8b: DisposableBean.destroy() - Closing database pools.");
    }
}
```

---

### 4.6 Stereotype Map and What Each Annotation Actually Adds

All four web/persistence stereotypes are `@Component`. Component scan registers them the same way. The extra annotation is a marker for tooling and, in one case, behavior.

| Annotation | Meta-annotated with | Extra behavior beyond being a bean |
| :--- | :--- | :--- |
| `@Component` | — | None. Generic bean. |
| `@Service` | `@Component` | None at runtime. Documents the business layer. |
| `@Controller` | `@Component` | MVC looks for `@RequestMapping` methods. |
| `@RestController` | `@Controller` + `@ResponseBody` | Every handler method is serialized with message converters. |
| `@Repository` | `@Component` | Persistence exception translation: vendor `SQLException` becomes Spring `DataAccessException` via a post-processor. |
| `@Configuration` | `@Component` | Full `@Configuration` classes are subclassed with CGLIB so `@Bean` methods call each other through the container (singleton cache) instead of calling `new` again. |

```java
@Configuration
public class PaymentClientConfig {

    @Bean
    public RestClient paymentRestClient(RestClient.Builder builder) {
        return builder.baseUrl("https://payments.internal").build();
    }
}
```

*   **`proxyBeanMethods = false`** (lite mode) skips the CGLIB subclass. Startup is cheaper. `@Bean` methods must not call each other; inject collaborators as parameters instead. `@SpringBootApplication` keeps the default `proxyBeanMethods = true` on the application class, but most Boot auto-configurations use lite mode.

---

### 4.7 Who Creates the Context

```
main()
  |
  v
SpringApplication.run
  |
  v
ApplicationContext implementation chosen by classpath
  |
  +-- spring-boot-starter-web on classpath
  |     AnnotationConfigServletWebServerApplicationContext
  |       owns DispatcherServlet + embedded Tomcat
  |
  +-- only spring-boot-starter-webflux
  |     AnnotationConfigReactiveWebServerApplicationContext
  |
  +-- no web starter
        AnnotationConfigApplicationContext
```

| Interface | Responsibility | You Program Against It? |
| :--- | :--- | :--- |
| `BeanFactory` | `getBean`, singleton registry, aliases. | Rarely. Too low level. |
| `ApplicationContext` | Environment, events, resources, i18n, AOP, eager singletons. | Inject this only at the edges (runners, custom scopes). |
| `Environment` | Property sources, active profiles. | Yes. Inject `Environment` or `@Value` / `@ConfigurationProperties`. |
| `ApplicationEventPublisher` | In-process publish/subscribe. | Yes, when a module must notify others without a hard dependency. |

*   **Eager singletons** are created at the end of `refresh()`, in dependency order. A singleton that is not injected by anyone is still created, unless it is `@Lazy` or has no singleton scope.
*   **Prototype beans are not stored.** Every `getBean` or injection point calls the factory again. The container does **not** call `@PreDestroy` on prototypes; the caller owns destruction.

---

### 4.8 Startup Failure vs Lazy Failure

Fail-fast is the reason Boot creates singletons during `refresh` instead of on the first request.

| Failure | When it surfaces with eager singletons | When it surfaces with `@Lazy` |
| :--- | :--- | :--- |
| Missing `@Bean` collaborator | Context fails to start. Process exit ≠ 0. | `NoSuchBeanDefinitionException` on first call. |
| Constructor throws | Startup fails. | First call fails. |
| Two beans, no `@Primary` / `@Qualifier` | `NoUniqueBeanDefinitionException` at startup. | Same exception, delayed. |
| Port already bound | Tomcat fails inside `refresh`. | Still at startup — the server is not lazy. |
| Database down, and a bean connects in `@PostConstruct` | Startup fails. | First use fails. Health checks should still catch this. |

*   *Rule:* Leave the default eager behavior for anything required to serve traffic. Use `@Lazy` for optional, expensive clients (report renderers, cold admin tools), not for the data source.

---

## Module 5: Dependency Injection Mechanics

### 5.1 What Injection Actually Does

Dependency Injection (DI) is the mechanism IoC uses. The class declares collaborators. The container supplies them. The class does not call `new` on those collaborators and does not look them up in a static registry.

```java
// Service locator (the class still depends on the container)
OrderRepository repository = context.getBean(OrderRepository.class);

// Dependency injection (the class depends only on the interface)
@Service
public class OrderService {
    private final OrderRepository repository;
    public OrderService(OrderRepository repository) {
        this.repository = repository;
    }
}
```

$$\text{type on the constructor} \rightarrow \text{container searches beans of that type} \rightarrow \text{one match is passed in} \rightarrow \text{object is stored}$$

---

### 5.2 Three Injection Styles

| Style | How Spring sees it | When the dependency is applied | Recommendation |
| :--- | :--- | :--- | :--- |
| **Constructor** | `AutowiredAnnotationBeanPostProcessor` calls the constructor. If there is a single constructor, `@Autowired` is optional. | Phase 1 of the lifecycle (instantiation). | Default. Fields can be `final`. Tests call `new OrderService(fakeRepo)`. |
| **Setter** | Setter annotated with `@Autowired`, or a JavaBean setter listed for autowire. | Phase 2 (populate properties), after the constructor returns. | Optional dependencies, and circular links you cannot redesign yet. |
| **Field** | Reflection writes the field. No constructor argument. | Phase 2. | Avoid. Hides dependencies, breaks `final`, and unit tests need Spring or a reflection hack. |

```java
@Service
public class OrderService {

    private final OrderRepository orders;
    private final PaymentGateway payments;

    // Single constructor → @Autowired is implicit
    public OrderService(OrderRepository orders, PaymentGateway payments) {
        this.orders = orders;
        this.payments = payments;
    }
}
```

#### Optional Collaborator:

```java
public OrderService(OrderRepository orders,
                     ObjectProvider<FraudClient> fraudClient) {
    this.orders = orders;
    this.fraudClient = fraudClient; // getIfAvailable() when the bean exists
}
```

`ObjectProvider<T>` is the supported way to express "zero or one bean" without making the dependency a nullable field that Spring silently leaves null.

---

### 5.3 Resolution Rules When More Than One Bean Matches

```
Injection point type: PaymentGateway
        |
        +-- 0 beans --> NoSuchBeanDefinitionException
        |                 (unless the parameter is Optional, ObjectProvider, or @Autowired(required=false))
        |
        +-- 1 bean  --> inject it
        |
        +-- N beans --> try to disambiguate
                          |
                          +-- @Qualifier("stripe") matches bean name or @Qualifier on the bean
                          +-- else @Primary bean
                          +-- else parameter name equals bean name (needs -parameters compiler flag)
                          +-- else NoUniqueBeanDefinitionException
```

```java
public OrderService(@Qualifier("stripe") PaymentGateway payments) { ... }

@Bean
@Primary
public PaymentGateway stripeGateway() { ... }
```

| Mechanism | Selects | Fails when |
| :--- | :--- | :--- |
| Exact type match | The only bean assignable to the parameter. | A subclass bean is also present (`@Primary` or qualifier required). |
| `@Qualifier("name")` | Bean with that qualifier value or that bean name. | Two beans carry the same qualifier. |
| `@Primary` | The preferred bean among many. | Two `@Primary` beans of the same type. |
| `@Resource(name = "stripe")` | By **name** first (JSR-250), not by type. | Name missing. |

*   *Rule:* Name the bean after the implementation (`@Service("stripePaymentGateway")` or the default class-name bean name) and qualify at the injection point that has a real choice. Do not mark everything `@Primary`.

---

### 5.4 Circular Dependencies

A cycle exists when bean A needs bean B and bean B needs bean A.

```
+----------------+   constructor    +----------------+
|  OrderService  | ---------------> | PaymentService |
+----------------+                  +----------------+
        ^                                    |
        |            constructor             |
        +------------------------------------+
```

| Cycle shape | Boot 2.6+ / 3.x default | Why |
| :--- | :--- | :--- |
| Constructor → constructor | **Fails** at startup. `BeanCurrentlyInCreationException`. | Neither object can be allocated until the other exists. There is no partial instance to hand out. |
| Constructor → setter, or field ↔ field | Fails unless `spring.main.allow-circular-references=true`. | Historically Spring stuffed an early reference (a factory singleton exposed before `populate`). That flag is **off** by default since Boot 2.6. |
| Both behind `ObjectProvider` / `Provider` / `@Lazy` on the injection point | Starts. The lookup happens on first use. | `@Lazy` here proxies the dependency; it does not make the target bean lazy for the whole context. |

*   *Rule:* Break the cycle. Extract the shared logic into a third bean, or publish an `ApplicationEvent` instead of holding a back-reference. Turning `allow-circular-references` on hides a design problem and changes initialization order in ways that are painful to debug.

---

### 5.5 `@ConfigurationProperties` vs `@Value`

`@Value("${server.port}")` injects one key. `@ConfigurationProperties` binds a tree onto a typed object and is the form Boot itself uses.

```java
@ConfigurationProperties(prefix = "orders.payment")
public record PaymentProperties(
        URI baseUrl,
        Duration timeout,
        int maxRetries
) {}
```

```properties
orders.payment.base-url=https://payments.internal
orders.payment.timeout=2s
orders.payment.max-retries=3
```

```java
@Configuration
@EnableConfigurationProperties(PaymentProperties.class)
public class PaymentClientConfig {

    @Bean
    public RestClient paymentClient(PaymentProperties props, RestClient.Builder builder) {
        return builder.baseUrl(props.baseUrl()).build();
    }
}
```

| | `@Value` | `@ConfigurationProperties` |
| :--- | :--- | :--- |
| **Shape** | One scalar (or a SpEL expression). | A prefix and nested fields. |
| **Type conversion** | Limited, via the conversion service. | Durations, data sizes, enums, lists, maps. |
| **Validation** | None built in. | `@Validated` on the class plus Jakarta constraints on fields. |
| **Metadata** | No IDE hints unless you write them. | `spring-boot-configuration-processor` emits `spring-configuration-metadata.json`. |
| **Reload story** | Injected once into the bean. | Same, unless you rebuild the bean. `@RefreshScope` (Spring Cloud) is a separate mechanism. |

*   Constructor binding is the default for `@ConfigurationProperties` records and for classes annotated `@ConstructorBinding` patterns used in Boot 3: if a single parameterized constructor exists, Boot binds through it. Fields can stay immutable.

---

## Module 6: Bean Scopes & Scoped Proxies

### 6.1 Built-in Scopes

Scope answers: "how many instances exist, and what is their lifetime?"

| Scope | Instances | Lifetime | Context required | Destruction callback |
| :--- | :--- | :--- | :--- | :--- |
| `singleton` (default) | One per `ApplicationContext`. | Context refresh → context close. | Any. | `@PreDestroy` is called. |
| `prototype` | A new instance on every lookup. | Until the caller drops it. | Any. | **Not** called by Spring. |
| `request` | One per HTTP request. | Bound to `ServletRequestAttributes`. | Web. | Called at request completion. |
| `session` | One per HTTP session. | Bound to the session. | Web. | Called when the session ends. |
| `application` | One per `ServletContext`. | Web application. | Web. | Called on shutdown. |
| `websocket` | One per WebSocket session. | Socket lifetime. | WebSocket. | Called when the session closes. |

```java
@Component
@Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
public class ImportJob {
    private final Instant startedAt = Instant.now();
}
```

*   A **singleton that injects a prototype once** captures that one prototype forever. The injection happens a single time, during singleton creation. Declaring the dependency `@Scope("prototype")` does not change that by itself.

---

### 6.2 Method Injection and Scoped Proxies

Two supported ways to get a fresh prototype (or the current request bean) from inside a singleton:

#### 1. `ObjectProvider` (preferred for prototypes):

```java
@Service
public class ImportService {
    private final ObjectProvider<ImportJob> jobs;

    public ImportService(ObjectProvider<ImportJob> jobs) {
        this.jobs = jobs;
    }

    public void run() {
        ImportJob job = jobs.getObject(); // new prototype every call
        job.execute();
    }
}
```

#### 2. Scoped proxy (required for `request` / `session` injected into a singleton):

```java
@Component
@Scope(value = WebApplicationContext.SCOPE_REQUEST, proxyMode = ScopedProxyMode.TARGET_CLASS)
public class RequestAuditContext {
    private final List<String> notes = new ArrayList<>();
    public void add(String note) { notes.add(note); }
}
```

```
Singleton OrderController
        |
        | holds
        v
+---------------------------+
| JDK or CGLIB proxy        |  created once, at singleton startup
| (fake RequestAuditContext)|
+---------------------------+
        |
        | on every method call, looks up
        v
+---------------------------+
| Real instance in the      |  the instance bound to *this* HTTP request
| current request           |
+---------------------------+
```

*   `ScopedProxyMode.TARGET_CLASS` uses CGLIB and works on classes.
*   `ScopedProxyMode.INTERFACES` uses a JDK proxy and requires an interface.
*   Without the proxy, startup fails: there is no current request when the singleton is created, so the `request` bean cannot be materialized.

---

### 6.3 Custom Scope (Mental Model)

A scope is a `Scope` implementation registered on `ConfigurableBeanFactory`: `get(name, objectFactory)`, `remove`, and a destruction callback. HTTP scopes store the instance in request or session attributes under a Spring-generated key. You rarely write one; you do need to know that "scope" is a strategy object, not a language feature.

---

## Module 7: Profiles, Environment & Externalized Configuration

### 7.1 Profiles

A profile is a named slice of beans and properties. Active profiles are set before the context refreshes, because `@Profile` is evaluated while bean definitions are registered.

```java
@Configuration
@Profile("dev")
public class DevDataConfig {
    @Bean
    public DataSource dataSource() {
        return new EmbeddedDatabaseBuilder()
                .setType(EmbeddedDatabaseType.H2)
                .build();
    }
}
```

| Activation | Example | Where it is read |
| :--- | :--- | :--- |
| Property | `spring.profiles.active=prod` | Any property source. |
| Environment variable | `SPRING_PROFILES_ACTIVE=prod` | OS env. |
| Command line | `--spring.profiles.active=prod` | Highest among the common sources. |
| Test | `@ActiveProfiles("test")` | Only that test context. |
| Programmatic | `SpringApplication.setAdditionalProfiles("prod")` | Before `run`. |

*   **`spring.profiles.default`** applies only when **no** active profile is set.
*   **Profile groups** (`spring.profiles.group.prod=prod,metrics`) expand one name into several.
*   **`@Profile("!prod")`** registers the bean when `prod` is not active.
*   **`@Profile({"dev", "test"})`** is an OR list.

---

### 7.2 Property Source Precedence

Later sources in Boot's list override earlier ones. The practical order, from **highest precedence** (wins) to lowest:

```
+------------------------------------------------------------------+
| 1. Command-line arguments          --server.port=9090           |
| 2. Java system properties          -Dserver.port=9090           |
| 3. OS environment variables        SERVER_PORT=9090             |
| 4. Profile-specific files outside  ./config/application-prod.yml|
|    the JAR, then inside the JAR    classpath:application-prod.yml|
| 5. Application files outside, then classpath:application.yml    |
| 6. @PropertySource on a            explicit extra files         |
|    @Configuration class                                            |
| 7. SpringApplication.setDefaultProperties  (lowest)             |
+------------------------------------------------------------------+
```

Profile-specific files override the non-profile file for the same key. `application-prod.yml` wins over `application.yml` when `prod` is active. Command-line still wins over both.

#### Multi-document YAML:

```yaml
spring:
  application:
    name: order-service
---
spring:
  config:
    activate:
      on-profile: prod
server:
  port: 8080
```

---

### 7.3 `@Profile` on a `@Bean` Method vs on a Class

| Placement | What is skipped |
| :--- | :--- |
| On a `@Configuration` class | Every `@Bean` method in that class, and component scanning does not register it. |
| On a single `@Bean` method | Only that bean. Sibling beans in the class are still created. |
| On a `@Component` class | That component is not registered when the profile is inactive. |

An inactive bean is not in the context at all. Injection points that require it fail at startup. Guard them with `@Autowired(required = false)`, `ObjectProvider`, or a matching `@Profile` on the consumer.

---

### 7.4 Environment-Specific Beans Without Copy-Paste

Prefer one bean whose *settings* change per profile, over two classes that differ only by a URL.

```java
@Configuration
public class DataSourceConfig {

    @Bean
    @Profile("dev")
    public DataSource devDataSource() { /* H2 */ return h2(); }

    @Bean
    @Profile("prod")
    public DataSource prodDataSource(DataSourceProperties props) {
        return props.initializeDataSourceBuilder().build();
    }
}
```

For credentials, do not commit `application-prod.properties` secrets. Bind `SPRING_DATASOURCE_PASSWORD` from the platform (Kubernetes secret, systemd environment). The property key stays `spring.datasource.password`.

---

## Module 8: Spring AOP — Proxies, Pointcuts & Advice

### 8.1 What AOP Is Doing in Spring

Spring AOP wraps a bean in a **proxy**. Callers who obtained the bean from the container call the proxy. The proxy runs advice, then delegates to the target. Spring AOP is **proxy-based** and only intercepts **method executions on Spring beans**. It does not rewrite bytecode of `new` calls the way AspectJ compile-time or load-time weaving does.

```
Caller (another Spring bean)
        |
        | calls charge()
        v
+----------------------------------------------+
| Proxy (JDK dynamic proxy or CGLIB subclass)  |
|   1. run @Before advice                      |
|   2. run @Around (proceed)                   |
|   3. invoke target OrderService.charge()     |
|   4. run @AfterReturning / @AfterThrowing    |
|   5. run @After (finally)                    |
+----------------------------------------------+
        |
        v
+----------------------------------------------+
| Target instance (your @Service)              |
+----------------------------------------------+
```

| Proxy strategy | When Spring chooses it | Constraint |
| :--- | :--- | :--- |
| JDK dynamic proxy | The bean has an interface and `proxyTargetClass` is false. | Callers must be typed to the interface. The proxy is not a subclass. |
| CGLIB subclass | No interface, or `spring.aop.proxy-target-class=true` (Boot default is **true**). | Class and advised methods must not be `final`. Spring instantiates the subclass without re-running your constructor (Objenesis). Keep side effects out of constructors anyway. |

Boot sets `spring.aop.auto=true` and `proxy-target-class=true`. `@EnableAspectJAutoProxy` is pulled in by auto-configuration when `aspectjweaver` is present (it comes with `spring-boot-starter-aop`).

---

### 8.2 Advice Types and a Working Aspect

| Annotation | Runs | Can swallow or replace the return? | Typical job |
| :--- | :--- | :--- | :--- |
| `@Around` | Before and after. Must call `pjp.proceed()`. | Yes. It can return a different value or skip `proceed`. | Timing, transactions, security checks. |
| `@Before` | Before the method. Cannot skip it without throwing. | No. | Validation guards, MDC logging. |
| `@AfterReturning` | After a normal return. | Can bind the return value. Cannot replace it (use `@Around`). | Audit success. |
| `@AfterThrowing` | When the method throws. | No. The exception still propagates unless you throw a different one. | Map or log failures. |
| `@After` | Always, like `finally`. | No. | Clear ThreadLocals. |

```java
@Aspect
@Component
public class ServiceTimingAspect {

    @Around("execution(* com.conceptandcoding.orderservice.service..*(..))")
    public Object time(ProceedingJoinPoint pjp) throws Throwable {
        long start = System.nanoTime();
        try {
            return pjp.proceed();
        } finally {
            long ms = (System.nanoTime() - start) / 1_000_000;
            System.out.println(pjp.getSignature() + " took " + ms + " ms");
        }
    }
}
```

Enable explicitly only when you are not on Boot's AOP starter:

```java
@Configuration
@EnableAspectJAutoProxy
public class AopConfig {}
```

---

### 8.3 Pointcut Designators You Actually Use

| Designator | Matches | Example |
| :--- | :--- | :--- |
| `execution` | Method signature pattern. | `execution(* com.example.service..*(..))` |
| `within` | Every method join point lexically inside a type. | `within(com.example.service..*)` |
| `@within` | Methods of a type carrying an annotation. | `@within(org.springframework.stereotype.Service)` |
| `@annotation` | Methods carrying an annotation. | `@annotation(com.example.audit.Audited)` |
| `bean` | Spring bean name (Spring-specific). | `bean(orderService)` |
| `args` | Runtime argument types. | `args(java.lang.String, ..)` |

```
execution( modifiers? return-type declaring-type? name(params) throws? )

execution(public ResponseEntity com.example.web.*.*(..))
           |        |            |                  |
           |        |            |                  any arguments
           |        |            any class in web, any method
           |        return type
           public only
```

*   `*` is one token. `..` in a type name means "this package and below". `..` in the argument list means "any number of arguments".
*   Spring AOP pointcuts do **not** match `private` methods. The proxy only overrides or implements methods it can see.
*   Combine with `&&`, `||`, and `!`: `@annotation(Audited) && within(com.example.service..*)`.

---

### 8.4 The Self-Invocation Limit

```java
@Service
public class OrderService {
    public void place(Order order) {
        charge(order); // direct call on `this` — the proxy is NOT in the path
    }

    @Audited
    public void charge(Order order) { /* advice does not run */ }
}
```

```
External caller --> proxy.place() --> target.place()
                                         |
                                         | this.charge()   (no proxy)
                                         v
                                       target.charge()     advice skipped
```

| Workaround | Trade-off |
| :--- | :--- |
| Move `charge` to another bean and inject it. | Clean. This is the right fix. |
| Inject self through `ObjectProvider` / a lazy self reference. | Works, still a design smell. |
| `AopContext.currentProxy()` with `exposeProxy=true`. | Ties business code to Spring AOP. |
| Full AspectJ weaving (`@EnableLoadTimeWeaving` or compile-time). | Sees `this` calls and private methods. Heavier build and JVM agent setup. |

The same limit applies to `@Transactional` and `@Async`. They are implemented as advisors on the same proxy.

---

### 8.5 Advice Order

When several aspects match one method, `@Order` (lower value = higher precedence) decides the chain. An `@Around` with `@Order(1)` wraps an `@Around` with `@Order(2)`: the outer advice sees the inner advice as part of `proceed()`.

Spring's own transactional advisor and security advisor are in this chain. A custom `@Around` that swallows exceptions can prevent rollback logic from seeing the exception, depending on which advisor is outside the other. Do not catch-and-ignore inside advice that sits inside the transaction advisor.

---

## Module 9: Transaction Management

### 9.1 What `@Transactional` Wraps

`@EnableTransactionManagement` (auto-configured when a `PlatformTransactionManager` bean exists) registers an advisor. The proxy starts a transaction before the method and commits or rolls back after it.

```
Controller
    |
    v
Proxy of OrderService          <-- transaction boundary lives here
    |
    | begin
    v
OrderService.place()
    |-- repository.save()      <-- joins the same thread-bound transaction
    |-- paymentClient.charge() <-- NOT rolled back by the DB transaction
    v
commit or rollback
```

JDBC / JPA participates because `TransactionSynchronizationManager` binds a connection (and an `EntityManager`) to the **current thread**. That is why a transaction cannot hop threads unless you move to a JTA transaction manager with XA resources.

```java
@Service
public class OrderService {

    private final OrderRepository orders;

    public OrderService(OrderRepository orders) {
        this.orders = orders;
    }

    @Transactional
    public Order place(PlaceOrderCommand command) {
        Order order = Order.create(command);
        return orders.save(order);
    }
}
```

---

### 9.2 Rollback Rules

| What leaves the method | Default rollback? |
| :--- | :--- |
| Normal return | No. Commit. |
| `RuntimeException` and `Error` | Yes. |
| Checked `Exception` | **No.** Commit, then the checked exception propagates. |
| `rollbackFor = Exception.class` | Yes, including checked exceptions. |
| `noRollbackFor = BusinessException.class` | That runtime exception commits. |

```java
@Transactional(rollbackFor = Exception.class)
public Receipt checkout(CheckoutCommand command) throws PaymentDeclinedException {
    // a checked PaymentDeclinedException now rolls the DB work back
}
```

*   *Rule:* Prefer unchecked domain exceptions for failures that must undo database work, or set `rollbackFor` explicitly. Do not assume a checked exception undoes the insert.

---

### 9.3 Propagation

Propagation decides what to do when a transaction is already active on the thread.

| Propagation | Ongoing transaction | No ongoing transaction |
| :--- | :--- | :--- |
| `REQUIRED` (default) | Join it. | Create one. |
| `REQUIRES_NEW` | Suspend the outer, start an independent one. Inner commit/rollback does not wait for the outer. | Create one. |
| `NESTED` | JDBC savepoint inside the same physical transaction (not a real JPA nested transaction on most providers). | Create one. |
| `SUPPORTS` | Join it. | Run non-transactional. |
| `NOT_SUPPORTED` | Suspend it. Run non-transactional. | Run non-transactional. |
| `MANDATORY` | Join it. | Throw `IllegalTransactionStateException`. |
| `NEVER` | Throw. | Run non-transactional. |

```java
@Transactional
public void place(Order order) {
    orders.save(order);
    audit.record(order.getId()); // REQUIRES_NEW — audit row survives if place() rolls back
}

@Service
public class AuditService {
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(Long orderId) { /* own commit */ }
}
```

`REQUIRES_NEW` only starts a **new** transaction when the call crosses a Spring proxy. A private self-call uses the outer transaction.

---

### 9.4 Isolation and Read-Only

| Isolation | Dirty read | Non-repeatable read | Phantom read | Cost |
| :--- | :--- | :--- | :--- | :--- |
| `DEFAULT` | Whatever the database default is (PostgreSQL: `READ_COMMITTED`). | — | — | None beyond the DB default. |
| `READ_COMMITTED` | Prevented. | Possible. | Possible. | Typical OLTP choice. |
| `REPEATABLE_READ` | Prevented. | Prevented. | Possible on some engines; prevented on PostgreSQL's implementation. | More locking or snapshot overhead. |
| `SERIALIZABLE` | Prevented. | Prevented. | Prevented. | Aborts and retries under contention. |

```java
@Transactional(readOnly = true)
public Order get(Long id) {
    return orders.findById(id).orElseThrow();
}
```

*   `readOnly = true` hints Hibernate to skip dirty checking and tells some databases the transaction will not write. It is **not** a security boundary. A `save` inside a read-only transaction can still throw or, on some setups, still flush. Do not rely on it to stop writes.
*   Isolation is set when the transaction **starts**. Joining an outer `REQUIRED` transaction does not lower or raise the isolation already chosen by the outer method.

---

### 9.5 The Failures That Look Like "Transactions Are Broken"

| Symptom | Cause |
| :--- | :--- |
| Inserts remain after an exception | Self-invocation (no proxy), or a checked exception without `rollbackFor`, or the exception was caught inside the method. |
| `@Transactional` on a private or final method does nothing | CGLIB cannot override it. No advice. |
| LazyInitializationException in the controller | Session closed when the service transaction ended, and `spring.jpa.open-in-view=false`. Fetch or map to a DTO inside the transaction. |
| Inner `REQUIRES_NEW` rolled back with the outer | The inner call did not go through a Spring bean proxy. |
| Two datasources, one `@Transactional` | One `PlatformTransactionManager` is `@Primary`. The other DB is not enlisted. Use a named manager (`transactionManager = "ledgerTxManager"`) or JTA/XA if you truly need one atomic commit across two databases. |

---

## Module 10: Asynchronous Execution

### 10.1 `@Async` Mechanics

`@EnableAsync` registers an advisor similar to transactions. The proxy submits the method to a `TaskExecutor` and returns immediately to the caller.

```java
@Configuration
@EnableAsync
public class AsyncConfig implements AsyncConfigurer {

    @Override
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setThreadNamePrefix("orders-async-");
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(16);
        executor.setQueueCapacity(200);
        executor.initialize();
        return executor;
    }

    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return (ex, method, params) ->
                System.err.println("Async failure in " + method.getName() + ": " + ex.getMessage());
    }
}
```

```java
@Service
public class NotificationService {

    @Async
    public CompletableFuture<Void> sendReceipt(String email) {
        // runs on orders-async-* thread, not the Tomcat thread
        return CompletableFuture.completedFuture(null);
    }
}
```

| Return type | Caller observes completion? | Exception path |
| :--- | :--- | :--- |
| `void` | No. | `AsyncUncaughtExceptionHandler`. Easy to lose. |
| `Future` / `CompletableFuture<T>` | Yes. `future.join()` or a callback. | Exception completes the future exceptionally. The uncaught handler is **not** used. |
| `ListenableFuture` (legacy) | Yes. | Same as `Future`. |

---

### 10.2 Thread Boundaries You Must Not Ignore

```
Tomcat thread                         async pool thread
-------------------------             ---------------------------
@Transactional method                 @Async method
  binds Connection + EntityManager      has NO transaction unless
  ThreadLocal security context          the async method is also
                                        @Transactional (new context)
```

| Context | Does it hop to the `@Async` thread by default? |
| :--- | :--- |
| DB transaction / `EntityManager` | No. ThreadLocal. Start a new `@Transactional` on the async method if it writes. |
| Security `SecurityContext` | No, unless you set a `SecurityContext` task decorator or use `DelegatingSecurityContextAsyncTaskExecutor`. |
| SLF4J MDC | No. Copy the map with a `TaskDecorator`. |
| Request-scoped beans | No. The request may already be finished. Do not touch `@Scope("request")` beans inside `@Async`. |

*   **Self-invocation** skips `@Async` the same way it skips `@Transactional`.
*   **Pool exhaustion:** `CallerRunsPolicy` runs the task on the caller (the request thread stalls). `AbortPolicy` throws `TaskRejectedException`. Size the queue for bursts, and do not use an unbounded queue in front of a tiny pool — the queue hides overload until memory dies.
*   **Shutdown:** `spring.task.execution.shutdown.await-termination=true` lets in-flight tasks finish on context close. Without it, the JVM exits while receipts are half-sent.

---

### 10.3 `@Async` Together With `@Transactional`

Place them on the method that should define **both** the thread and the transaction. A caller with `@Transactional` that then calls an `@Async` method on another bean does **not** enlist the async work in the caller transaction: the connection is not shared across threads.

```java
@Async
@Transactional
public void projectReadModel(Long orderId) {
    // new thread, new transaction, sees only committed data
}
```

If the async method must see the row the caller just inserted, the caller has to **commit first**. Submit the async work after the outer transaction completes (`TransactionSynchronization.afterCommit`) or the async thread will not see the uncommitted insert.

---

## Module 11: Validation & Centralized Exception Handling

### 11.1 Jakarta Bean Validation

Since Boot 2.3, `spring-boot-starter-validation` is its own dependency (Hibernate Validator). It is not pulled in by `spring-boot-starter-web`. Annotations on a DTO do nothing until a validator runs. On a controller argument, `@Valid` or `@Validated` triggers that.

```java
public record CreateOrderRequest(
        @NotBlank String sku,
        @Positive int quantity,
        @Email String notifyEmail,
        @NotNull @Valid AddressRequest shipTo
) {}

@PostMapping("/orders")
public ResponseEntity<OrderDTO> create(@Valid @RequestBody CreateOrderRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED).body(orderService.create(request));
}
```

| Annotation | Checks | Notes |
| :--- | :--- | :--- |
| `@NotNull` | Reference is non-null. | Does not reject `""`. |
| `@NotBlank` | Not null, and contains a non-whitespace character. | Strings only. |
| `@NotEmpty` | Not null and not empty (`""`, empty collection). | Blank `" "` passes `@NotEmpty`. |
| `@Positive` / `@PositiveOrZero` | Numeric comparison. | Null is valid unless `@NotNull` is also present. |
| `@Email` | Email shape. | A loose check. Combine with `@NotBlank`. |
| `@Size` / `@Min` / `@Max` | Length or numeric bounds. | — |
| `@Pattern` | Regular expression. | — |
| `@Valid` (nested) | Cascades into the field. | Without it, nested violations are ignored. |

#### Validation Exception by Entry Point:

| Trigger | Exception | HTTP status from Boot's default resolver |
| :--- | :--- | :--- |
| `@Valid @RequestBody` fails | `MethodArgumentNotValidException` | 400 |
| `@Valid @ModelAttribute` fails, no `BindingResult` parameter | `BindException` | 400 |
| Constraint on a `@PathVariable` / `@RequestParam` (needs `@Validated` on the **class**) | `HandlerMethodValidationException` on Boot 3.2+ (Spring Framework 6.1) | 400 from Boot's default resolver. Older 3.0–3.1 stacks threw `ConstraintViolationException`, which became 500 unless advice mapped it. |
| Validator called manually in a service | Whichever exception you throw | Your mapping |

```java
@RestController
@Validated // required for constraint annotations on method parameters that are not beans
@RequestMapping("/api/v1/orders")
public class OrderController {

    @GetMapping("/{id}")
    public OrderDTO get(@PathVariable @Positive Long id) {
        return orderService.get(id);
    }
}
```

---

### 11.2 `@ControllerAdvice` and `@ExceptionHandler`

Controllers should not catch every failure to build a `ResponseEntity`. An advice bean is a centralized handler. `@RestControllerAdvice` is `@ControllerAdvice` + `@ResponseBody`.

```java
public record ApiError(String code, String message, List<FieldError> fields, Instant timestamp) {
    public record FieldError(String field, String message) {}
}

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleInvalid(MethodArgumentNotValidException ex) {
        List<ApiError.FieldError> fields = ex.getBindingResult().getFieldErrors().stream()
                .map(err -> new ApiError.FieldError(err.getField(), err.getDefaultMessage()))
                .toList();
        ApiError body = new ApiError("VALIDATION_FAILED", "Request validation failed", fields, Instant.now());
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(OrderNotFoundException.class)
    public ResponseEntity<ApiError> handleMissing(OrderNotFoundException ex) {
        ApiError body = new ApiError("ORDER_NOT_FOUND", ex.getMessage(), List.of(), Instant.now());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(Exception ex) {
        ApiError body = new ApiError("INTERNAL_ERROR", "Unexpected error", List.of(), Instant.now());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }
}
```

#### Handler Selection:

```
Thrown exception
    |
    v
Most specific @ExceptionHandler in the controller (local) wins
    |
    if none
    v
@ExceptionHandler in @ControllerAdvice
    |  closest type match (OrderNotFoundException before RuntimeException before Exception)
    v
Boot's DefaultHandlerExceptionResolver / error page (JSON problem body for /error)
```

*   Advice beans can be limited with `annotations = RestController.class`, `basePackages = "com.example.web"`, or `assignableTypes`.
*   A catch-all `@ExceptionHandler(Exception.class)` hides bugs if it logs nothing. Log the stack trace server-side and return a generic body to the client.
*   Spring 6 also supports **RFC 7807** `ProblemDetail` (`ResponseEntity<ProblemDetail>` or `ErrorResponseException`) as the standard error body. Use one error shape per API and stick to it.

---

### 11.3 Domain Exceptions vs HTTP Exceptions

```java
public class OrderNotFoundException extends RuntimeException {
    public OrderNotFoundException(Long id) {
        super("Order " + id + " was not found");
    }
}
```

| Throw this | From | Why |
| :--- | :--- | :--- |
| Domain exception (`OrderNotFoundException`) | Service | The service stays free of `HttpStatus` and `ResponseEntity`. |
| `ResponseStatusException(HttpStatus.NOT_FOUND, "...")` | Controller, or a thin edge | Fast, but pushes HTTP into whoever throws it. |
| `MethodArgumentNotValidException` | Framework only | Do not construct this by hand. |

*   *Rule:* Translate domain exceptions to status codes in one advice class. That keeps the matrix of "which failure is which status" reviewable in one file.

---

## Module 12: Spring Data JPA, Entity Lifecycle & Relational Mapping

### 12.1 Stack, From Repository Call to SQL

```
OrderRepository.findById(id)          interface you wrote
        |
        v
SimpleJpaRepository                   Spring Data implementation, @Transactional on CRUD methods
        |
        v
EntityManager (Hibernate)             persistence context = first-level cache for this unit of work
        |
        v
JDBC Connection                       borrowed from HikariCP
        |
        v
PostgreSQL / MySQL
```

| Interface | You get | You do not get |
| :--- | :--- | :--- |
| `Repository<T, ID>` | Marker only. | Any methods. |
| `CrudRepository<T, ID>` | `save`, `findById`, `findAll`, `delete`, `count`. `findAll` returns `Iterable`. | Paging helpers. |
| `PagingAndSortingRepository<T, ID>` | `findAll(Pageable)`, `findAll(Sort)`. | `save` (it does not extend `CrudRepository` in Spring Data 3). |
| `ListCrudRepository<T, ID>` | CRUD with `List` returns. | — |
| `JpaRepository<T, ID>` | List CRUD + paging + `flush`, `saveAndFlush`, `getReferenceById`. | DTO projections until you declare them. |

`spring-boot-starter-data-jpa` auto-configures a `DataSource`, `EntityManagerFactory`, and `JpaTransactionManager` when a JDBC driver is present.

```java
public interface OrderRepository extends JpaRepository<Order, Long> {

    Optional<Order> findByExternalRef(String externalRef);

    @Query("select o from Order o join fetch o.lines where o.id = :id")
    Optional<Order> findWithLines(@Param("id") Long id);
}
```

Derived query parsing: `findByExternalRefAndStatus` → `where externalRef = ? and status = ?`. A typo in the property name fails at **startup** (`QueryCreationException`), which is what you want.

---

### 12.2 Entity Lifecycle

```
        new Order()                         repository.save() / persist
   +------------------+                 +------------------+
   | TRANSIENT        | --------------->| MANAGED          |
   | no id (typically)|                  | in a persistence |
   +------------------+                  | context, dirty   |
                                         | checking on      |
                                         +------------------+
                                            |           |
                              detach /      |           | remove()
                              close context |           v
                                            |    +------------------+
                                            |    | REMOVED          |
                                            v    | DELETE on flush  |
                                     +------------------+ 
                                     | DETACHED         |
                                     | has id, not      |
                                     | tracked          |
                                     +------------------+
                                            |
                                            | merge() / save() of detached
                                            v
                                         MANAGED
```

| State | In a persistence context? | `save()` does |
| :--- | :--- | :--- |
| Transient (no id, or id not in DB — depends on strategy) | No. | `persist`. INSERT. |
| Managed | Yes. | No-op. Dirty fields are written on flush. |
| Detached | No. | `merge`. UPDATE (or INSERT if the id strategy says it is new). |
| Removed | Yes, scheduled for deletion. | DELETE on flush. |

*   **Flush** is not commit. Flush synchronizes the persistence context to the database inside the current transaction. Commit flushes and then commits the connection.
*   **`saveAndFlush`** forces that synchronization before the method returns. Use it when a subsequent native query in the same transaction must see the row.
*   **Identity:** `@GeneratedValue(strategy = GenerationType.IDENTITY)` needs the INSERT to learn the id, so Hibernate inserts immediately on `persist` rather than batching as freely as `SEQUENCE`.

```java
@Entity
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String externalRef;

    @Enumerated(EnumType.STRING)
    private OrderStatus status;
}
```

*   *Rule:* `@Enumerated(EnumType.STRING)` stores `PAID`, not `0`. Ordinal mappings break when the enum constant order changes.

---

### 12.3 Relational Mapping

| Annotation | Who holds the foreign key | Inverse side |
| :--- | :--- | :--- |
| `@ManyToOne` | This table. The FK column lives here. | The parent's `@OneToMany(mappedBy = "...")`. |
| `@OneToMany` | The child table, when `mappedBy` is set. | This side is inverse: it does not own the FK. |
| `@OneToOne` | The side **without** `mappedBy`. | The side with `mappedBy`. |
| `@ManyToMany` | Neither entity table. A join table, owned by the side without `mappedBy`. | `mappedBy` side. |

```java
@Entity
public class Order {
    @Id @GeneratedValue private Long id;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderLine> lines = new ArrayList<>();

    public void addLine(OrderLine line) {
        lines.add(line);
        line.setOrder(this); // keep both sides in memory aligned
    }
}

@Entity
public class OrderLine {
    @Id @GeneratedValue private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;
}
```

#### Fetch Type:

| Fetch | SQL shape | Risk |
| :--- | :--- | :--- |
| `LAZY` (default for `@OneToMany`, `@ManyToMany`; default for `@ManyToOne` / `@OneToOne` is actually **EAGER** in JPA — override it) | Loaded on first access, if a session is open. | `LazyInitializationException` outside a transaction. Extra queries (N+1). |
| `EAGER` | Loaded with the parent, often by a join or a second select. | Always pays the cost, even for endpoints that do not need the association. |

*   *Rule:* Set `@ManyToOne(fetch = FetchType.LAZY)`. JPA's eager default on to-one associations is the source of surprise joins.

#### Cascade and `orphanRemoval`:

| Cascade | Copies this operation to children |
| :--- | :--- |
| `PERSIST` | `persist` of parent persists new children. |
| `MERGE` | `merge` cascades. |
| `REMOVE` | Deleting the parent deletes children. |
| `ALL` | All of the above plus `REFRESH` and `DETACH`. |
| `orphanRemoval = true` | Removing a child from the collection deletes the child row. Stronger than cascade: it means "this child has no life outside the parent". |

#### N+1:

```
findAll orders            --> 1 query
for each order: getLines  --> N queries
```

Fix inside the transaction, before mapping to DTOs:

*   `join fetch` in JPQL (one SQL query; be careful with pagination — Hibernate warns and loads everything when a fetch join is paginated).
*   `@EntityGraph(attributePaths = "lines")` on the repository method.
*   `BATCH` / `@BatchSize` so child selects are grouped instead of one-per-parent.

---

### 12.4 Repository Transactions and OSIV

Spring Data marks `SimpleJpaRepository` methods `@Transactional`. Read methods are `readOnly = true`. A service method annotated `@Transactional` **joins** that work; the repository does not commit early.

`spring.jpa.open-in-view` (default **true**) binds an `EntityManager` for the entire HTTP request, after the service method has returned. Lazy loading then succeeds in the controller or in Jackson. It also holds a JDBC connection until the response is written.

| Setting | Lazy load in the view/JSON layer | Connection held | Preferred for APIs |
| :--- | :--- | :--- | :--- |
| `true` (Boot default) | Works. | Until the response is done. | No. Hides missing fetches. |
| `false` | Throws if the graph was not loaded. | Released at transaction end. | Yes. Map to DTOs in the service. |

---

### 12.5 Schema Ownership

| `spring.jpa.hibernate.ddl-auto` | Behavior | Use |
| :--- | :--- | :--- |
| `none` / unset in some prod profiles | Hibernate does not touch schema. | Production, with Flyway or Liquibase. |
| `validate` | Fail startup if entities and tables disagree. | Production when you want a safety check. |
| `update` | ALTER to add what it can. Does not drop columns you removed. | Local experiments only. |
| `create` | Drop and create on startup. | Disposable local databases. |
| `create-drop` | Drop on startup and on close. | Tests. |

Flyway (`spring-boot-starter-flyway`, scripts in `classpath:db/migration/V1__init.sql`) runs **before** Hibernate validation when both are on the classpath. The migration is the source of truth. The entity is the mapping, not the DDL generator.

---

## Module 13: Scheduling, DevTools & Actuator

### 13.1 `@Scheduled`

`@EnableScheduling` registers a registrar that scans for `@Scheduled` methods and submits them to a `TaskScheduler` (single thread by default).

```java
@Configuration
@EnableScheduling
public class SchedulingConfig {}

@Component
public class OutboxPublisher {

    @Scheduled(fixedDelay = 5_000)          // 5s after the previous run *finishes*
    public void publish() { /* ... */ }

    @Scheduled(fixedRate = 10_000)          // every 10s from the start of the previous run
    public void heartbeat() { /* ... */ }

    @Scheduled(cron = "0 0 3 * * *", zone = "Asia/Kolkata")
    public void nightlyReconcile() { /* 03:00 local */ }
}
```

| Attribute | Clock | Overlap |
| :--- | :--- | :--- |
| `fixedDelay` | Gap measured after completion. | No overlap on the default single-thread scheduler. |
| `fixedRate` | Gap measured from the scheduled start. | Can queue behind a slow run. Does not run two invocations on one bean concurrently with the single-thread scheduler. |
| `cron` | Calendar expression, six fields (second minute hour day month weekday) plus optional year. | Missed executions are not replayed. |
| `initialDelay` | Wait before the first `fixedDelay` / `fixedRate`. | — |

*   Cron is **not** the five-field Unix form. Spring's default is six fields, starting with seconds: `0 0/5 * * * *` means "second 0, every 5 minutes".
*   The scheduler thread has no HTTP request and no transaction until you annotate the method with `@Transactional`.
*   A slow task blocks the single scheduler thread and delays every other `@Scheduled` method. Set `spring.task.scheduling.pool.size` when more than one job must run.

---

### 13.2 DevTools Restart Classloader

`spring-boot-devtools` (scope `runtime`, optional, excluded from the repackaged production JAR by the Boot plugin) installs two classloaders:

```
+--------------------------------------+
| Restart classloader                  |  your classes, recreated on a file change
|   (project classes)                  |
+--------------------------------------+
                 |
                 | child of
                 v
+--------------------------------------+
| Base classloader                     |  third-party JARs, kept across restarts
|   (dependencies)                     |
+--------------------------------------+
```

$$\text{classpath change} \rightarrow \text{discard restart classloader} \rightarrow \text{new ApplicationContext} \rightarrow \text{faster than a cold JVM start}$$

*   This is a context restart, not HotSpot hotswap. `@PostConstruct` runs again. In-memory H2 data disappears unless it lives outside the restarted context.
*   DevTools turns off template caches and enables the LiveReload server. Do not ship it: the plugin's default exclude list drops `spring-boot-devtools` from the fat JAR when it is marked optional.
*   Remote DevTools and automatic restart are development features. Leave them off on shared environments.

---

### 13.3 Actuator

`spring-boot-starter-actuator` exposes operational endpoints under `/actuator` (or a custom `management.endpoints.web.base-path`).

| Endpoint | Id | Default exposure on the web | What it tells you |
| :--- | :--- | :--- | :--- |
| Health | `health` | Yes. This is the only endpoint exposed over HTTP by default. Details stay hidden unless `show-details` allows them. | `UP` / `DOWN` from indicators: disk, DB, ping, custom. |
| Info | `info` | No. Enabled, but not exposed until listed in `exposure.include`. | Values from `info.*` and Git/build plugins. |
| Metrics | `metrics` | No. | Micrometer meters (JVM, HTTP, Hikari). |
| Loggers | `loggers` | No. | Read and change logger levels without a restart. |
| Env | `env` | No. | Property sources. Can reveal secrets — do not expose publicly. |
| Beans | `beans` | No. | The live bean list. Useful in lower environments. |
| Mappings | `mappings` | No. | Every MVC route. |

```properties
management.endpoints.web.exposure.include=health,info,metrics
management.endpoint.health.show-details=when_authorized
management.server.port=8081
```

*   Run management on a **second port** so the data plane (`8080`) and the operator plane (`8081`) can have different network policies. Scraping Prometheus and serving customers on the same public port is how internal endpoints leak.
*   A custom indicator:

```java
@Component
public class PaymentsHealthIndicator implements HealthIndicator {
    @Override
    public Health health() {
        boolean ok = probe();
        return ok ? Health.up().build() : Health.down().withDetail("payments", "unreachable").build();
    }
}
```

Boot enables `livenessState` and `readinessState` when `management.endpoint.health.probes.enabled=true`, and turns that on automatically if it detects Kubernetes. Point probes at `/actuator/health/liveness` and `/actuator/health/readiness`. Readiness should fail when the database is down. Liveness should fail only when the process is wedged and must be killed.

---

## Complete Quick Reference Guide

| Subject Area | Primary Annotations / Terms | Essential Core Concepts |
| :--- | :--- | :--- |
| **Project Setup** | `@SpringBootApplication`, `Jar`, `War` | Initializr configures standard project structure, embedded Tomcat, and dependencies. |
| **Architecture** | `@RestController`, `@Service`, `@Repository` | 3-Tier Layered Architecture isolates web, business logic, and persistence concerns. |
| **Maven POM** | `GAV`, `<parent>`, `<dependencies>`, `<plugins>` | Manages dependencies, inheritance, and build configurations. |
| **Maven Lifecycles** | `clean`, `compile`, `test`, `package`, `install` | Phased build lifecycle execution sequence. |
| **Controller Layer** | `@GetMapping`, `@PathVariable`, `@RequestParam`, `@RequestBody`, `@InitBinder` | Handles REST endpoints, maps payload parameters, and customizes binding. |
| **Response Types** | `ResponseEntity<T>`, `@ResponseBody` | Customizes body payloads, HTTP headers, and HTTP status codes. |
| **Beans & IoC** | `@Component`, `@Configuration`, `@Bean`, `@ComponentScan` | IoC container handles bean creation, component scanning, and dependency injection. |
| **Bean Lifecycle** | `@PostConstruct`, `@PreDestroy`, `@Lazy` | Lifecycle sequence: Instantiation $\rightarrow$ Injections $\rightarrow$ Init Callbacks $\rightarrow$ Active State $\rightarrow$ Destroy Callbacks. |
| **Dependency Injection** | Constructor injection, `@Qualifier`, `@Primary`, `@ConfigurationProperties` | Container supplies collaborators. One match by type; qualifier or `@Primary` when several beans exist. |
| **Bean Scopes** | `singleton`, `prototype`, `request`, `session`, scoped proxy | Scope controls instance count and lifetime. Inject request-scoped beans into singletons only through a proxy or `ObjectProvider`. |
| **Profiles & Config** | `@Profile`, `spring.profiles.active`, `Environment` | Profile files override base files. Command-line arguments override environment variables and files. |
| **Spring AOP** | `@Aspect`, `@Around`, `execution(...)`, proxy | Advice runs on the proxy. Self-invocation and `private` methods are not intercepted. |
| **Transactions** | `@Transactional`, `Propagation`, `rollbackFor`, isolation | Proxy starts the transaction. Unchecked exceptions roll back. Checked exceptions commit unless `rollbackFor` includes them. |
| **Async** | `@EnableAsync`, `@Async`, `TaskExecutor` | Work moves to a pool thread. Transaction, security context, and MDC do not follow unless you move them. |
| **Validation & Errors** | `@Valid`, `@Validated`, `@RestControllerAdvice`, `@ExceptionHandler` | Bean Validation runs only when triggered. Advice maps exceptions to status codes in one place. |
| **Spring Data JPA** | `@Entity`, `JpaRepository`, `FetchType.LAZY`, `mappedBy` | Persistence context tracks managed entities. Owning side holds the foreign key. Fetch associations explicitly when OSIV is off. |
| **Scheduling & Ops** | `@Scheduled`, DevTools, Actuator `health` | Cron uses six fields. DevTools restarts the context. Actuator health belongs on a separate management port. |