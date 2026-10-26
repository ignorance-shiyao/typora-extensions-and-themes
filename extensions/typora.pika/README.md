# Pika

Install this independent extension and configure **Site** in its options. Run
**Sign In to Pika** to store an API token, then **Publish to Pika…**.
The API token is stored as plaintext in this extension's private storage,
never in Markdown. Sign Out removes it; revoke it at the service when needed.

Adapter key: `typora.pika:pika`. The shared publish protocol handles
incremental updates and remote conflict checks. Publication records are local
to this Typora profile; back up ExtensionData to preserve associations.
Use an explicit unique `publish_id` in front matter to retain identity across
file moves. Without it, the absolute file path is the identity.

Capabilities: draft, media. Unsupported statistics or comments are
reported as unsupported, never zero. Read-only detail retrieval is available
through the adapter; a dedicated panel UI is not included in this extension.

The CLI requires a running desktop Typora with this extension enabled:

```sh
typora publish ./posts --to typora.pika:pika --dry-run
typora publish ./posts --to typora.pika:pika
typora publish status ./posts --to typora.pika:pika --refresh --json
```

## Credentials and endpoint

In Pika, open **Settings → App tokens** and create a token with create/update/media access. Set Site to your actual blog URL (including your custom domain), not `https://pika.page`. Requests use the central Pika Micropub endpoints. See [Pika Micropub](https://pika.page/manual/micropub).

## Third-party code

`vendor/marked.esm.js`: marked 16.4.2, MIT; see
`vendor/LICENSE-marked.md`. Used to discover local image references.
