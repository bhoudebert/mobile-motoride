import type { Translated } from "../messages.ts";
import type { rec as English } from "../en/rec.ts";

export const rec: Translated<typeof English> = {
  "rec.state.completed": "Terminée",
  "rec.state.stopped": "Arrêtée avant la fin",
  "rec.state.recovered": "Récupérée",
  "rec.climb": "Dénivelé +{m} m",
  "rec.lean": "Inclinaison {left}° G · {right}° D",
  "rec.side.left": "G",
  "rec.side.right": "D",
};
