/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** nonce CSP de la requête */
    nonce: string;
    /** admin connecté (routes /admin/* et /api/admin/*) */
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    admin?: import('./lib/auth/session').AdminIdentity;
  }
}
