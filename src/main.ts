import { App, Editor, MarkdownView, Modal, TextComponent, ButtonComponent, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface VimExPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: VimExPluginSettings = {
	mySetting: 'default'
}

export default class MyPlugin extends Plugin {
	settings: VimExPluginSettings;

	async onload() {
		await this.loadSettings();

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'file-rename-modal',
			name: 'Rename file',
			callback: () => {
				new FileRenameModal(this.app).open();
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new VimExSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class FileRenameModal extends Modal {
  basename: string | undefined;

	constructor(app: App) {
		super(app);

    this.basename = app.workspace.getActiveViewOfType(MarkdownView)?.file.basename;

    this.modalEl.style.width = "20em";
	}

	onOpen() {
    let _this = this;
    const { titleEl, modalEl, contentEl } = this;

    titleEl.innerText = "Rename file";

    let inputTextComponent = new TextComponent(contentEl).setValue(this.basename || "Untitled").setPlaceholder("Untitled");

    const buttonEl = modalEl.createDiv();
    buttonEl.addClass("modal-button-container");
    let saveButton = new ButtonComponent(buttonEl)
      .setButtonText("Save")
      .onClick(() => {
        const file = app.workspace.getActiveViewOfType(MarkdownView)?.file;
        const basename = inputTextComponent.getValue();
        if (file && basename) {
          const path = file.parent.path;
          const ext = file.extension;
          _this.app.fileManager.renameFile(file, `${path}/${basename}.${ext}`);
        }
        this.close();
      }).buttonEl.addClass("mod-cta");
    let cancelButton = new ButtonComponent(buttonEl)
      .setButtonText("Cancel")
      .onClick(() => {
        this.close();
      });
    inputTextComponent.inputEl.size = 40;
    inputTextComponent.inputEl.focus();
    inputTextComponent.inputEl.setSelectionRange(inputTextComponent.getValue().length, inputTextComponent.getValue().length);
    inputTextComponent.inputEl.addEventListener('keypress', function (keypressed) {
      if (keypressed.key === 'Enter') {
        const file = app.workspace.getActiveViewOfType(MarkdownView)?.file;
        const basename = inputTextComponent.getValue();
        if (file && basename) {
          const path = file.parent.path;
          const ext = file.extension;
          _this.app.fileManager.renameFile(file, `${path}/${basename}.${ext}`);
        }
        _this.close();
      }
    });
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class VimExSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings'});

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
