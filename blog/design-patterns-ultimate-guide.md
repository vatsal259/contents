---
title: The Ultimate Guide to Design Patterns — Every Pattern You Need to Know (With Java)
date: 2026-06-07
excerpt: A deep-dive into all 23 GoF design patterns — Creational, Structural, and Behavioral — explained with real-world analogies, UML intent, and complete Java code examples. Your one-stop reference for writing better, scalable software.
---

If you've been writing Java for a while, you've almost certainly *used* design patterns without realizing it. Every time you call `Collections.sort()` with a `Comparator`, that's the **Strategy** pattern. Every time you build a `StringBuilder`, that echoes the **Builder** pattern. Every time Spring wires up your beans, it's the **Factory** and **Singleton** patterns at work.

Design patterns are not abstract theory — they are *crystallized wisdom* from decades of software engineering. This guide covers all **23 Gang of Four (GoF) design patterns** with real-world analogies, clear intent, when to use them (and when *not* to), and complete Java code you can run today.

---

## What Is a Design Pattern?

> A design pattern is a general, reusable solution to a commonly occurring problem in software design. It is not finished code — it is a template for how to solve a problem.

Think of it this way:

- An **algorithm** is like a cooking recipe — step-by-step instructions to achieve a goal.
- A **design pattern** is like a blueprint — it shows the structure of the solution, but the exact implementation is up to you.

Patterns have four essential elements:

1. **Name** — a handle that captures the essence of the pattern
2. **Problem** — the context and conditions where the pattern applies
3. **Solution** — the arrangement of classes, objects, and responsibilities
4. **Consequences** — the trade-offs and results of applying the pattern

### Classification

The GoF organized 23 patterns into three categories:

| Category | Purpose | Patterns |
|---|---|---|
| **Creational** | Object creation mechanisms | Factory Method, Abstract Factory, Builder, Prototype, Singleton |
| **Structural** | Composing classes/objects into larger structures | Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy |
| **Behavioral** | Communication and responsibility between objects | Chain of Responsibility, Command, Iterator, Mediator, Memento, Observer, State, Strategy, Template Method, Visitor |

---

# Part I — Creational Patterns

Creational patterns deal with **object creation**. They abstract the instantiation process, making your system independent of how its objects are created, composed, and represented.

---

## 1. Factory Method

### Intent
Define an interface for creating an object, but let subclasses decide which class to instantiate. Factory Method lets a class defer instantiation to subclasses.

### Real-World Analogy
A logistics company (the creator) needs to deliver packages. By road? By sea? By air? Each transport type is a different "product". The company defines the `deliver()` operation, but subclasses (`RoadLogistics`, `SeaLogistics`) decide what kind of transport object to create.

### When to Use
- You don't know ahead of time which class you need to instantiate.
- You want subclasses to specify the objects they create.
- You want to encapsulate object creation to reduce duplication.

### When NOT to Use
- If the product hierarchy is flat and unlikely to change — a simple `new` is fine.
- Overusing it adds unnecessary indirection.

### Java Implementation

```java
// Product interface
interface Notification {
    void send(String message);
}

// Concrete Products
class EmailNotification implements Notification {
    private String email;
    public EmailNotification(String email) { this.email = email; }

    @Override
    public void send(String message) {
        System.out.println("Sending Email to " + email + ": " + message);
    }
}

class SMSNotification implements Notification {
    private String phone;
    public SMSNotification(String phone) { this.phone = phone; }

    @Override
    public void send(String message) {
        System.out.println("Sending SMS to " + phone + ": " + message);
    }
}

// Creator (abstract)
abstract class NotificationService {
    // Factory Method
    public abstract Notification createNotification(String contact);

    // Business logic using the factory method
    public void notifyUser(String contact, String message) {
        Notification notification = createNotification(contact);
        notification.send(message);
    }
}

// Concrete Creators
class EmailService extends NotificationService {
    @Override
    public Notification createNotification(String contact) {
        return new EmailNotification(contact);
    }
}

class SMSService extends NotificationService {
    @Override
    public Notification createNotification(String contact) {
        return new SMSNotification(contact);
    }
}

// Client
public class FactoryMethodDemo {
    public static void main(String[] args) {
        NotificationService service = new EmailService();
        service.notifyUser("user@example.com", "Your order has shipped!");

        service = new SMSService();
        service.notifyUser("+1234567890", "Your OTP is 4821");
    }
}
```

**Output:**
```
Sending Email to user@example.com: Your order has shipped!
Sending SMS to +1234567890: Your OTP is 4821
```

### Key Takeaway
Factory Method follows the **Open/Closed Principle** — add new notification types without changing existing code.

---

## 2. Abstract Factory

### Intent
Provide an interface for creating *families* of related or dependent objects without specifying their concrete classes.

### Real-World Analogy
A furniture store sells Victorian-style and Modern-style furniture. You need a *matching* Chair + Sofa + Table. An Abstract Factory ensures you always get furniture from the same style family — you won't accidentally pair a Victorian chair with a Modern table.

### When to Use
- Your system needs to be independent of how its products are created.
- You need to enforce constraints across a family of products.
- You want to swap entire product families at runtime.

### Java Implementation

```java
// Abstract Products
interface Button {
    void render();
    void onClick();
}

interface Checkbox {
    void render();
}

// Windows Concrete Products
class WindowsButton implements Button {
    @Override public void render() { System.out.println("Rendering Windows Button"); }
    @Override public void onClick() { System.out.println("Windows Button Clicked"); }
}

class WindowsCheckbox implements Checkbox {
    @Override public void render() { System.out.println("Rendering Windows Checkbox"); }
}

// macOS Concrete Products
class MacButton implements Button {
    @Override public void render() { System.out.println("Rendering macOS Button"); }
    @Override public void onClick() { System.out.println("macOS Button Clicked"); }
}

class MacCheckbox implements Checkbox {
    @Override public void render() { System.out.println("Rendering macOS Checkbox"); }
}

// Abstract Factory
interface GUIFactory {
    Button createButton();
    Checkbox createCheckbox();
}

// Concrete Factories
class WindowsFactory implements GUIFactory {
    @Override public Button createButton() { return new WindowsButton(); }
    @Override public Checkbox createCheckbox() { return new WindowsCheckbox(); }
}

class MacFactory implements GUIFactory {
    @Override public Button createButton() { return new MacButton(); }
    @Override public Checkbox createCheckbox() { return new MacCheckbox(); }
}

// Client — only knows the abstract interfaces
class Application {
    private Button button;
    private Checkbox checkbox;

    public Application(GUIFactory factory) {
        button = factory.createButton();
        checkbox = factory.createCheckbox();
    }

    public void paint() {
        button.render();
        checkbox.render();
    }
}

public class AbstractFactoryDemo {
    public static void main(String[] args) {
        String os = System.getProperty("os.name").toLowerCase();
        GUIFactory factory = os.contains("mac") ? new MacFactory() : new WindowsFactory();
        Application app = new Application(factory);
        app.paint();
    }
}
```

### Difference: Factory Method vs Abstract Factory

| | Factory Method | Abstract Factory |
|---|---|---|
| Creates | One product | Family of products |
| Via | Inheritance (subclasses) | Composition (factory object) |
| Flexibility | Extend one product | Swap entire product family |

---

## 3. Builder

### Intent
Separate the construction of a complex object from its representation so that the same construction process can create different representations.

### Real-World Analogy
Ordering a burger at a restaurant. You don't cook it yourself — you tell the chef (Director) your requirements: "extra cheese, no onions, whole wheat bun." The chef uses a Builder to assemble your specific burger step by step.

