const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs').promises;
const DevConfigGenerator = require('./lib/devconfig-generator');
const FileAnalyzer = require('./lib/file-analyzer');
const FileOperations = require('./lib/file-operations');

async function run() {
  try {
    // Get inputs
    const prTitle = core.getInput('pr-title', { required: true });
    const prNumber = core.getInput('pr-number', { required: true });
    const branchName = core.getInput('branch-name', { required: true });

    core.info('Running DevConfig validation...');

    // Initialize components
    const fileAnalyzer = new FileAnalyzer();
    const devConfigGenerator = new DevConfigGenerator();
    const fileOps = new FileOperations();

    await handleValidate({
      prTitle,
      prNumber,
      branchName,
      fileAnalyzer,
      devConfigGenerator,
      fileOps
    });

    core.info('DevConfig validation completed successfully');
  } catch (error) {
    core.setFailed(`DevConfig validation failed: ${error.message}`);
    core.debug(error.stack);
  }
}

async function handleValidate({
  prTitle,
  prNumber,
  branchName,
  fileAnalyzer,
  devConfigGenerator,
  fileOps
}) {
  core.info('Validating DevConfig requirements...');

  // Skip validation for specific branches
  const excludedBranches = ['main', 'development', 'aws-sdk-net-v3.7', 'aws-sdk-net-v3.7-development'];
  if (excludedBranches.includes(branchName)) {
    core.info(`Branch ${branchName} is excluded from DevConfig validation`);
    core.setOutput('needs-devconfig', 'false');
    return;
  }

  // Analyze changes first
  const changes = await fileAnalyzer.analyzeChanges();
  
  core.info(`Changes detected - Core: ${changes.coreChanges}, Services: ${changes.serviceChanges.length}`);
  
  // All PRs need DevConfig (simplified logic)
  core.setOutput('needs-devconfig', 'true');

  // Check for existing DevConfig files
  const hasDevConfig = await fileOps.hasExistingDevConfig();
  core.setOutput('has-devconfig', hasDevConfig.toString());

  let validation = null;
  let devConfigContent = null;

  if (hasDevConfig) {
    core.info('DevConfig files exist in this PR, validating contents...');
    
    // Validate DevConfig contents against detected changes
    validation = await fileOps.validateDevConfigContents(changes);
    
    if (validation.isValid) {
      core.info('DevConfig validation passed - all changes are covered');
      return;
    } else {
      core.warning('DevConfig validation failed - missing services or core section');
      
      // Generate corrected DevConfig suggestion
      devConfigContent = await devConfigGenerator.generate(prTitle, changes);
      core.setOutput('devconfig-content', devConfigContent);
    }
  } else {
    core.info('No DevConfig files found in this PR');
    
    // Generate preview DevConfig
    devConfigContent = await devConfigGenerator.generate(prTitle, changes);
    core.setOutput('devconfig-content', devConfigContent);
  }

  // Write results to file for artifact upload
  const results = {
    prNumber: parseInt(prNumber),
    needsDevConfig: true, // All PRs need DevConfig now
    hasDevConfig: hasDevConfig,
    validation: validation,
    devConfigContent: devConfigContent,
    timestamp: new Date().toISOString()
  };

  await fs.writeFile('devconfig-results.json', JSON.stringify(results, null, 2));
  core.info('DevConfig results written to artifact file');
}


// Self-executing function
if (require.main === module) {
  run();
}

module.exports = { run };
