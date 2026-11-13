/**
 * Adaptateurs d'envoi : une interface commune par canal, une implémentation réelle et une factice
 * (développement et tests). Le choix se fait par EMAIL_PROVIDER / WHATSAPP_PROVIDER.
 */
import { createHmac } from 'node:crypto';
import nodemailer, { type Transporter } from 'nodemailer';
import { getEnv } from '../env';
import { logger } from '../logger';

// ---------------------------------------------------------------------------
//  Email
// ---------------------------------------------------------------------------

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  /** identifiant pour afficher l'image dans le HTML : <img src="cid:…"> */
  cid?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
}

export interface EmailProvider {
  readonly name: string;
  send(msg: EmailMessage): Promise<{ messageId: string }>;
  verify?(): Promise<void>;
}

export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';
  private transport: Transporter;
  constructor() {
    const env = getEnv();
    const secure = env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : env.SMTP_PORT === 465;
    this.transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? '' } : undefined,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });
  }
  async send(msg: EmailMessage) {
    const env = getEnv();
    try {
      const info = await this.transport.sendMail({
        from: env.MAIL_FROM,
        replyTo: env.MAIL_REPLY_TO,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        attachments: msg.attachments,
      });
      return { messageId: info.messageId };
    } catch (err) {
      throw smtpError(err);
    }
  }
  async verify() {
    await this.transport.verify();
  }
}

/**
 * Erreur SMTP lisible (« EENVELOPE 550 5.1.1 … ») ; un refus définitif (code 5xx) n'est pas réessayé.
 * Les coupures réseau et les refus temporaires (4xx) le sont (voir worker-core).
 */
export function smtpError(err: unknown): Error & { retryable: boolean } {
  const e = err as { code?: string; responseCode?: number; response?: string; message?: string };
  const text = [e.code, e.responseCode, e.response ?? e.message].filter(Boolean).join(' ');
  const permanent = typeof e.responseCode === 'number' && e.responseCode >= 500 && e.responseCode < 600;
  return Object.assign(new Error(text || String(err)), { retryable: !permanent });
}

/** Factice : garde les messages en mémoire (tests) et les journalise sans contenu personnel. */
export class FakeEmailProvider implements EmailProvider {
  readonly name = 'fake';
  readonly outbox: EmailMessage[] = [];
  private n = 0;
  async send(msg: EmailMessage) {
    this.outbox.push(msg);
    this.n += 1;
    logger.info({ provider: 'fake-email' }, 'email simulé');
    return { messageId: `<fake-${Date.now()}-${this.n}@mariage.test>` };
  }
}

// ---------------------------------------------------------------------------
//  WhatsApp
// ---------------------------------------------------------------------------

export interface TemplateMessage {
  /** numéro E.164 */
  to: string;
  template: string;
  lang: string;
  /** paramètres du corps {{1}}, {{2}}… */
  bodyParams: string[];
  /** paramètre du bouton (modèle d'authentification : code à copier) */
  buttonParam?: string;
}

export interface WhatsAppProvider {
  readonly name: string;
  sendTemplate(msg: TemplateMessage): Promise<{ messageId: string }>;
}

export class WhatsAppSendError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

/** Charge utile de l'API WhatsApp Cloud (testée). */
export function cloudPayload(msg: TemplateMessage) {
  const components: Array<Record<string, unknown>> = [
    { type: 'body', parameters: msg.bodyParams.map((text) => ({ type: 'text', text })) },
  ];
  if (msg.buttonParam) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: msg.buttonParam }],
    });
  }
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: msg.to.replace(/^\+/, ''),
    type: 'template',
    template: { name: msg.template, language: { code: msg.lang }, components },
  };
}

export class CloudWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'cloud';
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}
  async sendTemplate(msg: TemplateMessage) {
    const env = getEnv();
    const url = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.WHATSAPP_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify(cloudPayload(msg)),
    });
    const data = (await res.json().catch(() => ({}))) as {
      messages?: Array<{ id: string }>;
      error?: { message?: string; code?: number };
    };
    if (!res.ok || !data.messages?.[0]) {
      const retryable = res.status >= 500 || res.status === 429 || data.error?.code === 130429;
      throw new WhatsAppSendError(
        `WhatsApp ${res.status} ${data.error?.code ?? ''} ${data.error?.message ?? ''}`.trim(),
        retryable,
      );
    }
    return { messageId: data.messages[0].id };
  }
}

export class FakeWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'fake';
  readonly sent: TemplateMessage[] = [];
  async sendTemplate(msg: TemplateMessage) {
    this.sent.push(msg);
    logger.info({ provider: 'fake-whatsapp', template: msg.template }, 'WhatsApp simulé');
    return { messageId: `wamid.fake.${Date.now()}.${this.sent.length}` };
  }
}

/** Vérifie la signature X-Hub-Signature-256 d'un webhook Meta (HMAC-SHA256 du corps brut). */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  const given = header.slice('sha256='.length);
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

// ---------------------------------------------------------------------------
//  Sélection
// ---------------------------------------------------------------------------

interface Registry {
  email?: EmailProvider;
  whatsapp?: WhatsAppProvider;
}
const registry = ((globalThis as Record<string, unknown>).__rcgnProviders ??= {}) as Registry;

export function getEmailProvider(): EmailProvider {
  registry.email ??= getEnv().EMAIL_PROVIDER === 'smtp' ? new SmtpEmailProvider() : new FakeEmailProvider();
  return registry.email;
}

export function getWhatsAppProvider(): WhatsAppProvider {
  registry.whatsapp ??=
    getEnv().WHATSAPP_PROVIDER === 'cloud' ? new CloudWhatsAppProvider() : new FakeWhatsAppProvider();
  return registry.whatsapp;
}

/** Tests : remplace les fournisseurs. */
export function setProviders(p: Registry): void {
  registry.email = p.email;
  registry.whatsapp = p.whatsapp;
}
