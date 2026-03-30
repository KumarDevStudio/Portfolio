// utils/emailService.js
const nodemailer = require('nodemailer');
const { logger } = require('./helpers');

// ─── Transporter ─────────────────────────────────────────────
const createTransporter = () => {
  if (process.env.EMAIL_SERVICE === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS, // Use Gmail App Password
      },
    });
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// ─────────────────────────────────────────────────────────────
// CONTACT FORM EMAILS
// ─────────────────────────────────────────────────────────────

/**
 * Notify admin when new contact form is submitted
 */
const sendContactNotification = async (contact) => {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
      subject: `New Contact Form Submission: ${contact.subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">New Contact Form Submission</h2>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Name:</strong> ${contact.name}</p>
            <p><strong>Email:</strong> ${contact.email}</p>
            <p><strong>Subject:</strong> ${contact.subject}</p>
            ${contact.phone ? `<p><strong>Phone:</strong> ${contact.phone}</p>` : ''}
            ${contact.company ? `<p><strong>Company:</strong> ${contact.company}</p>` : ''}
            ${contact.projectType ? `<p><strong>Project Type:</strong> ${contact.projectType}</p>` : ''}
            ${contact.budget ? `<p><strong>Budget:</strong> ${contact.budget}</p>` : ''}
            ${contact.timeline ? `<p><strong>Timeline:</strong> ${contact.timeline}</p>` : ''}
          </div>
          <div style="background: #fff; padding: 20px; border-left: 4px solid #4F46E5; margin: 20px 0;">
            <p><strong>Message:</strong></p>
            <p style="white-space: pre-wrap;">${contact.message}</p>
          </div>
          <p style="color: #6b7280; font-size: 14px;">
            Submitted on ${new Date(contact.createdAt).toLocaleString()}
          </p>
          <p style="color: #6b7280; font-size: 12px;">
            IP: ${contact.ipAddress || 'N/A'}
          </p>
        </div>
      `,
    };
    await transporter.sendMail(mailOptions);
    logger.info(`Contact notification sent to ${mailOptions.to}`);
  } catch (error) {
    logger.error('Error sending contact notification:', error);
    throw error;
  }
};

/**
 * Send reply email to contact submitter
 */
