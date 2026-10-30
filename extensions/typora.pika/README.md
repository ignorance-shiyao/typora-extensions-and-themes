# Pika

Install this independent extension and enter **Site** and **App token** in its
options, then run **Publish to Pika…**. Create it in Pika under **Settings → App tokens**.

Saving the options checks the key with Pika, so a wrong one shows up in the
form. Because every publish needs it, it is then kept in your system's
credential store: the Keychain on macOS, encrypted for your account on Windows,
the desktop keyring on Linux. It never goes into your documents or Typora's
settings, and it is sent only to pika.page. **Sign Out of Pika** deletes it from
this computer; revoke it at the service as well if the computer is no longer
yours. On Linux without a keyring, saving warns you first: see
[Publishing](https://docs.typora.io/guide/publish).

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