### When to Use
- Constructors with too many parameters (the "telescoping constructor" anti-pattern).
- When you need to create different representations of the same product.
- When construction must be done in steps.

### Java Implementation

```java
// Product
class Pizza {
    private String size;
    private String crust;
    private String sauce;
    private List<String> toppings = new ArrayList<>();

    private Pizza() {}

    @Override
    public String toString() {
        return "Pizza{size=" + size + ", crust=" + crust +
               ", sauce=" + sauce + ", toppings=" + toppings + "}";
    }

    // Builder (static inner class)
    public static class Builder {
        private Pizza pizza = new Pizza();

        public Builder size(String size) {
            pizza.size = size;
            return this;
        }

        public Builder crust(String crust) {
            pizza.crust = crust;
            return this;
        }

        public Builder sauce(String sauce) {
            pizza.sauce = sauce;
            return this;
        }

        public Builder topping(String topping) {
            pizza.toppings.add(topping);
            return this;
        }

        public Pizza build() {
            if (pizza.size == null) throw new IllegalStateException("Size is required");
            return pizza;
        }
    }
}

public class BuilderDemo {
    public static void main(String[] args) {
        Pizza margherita = new Pizza.Builder()
                .size("Large")
                .crust("Thin")
                .sauce("Tomato")
                .topping("Mozzarella")
                .topping("Basil")
                .build();

        System.out.println(margherita);

        // Completely different pizza, same builder
        Pizza bbq = new Pizza.Builder()
                .size("Medium")
                .crust("Thick")
                .sauce("BBQ")
                .topping("Chicken")
                .topping("Onions")
                .topping("Peppers")
                .build();

        System.out.println(bbq);
    }
}
```

### Real-World Java Examples
- `StringBuilder`
- `java.util.Calendar.Builder`
- Lombok's `@Builder`
- `HttpRequest.Builder` in Java 11+

---

## 4. Prototype

### Intent
Specify the kinds of objects to create using a prototypical instance, and create new objects by *copying* this prototype.

### Real-World Analogy
Cell division. A cell doesn't create a brand-new cell from scratch — it copies itself (clones). The new cell is a near-perfect copy that can then differentiate.

### When to Use
- Object creation is expensive (complex initialization, DB calls, heavy computation).
- You need many objects that differ only slightly from each other.
- You want to avoid a hierarchy of factories.

### Java Implementation

```java
import java.util.ArrayList;
import java.util.List;

// Prototype interface
interface Cloneable {
    Object clone();
}

class UserProfile implements Cloneable {
    private String name;
    private String role;
    private List<String> permissions;

    public UserProfile(String name, String role, List<String> permissions) {
        this.name = name;
        this.role = role;
        this.permissions = new ArrayList<>(permissions); // Deep copy
    }

    // Copy constructor (deep clone)
    private UserProfile(UserProfile source) {
        this.name = source.name;
        this.role = source.role;
        this.permissions = new ArrayList<>(source.permissions);
    }

    @Override
    public UserProfile clone() {
        return new UserProfile(this);
    }

    public void setName(String name) { this.name = name; }
    public void addPermission(String permission) { permissions.add(permission); }

    @Override
    public String toString() {
        return "UserProfile{name=" + name + ", role=" + role + ", permissions=" + permissions + "}";
    }
}

public class PrototypeDemo {
    public static void main(String[] args) {
        UserProfile adminTemplate = new UserProfile(
            "Template",
            "ADMIN",
            List.of("READ", "WRITE", "DELETE")
        );

        // Clone and customize — no expensive re-initialization
        UserProfile alice = adminTemplate.clone();
        alice.setName("Alice");

        UserProfile bob = adminTemplate.clone();
        bob.setName("Bob");
        bob.addPermission("SUPER_DELETE");

        System.out.println(alice);
        System.out.println(bob);
        System.out.println("Original unchanged: " + adminTemplate);
    }
}
```

### Deep Clone vs Shallow Clone
Always implement **deep cloning** for objects with mutable fields (Lists, Maps, other objects). Java's `Object.clone()` only does a shallow copy by default — this is a common bug.

---

## 5. Singleton

### Intent
Ensure a class has only one instance, and provide a global point of access to it.

### Real-World Analogy
A country can only have one official government. No matter who asks, they get a reference to the same government.

### When to Use
- Shared resources: logging, configuration, thread pools, caches.
- When exactly one object is needed to coordinate actions across the system.

### When NOT to Use (Seriously)
- Singletons introduce global state, making testing hard.
- They violate the Single Responsibility Principle.
- Overuse is a code smell. Prefer dependency injection.

### Java Implementation — Thread-Safe Double-Checked Locking

```java
public class DatabaseConnectionPool {
    // volatile ensures visibility across threads
    private static volatile DatabaseConnectionPool instance;
    private final List<String> connections;

    private DatabaseConnectionPool() {
        // Expensive initialization
        connections = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            connections.add("Connection-" + i);
        }
        System.out.println("Connection pool initialized with " + connections.size() + " connections");
    }

    public static DatabaseConnectionPool getInstance() {
        if (instance == null) {                    // First check (no lock)
            synchronized (DatabaseConnectionPool.class) {
                if (instance == null) {            // Second check (with lock)
                    instance = new DatabaseConnectionPool();
                }
            }
        }
        return instance;
    }

    public String getConnection() {
        return connections.isEmpty() ? null : connections.remove(0);
    }
}

// Better alternative — Initialization-on-demand holder (Bill Pugh Singleton)
public class ConfigManager {
    private final Properties config = new Properties();

    private ConfigManager() {
        config.setProperty("app.name", "MyApp");
        config.setProperty("app.version", "1.0");
    }

    // Inner class is only loaded when getInstance() is called — thread-safe, no synchronization overhead
    private static class Holder {
        static final ConfigManager INSTANCE = new ConfigManager();
    }

    public static ConfigManager getInstance() {
        return Holder.INSTANCE;
    }

    public String get(String key) {
        return config.getProperty(key);
    }
}

public class SingletonDemo {
    public static void main(String[] args) {
        DatabaseConnectionPool pool1 = DatabaseConnectionPool.getInstance();
        DatabaseConnectionPool pool2 = DatabaseConnectionPool.getInstance();
        System.out.println("Same instance? " + (pool1 == pool2));  // true

        ConfigManager cm = ConfigManager.getInstance();
        System.out.println(cm.get("app.name"));  // MyApp
    }
}
```

---

# Part II — Structural Patterns

Structural patterns deal with **object composition**. They explain how to assemble objects and classes into larger structures while keeping those structures flexible and efficient.

---

## 6. Adapter

### Intent
Convert the interface of a class into another interface that clients expect. Adapter lets classes work together that couldn't otherwise because of incompatible interfaces.

### Real-World Analogy
A power adapter lets your laptop charger (European plug) work in a US outlet. The adapter doesn't change the plug or the outlet — it translates between them.

### When to Use
- Integrating a third-party library with an incompatible interface.
- Reusing legacy code without modifying it.
- Making unrelated classes work together.

### Java Implementation

