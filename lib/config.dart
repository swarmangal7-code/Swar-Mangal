class AppConfig {
  AppConfig._();

  /// Default back-end target. Overridden at runtime from the Login screen
  /// (gear icon -> "API server"), persisted in shared_preferences.
  /// Points at the aaPanel VPS gateway (production as of the Railway ->
  /// VPS cutover) — answers the same RPC protocol the app was designed for.
  static const String founderApiUrl = 'https://148.113.52.88.nip.io/api/rpc';

  static const String staffApiUrl = 'https://148.113.52.88.nip.io/api/rpc';

  static const String appVersion = '1.0.0';
  static const String appBuild = 'RC300'; // standalone — no Google Script
  static const String appName = 'Swar Mangal';
}