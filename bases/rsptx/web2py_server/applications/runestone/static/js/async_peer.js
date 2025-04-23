import { sendMessage } from "./llm_call.js";

const messageInputField = document.getElementById("async-messageText");
const sendButton = document.getElementById("async-sendpeermsg");
const messageHistory = [];

/**
 * Creates a message element with the specified message, role, and author.
 * @param {string} messageText - Content of the message
 * @param {string} role - "gpt" or "peer"
 * @param {string} author - "gpt" or peer's name
 * @returns {HTMLDivElement} - The message element
 */
function createMessageElement(messageText, role, author) {
    const message = document.createElement("div");
    if (role === "peer") {
        message.classList.add("outgoing-mess");
    } else {
        message.classList.add("incoming-mess");
    }

    // Create sender element
    var sender = document.createElement("div");
    sender.classList.add("sender");

    // Create sender initials element
    var sender_initials = document.createElement("div");
    sender_initials.classList.add("sender-initials");
    let initials = author
        .split(" ") // Split name into parts
        .map(name => name.charAt(0)) // Get the first letter of each part
        .join("") // Join initials together
        .toUpperCase(); // Convert to uppercase
    sender_initials.textContent = initials;

    // Create sender name element
    var sender_name = document.createElement("div");
    sender_name.classList.add("sender-name");
    sender_name.textContent = author;

    // Append sender initials and name to sender
    sender.appendChild(sender_initials);
    sender.appendChild(sender_name);

    // Create message content element
    var content = document.createElement("div");
    content.classList.add("content");
    content.textContent = messageText;

    // Append sender and content to message
    message.appendChild(sender);
    message.appendChild(content);

    return message;
}

messageInputField.addEventListener("input", () => {
    if (messageInputField.value.length > 0) {
        sendButton.classList.remove("disabled");
    }
    else {
        sendButton.classList.add("disabled");
    }
});

messageInputField.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && messageInputField.value.length > 0) {
        sendButton.click();
    }
});

sendButton.addEventListener("click", async () => {
    const message = messageInputField.value.trim();
    if (!message) return;

    messageInputField.value = "";
    sendButton.classList.add("disabled");

    // 1. Render the user's message
    const userMessageElement = createMessageElement(message, "peer", "Ibrahim Moazzam");
    const messages = document.getElementById("messages");
    messages.appendChild(userMessageElement);

    // 2. Add the message to the message history
    messageHistory.push({
        role: "user",
        content: message
    });

    // 3. Show a loading message while waiting for the response
    const loadingMessageElement = createMessageElement("Typing...", "gpt", "GPT Peer");
    messages.appendChild(loadingMessageElement);
    messages.scrollTop = messages.scrollHeight;

    try {
        // 4. Send the message to the server and get the response from OpenAI
        const gptResponse = await sendMessage(messageHistory);

        // 5. Replace the loading message with the actual response
        messages.removeChild(loadingMessageElement);
        const responseElement = createMessageElement(gptResponse, "gpt", "GPT Peer");
        messages.appendChild(responseElement);
        messageHistory.push({
            role: "assistant",
            content: gptResponse
        });
        // messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (error) {
        console.error("Error sending message:", error);

        // Replace loading message with an error message
        messages.removeChild(loadingMessageElement);
        const errorElement = createMessageElement(
            "Sorry, there was an error in receiving your message. Please send it again.",
            "gpt",
            "GPT Peer"
        );
        messages.appendChild(errorElement);
    }
});

async function fetchSyntax (filepath) {
    try {
        const response = await fetch(filepath);

        if (!response.ok) {
            throw new Error(`Failed to load syntax: ${response.statusText}`);
        }

        const reSTSyntax = await response.text();
        return reSTSyntax;
    } catch (error) {
        console.error("Error loading reST syntax:", error);
    }
}

async function fetchQuestion (filepath) {
    try {
        const response = await fetch(filepath);

        if (!response.ok) {
            throw new Error(`Failed to load question: ${response.statusText}`);
        }

        const reSTQuestion = await response.text();
        return reSTQuestion;
    } catch (error) {
        console.error("Error loading reST question:", error);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const reSTSyntax = await fetchSyntax("/runestone/static/js/reST_syntax.rst");
        const reSTQuestion = await fetchQuestion("/runestone/static/js/example_question.rst");

        if (reSTSyntax && reSTQuestion) {
            try {
                messageHistory.push(
                    {
                        role: "developer",
                        "content": `Respond like you are a 20-year-old Python CS2 student in a Peer Instruction session, as defined by Eric Mazur, trying to convince your peer about the correct answer for a multiple-choice question.

                        Make sure you are student-like in your responses: informal and not verbose. Since you're also a CS2 student, don't be confident always since you're also learning alongside them in the class. You can also be wrong so that it feels like you're an actual peer and not ChatGPT.`
                    },
                    {
                        role: "developer",
                        "content": `The multiple-choice question is defined in reStructuredText using the following syntax: ${reSTSyntax}. It can contain the question prompt, answer choices, and feedback for each choice.

                        The question is as follows: ${reSTQuestion}.`
                    }
                )
            } catch (error) {
                console.error("Error parsing JSON:", error);
            }
        } else {
            console.warn("No question data or syntax found.");
        }


    } catch (error) {
        console.error("Error loading reST question or syntax:", error);
    }
});