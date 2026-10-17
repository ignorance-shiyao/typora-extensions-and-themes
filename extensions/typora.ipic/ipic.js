// iPic — run by main.js as `osascript -l JavaScript -e <this file>`.
//
// Speaks iPic's uploader protocol (github.com/toolinbox/iPicUploader): iPic
// watches a private pasteboard; we ask for its protocol version, then hand it
// one archived image at a time and wait for the archived result.
//
// stdin:  JSON [{ name, path, data }] (data: base64 bytes; path may be null)
// stdout: one JSON line per image, { index, ok: true, url } or
//         { index, ok: false, error }; a fatal problem prints { fatal, code }
//         and exits with 3 (iPic isn't installed) or 4 (iPic doesn't answer).

ObjC.import("Foundation");
ObjC.import("AppKit");
ObjC.import("stdlib");

const BUNDLE_ID = "net.toolinbox.ipic";
const PASTEBOARD = "net.toolinbox.ipic.pasteboard";
const TYPE_IMAGE = "net.toolinbox.ipic.pasteboard.iPicImage";
const TYPE_RESULT = "net.toolinbox.ipic.pasteboard.iPicUploadResult";
const TYPE_VERSION = "net.toolinbox.ipic.pasteboard.iPicUploaderVersion";
const TYPE_VERSION_RESULT = "net.toolinbox.ipic.pasteboard.iPicUploaderVersionResult";
const UPLOADER_VERSION = 1;
const POLL_SECONDS = 0.25;
const env = (name) => ObjC.unwrap($.NSProcessInfo.processInfo.environment.objectForKey(name));
// The TYPORA_IPIC_* variables are for tests.
const VERSION_TIMEOUT = Number(env("TYPORA_IPIC_VERSION_TIMEOUT")) || 2;
const UPLOAD_TIMEOUT = Number(env("TYPORA_IPIC_UPLOAD_TIMEOUT")) || 30;

// The archive class names are iPic's; any class may stand in for them.
ObjC.registerSubclass({
  name: "TyporaIPicImage",
  superclass: "NSObject",
  protocols: ["NSCoding"],
  properties: { imageId: "id", imageFilePath: "id", imageData: "id" },
  methods: {
    "encodeWithCoder:": {
      types: ["void", ["id"]],
      implementation: function (coder) {
        coder.encodeObjectForKey(this.imageId, "id");
        if (!this.imageFilePath.isNil()) coder.encodeObjectForKey(this.imageFilePath, "imageFilePath");
        coder.encodeObjectForKey(this.imageData, "imageData");
        coder.encodeIntegerForKey(UPLOADER_VERSION, "version");
      },
    },
  },
});

ObjC.registerSubclass({
  name: "TyporaIPicResult",
  superclass: "NSObject",
  properties: { imageId: "id", imageLink: "id", errorText: "id" },
  methods: {
    "initWithCoder:": {
      types: ["id", ["id"]],
      implementation: function (coder) {
        this.imageId = coder.decodeObjectForKey("id");
        this.imageLink = coder.decodeObjectForKey("imageLink");
        const error = coder.decodeObjectForKey("error");
        this.errorText = error.isNil() ? $() : error.localizedDescription;
        return this;
      },
    },
  },
});

$.NSKeyedArchiver.setClassNameForClass("net.toolinbox.iPic.iPicImage", $.TyporaIPicImage);
$.NSKeyedUnarchiver.setClassForClassName($.TyporaIPicResult, "net.toolinbox.iPic.iPicUploadResult");

const pasteboard = $.NSPasteboard.pasteboardWithName(PASTEBOARD);
const stdout = $.NSFileHandle.fileHandleWithStandardOutput;

function print(value) {
  stdout.writeData($(JSON.stringify(value) + "\n").dataUsingEncoding($.NSUTF8StringEncoding));
}

function fail(message, code) {
  print({ fatal: message, code });
  $.exit(code);
}

function write(type, setValue) {
  pasteboard.clearContents;
  const item = $.NSPasteboardItem.alloc.init;
  setValue(item, type);
  pasteboard.writeObjects($([item]));
  return pasteboard.changeCount;
}

