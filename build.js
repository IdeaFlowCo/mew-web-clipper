import * as esbuild from "esbuild";

const commonConfig = {
    bundle: true,
    format: "esm",
    target: "es2020",
    platform: "browser",
    sourcemap: true,
    minify: false,
};

// Special config for scripts that need to be loaded directly in the browser
const iifeBrowserConfig = {
    ...commonConfig,
    format: "iife", // Change to IIFE format for direct browser execution
};

const tsConfig = {
    ...commonConfig,
    loader: {
        ".ts": "ts",
    },
    resolveExtensions: [".ts", ".js"],
};

// Build XML parser script first as IIFE for direct browser execution
await esbuild.build({
    ...iifeBrowserConfig,
    loader: {
        ".ts": "ts",
    },
    resolveExtensions: [".ts", ".js"],
    entryPoints: ["services/xmlParser.ts"],
    outfile: "dist/xmlParser.js",
    globalName: "XMLParser", // Create a namespace for the exported functions
    footer: {
        js: `
            // Expose XML parsing functions globally
            window.parseXML = XMLParser.parseXML;
            window.extractTextFromXML = XMLParser.extractTextFromXML;
        `,
    },
});

// Build background script and its dependencies without bundling API keys
await esbuild.build({
    ...tsConfig,
    entryPoints: ["background.ts"],
    outfile: "dist/background.bundle.js",
    external: ["chrome"],
});

// Update manifest to point to bundled file
import fs from "fs";

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
// Update path to be relative for the dist copy
manifest.background.service_worker = "background.bundle.js";

// Save updated manifest to project root
fs.writeFileSync("manifest.json", JSON.stringify(manifest, null, 4));

// Also copy the manifest to dist directory
fs.writeFileSync("dist/manifest.json", JSON.stringify(manifest, null, 4));

// Make sure icons directory exists in dist
if (!fs.existsSync("dist/icons")) {
    fs.mkdirSync("dist/icons", { recursive: true });
}

// Copy icon files to dist/icons
const iconSizes = [16, 48, 128];
for (const size of iconSizes) {
    fs.copyFileSync(`icons/icon${size}.png`, `dist/icons/icon${size}.png`);
}

// Copy required web accessible resources
fs.copyFileSync("notification.css", "dist/notification.css");
fs.copyFileSync("notification.js", "dist/notification.js");

// Copy setup files
fs.copyFileSync("setup.html", "dist/setup.html");
fs.copyFileSync("setup.js", "dist/setup.js");

// Copy options/settings files
fs.copyFileSync("options.html", "dist/options.html");
fs.copyFileSync("options.js", "dist/options.js");

console.log(
    "Build complete! Updated manifest.json and copied necessary files to dist directory."
);
