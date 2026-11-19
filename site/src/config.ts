// Coordonnées et identité affichées sur le site public.
// À COMPLÉTER par FISSA : téléphone, adresse, horaires, SIRET (voir aussi la
// table `organizations` dans FISSA STOCK, qui pourra alimenter ces champs plus tard).
export const SITE = {
  name: 'FISSA GROUPE',
  url: 'https://fissagroupe.fr',
  stockUrl: 'https://stock.fissagroupe.fr',
  description:
    "FISSA GROUPE : pièces automobiles d'occasion et neuves contrôlées (FISSA PIÈCE AUTO), véhicules d'occasion et dépôt-vente (FISSA AUTO), entretien et réparation mécanique sur devis (FISSA MÉCANIQUE AUTO).",
  locale: 'fr_FR',
}

export const CONTACT = {
  email: 'contact@fissagroupe.fr', // à créer chez OVH (1 adresse incluse avec le domaine)
  phone: '', // ex. '+33 6 00 00 00 00' — vide = boutons « Appeler » masqués
  phoneHref: '', // ex. 'tel:+33600000000'
  address: '', // ex. '12 rue de l’Industrie, 44300 Nantes'
  city: '', // ex. 'Nantes'
  hours: 'Du lundi au samedi, sur rendez-vous',
  siret: '',
  legalName: 'FISSA PIÈCE AUTO',
}

export const ACTIVITIES = [
  {
    key: 'pieces',
    name: 'FISSA PIÈCE AUTO',
    tagline: "Pièces d'occasion & neuves",
    description:
      "Des pièces contrôlées, prêtes à poser, issues de véhicules récents. Recherchez par référence constructeur ou par modèle, et réservez votre pièce en quelques clics.",
    href: '/pieces',
    cta: 'Voir les pièces',
    icon: '⚙️',
  },
  {
    key: 'autos',
    name: 'FISSA AUTO',
    tagline: 'Véhicules & dépôt-vente',
    description:
      "Nos véhicules d'occasion révisés et garantis, et un service de dépôt-vente pour vendre votre voiture sans tracas : estimation, annonces multi-sites, visites et paperasse.",
    href: '/autos',
    cta: 'Découvrir',
    icon: '🚗',
  },
  {
    key: 'garage',
    name: 'FISSA MÉCANIQUE AUTO',
    tagline: 'Entretien & réparation',
    description:
      "Diagnostic, entretien, freinage, distribution, embrayage… Un devis clair sous 24 h et la possibilité de monter des pièces d'occasion pour réduire la facture.",
    href: '/garage',
    cta: 'Demander un devis',
    icon: '🔧',
  },
] as const
