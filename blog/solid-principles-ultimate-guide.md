---
title: The Ultimate Guide to SOLID Principles
date: 2026-06-07
excerpt: A deep-dive into all five SOLID principles with real-world analogies, bad vs. good code comparisons, and complete Java examples. Learn how to write clean, maintainable, and extensible software that your future self will thank you for.
---

Every senior engineer has looked at old code - their own or someone else's - and felt the pain of rigid, fragile, spaghetti design. Adding one feature breaks three others. Changing a class forces changes everywhere. Tests are impossible to write. Sound familiar?

**SOLID** is the antidote. Coined by Robert C. Martin (Uncle Bob) and popularized across the industry, SOLID is a set of five design principles that, when applied together, produce software that is easy to maintain, extend, and understand.

This guide goes deep on all five - not just what they say, but *why* they exist, what violations look like in real Java code, and exactly how to fix them.

---

## What is SOLID?

SOLID is an acronym for five object-oriented design principles:

| Letter | Principle | One-Line Summary |
|---|---|---|
| **S** | Single Responsibility Principle | A class should have only one reason to change |
| **O** | Open/Closed Principle | Open for extension, closed for modification |
| **L** | Liskov Substitution Principle | Subtypes must be substitutable for their base types |
| **I** | Interface Segregation Principle | No client should be forced to depend on methods it doesn't use |
| **D** | Dependency Inversion Principle | Depend on abstractions, not concretions |

These principles are not rules enforced by the compiler - they are **guidelines for decision-making**. You apply them when they reduce complexity and improve clarity. Blindly applying them everywhere produces over-engineered code. The skill is knowing *when* they help.

---

# S - Single Responsibility Principle (SRP)

> *"A class should have one, and only one, reason to change."*
> - Robert C. Martin

### The Real Meaning

This is the most misunderstood SOLID principle. "One responsibility" doesn't mean a class should only have one method. It means a class should serve **one actor** - one part of the business, one stakeholder. If two different people (a DBA and a UI designer) could both require you to change the same class, that class has two responsibilities.

### Real-World Analogy

A Swiss Army knife is great for camping but a terrible surgical tool. A scalpel does one thing - cut with precision. In software, the more jobs a class has, the harder it is to change any one of them without breaking the others.

### Violation - What BAD code looks like

```java
// ❌ BAD: This class has at least 3 reasons to change:
// 1. Business logic changes (how orders are calculated)
// 2. Database schema changes
// 3. Email template changes
class Order {
    private List<OrderItem> items;
    private String customerEmail;

    public double calculateTotal() {
        return items.stream()
                    .mapToDouble(i -> i.getPrice() * i.getQuantity())
                    .sum();
    }

    // Reason to change #2: database logic mixed in
    public void saveToDatabase() {
        String sql = "INSERT INTO orders (total) VALUES (" + calculateTotal() + ")";
        // execute SQL...
        System.out.println("Executing: " + sql);
    }

    // Reason to change #3: email formatting mixed in
    public void sendConfirmationEmail() {
        String body = "Dear customer, your order total is $" + calculateTotal();
        // send email to customerEmail...
        System.out.println("Sending email: " + body);
    }
}
```

**Problems:**
- A change to the email template forces you to touch `Order`.
- A database migration forces you to touch `Order`.
- You can't unit test `calculateTotal()` without worrying about DB connections.

### Fix - SRP Applied

