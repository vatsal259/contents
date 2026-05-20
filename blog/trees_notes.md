---
title: Data Structures  Trees
date: 2026-05-20
excerpt: Notes on tree anatomy, types, traversals, and complexity.
---

A **tree** is a non-linear, hierarchical data structure consisting of nodes connected by edges. Unlike arrays or linked lists, trees allow for efficient searching and structured data organization. These notes cover the core anatomy, common variants, traversal patterns, and complexity trade-offs.

## Anatomy of a Tree

- **Root:** the topmost node (has no parent)
- **Edge:** the connection between two nodes
- **Parent:** a node that has children
- **Child:** a node derived from another node
- **Sibling:** nodes sharing the same parent
- **Leaf (External Node):** a node with no children
- **Internal Node:** a node with at least one child
- **Height:** longest path from a node to a leaf
- **Depth:** distance from root to a node
- **Degree:** number of children of a node

## Classification of Trees

### Binary Trees (Foundation)

A tree where each node has at most **2 children**.

- **Binary Search Tree (BST):** left child < parent < right child. Used for fast lookup on sorted data. Average O(log n), worst O(n).
- **Full Binary Tree:** each node has either 0 or 2 children.
- **Complete Binary Tree:** all levels filled except possibly the last (filled left to right).
- **Perfect Binary Tree:** all internal nodes have 2 children and all leaves are at the same level.

### Self-Balancing Trees

- **AVL Tree:** balance factor ∈ {-1, 0, 1}. Strictly balanced best for frequent searches.
- **Red-Black Tree:** relaxed balancing rules. Used in C++ `std::map` and Java `TreeMap` — best for frequent insert/delete.

### Storage & Search Trees

- **B-Tree / B+ Tree:** optimized for disk access. Used in databases and file systems.
- **Trie (Prefix Tree):** used for autocomplete and spell check.

## Tree Traversals

Depth-first traversals:

- **Inorder:** Left → Node → Right
- **Preorder:** Node → Left → Right
- **Postorder:** Left → Right → Node

Breadth-first traversal:

- **Level Order:** uses a queue

## Binary Search Tree (BST)

Properties:

- Left subtree values < root
- Right subtree values > root

Operations (balanced case):

- Search: O(log n)
- Insert: O(log n)
- Delete: O(log n)

## Common Tree Problems

- Check if a tree is balanced
- Find the height of a tree
- Lowest Common Ancestor (LCA)
- Diameter of a tree
- Path sum problems

## Performance Comparison

| Tree Type       | Search   | Insertion | Space | Best For                 |
|-----------------|----------|-----------|-------|--------------------------|
| BST             | O(log n) | O(log n)  | O(n)  | Simple sorted data       |
| AVL Tree        | O(log n) | O(log n)  | O(n)  | Fast lookups             |
| Red-Black Tree  | O(log n) | O(log n)  | O(n)  | Frequent updates         |
| B-Tree          | O(log n) | O(log n)  | O(n)  | Databases / disk storage |
| Trie            | O(L)     | O(L)      | O(AL) | Strings / autocomplete   |

## Key Takeaways

- Trees are hierarchical structures that trade linear simplicity for fast, structured access.
- Choose a BST for simple sorted data, a self-balancing tree (AVL / Red-Black) when worst-case guarantees matter, and B-Trees or Tries for disk-backed or string-heavy workloads.
- Mastering the four traversal patterns unlocks most interview-style tree problems.

---

Next steps: practice traversal problems, implement a BST from scratch, and solve LCA and diameter problems to internalize the patterns above.
