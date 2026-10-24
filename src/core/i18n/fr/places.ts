import type { Translated } from "../messages.ts";
import type { places as English } from "../en/places.ts";

export const places: Translated<typeof English> = {
  "places.chip.name": "Chercher un lieu le long de l'itinéraire",
  "places.title": "Chercher le long de l'itinéraire",
  "places.kind.fuel": "Carburant",
  "places.kind.bakery": "Boulangerie",
  "places.kind.cafe": "Café",
  "places.kind.restaurant": "Restaurant",
  "places.kind.viewpoint": "Point de vue",
  "places.kind.toilets": "Toilettes",
  "places.kind.atm": "Distributeur",
  "places.kind.motorcycle": "Garage moto",
  "places.kind.name": "Chercher : {kind}",
  "places.hint":
    "Dans les 60 prochains km du roadbook. La sortie continue : l'application vous ramène sur l'itinéraire.",
  "places.loading": "Recherche : {kind}…",
  "places.failed": "La recherche n'a pas pu être faite. Vérifiez le réseau.",
  "places.none": "Rien trouvé sur les 60 prochains km.",
  "places.retry": "Réessayer",
  "places.unnamed": "{kind}",
  "places.item.off": "dans {distance} · à {off} de l'itinéraire",
  "places.item.on": "dans {distance} · sur l'itinéraire",
  "places.item.hint": "L'afficher sur la carte",
  "places.close": "Fermer",
  "places.selected": "{name} · {distance}",
  "places.selected.name": "{name}, à {distance}. L'effacer",
  "places.selected.passed": "{name}, dépassé",
  "places.selected.passedName": "{name}, dépassé. L'effacer",
};
