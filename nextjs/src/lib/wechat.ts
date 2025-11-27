/**
 * Send message to WeChat Work via Webhook
 */
export async function sendWeChatWorkMessage(webhookUrl: string, content: string) {
    try {
        if (!webhookUrl) {
            throw new Error('Webhook URL is required');
        }

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                msgtype: 'markdown',
                markdown: {
                    content: content,
                },
            }),
        });

        const data = await response.json();

        if (data.errcode !== 0) {
            throw new Error(`WeChat Work API error: ${data.errmsg}`);
        }

        return { success: true };
    } catch (error: any) {
        console.error('WeChat Work push error:', error);
        return { success: false, error: error.message };
    }
}
