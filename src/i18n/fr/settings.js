// Chaînes settings (fr). Clés camelCase, remplies par le composant du même nom.
export default {
  title: 'Réglages',
  close: 'Fermer les réglages',
  allCategories: 'Toutes les catégories',
  categoriesAria: 'Catégories de réglages',

  sections: {
    general: 'Général',
    appearance: 'Apparence',
    editor: 'Éditeur',
    shortcuts: 'Raccourcis',
    about: 'À propos'
  },

  general: {
    language: {
      title: 'Langue',
      aria: 'Langue',
      system: 'Système',
      note: 'Avec « Système », l’app suit la langue de votre système d’exploitation.'
    },
    list: {
      title: 'Liste des notes',
      sortLabel: 'Ordre de tri par défaut',
      sortDesc: 'Ordre dans lequel la liste des notes est classée',
      sortUpdated: 'Date de modification',
      sortCreated: 'Date de création',
      sortTitle: 'Titre'
    }
  },

  appearance: {
    theme: {
      title: 'Thème',
      aria: 'Thème',
      system: 'Système',
      light: 'Clair',
      dark: 'Sombre',
      note: 'Avec « Système », l’app suit l’apparence claire ou sombre de votre système d’exploitation.'
    }
  },

  editor: {
    spell: {
      title: 'Orthographe',
      label: 'Vérifier l’orthographe',
      desc: 'Souligne les mots non reconnus pendant la saisie',
      langLabel: 'Langue',
      langDesc: 'Dictionnaire utilisé pour la vérification orthographique',
      langIt: 'Italien',
      langEn: 'Anglais',
      langEs: 'Espagnol',
      langFr: 'Français',
      langDe: 'Allemand'
    }
  },

  shortcuts: {
    general: {
      title: 'Général',
      newNote: 'Nouvelle note',
      newFolder: 'Nouveau dossier',
      duplicateNote: 'Dupliquer la note',
      findInNote: 'Rechercher dans la note',
      findInAllNotes: 'Rechercher dans toutes les notes',
      toggleSidebar: 'Afficher/Masquer la barre latérale',
      settings: 'Réglages',
      zoomIn: 'Zoom avant',
      zoomOut: 'Zoom arrière',
      zoomReset: 'Taille réelle'
    },
    formatting: {
      title: 'Mise en forme (dans l’éditeur)',
      bold: 'Gras',
      italic: 'Italique',
      underline: 'Souligné',
      strike: 'Barré',
      inlineCode: 'Code en ligne',
      headings: 'Titre 1 / 2 / 3',
      normalText: 'Corps de texte',
      orderedList: 'Liste numérotée',
      bulletList: 'Liste à puces',
      checklist: 'Liste de contrôle',
      quote: 'Citation',
      codeBlock: 'Bloc de code',
      insertLink: 'Insérer un lien',
      undoRedo: 'Annuler / Rétablir'
    }
  },

  data: {
    title: 'Données',
    folderLabel: 'Dossier des notes',
    folderDesc: 'Emplacement de vos notes sur le disque. Choisissez un dossier synchronisé par iCloud, Dropbox ou Syncthing pour utiliser les mêmes notes sur plusieurs ordinateurs.',
    defaultBadge: 'par défaut',
    change: 'Modifier…',
    reset: 'Utiliser le dossier par défaut',
    reveal: 'Afficher dans le Finder | Afficher dans le gestionnaire de fichiers',
    confirmMoveTitle: 'Déplacer vos notes ?',
    confirmMove: 'Aucune note à déplacer. RustNotes utilisera désormais {dir}. | Votre note sera déplacée vers {dir}. | Vos {count} notes seront déplacées vers {dir}.',
    confirmAdoptTitle: 'Utiliser les notes déjà présentes ?',
    confirmAdopt: '{dir} contient déjà une note RustNotes. L’app basculera sur celle-ci ; les notes que vous voyez actuellement restent où elles sont et ne seront plus affichées. | {dir} contient déjà {count} notes RustNotes. L’app basculera sur celles-ci ; les notes que vous voyez actuellement restent où elles sont et ne seront plus affichées.',
    confirm: 'Continuer',
    cancel: 'Annuler',
    movedToast: 'Notes déplacées',
    adoptedToast: 'Dossier des notes modifié',
    toastDetail: 'Dossier utilisé : {dir}',
    failedToast: 'Impossible de modifier le dossier des notes'
  },
  about: {
    exportAll: 'Exporter toutes les notes',
    exportAllDesc: 'Chaque note en fichier Markdown, un sous-dossier par dossier. La corbeille n’est pas incluse.',
    exportAllButton: 'Exporter…',
    title: 'Application',
    version: 'Version',
    updates: 'Mises à jour',
    updatesDesc: 'Comparer avec la dernière version publiée',
    checking: 'Vérification…',
    checkUpdates: 'Rechercher les mises à jour',
    available: 'Version {version} disponible — exécutez',
    upToDate: 'Vous disposez de la dernière version'
  }
}
