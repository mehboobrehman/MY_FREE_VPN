import 'dart:io';
import 'package:flutter/material.dart';
import 'package:my_free_vpn/services/update_service.dart';

class UpdateBanner extends StatelessWidget {
  final UpdateCheckResult updateResult;
  final VoidCallback onDismiss;
  final VoidCallback onUpdateClicked;

  const UpdateBanner({
    Key? key,
    required this.updateResult,
    required this.onDismiss,
    required this.onUpdateClicked,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    if (!updateResult.updateAvailable) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.all(12.0),
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      decoration: BoxDecoration(
        color: Colors.blue.shade900.withOpacity(0.85),
        borderRadius: BorderRadius.circular(16.0),
        border: Border.all(color: Colors.blueAccent.withOpacity(0.5)),
        boxShadow: [
          BoxShadow(
            color: Colors.blue.withOpacity(0.3),
            blurRadius: 10,
            spreadRadius: 2,
          ),
        ],
      ),
      child: Row(
        children: [
          const Icon(Icons.system_update, color: Colors.cyanAccent, size: 28),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Update v${updateResult.latestVersion} Available!',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'A new secure version of MY FREE VPN is ready.',
                  style: TextStyle(
                    color: Colors.blue.shade100,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          ElevatedButton(
            onPressed: onUpdateClicked,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.cyanAccent,
              foregroundColor: Colors.black87,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Update', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
          ),
          const SizedBox(width: 6),
          IconButton(
            icon: const Icon(Icons.close, color: Colors.white70, size: 20),
            onPressed: onDismiss,
            tooltip: 'Later',
          ),
        ],
      ),
    );
  }
}

class UpdateDialogs {
  static void showReleaseNotesDialog(BuildContext context, GitHubRelease release, VoidCallback onUpdatePressed) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            const Icon(Icons.new_releases, color: Colors.cyanAccent),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Release ${release.tagName}',
                style: const TextStyle(color: Colors.white, fontSize: 18),
              ),
            ),
          ],
        ),
        content: SizedBox(
          width: double.maxFinite,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  release.name.isNotEmpty ? release.name : release.tagName,
                  style: const TextStyle(color: Colors.cyanAccent, fontWeight: FontWeight.bold, fontSize: 14),
                ),
                const SizedBox(height: 12),
                Text(
                  release.body.isNotEmpty ? release.body : 'No release notes provided for this version.',
                  style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Later', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              UpdateService.openReleasePage();
            },
            child: const Text('Open in Browser', style: TextStyle(color: Colors.blueAccent)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              onUpdatePressed();
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.cyanAccent, foregroundColor: Colors.black87),
            child: const Text('Download & Install', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  static void showDownloadProgressDialog(
    BuildContext context,
    ReleaseAsset asset,
    ReleaseAsset? checksumAsset,
  ) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _DownloadProgressDialogWidget(
        asset: asset,
        checksumAsset: checksumAsset,
      ),
    );
  }

  static void showCheckForUpdatesResultDialog(BuildContext context, UpdateCheckResult result) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Icon(
              result.updateAvailable ? Icons.system_update : Icons.check_circle_outline,
              color: result.updateAvailable ? Colors.cyanAccent : Colors.greenAccent,
            ),
            const SizedBox(width: 10),
            Text(
              result.updateAvailable ? 'Update Available' : 'You Are Up to Date',
              style: const TextStyle(color: Colors.white, fontSize: 18),
            ),
          ],
        ),
        content: Text(
          result.updateAvailable
              ? 'Version ${result.latestVersion} is available (Current: v${result.currentVersion}). Would you like to view release notes?'
              : 'You are currently running the latest version of MY FREE VPN (v${result.currentVersion}).',
          style: const TextStyle(color: Colors.white70, fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('OK', style: TextStyle(color: Colors.grey)),
          ),
          if (result.updateAvailable && result.release != null)
            ElevatedButton(
              onPressed: () {
                Navigator.of(ctx).pop();
                showReleaseNotesDialog(context, result.release!, () {
                  if (result.targetAsset != null) {
                    showDownloadProgressDialog(context, result.targetAsset!, result.checksumAsset);
                  } else {
                    UpdateService.openReleasePage();
                  }
                });
              },
              style: ElevatedButton.styleFrom(backgroundColor: Colors.cyanAccent, foregroundColor: Colors.black87),
              child: const Text('View Release Notes', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
        ],
      ),
    );
  }
}

