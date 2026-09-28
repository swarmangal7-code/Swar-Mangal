import 'package:flutter_test/flutter_test.dart';

import 'package:swar_mangal/config.dart';
import 'package:swar_mangal/core/url_config.dart';

void main() {
  group('RpcUrlValidator', () {
    test('rejects placeholder URLs', () {
      final r = RpcUrlValidator.validate(
          'https://script.google.com/macros/s/REPLACE_WITH_FOUNDER_SCRIPT_ID/exec');
      expect(r.ok, isFalse);
      expect(r.error, contains('placeholder'));
    });

    test('rejects malformed URL (not https)', () {
      final r = RpcUrlValidator.validate('http://example.com/api/rpc');
      expect(r.ok, isFalse);
    });

    test('rejects URL with spaces', () {
      final r = RpcUrlValidator.validate('https://exa mple.com/api/rpc');
      expect(r.ok, isFalse);
    });

    test('accepts valid /api/rpc URL', () {
      final r =
          RpcUrlValidator.validate('https://swarmangal-app-production.up.railway.app/api/rpc');
      expect(r.ok, isTrue);
      expect(r.url, 'https://swarmangal-app-production.up.railway.app/api/rpc');
    });

    test('trims surrounding whitespace', () {
      final r = RpcUrlValidator.validate('  https://example.com/api/rpc  ');
      expect(r.ok, isTrue);
      expect(r.url, 'https://example.com/api/rpc');
    });
  });

  group('resolveEffectiveUrl', () {
    // The point of these is "the persisted value is ignored and the
    // configured production URL is used" — not which host production is
    // currently on, which changes on every redeploy. Asserting the literal
    // host is what made these go stale.
    test('ignores persisted placeholder, falls back to production', () {
      final url = resolveEffectiveUrl(
        persistedUrl: 'https://script.google.com/macros/s/REPLACE_WITH/exec',
        staff: false,
      );
      expect(url, AppConfig.founderApiUrl);
      expect(url.contains('REPLACE_WITH'), isFalse);
      expect(url.contains('script.google.com'), isFalse);
    });

    test('ignores persisted malformed URL', () {
      final url = resolveEffectiveUrl(persistedUrl: 'not a url', staff: true);
      expect(url, AppConfig.staffApiUrl);
      expect(RpcUrlValidator.isValid(url), isTrue);
    });

    test('uses persisted valid custom URL', () {
      final url = resolveEffectiveUrl(
          persistedUrl: 'https://custom.example.com/api/rpc', staff: false);
      expect(url, 'https://custom.example.com/api/rpc');
    });

    test('uses configured production when no persisted value', () {
      final url = resolveEffectiveUrl(persistedUrl: null, staff: false);
      expect(url, AppConfig.founderApiUrl);
    });
  });
}