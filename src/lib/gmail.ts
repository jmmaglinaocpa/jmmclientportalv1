interface SendInviteParams {
  recipientEmail: string;
  recipientName: string;
  customMessage?: string;
  appUrl: string;
  accessToken: string;
}

export function createRfc822Email(
  to: string, 
  fromName: string, 
  fromEmail: string, 
  subject: string, 
  htmlBody: string
): string {
  const emailLines = [
    `To: ${to}`,
    `From: ${fromName} <${fromEmail}>`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    htmlBody
  ];
  const emailString = emailLines.join('\r\n');
  
  const utf8Bytes = new TextEncoder().encode(emailString);
  let binary = '';
  const bytes = new Uint8Array(utf8Bytes);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sendInviteEmail({ 
  recipientEmail, 
  recipientName, 
  customMessage, 
  appUrl, 
  accessToken 
}: SendInviteParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const subject = `Client Portal Invitation - Jan Michael Maglinao, CPA`;
  
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F8F9FA; margin: 0; padding: 24px; color: #0A192F; }
    .card { max-width: 580px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #E2E8F0; }
    .header { background-color: #0A192F; padding: 28px 32px; text-align: left; border-bottom: 3px solid #D4AF37; }
    .brand-title { color: #F8F9FA; font-size: 20px; font-weight: 700; margin: 0; letter-spacing: -0.3px; }
    .brand-subtitle { color: #D4AF37; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px; display: block; }
    .content { padding: 32px; font-size: 15px; line-height: 1.6; color: #1E293B; }
    .greeting { font-size: 18px; font-weight: 700; color: #0A192F; margin-bottom: 16px; }
    .message-box { background-color: #FFFDF5; border-left: 4px solid #D4AF37; padding: 16px 20px; border-radius: 8px; margin: 20px 0; font-style: italic; color: #334155; }
    .btn-container { text-align: center; margin: 32px 0 24px 0; }
    .btn { background-color: #D4AF37; color: #0A192F; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 12px; display: inline-block; box-shadow: 0 2px 8px rgba(212,175,55,0.3); }
    .footer { background-color: #F1F5F9; padding: 20px 32px; font-size: 12px; color: #64748B; text-align: center; border-top: 1px solid #E2E8F0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand-title">Jan Michael Maglinao, CPA</div>
      <span class="brand-subtitle">Certified Public Accountant • Client Portal</span>
    </div>
    <div class="content">
      <div class="greeting">Hello ${recipientName},</div>
      <p>Jan Michael Maglinao, CPA has invited you to access your personal CPA Client Portal.</p>
      <p>In your secure portal, you can view filed tax returns, access deliverables, and review pending document requests for your account.</p>
      
      ${customMessage ? `
        <div class="message-box">
          <strong>Note from Jan Michael Maglinao, CPA:</strong><br>
          "${customMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}"
        </div>
      ` : ''}

      <div class="btn-container">
        <a href="${appUrl}" class="btn">Activate Your Client Portal</a>
      </div>

      <p style="font-size: 13px; color: #64748B;">
        To activate your account, simply click the button above and sign in with your Google account (<strong>${recipientEmail}</strong>).
      </p>
    </div>
    <div class="footer">
      <strong>Jan Michael Maglinao, CPA</strong><br>
      Email: jm.maglinao.cpa@gmail.com • Client Portal Access<br>
      If you did not expect this invitation, please disregard this email.
    </div>
  </div>
</body>
</html>
  `;

  const raw = createRfc822Email(
    recipientEmail,
    'Jan Michael Maglinao, CPA',
    'jm.maglinao.cpa@gmail.com',
    subject,
    htmlBody
  );

  try {
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gmail API Error response:', errorData);
      return {
        success: false,
        error: errorData?.error?.message || `Gmail API error (status ${response.status})`
      };
    }

    const data = await response.json();
    return { success: true, messageId: data.id };
  } catch (err: any) {
    console.error('Failed to send invite email:', err);
    return { success: false, error: err?.message || 'Network or authorization error sending email' };
  }
}