class _DownloadProgressDialogWidget extends StatefulWidget {
  final ReleaseAsset asset;
  final ReleaseAsset? checksumAsset;

  const _DownloadProgressDialogWidget({
    Key? key,
    required this.asset,
    required this.checksumAsset,
  }) : super(key: key);

  @override
  State<_DownloadProgressDialogWidget> createState() => _DownloadProgressDialogWidgetState();
}

class _DownloadProgressDialogWidgetState extends State<_DownloadProgressDialogWidget> {
  double _progress = 0.0;
  String _statusText = 'Preparing download...';
  bool _isDownloading = true;
  bool _isInstalling = false;
  final ValueNotifier<bool> _cancelNotifier = ValueNotifier<bool>(false);
  File? _downloadedFile;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _startDownload();
  }

  Future<void> _startDownload() async {
    setState(() {
      _isDownloading = true;
      _isInstalling = false;
      _errorMessage = null;
      _progress = 0.0;
      _statusText = 'Downloading ${widget.asset.name}...';
      _cancelNotifier.value = false;
    });

    try {
      final file = await UpdateService.downloadUpdateAsset(
        asset: widget.asset,
        checksumAsset: widget.checksumAsset,
        onProgress: (p) {
          if (mounted) {
            setState(() {
              _progress = p;
              _statusText = 'Downloading... ${(p * 100).toStringAsFixed(0)}%';
            });
          }
        },
        cancelNotifier: _cancelNotifier,
      );

      if (!mounted) return;

      if (file == null) {
        // Cancelled
        Navigator.of(context).pop();
        return;
      }

      setState(() {
        _downloadedFile = file;
        _isDownloading = false;
        _isInstalling = true;
        _statusText = 'Verifying and preparing installation...';
      });

      // Install update
      await UpdateService.installUpdate(file);

      if (!mounted) return;
      setState(() {
        _isInstalling = false;
        _statusText = 'Installation launched successfully.';
      });

      await Future.delayed(const Duration(seconds: 1));
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isDownloading = false;
        _isInstalling = false;
        _errorMessage = e.toString();
        _statusText = 'Update failed.';
      });
    }
  }

  @override
  void dispose() {
    _cancelNotifier.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: const Color(0xFF1E293B),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Row(
        children: [
          const Icon(Icons.download, color: Colors.cyanAccent),
          const SizedBox(width: 10),
          const Text('Updating MY FREE VPN', style: TextStyle(color: Colors.white, fontSize: 18)),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(_statusText, style: const TextStyle(color: Colors.white70, fontSize: 14)),
          const SizedBox(height: 16),
          if (_isDownloading || _isInstalling) ...[
            LinearProgressIndicator(
              value: _isInstalling ? null : _progress,
              backgroundColor: Colors.white12,
              valueColor: const AlwaysStoppedAnimation<Color>(Colors.cyanAccent),
            ),
            const SizedBox(height: 12),
            if (_isDownloading)
              Align(
                alignment: Alignment.centerRight,
                child: Text(
                  '${(_progress * 100).toStringAsFixed(1)}%',
                  style: const TextStyle(color: Colors.cyanAccent, fontFamily: 'monospace', fontWeight: FontWeight.bold),
                ),
              ),
          ],
          if (_errorMessage != null) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.red.withOpacity(0.2),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.red.withOpacity(0.5)),
              ),
              child: Text(
                _errorMessage!,
                style: TextStyle(color: Colors.red.shade200, fontSize: 12),
              ),
            ),
          ],
        ],
      ),
      actions: [
        if (_isDownloading)
          TextButton(
            onPressed: () {
              _cancelNotifier.value = true;
            },
            child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
          ),
        if (!_isDownloading && !_isInstalling && _errorMessage != null) ...[
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () {
              UpdateService.openReleasePage();
              Navigator.of(context).pop();
            },
            child: const Text('Open Downloads Page', style: TextStyle(color: Colors.blueAccent)),
          ),
          ElevatedButton(
            onPressed: _startDownload,
            style: ElevatedButton.styleFrom(backgroundColor: Colors.cyanAccent, foregroundColor: Colors.black87),
            child: const Text('Retry', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ],
    );
  }
}
