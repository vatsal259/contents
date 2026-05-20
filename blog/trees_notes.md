---
title: Data Structures — Trees
date: 2026-05-20
excerpt: Notes on tree anatomy, types, traversals, and complexity.
---

# 🌳 Data Structures: Trees

## 📖 Definition
A **tree** is a non-linear, hierarchical data structure consisting of nodes connected by edges. Unlike arrays or linked lists, trees allow for efficient searching and structured data organization.

---

## 📐 Anatomy of a Tree

- **Root:** The topmost node (has no parent)
- **Edge:** The connection between two nodes
- **Parent:** A node that has children
- **Child:** A node derived from another node
- **Sibling:** Nodes sharing the same parent
- **Leaf (External Node):** A node with no children
- **Internal Node:** A node with at least one child
- **Height:** Longest path from a node to a leaf
- **Depth:** Distance from root to a node
- **Degree:** Number of children of a node

---

## 🗂️ Classification of Trees

### 1. 🌿 Binary Trees (Foundation)

A tree where each node has at most **2 children**.

#### Types:
- **Binary Search Tree (BST):**
  - Left child < Parent < Right child
  - **Use Case:** Fast lookup, sorted data
  - **Complexity:**
    - Average: O(log n)
    - Worst: O(n)

- **Full Binary Tree:**
  - Each node has either 0 or 2 children

- **Complete Binary Tree:**
  - All levels filled except possibly last (filled left to right)

- **Perfect Binary Tree:**
  - All internal nodes have 2 children and all leaves are at same level

---

### 2. ⚖️ Self-Balancing Trees (Smart Trees)

- **AVL Tree:**
  - Balance factor ∈ {-1, 0, 1}
  - Strictly balanced
  - Best for frequent searches

- **Red-Black Tree:**
  - Relaxed balancing rules
  - Used in C++ std::map and Java TreeMap
  - Best for frequent insert/delete

---

### 3. 💾 Storage & Search Trees (Workhorses)

- **B-Tree / B+ Tree:**
  - Optimized for disk access
  - Used in databases and file systems

- **Trie (Prefix Tree):**
  - Used for autocomplete and spell check

---

## 🔁 Tree Traversals

### Depth-First Traversals

- Inorder: Left → Node → Right
- Preorder: Node → Left → Right
- Postorder: Left → Right → Node

### Breadth-First Traversal

- Level Order (uses queue)

---

## 🌲 Binary Search Tree (BST)

### Properties:
- Left subtree values < root
- Right subtree values > root

### Operations:
- Search: O(log n)
- Insert: O(log n)
- Delete: O(log n)

---

## 🧠 Common Tree Problems

- Check if tree is balanced
- Find height of tree
- Lowest Common Ancestor (LCA)
- Diameter of tree
- Path sum problems

---

## 📊 Performance Comparison

| Tree Type        | Search        | Insertion     | Space | Best For                     |
|-----------------|--------------|--------------|------|------------------------------|
| BST             | O(log n)     | O(log n)     | O(n) | Simple sorted data           |
| AVL Tree        | O(log n)     | O(log n)     | O(n) | Fast lookups                 |
| Red-Black Tree  | O(log n)     | O(log n)     | O(n) | Frequent updates             |
| B-Tree          | O(log n)     | O(log n)     | O(n) | Databases / Disk storage     |
| Trie            | O(L)         | O(L)         | O(AL)| Strings / Autocomplete       |

---

## 🚀 Next Steps

- Practice traversal problems
- Implement BST from scratch
- Solve LCA and diameter problems
