/**
 * TOUS les textes visibles du site, en un seul endroit.
 * Corrigez-les ici sans toucher aux composants.
 *
 * Créole réunionnais : chaque passage en créole est écrit { rcf: '…' } pour être balisé lang="rcf".
 * Les textes marqués « NOUVEAU » n'existent pas dans les prototypes : rédigés pour la production,
 * à relire (voir le rapport final / doc/PROGRESS.md).
 *
 * Les informations propres au mariage (prénoms, date, lieu, contacts) ne sont PAS ici : elles sont en base
 * (table `wedding`, assistant d'installation puis onglet « Mariage ») ; les textes qui en dépendent sont des
 * fonctions qui reçoivent `w` (voir src/features/wedding/wedding.ts).
 *
 * Caractères spéciaux : « ‑ » = trait d'union insécable (U+2011), «   » = espace insécable.
 */

import type { WeddingLabels } from '../features/wedding/wedding';

/** Un morceau de texte : français (chaîne) ou créole ({ rcf }). */
export type Seg = string | { rcf: string };
export type Rich = readonly Seg[];

export const rcf = (text: string): { rcf: string } => ({ rcf: text });

/** Texte brut d'un contenu riche (pour aria-label, emails texte, etc.). */
export function plain(r: Rich | string): string {
  if (typeof r === 'string') return r;
  return r.map((s) => (typeof s === 'string' ? s : s.rcf)).join('');
}

export const meta = {
  title: (w: WeddingLabels) => `${w.couple} · ${w.dateShort}`,
  description: (w: WeddingLabels) =>
    `Faire‑part du mariage de ${w.couple}, ${[w.venueCity, w.venueRegion].filter(Boolean).join(', ')}.`,
  // NOUVEAU
  genericTitle: 'Faire‑part de mariage',
  adminTitle: 'Espace des mariés',
  privacyTitle: (w: WeddingLabels) => `Confidentialité · ${w.couple}`,
  notFoundTitle: 'Lien introuvable',
} as const;

export const monogram = { amp: '&', label: (w: WeddingLabels) => `${w.name1} et ${w.name2}` };

export const scenes = [
  'Accueil',
  'Le faire-part',
  'Le programme',
  'La table',
  'Dress code',
  'Contact',
] as const;

export const nav = {
  menu: 'Menu',
  close: 'Fermer',
  swipe: 'Glissez',
  menuFooter: (w: WeddingLabels) => `${w.dateShort} · ${w.venueCity}`,
  dots: 'Sections du faire‑part', // NOUVEAU (lecteurs d'écran)
  goTo: (name: string) => `Aller à : ${name}`, // NOUVEAU (lecteurs d'écran)
  skipToContent: 'Aller au contenu', // NOUVEAU
} as const;

export const intro = {
  welcome: [rcf('Antré, zot lé byinvni')] as Rich,
  enter: 'Entrer',
} as const;

export const home = {
  invited: 'Vous avez été invités au mariage !',
  eyebrow: [rcf('Nou sa marié')] as Rich,
  amp: '&',
  open: 'Ouvrir le faire‑part',
} as const;

export const card = {
  eyebrow: 'Le faire‑part',
  sealLabel: 'Ouvrir le faire-part',
  tapToOpen: "Touchez la fleur pour l'ouvrir",
  gift: [rcf('Ouvèr out kado')] as Rich,
  save: 'Enregistrer la carte',
  reply: 'Répondre',
  replay: "Rejouer l'ouverture",
  saveHint: "La carte s'enregistre en image, prête à garder ou partager.",
  savedHint: 'Carte enregistrée dans vos téléchargements.',
  sharedHint: 'Carte prête à être partagée.', // NOUVEAU
  shareTitle: (w: Pick<WeddingLabels, 'couple'>) => `Faire‑part de ${w.couple}`, // NOUVEAU
  longPressTitle: 'Votre carte', // NOUVEAU
  longPressHint: "Appuyez longuement sur l'image pour l'enregistrer dans vos photos.", // NOUVEAU
  // NOUVEAU : recevoir la carte par email
  emailButton: 'Recevoir par email',
  emailTitle: 'Recevoir la carte par email',
  emailIntro: 'Indiquez l’adresse où recevoir la carte : elle arrive en image, prête à garder ou imprimer.',
  emailLabel: 'Adresse email',
  emailSubmit: 'Envoyer la carte',
  emailSending: 'Préparation de la carte…',
  emailDone: (to: string) =>
    `C’est parti : la carte arrive dans quelques minutes à ${to}. Pensez à regarder vos spams.`,
  emailInvalid: 'Adresse email invalide.',
  emailDomain: (domain: string) => `Le domaine « ${domain} » ne reçoit pas d’emails : vérifiez l’adresse.`,
  emailTooMany: 'La carte a déjà été envoyée 3 fois avec ce lien : c’est le maximum.',
  emailError: 'L’envoi n’a pas pu être préparé. Réessayez dans un instant.',
  photoPlaceholder: 'photo des mariés',
  photoAlt: (w: WeddingLabels) => `Photo de ${w.name1} et ${w.name2}`, // NOUVEAU
  ceremony: 'Cérémonie',
  reception: 'Réception',
  /** Message par défaut de la carte (le reste vient des infos du mariage ; modifiable dans « Modifier la carte »). */
  defaultMessage: 'Nou lé kontan partaz sa zour‑la avèk zot.\nVotre présence est notre plus beau cadeau.',
} as const;