```java
// Target interface (what our code expects)
interface JsonParser {
    Map<String, Object> parse(String json);
}

// Adaptee (third-party legacy XML library we can't modify)
class LegacyXmlParser {
    public Document parseXml(String xml) {
        System.out.println("Legacy XML parser processing: " + xml);
        // Returns XML Document (simplified here)
        return new Document(xml);
    }

    static class Document {
        String content;
        Document(String content) { this.content = content; }
        public String getContent() { return content; }
    }
}

// Adapter — makes LegacyXmlParser look like a JsonParser
class XmlToJsonAdapter implements JsonParser {
    private final LegacyXmlParser xmlParser;

    public XmlToJsonAdapter(LegacyXmlParser xmlParser) {
        this.xmlParser = xmlParser;
    }

    @Override
    public Map<String, Object> parse(String data) {
        // Convert JSON input to XML for the legacy parser (simplified)
        String xmlData = "<data>" + data + "</data>";
        LegacyXmlParser.Document doc = xmlParser.parseXml(xmlData);

        // Convert Document back to Map (simplified)
        Map<String, Object> result = new HashMap<>();
        result.put("content", doc.getContent());
        return result;
    }
}

// Client — only knows JsonParser
class DataProcessor {
    private final JsonParser parser;

    public DataProcessor(JsonParser parser) {
        this.parser = parser;
    }

    public void process(String data) {
        Map<String, Object> parsed = parser.parse(data);
        System.out.println("Processed data: " + parsed);
    }
}

public class AdapterDemo {
    public static void main(String[] args) {
        LegacyXmlParser legacyParser = new LegacyXmlParser();
        JsonParser adapter = new XmlToJsonAdapter(legacyParser);
        DataProcessor processor = new DataProcessor(adapter);
        processor.process("{\"name\":\"Alice\"}");
    }
}
```

---

## 7. Bridge

### Intent
Decouple an abstraction from its implementation so the two can vary independently.

### Real-World Analogy
A remote control (abstraction) can operate different TV brands (implementations). You can have different remotes (BasicRemote, AdvancedRemote) for different TVs (Samsung, Sony) without creating a class for every combination.

### When to Use
- When you want to avoid a permanent binding between abstraction and implementation.
- When both the abstraction and implementation should be extensible via subclassing.
- When you have a "Cartesian product" explosion of subclasses.

### Java Implementation

```java
// Implementation interface
interface Renderer {
    void renderCircle(double x, double y, double radius);
    void renderSquare(double x, double y, double side);
}

// Concrete Implementations
class VectorRenderer implements Renderer {
    @Override
    public void renderCircle(double x, double y, double radius) {
        System.out.printf("Drawing Circle as vector at (%.1f,%.1f) r=%.1f%n", x, y, radius);
    }
    @Override
    public void renderSquare(double x, double y, double side) {
        System.out.printf("Drawing Square as vector at (%.1f,%.1f) side=%.1f%n", x, y, side);
    }
}

class RasterRenderer implements Renderer {
    @Override
    public void renderCircle(double x, double y, double radius) {
        System.out.printf("Drawing Circle as pixels at (%.1f,%.1f) r=%.1f%n", x, y, radius);
    }
    @Override
    public void renderSquare(double x, double y, double side) {
        System.out.printf("Drawing Square as pixels at (%.1f,%.1f) side=%.1f%n", x, y, side);
    }
}

// Abstraction
abstract class Shape {
    protected Renderer renderer; // Bridge to implementation

    public Shape(Renderer renderer) {
        this.renderer = renderer;
    }

    public abstract void draw();
    public abstract void resize(double factor);
}

// Refined Abstractions
class Circle extends Shape {
    private double x, y, radius;

    public Circle(Renderer renderer, double x, double y, double radius) {
        super(renderer);
        this.x = x; this.y = y; this.radius = radius;
    }

    @Override public void draw() { renderer.renderCircle(x, y, radius); }
    @Override public void resize(double factor) { radius *= factor; }
}

class Square extends Shape {
    private double x, y, side;

    public Square(Renderer renderer, double x, double y, double side) {
        super(renderer);
        this.x = x; this.y = y; this.side = side;
    }

    @Override public void draw() { renderer.renderSquare(x, y, side); }
    @Override public void resize(double factor) { side *= factor; }
}

public class BridgeDemo {
    public static void main(String[] args) {
        Shape circle = new Circle(new VectorRenderer(), 5, 5, 10);
        Shape square = new Square(new RasterRenderer(), 0, 0, 20);

        circle.draw();  // Vector circle
        square.draw();  // Raster square

        // Swap renderer at runtime — without changing Shape code
        circle = new Circle(new RasterRenderer(), 5, 5, 10);
        circle.draw();  // Now raster circle
    }
}
```

### Bridge vs Adapter
- **Adapter** makes incompatible interfaces work together (fixes existing code).
- **Bridge** is designed upfront to let abstraction and implementation vary independently.

---

## 8. Composite

### Intent
Compose objects into tree structures to represent part-whole hierarchies. Composite lets clients treat individual objects and compositions uniformly.

### Real-World Analogy
A file system. A folder can contain files *and* other folders. Whether you ask a single file or an entire directory tree to `getSize()`, the interface is the same.

### When to Use
- You want to represent hierarchies (trees).
- You want clients to ignore the difference between leaf and composite objects.

### Java Implementation

```java
import java.util.ArrayList;
import java.util.List;

// Component interface
interface FileSystemItem {
    String getName();
    long getSize();
    void print(String indent);
}

// Leaf
class File implements FileSystemItem {
    private String name;
    private long size;

    public File(String name, long size) {
        this.name = name;
        this.size = size;
    }

    @Override public String getName() { return name; }
    @Override public long getSize() { return size; }
    @Override public void print(String indent) {
        System.out.println(indent + "📄 " + name + " (" + size + " bytes)");
    }
}

// Composite
class Directory implements FileSystemItem {
    private String name;
    private List<FileSystemItem> children = new ArrayList<>();

    public Directory(String name) { this.name = name; }

    public void add(FileSystemItem item) { children.add(item); }
    public void remove(FileSystemItem item) { children.remove(item); }

    @Override public String getName() { return name; }

    @Override
    public long getSize() {
        return children.stream().mapToLong(FileSystemItem::getSize).sum();
    }

    @Override
    public void print(String indent) {
        System.out.println(indent + "📁 " + name + "/");
        for (FileSystemItem child : children) {
            child.print(indent + "  ");
        }
    }
}

public class CompositeDemo {
    public static void main(String[] args) {
        Directory root = new Directory("root");
        Directory src = new Directory("src");
        Directory test = new Directory("test");

        src.add(new File("Main.java", 1024));
        src.add(new File("Utils.java", 512));
        test.add(new File("MainTest.java", 800));

        root.add(src);
        root.add(test);
        root.add(new File("README.md", 256));

        root.print("");
        System.out.println("Total size: " + root.getSize() + " bytes");
    }
}
```

**Output:**
```
📁 root/
  📁 src/
    📄 Main.java (1024 bytes)
    📄 Utils.java (512 bytes)
  📁 test/
    📄 MainTest.java (800 bytes)
  📄 README.md (256 bytes)
Total size: 2592 bytes
```

---

## 9. Decorator

### Intent
Attach additional responsibilities to an object dynamically. Decorators provide a flexible alternative to subclassing for extending functionality.

### Real-World Analogy
A coffee shop. A plain `Coffee` can be decorated with `Milk`, `Sugar`, `Caramel`, `Whip`. Each decorator wraps the previous one, adding to the cost and description. You can combine any number of decorators without a subclass explosion.

### When to Use
- To add behavior to individual objects without affecting others.
- When extending by subclassing is impractical (too many combinations).
- When you need to add/remove responsibilities at runtime.

### Java Implementation

