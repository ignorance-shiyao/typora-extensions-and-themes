# Mataroa

Install this independent extension and enter **Site** and **API Key** in its
options, then run **Publish to Mataroa…**. It is shown on [mataroa.blog/api/docs](https://mataroa.blog/api/docs/) while you are logged in, where you can also reset it.

Saving the options checks the key with Mataroa, so a wrong one shows up in the
form. Because every publish needs it, it is then kept in your system's
credential store: the Keychain on macOS, encrypted for your account on Windows,
the desktop keyring on Linux. It never goes into your documents or Typora's
settings, and it is sent only to mataroa.blog. **Sign Out of Mataroa** deletes it from
this computer; revoke it at the service as well if the computer is no longer
yours. On Linux without a keyring, saving warns you first: see
[Publishing](https://docs.typora.io/guide/publish).

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
