---
typora-snippet:
  description: A ```wavedrom fence with a clock and a data bus
  prefix: [wavedrom]
---
```wavedrom
{ signal: [
  { name: "clk", wave: "p......" },
  { name: "{{1:data}}", wave: "x.345x.", data: ["a", "b", "c"] },
  { name: "valid", wave: "0.1..0." }
]}
```
