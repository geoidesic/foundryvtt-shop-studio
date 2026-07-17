import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, 'package.json');
const moduleJsonPath = path.join(__dirname, 'module.json');

const args = process.argv.slice(2);
const versionType = args[0];
const isDraft = args.includes('draft') || args.includes('--draft');
const isPreRelease = args.includes('pre') || args.includes('--pre');

if (!versionType) {
  console.error('Usage: node release.js <major|minor|patch> [draft|pre]');
  console.error('');
  console.error('  (none)  - Public release (bump version, build, tag, push, create GitHub release)');
  console.error('  draft   - Draft release with current version (no bump; creates draft release)');
  console.error('  pre     - Pre-release (e.g. 0.0.2-beta.1)');
  console.error('');
  console.error('Examples:');
  console.error('  node release.js patch        # Public release');
  console.error('  node release.js minor draft  # Draft with current version');
  console.error('  node release.js major pre    # Pre-release');
  process.exit(1);
}

const validTypes = ['major', 'minor', 'patch'];
if (!validTypes.includes(versionType)) {
  console.error(`Invalid version type: ${versionType}. Valid types: ${validTypes.join(', ')}`);
  process.exit(1);
}

if (isDraft && isPreRelease) {
  console.error('Cannot specify both "draft" and "pre".');
  process.exit(1);
}

try {
  const gitStatus = execSync('git status --porcelain').toString().trim();
  if (gitStatus) {
    console.error('Uncommitted changes detected. Commit or stash before releasing.');
    process.exit(1);
  }
} catch (e) {
  console.error('Error checking git status:', e.message);
  process.exit(1);
}

const isValidVersion = (v) => /^\d+\.\d+\.\d+(-\w+\.\d+)?$/.test(v);

function incrementVersion(version, type, isPre = false) {
  if (!isValidVersion(version)) {
    console.error(`Invalid version format: "${version}". Expected x.y.z or x.y.z-beta.n`);
    process.exit(1);
  }
  const isCurrentlyPre = /-beta\.(\d+)$/.test(version);
  const baseVersion = version.replace(/-.*$/, '');
  const currentBetaMatch = version.match(/-beta\.(\d+)$/);
  const currentBeta = currentBetaMatch ? parseInt(currentBetaMatch[1], 10) : 0;
  const parts = baseVersion.split('.').map(Number);

  let newVersion;
  if (isPre) {
    if (isCurrentlyPre) {
      newVersion = `${baseVersion}-beta.${currentBeta + 1}`;
    } else {
      switch (type) {
        case 'major': parts[0]++; parts[1] = 0; parts[2] = 0; break;
        case 'minor': parts[1]++; parts[2] = 0; break;
        case 'patch': parts[2]++; break;
        default: throw new Error('Invalid version type');
      }
      newVersion = `${parts.join('.')}-beta.1`;
    }
  } else {
    if (isCurrentlyPre) {
      newVersion = baseVersion;
    } else {
      switch (type) {
        case 'major': parts[0]++; parts[1] = 0; parts[2] = 0; break;
        case 'minor': parts[1]++; parts[2] = 0; break;
        case 'patch': parts[2]++; break;
        default: throw new Error('Invalid version type');
      }
      newVersion = parts.join('.');
    }
  }
  return newVersion;
}

function getPreviousTag() {
  try {
    return execSync('git describe --tags --abbrev=0').toString().trim();
  } catch {
    return null;
  }
}

function generateReleaseNotes(previousTag) {
  let range = previousTag ? `${previousTag}..HEAD` : '';
  const cmd = range ? `git log ${range} --pretty=format:"%s"` : 'git log --pretty=format:"%s" -n 30';
  let logOutput = '';
  try {
    logOutput = execSync(cmd).toString().trim();
  } catch {
    logOutput = '';
  }
  const messages = logOutput
    ? logOutput.split('\n').filter((m) => m && !/^(Release|chore: build and bump version)/i.test(m) && !/^\d+\.\d+\.\d+ manifest$/.test(m))
    : [];
  if (messages.length === 0) return "## Release Notes\n\nNo significant changes in this release.";
  return "## What's Changed\n\n" + messages.map((m) => `- ${m}`).join('\n');
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;

let newVersion;
if (isDraft) {
  newVersion = currentVersion;
  console.log(`Creating draft release with current version: ${newVersion}`);
} else {
  newVersion = incrementVersion(currentVersion, versionType, isPreRelease);
  console.log(`Releasing ${versionType}: ${currentVersion} → ${newVersion}${isPreRelease ? ' (pre-release)' : ''}`);
}

if (!isDraft) {
  try {
    execSync(`git rev-parse ${newVersion}`, { stdio: 'pipe' });
    console.error(`Tag ${newVersion} already exists.`);
    process.exit(1);
  } catch {
    /* tag does not exist, ok */
  }

  packageJson.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  const moduleJson = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf8'));
  moduleJson.version = newVersion;
  if (moduleJson.manifest) {
    moduleJson.manifest = moduleJson.manifest.replace(/\/releases\/download\/[^/]+\//, `/releases/download/${newVersion}/`);
  }
  if (moduleJson.download) {
    moduleJson.download = moduleJson.download.replace(/\/releases\/download\/[^/]+\//, `/releases/download/${newVersion}/`);
  }
  fs.writeFileSync(moduleJsonPath, JSON.stringify(moduleJson, null, 2));

  console.log('Building...');
  try {
    execSync('bun run build', { stdio: 'inherit' });
  } catch (e) {
    console.error('Build failed:', e.message);
    process.exit(1);
  }

  execSync('git add .');
  execSync(`git commit -m "chore: build and bump version to ${newVersion}"`);
}

const releaseNotes = generateReleaseNotes(getPreviousTag());
const releaseNotesPath = path.join(__dirname, 'release-notes.md');
fs.writeFileSync(releaseNotesPath, releaseNotes);

if (!isDraft) {
  execSync(`git tag ${newVersion}`);
  execSync('git push origin HEAD');
  execSync(`git push origin ${newVersion}`);
}

let ghCmd = `gh release create ${newVersion} --title "Version ${newVersion}" --notes-file ${releaseNotesPath}`;
if (isDraft) ghCmd += ' --draft';
if (isPreRelease) ghCmd += ' --prerelease';

try {
  execSync(ghCmd);
  console.log(`GitHub release created for ${newVersion}`);
} catch (e) {
  console.error('Failed to create GitHub release:', e.message);
  console.error('Install and authenticate GitHub CLI (gh): https://cli.github.com/');
  fs.unlinkSync(releaseNotesPath);
  process.exit(1);
}

try {
  fs.unlinkSync(releaseNotesPath);
} catch {
  /* ignore */
}

console.log(`Done. Release notes:\n${releaseNotes}`);