```java
// ✅ GOOD: Each class has one reason to change

// Responsibility 1: Business logic only
class Order {
    private final List<OrderItem> items;
    private final String customerEmail;

    public Order(List<OrderItem> items, String customerEmail) {
        this.items = items;
        this.customerEmail = customerEmail;
    }

    public double calculateTotal() {
        return items.stream()
                    .mapToDouble(i -> i.getPrice() * i.getQuantity())
                    .sum();
    }

    public String getCustomerEmail() { return customerEmail; }
    public List<OrderItem> getItems() { return items; }
}

// Responsibility 2: Persistence logic
class OrderRepository {
    public void save(Order order) {
        String sql = "INSERT INTO orders (total) VALUES (" + order.calculateTotal() + ")";
        System.out.println("Persisting: " + sql);
        // actual DB logic here
    }
}

// Responsibility 3: Notification logic
class OrderNotificationService {
    public void sendConfirmation(Order order) {
        String body = "Dear customer, your order total is $" + order.calculateTotal();
        System.out.println("Sending email to " + order.getCustomerEmail() + ": " + body);
    }
}

// Orchestration - ties them together
class OrderService {
    private final OrderRepository repository;
    private final OrderNotificationService notifier;

    public OrderService(OrderRepository repository, OrderNotificationService notifier) {
        this.repository = repository;
        this.notifier = notifier;
    }

    public void placeOrder(Order order) {
        repository.save(order);
        notifier.sendConfirmation(order);
    }
}

class OrderItem {
    private double price;
    private int quantity;
    public OrderItem(double price, int quantity) { this.price = price; this.quantity = quantity; }
    public double getPrice() { return price; }
    public int getQuantity() { return quantity; }
}

public class SRPDemo {
    public static void main(String[] args) {
        List<OrderItem> items = List.of(
            new OrderItem(29.99, 2),
            new OrderItem(9.99, 1)
        );
        Order order = new Order(items, "alice@example.com");

        OrderService service = new OrderService(
            new OrderRepository(),
            new OrderNotificationService()
        );

        service.placeOrder(order);
    }
}
```

### Benefits Unlocked
- Test `Order.calculateTotal()` in pure isolation - no DB, no email.
- Change the email template without touching business logic.
- Swap the DB implementation (SQL → NoSQL) without touching `Order`.

### SRP and Cohesion
SRP is really about **cohesion** - things that change together belong together; things that change independently should be separated. High cohesion within a class + low coupling between classes = software that's a joy to maintain.

---

# O - Open/Closed Principle (OCP)

> *"Software entities should be open for extension, but closed for modification."*
> - Bertrand Meyer

### The Real Meaning

Once a class is written and tested, you shouldn't need to crack it open and modify it to add new behavior. Instead, you extend it - through inheritance, composition, or abstraction. The goal is to add new features **without touching existing, working code** (and risk breaking it).

### Real-World Analogy

A power strip. You don't rewire your wall outlet every time you buy a new device. You just plug in a new device (extension). The outlet (existing code) stays unchanged - it's closed for modification but open for new devices to plug in.

### Violation

```java
// ❌ BAD: Every new shape requires modifying this class
class AreaCalculator {
    public double calculate(Object shape) {
        if (shape instanceof Circle circle) {
            return Math.PI * circle.radius * circle.radius;
        } else if (shape instanceof Rectangle rect) {
            return rect.width * rect.height;
        }
        // Adding Triangle? You must modify this class.
        // Adding Pentagon? Modify again.
        // Every change risks breaking existing cases.
        throw new IllegalArgumentException("Unknown shape");
    }
}

class Circle { double radius; Circle(double r) { radius = r; } }
class Rectangle { double width, height; Rectangle(double w, double h) { width = w; height = h; } }
```

### Fix - OCP Applied

```java
// ✅ GOOD: New shapes are added without touching existing code

// Abstraction - the extension point
interface Shape {
    double area();
    String describe();
}

// Existing shapes - closed for modification
class Circle implements Shape {
    private final double radius;
    public Circle(double radius) { this.radius = radius; }

    @Override public double area() { return Math.PI * radius * radius; }
    @Override public String describe() { return String.format("Circle(r=%.1f)", radius); }
}

class Rectangle implements Shape {
    private final double width, height;
    public Rectangle(double width, double height) { this.width = width; this.height = height; }

    @Override public double area() { return width * height; }
    @Override public String describe() { return String.format("Rectangle(%.1f×%.1f)", width, height); }
}

// New shape added - zero changes to existing code ✅
class Triangle implements Shape {
    private final double base, height;
    public Triangle(double base, double height) { this.base = base; this.height = height; }

    @Override public double area() { return 0.5 * base * height; }
    @Override public String describe() { return String.format("Triangle(b=%.1f, h=%.1f)", base, height); }
}

// New shape added - still zero changes to existing code ✅
class RegularHexagon implements Shape {
    private final double side;
    public RegularHexagon(double side) { this.side = side; }

    @Override public double area() { return (3 * Math.sqrt(3) / 2) * side * side; }
    @Override public String describe() { return String.format("Hexagon(s=%.1f)", side); }
}

// Calculator - never needs to change regardless of how many shapes you add
class AreaCalculator {
    public double totalArea(List<Shape> shapes) {
        return shapes.stream().mapToDouble(Shape::area).sum();
    }

    public void printReport(List<Shape> shapes) {
        shapes.forEach(s -> System.out.printf("%-30s area = %.2f%n", s.describe(), s.area()));
        System.out.printf("%-30s area = %.2f%n", "TOTAL", totalArea(shapes));
    }
}

public class OCPDemo {
    public static void main(String[] args) {
        List<Shape> shapes = List.of(
            new Circle(5),
            new Rectangle(4, 6),
            new Triangle(3, 8),
            new RegularHexagon(4)
        );

        new AreaCalculator().printReport(shapes);
    }
}
```

