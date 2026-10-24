# Dropbox Sync

Adds Dropbox to Settings → File → Favorite Folders & Sync. Typora handles per-file scheduling, three-way Markdown merge and recovery copies.

Create a scoped Dropbox app, enable `files.metadata.read`, `files.content.read`, `files.content.write`, and `account_info.read`. Register `http://127.0.0.1:53682/callback` as its redirect URI. Fill App key as OAuth Client ID; leave Client Secret empty. Click Choose Remote Folder, sign in through your browser, then browse and confirm the destination folder. An App Folder app browses inside its app folder.

Requires the desktop sync-provider host API. Network access is limited to Dropbox API/content origins. Tokens are stored by Typora's OS credential store. Connections validate conditional writes/deletes before syncing. Real-account acceptance requires your OAuth registration; no production client ID is included.