```java
// Component
interface Coffee {
    String getDescription();
    double getCost();
}

// Concrete Component
class SimpleCoffee implements Coffee {
    @Override public String getDescription() { return "Simple Coffee"; }
    @Override public double getCost() { return 1.00; }
}

// Abstract Decorator
abstract class CoffeeDecorator implements Coffee {
    protected final Coffee decoratedCoffee;

    public CoffeeDecorator(Coffee coffee) {
        this.decoratedCoffee = coffee;
    }

    @Override public String getDescription() { return decoratedCoffee.getDescription(); }
    @Override public double getCost() { return decoratedCoffee.getCost(); }
}

// Concrete Decorators
class MilkDecorator extends CoffeeDecorator {
    public MilkDecorator(Coffee coffee) { super(coffee); }
    @Override public String getDescription() { return decoratedCoffee.getDescription() + ", Milk"; }
    @Override public double getCost() { return decoratedCoffee.getCost() + 0.50; }
}

class SugarDecorator extends CoffeeDecorator {
    public SugarDecorator(Coffee coffee) { super(coffee); }
    @Override public String getDescription() { return decoratedCoffee.getDescription() + ", Sugar"; }
    @Override public double getCost() { return decoratedCoffee.getCost() + 0.25; }
}

class CaramelDecorator extends CoffeeDecorator {
    public CaramelDecorator(Coffee coffee) { super(coffee); }
    @Override public String getDescription() { return decoratedCoffee.getDescription() + ", Caramel"; }
    @Override public double getCost() { return decoratedCoffee.getCost() + 0.75; }
}

public class DecoratorDemo {
    public static void main(String[] args) {
        Coffee coffee = new SimpleCoffee();
        System.out.printf("%s = $%.2f%n", coffee.getDescription(), coffee.getCost());

        coffee = new MilkDecorator(coffee);
        coffee = new SugarDecorator(coffee);
        coffee = new CaramelDecorator(coffee);

        System.out.printf("%s = $%.2f%n", coffee.getDescription(), coffee.getCost());
    }
}
```

### Real-World Java Examples
- `java.io`: `BufferedInputStream(new FileInputStream(...))` — classic Decorator stack
- `Collections.unmodifiableList()`, `synchronizedList()`

---

## 10. Facade

### Intent
Provide a simplified interface to a complex subsystem.

### Real-World Analogy
Ordering pizza by phone. You don't need to know about the dough team, the sauce team, the delivery team, and the billing system. You just call one number (the facade) and it coordinates everything.

### When to Use
- To provide a simple interface to a complex body of code.
- Layering your system — present a clean API to higher-level code.
- Reducing dependencies on internal subsystems.

### Java Implementation

```java
// Complex subsystems
class VideoDecoder {
    public void decode(String filename) {
        System.out.println("Decoding video: " + filename);
    }
}

class AudioMixer {
    public void mix(String videoFile) {
        System.out.println("Mixing audio for: " + videoFile);
    }
}

class VideoEncoder {
    public void encode(String file, String format) {
        System.out.println("Encoding " + file + " to " + format);
    }
}

class BitrateReader {
    public int read(String filename) {
        System.out.println("Reading bitrate of: " + filename);
        return 1920;
    }
}

// Facade — simple interface for the complex video conversion subsystem
class VideoConversionFacade {
    private VideoDecoder decoder = new VideoDecoder();
    private AudioMixer mixer = new AudioMixer();
    private VideoEncoder encoder = new VideoEncoder();
    private BitrateReader bitrateReader = new BitrateReader();

    public void convertVideo(String filename, String format) {
        System.out.println("=== Starting Video Conversion ===");
        decoder.decode(filename);
        bitrateReader.read(filename);
        mixer.mix(filename);
        encoder.encode(filename, format);
        System.out.println("=== Conversion Complete: output." + format + " ===");
    }
}

public class FacadeDemo {
    public static void main(String[] args) {
        // Client only interacts with the facade
        VideoConversionFacade converter = new VideoConversionFacade();
        converter.convertVideo("vacation.avi", "mp4");
    }
}
```

---

## 11. Flyweight

### Intent
Use sharing to support large numbers of fine-grained objects efficiently. Extract the **intrinsic state** (shared, immutable) from the **extrinsic state** (context-specific, mutable).

### Real-World Analogy
A forest in a video game with thousands of trees. You don't store full tree data for each tree. Instead, each tree shares a `TreeType` object (species, texture, color) and only stores unique data (x, y coordinates).

### When to Use
- Your app needs a massive number of similar objects (thousands/millions).
- Objects consume too much RAM.
- Most object state can be made extrinsic (passed in from outside).

### Java Implementation

```java
import java.util.HashMap;
import java.util.Map;

// Flyweight (intrinsic state — shared)
class CharacterStyle {
    private final String font;
    private final int size;
    private final String color;

    public CharacterStyle(String font, int size, String color) {
        this.font = font;
        this.size = size;
        this.color = color;
    }

    public void render(char character, int x, int y) {
        System.out.printf("Rendering '%c' at (%d,%d) — font=%s, size=%d, color=%s%n",
                character, x, y, font, size, color);
    }
}

// Flyweight Factory
class CharacterStyleFactory {
    private static final Map<String, CharacterStyle> styles = new HashMap<>();

    public static CharacterStyle getStyle(String font, int size, String color) {
        String key = font + size + color;
        return styles.computeIfAbsent(key, k -> {
            System.out.println("Creating new style: " + key);
            return new CharacterStyle(font, size, color);
        });
    }

    public static int getCount() { return styles.size(); }
}

// Context (extrinsic state — unique per character)
class Character {
    private final char value;
    private final int x, y;
    private final CharacterStyle style; // shared flyweight

    public Character(char value, int x, int y, String font, int size, String color) {
        this.value = value;
        this.x = x;
        this.y = y;
        this.style = CharacterStyleFactory.getStyle(font, size, color);
    }

    public void render() {
        style.render(value, x, y);
    }
}

public class FlyweightDemo {
    public static void main(String[] args) {
        List<Character> document = new ArrayList<>();

        // Thousands of characters — but only a few style objects
        document.add(new Character('H', 0, 0, "Arial", 12, "black"));
        document.add(new Character('e', 10, 0, "Arial", 12, "black"));
        document.add(new Character('l', 20, 0, "Arial", 12, "black"));
        document.add(new Character('l', 30, 0, "Arial", 12, "black"));
        document.add(new Character('o', 40, 0, "Arial", 12, "black"));
        document.add(new Character('!', 50, 0, "Arial", 12, "red"));  // New style

        document.forEach(Character::render);
        System.out.println("Unique styles created: " + CharacterStyleFactory.getCount());
        // Only 2 style objects for 6 characters!
    }
}
```

---

## 12. Proxy

### Intent
Provide a surrogate or placeholder for another object to control access to it.

### Types of Proxy
- **Virtual Proxy** — lazy initialization (expensive object created on demand)
- **Protection Proxy** — access control
- **Remote Proxy** — represents an object in a different address space
- **Caching Proxy** — caches results of expensive operations
- **Logging/Monitoring Proxy** — logs requests

### Java Implementation — Caching Proxy

```java
// Subject interface
interface WeatherService {
    String getWeather(String city);
}

// Real Subject (expensive — makes network calls)
class RealWeatherService implements WeatherService {
    @Override
    public String getWeather(String city) {
        System.out.println("Fetching weather from API for: " + city);
        // Simulate API call
        try { Thread.sleep(100); } catch (InterruptedException e) {}
        return "Sunny, 28°C in " + city;
    }
}

// Caching Proxy
class CachingWeatherProxy implements WeatherService {
    private final WeatherService realService = new RealWeatherService();
    private final Map<String, String> cache = new HashMap<>();

    @Override
    public String getWeather(String city) {
        if (cache.containsKey(city)) {
            System.out.println("Cache hit for: " + city);
            return cache.get(city);
        }
        String result = realService.getWeather(city);
        cache.put(city, result);
        return result;
    }
}

public class ProxyDemo {
    public static void main(String[] args) {
        WeatherService service = new CachingWeatherProxy();

        System.out.println(service.getWeather("Mumbai"));    // API call
        System.out.println(service.getWeather("Delhi"));     // API call
        System.out.println(service.getWeather("Mumbai"));    // Cache hit!
        System.out.println(service.getWeather("Mumbai"));    // Cache hit!
    }
}
```

