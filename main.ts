import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from 'obsidian';
import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface GithubBlogSyncPluginSettings {
	githubUsername: string,
	githubRepoUrl: string,
	githubPersonalAccessToken: string,
	gitDirLocation: string,
	nameOfCommit: string,
	emailOfCommit: string,
}

const DEFAULT_SETTINGS: GithubBlogSyncPluginSettings = {
	githubUsername: '',
	githubRepoUrl: '',
	githubPersonalAccessToken: '',
	gitDirLocation: '',
	nameOfCommit: '',
	emailOfCommit: '',
}

export default class GithubBlogSyncPlugin extends Plugin {
	settings: GithubBlogSyncPluginSettings;

	async SyncBlog() {
		new Notice('Will push to repository');

		const NAME = this.settings.nameOfCommit;
		const EMAIL = this.settings.emailOfCommit;
		const PAT = this.settings.githubPersonalAccessToken;
		const REPO = this.settings.githubRepoUrl;
		const DIR = this.settings.gitDirLocation;

		const dir = path.join(this.app.vault.adapter.getBasePath(), DIR);

		try {
			await git.statusMatrix({ fs, dir: path.join(dir, 'public') }).then((status) =>
				Promise.all(
					status.map(([filepath, , worktreeStatus]) => {
						if (filepath.includes('.DS_Store')) {
							return;
						}
						return worktreeStatus ? git.add({ fs, dir, filepath: path.join('public', filepath) }) : git.remove({ fs, dir, filepath: path.join('public', filepath) });
					})
				)
			);
			await git.statusMatrix({ fs, dir: path.join(dir, 'content') }).then((status) =>
				Promise.all(
					status.map(([filepath, , worktreeStatus]) => {
						if (filepath.includes('.DS_Store')) {
							return;
						}
						return worktreeStatus ? git.add({ fs, dir, filepath: path.join('content', filepath) }) : git.remove({ fs, dir, filepath: path.join('content', filepath) });
					})
				)
			);
		} catch (e) {
			new Notice(`Couldn't add updated files. Problem: ${e}`, 10000);
			return e;
		}

		const hostname = os.hostname();

		try {
			await git.commit({
				fs,
				dir,
				message: hostname + ' ' + new Date(),
				ref: 'main',
				author: {
					name: NAME,
					email: EMAIL,
				}
			});
		} catch(e) {
			new Notice(`Couldn't commit changes to the branch. Problem: ${e}`, 10000);
			return e;
		}

		try {
			await git.push({
				fs,
				http,
				dir,
				url: 'https://' + REPO,
				onAuth: () => ({ username: PAT }),
			});
		} catch(e) {
			new Notice(`Couldn't push changes to the repository. Problem: ${e}`, 10000);
			return e;
		}

		new Notice(`GitHub Blog Sync: Pushed to ${REPO}`);
	}

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('apple', 'Github Blog Sync', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			this.SyncBlog();
		});
		ribbonIconEl.addClass('github-blog-sync-ribbon');

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'github-blog-sync-push-to-repo',
			name: 'Push to repository',
			callback: () => {
				this.SyncBlog();
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new GithubBlogSyncSettingTab(this.app, this));
	}

	onunload() {  }

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class GithubBlogSyncSettingTab extends PluginSettingTab {
	plugin: GithubBlogSyncPlugin;

	constructor(app: App, plugin: GithubBlogSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('GitHub Username')
			.setDesc('')
			.addText(text => text
				.setPlaceholder('')
				.setValue(this.plugin.settings.githubUsername)
				.onChange(async (value) => {
					this.plugin.settings.githubUsername = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('GitHub Repository Url')
			.setDesc('In the format github.com/username/repository')
			.addText(text => text
				.setPlaceholder('github.com/username/repository')
				.setValue(this.plugin.settings.githubRepoUrl)
				.onChange(async (value) => {
					this.plugin.settings.githubRepoUrl = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('GitHub Personal Access Token')
			.setDesc('In the format ghp_XXXXXXXXXXXXXXXXXXXXXXXX')
			.addText(text => text
				.setPlaceholder('ghp_XXXXXXXXXXXXXXXXXXXXXXXX')
				.setValue(this.plugin.settings.githubPersonalAccessToken)
				.onChange(async (value) => {
					this.plugin.settings.githubPersonalAccessToken = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('GitHub Folder Location')
			.setDesc('')
			.addText(text => text
				.setPlaceholder('/path/to/folder')
				.setValue(this.plugin.settings.gitDirLocation)
				.onChange(async (value) => {
					this.plugin.settings.gitDirLocation = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('GitHub Commit Name')
			.setDesc('')
			.addText(text => text
				.setPlaceholder('')
				.setValue(this.plugin.settings.nameOfCommit)
				.onChange(async (value) => {
					this.plugin.settings.nameOfCommit = value;
					await this.plugin.saveSettings();
					}));
		
		new Setting(containerEl)
			.setName('GitHub Commit Email')
			.setDesc('')
			.addText(text => text
				.setPlaceholder('')
				.setValue(this.plugin.settings.emailOfCommit)
				.onChange(async (value) => {
					this.plugin.settings.emailOfCommit = value;
					await this.plugin.saveSettings();
					}));
	}
}