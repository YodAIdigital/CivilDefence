#!/usr/bin/env node
/**
 * Version bump script for Civil Defence Pro
 *
 * Usage:
 *   node scripts/bump-version.js patch  - Bump patch version (1.0.0 -> 1.0.1)
 *   node scripts/bump-version.js minor  - Bump minor version (1.0.0 -> 1.1.0)
 *   node scripts/bump-version.js major  - Bump major version (1.0.0 -> 2.0.0)
 *   node scripts/bump-version.js        - Default: bump patch version
 */

const fs = require('fs')
const path = require('path')

const packagePath = path.join(__dirname, '..', 'package.json')

function bumpVersion(type = 'patch') {
  // Read package.json
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
  const currentVersion = packageJson.version

  // Parse version
  const [major, minor, patch] = currentVersion.split('.').map(Number)

  // Calculate new version
  let newVersion
  switch (type) {
    case 'major':
      newVersion = `${major + 1}.0.0`
      break
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`
      break
    case 'patch':
    default:
      newVersion = `${major}.${minor}.${patch + 1}`
      break
  }

  // Update package.json
  packageJson.version = newVersion
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n')

  console.log(`Version bumped: ${currentVersion} -> ${newVersion}`)
  return newVersion
}

// Get bump type from command line args
const bumpType = process.argv[2] || 'patch'

if (!['major', 'minor', 'patch'].includes(bumpType)) {
  console.error('Invalid bump type. Use: major, minor, or patch')
  process.exit(1)
}

bumpVersion(bumpType)