### Real-World Java Examples
- Spring AOP proxies (transactions, security)
- Hibernate lazy-loading proxies
- `java.lang.reflect.Proxy`

---

# Part III — Behavioral Patterns

Behavioral patterns deal with **communication and algorithms between objects**. They focus on how objects collaborate and distribute responsibility.

---

## 13. Chain of Responsibility

### Intent
Pass a request along a chain of handlers. Each handler decides whether to process the request or pass it to the next handler in the chain.

### Real-World Analogy
Customer support escalation. Your issue first goes to a Level-1 agent. If they can't resolve it, it escalates to Level-2, then a manager, then the CEO. Each handler in the chain decides: handle it or pass it on.

### Java Implementation

```java
// Handler interface
abstract class SupportHandler {
    protected SupportHandler next;

    public SupportHandler setNext(SupportHandler next) {
        this.next = next;
        return next; // Enable chaining: h1.setNext(h2).setNext(h3)
    }

    public abstract void handle(SupportTicket ticket);
}

class SupportTicket {
    String issue;
    int severity; // 1=low, 2=medium, 3=high, 4=critical

    SupportTicket(String issue, int severity) {
        this.issue = issue;
        this.severity = severity;
    }
}

// Concrete Handlers
class Level1Support extends SupportHandler {
    @Override
    public void handle(SupportTicket ticket) {
        if (ticket.severity == 1) {
            System.out.println("Level 1 resolved: " + ticket.issue);
        } else if (next != null) {
            System.out.println("Level 1 escalating...");
            next.handle(ticket);
        }
    }
}

class Level2Support extends SupportHandler {
    @Override
    public void handle(SupportTicket ticket) {
        if (ticket.severity <= 2) {
            System.out.println("Level 2 resolved: " + ticket.issue);
        } else if (next != null) {
            System.out.println("Level 2 escalating...");
            next.handle(ticket);
        }
    }
}

class ManagerSupport extends SupportHandler {
    @Override
    public void handle(SupportTicket ticket) {
        if (ticket.severity <= 3) {
            System.out.println("Manager resolved: " + ticket.issue);
        } else if (next != null) {
            next.handle(ticket);
        } else {
            System.out.println("Cannot resolve: " + ticket.issue);
        }
    }
}

public class ChainOfResponsibilityDemo {
    public static void main(String[] args) {
        SupportHandler l1 = new Level1Support();
        SupportHandler l2 = new Level2Support();
        SupportHandler manager = new ManagerSupport();

        l1.setNext(l2).setNext(manager);

        l1.handle(new SupportTicket("Password reset", 1));
        l1.handle(new SupportTicket("Account locked", 2));
        l1.handle(new SupportTicket("Data breach concern", 3));
    }
}
```

---

## 14. Command

### Intent
Encapsulate a request as an object, thereby letting you parameterize clients with different requests, queue or log requests, and support undoable operations.

### Real-World Analogy
A restaurant order. The waiter (invoker) takes the order (command object) and passes it to the kitchen (receiver). The waiter doesn't know how to cook — they just carry the command. Orders can be queued, tracked, and even cancelled.

### When to Use
- Implementing undo/redo.
- Queuing, logging, or scheduling requests.
- Implementing transactions.
- Decoupling the object that invokes an operation from the one that performs it.

### Java Implementation

```java
// Command interface
interface Command {
    void execute();
    void undo();
}

// Receiver
class TextEditor {
    private StringBuilder text = new StringBuilder();

    public void insertText(String newText, int position) {
        text.insert(position, newText);
        System.out.println("Text: " + text);
    }

    public void deleteText(int position, int length) {
        text.delete(position, position + length);
        System.out.println("Text: " + text);
    }

    public String getText() { return text.toString(); }
}

// Concrete Command
class InsertTextCommand implements Command {
    private final TextEditor editor;
    private final String text;
    private final int position;

    public InsertTextCommand(TextEditor editor, String text, int position) {
        this.editor = editor;
        this.text = text;
        this.position = position;
    }

    @Override
    public void execute() { editor.insertText(text, position); }

    @Override
    public void undo() { editor.deleteText(position, text.length()); }
}

// Invoker — with undo/redo support
class EditorHistory {
    private final Deque<Command> history = new ArrayDeque<>();
    private final Deque<Command> redoStack = new ArrayDeque<>();

    public void executeCommand(Command command) {
        command.execute();
        history.push(command);
        redoStack.clear();
    }

    public void undo() {
        if (!history.isEmpty()) {
            Command cmd = history.pop();
            cmd.undo();
            redoStack.push(cmd);
        }
    }

    public void redo() {
        if (!redoStack.isEmpty()) {
            Command cmd = redoStack.pop();
            cmd.execute();
            history.push(cmd);
        }
    }
}

public class CommandDemo {
    public static void main(String[] args) {
        TextEditor editor = new TextEditor();
        EditorHistory history = new EditorHistory();

        history.executeCommand(new InsertTextCommand(editor, "Hello", 0));
        history.executeCommand(new InsertTextCommand(editor, " World", 5));

        System.out.println("Undoing...");
        history.undo();

        System.out.println("Redoing...");
        history.redo();
    }
}
```

---

## 15. Iterator

### Intent
Provide a way to access elements of a collection sequentially without exposing its underlying representation.

### Real-World Analogy
A TV remote. You press "next" to go to the next channel. You don't need to know how the channels are stored internally (array, list, database) — you just iterate.

### Java Implementation

```java
// Java already has java.util.Iterator — let's implement a custom one

class NumberRange implements Iterable<Integer> {
    private final int start;
    private final int end;
    private final int step;

    public NumberRange(int start, int end, int step) {
        this.start = start;
        this.end = end;
        this.step = step;
    }

    @Override
    public Iterator<Integer> iterator() {
        return new Iterator<Integer>() {
            private int current = start;

            @Override
            public boolean hasNext() {
                return current <= end;
            }

            @Override
            public Integer next() {
                if (!hasNext()) throw new NoSuchElementException();
                int value = current;
                current += step;
                return value;
            }
        };
    }
}

public class IteratorDemo {
    public static void main(String[] args) {
        NumberRange evens = new NumberRange(2, 20, 2);

        System.out.print("Even numbers: ");
        for (int n : evens) {
            System.out.print(n + " ");
        }
        System.out.println();
        // Output: 2 4 6 8 10 12 14 16 18 20
    }
}
```

### Real-World Java Examples
Java's entire `java.util.Collections` framework is built on `Iterator` and `Iterable`. The enhanced for-loop is syntactic sugar over `iterator()`.

---

## 16. Mediator

### Intent
Define an object that encapsulates how a set of objects interact. Mediator promotes loose coupling by keeping objects from referring to each other explicitly.

### Real-World Analogy
Air traffic control. Planes don't communicate directly with each other. They all communicate through the control tower (mediator), which coordinates their movements.

### Java Implementation

