import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { env } from '../config/env';

export class EmailService {
  private resend: Resend | null = null;
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const resendKey = env.RESEND_API_KEY || process.env.RESEND_API_KEY;
    if (resendKey && resendKey.trim()) {
      this.resend = new Resend(resendKey.trim());
    }

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (user && pass && user !== 'your-email@gmail.com') {
      this.transporter = nodemailer.createTransport({
        host: host || 'smtp.gmail.com',
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    }

    if (!this.resend && !this.transporter) {
      console.warn('⚠️ EmailService: Neither RESEND_API_KEY nor SMTP credentials configured. Email sending is disabled.');
    }
  }

  async sendWelcomeEmail(toEmail: string, name?: string): Promise<boolean> {
    const resendKey = env.RESEND_API_KEY || process.env.RESEND_API_KEY;
    if (!this.resend && resendKey && resendKey.trim()) {
      this.resend = new Resend(resendKey.trim());
    }

    if (!this.resend && !this.transporter) {
      console.warn(`[EmailService] Skipping welcome email to ${toEmail} (No RESEND_API_KEY or SMTP configured)`);
      return false;
    }

    const displayName = name ? name.split(' ')[0] : 'there';
    const primaryUrl = (process.env.CORS_ORIGIN || '').split(',')[0].trim() || 'https://www.velvethearts.in';
    const configuredFrom = process.env.EMAIL_FROM || 'Velvet Hearts <hello@velvethearts.in>';
    const logoUrl = `${primaryUrl}/velvet-heart-logo.png`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Velvet Hearts</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #0b0f17; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #f8fafc;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0f17; padding: 40px 10px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" style="max-width: 600px; background-color: #1e293b; border-radius: 16px; overflow: hidden; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                <!-- Header -->
                <tr>
                  <td style="padding: 28px 32px; text-align: center; background: linear-gradient(135deg, #1e1b4b 0%, #31103f 50%, #0f172a 100%);">
                    <table role="presentation" align="center" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 12px;">
                          <img src="${logoUrl}" alt="Velvet Hearts Logo" width="38" height="38" style="width: 38px; height: 38px; border-radius: 50%; display: block; border: 0;" />
                        </td>
                        <td style="vertical-align: middle;">
                          <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #ec4899; letter-spacing: 0.5px; line-height: 1;">
                            Velvet Hearts
                          </h1>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding: 32px 32px 24px 32px;">
                    <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #ffffff;">
                      Welcome, ${displayName}!
                    </h2>
                    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #cbd5e1;">
                      Your Velvet Hearts account has been successfully created! We’re excited to have you as part of our exclusive community where authentic relationships and meaningful connections begin.
                    </p>
                    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #cbd5e1;">
                      To get the best experience and find your ideal match, take a minute to complete your profile, share your story, and upload your favorite photos.
                    </p>
                    <!-- Button -->
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 28px auto;">
                      <tr>
                        <td align="center" style="border-radius: 25px; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%);">
                          <a href="${primaryUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 25px;">
                            Complete Your Profile
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 24px 0 0 0; font-size: 15px; line-height: 1.6; color: #cbd5e1;">
                      Warmly,<br>
                      <strong>The Velvet Hearts Team ❤️</strong>
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding: 24px 32px; background-color: #0f172a; text-align: center; border-top: 1px solid #334155;">
                    <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                      © ${new Date().getFullYear()} Velvet Hearts. All rights reserved.<br>
                      If you did not sign up for an account, please ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // 1. Primary: Use Resend API if configured
    if (this.resend) {
      try {
        let resendResponse = await this.resend.emails.send({
          from: configuredFrom,
          to: [toEmail],
          subject: 'Welcome to Velvet Hearts ❤️',
          html: htmlContent,
        });

        // Fallback to onboarding@resend.dev if custom domain is unverified on Resend
        if (resendResponse.error && (resendResponse.error.message?.includes('not verified') || resendResponse.error.statusCode === 403)) {
          console.warn(`[EmailService] Custom domain unverified on Resend. Retrying with onboarding@resend.dev...`);
          resendResponse = await this.resend.emails.send({
            from: 'Velvet Hearts <onboarding@resend.dev>',
            to: [toEmail],
            subject: 'Welcome to Velvet Hearts ❤️',
            html: htmlContent,
          });
        }

        if (resendResponse.error) {
          console.error(`[EmailService] Resend API error sending welcome email to ${toEmail}:`, resendResponse.error);
          return false;
        }

        console.log(`[EmailService] Welcome email successfully sent via Resend to ${toEmail} (ID: ${resendResponse.data?.id})`);
        return true;
      } catch (error) {
        console.error(`[EmailService] Failed sending welcome email via Resend to ${toEmail}:`, error);
        return false;
      }
    }

    // 2. Fallback: Use Nodemailer SMTP
    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: configuredFrom,
          to: toEmail,
          subject: 'Welcome to Velvet Hearts ❤️',
          html: htmlContent,
        });
        console.log(`[EmailService] Welcome email successfully sent via SMTP to ${toEmail}`);
        return true;
      } catch (error) {
        console.error(`[EmailService] Failed sending welcome email via SMTP to ${toEmail}:`, error);
        return false;
      }
    }

    return false;
  }
}
