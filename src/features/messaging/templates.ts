/**
 * Gabarits d'email (HTML responsive à tableaux + version texte) aux couleurs de la carte.
 * Les noms en Pinyon Script sont une IMAGE (les clients mail ne chargent pas les polices web), avec un texte
 * de remplacement ; tant que l'image n'existe pas (carte jamais enregistrée), les noms sont écrits en italique.
 * Noms, date et lieu viennent des infos du mariage (`w`).
 */
import { email as t, plain } from '~/content/fr';
import type { WeddingLabels } from '../wedding/wedding';

export interface EmailParts {
  subject: string;
  html: string;
  text: string;
}

export interface LinkEmailInput {
  first: string;
  link: string;
  deadlineLabel: string;
  /** URL absolue de l'image des noms, ou null (noms écrits en texte) */
  namesImageUrl: string | null;
  publicUrl: string;
}

const COLORS = {
  page: '#0b1a13',
  paper: '#fbf7ee',
  paperEnd: '#f1e7d1',
  ink: '#1c3326',
  ink2: '#40543f',
  sepia: '#7a6a45',
  filet: '#c9b483',
  gold: '#e5b96b',
  onGold: '#14261c',
} as const;

export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

function names(w: WeddingLabels, url: string | null): string {
  return url
    ? `<img src="${escapeHtml(url)}" width="320" alt="${escapeHtml(w.couplePlain)}" style="display:block;width:100%;max-width:320px;height:auto;margin:18px auto 6px;border:0;color:${COLORS.ink};font-family:Georgia,serif;font-size:30px;font-style:italic;">`
    : `<div style="margin:18px auto 6px;font-family:Georgia,'Cormorant Garamond',serif;font-size:34px;line-height:1.2;font-style:italic;color:${COLORS.ink};">${escapeHtml(w.couple)}</div>`;
}

function layout(
  w: WeddingLabels,
  o: { preheader: string; namesImageUrl: string | null; body: string },
): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${escapeHtml(w.couple)}</title>
<style>
  @media (max-width: 520px) { .card { padding: 28px 20px !important; } .btn a { display: block !important; } }
</style>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.page};">
<tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
  <tr><td class="card" style="background:${COLORS.paper};background-image:linear-gradient(170deg,${COLORS.paper},${COLORS.paperEnd});border-radius:6px;padding:40px 36px;text-align:center;font-family:Georgia,'Cormorant Garamond',serif;color:${COLORS.ink};">
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:${COLORS.sepia};">${escapeHtml(w.dateDots)}</div>
    ${names(w, o.namesImageUrl)}
    <div style="width:44px;height:1px;background:${COLORS.filet};margin:14px auto 22px;line-height:1px;font-size:1px;">&nbsp;</div>
    ${o.body}
    <div style="margin-top:28px;font-size:15px;font-style:italic;color:${COLORS.ink2};" lang="rcf">${escapeHtml(plain(t.creole))}</div>
    <div style="margin-top:6px;font-size:17px;color:${COLORS.ink};">${escapeHtml(w.couple)}</div>
  </td></tr>
  <tr><td style="padding:18px 8px;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.8;letter-spacing:2px;text-transform:uppercase;color:rgba(247,243,234,.55);">${escapeHtml(t.footer(w))}</td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

function paragraph(s: string): string {
  return `<p style="margin:0 0 14px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:${COLORS.ink2};">${escapeHtml(s)}</p>`;
}

function button(label: string, href: string): string {
  return `<table role="presentation" class="btn" cellpadding="0" cellspacing="0" align="center" style="margin:10px auto 18px;"><tr><td style="border-radius:999px;background:${COLORS.gold};">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:16px 28px;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${COLORS.onGold};text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
</td></tr></table>`;
}

function fallbackLink(href: string): string {
  return `<p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${COLORS.sepia};">${escapeHtml(t.linkFallback)}<br><a href="${escapeHtml(href)}" style="color:${COLORS.ink};word-break:break-all;">${escapeHtml(href)}</a></p>`;
}

function textVersion(w: WeddingLabels, lines: string[]): string {
  return [...lines, '', plain(t.creole), w.couplePlain, t.footer(w)].join('\n');
}

export function invitationEmail(w: WeddingLabels, i: LinkEmailInput): EmailParts {
  const e = t.invitation;
  return {
    subject: e.subject(w),
    html: layout(w, {
      preheader: e.preheader,
      namesImageUrl: i.namesImageUrl,
      body:
        paragraph(e.hello(i.first)) +
        paragraph(e.body(w)) +
        button(e.cta, i.link) +
        paragraph(e.after(i.deadlineLabel)) +
        fallbackLink(i.link),
    }),
    text: textVersion(w, [
      e.hello(i.first),
      '',
      e.body(w),
      '',
      `${e.cta} : ${i.link}`,
      '',
      e.after(i.deadlineLabel),
    ]),
  };
}

export function lostLinkEmail(w: WeddingLabels, i: LinkEmailInput): EmailParts {
  const e = t.lostLink;
  return {
    subject: e.subject(w),
    html: layout(w, {
      preheader: e.preheader,
      namesImageUrl: i.namesImageUrl,
      body:
        paragraph(e.hello(i.first)) +
        paragraph(e.body) +
        button(e.cta, i.link) +
        paragraph(e.after) +
        fallbackLink(i.link),
    }),
    text: textVersion(w, [e.hello(i.first), '', e.body, i.link, '', e.after]),
  };
}

export function otpEmail(
  w: WeddingLabels,
  i: { first: string; code: string; namesImageUrl: string | null },
): EmailParts {
  const e = t.otp;
  const codeBlock = `<div style="margin:6px auto 18px;font-family:Helvetica,Arial,sans-serif;font-size:32px;letter-spacing:10px;font-weight:bold;color:${COLORS.ink};">${escapeHtml(i.code)}</div>`;
  return {
    subject: e.subject(w),
    html: layout(w, {
      preheader: e.preheader,
      namesImageUrl: i.namesImageUrl,
      body: paragraph(e.hello(i.first)) + paragraph(e.body) + codeBlock + paragraph(e.validity),
    }),
    text: textVersion(w, [e.hello(i.first), '', e.body, i.code, '', e.validity]),
  };
}

/** La carte du faire‑part : affichée dans l'email (image jointe « cid ») et jointe en PNG. */
export const CARD_CID = 'faire-part';

export function cardEmail(w: WeddingLabels, i: { first: string; namesImageUrl: string | null }): EmailParts {
  const e = t.card;
  const img = `<img src="cid:${CARD_CID}" width="440" alt="${escapeHtml(e.alt(w))}" style="display:block;width:100%;max-width:440px;height:auto;margin:6px auto 18px;border:0;border-radius:6px;box-shadow:0 10px 30px rgba(0,0,0,.18);">`;
  return {
    subject: e.subject(w),
    html: layout(w, {
      preheader: e.preheader,
      namesImageUrl: i.namesImageUrl,
      body: paragraph(e.hello(i.first)) + paragraph(e.body) + img,
    }),
    text: textVersion(w, [e.hello(i.first), '', e.body]),
  };
}

export function testEmail(w: WeddingLabels, namesImageUrl: string | null): EmailParts {
  return {
    subject: t.test.subject(w),
    html: layout(w, { preheader: t.test.body, namesImageUrl, body: paragraph(t.test.body) }),
    text: textVersion(w, [t.test.body]),
  };
}