### OCP in the Real World
- **Streams API**: Write a new `Comparator` or `Predicate` - `Collections.sort()` is closed for modification.
- **Spring**: Write a new `@Service` or `@Component` - the Spring container is closed for modification.
- **Strategy Pattern** is the canonical implementation of OCP.

### The Key Insight
You can't anticipate every future requirement. OCP says: identify the *axes of change* in your system, and put abstraction at those points. Don't abstract everything - only the parts you know will vary.

---

# L - Liskov Substitution Principle (LSP)

> *"If S is a subtype of T, then objects of type T may be replaced with objects of type S without altering the correctness of the program."*
> - Barbara Liskov

### The Real Meaning

A subclass should be completely substitutable for its parent class. You should be able to swap in a subclass wherever the parent is used, and the program should behave correctly - no surprises, no exceptions, no weakened behavior.

LSP is about **behavioral** correctness, not just structural compatibility. A subclass can *compile* correctly but still violate LSP if it changes the expected behavior.

### Real-World Analogy

If your company says "all vehicles can be refuelled," an electric car (subtype of Vehicle) would violate this if it throws an exception on `refuel()`. The client code expects the refuel contract to hold for *all* vehicles.

### Violation - The Classic Square/Rectangle Problem

```java
// ❌ BAD: Mathematically, a square IS-A rectangle.
// But in code, this breaks LSP.

class Rectangle {
    protected int width;
    protected int height;

    public void setWidth(int width) { this.width = width; }
    public void setHeight(int height) { this.height = height; }
    public int area() { return width * height; }
}

class Square extends Rectangle {
    // Enforces square constraint - BOTH sides must be equal
    @Override
    public void setWidth(int width) {
        this.width = width;
        this.height = width; // side effect!
    }

    @Override
    public void setHeight(int height) {
        this.height = height;
        this.width = height; // side effect!
    }
}

class LSPViolationDemo {
    // This method works perfectly with Rectangle
    static void stretchWidth(Rectangle r) {
        r.setHeight(10);
        r.setWidth(20);
        // Expected area: 200. With Square, actual area: 200? No - 400!
        // Because setWidth also sets height to 20.
        System.out.println("Expected 200, got: " + r.area()); // ❌ Prints 400 for Square
    }

    public static void main(String[] args) {
        stretchWidth(new Rectangle()); // Prints: Expected 200, got: 200 ✅
        stretchWidth(new Square());    // Prints: Expected 200, got: 400 ❌
    }
}
```

The `Square` class *compiles* fine but *breaks* the behavioral contract that callers of `Rectangle` depend on.

### Fix - LSP Applied

```java
// ✅ GOOD: Don't force an IS-A relationship that breaks behavior.
// Use a shared abstraction instead.

interface Shape {
    int area();
}

class Rectangle implements Shape {
    private final int width;
    private final int height;

    public Rectangle(int width, int height) {
        this.width = width;
        this.height = height;
    }

    public int getWidth() { return width; }
    public int getHeight() { return height; }

    @Override
    public int area() { return width * height; }

    @Override
    public String toString() { return "Rectangle(" + width + "×" + height + ")"; }
}

class Square implements Shape {
    private final int side;

    public Square(int side) { this.side = side; }
    public int getSide() { return side; }

    @Override
    public int area() { return side * side; }

    @Override
    public String toString() { return "Square(" + side + ")"; }
}

// Now substitution works correctly - both honour the Shape contract
public class LSPDemo {
    static void printArea(Shape shape) {
        System.out.println(shape + " has area: " + shape.area());
    }

    public static void main(String[] args) {
        printArea(new Rectangle(4, 5));  // Rectangle(4×5) has area: 20
        printArea(new Square(4));        // Square(4) has area: 16
    }
}
```

