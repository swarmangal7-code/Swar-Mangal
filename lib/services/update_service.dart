import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:open_filex/open_filex.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';

/// Where the latest release APK and its version manifest are published —
/// the same static folder the dashboard's "Download APK" button already
/// points at (see web-shell.tsx's APK_DOWNLOAD_URL). This is a plain static
/// file fetch, not an RPC call: no auth, no demo-mode branching needed, it
/// works the same for every signed-in user.
const _versionManifestUrl = 'https://148.113.52.88.nip.io/downloads/version.json';

class UpdateInfo {
  const UpdateInfo({required this.versionCode, required this.versionName, required this.apkUrl, required this.notes});
  final int versionCode;
  final String versionName;
  final String apkUrl;
  final String notes;

  static UpdateInfo? fromJson(Map<String, dynamic> j) {
    final code = j['versionCode'];
    final url = (j['apkUrl'] ?? '').toString().trim();
    if (code is! int || url.isEmpty) return null;
    return UpdateInfo(
      versionCode: code,
      versionName: (j['versionName'] ?? '').toString(),
      apkUrl: url,
      notes: (j['notes'] ?? '').toString(),
    );
  }
}

/// Checks the server's published version manifest against the installed
/// build and, if newer, downloads and opens the APK with the system package
/// installer — no browser, no manual download page. Every step fails
/// silently (returns null / throws a plain Exception the caller shows as a
/// message) rather than nagging the user on a flaky connection.
class UpdateService {
  UpdateService._();
  static final UpdateService instance = UpdateService._();

  /// Null if up to date, unreachable, or the manifest is malformed.
  Future<UpdateInfo?> checkForUpdate() async {
    try {
      final res = await http.get(Uri.parse(_versionManifestUrl)).timeout(const Duration(seconds: 8));
      if (res.statusCode != 200) return null;
      final info = UpdateInfo.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
      if (info == null) return null;
      final current = await PackageInfo.fromPlatform();
      final installed = int.tryParse(current.buildNumber) ?? 0;
      return info.versionCode > installed ? info : null;
    } catch (_) {
      return null;
    }
  }

  /// Downloads the APK to the app's cache dir, reporting 0..1 progress, then
  /// hands it to the OS installer. Android still requires the user to grant
  /// "install unknown apps" for this app the first time — OpenFilex surfaces
  /// that as its own result rather than a thrown error.
  Future<void> downloadAndInstall(UpdateInfo info, {void Function(double progress)? onProgress}) async {
    final req = http.Request('GET', Uri.parse(info.apkUrl));
    final res = await http.Client().send(req);
    if (res.statusCode != 200) {
      throw Exception('Could not download the update (HTTP ${res.statusCode}).');
    }
    final total = res.contentLength ?? 0;
    var received = 0;
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/swar-mangal-update.apk');
    final sink = file.openWrite();
    try {
      await for (final chunk in res.stream) {
        sink.add(chunk);
        received += chunk.length;
        if (total > 0) onProgress?.call(received / total);
      }
    } finally {
      await sink.close();
    }

    final result = await OpenFilex.open(file.path, type: 'application/vnd.android.package-archive');
    if (result.type != ResultType.done) {
      throw Exception(result.message.isNotEmpty ? result.message : 'Could not open the installer.');
    }
  }
}