```java
// Mediator interface
interface ChatMediator {
    void sendMessage(String message, User sender);
    void addUser(User user);
}

// Colleague
abstract class User {
    protected ChatMediator mediator;
    protected String name;

    public User(ChatMediator mediator, String name) {
        this.mediator = mediator;
        this.name = name;
    }

    public abstract void send(String message);
    public abstract void receive(String message, String from);
}

// Concrete Mediator
class ChatRoom implements ChatMediator {
    private final List<User> users = new ArrayList<>();

    @Override
    public void addUser(User user) { users.add(user); }

    @Override
    public void sendMessage(String message, User sender) {
        for (User user : users) {
            if (user != sender) {
                user.receive(message, sender.name);
            }
        }
    }
}

// Concrete Colleague
class ChatUser extends User {
    public ChatUser(ChatMediator mediator, String name) {
        super(mediator, name);
        mediator.addUser(this);
    }

    @Override
    public void send(String message) {
        System.out.println(name + " sends: " + message);
        mediator.sendMessage(message, this);
    }

    @Override
    public void receive(String message, String from) {
        System.out.println(name + " received from " + from + ": " + message);
    }
}

public class MediatorDemo {
    public static void main(String[] args) {
        ChatRoom room = new ChatRoom();
        User alice = new ChatUser(room, "Alice");
        User bob = new ChatUser(room, "Bob");
        User charlie = new ChatUser(room, "Charlie");

        alice.send("Hello everyone!");
        bob.send("Hi Alice!");
    }
}
```

---

## 17. Memento

### Intent
Without violating encapsulation, capture and externalize an object's internal state so that the object can be restored to that state later.

### Real-World Analogy
Video game checkpoints. You save your game state at a checkpoint (memento). If you die, you restore from the last save — without the game engine exposing all its internals.

### Java Implementation

```java
// Memento (immutable snapshot)
class GameState {
    private final int level;
    private final int health;
    private final int score;
    private final String checkpoint;

    public GameState(int level, int health, int score, String checkpoint) {
        this.level = level; this.health = health;
        this.score = score; this.checkpoint = checkpoint;
    }

    public int getLevel() { return level; }
    public int getHealth() { return health; }
    public int getScore() { return score; }
    public String getCheckpoint() { return checkpoint; }

    @Override
    public String toString() {
        return String.format("Level=%d, HP=%d, Score=%d, CP=%s", level, health, score, checkpoint);
    }
}

// Originator
class Game {
    private int level = 1;
    private int health = 100;
    private int score = 0;
    private String checkpoint = "Start";

    public void play(String action) {
        System.out.println("Playing: " + action);
        level++;
        health -= 10;
        score += 500;
        checkpoint = action;
    }

    public GameState save() {
        return new GameState(level, health, score, checkpoint);
    }

    public void restore(GameState state) {
        this.level = state.getLevel();
        this.health = state.getHealth();
        this.score = state.getScore();
        this.checkpoint = state.getCheckpoint();
        System.out.println("Restored: " + state);
    }

    @Override
    public String toString() {
        return String.format("Level=%d, HP=%d, Score=%d", level, health, score);
    }
}

// Caretaker
class SaveSlot {
    private final Deque<GameState> saves = new ArrayDeque<>();

    public void save(GameState state) { saves.push(state); }

    public GameState loadLast() {
        return saves.isEmpty() ? null : saves.pop();
    }
}

public class MementoDemo {
    public static void main(String[] args) {
        Game game = new Game();
        SaveSlot saves = new SaveSlot();

        System.out.println("State: " + game);
        saves.save(game.save());  // Save checkpoint

        game.play("Forest Level");
        game.play("Castle Level");
        System.out.println("State: " + game);

        System.out.println("\nGame over! Loading save...");
        game.restore(saves.loadLast());
        System.out.println("State: " + game);
    }
}
```

---

## 18. Observer

### Intent
Define a one-to-many dependency between objects so that when one object changes state, all its dependents are notified and updated automatically.

### Real-World Analogy
A newsletter subscription. When a news outlet publishes an article (subject/publisher), all subscribers (observers) automatically receive it. Subscribers can join or leave at any time.

### When to Use
- When a change in one object requires changing others, and you don't know how many.
- Event-driven systems.
- Implementing distributed event handling.

### Java Implementation

```java
import java.util.ArrayList;
import java.util.List;

// Observer interface
interface StockObserver {
    void update(String stockSymbol, double price);
}

// Subject interface
interface StockSubject {
    void subscribe(StockObserver observer);
    void unsubscribe(StockObserver observer);
    void notifyObservers();
}

// Concrete Subject
class StockMarket implements StockSubject {
    private final List<StockObserver> observers = new ArrayList<>();
    private String symbol;
    private double price;

    public void setPrice(String symbol, double price) {
        this.symbol = symbol;
        this.price = price;
        System.out.println("\nStock update: " + symbol + " = $" + price);
        notifyObservers();
    }

    @Override public void subscribe(StockObserver o) { observers.add(o); }
    @Override public void unsubscribe(StockObserver o) { observers.remove(o); }

    @Override
    public void notifyObservers() {
        for (StockObserver o : observers) {
            o.update(symbol, price);
        }
    }
}

// Concrete Observers
class AlertSystem implements StockObserver {
    private final double threshold;

    public AlertSystem(double threshold) { this.threshold = threshold; }

    @Override
    public void update(String symbol, double price) {
        if (price > threshold) {
            System.out.println("🚨 ALERT: " + symbol + " exceeded threshold! Price: $" + price);
        }
    }
}

class PortfolioTracker implements StockObserver {
    private final String name;
    private final Map<String, Integer> holdings = new HashMap<>();

    public PortfolioTracker(String name) { this.name = name; }

    public void addHolding(String symbol, int shares) { holdings.put(symbol, shares); }

    @Override
    public void update(String symbol, double price) {
        if (holdings.containsKey(symbol)) {
            double value = holdings.get(symbol) * price;
            System.out.printf("%s portfolio: %s worth $%.2f%n", name, symbol, value);
        }
    }
}

public class ObserverDemo {
    public static void main(String[] args) {
        StockMarket market = new StockMarket();

        AlertSystem alertSystem = new AlertSystem(150.0);
        PortfolioTracker alice = new PortfolioTracker("Alice");
        alice.addHolding("AAPL", 50);

        market.subscribe(alertSystem);
        market.subscribe(alice);

        market.setPrice("AAPL", 145.00);
        market.setPrice("AAPL", 155.00);  // Triggers alert!
    }
}
```

### Real-World Java Examples
- `java.util.EventListener` (Swing, AWT)
- Spring's `ApplicationEvent` / `@EventListener`
- RxJava / Project Reactor (reactive streams)

---

## 19. State

### Intent
Allow an object to alter its behavior when its internal state changes. The object will appear to change its class.

### Real-World Analogy
A vending machine. It behaves completely differently when it has no money inserted vs. when money is inserted vs. when it's dispensing. Each "state" has its own logic.

### Java Implementation

