# WordPress

Get a Typora document into WordPress without the stray `<span>`s, `<body>`
and styles of an HTML export ([typora-issues#1609](https://github.com/typora/typora-issues/issues/1609)).
Three ways, all from the command palette:

| Command | What you get |
| --- | --- |
| **WordPress: Copy for WordPress (Blocks)** | Block-editor markup: headings, paragraphs, lists, quotes, code, tables, images and separators arrive as real blocks. Paste it into a post. |
| **WordPress: Copy for WordPress (Classic Editor)** | Clean HTML for the *Text* tab of the classic editor. Paragraphs are separated by blank lines, without `<p>` tags, because WordPress adds those itself (an option keeps them). |
| **WordPress: Publish to WordPress…** | Creates a post on your site through the WordPress REST API, as a draft by default. Publishing the same document again updates that post. |

**Sign Out of WordPress** forgets the saved Application Password.

Front matter is never part of the content. When the document starts with a
`# Heading` that is its title, the heading becomes the post title rather
than the first line of the post (*Leave the title heading out*).

## Publishing

1. In WordPress, open **Users ▸ Profile**, scroll to **Application
   Passwords**, enter a name such as "Typora" and click **Add New
   Application Password**. Copy the password it shows.
2. In Typora, open **Settings ▸ Extensions ▸ WordPress ▸ Options** and enter
   your site's address (`https://example.com`, or the folder WordPress is
   installed in) and, optionally, your user name.
3. Run **Publish to WordPress…**. The first time, it asks for your user name
   and the Application Password.

Application Passwords need HTTPS (or a site in local development) and a
WordPress with the REST API turned on, which is the default since 5.6.
Sites without pretty permalinks are reached at `?rest_route=`.

These front matter keys are read:

| Key | Use |
| --- | --- |
| `title` | Post title. Otherwise the leading `# Heading`, otherwise the file name. |
| `slug` | The post's URL slug. |
| `excerpt` (or `description`) | The excerpt. |
| `tags` | A list or a comma-separated string. Missing tags are created. |
| `categories` (or `category`) | Matched by name or slug. Missing ones are created if your role allows it. |
| `status` | `draft`, `pending`, `private` or `publish`; overrides the option. |
| `date` | `2026-10-17` or `2026-10-17 09:30`, in the site's time zone. |
| `featured_image` (or `cover`, `image`) | A local image to upload and set as the featured image. |
| `wordpress_id`, `wordpress_url` | Written after the first publish, so the next one updates the same post. Delete them to publish a new post. |

Publishing a post publicly, or updating one that is live, asks first.
Updating keeps a post's status unless the front matter sets one.

## Images

Publishing uploads the images stored on your computer — Markdown images and
`<img src>` with a relative path, an absolute path or a `file:` URL — to the
site's **Media Library**, and the post links to the uploaded copies. Image
blocks are tied to their attachments, so WordPress offers its usual sizes
and editing for them. Your document isn't changed: it keeps pointing at the
files on your computer.

- Each image is uploaded once per site. Typora remembers the uploads by
  their contents, so publishing again, or another post using the same file,
  reuses them; a changed file is uploaded again.
- Images on the web stay as they are.
- An image that can't be read or uploaded keeps its local address in the
  post, and the final message names it. A user whose role can't upload
  media (contributors) still gets the post, without the images.
- The front matter's `featured_image` (or `cover`, or `image`) becomes the
  post's featured image when it is a local image. Use the same file in the
  document, as Typora only reads images the document shows.

Turn off *Upload local images* in the options to leave local images out;
the final message then says how many weren't uploaded.

Math is kept as `$…$` / `$$…$$` text for a math plugin such as KaTeX or
MathJax to draw. Task lists become ☐ / ☑ items, and `==highlight==`,
`~sub~` and `^sup^` become `<mark>`, `<sub>` and `<sup>`.

## Permissions

- `network: {config.siteUrl}` — only the site you enter in the options, and
  nothing until you do. The copy commands never use the network.
- `document: "write"` — reads the document to convert it (and the local
  images it shows, to upload them), and adds
  `wordpress_id` / `wordpress_url` to its front matter after publishing (one
  undoable edit).
- `clipboard` — the two copy commands.

The Application Password is kept in the extension's private storage in
Typora's settings folder, and only sent to your site. The same storage
keeps the list of uploaded images (their checksums and Media Library ids). **Sign Out of
WordPress**, or uninstalling the extension, removes it. You can also revoke
it in WordPress at any time.

## Third-party code

`vendor/marked.esm.js` is [marked](https://github.com/markedjs/marked)
16.4.2 unchanged from npm (`marked/lib/marked.esm.js`), MIT license in
`vendor/LICENSE-marked.md`.
