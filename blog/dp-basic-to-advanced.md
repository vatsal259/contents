---
title: State It. Cache It. Ace It. A Dynamic Programming Guide.
date: 2026-06-12
excerpt: A 7-day roadmap from recursion and memoization through knapsack, tree DP, bitmask DP, and interval DP - with curated LeetCode problems and contest-ready patterns.
---

# State It. Cache It. Ace It. A 7-Day Dynamic Programming Guide.

**Goal:** Build DP intuition from first principles to advanced state compression - enough to recognize patterns in contests and interviews, define states cleanly, and optimize when constraints allow.

**Prerequisites:** Recursion, arrays, basic problem-solving. No prior DP experience required.

**How to use this guide:** Follow the 7-day plan in order. Each day builds on the last. For every problem, force yourself to answer three questions before coding: *What is the state? What are the transitions? What are the base cases?*

---

## Week Plan Overview

| Day | Topics Covered | Focus |
| --- | --- | --- |
| 1 | Recursion, Memoization, Tabulation | Core concepts |
| 2 | 1D DP | State definition + space optimization |
| 3 | 2D DP on Grids | Paths, costs, combinatorics |
| 4 | DP on Strings | LCS, edit distance, palindromes |
| 5 | DP on Subsequences & Knapsack | Count, sum, and 0/1 choices |
| 6 | Tree DP, Bitmask DP, Interval DP | Advanced concepts |
| 7 | Mixed Practice + Mock Interview | Consolidate + apply |

---

## 1. Recursion & Memoization (Top-Down DP)

### Concepts

- **Recursion trees** - visualize how a naive recursive call fans out; spot repeated nodes.
- **Overlapping subproblems** - the same subproblem is solved many times; that's the signal for DP.
- **Memoization** - cache results in an array or map; each distinct state is computed once.

### Pattern: Top-Down DP

Define a recursive function whose parameters *are* the state. Before computing, check the cache. After computing, store the result. Same transition logic as bottom-up - only the evaluation order differs.

### Practice Problems

