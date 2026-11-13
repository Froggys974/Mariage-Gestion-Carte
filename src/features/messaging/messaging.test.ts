import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { cloudPayload, smtpError, verifyMetaSignature } from '~/lib/messaging/providers';
import { backoffMs, MAX_ATTEMPTS, mapBrevoEvent, mapWhatsAppStatus, statusRank } from './worker-core';
import { DEMO_WEDDING } from '../wedding/demo';
import { weddingLabels } from '../wedding/wedding';
import { cardEmail, escapeHtml, invitationEmail, otpEmail } from './templates';

const w = weddingLabels(DEMO_WEDDING);

const input = {
  first: 'Marie-Ange',
  link: 'https://m.re/i/ODpIYKP2La9V6XE0plvjVA',
  deadlineLabel: '1er décembre',
  namesImageUrl: 'https://m.re/media/card/names-1.png' as string | null,
  publicUrl: 'https://m.re',
};

describe('gabarits d’email', () => {
  it('contiennent le bouton vers le lien personnel, l’image des noms et une version texte', () => {
    const e = invitationEmail(w, input);
    expect(e.html).toContain('href="https://m.re/i/ODpIYKP2La9V6XE0plvjVA"');
    expect(e.html).toContain('src="https://m.re/media/card/names-1.png"');
    expect(e.html).toContain('alt="Camille &amp; Alex"');
    expect(e.subject).toBe('Faire‑part · Camille & Alex · 12 juin 2027');
    expect(e.html).toContain('12 · 06 · 2027');
    expect(e.text).toContain('le samedi 12 juin 2027 : Église Saint-Pierre, Saint-Pierre.');
    expect(e.text).toContain('Église Saint-Pierre · Saint-Pierre · La Réunion');
    expect(e.text).toContain(input.link);
    expect(e.text).toContain("jusqu'au 1er décembre");
    expect(e.html).toContain('lang="rcf"');
  });
  it('échappent le HTML des données', () => {
    const e = invitationEmail(w, { ...input, first: '<script>x</script>' });
    expect(e.html).not.toContain('<script>x');
    expect(escapeHtml(`"a"&<'`)).toBe('&quot;a&quot;&amp;&lt;&#39;');
  });
  it('code à 6 chiffres', () => {
    expect(otpEmail(w, { first: 'A', code: '123456', namesImageUrl: 'x' }).text).toContain('123456');
  });
  it('carte par email : image affichée dans le message (cid) et texte de secours', () => {
    const e = cardEmail(w, { first: 'Lucie', namesImageUrl: null });
    expect(e.subject).toBe('Votre faire‑part · Camille & Alex');
    expect(e.html).toContain('src="cid:faire-part"');
    expect(e.html).toContain('alt="Faire‑part de Camille &amp; Alex"');
    expect(e.text).toContain('Bonjour Lucie,');
  });
  it('écrivent les noms en texte tant que l’image des noms n’existe pas', () => {
    const e = invitationEmail(w, { ...input, namesImageUrl: null });
    expect(e.html).not.toContain('<img');
    expect(e.html).toContain('Camille &amp; Alex</div>');
  });
});

describe('WhatsApp Cloud API', () => {
  it('modèle faire_part_invitation avec {prénom} et {lien}', () => {
    const p = cloudPayload({
      to: '+262692112233',
      template: 'faire_part_invitation',
      lang: 'fr',
      bodyParams: ['Marie-Ange', input.link],
    });
    expect(p.to).toBe('262692112233');
    expect(p.template).toEqual({
      name: 'faire_part_invitation',
      language: { code: 'fr' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'Marie-Ange' },
            { type: 'text', text: input.link },
          ],
        },
      ],
    });
  });
  it('vérifie la signature du webhook (X-Hub-Signature-256)', () => {
    const body = '{"entry":[]}';
    const sig = 'sha256=' + createHmac('sha256', 'secret').update(body).digest('hex');
    expect(verifyMetaSignature(body, sig, 'secret')).toBe(true);
    expect(verifyMetaSignature(body + ' ', sig, 'secret')).toBe(false);
    expect(verifyMetaSignature(body, 'sha256=00', 'secret')).toBe(false);
    expect(verifyMetaSignature(body, null, 'secret')).toBe(false);
  });
  it('fait correspondre les statuts sans jamais redescendre (lu > délivré > envoyé)', () => {
    expect(mapWhatsAppStatus('delivered')).toBe('delivered');
    expect(mapWhatsAppStatus('read')).toBe('read');
    expect(mapWhatsAppStatus('failed')).toBe('failed');
    expect(statusRank('read')).toBeGreaterThan(statusRank('delivered'));
  });
});

describe('file d’envoi', () => {
  it('réessaie de plus en plus tard, jusqu’à 1 h', () => {
    expect(backoffMs(1)).toBe(30_000);
    expect(backoffMs(2)).toBe(60_000);
    expect(backoffMs(3)).toBe(120_000);
    expect(backoffMs(20)).toBe(3_600_000);
    expect(MAX_ATTEMPTS).toBeGreaterThanOrEqual(5);
  });
  it('traduit les événements Brevo', () => {
    expect(mapBrevoEvent('delivered')).toBe('delivered');
    expect(mapBrevoEvent('unique_opened')).toBe('read');
    expect(mapBrevoEvent('hard_bounce')).toBe('failed');
    expect(mapBrevoEvent('request')).toBeNull();
  });
});

describe('erreurs SMTP', () => {
  it('un refus définitif (5xx) n’est pas réessayé, un refus temporaire ou une coupure oui', () => {
    const hard = smtpError({ code: 'EENVELOPE', responseCode: 550, response: '550 5.1.1 User unknown' });
    expect(hard.retryable).toBe(false);
    expect(hard.message).toBe('EENVELOPE 550 550 5.1.1 User unknown');
    expect(
      smtpError({ code: 'EENVELOPE', responseCode: 451, response: '451 4.7.1 Try later' }).retryable,
    ).toBe(true);
    expect(smtpError({ code: 'ECONNECTION', message: 'connect ECONNREFUSED' }).retryable).toBe(true);
  });
});
