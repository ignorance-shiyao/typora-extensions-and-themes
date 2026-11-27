# Mermaid examples for the store review

Rendered by scripts/harness/harness.mjs; each has to come back as SVG that
Typora accepts. The last four are from typora/typora-extensions-and-themes#4.

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B -->|yes| C[Done]
  B -->|no| A
```

```mermaid
sequenceDiagram
  Alice->>Bob: Hello
  Bob-->>Alice: Hi
```

```mermaid
flowchart LR
  A["line one<br>line two"] --> B
```

```mermaid
flowchart LR
  A["**bold**<br/>text"] --> B
```

```mermaid
block
  columns 1
  a["x&nbsp;y"]
```

```mermaid
flowchart LR
  A --> B
  click A "https://example.com"
```
