/* xmlParser.ts - Content script for XML parsing */

// Function to parse XML text into a document
export function parseXML(xmlText: string): Document {
    const parser = new DOMParser();
    return parser.parseFromString(xmlText, "text/xml");
}

// Function to extract text content from XML document
export function extractTextFromXML(xmlDoc: Document): string {
    // Try different tag names that YouTube might use for captions
    const possibleTagNames = ["text", "transcript", "caption", "p"];
    let textElements: HTMLCollectionOf<Element> | null = null;

    // Find the first tag name that has elements
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

    // If no elements found with any of the tag names, try a more generic approach
    if (!textElements || textElements.length === 0) {
        console.log(
            "[XML Parser] No text elements found with standard tags, trying all elements"
        );
        // Get all elements and filter for those that might contain text
        const allElements = xmlDoc.getElementsByTagName("*");
        const textContainingElements: Element[] = [];

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
            // Create a transcript from all text-containing elements
            let transcript = "";
            for (let i = 0; i < textContainingElements.length; i++) {
                const text = textContainingElements[i].textContent || "";
                if (text.trim()) {
                    transcript += text.trim() + "\\n";
                }
            }
            return transcript.trim();
        }

        console.log(
            "[XML Parser] No text-containing elements found in the document"
        );
        return "No text content found in the XML document.";
    }

    // Process the found text elements
    let transcript = "";
    for (let i = 0; i < textElements.length; i++) {
        const element = textElements[i];
        const text = element.textContent || "";

        if (text.trim()) {
            // Check if the element has a start attribute (timestamp)
            const start = element.getAttribute("start");
            if (start) {
                // Format timestamp as [MM:SS]
                const seconds = parseFloat(start);
                const minutes = Math.floor(seconds / 60);
                const remainingSeconds = Math.floor(seconds % 60);
                const timestamp = `[${minutes
                    .toString()
                    .padStart(2, "0")}:${remainingSeconds
                    .toString()
                    .padStart(2, "0")}]`;

                transcript += `${timestamp} ${text.trim()}\\n`;
            } else {
                transcript += text.trim() + "\\n";
            }
        }
    }

    return transcript.trim();
}