### A More Practical LSP Example

```java
// ❌ BAD: Subclass weakens the postcondition (throws where parent doesn't)
class FileLogger {
    public void log(String message) {
        // writes to file
        System.out.println("FILE: " + message);
    }
}

class ReadOnlyLogger extends FileLogger {
    @Override
    public void log(String message) {
        throw new UnsupportedOperationException("This logger is read-only!"); // LSP violation!
    }
}

// ✅ FIX: Don't inherit what you can't honour. Use the right abstraction.
interface Logger {
    void log(String message);
}

class FileLogger2 implements Logger {
    @Override public void log(String message) { System.out.println("FILE: " + message); }
}

class ConsoleLogger implements Logger {
    @Override public void log(String message) { System.out.println("CONSOLE: " + message); }
}

class NullLogger implements Logger {
    @Override public void log(String message) { /* intentionally silent - valid, no exception */ }
}
```

### LSP Checklist
- Does the subclass throw exceptions the parent doesn't declare?
- Does the subclass weaken preconditions (accepts less than the parent)?
- Does the subclass weaken postconditions (guarantees less than the parent)?
- Does the subclass override a method with behavior that surprises callers?

If yes to any → likely an LSP violation.

---

# I - Interface Segregation Principle (ISP)

> *"No client should be forced to depend on methods it does not use."*
> - Robert C. Martin

### The Real Meaning

Fat interfaces create tight coupling. If you implement an interface with 10 methods but only need 3, you're forced to provide dummy implementations for 7. When that interface changes, your class has to change too - even if the changing methods are irrelevant to you.

ISP says: break large interfaces into smaller, more focused ones. Clients only depend on what they actually use.

### Real-World Analogy

Imagine a job posting that requires "experience in cooking, driving, programming, surgery, and plumbing." That's a fat interface. Most candidates can do one or two things well. You should post separate, focused roles.

### Violation

```java
// ❌ BAD: One fat interface forces all implementors to support everything
interface MultifunctionPrinter {
    void print(String document);
    void scan(String document);
    void fax(String document);
    void photocopy(String document);
    void staple(String document);
}

// A simple inkjet printer implements this - but can't fax or staple
class BasicInkjetPrinter implements MultifunctionPrinter {
    @Override public void print(String doc) { System.out.println("Printing: " + doc); }
    @Override public void scan(String doc) { System.out.println("Scanning: " + doc); }

    // Forced to implement these even though it's physically impossible
    @Override public void fax(String doc) {
        throw new UnsupportedOperationException("This printer cannot fax!"); // ❌
    }
    @Override public void photocopy(String doc) {
        throw new UnsupportedOperationException("No photocopy!"); // ❌
    }
    @Override public void staple(String doc) {
        throw new UnsupportedOperationException("No stapler!"); // ❌
    }
}
```

### Fix - ISP Applied

```java
// ✅ GOOD: Segregated interfaces - each client depends only on what it needs

interface Printable {
    void print(String document);
}

interface Scannable {
    void scan(String document);
}

interface Faxable {
    void fax(String document);
}

interface Photocopiable {
    void photocopy(String document);
}

interface Stapleable {
    void staple(String document);
}

// Basic printer - implements only what it can do
class BasicInkjetPrinter implements Printable, Scannable {
    @Override public void print(String doc) { System.out.println("Inkjet printing: " + doc); }
    @Override public void scan(String doc) { System.out.println("Inkjet scanning: " + doc); }
}

// Enterprise printer - implements the full suite
class EnterpriseOfficePrinter implements Printable, Scannable, Faxable, Photocopiable, Stapleable {
    @Override public void print(String doc) { System.out.println("Enterprise printing: " + doc); }
    @Override public void scan(String doc) { System.out.println("Enterprise scanning: " + doc); }
    @Override public void fax(String doc) { System.out.println("Faxing: " + doc); }
    @Override public void photocopy(String doc) { System.out.println("Photocopying: " + doc); }
    @Override public void staple(String doc) { System.out.println("Stapling: " + doc); }
}

// Client code depends only on the interfaces it needs
class DocumentWorkflow {
    private final Printable printer;
    private final Scannable scanner;

    public DocumentWorkflow(Printable printer, Scannable scanner) {
        this.printer = printer;
        this.scanner = scanner;
    }

    public void process(String document) {
        scanner.scan(document);
        printer.print(document);
    }
}

public class ISPDemo {
    public static void main(String[] args) {
        // Works with the basic printer
        BasicInkjetPrinter basic = new BasicInkjetPrinter();
        DocumentWorkflow workflow = new DocumentWorkflow(basic, basic);
        workflow.process("Report.pdf");

        System.out.println();

        // Works equally with the enterprise printer
        EnterpriseOfficePrinter enterprise = new EnterpriseOfficePrinter();
        DocumentWorkflow workflow2 = new DocumentWorkflow(enterprise, enterprise);
        workflow2.process("Contract.pdf");
    }
}
```

