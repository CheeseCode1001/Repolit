import nodemailer from "nodemailer";
import { logger } from "./logger";

// We'll use ethereal email for testing if no SMTP is configured,
// or you can configure a real SMTP server in production via .env
const SMTP_HOST = process.env.SMTP_HOST || "smtp.ethereal.email";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

let transporter: nodemailer.Transporter | null = null;

async function getTransporter() {
  if (transporter) return transporter;

  if (SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  } else {
    // Generate test SMTP service account from ethereal.email if no credentials provided
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    logger.warn({ user: testAccount.user }, "Using Ethereal Email for testing. Check ethereal.email for received messages.");
  }
  return transporter;
}

export async function sendVerificationEmail(to: string, code: string, username: string) {
  try {
    const t = await getTransporter();
    
    // In a real app, this would be a link to your frontend /verify-email?code=...&email=...
    const verifyUrl = `${process.env.APP_BASE_URL || "http://localhost:5173"}/verify-email?code=${code}&email=${encodeURIComponent(to)}`;

    const info = await t.sendMail({
      from: '"Repolit" <noreply@repolit.app>',
      to,
      subject: "Welcome to Repolit - Please verify your email",
      html: `
        <div style="font-family: monospace; padding: 20px; background-color: #f4f4f5; color: #18181b;">
          <h2>Welcome, @${username}!</h2>
          <p>Thanks for signing up for Repolit. Please verify your email address to get started.</p>
          <a href="${verifyUrl}" style="display: inline-block; padding: 10px 20px; background-color: #760BF7; color: white; text-decoration: none; font-weight: bold; border-radius: 4px;">
            Verify Email
          </a>
          <p style="margin-top: 20px; font-size: 12px; color: #71717a;">
            Or copy and paste this link in your browser:<br>
            <a href="${verifyUrl}">${verifyUrl}</a>
          </p>
        </div>
      `,
    });
    
    logger.info({ messageId: info.messageId, to }, "Verification email sent");
    if (!SMTP_USER) {
      logger.info({ url: nodemailer.getTestMessageUrl(info) }, "Preview URL");
    }
  } catch (err) {
    logger.error({ err, to }, "Failed to send verification email");
  }
}

export async function sendWelcomeEmail(to: string, username: string) {
  try {
    const t = await getTransporter();
    
    const info = await t.sendMail({
      from: '"Repolit" <noreply@repolit.app>',
      to,
      subject: "Welcome to the Repolit Community!",
      html: `
        <div style="font-family: monospace; padding: 20px; background-color: #f4f4f5; color: #18181b;">
          <h2>Welcome aboard, @${username}! 🎉</h2>
          <p>Your email has been successfully verified.</p>
          <p>You can now start analyzing repositories, earning points, and sharing insights.</p>
          <p>Happy coding!</p>
          <p>— The Repolit Team</p>
        </div>
      `,
    });
    
    logger.info({ messageId: info.messageId, to }, "Welcome email sent");
    if (!SMTP_USER) {
      logger.info({ url: nodemailer.getTestMessageUrl(info) }, "Preview URL");
    }
  } catch (err) {
    logger.error({ err, to }, "Failed to send welcome email");
  }
}

export async function sendWelcomeBackEmail(to: string, username: string) {
  try {
    const t = await getTransporter();
    
    const info = await t.sendMail({
      from: '"Repolit" <noreply@repolit.app>',
      to,
      subject: "Welcome back to Repolit!",
      html: `
        <div style="font-family: monospace; padding: 20px; background-color: #f4f4f5; color: #18181b;">
          <h2>Welcome back, @${username}! 👋</h2>
          <p>We noticed a new login to your Repolit account.</p>
          <p>If this was you, you can safely ignore this email. If not, please secure your account immediately.</p>
        </div>
      `,
    });
    
    logger.info({ messageId: info.messageId, to }, "Welcome back email sent");
    if (!SMTP_USER) {
      logger.info({ url: nodemailer.getTestMessageUrl(info) }, "Preview URL");
    }
  } catch (err) {
    logger.error({ err, to }, "Failed to send welcome back email");
  }
}
