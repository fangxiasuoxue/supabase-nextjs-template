// QR Code Service
// Generates QR codes for node URLs and uploads to Supabase Storage

import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/server';

export class QRCodeService {
    /**
     * Generate QR code and upload to Supabase Storage
     */
    async generateAndUpload(nodeUrl: string, nodeId: string): Promise<string> {
        try {
            // Generate QR code as data URL
            const qrCodeDataUrl = await QRCode.toDataURL(nodeUrl, {
                errorCorrectionLevel: 'M',
                type: 'image/png',
                width: 300,
                margin: 1,
            });

            // Convert data URL to buffer
            const base64Data = qrCodeDataUrl.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');

            // Upload to Supabase Storage
            const supabase = await createClient();
            const fileName = `${nodeId}.png`;

            const { data, error } = await supabase.storage
                .from('qrcodes')
                .upload(fileName, buffer, {
                    contentType: 'image/png',
                    upsert: true,
                });

            if (error) {
                throw new Error(`Failed to upload QR code: ${error.message}`);
            }

            return data.path;
        } catch (error) {
            throw new Error(`QR code generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get public URL for QR code
     */
    async getPublicUrl(path: string): Promise<string> {
        const supabase = await createClient();
        const { data } = supabase.storage
            .from('qrcodes')
            .getPublicUrl(path);

        return data.publicUrl;
    }

    /**
     * Generate QR code as base64 data URL (without uploading)
     */
    async generateDataUrl(nodeUrl: string): Promise<string> {
        try {
            return await QRCode.toDataURL(nodeUrl, {
                errorCorrectionLevel: 'M',
                type: 'image/png',
                width: 300,
                margin: 1,
            });
        } catch (error) {
            throw new Error(`QR code generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Delete QR code from storage
     */
    async delete(path: string): Promise<void> {
        const supabase = await createClient();
        const { error } = await supabase.storage
            .from('qrcodes')
            .remove([path]);

        if (error) {
            throw new Error(`Failed to delete QR code: ${error.message}`);
        }
    }
}

// Export singleton instance
export const qrCodeService = new QRCodeService();