export const programme = {
  // NOUVEAU : scène « Le programme » (modifiable dans l'espace des mariés, onglet « Programme »)
  eyebrow: 'Le programme',
  title: ['Le déroulé', 'de la journée'],
  list: 'Programme de la journée',
  /** Programme proposé à l'installation (cérémonie, puis réception si une heure est donnée). */
  defaultTitles: { ceremony: 'Cérémonie', reception: 'Réception' },
} as const;

export const table = {
  eyebrow: (family: string) => `Votre table · ${family}`,
  familyFallback: 'Votre famille',
  title: 'Touchez une chaise pour ajouter un membre de votre famille',
  subtitle: 'glissez de côté pour tourner la table',
  count: (n: number, max: number) =>
    `${n} / ${max} places · vous et votre famille, jusqu'à ${max - 1} personne${max - 1 > 1 ? 's' : ''} avec vous`,
  hostSuffix: { invite: ' · invité', invitee: ' · invitée' },
  send: 'Envoyer notre réponse',
  update: 'Mettre à jour notre réponse',
  sent: 'Réponse envoyée ✓',
  hintBefore:
    "Les places choisies ici ne sont pas forcément celles du plan de table final : les mariés s'occupent du placement.",
  hintChanged: 'Votre nouvelle réponse remplacera la précédente, sans doublon.',
  hintSent: (deadline: string): Rich => [
    rcf('Mersi !'),
    ` Vous pouvez revenir avec ce même lien pour modifier votre réponse jusqu'au ${deadline}. Le plan de table final sera fait par les mariés.`,
  ],
  // --- NOUVEAU : déclin, date limite, réseau, accessibilité ---
  decline: 'Nous ne pourrons pas venir',
  declinedLabel: 'Absence signalée ✓',
  hintDeclined: (deadline: string) =>
    `Votre réponse est notée : vous ne pourrez pas venir. Si vos projets changent, ajoutez votre famille à la table et envoyez une nouvelle réponse avant le ${deadline}.`,
  closedLabel: 'Réponses closes',
  hintClosed: (deadline: string) =>
    `Les réponses sont closes depuis le ${deadline}. Pour toute modification, écrivez aux mariés.`,
  sending: 'Envoi…',
  offlineQueued: 'Pas de connexion : votre réponse partira dès le retour du réseau.',
  conflict: 'Votre réponse a été modifiée depuis un autre appareil : voici la dernière version.',
  sendError: "La réponse n'a pas pu être envoyée. Réessayez dans un instant.",
  a11yList: 'Places à table',
  seatAdd: (n: number) => `Place ${n} : ajouter`,
  seatEdit: (n: number, name: string) => `Place ${n} : ${name}, modifier`,
  seatLocked: (n: number) => `Place ${n} : non disponible`,
  noLinkTitle: 'Votre réponse se fait avec votre lien personnel',
  noLinkBody: "Vous l'avez reçu par email ou WhatsApp avec le faire‑part.",
  noLinkLost: 'Recevoir à nouveau mon lien',
  noLinkPublic: 'Retrouver mon invitation',
} as const;

export const sheet = {
  titleNew: "Qui de votre famille s'assoit ici ?",
  titleEdit: 'Modifier la place',
  first: 'Prénom',
  last: 'Nom',
  note: 'Allergies, allergènes, remarques',
  notePlaceholder: 'ex. allergie aux fruits de mer, sans porc, siège bébé',
  confirm: 'Confirmer',
  remove: 'Retirer',
  close: 'Fermer',
  // NOUVEAU
  notSeating:
    'Ici, dites-nous simplement qui vous accompagne : ce n’est pas le plan de table, les mariés s’occuperont du placement.',
  noteInfo: (purgeDate: string) =>
    `Facultatif. Ces informations servent uniquement à prévenir le traiteur et seront effacées le ${purgeDate}.`,
  privacyLink: 'Confidentialité',
  nameRequired: 'Indiquez au moins un prénom ou un nom.',
} as const;

