---
typora-snippet:
  description: A ```vega-lite fence with a bar chart
  prefix: [vegalite, vega-lite]
---
```vega-lite
{
  "data": { "values": [
    { "month": "Jan", "{{1:sales}}": 28 },
    { "month": "Feb", "{{1:sales}}": 55 },
    { "month": "Mar", "{{1:sales}}": 43 }
  ] },
  "mark": "bar",
  "encoding": {
    "x": { "field": "month", "type": "ordinal", "sort": null },
    "y": { "field": "{{1:sales}}", "type": "quantitative" }
  }
}
```
