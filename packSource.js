const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

const OUTPUT_FILENAME = "ReactNativeSource.zip";

// Paths to exclude
const EXCLUDED_DIRS = [
  "node_modules",
  ".git",
  ".expo",
  ".gradle",
  "android/.gradle",
  "ios/Pods",
  "build",
  "dist",
  ".idea",
  ".vscode",
  "web-build"
];

// Helper function to check if a file or folder should be excluded
function isExcluded(relativePath) {
  return EXCLUDED_DIRS.some(dir => relativePath.startsWith(dir));
}

// Create output zip stream
const output = fs.createWriteStream(OUTPUT_FILENAME);
const archive = archiver("zip", { zlib: { level: 9 } });

output.on("close", () => {
  console.log(`✅ Created '${OUTPUT_FILENAME}' (${archive.pointer()} total bytes)`);
});

archive.on("error", err => {
  throw err;
});

archive.pipe(output);

// Recursive function to add files
function addFiles(dir, base = "") {
  const items = fs.readdirSync(dir);
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const relativePath = path.join(base, item);

    if (isExcluded(relativePath)) {
      return;
    }

    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      addFiles(fullPath, relativePath);
    } else {
      archive.file(fullPath, { name: relativePath });
    }
  });
}

// Start archiving
addFiles(process.cwd());
archive.finalize();