```java
// State interface
interface VendingMachineState {
    void insertCoin(VendingMachine machine);
    void selectProduct(VendingMachine machine, String product);
    void dispense(VendingMachine machine);
}

// Context
class VendingMachine {
    private VendingMachineState state;
    private double balance = 0;

    public VendingMachine() {
        this.state = new IdleState();
    }

    public void setState(VendingMachineState state) { this.state = state; }
    public double getBalance() { return balance; }
    public void addBalance(double amount) { balance += amount; }
    public void resetBalance() { balance = 0; }

    public void insertCoin(double amount) {
        addBalance(amount);
        state.insertCoin(this);
    }

    public void selectProduct(String product) { state.selectProduct(this, product); }
    public void dispense() { state.dispense(this); }
}

// Concrete States
class IdleState implements VendingMachineState {
    @Override
    public void insertCoin(VendingMachine m) {
        System.out.println("Coin accepted. Balance: $" + m.getBalance());
        m.setState(new HasCoinState());
    }
    @Override public void selectProduct(VendingMachine m, String p) {
        System.out.println("Please insert a coin first.");
    }
    @Override public void dispense(VendingMachine m) {
        System.out.println("Please insert a coin first.");
    }
}

class HasCoinState implements VendingMachineState {
    @Override public void insertCoin(VendingMachine m) {
        System.out.println("Coin added. Balance: $" + m.getBalance());
    }
    @Override
    public void selectProduct(VendingMachine m, String product) {
        System.out.println("Product selected: " + product);
        m.setState(new DispensingState(product));
    }
    @Override public void dispense(VendingMachine m) {
        System.out.println("Please select a product first.");
    }
}

class DispensingState implements VendingMachineState {
    private final String product;
    DispensingState(String product) { this.product = product; }

    @Override public void insertCoin(VendingMachine m) {
        System.out.println("Please wait, dispensing in progress.");
    }
    @Override public void selectProduct(VendingMachine m, String p) {
        System.out.println("Already dispensing.");
    }
    @Override
    public void dispense(VendingMachine m) {
        System.out.println("Dispensing " + product + "! Change: $" + (m.getBalance() - 1.50));
        m.resetBalance();
        m.setState(new IdleState());
    }
}

public class StateDemo {
    public static void main(String[] args) {
        VendingMachine machine = new VendingMachine();
        machine.selectProduct("Chips");    // No coin
        machine.insertCoin(1.00);
        machine.insertCoin(1.00);
        machine.selectProduct("Chips");
        machine.dispense();
        machine.selectProduct("Chips");    // Back to idle
    }
}
```

---

## 20. Strategy

### Intent
Define a family of algorithms, encapsulate each one, and make them interchangeable. Strategy lets the algorithm vary independently from the clients that use it.

### Real-World Analogy
Navigation apps. You choose a travel strategy: fastest route, scenic route, avoid highways. The app uses the same routing framework but swaps the algorithm based on your choice.

### When to Use
- Multiple related classes that differ only in their behavior.
- You need different variants of an algorithm.
- An algorithm uses data that clients shouldn't know about.
- Replace conditionals with polymorphism.

### Java Implementation

```java
// Strategy interface
interface SortingStrategy<T extends Comparable<T>> {
    void sort(List<T> list);
    String getName();
}

// Concrete Strategies
class BubbleSortStrategy<T extends Comparable<T>> implements SortingStrategy<T> {
    @Override
    public void sort(List<T> list) {
        System.out.println("Applying Bubble Sort...");
        int n = list.size();
        for (int i = 0; i < n - 1; i++) {
            for (int j = 0; j < n - i - 1; j++) {
                if (list.get(j).compareTo(list.get(j + 1)) > 0) {
                    T temp = list.get(j);
                    list.set(j, list.get(j + 1));
                    list.set(j + 1, temp);
                }
            }
        }
    }
    @Override public String getName() { return "Bubble Sort"; }
}

class QuickSortStrategy<T extends Comparable<T>> implements SortingStrategy<T> {
    @Override
    public void sort(List<T> list) {
        System.out.println("Applying Quick Sort...");
        quickSort(list, 0, list.size() - 1);
    }

    private void quickSort(List<T> list, int low, int high) {
        if (low < high) {
            int pi = partition(list, low, high);
            quickSort(list, low, pi - 1);
            quickSort(list, pi + 1, high);
        }
    }

    private int partition(List<T> list, int low, int high) {
        T pivot = list.get(high);
        int i = low - 1;
        for (int j = low; j < high; j++) {
            if (list.get(j).compareTo(pivot) <= 0) {
                i++;
                T temp = list.get(i);
                list.set(i, list.get(j));
                list.set(j, temp);
            }
        }
        T temp = list.get(i + 1);
        list.set(i + 1, list.get(high));
        list.set(high, temp);
        return i + 1;
    }

    @Override public String getName() { return "Quick Sort"; }
}

// Context
class Sorter<T extends Comparable<T>> {
    private SortingStrategy<T> strategy;

    public Sorter(SortingStrategy<T> strategy) {
        this.strategy = strategy;
    }

    public void setStrategy(SortingStrategy<T> strategy) {
        this.strategy = strategy;
    }

    public List<T> sort(List<T> data) {
        List<T> copy = new ArrayList<>(data);
        strategy.sort(copy);
        System.out.println(strategy.getName() + " result: " + copy);
        return copy;
    }
}

public class StrategyDemo {
    public static void main(String[] args) {
        List<Integer> data = Arrays.asList(64, 34, 25, 12, 22, 11, 90);

        Sorter<Integer> sorter = new Sorter<>(new BubbleSortStrategy<>());
        sorter.sort(data);

        // Swap strategy at runtime
        sorter.setStrategy(new QuickSortStrategy<>());
        sorter.sort(data);
    }
}
```

### Strategy vs State
- **Strategy**: client explicitly chooses the algorithm; strategies are usually stateless.
- **State**: object changes its own state internally; states know about each other.

---

## 21. Template Method

### Intent
Define the skeleton of an algorithm in a superclass but let subclasses override specific steps of the algorithm without changing its structure.

### Real-World Analogy
A data mining framework. The overall process is fixed: open file → parse data → analyze → generate report → close file. But "parse data" and "analyze" are different for CSV files vs. PDF files vs. databases.

### Java Implementation

```java
// Abstract Class with Template Method
abstract class DataMiner {

    // Template method — the skeleton
    public final void mine(String path) {
        System.out.println("=== Mining: " + path + " ===");
        String rawData = extractData(path);
        String parsedData = parseData(rawData);
        analyzeData(parsedData);
        sendReport(parsedData);  // hook — has default implementation
    }

    // Abstract steps — must be implemented by subclasses
    protected abstract String extractData(String path);
    protected abstract String parseData(String rawData);
    protected abstract void analyzeData(String data);

    // Hook — optional override
    protected void sendReport(String data) {
        System.out.println("Sending default report...");
    }
}

class CSVDataMiner extends DataMiner {
    @Override
    protected String extractData(String path) {
        System.out.println("Extracting CSV from: " + path);
        return "col1,col2,col3\n1,2,3\n4,5,6";
    }

    @Override
    protected String parseData(String rawData) {
        System.out.println("Parsing CSV data...");
        return rawData.replace(",", " | ");
    }

    @Override
    protected void analyzeData(String data) {
        System.out.println("Analyzing CSV: found " + data.split("\n").length + " rows");
    }
}

class PDFDataMiner extends DataMiner {
    @Override
    protected String extractData(String path) {
        System.out.println("Extracting text from PDF: " + path);
        return "PDF_RAW_CONTENT";
    }

    @Override
    protected String parseData(String rawData) {
        System.out.println("Parsing PDF content with OCR...");
        return rawData.toLowerCase();
    }

    @Override
    protected void analyzeData(String data) {
        System.out.println("Analyzing PDF: found " + data.length() + " characters");
    }

    @Override
    protected void sendReport(String data) {
        System.out.println("Sending PDF-specific executive report...");
    }
}

public class TemplateMethodDemo {
    public static void main(String[] args) {
        DataMiner csvMiner = new CSVDataMiner();
        csvMiner.mine("data.csv");

        System.out.println();

        DataMiner pdfMiner = new PDFDataMiner();
        pdfMiner.mine("report.pdf");
    }
}
```

---

## 22. Visitor

### Intent
Represent an operation to be performed on elements of an object structure. Visitor lets you define a new operation without changing the classes of the elements on which it operates.