/** Wait until someone else changes the pasteboard and `accept` returns a value. */
function waitFor(since, seconds, accept) {
  const until = Date.now() + seconds * 1000;
  let seen = since;
  while (Date.now() < until) {
    delay(POLL_SECONDS);
    const count = pasteboard.changeCount;
    if (count === seen) continue;
    seen = count;
    const value = accept();
    if (value !== undefined) return value;
  }
  return undefined;
}

function isRunning() {
  return $.NSRunningApplication.runningApplicationsWithBundleIdentifier(BUNDLE_ID).count > 0;
}

/** Start iPic if it isn't running. Returns whether it had to be started. */
function launch() {
  if (env("TYPORA_IPIC_SKIP_LAUNCH") === "1") return false;
  if ($.NSWorkspace.sharedWorkspace.URLForApplicationWithBundleIdentifier(BUNDLE_ID).isNil())
    fail("iPic isn't installed. Get it from the Mac App Store.", 3);
  if (isRunning()) return false;
  const opened = $.NSWorkspace.sharedWorkspace.openURLOptionsConfigurationError(
    $.NSURL.URLWithString("ipic://"),
    $.NSWorkspaceLaunchWithoutActivation,
    $({}),
    null,
  );
  if (!opened || opened.isNil()) fail("iPic couldn't be opened.", 3);
  return true;
}

function versionOfIPic(started) {
  // A freshly started iPic needs a moment before it watches the pasteboard: ask again.
  const attempts = started ? 6 : 1;
  for (let i = 0; i < attempts; i++) {
    const since = write(TYPE_VERSION, (item, type) => item.setStringForType($(""), type));
    const version = waitFor(since, VERSION_TIMEOUT, () => {
      const text = pasteboard.stringForType(TYPE_VERSION_RESULT);
      return text.isNil() ? undefined : Number(ObjC.unwrap(text));
    });
    if (version !== undefined) return version;
  }
  fail("iPic didn't answer. Make sure iPic is running and up to date.", 4);
}

function imageData(entry) {
  if (entry.data) return $.NSData.alloc.initWithBase64EncodedStringOptions($(entry.data), 0);
  if (entry.path) return $.NSData.dataWithContentsOfFile($(entry.path));
  return $();
}

function upload(entry) {
  const data = imageData(entry);
  if (data.isNil() || data.length === 0) return { ok: false, error: "the file couldn't be read" };
  if ($.NSImage.alloc.initWithData(data).isNil()) return { ok: false, error: "iPic can't read this kind of image" };
  const image = $.TyporaIPicImage.alloc.init;
  const id = ObjC.unwrap($.NSUUID.UUID.UUIDString);
  image.imageId = $(id);
  image.imageFilePath = entry.path ? $(entry.path) : $();
  image.imageData = data;
  const archive = $.NSKeyedArchiver.archivedDataWithRootObject(image);
  const since = write(TYPE_IMAGE, (item, type) => item.setDataForType(archive, type));
  const result = waitFor(since, UPLOAD_TIMEOUT, () => {
    const bytes = pasteboard.dataForType(TYPE_RESULT);
    if (bytes.isNil()) return undefined;
    const decoded = $.NSKeyedUnarchiver.unarchiveObjectWithData(bytes);
    if (decoded.isNil() || ObjC.unwrap(decoded.imageId) !== id) return undefined;
    const link = ObjC.unwrap(decoded.imageLink);
    if (link) return { ok: true, url: link };
    return { ok: false, error: ObjC.unwrap(decoded.errorText) || "iPic couldn't upload it" };
  });
  return result ?? { ok: false, error: `iPic didn't finish within ${UPLOAD_TIMEOUT} seconds` };
}

function run() {
  const input = $.NSFileHandle.fileHandleWithStandardInput.readDataToEndOfFile;
  const entries = JSON.parse(ObjC.unwrap($.NSString.alloc.initWithDataEncoding(input, $.NSUTF8StringEncoding)) || "[]");
  const started = launch();
  if (versionOfIPic(started) < UPLOADER_VERSION) fail("This version of iPic is too old. Update it from the Mac App Store.", 4);
  entries.forEach((entry, index) => print({ index, ...upload(entry) }));
}
