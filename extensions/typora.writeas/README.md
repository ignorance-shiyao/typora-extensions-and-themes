# Write.as

Install this independent extension and configure **Site** in its options. Run
**Sign In to Write.as** to store an API token, then **Publish to Write.as…**.
The API token is stored as plaintext in this extension's private storage,
never in Markdown. Sign Out removes it; revoke it at the service when needed.

Adapter key: `typora.writeas:writeas`. The shared publish protocol handles
incremental updates and remote conflict checks. Publication records are local
to this Typora profile; back up ExtensionData to preserve associations.
Use an explicit unique `publish_id` in front matter to retain identity across
file moves. Without it, the absolute file path is the identity.

Capabilities: metrics. Unsupported statistics or comments are
reported as unsupported, never zero. Read-only detail retrieval is available
through the adapter; a dedicated panel UI is not included in this extension.

The CLI requires a running desktop Typora with this extension enabled:

```sh
typora publish ./posts --to typora.writeas:writeas --dry-run
typora publish ./posts --to typora.writeas:writeas
typora publish status ./posts --to typora.writeas:writeas --refresh --json
```

## Credentials and endpoint

Set Site to `https://write.as` or your WriteFreely server and set **Blog alias** to the destination collection. Sign In accepts a user access token. The documented `POST /api/auth/login` endpoint exchanges your primary account alias and password for `data.access_token`; use that token, not an anonymous post editing token. See [authentication](https://developers.write.as/docs/api/#authenticate-a-user). No account password is stored by this extension.

## Third-party code

`vendor/marked.esm.js`: marked 16.4.2, MIT; see
`vendor/LICENSE-marked.md`. Used to discover local image references.