export const decline = {
  // NOUVEAU
  title: 'Vous ne pourrez pas venir ?',
  body: (deadline: string) =>
    `Nous serons tristes de ne pas vous avoir avec nous. Votre réponse sera transmise aux mariés ; vous pourrez changer d'avis avec ce même lien jusqu'au ${deadline}.`,
  confirm: 'Confirmer',
  cancel: 'Annuler',
} as const;

export const dress = {
  eyebrow: 'Dress code',
  title: ['Tenue de fête,', 'fleurie et lumineuse'],
  body: "Sortez les imprimés floraux, le lin et les couleurs de l'île. Chaussures confortables : on danse tard. Le blanc intégral est réservé aux mariés.",
  palette: ['Hibiscus', 'Bougainvillée', 'Vanille', 'Frangipanier'],
  closing: [rcf('Mète zot pli zoli linz !')] as Rich,
} as const;

export const contact = {
  eyebrow: 'Contact',
  title: 'Une question ? Écrivez‑nous',
  // les valeurs (email, téléphone, lieu) viennent des infos du mariage
  email: 'Email',
  phone: 'Téléphone', // NOUVEAU : si aucun libellé n'est donné
  route: 'Itinéraire',
  lost: { label: 'Lien perdu ?', value: 'Recevoir à nouveau mon lien personnel' },
  admin: 'Espace des mariés',
  privacy: 'Confidentialité', // NOUVEAU
} as const;

export const lost = {
  title: 'Retrouver mon invitation',
  intro:
    "Indiquez l'email ou le numéro de téléphone sur lequel vous avez reçu le faire‑part. Nous vous renvoyons votre lien personnel.",
  label: 'Email ou téléphone',
  placeholder: 'ex. marie@exemple.re ou 0692 11 22 33',
  submit: 'Recevoir mon lien',
  done: 'Si ce contact figure sur la liste des invités, votre lien personnel arrive dans quelques minutes. Pensez à regarder vos spams.',
  doneMore: 'Toujours rien ? Écrivez aux mariés ou aux témoins, ils peuvent vous le renvoyer.',
  invalid: 'Indiquez un email ou un numéro de téléphone.', // NOUVEAU
  close: 'Fermer',
} as const;

export const rsvpPublic = {
  // NOUVEAU : page /rsvp (lien unique facultatif)
  eyebrow: 'Votre réponse',
  title: 'Retrouver votre invitation',
  intro:
    "Indiquez votre prénom et votre nom tels qu'ils figurent sur l'invitation. Nous envoyons un code de confirmation au contact de votre famille.",
  first: 'Prénom',
  last: 'Nom',
  submit: 'Recevoir un code',
  codeIntro:
    "Si votre nom figure sur la liste des invités, un code à 6 chiffres vient d'être envoyé par email ou WhatsApp à la personne qui a reçu l'invitation de votre famille.",
  codeLabel: 'Code à 6 chiffres',
  verify: 'Valider',
  badCode: 'Ce code ne correspond pas ou a expiré.',
  tooMany: 'Trop d’essais. Réessayez dans une heure, ou utilisez « Lien perdu ? ».',
  restart: 'Recommencer',
  missing: 'Indiquez votre prénom et votre nom.',
  disabledTitle: 'Lien personnel requis',
  disabledBody: 'Votre réponse se fait avec le lien personnel reçu avec le faire‑part.',
  back: 'Retour au faire‑part',
} as const;

export const soon = {
  // NOUVEAU : page affichée aux invités tant que les mariés n'ont pas rempli l'assistant d'installation
  title: 'Le faire‑part arrive bientôt',
  body: 'Les mariés sont en train de le préparer. Revenez un peu plus tard !',
  admin: 'Espace des mariés',
} as const;

export const notFound = {
  // NOUVEAU
  eyebrow: 'Lien introuvable',
  title: "Ce lien d'invitation n'est pas valide",
  body: 'Vérifiez qu’il est complet, ou demandez à le recevoir à nouveau.',
  lost: 'Recevoir à nouveau mon lien',
  home: 'Voir le faire‑part',
} as const;