### A Real-World Java ISP Example

Java's own `java.util.List` is arguably too fat - it includes both read and write operations. That's why `Collections.unmodifiableList()` exists. A better design would have segregated `ReadableList` and `WriteableList` interfaces - which is exactly what Kotlin did with `List` vs `MutableList`.

### ISP and Role Interfaces

A powerful pattern that emerges from ISP is **role interfaces** - small interfaces that define a specific capability:

```java
// Role interfaces - highly composable
interface Authenticatable {
    boolean authenticate(String password);
}

interface Authorizable {
    boolean hasPermission(String action);
}

interface Auditable {
    void logAccess(String action);
}

// A user might play all three roles
class AdminUser implements Authenticatable, Authorizable, Auditable {
    @Override public boolean authenticate(String password) { return "secret".equals(password); }
    @Override public boolean hasPermission(String action) { return true; } // admins can do anything
    @Override public void logAccess(String action) { System.out.println("AUDIT: Admin performed " + action); }
}

// A service account only needs authorization
class ServiceAccount implements Authorizable {
    private final Set<String> allowedActions;

    public ServiceAccount(Set<String> allowedActions) { this.allowedActions = allowedActions; }

    @Override
    public boolean hasPermission(String action) { return allowedActions.contains(action); }
}
```

---

# D - Dependency Inversion Principle (DIP)

> *"High-level modules should not depend on low-level modules. Both should depend on abstractions. Abstractions should not depend on details. Details should depend on abstractions."*
> - Robert C. Martin

### The Real Meaning

This principle has two key rules:
1. High-level policy code (business logic) should not depend on low-level detail code (file I/O, database, HTTP).
2. Both should depend on an abstraction (interface/abstract class).

When high-level code directly references low-level code, a change in the low-level detail forces a change in the high-level policy. This creates **tight coupling** - the most dangerous kind because it propagates change upward.

### Real-World Analogy

Your laptop's USB port doesn't know whether you've plugged in a keyboard, a mouse, or a USB drive. It depends on the USB *standard* (abstraction), not on specific devices (details). You can change devices without changing your laptop.

### Violation

```java
// ❌ BAD: High-level UserService directly depends on low-level MySQLUserRepository
// Changing from MySQL to MongoDB requires modifying UserService - terrible coupling

class MySQLUserRepository {
    public void save(String user) {
        System.out.println("INSERT INTO users VALUES ('" + user + "') -- MySQL");
    }

    public String findById(int id) {
        System.out.println("SELECT * FROM users WHERE id = " + id + " -- MySQL");
        return "user_" + id;
    }
}

// High-level module directly instantiates low-level module
class UserService {
    private final MySQLUserRepository repository = new MySQLUserRepository(); // ❌ hard dependency

    public void registerUser(String username) {
        // business validation...
        System.out.println("Validating: " + username);
        repository.save(username); // tightly coupled to MySQL
    }
}
```

**Problems:**
- Can't test `UserService` without a MySQL connection.
- To switch to PostgreSQL or MongoDB, you must edit `UserService`.
- `UserService` has two reasons to change: business logic AND DB technology choice.

### Fix - DIP Applied

