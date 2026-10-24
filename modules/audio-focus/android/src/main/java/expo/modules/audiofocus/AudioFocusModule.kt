package expo.modules.audiofocus

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Asks Android to lower the music while the voice speaks (spec voice-guidance, ADR 0038). The speech engine plays as plain media
 * audio and requests no focus of its own, so the music would go on at full volume under the voice.
 */
class AudioFocusModule : Module() {
  private var request: AudioFocusRequest? = null
  private val listener = AudioManager.OnAudioFocusChangeListener { }

  private val audioManager: AudioManager?
    get() = appContext.reactContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager

  override fun definition() = ModuleDefinition {
    Name("MotoRideAudioFocus")

    // True when Android granted it; the voice speaks either way.
    Function("requestDuck") {
      val am = audioManager ?: return@Function false
      val granted =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          val attributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build()
          val focus = request ?: AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
            .setAudioAttributes(attributes)
            .setWillPauseWhenDucked(false)
            .setOnAudioFocusChangeListener(listener)
            .build()
            .also { request = it }
          am.requestAudioFocus(focus)
        } else {
          @Suppress("DEPRECATION")
          am.requestAudioFocus(listener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
        }
      granted == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }

    Function("abandon") {
      val am = audioManager ?: return@Function false
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        request?.let { am.abandonAudioFocusRequest(it) }
      } else {
        @Suppress("DEPRECATION")
        am.abandonAudioFocus(listener)
      }
      true
    }
  }
}
