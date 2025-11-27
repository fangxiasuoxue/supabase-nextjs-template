import { Resend } from 'resend';

// Initialize Resend with API key from environment variable or system config
// Note: In a real app, we might want to fetch this from system_configs if it's dynamic
// But for now, let's assume it's an env var or we'll fetch it in the action
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function sendEmail({
    to,
    subject,
    html,
}: {
    to: string | string[];
    subject: string;
    html: string;
}) {
    try {
        if (!resend) {
            console.warn('RESEND_API_KEY is not set');
            // For development/testing without key, we might want to just log it
            if (process.env.NODE_ENV === 'development') {
                console.log('Mock sending email:', { to, subject });
                return { success: true, id: 'mock-id' };
            }
            return { success: false, error: 'Email service not configured' };
        }

        const data = await resend.emails.send({
            from: 'System <onboarding@resend.dev>', // Default Resend testing sender
            to,
            subject,
            html,
        });

        if (data.error) {
            console.error('Resend error:', data.error);
            return { success: false, error: data.error.message };
        }

        return { success: true, id: data.data?.id };
    } catch (error: any) {
        console.error('Send email error:', error);
        return { success: false, error: error.message };
    }
}
