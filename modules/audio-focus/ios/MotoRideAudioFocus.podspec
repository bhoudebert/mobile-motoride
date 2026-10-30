Pod::Spec.new do |s|
  s.name           = 'MotoRideAudioFocus'
  s.version        = '1.0.0'
  s.summary        = 'Lowers the music while the voice speaks'
  s.description    = 'Lowers the music while the voice speaks (ADR 0038)'
  s.author         = ''
  s.homepage       = 'https://github.com/bhoudebert/mobile-motoride'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
  s.source_files = "**/*.{h,m,swift}"
end
