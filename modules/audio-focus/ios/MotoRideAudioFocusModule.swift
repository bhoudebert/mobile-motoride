import AVFoundation
import ExpoModulesCore

/// Lowers the music while the voice speaks (spec voice-guidance, ADR 0038). The speech engine uses the app's audio session; in the
/// default category, starting to speak stops the music. A playback session that ducks the others lowers it, and deactivating the
/// session tells the other apps to bring their audio back.
public class MotoRideAudioFocusModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MotoRideAudioFocus")

    // True when the session is active; the voice speaks either way.
    Function("requestDuck") { () -> Bool in
      let session = AVAudioSession.sharedInstance()
      do {
        try session.setCategory(
          .playback,
          mode: .voicePrompt,
          options: [.duckOthers, .interruptSpokenAudioAndMixWithOthers]
        )
        try session.setActive(true)
        return true
      } catch {
        return false
      }
    }

    // False when the session is still busy (the speech has not quite finished): the caller tries again.
    Function("abandon") { () -> Bool in
      do {
        try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        return true
      } catch {
        return false
      }
    }
  }
}