export const privacy = {
  // NOUVEAU : page /confidentialite
  eyebrow: 'Confidentialité',
  title: 'Vos données, simplement',
  sections: [
    {
      h: 'Qui s’occupe de vos données ?',
      p: (controllers: string, email: string) =>
        `Les responsables du traitement sont ${controllers}, les mariés. Pour toute question ou demande : ${email}.`,
    },
    {
      h: 'Ce que nous collectons',
      p: () =>
        'Les prénoms et noms des personnes de votre famille qui viennent, le contact (email ou téléphone) sur lequel vous avez reçu le faire‑part, et, si vous les indiquez, les allergies ou remarques utiles au repas.',
    },
    {
      h: 'Pourquoi',
      p: () =>
        'Uniquement pour organiser le mariage : envoyer le faire‑part, compter les couverts, préparer le plan de table et prévenir le traiteur des allergies. Rien n’est vendu ni utilisé pour de la publicité.',
    },
    {
      h: 'Allergies : des données de santé',
      p: (_c: string, _e: string, purgeDate: string) =>
        `Ce champ est facultatif. Seuls les mariés et le traiteur en ont connaissance. Les allergies et les coordonnées sont effacées automatiquement le ${purgeDate}.`,
    },
    {
      h: 'Qui y a accès',
      p: () =>
        'Les mariés, depuis un espace protégé par mot de passe. Les emails passent par notre prestataire d’envoi et les messages WhatsApp par Meta, seulement pour vous transmettre le faire‑part.',
    },
    {
      h: 'Vos droits',
      p: (_c: string, email: string) =>
        `Vous pouvez consulter, corriger ou supprimer vos informations à tout moment avec votre lien personnel, ou en écrivant à ${email}. Vous pouvez aussi saisir la CNIL (cnil.fr).`,
    },
    {
      h: 'Cookies',
      p: () =>
        'Le site invité n’utilise aucun cookie de suivi. Votre brouillon de réponse est gardé dans votre navigateur pour ne rien perdre si la connexion coupe.',
    },
  ],
  back: 'Retour au faire‑part',
} as const;

export const email = {
  // NOUVEAU : gabarits d'email
  invitation: {
    subject: (w: WeddingLabels) => `Faire‑part · ${w.couple} · ${w.dateShort}`,
    preheader: 'Nous avons la joie de vous inviter à notre mariage.',
    hello: (first: string) => `Bonjour ${first},`,
    body: (w: WeddingLabels) =>
      `Nous avons la joie de vous inviter à notre mariage, le ${w.dateInline} : ${w.venueName}, ${w.venueCity}.`,
    cta: 'Ouvrir mon faire‑part',
    after: (deadline: string) =>
      `Dites‑nous qui vient avec vous : ce lien est personnel, il vous permet de répondre et de modifier votre réponse jusqu'au ${deadline}.`,
  },
  lostLink: {
    subject: (w: WeddingLabels) => `Votre lien personnel · ${w.couple}`,
    preheader: 'Votre lien pour répondre au faire‑part.',
    hello: (first: string) => `Bonjour ${first},`,
    body: 'Voici à nouveau votre lien personnel pour ouvrir le faire‑part et répondre :',
    cta: 'Ouvrir mon faire‑part',
    after: "Si vous n'avez rien demandé, ignorez simplement ce message.",
  },
  otp: {
    subject: (w: WeddingLabels) => `Votre code · ${w.couple}`,
    preheader: 'Votre code de confirmation.',
    hello: (first: string) => `Bonjour ${first},`,
    body: 'Voici le code pour retrouver votre invitation :',
    validity: 'Il est valable 15 minutes. Si vous n’avez rien demandé, ignorez ce message.',
  },
  card: {
    subject: (w: WeddingLabels) => `Votre faire‑part · ${w.couple}`,
    preheader: 'Votre faire‑part, prêt à garder ou imprimer.',
    hello: (first: string) => `Bonjour ${first},`,
    body: 'Voici votre faire‑part. Il est aussi joint à ce message en image, prêt à garder ou imprimer.',
    alt: (w: WeddingLabels) => `Faire‑part de ${w.couplePlain}`,
  },
  test: {
    subject: (w: WeddingLabels) => `Test d’envoi · Faire‑part ${w.couple}`,
    body: 'Si vous lisez ce message, la configuration SMTP fonctionne.',
  },
  creole: [rcf('Nou lé kontan partaz sa zour‑la avèk zot.')] as Rich,
  linkFallback: 'Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :',
  footer: (w: WeddingLabels) => [w.venueName, w.venueCity, w.venueRegion].filter(Boolean).join(' · '),
} as const;

export const whatsapp = {
  // NOUVEAU : texte du modèle à faire valider par Meta ({{1}} = prénom, {{2}} = lien)
  templateBody: (w: WeddingLabels) =>
    `Bonjour {{1}}, ${w.couplePlain} ont la joie de vous inviter à leur mariage le ${w.dateInline} (${w.venueName}, ${w.venueCity}). Votre faire-part personnel : {{2}}`,
  manual: (w: WeddingLabels, first: string, link: string) =>
    `Bonjour ${first}, ${w.couplePlain} ont la joie de vous inviter à leur mariage le ${w.dateInline} (${w.venueName}, ${w.venueCity}). Votre faire-part personnel : ${link}`,
} as const;

