export async function sendMessage(messageHistory) {
    try {
        const response = await fetch("/runestone/peer/get_gpt_response", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message_history: messageHistory })
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.error}`);
        }

        const data = await response.json();
        return data.reply;
    } catch (error) {
        return "Sorry, an error occurred while processing your message. Please send it again!";
    }
}