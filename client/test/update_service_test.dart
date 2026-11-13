import 'package:flutter_test/flutter_test.dart';
import 'package:my_free_vpn/services/update_service.dart';

void main() {
  group('UpdateService Version Comparison Tests', () {
    test('compares older current version with newer latest version correctly', () {
      expect(UpdateService.compareVersions('1.1.21', '1.1.22'), greaterThan(0));
      expect(UpdateService.compareVersions('1.0.0', '2.0.0'), greaterThan(0));
      expect(UpdateService.compareVersions('1.1.9', '1.2.0'), greaterThan(0));
    });

    test('compares newer current version with older latest version correctly', () {
      expect(UpdateService.compareVersions('1.1.22', '1.1.21'), lessThan(0));
      expect(UpdateService.compareVersions('2.0.0', '1.9.9'), lessThan(0));
    });

    test('returns zero for identical versions', () {
      expect(UpdateService.compareVersions('1.1.21', '1.1.21'), equals(0));
      expect(UpdateService.compareVersions('v1.1.21', '1.1.21'), equals(0));
      expect(UpdateService.compareVersions('1.1.21+20', '1.1.21+21'), equals(0));
    });
  });

  group('GitHubRelease and ReleaseAsset Parsing Tests', () {
    test('parses GitHubRelease JSON correctly', () {
      final jsonMap = {
        'tag_name': 'v1.2.0',
        'name': 'Release v1.2.0',
        'body': 'Bug fixes and performance improvements.',
        'html_url': 'https://github.com/mehboobrehman/MY_FREE_VPN/releases/tag/v1.2.0',
        'draft': false,
        'prerelease': false,
        'assets': [
          {
            'name': 'MY_FREE_VPN_v1.2.0.apk',
            'size': 15482000,
            'browser_download_url': 'https://github.com/mehboobrehman/MY_FREE_VPN/releases/download/v1.2.0/MY_FREE_VPN_v1.2.0.apk'
          },
          {
            'name': 'SHA256SUMS',
            'size': 120,
            'browser_download_url': 'https://github.com/mehboobrehman/MY_FREE_VPN/releases/download/v1.2.0/SHA256SUMS'
          }
        ]
      };

      final release = GitHubRelease.fromJson(jsonMap);

      expect(release.tagName, 'v1.2.0');
      expect(release.name, 'Release v1.2.0');
      expect(release.body, 'Bug fixes and performance improvements.');
      expect(release.draft, isFalse);
      expect(release.prerelease, isFalse);
      expect(release.assets.length, 2);
      expect(release.assets[0].name, 'MY_FREE_VPN_v1.2.0.apk');
      expect(release.assets[0].size, 15482000);
      expect(release.assets[1].name, 'SHA256SUMS');
    });
  });
}
