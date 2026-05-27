const nodemailer = require('nodemailer');

function createTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) return null;

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });
}

async function sendQrVisita({ to, nombre, qrBase64, expiraEn }) {
  const transporter = createTransporter();
  if (!transporter) {
    throw new Error('Servicio de correo no configurado. Agrega GMAIL_USER y GMAIL_APP_PASSWORD al archivo .env');
  }

  const expiraTexto = expiraEn
    ? new Date(expiraEn).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })
    : '24 horas';

  // Strip data URI prefix if present
  const base64Data = qrBase64.replace(/^data:image\/\w+;base64,/, '');

  await transporter.sendMail({
    from: `"Club Deportivo" <${process.env.GMAIL_USER}>`,
    to,
    subject: `Tu código QR de acceso — ${nombre}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
        <h2 style="color:#1e3a5f;margin:0 0 8px;">Código QR de acceso</h2>
        <p style="color:#475569;margin:0 0 16px;">Hola <strong>${nombre}</strong>, aquí está tu código QR para acceder al club.</p>
        <div style="text-align:center;padding:16px 0;">
          <img src="cid:qr_visita" alt="QR de acceso" style="width:220px;height:220px;border:4px solid #1e3a5f;border-radius:8px;" />
        </div>
        <p style="color:#64748b;font-size:13px;text-align:center;margin:8px 0 0;">Válido hasta: <strong>${expiraTexto}</strong></p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;" />
        <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0;">Presenta este correo en recepción para que escaneen tu código.</p>
      </div>
    `,
    attachments: [{
      filename: 'qr_acceso.png',
      content: base64Data,
      encoding: 'base64',
      cid: 'qr_visita'
    }]
  });
}

module.exports = { sendQrVisita };
