# Write.as

Install this independent extension and open its options. Enter **Site**, your
**User name** and **Password**, and the **Blog alias** to publish to, then run
**Publish to Write.as…**. Saving the options signs in straight away, so a wrong
password shows up in the form.

The password is sent once, over HTTPS, to the site you entered, and then
discarded: it is never stored. Typora keeps only the access token it gets
back, in your system's credential store: the Keychain on macOS, encrypted for
your account on Windows, the desktop keyring on Linux. The token never goes
into your documents or Typora's settings. **Sign Out of Write.as** deletes it
from this computer; revoke it at the service as well if the computer is no
longer yours. On Linux without a keyring, saving warns you first: see
[Publishing](https://docs.typora.io/guide/publish).

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

Set Site to `https://write.as` or your WriteFreely server and set **Blog alias** to the destination collection: the name in the blog's address, not its title. Sign in with your primary account, the first blog you created; the token then works for all of that user's blogs on that site. The options use the documented `POST /api/auth/login` endpoint, which exchanges the alias and password for `data.access_token`. See [authentication](https://developers.write.as/docs/api/#authenticate-a-user). **Sign In to Write.as** instead accepts an access token you already have (not an anonymous post editing token).

## Third-party code

`vendor/marked.esm.js`: marked 16.4.2, MIT; see
`vendor/LICENSE-marked.md`. Used to discover local image references.
