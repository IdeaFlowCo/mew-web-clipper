// Script to clean and rebuild the extension
import * as fs from "fs";
import { execSync } from "child_process";
import path from "path";

console.log("🧹 Cleaning dist directory...");
try {
    // Create dist directory if it doesn't exist
    if (!fs.existsSync("dist")) {
        fs.mkdirSync("dist");
    } else {
        // Clean existing files
        const files = fs.readdirSync("dist");
        for (const file of files) {
            fs.unlinkSync(path.join("dist", file));
        }
    }
    console.log("✅ Dist directory cleaned");
} catch (err) {
    console.error("Error cleaning dist directory:", err);
    process.exit(1);
}

console.log("🔨 Rebuilding extension...");
try {
    execSync("npm run build", { stdio: "inherit" });
    console.log("✅ Extension rebuilt successfully");
} catch (err) {
    console.error("Error rebuilding extension:", err);
    process.exit(1);
}

console.log(
    "\n🚀 Extension rebuild complete! Follow these steps to update in browser:"
);
console.log("1. Go to chrome://extensions/ in Chrome");
console.log("2. Find the Mew Web Clipper extension");
console.log("3. Click the 'Reload' icon (circular arrow)");
console.log("4. Try the extension again with a YouTube video");