```java
// ✅ GOOD: Both high-level and low-level depend on an abstraction

// Abstraction - the stable contract
interface UserRepository {
    void save(String user);
    String findById(int id);
}

// Low-level detail #1
class MySQLUserRepository implements UserRepository {
    @Override
    public void save(String user) {
        System.out.println("MySQL INSERT: " + user);
    }

    @Override
    public String findById(int id) {
        System.out.println("MySQL SELECT id=" + id);
        return "mysql_user_" + id;
    }
}

// Low-level detail #2 - can swap in without touching UserService
class MongoUserRepository implements UserRepository {
    @Override
    public void save(String user) {
        System.out.println("MongoDB insertOne: " + user);
    }

    @Override
    public String findById(int id) {
        System.out.println("MongoDB findOne _id=" + id);
        return "mongo_user_" + id;
    }
}

// In-memory for tests - no database required
class InMemoryUserRepository implements UserRepository {
    private final Map<Integer, String> store = new HashMap<>();
    private int nextId = 1;

    @Override
    public void save(String user) {
        store.put(nextId++, user);
        System.out.println("In-memory saved: " + user);
    }

    @Override
    public String findById(int id) {
        return store.getOrDefault(id, null);
    }
}

// High-level module - only knows about the abstraction
class UserService {
    private final UserRepository repository; // depends on abstraction ✅

    // Dependency injected from outside (constructor injection)
    public UserService(UserRepository repository) {
        this.repository = repository;
    }

    public void registerUser(String username) {
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("Username cannot be blank");
        }
        System.out.println("Registering user: " + username);
        repository.save(username);
    }

    public String getUser(int id) {
        return repository.findById(id);
    }
}

public class DIPDemo {
    public static void main(String[] args) {
        System.out.println("=== Production (MySQL) ===");
        UserService prodService = new UserService(new MySQLUserRepository());
        prodService.registerUser("alice");

        System.out.println("\n=== Production (MongoDB) - zero UserService changes ===");
        UserService mongoService = new UserService(new MongoUserRepository());
        mongoService.registerUser("bob");

        System.out.println("\n=== Tests (In-Memory) - no database needed ===");
        UserService testService = new UserService(new InMemoryUserRepository());
        testService.registerUser("charlie");
        System.out.println("Found: " + testService.getUser(1));
    }
}
```

### Dependency Injection vs Dependency Inversion

These are related but different:

- **Dependency Inversion Principle** - the *design guideline*: depend on abstractions.
- **Dependency Injection** - the *technique*: provide dependencies from outside (constructor, setter, or method injection) rather than creating them internally.

DI is the most common *mechanism* for achieving DIP.

Spring's entire IoC container is built on this principle - your `@Service` beans don't create their own `@Repository` instances; Spring *injects* them.

### DIP Beyond Databases

DIP applies everywhere you have variation:

```java
// Notification system
interface NotificationSender {
    void send(String recipient, String message);
}

class EmailSender implements NotificationSender {
    @Override public void send(String recipient, String message) {
        System.out.println("Email to " + recipient + ": " + message);
    }
}

class SmsSender implements NotificationSender {
    @Override public void send(String recipient, String message) {
        System.out.println("SMS to " + recipient + ": " + message);
    }
}

class PushNotificationSender implements NotificationSender {
    @Override public void send(String recipient, String message) {
        System.out.println("Push to " + recipient + ": " + message);
    }
}

// High-level service - doesn't care HOW notifications are sent
class AlertService {
    private final List<NotificationSender> senders;

    public AlertService(List<NotificationSender> senders) {
        this.senders = senders;
    }

    public void alert(String user, String message) {
        senders.forEach(s -> s.send(user, message));
    }
}

class DIPMultiChannelDemo {
    public static void main(String[] args) {
        AlertService alerts = new AlertService(List.of(
            new EmailSender(),
            new SmsSender(),
            new PushNotificationSender()
        ));

        alerts.alert("alice@example.com", "Your account was accessed from a new device.");
    }
}
```

---

# How SOLID Principles Work Together

The five principles aren't independent - they reinforce each other:

| If you apply... | It naturally leads to... |
|---|---|
| SRP | Smaller classes → easier to apply OCP and ISP |
| OCP | Abstractions everywhere → sets up DIP |
| LSP | Trustworthy polymorphism → OCP's extension works correctly |
| ISP | Lean interfaces → easier to satisfy LSP, simpler DIP wiring |
| DIP | Abstractions between layers → enables OCP at every level |

### A Complete Example - All Five Together

