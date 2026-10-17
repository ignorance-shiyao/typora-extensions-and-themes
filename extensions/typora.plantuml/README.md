# PlantUML

Draws ` ```plantuml ` / ` ```puml ` and ` ```ditaa ` code blocks with
[PlantUML](https://plantuml.com). Choose how in *Settings ▸ Extensions ▸
PlantUML ▸ Options*:

| Draw with | Needs | Offline |
| --- | --- | --- |
| **plantuml command** (default) | `plantuml` on your PATH, e.g. `brew install plantuml` | Yes |
| **Java and plantuml.jar** | Java 11 or later and [plantuml.jar](https://plantuml.com/download); set the paths of both | Yes |
| **Kroki server** | A network connection; the source goes to [kroki.io](https://kroki.io) or your own Kroki | No |

A fence without `@startuml` (or `@startditaa`) is wrapped in one. Local
diagrams follow the dark appearance (`-darkmode`). ditaa is drawn as an
image: PlantUML only draws it as PNG.

PlantUML stays running between diagrams so only the first one waits for
Java to start. It quits after a minute without work, and when you close
the window or switch the extension off.

## Permissions

- `process: ["plantuml", "java"]` — runs `plantuml`, or `java` with your
  plantuml.jar (`-Djava.awt.headless=true -jar <jar> -tsvg -pipe …`),
  by name from your PATH or at the full path set in the options. Nothing
  else. Typora only allows this after you turn on *Settings ▸ Extensions ▸
  Allow extensions to run programs* and accept the permission.
- `network: ["https://kroki.io"]` — only with *Kroki server*: the fence's
  source is posted to `https://kroki.io/plantuml/svg` (or `/ditaa/svg`).
