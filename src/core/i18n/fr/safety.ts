import type { Translated } from "../messages.ts";
import type { safety as English } from "../en/safety.ts";

export const safety: Translated<typeof English> = {
  "safety.alert.title": "Chute possible",
  "safety.alert.body": "Tout va bien ? Appuyez sur le bouton.",
  "safety.alert.count": "Alerte dans {n} s",
  "safety.alert.ok": "Ça va",
  "safety.alert.say": "Chute détectée. Touchez l'écran si tout va bien.",
  "safety.alert.test": "Test : rien ne sera envoyé",
  "safety.sent.title": "Alerte",
  "safety.sent.live":
    "Votre sortie en direct affiche maintenant une chute possible et votre position à quiconque a sa page ouverte. Personne n'a été appelé ni sollicité par SMS.",
  "safety.sent.none": "Personne n'a été prévenu automatiquement. Envoyez le message ou appelez.",
  "safety.sent.test": "Le test est terminé. Rien n'a été envoyé.",
  "safety.sms": "Écrire à {name}",
  "safety.sms.nobody": "Écrire le message",
  "safety.call": "Appeler le 112",
  "safety.say.sent": "Pas de réponse. Alerte envoyée.",
  "safety.msg":
    "MotoRide : j'ai peut-être eu une chute. Ma dernière position : {link} (à {time}). Ce message a été préparé par l'application après une chute possible ; je ne peux peut-être pas répondre.",
  "safety.menu": "Sécurité",
  "safety.menu.name": "Détection de chute et contact d'urgence",
  "safety.screen.title": "Sécurité",
  "safety.screen.back": "Retour à la carte",
  "safety.detect.on": "Détection de chute : activée",
  "safety.detect.off": "Détection de chute : désactivée",
  "safety.detect.hint": "Touchez pour changer",
  "safety.detect.explain":
    "Pendant une sortie, les capteurs du téléphone cherchent un choc violent suivi de dix secondes sans bouger. Il vous demande si tout va bien pendant 30 secondes, puis marque votre sortie en direct, si vous en partagez une, comme chute possible (ceux qui ont sa page ouverte le voient) et prépare un message pour votre contact. L'application n'appelle et n'envoie de SMS à personne toute seule. Il peut se tromper : vous pouvez toujours annuler.",
  "safety.contact.title": "Contact d'urgence",
  "safety.contact.name": "Nom",
  "safety.contact.number": "Numéro de téléphone",
  "safety.contact.save": "Enregistrer le contact",
  "safety.contact.saved": "Enregistré.",
  "safety.contact.invalid": "Ce n'est pas un numéro de téléphone.",
  "safety.contact.remove": "Supprimer le contact",
  "safety.contact.none":
    "Pas de contact : après une alerte, vous pouvez appeler le 112 ou écrire un message vous-même.",
  "safety.test": "Essayer l'alerte",
  "safety.test.hint": "Affiche l'alerte pendant 10 secondes. Rien n'est envoyé.",
  "safety.live.note":
    "Partagez votre sortie en direct avec quelqu'un de confiance : s'il a la page ouverte, il voit une chute possible et votre position. Personne n'est appelé ni sollicité par SMS à votre place.",
};
