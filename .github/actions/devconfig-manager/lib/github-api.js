const core = require('@actions/core');
const github = require('@actions/github');

class GitHubApi {
  constructor(token) {
    this.octokit = github.getOctokit(token);
    this.context = github.context;
  }

  /**
   * Post DevConfig preview comment to PR
   * @param {string} prNumber - Pull request number
   * @param {string} devConfigContent - Generated DevConfig JSON content
   */
  async postDevConfigPreviewComment(prNumber, devConfigContent) {
    core.info(`Posting DevConfig preview comment to PR #${prNumber}`);

    const commentBody = `## DevConfig File Needed

This PR requires a DevConfig file. Here's the suggested DevConfig:

\`\`\`json
${devConfigContent}
\`\`\`

**To add this DevConfig:**

1. Create the file \`./generator/.DevConfigs/pr-${prNumber}.json\`
2. Copy the JSON above into the file
3. Commit and push the file to your PR

For more information about DevConfig files, see the [DevConfig Files](https://github.com/aws/aws-sdk-net/blob/main/README.md#devconfig-files) section in the README.md.`;

    try {
      await this.octokit.rest.issues.createComment({
        owner: this.context.repo.owner,
        repo: this.context.repo.repo,
        issue_number: parseInt(prNumber),
        body: commentBody
      });

      core.info('DevConfig preview comment posted successfully');
    } catch (error) {
      core.error(`Failed to post preview comment: ${error.message}`);
      throw new Error(`GitHub API error: ${error.message}`);
    }
  }

  /**
   * Get current repository information
   * @returns {Object} - Repository information
   */
  getRepoInfo() {
    return {
      owner: this.context.repo.owner,
      repo: this.context.repo.repo,
      fullName: `${this.context.repo.owner}/${this.context.repo.repo}`
    };
  }
}

module.exports = GitHubApi;
