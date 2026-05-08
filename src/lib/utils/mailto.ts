interface MailtoInviteOptions {
  to: string;
  subject: string;
  body: string;
}

export function openMailtoInvite({ to, subject, body }: MailtoInviteOptions): boolean {
  if (typeof window === 'undefined') return false;

  const recipient = to.trim();
  if (!recipient) return false;

  const href =
    `mailto:${encodeURIComponent(recipient)}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  window.location.href = href;
  return true;
}
