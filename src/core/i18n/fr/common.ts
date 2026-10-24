import type { Translated } from "../messages.ts";
import type { common as English } from "../en/common.ts";

export const common: Translated<typeof English> = {
  "common.voice.label.full": "Voix",
  "common.voice.label.alerts": "Alertes",
  "common.voice.label.off": "Muet",
  "common.voice.name.full": "Voix : guidage complet",
  "common.voice.name.alerts": "Voix : alertes seules",
  "common.voice.name.off": "Voix : coupée",
  "common.dir.left": "gauche",
  "common.dir.right": "droite",
  "common.point.0": "N",
  "common.point.1": "NE",
  "common.point.2": "E",
  "common.point.3": "SE",
  "common.point.4": "S",
  "common.point.5": "SO",
  "common.point.6": "O",
  "common.point.7": "NO",
};
