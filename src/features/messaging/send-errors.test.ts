import { describe, expect, it } from 'vitest';
import { classifySendError } from './send-errors';

describe('cause d’un envoi en échec', () => {
  it('reconnaît les adresses email refusées', () => {
    expect(classifySendError('email', 'hard_bounce')).toBe('email_unknown');
    expect(classifySendError('email', 'invalid_email')).toBe('email_unknown');
    expect(classifySendError('email', 'EENVELOPE 550 550 5.1.1 <x@y.fr>: Recipient address rejected')).toBe(
      'email_unknown',
    );
    expect(classifySendError('email', '552 5.2.2 Mailbox full')).toBe('email_full');
    expect(classifySendError('email', '550 5.1.2 Host not found')).toBe('email_domain');
    expect(classifySendError('email', 'blocked')).toBe('email_blocked');
    expect(classifySendError('email', 'spam')).toBe('email_blocked');
  });
  it('reconnaît un service d’envoi mal configuré', () => {
    expect(classifySendError('email', 'EAUTH 535 Authentication failed')).toBe('config');
    expect(classifySendError('email', 'ECONNECTION connect ECONNREFUSED 127.0.0.1:587')).toBe('config');
    expect(classifySendError('whatsapp', 'WhatsApp 401 190 Error validating access token')).toBe('config');
    expect(classifySendError('whatsapp', 'WhatsApp 404 132001 Template name does not exist')).toBe('config');
  });
  it('reconnaît les refus de WhatsApp', () => {
    expect(classifySendError('whatsapp', '131026 Message undeliverable')).toBe('wa_not_whatsapp');
    expect(
      classifySendError('whatsapp', 'WhatsApp 400 131030 Recipient phone number not in allowed list'),
    ).toBe('wa_test');
    expect(classifySendError('whatsapp', 'WhatsApp 429 130429 Rate limit hit')).toBe('wa_limit');
    expect(classifySendError('whatsapp', '131042 Business eligibility payment issue')).toBe('wa_payment');
  });
  it('contact manquant, ou cause inconnue', () => {
    expect(classifySendError('email', 'pas d’email')).toBe('no_contact');
    expect(classifySendError('whatsapp', 'pas de téléphone')).toBe('no_contact');
    expect(classifySendError('email', 'quelque chose d’inattendu')).toBe('other');
    expect(classifySendError('email', null)).toBe('other');
  });
});
