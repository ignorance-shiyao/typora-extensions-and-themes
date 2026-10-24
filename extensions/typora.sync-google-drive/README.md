# Google Drive Sync

Adds Google Drive to Settings → File → Favorite Folders & Sync. Typora owns per-file scheduling, automatic three-way text merging, and recovery copies.

Enable Drive API, configure the consent screen and test users, then register a **Desktop app** OAuth client. Fill Client ID and the client secret returned for that desktop registration into Typora's connection form. They use the host credential store; do not embed them in this extension. Sign-in uses PKCE and a random localhost callback port.

After signing in, browse and select the remote folder; Typora saves its stable folder ID automatically. The full Drive scope is used to access an existing folder; public distribution requires the relevant Google verification. Ordinary files are supported. Export Google-native documents first. Duplicate names stop synchronization without deleting either copy. A server that omits ETags or ignores conditional operations is rejected during connection.

Requires the desktop sync-provider host API; real-account acceptance requires your OAuth registration. No production client ID is included.
