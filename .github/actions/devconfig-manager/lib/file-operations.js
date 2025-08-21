const core = require('@actions/core');
const fs = require('fs').promises;
const path = require('path');

class FileOperations {
  constructor() {
    this.devConfigDir = './generator/.DevConfigs';
  }

  /**
   * Check if DevConfig files already exist in the repository
   * @returns {boolean} - True if DevConfig files exist
   */
  async hasExistingDevConfig() {
    core.info('Checking for existing DevConfig files...');

    try {
      // Check if .DevConfigs directory exists
      const dirExists = await this.directoryExists(this.devConfigDir);
      if (!dirExists) {
        core.info('DevConfig directory does not exist');
        return false;
      }

      // Check if directory has any .json files
      const files = await fs.readdir(this.devConfigDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));

      const hasFiles = jsonFiles.length > 0;
      core.info(`Found ${jsonFiles.length} DevConfig files: ${jsonFiles.join(', ')}`);
      
      return hasFiles;
    } catch (error) {
      core.warning(`Error checking for existing DevConfig files: ${error.message}`);
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
