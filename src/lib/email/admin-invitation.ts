"use server";

import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface AdminInvitationData {
  email: string;
  name: string;
  tempPassword: string;
  role: "ADMIN" | "SUPER_ADMIN";
  invitedBy: string;
}

/**
 * Send invitation email to a new admin user.
 */
export async function sendAdminInvitationEmail(data: AdminInvitationData) {
  if (!resend) {
    console.warn("Resend API key not configured, skipping admin invitation email");
    return { success: false, error: "Email service not configured" };
  }

  const { email, name, tempPassword, role, invitedBy } = data;

  const roleLabel = role === "SUPER_ADMIN" ? "Super Administrator" : "Administrator";
  const loginUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/signin`;

  try {
    const result = await resend.emails.send({
      from: "AKILI Risk Intelligence <noreply@akilirisk.com>",
      to: [email],
      subject: `Welcome to AKILI Risk Intelligence - ${roleLabel} Access`,
      html: generateAdminInvitationHTML({
        name,
        email,
        role: roleLabel,
        tempPassword,
        loginUrl,
        invitedBy,
      }),
      text: generateAdminInvitationText({
        name,
        email,
        role: roleLabel,
        tempPassword,
        loginUrl,
        invitedBy,
      }),
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("Failed to send admin invitation email:", error);
    return { success: false, error: "Failed to send invitation email" };
  }
}

function generateAdminInvitationHTML(data: {
  name: string;
  email: string;
  role: string;
  tempPassword: string;
  loginUrl: string;
  invitedBy: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to AKILI Risk Intelligence</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      margin: 0;
      padding: 0;
      background-color: #f9fafb;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
      color: white;
      padding: 32px;
      text-align: center;
    }
    .header h1 {
      margin: 0 0 8px 0;
      font-size: 24px;
      font-weight: 600;
    }
    .header p {
      margin: 0;
      opacity: 0.9;
      font-size: 16px;
    }
    .content {
      padding: 32px;
    }
    .welcome-message {
      font-size: 18px;
      margin-bottom: 24px;
      color: #1f2937;
    }
    .credentials-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 20px;
      margin: 24px 0;
    }
    .credentials-box h3 {
      margin: 0 0 16px 0;
      color: #1f2937;
      font-size: 16px;
      font-weight: 600;
    }
    .credential-item {
      margin: 12px 0;
    }
    .credential-label {
      font-weight: 600;
      color: #374151;
      display: inline-block;
      width: 120px;
    }
    .credential-value {
      font-family: 'Monaco', 'Menlo', monospace;
      background: white;
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      display: inline-block;
      font-size: 14px;
    }
    .login-button {
      display: inline-block;
      background: #2563eb;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 24px 0;
    }
    .security-notice {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 6px;
      padding: 16px;
      margin: 24px 0;
    }
    .security-notice h4 {
      margin: 0 0 8px 0;
      color: #92400e;
      font-size: 14px;
      font-weight: 600;
    }
    .security-notice p {
      margin: 0;
      color: #92400e;
      font-size: 14px;
    }
    .footer {
      background: #f8fafc;
      padding: 24px 32px;
      border-top: 1px solid #e2e8f0;
      color: #6b7280;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to AKILI</h1>
      <p>Risk Intelligence Platform</p>
    </div>

    <div class="content">
      <div class="welcome-message">
        Hello ${data.name},
      </div>

      <p>You have been invited by ${data.invitedBy} to join AKILI Risk Intelligence as a <strong>${data.role}</strong>.</p>

      <p>Your account has been created and is ready to use. Please sign in using the credentials below and change your password immediately after your first login.</p>

      <div class="credentials-box">
        <h3>🔐 Your Login Credentials</h3>
        <div class="credential-item">
          <span class="credential-label">Email:</span>
          <span class="credential-value">${data.email}</span>
        </div>
        <div class="credential-item">
          <span class="credential-label">Password:</span>
          <span class="credential-value">${data.tempPassword}</span>
        </div>
      </div>

      <a href="${data.loginUrl}" class="login-button">Sign In to AKILI</a>

      <div class="security-notice">
        <h4>🔒 Security Notice</h4>
        <p>Please change your password immediately after your first login. This temporary password will expire in 48 hours for security purposes.</p>
      </div>

      <p>As a ${data.role}, you'll have access to:</p>
      <ul>
        <li>Platform administration tools</li>
        <li>User management capabilities</li>
        <li>System monitoring and analytics</li>
        ${data.role === "Super Administrator" ? "<li>Advanced configuration and user provisioning</li>" : ""}
      </ul>

      <p>If you have any questions or need assistance, please contact your system administrator.</p>
    </div>

    <div class="footer">
      <p>This invitation was sent to ${data.email}. If you did not expect this invitation, please contact your system administrator.</p>
      <p>&copy; 2024 AKILI Risk Intelligence. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function generateAdminInvitationText(data: {
  name: string;
  email: string;
  role: string;
  tempPassword: string;
  loginUrl: string;
  invitedBy: string;
}): string {
  return `
Welcome to AKILI Risk Intelligence

Hello ${data.name},

You have been invited by ${data.invitedBy} to join AKILI Risk Intelligence as a ${data.role}.

Your account has been created and is ready to use. Please sign in using the credentials below and change your password immediately after your first login.

LOGIN CREDENTIALS:
Email: ${data.email}
Password: ${data.tempPassword}

Sign in here: ${data.loginUrl}

SECURITY NOTICE:
Please change your password immediately after your first login. This temporary password will expire in 48 hours for security purposes.

As a ${data.role}, you'll have access to:
- Platform administration tools
- User management capabilities
- System monitoring and analytics
${data.role === "Super Administrator" ? "- Advanced configuration and user provisioning" : ""}

If you have any questions or need assistance, please contact your system administrator.

This invitation was sent to ${data.email}. If you did not expect this invitation, please contact your system administrator.

© 2024 AKILI Risk Intelligence. All rights reserved.
  `.trim();
}