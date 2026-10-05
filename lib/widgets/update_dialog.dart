import 'package:flutter/material.dart';

import '../core/theme.dart';
import '../services/update_service.dart';

/// Shows the "update available" prompt and drives the download/install flow
/// in place — the dialog itself owns the progress state so the caller (a
/// silent startup check or the About screen's "Check for updates" button)
/// stays a one-line call.
Future<void> showUpdateDialog(BuildContext context, UpdateInfo info) {
  return showDialog<void>(
    context: context,
    barrierDismissible: true,
    builder: (_) => _UpdateDialog(info: info),
  );
}

class _UpdateDialog extends StatefulWidget {
  const _UpdateDialog({required this.info});
  final UpdateInfo info;
  @override
  State<_UpdateDialog> createState() => _UpdateDialogState();
}

class _UpdateDialogState extends State<_UpdateDialog> {
  bool _downloading = false;
  double _progress = 0;
  String? _error;

  Future<void> _update() async {
    setState(() {
      _downloading = true;
      _error = null;
    });
    try {
      await UpdateService.instance.downloadAndInstall(widget.info, onProgress: (p) {
        if (mounted) setState(() => _progress = p);
      });
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _downloading = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final info = widget.info;
    return AlertDialog(
      title: const Text('Update available'),
      content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(
          info.versionName.isNotEmpty ? 'Version ${info.versionName} is ready to install.' : 'A new version is ready to install.',
          style: const TextStyle(fontSize: 14),
        ),
        if (info.notes.isNotEmpty) ...[
          const SizedBox(height: AppSpace.s2),
          Text(info.notes, style: TextStyle(fontSize: 12.5, color: AppColors.adaptive(context, AppColors.muted))),
        ],
        if (_downloading) ...[
          const SizedBox(height: AppSpace.s3),
          LinearProgressIndicator(value: _progress > 0 ? _progress : null),
          const SizedBox(height: AppSpace.s2),
          Text(
            _progress > 0 ? 'Downloading… ${(_progress * 100).round()}%' : 'Downloading…',
            style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted)),
          ),
        ],
        if (_error != null) ...[
          const SizedBox(height: AppSpace.s3),
          Text(_error!, style: TextStyle(fontSize: 12.5, color: AppColors.adaptive(context, AppColors.blockFg))),
        ],
      ]),
      actions: [
        if (!_downloading) TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Later')),
        FilledButton(
          onPressed: _downloading ? null : _update,
          child: Text(_error != null ? 'Try again' : 'Update now'),
        ),
      ],
    );
  }
}
