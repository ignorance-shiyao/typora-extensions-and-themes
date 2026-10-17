---
typora-snippet:
  description: A ```dot fence with a small directed graph
  prefix: [dot, graphviz]
---
```dot
digraph {
  rankdir=LR
  {{1:Draft}} -> Review -> Published
  Review -> {{1:Draft}} [label="changes"]
}
```
