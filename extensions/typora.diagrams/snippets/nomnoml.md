---
typora-snippet:
  description: A ```nomnoml fence with a small class diagram
  prefix: [nomnoml]
---
```nomnoml
[{{1:Document}}|title: String|save()]
[{{1:Document}}] +-> 0..* [Block]
[<abstract>Block]<:-[Paragraph]
```
