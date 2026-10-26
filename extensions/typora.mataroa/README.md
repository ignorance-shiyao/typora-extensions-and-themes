# Mataroa

Install this independent extension and configure **Site** in its options. Run
**Sign In to Mataroa** to store an API token, then **Publish to Mataroa…**.
The API token is stored as plaintext in this extension's private storage,
never in Markdown. Sign Out removes it; revoke it at the service when needed.

Adapter key: `typora.mataroa:mataroa`. The shared publish protocol handles
incremental updates and remote conflict checks. Publication records are local
to this Typora profile; back up ExtensionData to preserve associations.
Use an explicit unique `publish_id` in front matter to retain identity across
file moves. Without it, the absolute file path is the identity.

Capabilities: draft, comments. Unsupported statistics or comments are
reported as unsupported, never zero. Read-only detail retrieval is available
through the adapter; a dedicated panel UI is not included in this extension.

The CLI requires a running desktop Typora with this extension enabled:

```sh
typora publish ./posts --to typora.mataroa:mataroa --dry-run
typora publish ./posts --to typora.mataroa:mataroa
typora publish status ./posts --to typora.mataroa:mataroa --refresh --json
```

## Credentials and endpoint

Use the API key from your Mataroa account. Set Site to your actual blog URL, not the central API URL. The extension calls `https://mataroa.blog/api/` using that key. See [Mataroa API](https://mataroa.blog/api/docs/).

## Third-party code

`vendor/marked.esm.js`: marked 16.4.2, MIT; see
`vendor/LICENSE-marked.md`. Used to discover local image references.