export const status = {
  not_sent: 'Non envoyé', // NOUVEAU
  sent: 'En attente',
  opened: 'Ouvert',
  started: 'Commencé',
  submitted: 'Confirmé',
  declined: 'Décliné',
} as const;

export const sendStatus = {
  // NOUVEAU
  queued: 'En file',
  sent: 'Envoyé',
  delivered: 'Délivré',
  read: 'Lu',
  failed: 'Échec',
} as const;

export const channel = { email: 'Email', whatsapp: 'WhatsApp', lien: 'Lien' };

export const purpose = {
  // NOUVEAU
  invitation: 'Faire‑part',
  relance: 'Relance',
  lien_perdu: 'Lien perdu',
  code: 'Code',
  carte: 'Carte', // NOUVEAU
} as const;

export const admin = {
  eyebrow: 'Espace des mariés',
  title: 'Envoi des faire‑part',
  viewSite: 'Voir le site invité',
  logout: 'Se déconnecter', // NOUVEAU
  kpi: { sent: 'Envoyés', yes: 'Confirmés', no: 'Déclinés', seats: 'Couverts' },
  tabs: {
    list: 'Invitations',
    wedding: 'Mariage', // NOUVEAU
    card: 'Modifier la carte',
    programme: 'Programme', // NOUVEAU
    plan: 'Plan de table',
    caterer: 'Traiteur',
  },

  login: {
    // NOUVEAU
    title: 'Connexion',
    email: 'Email',
    password: 'Mot de passe',
    submit: 'Se connecter',
    error: 'Email ou mot de passe incorrect.',
    tooMany: 'Trop de tentatives. Réessayez dans 15 minutes.',
    expired: 'La page a expiré, réessayez.',
    back: 'Retour au site',
  },

  list: {
    newTitle: 'Nouvel envoi',
    first: 'Prénom',
    last: 'Nom',
    email: 'Email',
    phone: 'Téléphone',
    send: 'Envoyer le faire-part',
    hint: 'Email et/ou téléphone : au moins un des deux.',
    missing: 'Prénom, nom et un moyen de contact sont nécessaires.',
    cols: { guest: 'Invité', contact: 'Contact', status: 'Statut', seats: 'Places' },
    copy: 'Lien',
    copied: 'Copié',
    copyTitle: 'Copier le lien personnel',
    resendTitle: 'Renvoyer',
    notes: 'Allergies / remarques : ',
    footer:
      "Chaque invitation a son lien personnel. Si l'invité modifie sa réponse, elle remplace la précédente : pas de doublon.",
    // NOUVEAU
    sentOn: (d: string) => `envoyé le ${d}`,
    notSent: 'non envoyé',
    created: (n: string) => `Invitation créée pour ${n}.`,
    createdAndQueued: (n: string, ch: string) => `Faire‑part en cours d'envoi à ${n} (${ch}).`,
    phoneInvalid: 'Numéro de téléphone invalide (ex. 0692 11 22 33 ou +262 692 11 22 33).',
    emailInvalid: 'Adresse email invalide.',
    // NOUVEAU : contrôle de l'adresse à la saisie
    emailTypo: (suggestion: string) => `Adresse à vérifier : vouliez‑vous dire ${suggestion} ?`,
    emailTypoFix: (suggestion: string) => `Utiliser ${suggestion}`,
    emailTypoKeep: 'Garder telle quelle',
    emailDomain: (domain: string) =>
      `Le domaine « ${domain} » n’existe pas ou ne reçoit pas d’emails : vérifiez l’adresse.`,
    csvEmailTypo: (suggestion: string) =>
      `Adresse à vérifier : vouliez‑vous dire ${suggestion} ? Corrigez le fichier, ou ajoutez cette invitation à la main.`,
    filterFailed: 'Envoi en échec',
    search: 'Rechercher un nom, un email, un téléphone',
    filterAll: 'Tous les statuts',
    filterChannelAll: 'Tous les canaux',
    empty: 'Aucune invitation ne correspond.',
    selectAll: 'Tout sélectionner',
    selected: (n: number) => `${n} sélectionnée${n > 1 ? 's' : ''}`,
    bulkEmail: 'Envoyer par email',
    bulkWhatsapp: 'Envoyer par WhatsApp',
    bulkDelete: 'Supprimer',
    bulkQueued: (n: number) =>
      `${n} envoi${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} à la file (1 par seconde).`,
    bulkSkipped: (n: number) => `${n} ignoré${n > 1 ? 's' : ''} faute de contact pour ce canal.`,
    confirmDelete: (n: number) =>
      `Supprimer définitivement ${n} invitation${n > 1 ? 's' : ''} et leurs réponses ?`,
    importCsv: 'Importer un CSV',
    exportCsv: 'Exporter en CSV',
    resendEmail: 'Renvoyer par email',
    resendWhatsapp: 'Renvoyer par WhatsApp',
    resendManual: 'WhatsApp sans API (wa.me)',
    // NOUVEAU : WhatsApp automatique non configuré
    whatsappOff: 'Envoi WhatsApp automatique non configuré (API de Meta) : utilisez « WhatsApp sans API ».',
    createdWaMe: (n: string) =>
      `Invitation créée pour ${n} : WhatsApp s’ouvre avec le message prêt, appuyez sur Envoyer.`,
    openWhatsapp: 'Ouvrir WhatsApp',
    noChannel: 'Aucun contact pour ce canal.',
    queued: 'Envoi ajouté à la file.',
    edit: 'Modifier',
    save: 'Enregistrer',
    cancel: 'Annuler',
    delete: 'Supprimer l’invitation',
    displayName: 'Nom affiché (table)',
    maxSeats: 'Places (1 à 6)',
    agreement: 'Accord sous la chaise',
    agreementInvite: 'invité',
    agreementInvitee: 'invitée',
    history: 'Historique des envois',
    noHistory: 'Aucun envoi pour le moment.',
    lastChannel: 'Dernier canal',
    conflict: 'Cette invitation a été modifiée entre‑temps. La liste a été rechargée.',
    saved: 'Modifications enregistrées.',
    error: 'Une erreur est survenue. Réessayez.',
    linkCopiedLogged: 'Lien copié (envoi enregistré).',
  },

  failures: {
    // NOUVEAU : alerte en haut de l'onglet Invitations
    title: (n: number) => `${n} envoi${n > 1 ? 's' : ''} n’${n > 1 ? 'ont' : 'a'} pas abouti`,
    help: 'Ouvrez la fiche pour corriger le contact, puis renvoyez. L’alerte disparaît dès qu’un nouvel envoi réussit.',
    open: 'Ouvrir la fiche',
    detail: 'Détail technique : ',
    reasons: {
      no_contact: 'Aucun contact pour ce canal.',
      email_unknown: 'Adresse email inexistante.',
      email_domain: 'Le domaine de l’adresse email n’existe pas.',
      email_full: 'Boîte mail du destinataire pleine : réessayez dans quelques jours.',
      email_blocked: 'Email refusé par la messagerie du destinataire (bloqué ou classé indésirable).',
      wa_not_whatsapp:
        'Ce numéro ne semble pas avoir WhatsApp : essayez par email ou par « WhatsApp sans API ».',
      wa_test: 'Compte WhatsApp en mode test : ajoutez ce numéro aux destinataires autorisés chez Meta.',
      wa_limit: 'WhatsApp limite les envois pour le moment : réessayez plus tard.',
      wa_payment: 'Moyen de paiement manquant sur le compte WhatsApp Business (Meta).',
      config: 'Le service d’envoi refuse la connexion : vérifiez sa configuration (doc/CONFIGURATION.md).',
      other: 'L’envoi n’a pas abouti.',
    },
  },

  csv: {
    // NOUVEAU
    title: 'Importer des invitations',
    help: 'Fichier CSV (séparateur « ; » ou « , ») avec une ligne d’en‑tête : prenom ; nom ; email ; telephone ; nom_affiche ; places ; accord. Seuls prenom, nom et un contact sont obligatoires.',
    choose: 'Choisir un fichier',
    preview: (ok: number, ko: number) =>
      `${ok} ligne${ok > 1 ? 's' : ''} valide${ok > 1 ? 's' : ''}, ${ko} en erreur.`,
    line: (n: number) => `Ligne ${n}`,
    confirm: (n: number) => `Importer ${n} invitation${n > 1 ? 's' : ''}`,
    done: (n: number, d: number) =>
      `${n} invitation${n > 1 ? 's' : ''} importée${n > 1 ? 's' : ''}${d ? `, ${d} doublon${d > 1 ? 's' : ''} ignoré${d > 1 ? 's' : ''}` : ''}.`,
    close: 'Fermer',
  },

  card: {
    title: 'Contenu de la carte',
    names: 'Mariés',
    date: 'Date',
    place: 'Lieu',
    ceremony: 'Heure cérémonie',
    reception: 'Heure réception',
    message: 'Message',
    photo: 'Photo',
    preview: 'Aperçu de la carte envoyée aux invités.',
    // NOUVEAU
    save: 'Enregistrer la carte',
    saving: 'Enregistrement…',
    saved: 'Carte enregistrée.',
    removePhoto: 'Retirer la photo',
    uploading: 'Envoi de la photo…',
    photoError: 'Photo refusée : JPEG, PNG, WebP ou HEIC de moins de 15 Mo.',
    // NOUVEAU : cadrage de la photo
    frameTitle: 'Cadrage de la photo',
    frameHelp:
      'Choisissez la forme, faites glisser la photo pour choisir ce qui est visible, puis zoomez. Tout à gauche du zoom, la photo entière tient dans la forme.',
    frameStage: 'Cadrage : faites glisser la photo, ou utilisez les flèches du clavier',
    shape: 'Forme',
    shapes: { rect: 'Rectangle', round: 'Rond', arch: 'Arche', oval: 'Ovale' },
    zoom: 'Zoom',
    recenter: 'Recentrer',
    saveFrame: 'Enregistrer le cadrage',
    frameSaved: 'Cadrage enregistré : il s’applique sur le site et sur la carte enregistrée.',
    messageHelp: '1re ligne en créole, 2e ligne en italique, comme sur la carte.',
    settingsTitle: 'Réponses en ligne',
    deadline: 'Date limite des réponses',
    publicRsvp: 'Activer le lien public /rsvp (recherche par nom + code à 6 chiffres)',
    purgeAt: 'Effacement automatique des allergies et contacts',
    settingsSaved: 'Réglages enregistrés.',
  },

  plan: {
    addRound: '+ Table ronde',
    addRect: '+ Table rectangulaire',
    save: 'Enregistrer le plan',
    dirty: 'Modifications non enregistrées',
    savedAt: (t: string) => `Enregistré à ${t}`,
    none: 'Aucun plan enregistré',
    toPlace: 'À placer',
    placed: (n: number, t: number) => `${n} / ${t} placés`,
    help: 'Glissez une personne sur une chaise. Pour la retirer, ramenez-la ici.',
    allPlaced: 'Tout le monde est placé.',
    allergyLegend: 'Allergie ou remarque',
    tableName: 'Nom de la table',
    chairs: 'Chaises',
    deleteTable: 'Supprimer la table',
    room: 'Salle de réception · piste de danse en haut',
    dance: 'Piste',
    couple: 'Les mariés',
    tableDefault: (n: number) => `Table ${n}`,
    honour: "Table d'honneur",
    // NOUVEAU
    versions: 'Version du plan',
    newVersion: 'Nouvelle version',
    duplicate: 'Dupliquer',
    rename: 'Renommer',
    versionName: 'Nom de la version',
    versionDefault: (n: number) => `Plan ${n}`,
    active: 'Plan actif',
    setActive: 'Définir comme plan actif',
    deleteVersion: 'Supprimer cette version',
    confirmDeleteVersion: 'Supprimer définitivement cette version du plan ?',
    print: 'Imprimer / PDF',
    zoomIn: 'Zoom avant',
    zoomOut: 'Zoom arrière',
    zoomFit: 'Ajuster',
    saving: 'Enregistrement…',
    conflict: 'Ce plan a été modifié ailleurs. Rechargez la page pour récupérer la dernière version.',
    warnTitle: 'À vérifier',
    warnNotConfirmed: (name: string, status: string) => `${name} n'est plus confirmé·e (${status}).`,
    warnRemoved: (name: string) => `${name} ne figure plus dans les réponses : chaise libérée.`,
    printTitle: 'Plan de table',
    printList: 'Liste par table',
    printEmpty: 'chaise libre',
    printNow: 'Imprimer',
    leaveWarning: 'Des modifications du plan ne sont pas enregistrées.',
  },

  programme: {
    // NOUVEAU
    title: 'Programme de la journée',
    help: 'Chaque moment s’affiche dans cet ordre sur le site des invités (scène « Le programme »).',
    item: (n: number) => `Moment ${n}`,
    time: 'Heure',
    timePlaceholder: 'ex. 15h00',
    what: 'Moment',
    whatPlaceholder: 'ex. Cérémonie religieuse',
    place: 'Lieu (facultatif)',
    placePlaceholder: 'ex. Salle des fêtes, rue des Lilas',
    note: 'Précision (facultatif)',
    notePlaceholder: 'ex. Parking derrière l’église',
    add: 'Ajouter un moment',
    up: 'Monter',
    down: 'Descendre',
    remove: 'Retirer',
    save: 'Enregistrer le programme',
    saving: 'Enregistrement…',
    saved: 'Programme enregistré : il est visible sur le site des invités.',
    invalid: 'Chaque moment a besoin d’une heure et d’un titre.',
    max: (n: number) => `${n} moments au maximum.`,
    preview: 'Aperçu',
  },

  /** NOUVEAU : informations du mariage (assistant d'installation et onglet « Mariage ») */
  wedding: {
    setupEyebrow: 'Installation',
    setupTitle: 'Bienvenue ! Présentez votre mariage',
    setupIntro:
      'Quelques questions pour créer le faire‑part. Tout restera modifiable ensuite, dans l’onglet « Mariage ».',
    editTitle: 'Informations du mariage',
    editHelp:
      'Ces informations s’affichent sur le site des invités, dans les emails et sur la page Confidentialité. Le texte de la carte, le programme et la date limite des réponses se modifient dans leurs onglets.',
    step: (n: number, total: number) => `Étape ${n} sur ${total}`,
    steps: {
      couple: 'Les mariés',
      day: 'Le jour J',
      place: 'Le lieu',
      contact: 'Pour vous joindre',
      replies: 'Les réponses',
    },
    partner: (n: number) => `Marié·e ${n}`,
    first: 'Prénom',
    last: 'Nom',
    coupleHelp:
      'Les prénoms s’affichent en grand sur le faire‑part ; les noms servent seulement à la page Confidentialité.',
    date: 'Date du mariage',
    ceremonyTime: 'Heure de la cérémonie',
    receptionTime: 'Heure de la réception (facultatif)',
    venueName: 'Lieu de la cérémonie',
    venueNamePlaceholder: 'ex. Église Saint‑Pierre',
    venueCity: 'Ville',
    venueCityPlaceholder: 'ex. Saint‑Denis',
    venueRegion: 'Région ou île (facultatif)',
    venueRegionPlaceholder: 'ex. La Réunion',
    receptionPlace: 'Lieu de la réception, s’il est différent (facultatif)',
    receptionPlacePlaceholder: 'ex. Domaine des Lilas, Saint‑Pierre',
    contactEmail: 'Email de contact affiché aux invités',
    contactPhone: 'Téléphone affiché aux invités (facultatif)',
    contactPhoneLabel: 'Qui répond à ce numéro ? (facultatif)',
    contactPhoneLabelPlaceholder: 'ex. Témoins, Marie (témoin)',
    privacyEmail: 'Email pour les questions sur les données personnelles',
    privacyHelp: 'Obligatoire (RGPD) : affiché sur la page Confidentialité.',
    deadline: 'Date limite des réponses',
    deadlineHelp: 'Proposée 18 jours avant le mariage. Modifiable ensuite dans « Modifier la carte ».',
    purgeInfo: (date: string) =>
      `Les allergies et coordonnées des invités seront effacées automatiquement le ${date} (3 mois après le mariage).`,
    recap: 'Vérifiez avant de créer le faire‑part',
    previous: 'Précédent',
    next: 'Suivant',
    create: 'Créer le faire‑part',
    creating: 'Création…',
    save: 'Enregistrer',
    saving: 'Enregistrement…',
    saved: 'Informations enregistrées : le site des invités est à jour.',
    required: 'Ce champ est obligatoire.',
    invalidEmail: 'Adresse email invalide.',
    invalidPhone: 'Numéro de téléphone invalide (ex. 0692 11 22 33 ou +262 692 11 22 33).',
    invalidTime: 'Heure au format 15:00.',
    already: 'Le mariage est déjà configuré.',
    error: 'Une erreur est survenue. Réessayez.',
  },

  caterer: {
    // NOUVEAU
    title: 'Pour le traiteur',
    covers: (n: number) => `${n} couvert${n > 1 ? 's' : ''} confirmé${n > 1 ? 's' : ''}`,
    withNotes: (n: number) => `${n} personne${n > 1 ? 's' : ''} avec une allergie ou remarque`,
    grouped: 'Allergies et remarques regroupées',
    who: 'Personnes concernées',
    none: 'Aucune allergie ni remarque pour le moment.',
    export: 'Exporter le CSV traiteur',
    purged: 'Les données de santé ont été effacées comme prévu.',
    family: 'Famille',
    guest: 'Invité',
    note: 'Allergie / remarque',
    table: 'Table',
  },
} as const;

/** Tous les textes (côté serveur). Le script du site invité importe seulement les sections utiles. */
export const fr = {
  meta,
  monogram,
  scenes,
  nav,
  intro,
  home,
  card,
  programme,
  table,
  sheet,
  decline,
  dress,
  contact,
  lost,
  rsvpPublic,
  soon,
  notFound,
  privacy,
  email,
  whatsapp,
  status,
  sendStatus,
  channel,
  purpose,
  admin,
} as const;

export type Fr = typeof fr;
