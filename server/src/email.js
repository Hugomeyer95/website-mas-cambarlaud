const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function sendMail({ to, subject, html }) {
  if (!resend) {
    console.warn('[email] RESEND_API_KEY manquant — email non envoyé. Sujet:', subject);
    console.warn('[email] Contenu prévu:\n', html);
    return { skipped: true };
  }
  try {
    const result = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'Mas Cambarlaud <onboarding@resend.dev>',
      to,
      subject,
      html,
    });
    return result;
  } catch (err) {
    console.error('[email] Échec de l\'envoi:', err);
    throw err;
  }
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

async function sendOwnerNotification(booking) {
  const base = process.env.PUBLIC_URL || 'http://localhost:3000';
  const approveUrl = `${base}/api/admin/decide?token=${booking.approve_token}&action=approve`;
  const rejectUrl = `${base}/api/admin/decide?token=${booking.reject_token}&action=reject`;
  const html = `
    <div style="font-family: Georgia, serif; color:#222; max-width:520px; margin:auto;">
      <h2 style="margin-bottom:0.2em;">Nouvelle demande de réservation</h2>
      <p style="color:#555; margin-top:0;">Mas Cambarlaud — ${formatDate(booking.start_date)} au ${formatDate(booking.end_date)}</p>
      <table style="width:100%; border-collapse:collapse; margin:1.2em 0;">
        <tr><td style="padding:6px 0; color:#888;">Voyageur</td><td style="padding:6px 0;"><strong>${booking.first_name} ${booking.last_name}</strong></td></tr>
        <tr><td style="padding:6px 0; color:#888;">Personnes</td><td style="padding:6px 0;">${booking.guests}</td></tr>
        <tr><td style="padding:6px 0; color:#888;">Email</td><td style="padding:6px 0;">${booking.email}</td></tr>
        <tr><td style="padding:6px 0; color:#888;">Téléphone</td><td style="padding:6px 0;">${booking.phone}</td></tr>
      </table>
      <p style="white-space:pre-wrap; background:#f6f3ec; padding:12px 14px; border-radius:6px;">${booking.message}</p>
      <div style="margin-top:1.6em; text-align:center;">
        <a href="${approveUrl}" style="display:inline-block; background:#2f6b4f; color:#fff; text-decoration:none; padding:12px 22px; border-radius:6px; margin-right:10px;">Valider les dates</a>
        <a href="${rejectUrl}" style="display:inline-block; background:#a33; color:#fff; text-decoration:none; padding:12px 22px; border-radius:6px;">Refuser</a>
      </div>
      <p style="color:#999; font-size:0.85em; margin-top:1.6em;">Les dates ne sont bloquées sur le site qu'une fois validées via ce lien.</p>
    </div>
  `;
  return sendMail({ to: process.env.OWNER_EMAIL || 'hugomeyer95@gmail.com', subject: `Demande de réservation — ${formatDate(booking.start_date)} au ${formatDate(booking.end_date)}`, html });
}

async function sendRequesterAck(booking) {
  const html = `
    <div style="font-family: Georgia, serif; color:#222; max-width:520px; margin:auto;">
      <h2>Votre demande a bien été reçue</h2>
      <p>Bonjour ${booking.first_name},</p>
      <p>Merci pour votre demande de séjour au Mas Cambarlaud du <strong>${formatDate(booking.start_date)}</strong> au <strong>${formatDate(booking.end_date)}</strong> pour ${booking.guests} personne(s).</p>
      <p>Ces dates ne sont pas encore bloquées : nous revenons vers vous très prochainement pour confirmer la disponibilité.</p>
      <p style="margin-top:2em; color:#888;">— Famille Poullet, Mas Cambarlaud</p>
    </div>
  `;
  return sendMail({ to: booking.email, subject: 'Mas Cambarlaud — Votre demande de séjour a bien été reçue', html });
}

async function sendDecisionEmail(booking, decision, personalMessage) {
  const approved = decision === 'approved';
  const msgBlock = personalMessage
    ? `<p style="white-space:pre-wrap; background:#f6f3ec; padding:12px 14px; border-radius:6px; margin:1.2em 0;">${personalMessage}</p>`
    : '';
  const html = `
    <div style="font-family: Georgia, serif; color:#222; max-width:520px; margin:auto;">
      <h2>${approved ? 'Vos dates sont confirmées !' : 'Votre demande n\'a pas pu être retenue'}</h2>
      <p>Bonjour ${booking.first_name},</p>
      <p>${approved
        ? `Votre séjour du <strong>${formatDate(booking.start_date)}</strong> au <strong>${formatDate(booking.end_date)}</strong> est confirmé. Nous avons hâte de vous accueillir au Mas Cambarlaud.`
        : `Malheureusement, nous ne pouvons pas confirmer votre demande du ${formatDate(booking.start_date)} au ${formatDate(booking.end_date)}. N'hésitez pas à nous contacter pour d'autres dates.`}</p>
      ${msgBlock}
      <p style="margin-top:2em; color:#888;">— Famille Poullet, Mas Cambarlaud</p>
    </div>
  `;
  return sendMail({ to: booking.email, subject: approved ? 'Mas Cambarlaud — Votre séjour est confirmé' : 'Mas Cambarlaud — Concernant votre demande', html });
}

module.exports = { sendOwnerNotification, sendRequesterAck, sendDecisionEmail };
