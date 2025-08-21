const core = require('@actions/core');
const fs = require('fs').promises;
const path = require('path');
const simpleGit = require('simple-git');

class FileOperations {
  constructor() {
    this.devConfigDir = './generator/.DevConfigs';
    this.git = simpleGit();
  }

  /**
   * Check if DevConfig files were added/modified in this PR
   * @returns {boolean} - True if DevConfig files were changed in this PR
   */
  async hasExistingDevConfig() {
    core.info('Checking if DevConfig files were added/modified in this PR...');

    try {
      // Get list of changed files compared to origin/main
      const diffResult = await this.git.diff(['--name-only', 'origin/main...']);
      const changedFiles = diffResult.split('\n').filter(file => file.trim() !== '');

      // Filter for DevConfig files that were added/modified in this PR
      const devConfigChanges = changedFiles.filter(file => 
        file.startsWith('generator/.DevConfigs/') && file.endsWith('.json')
      );

      const hasDevConfigChanges = devConfigChanges.length > 0;
      
      if (hasDevConfigChanges) {
        core.info(`Found ${devConfigChanges.length} DevConfig files changed in this PR: ${devConfigChanges.join(', ')}`);
      } else {
        core.info('No DevConfig files were added/modified in this PR');
      }
      
      return hasDevConfigChanges;
    } catch (error) {
      core.warning(`Error checking for DevConfig changes: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if a directory exists
   * @param {string} dirPath - Directory path to check
   * @returns {boolean} - True if directory exists
   */
  async directoryExists(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
}

module.exports = FileOperations;
