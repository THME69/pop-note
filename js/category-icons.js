// Icônes dessinées à la main pour chaque catégorie, en clin d'œil pop culture
// (ex. manette Mega Drive pour les jeux vidéo). Style ligne + quelques aplats,
// une seule couleur (currentColor) pilotée par --cat-color côté CSS, pour
// s'accorder avec l'accent de chaque catégorie.

const CATEGORY_ICONS = {
  livres: `
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 14 C21 12 14 11 7 12 V35 C14 34 21 35 24 37 Z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M24 14 C27 12 34 11 41 12 V35 C34 34 27 35 24 37 Z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M24 14 V37" stroke="currentColor" stroke-width="1.6"/>
      <path d="M31 13 V22 L34 19.3 L37 22 V14.3" fill="currentColor"/>
    </svg>`,

  bd: `
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="8" width="36" height="23" rx="8" stroke="currentColor" stroke-width="2.2"/>
      <path d="M15 30 L11 40 L21 30.5" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
      <circle cx="38" cy="35" r="1.8" fill="currentColor"/>
      <circle cx="33" cy="40" r="1.4" fill="currentColor"/>
      <circle cx="41" cy="41" r="1.4" fill="currentColor"/>
      <path d="M15 16 H32 M15 22 H27" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`,

  films: `
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="7" y="19" width="34" height="21" rx="2.5" stroke="currentColor" stroke-width="2.2"/>
      <path d="M7 19 L9.5 9 H39 L36.5 19 Z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M14.5 9 L12 19 M23 9 L20.5 19 M31.5 9 L29 19" stroke="currentColor" stroke-width="2"/>
    </svg>`,

  series: `
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 10 L12 3 M30 10 L36 3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
      <rect x="7" y="10" width="34" height="23" rx="4" stroke="currentColor" stroke-width="2.2"/>
      <rect x="11.5" y="14.5" width="20" height="14" rx="1.5" stroke="currentColor" stroke-width="1.8"/>
      <circle cx="36.5" cy="18" r="1.7" fill="currentColor"/>
      <circle cx="36.5" cy="25" r="1.7" fill="currentColor"/>
      <path d="M15 33 L9 41 M33 33 L39 41" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
    </svg>`,

  anime: `
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 10c9 0 15 7 15 15-3 3-8 5-15 5s-12-2-15-5c0-8 6-15 15-15z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M16 19 C17 16 21 16 22 19 C21 22 17 22 16 19Z" fill="currentColor"/>
      <path d="M26 19 C27 16 31 16 32 19 C31 22 27 22 26 19Z" fill="currentColor"/>
      <path d="M9 12c1-3 4-5 6-5M39 12c-1-3-4-5-6-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`,

  jeuxVideo: `
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="15" width="40" height="21" rx="10.5" stroke="currentColor" stroke-width="2.2"/>
      <path d="M15 19.5 V29 M10.3 24.3 H19.7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="29.5" cy="21" r="2.8" fill="currentColor"/>
      <circle cx="36" cy="24.5" r="2.8" fill="currentColor"/>
      <circle cx="33.5" cy="30.5" r="2.8" fill="currentColor"/>
      <rect x="21" y="13.5" width="6" height="2.6" rx="1.3" fill="currentColor"/>
    </svg>`,

  jeuxSociete: `
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="9" y="9" width="26" height="26" rx="5" stroke="currentColor" stroke-width="2.2"/>
      <circle cx="15.5" cy="15.5" r="2.1" fill="currentColor"/>
      <circle cx="28.5" cy="15.5" r="2.1" fill="currentColor"/>
      <circle cx="22" cy="22" r="2.1" fill="currentColor"/>
      <circle cx="15.5" cy="28.5" r="2.1" fill="currentColor"/>
      <circle cx="28.5" cy="28.5" r="2.1" fill="currentColor"/>
      <path d="M35 19 L41 23 V33 L35 37 L29 33" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" opacity="0.55"/>
    </svg>`,

  kiosque: `
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="26" r="17" stroke="currentColor" stroke-width="2.2"/>
      <path d="M24 16 V26 L32.5 31" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M18 5 H30" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M24 5 V9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
    </svg>`,

  // Coeur "plein" : utilisé rempli dès qu'on veut l'afficher activé (badge sur
  // une carte, bande du hub...). Le formulaire d'ajout bascule entre celui-ci
  // et coeurOutline pour le bouton "coup de cœur".
  coeur: `
    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 40 C24 40 6 28.5 6 16.8 C6 10.7 10.9 6.2 16.6 6.2 C20 6.2 22.7 7.9 24 10.4 C25.3 7.9 28 6.2 31.4 6.2 C37.1 6.2 42 10.7 42 16.8 C42 28.5 24 40 24 40 Z" fill="currentColor"/>
    </svg>`,
  coeurOutline: `
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 40 C24 40 6 28.5 6 16.8 C6 10.7 10.9 6.2 16.6 6.2 C20 6.2 22.7 7.9 24 10.4 C25.3 7.9 28 6.2 31.4 6.2 C37.1 6.2 42 10.7 42 16.8 C42 28.5 24 40 24 40 Z" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round"/>
    </svg>`,

  // Crayon "éditer" : bouton d'édition sur la fiche détail.
  edit: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 20l1-4.2L16.2 4.6a1.5 1.5 0 0 1 2.1 0l1.1 1.1a1.5 1.5 0 0 1 0 2.1L8.2 19 4 20Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M14.5 6.3 17.7 9.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
    </svg>`,

  // "+" simple : même bouton que "edit" quand l'item n'est pas encore dans la collection.
  plus: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
};
