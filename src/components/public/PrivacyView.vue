<script setup lang="ts">
// Politique de confidentialité : exigée par l'App Store et le Play Store
// (l'application utilise la caméra et gère des comptes). Texte volontairement
// simple ; à compléter avec les mentions légales de la société si besoin.
const CONTACT_EMAIL = 'contact@fissapieceauto.fr'
const UPDATED = '19 octobre 2026'
</script>

<template>
  <div class="max-w-[820px] mx-auto px-5 py-8">
    <div class="card p-6 md:p-10 space-y-6 text-[14px] leading-relaxed text-gray-700">
      <div>
        <h1 class="page-title">Politique de confidentialité</h1>
        <p class="page-subtitle">Application et site FISSA PIÈCE AUTO · Dernière mise à jour : {{ UPDATED }}</p>
      </div>

      <section>
        <h2 class="text-base font-semibold text-gray-900 mb-1.5">1. Qui sommes-nous ?</h2>
        <p>FISSA PIÈCE AUTO est une activité de vente de pièces automobiles d'occasion et neuves. L'application FISSA PIÈCE AUTO est un outil interne de gestion de stock réservé aux collaborateurs disposant d'un compte, complété d'une boutique publique en consultation libre.</p>
      </section>

      <section>
        <h2 class="text-base font-semibold text-gray-900 mb-1.5">2. Données collectées</h2>
        <ul class="list-disc pl-5 space-y-1">
          <li><strong>Compte collaborateur</strong> : adresse e-mail, nom et mot de passe (stocké de manière chiffrée), rôle et permissions.</li>
          <li><strong>Données d'exploitation</strong> : pièces référencées, mouvements de stock, ventes, chantiers atelier (nom, téléphone, e-mail et véhicule du client du chantier) et photos de pièces prises par le collaborateur.</li>
          <li><strong>Boutique publique</strong> : aucune donnée personnelle n'est collectée lors de la consultation du catalogue. Une demande de pièce passe par votre messagerie e-mail.</li>
        </ul>
      </section>

      <section>
        <h2 class="text-base font-semibold text-gray-900 mb-1.5">3. Caméra et photos</h2>
        <p>L'application demande l'accès à la caméra uniquement pour scanner les codes-barres des pièces et photographier les pièces en stock. Les images ne sont jamais utilisées à d'autres fins et aucune photo n'est prise sans action explicite de l'utilisateur.</p>
      </section>

      <section>
        <h2 class="text-base font-semibold text-gray-900 mb-1.5">4. Utilisation des données</h2>
        <p>Les données servent exclusivement à la gestion du stock, des ventes et de l'atelier de FISSA PIÈCE AUTO, et à la facturation des prestations. Elles ne sont ni vendues ni cédées à des tiers, ni utilisées à des fins publicitaires.</p>
      </section>

      <section>
        <h2 class="text-base font-semibold text-gray-900 mb-1.5">5. Hébergement et sécurité</h2>
        <p>Les données sont hébergées par Supabase sur des serveurs situés dans l'Union européenne (Francfort, Allemagne). Les échanges sont chiffrés (HTTPS) et l'accès aux données est restreint par un contrôle d'accès par compte et par organisation.</p>
      </section>

      <section>
        <h2 class="text-base font-semibold text-gray-900 mb-1.5">6. Durée de conservation</h2>
        <p>Les données de compte sont conservées tant que le compte est actif. Les données de ventes et de facturation sont conservées pendant la durée légale applicable en France (10 ans pour les pièces comptables). Les données de chantier peuvent être supprimées sur demande une fois la prestation terminée et facturée.</p>
      </section>

      <section>
        <h2 class="text-base font-semibold text-gray-900 mb-1.5">7. Vos droits</h2>
        <p>Conformément au Règlement général sur la protection des données (RGPD), vous disposez d'un droit d'accès, de rectification, d'effacement et d'opposition sur vos données. Pour exercer ces droits ou demander la suppression de votre compte et des données associées, écrivez à <a :href="`mailto:${CONTACT_EMAIL}`" class="text-blue-600 hover:underline">{{ CONTACT_EMAIL }}</a>. Nous répondons sous 30 jours.</p>
      </section>

      <section>
        <h2 class="text-base font-semibold text-gray-900 mb-1.5">8. Contact</h2>
        <p>Pour toute question relative à cette politique : <a :href="`mailto:${CONTACT_EMAIL}`" class="text-blue-600 hover:underline">{{ CONTACT_EMAIL }}</a>.</p>
      </section>
    </div>
  </div>
</template>
