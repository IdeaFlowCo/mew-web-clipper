import * as esbuild from "esbuild";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Define environment variables to include in the build
const env = {
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY || "",
};

console.log("Environment variables loaded for build process");

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

// Build background script and its dependencies
await esbuild.build({
    ...tsConfig,
    entryPoints: ["background.ts"],
    outfile: "dist/background.bundle.js",
    external: ["chrome"],
    define: {
        "process.env.YOUTUBE_API_KEY": JSON.stringify(
            process.env.YOUTUBE_API_KEY
        ),
    },
});

// Update manifest to point to bundled file
import fs from "fs";

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
manifest.background.service_worker = "dist/background.bundle.js";
fs.writeFileSync("manifest.json", JSON.stringify(manifest, null, 4));

console.log(
    "Build complete! Updated manifest.json to use bundled service worker."
);
