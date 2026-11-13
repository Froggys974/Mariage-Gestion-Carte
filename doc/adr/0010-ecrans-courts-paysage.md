# 0010 — Écrans courts, petits téléphones et paysage

## Contexte

La maquette (`doc/design/Faire-part v3.dc.html`) est dessinée pour un téléphone vertical d'environ
390 × 844. L'audit du 07/11/2026 (20 pages × 9 tailles × Chrome et WebKit) a montré, **dans la maquette comme
dans le site** :

- téléphone à l'horizontale (≤ 500 px de haut) : noms coupés, textes superposés, table presque invisible ;
- petits écrans (320 × 568, 375 × 667) : contenu qui passe sous le repère « 0X · Scène / Glissez » ;
- scène Table trop haute même sur un iPhone 15 (« Nous ne pourrons pas venir » sous le repère) et sur
  les ordinateurs portables peu hauts (1366 × 650).

## Décision

Garder la maquette telle quelle sur les écrans pour lesquels elle est faite et l'adapter ailleurs,
**en CSS d'abord** :

1. **Repères de hauteur** : `max-height: 760 / 700 / 620 px` (écrans courts, en portrait ou si la hauteur
   dépasse 500 px) et `orientation: landscape and max-height: 500 px` (téléphone à l'horizontale).
   Les ordinateurs portables peu hauts (`landscape`, `max-height: 760px`, `min-width: 900px`) reçoivent
   la mise en page sur deux colonnes du faire-part et de la table.
2. **Enveloppe** : largeur `min(300px, 76vw, (100dvh − réserve) × 5/7)` ; tout son contenu est exprimé
   en `--u = 100cqw / 300` (unités de conteneur), la carte garde donc ses proportions à toute taille.
3. **Table 3D** : la scène lui laisse une place flexible (`.t-stage`, 230 à 368 px) ; `table3d.ts`
   calcule l'échelle du dessin (`fitScale`, `ResizeObserver`) et l'applique par `--ts`. Le calcul des
   étiquettes tenait déjà compte d'une échelle (`cr.width / offsetWidth`). Les noms sont agrandis en
   proportion inverse pour rester lisibles.
4. **Paysage** : grilles CSS sur deux colonnes (accueil, faire-part, table, dress code, contact).
   Le texte de la table est regroupé dans `.table-scene__head` et `.table-scene__actions` (sans effet
   en portrait).
5. **Bas d'écran** : le fondu de `.g-bottom` commence au-dessus du repère ; si une scène doit défiler
   (petit téléphone), son contenu passe dessous proprement au lieu de chevaucher le texte.
6. Les règles de mise en page des scènes utilisent `.scene__inner.xxx__inner` : `guest.css`
   (`.scene__inner { display: flex }`) est chargé après les feuilles des scènes.

## Conséquences

- À 390 × 844, 412 × 915, 768 × 1024, 1440 × 900 et 1920 × 1080 : rendu identique à la maquette
  (seule la table peut être légèrement réduite pour tenir).
- Sur un petit téléphone, la scène Table défile (le texte autour de la table ne peut pas tenir en 667 px) ;
  la table garde au moins 70 % de sa taille.
- Outil de contrôle : mesurer pour chaque scène que le contenu tient entre l'en-tête et le repère du bas
  (script d'audit utilisé le 07/11/2026, à refaire après toute modification de mise en page).