const sendReplyEmail = async (recipientEmail, recipientName, replyMessage) => {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: recipientEmail,
      subject: 'Re: Your Message',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">Thank you for reaching out!</h2>
          <p>Hi ${recipientName},</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="white-space: pre-wrap;">${replyMessage}</p>
          </div>
          <p style="color: #6b7280; font-size: 14px;">
            Best regards,<br>
            ${process.env.SENDER_NAME || 'Kishan'}
          </p>
        </div>
      `,
    };
    await transporter.sendMail(mailOptions);
    logger.info(`Reply email sent to ${recipientEmail}`);
  } catch (error) {
    logger.error('Error sending reply email:', error);
    throw error;
  }
};

/**
 * Send confirmation email to contact submitter
 */
const sendConfirmationEmail = async (contact) => {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: contact.email,
      subject: 'Thank you for contacting us!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">Thank you for reaching out!</h2>
          <p>Hi ${contact.name},</p>
          <p>I've received your message and will get back to you as soon as possible.</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Your message:</strong></p>
            <p style="white-space: pre-wrap;">${contact.message}</p>
          </div>
          <p>I typically respond within 24-48 hours.</p>
          <p style="color: #6b7280; font-size: 14px;">
            Best regards,<br>
            ${process.env.SENDER_NAME || 'Kishan'}
          </p>
        </div>
      `,
    };
    await transporter.sendMail(mailOptions);
    logger.info(`Confirmation email sent to ${contact.email}`);
  } catch (error) {
    logger.error('Error sending confirmation email:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────
// SYSTEM / ADMIN EMAILS
// ─────────────────────────────────────────────────────────────

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (to, name, resetLink, expiresAt, isAdminInitiated = false) => {
  try {
    const transporter = createTransporter();
    const expiresIn = Math.round((new Date(expiresAt) - new Date()) / 60000);
    const initiatedText = isAdminInitiated
      ? 'An administrator has initiated a password reset for your account.'
      : 'You requested a password reset for your account.';

    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Admin System'}" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="background:#4F46E5;color:white;padding:20px;text-align:center;">Password Reset</h1>
          <p>Hello ${name},</p>
          <p>${initiatedText}</p>
          <p>
            <a href="${resetLink}"
              style="display:inline-block;padding:12px 30px;background:#4F46E5;color:#fff;
              text-decoration:none;border-radius:5px;">
              Reset Password
            </a>
          </p>
          <p>This link expires in ${expiresIn} minutes.</p>
        </div>
      `,
    };
    await transporter.sendMail(mailOptions);
    logger.info(`Password reset email sent to: ${to}`);
  } catch (error) {
    logger.error('Error sending password reset email:', error);
    throw error;
  }
};

/**
 * Send password reset confirmation email
 */
const sendPasswordResetConfirmation = async (to, name) => {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Admin System'}" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Password Reset Successful',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="background:#10B981;color:white;padding:20px;text-align:center;">✓ Password Reset Successful</h1>
          <p>Hello ${name},</p>
          <p>Your password has been successfully reset. You can now log in with your new password.</p>
        </div>
      `,
    };
    await transporter.sendMail(mailOptions);
    logger.info(`Password reset confirmation sent to: ${to}`);
  } catch (error) {
    logger.error('Error sending password reset confirmation:', error);
    throw error;
  }
};

/**
 * Send suspicious activity alert
 */
const sendSuspiciousActivityAlert = async (to, name, activityDetails) => {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Admin System'} Security" <${process.env.SMTP_USER}>`,
      to,
      subject: '⚠️ Suspicious Activity Detected',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="background:#EF4444;color:white;padding:20px;text-align:center;">⚠️ Security Alert</h1>
          <p>Hello ${name},</p>
          <p>Suspicious activity was detected on your account:</p>
          <ul>
            <li><strong>Activity:</strong> ${activityDetails.action}</li>
            <li><strong>Time:</strong> ${new Date(activityDetails.timestamp).toLocaleString()}</li>
            <li><strong>IP:</strong> ${activityDetails.ipAddress}</li>
            <li><strong>Location:</strong> ${activityDetails.location || 'Unknown'}</li>
            <li><strong>Device:</strong> ${activityDetails.deviceType}</li>
          </ul>
        </div>
      `,
    };
    await transporter.sendMail(mailOptions);
    logger.info(`Suspicious activity alert sent to: ${to}`);
  } catch (error) {
    logger.error('Error sending suspicious activity alert:', error);
    throw error;
  }
};

/**
 * Test email configuration
 */
const testEmailConfiguration = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    logger.info('Email configuration is valid');
    return true;
  } catch (error) {
    logger.error('Email configuration error:', error);
    return false;
  }
};

// ─────────────────────────────────────────────────────────────
// SUBSCRIBER / NEWSLETTER EMAILS
// ─────────────────────────────────────────────────────────────

/**
 * Build branded HTML email for new project notification
 */
const buildProjectEmailHTML = (project, subscriberEmail) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e40af,#7c3aed);border-radius:16px 16px 0 0;
              padding:36px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:#bfdbfe;letter-spacing:2px;text-transform:uppercase;">
                ${process.env.SENDER_NAME || 'Kishan'}.dev
              </p>
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;">
                New Project Launched 🚀
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#1e293b;padding:36px 40px;">
              <p style="margin:0 0 24px;font-size:15px;color:#94a3b8;line-height:1.6;">
                Hey there! I just shipped something new — here's a quick look:
              </p>

              <!-- Project Card -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#0f172a;border:1px solid #334155;border-radius:12px;
                overflow:hidden;margin-bottom:28px;">
                ${project.image ? `
                <tr>
                  <td>
                    <img src="${project.image}" alt="${project.title}"
                      style="width:100%;max-height:220px;object-fit:cover;display:block;
                      border-radius:12px 12px 0 0;"/>
                  </td>
                </tr>` : ''}
                <tr>
                  <td style="padding:24px;">
                    <h2 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#f1f5f9;">
                      ${project.title}
                    </h2>
                    <p style="margin:0 0 18px;font-size:14px;color:#94a3b8;line-height:1.7;">
                      ${project.description}
                    </p>

                    ${project.technologies && project.technologies.length > 0 ? `
                    <p style="margin:0 0 8px;font-size:12px;color:#64748b;
                      text-transform:uppercase;letter-spacing:1px;">Tech Stack</p>
                    <div style="margin-bottom:20px;">
                      ${project.technologies.map(tech => `
                        <span style="display:inline-block;background:#1e40af22;
                          border:1px solid #1e40af55;color:#93c5fd;font-size:12px;
                          padding:4px 10px;border-radius:20px;margin:0 6px 6px 0;">
                          ${tech}
                        </span>`).join('')}
                    </div>` : ''}

                    <!-- CTA Buttons -->
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        ${project.liveUrl ? `
                        <td style="padding-right:12px;">
                          <a href="${project.liveUrl}"
                            style="display:inline-block;
                            background:linear-gradient(135deg,#1e40af,#7c3aed);
                            color:#fff;font-size:14px;font-weight:600;
                            padding:11px 24px;border-radius:8px;text-decoration:none;">
                            View Live →
                          </a>
                        </td>` : ''}
                        ${project.githubUrl ? `
                        <td>
                          <a href="${project.githubUrl}"
                            style="display:inline-block;background:#1e293b;
                            border:1px solid #334155;color:#94a3b8;font-size:14px;
                            font-weight:600;padding:11px 24px;border-radius:8px;
                            text-decoration:none;">
                            GitHub
                          </a>
                        </td>` : ''}
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:14px;color:#64748b;line-height:1.6;">
                More projects coming soon. Stay tuned!<br/>
                <span style="color:#7c3aed;">— ${process.env.SENDER_NAME || 'Kishan'}</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0f172a;border-radius:0 0 16px 16px;padding:24px 40px;
              text-align:center;border-top:1px solid #1e293b;">
              <p style="margin:0 0 8px;font-size:12px;color:#475569;">
                You're receiving this because you subscribed at
                <a href="${process.env.CLIENT_URL || '#'}"
                  style="color:#7c3aed;text-decoration:none;">
                  ${process.env.CLIENT_URL || 'kishan.dev'}
                </a>
              </p>
              <p style="margin:0;font-size:12px;color:#334155;">
                Don't want updates?
                <a href="${process.env.CLIENT_URL}/unsubscribe?email=${encodeURIComponent(subscriberEmail)}"
                  style="color:#475569;text-decoration:underline;">Unsubscribe</a>
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

/**
 * Send new project notification to all active subscribers
 */
const sendProjectNotification = async (project, subscribers) => {
  if (!subscribers || subscribers.length === 0) {
    logger.info('No active subscribers to notify.');
    return { sent: 0, failed: 0 };
  }

  const transporter = createTransporter();
  let sent = 0;
  let failed = 0;

  logger.info(`Sending project notification to ${subscribers.length} subscriber(s)...`);

  for (const subscriber of subscribers) {
    try {
      await transporter.sendMail({
        from: `"${process.env.SENDER_NAME || 'Kishan'}" <${process.env.SMTP_USER}>`,
        to: subscriber.email,
        subject: `🚀 New Project: ${project.title}`,
        html: buildProjectEmailHTML(project, subscriber.email),
      });
      sent++;
      logger.info(`Project notification sent to ${subscriber.email}`);
    } catch (err) {
      failed++;
      logger.error(`Failed to notify ${subscriber.email}:`, err.message);
    }
  }

  logger.info(`Notification complete — Sent: ${sent}, Failed: ${failed}`);
  return { sent, failed };
};

// ─────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────
module.exports = {
  sendContactNotification,
  sendReplyEmail,
  sendConfirmationEmail,
  sendPasswordResetEmail,
  sendPasswordResetConfirmation,
  sendSuspiciousActivityAlert,
  testEmailConfiguration,
  sendProjectNotification,
};