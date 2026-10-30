import type { Translated } from "../messages.ts";
import type { traffic as English } from "../en/traffic.ts";

/** La circulation devant, sur le parcours (spec traffic). */
export const traffic: Translated<typeof English> = {
  "traffic.level.free": "Fluide",
  "traffic.level.slow": "Ralenti",
  "traffic.level.heavy": "Dense",
  "traffic.level.closed": "Fermé",
  "traffic.level.unknown": "Inconnu",
  "traffic.name.jam": "Circulation : {level} dans {distance}",
  "traffic.name.jamHere": "Circulation : {level} ici",
  "traffic.name.clear": "Circulation : fluide sur les 60 prochains km",
  "traffic.name.unknown": "Circulation inconnue",
  "traffic.name.failed": "Circulation non chargée",
  "traffic.name.loading": "Circulation en chargement",
  "traffic.name.off": "La circulation est désactivée",
  "traffic.title": "Circulation devant",
  "traffic.here": "Ici",
  "traffic.at": "Dans {distance}",
  "traffic.failed": "La circulation n’a pas pu être chargée depuis votre serveur.",
  "traffic.retry": "Réessayer",
  "traffic.disabled": "La circulation est désactivée : rien n’est demandé à votre serveur.",
  "traffic.noData":
    "Pas de données de circulation sur la route devant : la source de votre serveur ne la couvre pas. Rien ne cloche sur votre téléphone ni sur votre serveur.",
  "traffic.budget": "Votre serveur a utilisé ses requêtes de circulation du jour : certains points sont inconnus.",
  "traffic.note":
    "Une indication tous les 10 km, pas une carte du trafic. Votre roadbook ne change pas : c’est vous qui décidez.",
  "traffic.toggle.on": "Circulation : activée",
  "traffic.toggle.off": "Circulation : désactivée",
  "traffic.toggle.hint": "Appuyez pour changer",
  "traffic.close": "Fermer",
  "traffic.attribution": "Données de circulation : de votre serveur",
  "traffic.coverage": "La circulation fonctionne en {countries} pour l'instant. D'autres pays sur demande.",
  "traffic.attribution.fr": "Données de circulation : Bison Futé, transport.data.gouv.fr (Licence Ouverte 2.0)",
  "traffic.country.FR": "France",
};