- [Fibonacci Number](https://leetcode.com/problems/fibonacci-number/) - LeetCode 509
- [Climbing Stairs](https://leetcode.com/problems/climbing-stairs/) - LeetCode 70
- [House Robber](https://leetcode.com/problems/house-robber/) - LeetCode 198
- [N-th Tribonacci Number](https://leetcode.com/problems/n-th-tribonacci-number/) - LeetCode 1137
- [Factorial with Memoization](https://www.geeksforgeeks.org/program-for-factorial-of-a-number/) - GeeksforGeeks · [Memoization tutorial](https://www.geeksforgeeks.org/memoization-1d-dp-tutorial/)

---

## 2. Tabulation (Bottom-Up DP)

### Concepts

- **Define `dp[]`** - what each index (or cell) represents must be unambiguous.
- **Base cases** - initialize boundary values before the main loop.
- **Transition logic** - express how `dp[i]` (or `dp[i][j]`) derives from smaller indices.
- **Iterative implementation** - fill the table in a dependency-respecting order (usually increasing index).

### Pattern: Bottom-Up DP

When you know the state space upfront and want predictable iteration (often easier to space-optimize), build the table iteratively. Top-down and bottom-up are equivalent when the state graph is the same.

### Practice Problems

- [Fibonacci Number](https://leetcode.com/problems/fibonacci-number/) - LeetCode 509 *(tabulated version)*
- [Min Cost Climbing Stairs](https://leetcode.com/problems/min-cost-climbing-stairs/) - LeetCode 746
- [House Robber II](https://leetcode.com/problems/house-robber-ii/) - LeetCode 213
- [Paint Fence](https://leetcode.com/problems/paint-fence/) - LeetCode 276

---

## 3. 1D DP

### Concepts

- **Space optimization** - if `dp[i]` only depends on `dp[i-1]` and `dp[i-2]`, replace the array with two variables.
- **State transitions in arrays** - the recurrence often walks left-to-right; each position aggregates information from prior positions.

### Pattern: Rolling Array / O(1) Space

After writing the full `dp[n]` solution, ask: *What's the farthest back any transition reads?* Keep only that many values.

### Practice Problems

- [Maximum Subarray](https://leetcode.com/problems/maximum-subarray/) - LeetCode 53 *(Kadane's Algorithm)*
- [Jump Game](https://leetcode.com/problems/jump-game/) - LeetCode 55
- [Jump Game II](https://leetcode.com/problems/jump-game-ii/) - LeetCode 45
- [Longest Increasing Subsequence](https://leetcode.com/problems/longest-increasing-subsequence/) - LeetCode 300
- [Delete and Earn](https://leetcode.com/problems/delete-and-earn/) - LeetCode 740

---

## 4. 2D DP on Grids

### Concepts

- **Grid traversal** - typically `dp[i][j]` = best answer reaching cell `(i, j)`.
- **Obstacle handling** - skip blocked cells; base row/column may differ.
- **Min cost / max paths** - same skeleton; change `min` vs `sum` vs `max` in the transition.

### Pattern: Grid DP

Fill row-by-row (or column-by-column). Transition from `(i-1, j)` and/or `(i, j-1)`. Watch boundaries: first row, first column, and obstacle cells.

### Practice Problems

- [Unique Paths](https://leetcode.com/problems/unique-paths/) - LeetCode 62
- [Unique Paths II](https://leetcode.com/problems/unique-paths-ii/) - LeetCode 63
- [Minimum Path Sum](https://leetcode.com/problems/minimum-path-sum/) - LeetCode 64
- [Dungeon Game](https://leetcode.com/problems/dungeon-game/) - LeetCode 174
- [Cherry Pickup](https://leetcode.com/problems/cherry-pickup/) - LeetCode 741

---

## 5. DP on Strings

### Concepts

- **Substrings vs subsequences** - contiguous vs can skip characters; different state dimensions.
- **Palindromes** - often interval DP on ranges, or expand-around-center for substrings.
- **Transformations** - insert / delete / replace map to three-way transitions on `(i, j)` indices.

### Pattern: Two-Pointer / 2D String DP

State `(i, j)` usually means "first `i` chars of `s`" vs "first `j` chars of `t`". Fill diagonally or by increasing `i + j`.

### Practice Problems

- [Longest Common Subsequence](https://leetcode.com/problems/longest-common-subsequence/) - LeetCode 1143
- [Longest Palindromic Subsequence](https://leetcode.com/problems/longest-palindromic-subsequence/) - LeetCode 516
- [Edit Distance](https://leetcode.com/problems/edit-distance/) - LeetCode 72
- [Longest Palindromic Substring](https://leetcode.com/problems/longest-palindromic-substring/) - LeetCode 5
- [Minimum Insertion Steps to Make a String Palindrome](https://leetcode.com/problems/minimum-insertion-steps-to-make-a-string-palindrome/) - LeetCode 1312

---

## 6. DP on Subsequences

### Concepts

- **Include / exclude strategy** - at each index, take the element or skip it.
- **Subset sum variations** - target sum, count of ways, existence check.
- **Counting solutions** - watch for double-counting; order may or may not matter.

### Pattern: Subset / Target DP

`dp[i][sum]` or `dp[sum]` after processing first `i` elements. Distinguish **0/1** (use each element once) from **unbounded** (reuse allowed).

### Practice Problems

- [Partition Equal Subset Sum](https://leetcode.com/problems/partition-equal-subset-sum/) - LeetCode 416 · classic: [Subset Sum Problem](https://www.geeksforgeeks.org/subset-sum-problem-dp-25/)
- [Target Sum](https://leetcode.com/problems/target-sum/) - LeetCode 494
- [Combination Sum IV](https://leetcode.com/problems/combination-sum-iv/) - LeetCode 377
- [Coin Change](https://leetcode.com/problems/coin-change/) - LeetCode 322
- [Coin Change II](https://leetcode.com/problems/coin-change-ii/) - LeetCode 518

---

## 7. 0/1 Knapsack and Variants

### Concepts

- **Pick / not pick** - binary choice per item; iterate items outer, capacity inner (or reverse for counting tricks).
- **Weight / value constraints** - maximize value under capacity, or minimize weight for target value.
- **Unbounded knapsack** - inner loop over capacity goes forward (reuse), not backward.

### Pattern: Knapsack

Classic: `dp[w] = max(dp[w], dp[w - weight[i]] + value[i])`. Backward iteration on `w` preserves 0/1 semantics. Forward iteration allows unlimited copies.

### Practice Problems

- [0-1 Knapsack Problem](https://www.geeksforgeeks.org/0-1-knapsack-problem/) - GeeksforGeeks · LC variant: [Ones and Zeroes](https://leetcode.com/problems/ones-and-zeroes/) - LeetCode 474
- [Best Time to Buy and Sell Stock with Cooldown](https://leetcode.com/problems/best-time-to-buy-and-sell-stock-with-cooldown/) - LeetCode 309 *(state-machine knapsack-style)*
- [Rod Cutting Problem](https://www.geeksforgeeks.org/cutting-a-rod-dp-13/) - GeeksforGeeks
- [Unbounded Knapsack](https://www.geeksforgeeks.org/unbounded-knapsack-repetition-allowed/) - GeeksforGeeks · LC variant: [Coin Change](https://leetcode.com/problems/coin-change/) - LeetCode 322

---

## 8. DP on Partitions

### Concepts

- **String / array segmentation** - cut into valid pieces; optimize over cut positions.
- **Cuts and breaks** - last cut determines the final segment; combine with prefix DP.
- **Optimization within partitions** - each segment may have its own sub-DP (e.g., palindrome check).

### Pattern: Partition DP

`dp[i]` = best answer for prefix `[0..i)`. Try all last cuts `j`: `dp[i] = best over j of dp[j] + cost(j+1..i)`.

### Practice Problems

- [Palindrome Partitioning II](https://leetcode.com/problems/palindrome-partitioning-ii/) - LeetCode 132
- [Partition Array for Maximum Sum](https://leetcode.com/problems/partition-array-for-maximum-sum/) - LeetCode 1043
- [Scramble String](https://leetcode.com/problems/scramble-string/) - LeetCode 87
- [Burst Balloons](https://leetcode.com/problems/burst-balloons/) - LeetCode 312

---

## 9. DP on Trees

### Concepts

- **Post-order traversal with DP** - solve children before parent; combine child results at each node.
- **Store subproblem state in children** - return structured info (e.g., `(withRoot, withoutRoot)` for robber problems).

### Pattern: Tree DP

DFS from leaves up. Each node returns aggregate stats from subtrees. Global answer may update during recursion (e.g., diameter, max path sum through a node).

### Practice Problems

- [Diameter of Binary Tree](https://leetcode.com/problems/diameter-of-binary-tree/) - LeetCode 543
- [House Robber III](https://leetcode.com/problems/house-robber-iii/) - LeetCode 337
- [Binary Tree Maximum Path Sum](https://leetcode.com/problems/binary-tree-maximum-path-sum/) - LeetCode 124
- [Longest Univalue Path](https://leetcode.com/problems/longest-univalue-path/) - LeetCode 687

---

## 10. Bitmask DP / State Compression

### Concepts

- **Use bits to represent state** - subset of elements, visited cities, board configuration.
- **TSP-style problems** - `dp[mask][i]` = min cost to visit set `mask` ending at `i`.
- **Subset optimization** - iterate masks in increasing order; transitions add or remove one bit.

### Pattern: Bitmask DP

State space is `O(2^n · n)` or `O(2^n · n^2)`. Only viable when `n ≤ 20` (roughly). Precompute transitions or use SOS (sum over subsets) when applicable.

### Practice Problems

- [Shortest Path Visiting All Nodes](https://leetcode.com/problems/shortest-path-visiting-all-nodes/) - LeetCode 847 · contest: [Traveling Salesman among Aerial Cities](https://atcoder.jp/contests/abc180/tasks/abc180_e) - AtCoder ABC180 E
- [Find the Shortest Superstring](https://leetcode.com/problems/find-the-shortest-superstring/) - LeetCode 943
- [Domino and Tromino Tiling](https://leetcode.com/problems/domino-and-tromino-tiling/) - LeetCode 790 · classic: [Tiling an n×2 grid](https://www.iarcs.org.in/inoi/online-study-material/topics/dp-tiling.php) - INOI
- [Connecting Cities With Minimum Cost](https://leetcode.com/problems/connecting-cities-with-minimum-cost/) - LeetCode 1135
- [Matching](https://atcoder.jp/contests/dp/tasks/dp_o) - AtCoder DP O *(bitmask assignment)*

---

## 11. Interval DP

### Concepts

- **Solve ranges `dp[i][j]`** - answer for subarray / substring from index `i` to `j`.
- **Solve smaller intervals first** - loop by length `len = 2..n`, then start `i`, set `j = i + len - 1`.
- **Split at `k`** - try every split point inside the interval; combine left and right sub-answers.

### Pattern: Interval DP

Classic examples: matrix chain multiplication, burst balloons, optimal palindrome partitioning. The *last operation* inside `[i, j]` is often the split key.

### Practice Problems

- [Burst Balloons](https://leetcode.com/problems/burst-balloons/) - LeetCode 312 · contest: [Slimes](https://atcoder.jp/contests/dp/tasks/dp_n) - AtCoder DP N
- [Matrix Chain Multiplication](https://www.geeksforgeeks.org/matrix-chain-multiplication-dp-8/) - GeeksforGeeks
- [Palindrome Partitioning II](https://leetcode.com/problems/palindrome-partitioning-ii/) - LeetCode 132
- [Minimum Score Triangulation of Polygon](https://leetcode.com/problems/minimum-score-triangulation-of-polygon/) - LeetCode 1039

---

## 12. DP Optimization Techniques

Advanced tools when naive `O(n²)` or `O(n³)` is too slow but the recurrence has structure:

| Technique | When it applies |
| --- | --- |
| **Sliding window on DP** | Transition is a sum/min over a fixed window of prior states |
| **Divide & Conquer DP** | Optimal split point `k` is monotonic in `i` or `j` |
| **Knuth Optimization** | Interval DP with quadrangle inequality on cost |
| **Monotonic queue DP** | Each transition is min/max over a range with sliding bounds |
| **Convex Hull Trick** | Linear functions added/removed; query minimum at `x` |

These are contest-grade refinements. Master standard DP first; revisit when you hit TLE on structured recurrences.

**Example problems for optimization patterns:**

- Sliding window on DP - [Maximum Sum of 3 Non-Overlapping Subarrays](https://leetcode.com/problems/maximum-sum-of-3-non-overlapping-subarrays/) - LeetCode 689
- Divide & Conquer DP - [Count of Range Sum](https://leetcode.com/problems/count-of-range-sum/) - LeetCode 327
- Monotonic queue DP - [Jump Game VI](https://leetcode.com/problems/jump-game-vi/) - LeetCode 1696
- Convex Hull Trick - [Data Structure problem (CF)](https://codeforces.com/problemset/problem/932/F)

---

## Final Practice (Mixed Bag)

Simulate a real interview or contest with these - they combine multiple patterns:

- [Decode Ways](https://leetcode.com/problems/decode-ways/) - LeetCode 91
- [Interleaving String](https://leetcode.com/problems/interleaving-string/) - LeetCode 97
- [Wildcard Matching](https://leetcode.com/problems/wildcard-matching/) - LeetCode 44
- [Maximum Profit in Job Scheduling](https://leetcode.com/problems/maximum-profit-in-job-scheduling/) - LeetCode 1235
- [Russian Doll Envelopes](https://leetcode.com/problems/russian-doll-envelopes/) - LeetCode 354

---

## Resources

| Resource | Link |
| --- | --- |
| LeetCode DP tag | [leetcode.com/tag/dynamic-programming](https://leetcode.com/tag/dynamic-programming/) |
| Grokking the DP Patterns | [Educative course](https://www.educative.io/courses/grokking-dynamic-programming) |
| Codeforces DP problems | [Problem set - tag: dp](https://codeforces.com/problemset?order=BY_RATING_ASC&tags=dp-3000) |
| AtCoder Educational DP Contest | [contest/dp - 26 problems A→Z](https://atcoder.jp/contests/dp) |
| GeeksforGeeks DP | [Dynamic Programming archive](https://www.geeksforgeeks.org/dynamic-programming/) |
| CP-Algorithms - DP overview | [Dynamic programming intro](https://cp-algorithms.com/dynamic_programming/intro-to-dp.html) |

---

## Key Takeaways

- **DP = optimal substructure + overlapping subproblems.** If subproblems don't overlap, you want divide-and-conquer or plain recursion, not a table.
- **State definition is 80% of the battle.** Write it in one sentence before any code: " `dp[i]` means … "
- **Top-down and bottom-up are dual views** of the same recurrence; pick based on clarity and space needs.
- **Knapsack, grid, string, and interval** cover most interview and Div2 DP problems; tree and bitmask are the main advanced extensions.
- **Optimize space last** - get correctness with full table first, then compress when dependencies are local.

---

**Author notes:** Work through problems in the order listed within each section. For each solve, tag the pattern name (e.g., "1D knapsack," "interval split at k"). Use the [Resources](#resources) table above for curated problem sets. After Day 7, pick one mixed-bag problem under timed conditions and explain your state aloud - that's the interview muscle.
