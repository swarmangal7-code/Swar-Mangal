import 'package:flutter_test/flutter_test.dart';
import 'package:swar_mangal/services/update_service.dart';

void main() {
  group('UpdateInfo.fromJson', () {
    test('parses a well-formed manifest', () {
      final info = UpdateInfo.fromJson({
        'versionCode': 3,
        'versionName': '1.2.0',
        'apkUrl': 'https://148.113.52.88.nip.io/downloads/swar-mangal.apk',
        'notes': 'Bug fixes',
      });
      expect(info, isNotNull);
      expect(info!.versionCode, 3);
      expect(info.versionName, '1.2.0');
      expect(info.apkUrl, contains('swar-mangal.apk'));
      expect(info.notes, 'Bug fixes');
    });

    test('rejects a manifest missing versionCode', () {
      expect(UpdateInfo.fromJson({'apkUrl': 'https://example.com/app.apk'}), isNull);
    });

    test('rejects a manifest with a blank apkUrl', () {
      expect(UpdateInfo.fromJson({'versionCode': 2, 'apkUrl': '  '}), isNull);
    });

    test('defaults versionName/notes to empty, not null, when absent', () {
      final info = UpdateInfo.fromJson({'versionCode': 1, 'apkUrl': 'https://example.com/app.apk'});
      expect(info, isNotNull);
      expect(info!.versionName, '');
      expect(info.notes, '');
    });
  });
}
