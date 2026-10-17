---
typora-snippet:
  description: An ```erd fence with two entities and a relationship
  prefix: [erd]
---
```erd
[{{1:Author}}]
*id
name

[Book]
*id
title
+author_id

{{1:Author}} 1--* Book
```