```java
// SRP: Each class has one job
// OCP: New payment methods added without changing PaymentProcessor
// LSP: All PaymentMethod subtypes are truly substitutable
// ISP: Refundable is separate from Chargeable - not all payments support refunds
// DIP: PaymentProcessor depends on abstractions, not concrete payment SDKs

// ISP: Separate interfaces for separate capabilities
interface Chargeable {
    PaymentResult charge(double amount, String currency);
}

interface Refundable {
    boolean refund(String transactionId, double amount);
}

// LSP + OCP: New payment methods implement these contracts correctly
class CreditCardPayment implements Chargeable, Refundable {
    private final String cardNumber;

    public CreditCardPayment(String cardNumber) { this.cardNumber = cardNumber; }

    @Override
    public PaymentResult charge(double amount, String currency) {
        System.out.printf("Charging $%.2f %s to card *%s%n", amount, currency,
                          cardNumber.substring(cardNumber.length() - 4));
        return new PaymentResult("CC-" + System.currentTimeMillis(), true);
    }

    @Override
    public boolean refund(String transactionId, double amount) {
        System.out.printf("Refunding $%.2f for transaction %s%n", amount, transactionId);
        return true;
    }
}

class CryptoPayment implements Chargeable {
    // Crypto doesn't support refunds - ISP means we don't force it to
    private final String walletAddress;

    public CryptoPayment(String walletAddress) { this.walletAddress = walletAddress; }

    @Override
    public PaymentResult charge(double amount, String currency) {
        System.out.printf("Sending %.4f BTC to wallet %s%n", amount / 45000, walletAddress);
        return new PaymentResult("CRYPTO-" + System.currentTimeMillis(), true);
    }
}

class PaymentResult {
    final String transactionId;
    final boolean success;

    PaymentResult(String transactionId, boolean success) {
        this.transactionId = transactionId;
        this.success = success;
    }
}

// DIP: Depends on Chargeable abstraction, not concrete payment SDKs
// SRP: Only handles payment orchestration
class PaymentProcessor {
    private final Chargeable paymentMethod; // DIP ✅

    public PaymentProcessor(Chargeable paymentMethod) {
        this.paymentMethod = paymentMethod;
    }

    public PaymentResult process(double amount) {
        System.out.println("Processing payment...");
        PaymentResult result = paymentMethod.charge(amount, "USD");
        if (result.success) {
            System.out.println("Payment successful: " + result.transactionId);
        }
        return result;
    }
}

public class SOLIDTogetherDemo {
    public static void main(String[] args) {
        // Credit card payment
        PaymentProcessor processor = new PaymentProcessor(new CreditCardPayment("4111111111111234"));
        PaymentResult result = processor.process(99.99);

        System.out.println();

        // Swap to crypto - zero changes to PaymentProcessor (OCP + DIP)
        processor = new PaymentProcessor(new CryptoPayment("1A2b3C4d5E6f"));
        processor.process(250.00);
    }
}
```

---

# Common Misconceptions

### "SOLID means more classes = better code"
Wrong. SOLID is about reducing accidental complexity. Sometimes one well-crafted class is better than five thin ones. Apply principles where they *reduce* complexity, not increase it.

### "You must apply SOLID from day one"
Not necessarily. Start simple. Refactor toward SOLID when you feel the pain - when a change in one place breaks something elsewhere, when tests become hard to write, when a feature takes days that should take hours.

### "SRP means a class should only have one method"
No. SRP is about **reasons to change** (actors/stakeholders), not method count. A `User` class can have `getName()`, `getEmail()`, `getAge()` - all related to the same concept, changed by the same people.

### "DIP means you need a DI framework like Spring"
No. DIP is achieved with constructor injection - a pure Java concept. Spring makes it more convenient at scale, but a `new UserService(new MySQLUserRepository())` in a `main()` method is perfectly valid DIP.

---

## Key Takeaways

- **SRP**: If you can name two unrelated reasons your class would change, split it.
- **OCP**: Find the axes of variation in your system and put interfaces there.
- **LSP**: Inheritance is about behavior, not just structure. If a subtype can't honour the parent's contract, don't inherit - compose or use a shared interface.
- **ISP**: Prefer many small, focused interfaces over one large one. Clients only depend on what they use.
- **DIP**: High-level policy should never know about low-level details. Point both at an abstraction in the middle.
- **Together**: SOLID isn't a checklist - it's a set of lenses for spotting design problems. Use them when the benefit is clear, not as dogma.

---

*All code examples are in Java 17+ and compile as-is.*