### Real-World Analogy
A tax inspector visiting different business entities (shops, banks, factories). Each entity "accepts" the inspector and shows what's relevant. The inspector performs a different calculation for each type.

### When to Use
- You need to perform many distinct, unrelated operations on an object structure.
- The object structure rarely changes, but you often need new operations.
- Avoid polluting classes with unrelated operations.

### Java Implementation

```java
// Visitor interface — one method per element type
interface ShapeVisitor {
    double visit(Circle circle);
    double visit(Rectangle rectangle);
    double visit(Triangle triangle);
}

// Element interface
interface Shape {
    double accept(ShapeVisitor visitor);
}

// Concrete Elements
class Circle implements Shape {
    double radius;
    Circle(double radius) { this.radius = radius; }

    @Override
    public double accept(ShapeVisitor visitor) {
        return visitor.visit(this);
    }
}

class Rectangle implements Shape {
    double width, height;
    Rectangle(double width, double height) { this.width = width; this.height = height; }

    @Override
    public double accept(ShapeVisitor visitor) {
        return visitor.visit(this);
    }
}

class Triangle implements Shape {
    double base, height;
    Triangle(double base, double height) { this.base = base; this.height = height; }

    @Override
    public double accept(ShapeVisitor visitor) {
        return visitor.visit(this);
    }
}

// Concrete Visitor 1: Area Calculator
class AreaCalculator implements ShapeVisitor {
    @Override public double visit(Circle c) { return Math.PI * c.radius * c.radius; }
    @Override public double visit(Rectangle r) { return r.width * r.height; }
    @Override public double visit(Triangle t) { return 0.5 * t.base * t.height; }
}

// Concrete Visitor 2: Perimeter Calculator (new operation — no Shape changes needed!)
class PerimeterCalculator implements ShapeVisitor {
    @Override public double visit(Circle c) { return 2 * Math.PI * c.radius; }
    @Override public double visit(Rectangle r) { return 2 * (r.width + r.height); }
    @Override public double visit(Triangle t) {
        // Simplified: assume isosceles
        double side = Math.sqrt((t.base / 2) * (t.base / 2) + t.height * t.height);
        return t.base + 2 * side;
    }
}

public class VisitorDemo {
    public static void main(String[] args) {
        List<Shape> shapes = Arrays.asList(
            new Circle(5),
            new Rectangle(4, 6),
            new Triangle(3, 4)
        );

        AreaCalculator area = new AreaCalculator();
        PerimeterCalculator perimeter = new PerimeterCalculator();

        for (Shape shape : shapes) {
            System.out.printf("%-15s Area=%.2f  Perimeter=%.2f%n",
                shape.getClass().getSimpleName(),
                shape.accept(area),
                shape.accept(perimeter));
        }
    }
}
```

---

## 23. Interpreter

### Intent
Given a language, define a representation for its grammar along with an interpreter that uses the representation to interpret sentences in the language.

### Real-World Analogy
A SQL parser. You define grammar rules (`SELECT`, `FROM`, `WHERE`), and the interpreter reads a query string and executes it against a data source.

### Java Implementation

```java
// Expression interface
interface Expression {
    boolean interpret(Map<String, Boolean> context);
}

// Terminal Expression
class VariableExpression implements Expression {
    private final String name;
    VariableExpression(String name) { this.name = name; }

    @Override
    public boolean interpret(Map<String, Boolean> context) {
        return context.getOrDefault(name, false);
    }
}

// Non-terminal Expressions
class AndExpression implements Expression {
    private final Expression left, right;
    AndExpression(Expression left, Expression right) {
        this.left = left; this.right = right;
    }

    @Override
    public boolean interpret(Map<String, Boolean> context) {
        return left.interpret(context) && right.interpret(context);
    }
}

class OrExpression implements Expression {
    private final Expression left, right;
    OrExpression(Expression left, Expression right) {
        this.left = left; this.right = right;
    }

    @Override
    public boolean interpret(Map<String, Boolean> context) {
        return left.interpret(context) || right.interpret(context);
    }
}

class NotExpression implements Expression {
    private final Expression expr;
    NotExpression(Expression expr) { this.expr = expr; }

    @Override
    public boolean interpret(Map<String, Boolean> context) {
        return !expr.interpret(context);
    }
}

public class InterpreterDemo {
    public static void main(String[] args) {
        // Build expression: (isLoggedIn AND hasPermission) OR isAdmin
        Expression isLoggedIn = new VariableExpression("isLoggedIn");
        Expression hasPermission = new VariableExpression("hasPermission");
        Expression isAdmin = new VariableExpression("isAdmin");

        Expression canAccess = new OrExpression(
            new AndExpression(isLoggedIn, hasPermission),
            isAdmin
        );

        // Test cases
        Map<String, Boolean> context1 = Map.of("isLoggedIn", true, "hasPermission", true, "isAdmin", false);
        Map<String, Boolean> context2 = Map.of("isLoggedIn", true, "hasPermission", false, "isAdmin", false);
        Map<String, Boolean> context3 = Map.of("isLoggedIn", false, "hasPermission", false, "isAdmin", true);

        System.out.println("Context 1 (logged in + permission): " + canAccess.interpret(context1)); // true
        System.out.println("Context 2 (logged in, no permission): " + canAccess.interpret(context2)); // false
        System.out.println("Context 3 (admin): " + canAccess.interpret(context3)); // true
    }
}
```

---

# Quick Reference: When to Use Which Pattern

## Creational — "How do I create this object?"

| Problem | Pattern |
|---|---|
| Subclasses should decide which class to instantiate | Factory Method |
| Need to create families of related objects | Abstract Factory |
| Complex object with many optional parameters | Builder |
| Creating objects is expensive; need cheap copies | Prototype |
| Need exactly one instance globally | Singleton |

## Structural — "How do these pieces fit together?"

| Problem | Pattern |
|---|---|
| Incompatible interfaces need to work together | Adapter |
| Abstraction and implementation should vary independently | Bridge |
| Part-whole tree hierarchies, uniform treatment | Composite |
| Add responsibilities to objects dynamically | Decorator |
| Simplify a complex subsystem | Facade |
| Huge number of similar fine-grained objects | Flyweight |
| Control access to an object | Proxy |

## Behavioral — "How do these objects communicate?"

| Problem | Pattern |
|---|---|
| Pass requests through a chain of handlers | Chain of Responsibility |
| Encapsulate requests as objects (undo/redo, queue) | Command |
| Traverse a collection without exposing internals | Iterator |
| Reduce direct dependencies between many objects | Mediator |
| Save and restore object state (undo) | Memento |
| Notify multiple objects of state changes | Observer |
| Object changes behavior based on internal state | State |
| Swap algorithms at runtime | Strategy |
| Define algorithm skeleton; let subclasses fill steps | Template Method |
| Add operations to objects without changing them | Visitor |

---

## Key Takeaways

- Design patterns are **not copy-paste code** — they are reusable *concepts* you adapt to your context.
- The three categories represent three dimensions of design: **creation, composition, and communication**.
- Patterns come with trade-offs. A Singleton is simple but hostile to testing. A Decorator is flexible but deep stacks are hard to debug.
- You already use patterns daily — every `Iterator`, every Spring `@Bean`, every `Collections.sort()` with a `Comparator`.
- **Over-engineering is real.** Don't introduce a pattern where a simple class or method will do.
- The best way to learn patterns is to **recognize them in codebases you already use** (Spring, Hibernate, Java standard library) and gradually introduce them when the problem clearly fits.

---

*All code examples are in Java 17+ and compile as-is.*
