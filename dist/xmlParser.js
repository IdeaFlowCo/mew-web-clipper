"use strict";
var XMLParser = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // services/xmlParser.ts
  var xmlParser_exports = {};
  __export(xmlParser_exports, {
    extractTextFromXML: () => extractTextFromXML,
    parseXML: () => parseXML
  });
  function parseXML(xmlText) {
    const parser = new DOMParser();
    return parser.parseFromString(xmlText, "text/xml");
  }
  function extractTextFromXML(xmlDoc) {
    const possibleTagNames = ["text", "transcript", "caption", "p"];
    let textElements = null;
    for (const tagName of possibleTagNames) {
      const elements = xmlDoc.getElementsByTagName(tagName);
      if (elements.length > 0) {
        textElements = elements;
        console.log(
          `[XML Parser] Found ${elements.length} elements with tag name: ${tagName}`
        );
        break;
      }
    }
    if (!textElements || textElements.length === 0) {
      console.log(
        "[XML Parser] No text elements found with standard tags, trying all elements"
      );
      const allElements = xmlDoc.getElementsByTagName("*");
      const textContainingElements = [];
      for (let i = 0; i < allElements.length; i++) {
        const element = allElements[i];
        if (element.textContent && element.textContent.trim()) {
          textContainingElements.push(element);
        }
      }
      if (textContainingElements.length > 0) {
        console.log(
          `[XML Parser] Found ${textContainingElements.length} elements with text content`
        );
        let transcript2 = "";
        for (let i = 0; i < textContainingElements.length; i++) {
          const text = textContainingElements[i].textContent || "";
          if (text.trim()) {
            transcript2 += text.trim() + "\\n";
          }
        }
        return transcript2.trim();
      }
      console.log(
        "[XML Parser] No text-containing elements found in the document"
      );
      return "No text content found in the XML document.";
    }
    let transcript = "";
    for (let i = 0; i < textElements.length; i++) {
      const element = textElements[i];
      const text = element.textContent || "";
      if (text.trim()) {
        const start = element.getAttribute("start");
        if (start) {
          const seconds = parseFloat(start);
          const minutes = Math.floor(seconds / 60);
          const remainingSeconds = Math.floor(seconds % 60);
          const timestamp = `[${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}]`;
          transcript += `${timestamp} ${text.trim()}\\n`;
        } else {
          transcript += text.trim() + "\\n";
        }
      }
    }
    return transcript.trim();
  }
  return __toCommonJS(xmlParser_exports);
})();

            // Expose XML parsing functions globally
            window.parseXML = XMLParser.parseXML;
            window.extractTextFromXML = XMLParser.extractTextFromXML;
        
//# sourceMappingURL=xmlParser.js.map
