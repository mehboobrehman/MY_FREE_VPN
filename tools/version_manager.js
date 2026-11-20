const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * MY_FREE_VPN Version Manager
 * 
 * Handles Semantic Versioning across multiple files in the project.
 * Usage: node tools/version_manager.js [patch|minor|major|auto] [--hash]
 */

const VERSION_FILE = 'version.json';
const FILES_TO_UPDATE = [
    { path: 'version.json', type: 'json', key: 'version' },
    { path: 'package.json', type: 'json', key: 'version' },
    { path: 'backend/package.json', type: 'json', key: 'version' },
    { path: 'browser-extension/package.json', type: 'json', key: 'version' },
    { path: 'browser-extension/manifest.json', type: 'json', key: 'version' },
    { path: 'client/pubspec.yaml', type: 'yaml_version' },
    { path: 'client/lib/config/version_config.dart', type: 'dart_version' }
];

function getGitHash() {
    try {
        return execSync('git rev-parse --short HEAD').toString().trim();
    } catch (e) {
        return 'unknown';
    }
}

function hasChanges() {
    try {
        // Check for staged and unstaged changes
        const status = execSync('git status --porcelain').toString().trim();
        return status.length > 0;
    } catch (e) {
        // If not a git repo or git not found, assume changes to be safe
        return true;
    }
}

function incrementVersion(version, type) {
    const parts = version.split('.');
    if (parts.length !== 3) {
        throw new Error(`Current version "${version}" does not follow SemVer (X.Y.Z)`);
    }
    
    let [major, minor, patch] = parts.map(Number);
    
    if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
        throw new Error(`Current version "${version}" contains non-numeric parts`);
    }

    switch (type) {
        case 'major':
            major++;
            minor = 0;
            patch = 0;
            break;
        case 'minor':
            minor++;
            patch = 0;
            break;
        case 'patch':
        case 'auto':
            patch++;
            break;
        default:
            throw new Error(`Invalid increment type: ${type}. Expected patch, minor, major, or auto.`);
    }
    return `${major}.${minor}.${patch}`;
}

function updateFile(filePath, newVersion, buildMetadata) {
    const fullPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
        console.warn(`Warning: File not found: ${filePath}`);
        return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    const config = FILES_TO_UPDATE.find(f => f.path === filePath);

    if (config.type === 'json') {
        const json = JSON.parse(content);
        json[config.key] = newVersion;
        content = JSON.stringify(json, null, 2) + '\n';
    } else if (config.type === 'yaml_version') {
        // Format: version: X.Y.Z+build
        const versionMatch = content.match(/^version:\s*([^+]+)(?:\+(.+))?$/m);
        if (versionMatch) {
            const currentBuildPart = versionMatch[2] || '0';
            // Build number is typically the first part of the metadata after +
            const buildNumMatch = currentBuildPart.match(/^(\d+)/);
            const currentBuildNum = buildNumMatch ? parseInt(buildNumMatch[1]) : 0;
            const nextBuildNum = currentBuildNum + 1;
            
            let nextVersionValue = `${newVersion}+${nextBuildNum}`;
            if (buildMetadata) {
                nextVersionValue += `+build.${buildMetadata}`;
            }
            content = content.replace(/^version:\s*.+$/m, `version: ${nextVersionValue}`);
        } else {
            throw new Error(`Could not find version line in ${filePath}`);
        }
    } else if (config.type === 'dart_version') {
        // static const String version = 'X.Y.Z';
        // static const int buildNumber = 24;
        if (!content.includes('static const String version =')) {
             throw new Error(`Could not find version constant in ${filePath}`);
        }
        content = content.replace(/static const String version = '[^']+';/, `static const String version = '${newVersion}';`);
        
        const buildMatch = content.match(/static const int buildNumber = (\d+);/);
        if (buildMatch) {
            const nextBuild = parseInt(buildMatch[1]) + 1;
            content = content.replace(/static const int buildNumber = \d+;/, `static const int buildNumber = ${nextBuild};`);
        }
    }

    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Updated ${filePath}`);
}

const args = process.argv.slice(2);
const type = args.find(arg => !arg.startsWith('--')) || 'patch';
const includeHash = args.includes('--hash');

// Fail-fast on invalid version file
if (!fs.existsSync(VERSION_FILE)) {
    console.error(`Error: ${VERSION_FILE} not found. This is the source of truth for versioning.`);
    process.exit(1);
}

if (type === 'auto' && !hasChanges()) {
    console.log('No changes detected. Skipping version increment.');
    process.exit(0);
}

try {
    const versionData = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
    const currentVersion = versionData.version;
    const nextVersion = incrementVersion(currentVersion, type);
    const buildHash = includeHash ? getGitHash() : null;

    console.log(`Incrementing version: ${currentVersion} -> ${nextVersion} (${type})`);
    if (buildHash) console.log(`Appending build metadata: ${buildHash}`);

    // Update all files
    for (const file of FILES_TO_UPDATE) {
        updateFile(file.path, nextVersion, buildHash);
    }

    console.log(`Successfully updated all files to version ${nextVersion}`);
} catch (error) {
    console.error(`Error during version update: ${error.message}`);
    process.exit(1);
}
